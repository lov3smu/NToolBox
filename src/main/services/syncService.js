import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import log from '../utils/logger'
import { writeFileAtomic } from '../utils/atomicFile'
import { getConfigPath } from '../utils/path'
import { encrypt, decrypt } from '../utils/crypto'
import { getConfig, saveConfig } from './config'
import { decryptSnapshotText, encryptSnapshotText, isEncryptedSnapshot } from './syncCrypto'
import {
  SYNC_FILE_NAME,
  SYNC_FORMAT,
  SYNC_MAX_BYTES,
  SYNC_SECTION_IDS,
  SYNC_VERSION,
  buildSyncPatch,
  buildSyncSnapshot,
  extractSyncSections,
  isSyncSectionId,
  mergeSyncSections,
  normalizeSyncDevice,
  parseSyncSnapshot
} from '../../shared/syncBundle.js'

const STATE_VERSION = 2
const AUTO_SYNC_INTERVAL_MS = 10 * 60 * 1000
const AUTO_SYNC_START_DELAY_MS = 15 * 1000
const MAX_PASSPHRASE_LENGTH = 128
const RECOVERABLE_REMOTE_CODES = new Set(['remote-invalid', 'remote-size', 'read-failed', 'locked', 'plaintext'])

let autoSyncTimer = null
let autoSyncStartTimer = null

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function getSyncStatePath() {
  return path.join(path.dirname(getConfigPath()), 'sync-state.json')
}

function defaultState() {
  return {
    type: 'ntoolbox-sync-state',
    version: STATE_VERSION,
    device_id: crypto.randomUUID(),
    device_name: os.hostname() || 'NToolBox',
    directory: '',
    sections: {},
    disabled_sections: [],
    auto_sync: false,
    passphrase_enc: '',
    last_sync_at: '',
    last_result: null
  }
}

function normalizeStoredState(raw) {
  const state = defaultState()
  if (!isPlainObject(raw)) return state
  if (typeof raw.device_id === 'string' && raw.device_id.trim()) state.device_id = raw.device_id.trim()
  if (typeof raw.device_name === 'string' && raw.device_name.trim()) state.device_name = raw.device_name.trim()
  if (typeof raw.directory === 'string') state.directory = raw.directory
  if (isPlainObject(raw.sections)) {
    for (const id of SYNC_SECTION_IDS) {
      const entry = raw.sections[id]
      if (!isPlainObject(entry) || typeof entry.hash !== 'string') continue
      state.sections[id] = {
        hash: entry.hash,
        updated_at: Number.isFinite(entry.updated_at) ? Math.max(0, Math.floor(entry.updated_at)) : 0
      }
    }
  }
  if (Array.isArray(raw.disabled_sections)) {
    state.disabled_sections = [...new Set(raw.disabled_sections.filter(isSyncSectionId))]
  }
  if (typeof raw.auto_sync === 'boolean') state.auto_sync = raw.auto_sync
  if (typeof raw.passphrase_enc === 'string') state.passphrase_enc = raw.passphrase_enc
  if (typeof raw.last_sync_at === 'string') state.last_sync_at = raw.last_sync_at
  if (isPlainObject(raw.last_result)) state.last_result = raw.last_result
  return state
}

async function readState() {
  try {
    const text = await fs.promises.readFile(getSyncStatePath(), 'utf8')
    return normalizeStoredState(JSON.parse(text))
  } catch (error) {
    if (error.code !== 'ENOENT') log.warn('读取同步状态失败:', error.message)
    return defaultState()
  }
}

async function writeState(state) {
  const filePath = getSyncStatePath()
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 })
  await writeFileAtomic(filePath, JSON.stringify(state, null, 2), 'utf8')
  if (process.platform !== 'win32') {
    await fs.promises.chmod(filePath, 0o600).catch(() => {})
  }
}

function publicStatus(state, remoteInfo = null) {
  const result = isPlainObject(state.last_result) ? state.last_result : null
  const status = {
    configured: Boolean(state.directory),
    directory: state.directory || '',
    deviceName: state.device_name,
    lastSyncAt: state.last_sync_at || '',
    disabledSections: [...state.disabled_sections],
    autoSync: state.auto_sync,
    passphraseSet: Boolean(state.passphrase_enc),
    lastResult: result
      ? {
          applied: Array.isArray(result.applied) ? result.applied : [],
          pushed: Array.isArray(result.pushed) ? result.pushed : [],
          conflicts: Array.isArray(result.conflicts) ? result.conflicts : [],
          remoteDevice: typeof result.remoteDevice === 'string' ? result.remoteDevice : '',
          remoteUpdatedAt: typeof result.remoteUpdatedAt === 'string' ? result.remoteUpdatedAt : ''
        }
      : null
  }
  if (remoteInfo) Object.assign(status, remoteInfo)
  return status
}

function readPassphrase(state) {
  if (!state.passphrase_enc) return ''
  try {
    return decrypt(state.passphrase_enc) || ''
  } catch (error) {
    log.warn('读取同步口令失败:', error.message)
    return ''
  }
}

async function readRemoteSnapshot(remotePath, passphrase) {
  let stat
  try {
    stat = await fs.promises.stat(remotePath)
  } catch (error) {
    if (error.code === 'ENOENT') return { ok: true, exists: false, snapshot: null, encrypted: false }
    log.warn('读取同步文件失败:', error.message)
    return { ok: false, code: 'read-failed' }
  }
  if (!stat.isFile()) return { ok: false, code: 'remote-invalid' }
  if (stat.size > SYNC_MAX_BYTES) return { ok: false, code: 'remote-size' }

  let text
  try {
    text = await fs.promises.readFile(remotePath, 'utf8')
  } catch (error) {
    log.warn('读取同步文件失败:', error.message)
    return { ok: false, code: 'read-failed' }
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    return { ok: false, code: 'remote-invalid' }
  }
  if (!isPlainObject(payload)) return { ok: false, code: 'remote-invalid' }

  if (isEncryptedSnapshot(payload)) {
    if (!passphrase) return { ok: false, code: 'locked' }
    const body = decryptSnapshotText(payload, passphrase)
    if (!body) return { ok: false, code: 'locked' }
    let parsedBody
    try {
      parsedBody = JSON.parse(body)
    } catch {
      return { ok: false, code: 'remote-invalid' }
    }
    const parsed = parseSyncSnapshot({
      type: SYNC_FORMAT,
      version: SYNC_VERSION,
      ...(isPlainObject(parsedBody) ? parsedBody : {})
    })
    if (!parsed.ok) return { ok: false, code: 'remote-invalid' }
    return { ok: true, exists: true, snapshot: parsed.snapshot, encrypted: true }
  }

  if (passphrase) return { ok: false, code: 'plaintext' }
  const parsed = parseSyncSnapshot(payload)
  if (!parsed.ok) return { ok: false, code: 'remote-invalid' }
  return { ok: true, exists: true, snapshot: parsed.snapshot, encrypted: false }
}

async function backupBrokenRemote(remotePath) {
  const backupPath = `${remotePath}.broken-${Date.now()}`
  await fs.promises.rename(remotePath, backupPath)
  return backupPath
}

async function verifyDirectory(directory) {
  if (typeof directory !== 'string' || !directory.trim() || !path.isAbsolute(directory)) return false
  try {
    const stat = await fs.promises.stat(directory)
    if (!stat.isDirectory()) return false
    await fs.promises.access(directory, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

function isRemoteNewer(state, remote) {
  const remoteAt = remote?.snapshot?.updated_at || ''
  if (!remoteAt || !state.last_sync_at) return false
  const remoteTime = Date.parse(remoteAt)
  const localTime = Date.parse(state.last_sync_at)
  return Number.isFinite(remoteTime) && Number.isFinite(localTime) && remoteTime > localTime
}

export async function getSyncStatus() {
  const state = await readState()
  if (!state.directory) return publicStatus(state)
  const remote = await readRemoteSnapshot(path.join(state.directory, SYNC_FILE_NAME), readPassphrase(state))
  return publicStatus(state, {
    remoteExists: remote.ok ? remote.exists : false,
    remoteEncrypted: remote.ok ? remote.encrypted : false,
    remoteUpdatedAt: remote.ok ? remote.snapshot?.updated_at || '' : '',
    remoteNewer: remote.ok ? isRemoteNewer(state, remote) : false,
    remoteError: remote.ok ? '' : remote.code
  })
}

export async function setSyncDirectory(directory) {
  const trimmed = typeof directory === 'string' ? directory.trim() : ''
  if (!(await verifyDirectory(trimmed))) return { success: false, code: 'invalid-directory' }
  const state = await readState()
  if (state.directory !== trimmed) {
    state.directory = trimmed
    state.sections = {}
    state.last_sync_at = ''
    state.last_result = null
  }
  await writeState(state)
  return { success: true, status: publicStatus(state) }
}

export async function setSyncDeviceName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed || trimmed.length > 60) return { success: false, code: 'invalid-name' }
  const state = await readState()
  state.device_name = trimmed
  await writeState(state)
  return { success: true, status: publicStatus(state) }
}

export async function setSyncSections(disabledSections) {
  if (!Array.isArray(disabledSections)) return { success: false, code: 'invalid-sections' }
  const state = await readState()
  state.disabled_sections = [...new Set(disabledSections.filter(isSyncSectionId))]
  await writeState(state)
  return { success: true, status: publicStatus(state) }
}

export async function setSyncAutoSync(enabled) {
  if (typeof enabled !== 'boolean') return { success: false, code: 'invalid-value' }
  const state = await readState()
  state.auto_sync = enabled
  await writeState(state)
  return { success: true, status: publicStatus(state) }
}

export async function setSyncPassphrase(passphrase) {
  const value = typeof passphrase === 'string' ? passphrase : ''
  if (value.length > MAX_PASSPHRASE_LENGTH) return { success: false, code: 'invalid-passphrase' }
  const state = await readState()
  try {
    state.passphrase_enc = value ? encrypt(value) : ''
  } catch (error) {
    log.warn('保存同步口令失败:', error.message)
    return { success: false, code: 'passphrase-failed' }
  }
  await writeState(state)
  return { success: true, status: publicStatus(state) }
}

export async function clearSync() {
  try {
    await fs.promises.rm(getSyncStatePath(), { force: true })
  } catch (error) {
    log.warn('清除同步状态失败:', error.message)
    return { success: false, code: 'clear-failed' }
  }
  return { success: true, status: publicStatus(defaultState()) }
}

function hashValues(values) {
  return crypto.createHash('sha256').update(JSON.stringify(values)).digest('hex')
}

async function getConfigMtimeMs() {
  try {
    const stat = await fs.promises.stat(getConfigPath())
    return Math.max(0, Math.floor(stat.mtimeMs))
  } catch {
    return Date.now()
  }
}

function detectConflicts(state, localValues, remoteSections, sectionIds) {
  const conflicts = []
  for (const id of sectionIds) {
    const previous = state.sections[id]
    const remote = remoteSections[id]
    if (!previous || !remote) continue
    const localChanged = previous.hash !== hashValues(localValues[id])
    const remoteChanged = previous.hash !== hashValues(remote.values)
    if (!localChanged || !remoteChanged) continue
    if (JSON.stringify(localValues[id]) === JSON.stringify(remote.values)) continue
    conflicts.push(id)
  }
  return conflicts
}

function enabledSectionIds(state) {
  return SYNC_SECTION_IDS.filter((id) => !state.disabled_sections.includes(id))
}

async function computePlan(state, remote) {
  const enabled = enabledSectionIds(state)
  const configMtime = await getConfigMtimeMs()
  const localValues = extractSyncSections(getConfig())
  const localSections = {}

  for (const id of enabled) {
    if (!isPlainObject(localValues[id])) continue
    const previous = state.sections[id]
    const hash = hashValues(localValues[id])
    // 本机未同步过的分区没有本地修改基线，用 config 文件时间冒充修改时间会让新设备的默认值覆盖共享文件
    let updatedAt = 0
    if (previous) {
      updatedAt = previous.hash === hash ? previous.updated_at : Math.max(previous.updated_at + 1, configMtime)
    }
    localSections[id] = { updated_at: updatedAt, values: localValues[id] }
  }

  const remoteSections = {}
  const snapshotSections = remote.snapshot?.sections || {}
  for (const id of enabled) {
    if (isPlainObject(snapshotSections[id])) remoteSections[id] = snapshotSections[id]
  }

  const merged = mergeSyncSections(localSections, remoteSections)
  const conflicts = detectConflicts(state, localValues, remoteSections, [...merged.applied, ...merged.pushed])
  return { enabled, localValues, merged, conflicts }
}

async function loadRemoteForOperation(state, remotePath) {
  const passphrase = readPassphrase(state)
  const remote = await readRemoteSnapshot(remotePath, passphrase)
  return { passphrase, remote }
}

export async function previewSync() {
  const state = await readState()
  if (!state.directory) return { success: false, code: 'not-configured' }
  if (!(await verifyDirectory(state.directory))) return { success: false, code: 'missing-directory' }

  const remotePath = path.join(state.directory, SYNC_FILE_NAME)
  const { remote } = await loadRemoteForOperation(state, remotePath)
  if (!remote.ok) {
    return { success: false, code: remote.code, recoverable: RECOVERABLE_REMOTE_CODES.has(remote.code) }
  }

  const plan = await computePlan(state, remote)
  return {
    success: true,
    applied: plan.merged.applied,
    pushed: plan.merged.pushed,
    conflicts: plan.conflicts,
    disabledSections: [...state.disabled_sections],
    remoteExists: remote.exists,
    remoteDevice: remote.snapshot?.device?.name || '',
    remoteUpdatedAt: remote.snapshot?.updated_at || '',
    encrypted: remote.exists ? remote.encrypted : Boolean(state.passphrase_enc)
  }
}

async function runSync(options = {}) {
  const force = options.force === true
  const state = await readState()
  if (!state.directory) return { success: false, code: 'not-configured' }
  if (!(await verifyDirectory(state.directory))) return { success: false, code: 'missing-directory' }

  const remotePath = path.join(state.directory, SYNC_FILE_NAME)
  const { passphrase } = await loadRemoteForOperation(state, remotePath)
  let remote = await readRemoteSnapshot(remotePath, passphrase)
  let backupPath = ''

  if (!remote.ok) {
    const recoverable = RECOVERABLE_REMOTE_CODES.has(remote.code)
    if (!force || !recoverable) return { success: false, code: remote.code, recoverable }
    try {
      backupPath = await backupBrokenRemote(remotePath)
      log.info(`已备份不可读的同步文件：${backupPath}`)
    } catch (error) {
      log.warn('备份同步文件失败:', error.message)
      return { success: false, code: 'write-failed', recoverable }
    }
    remote = { ok: true, exists: false, snapshot: null, encrypted: false }
  }

  const plan = await computePlan(state, remote)

  if (plan.merged.applied.length > 0) {
    const patch = buildSyncPatch(
      Object.fromEntries(
        plan.merged.applied
          .map((id) => [id, plan.merged.sections[id]?.values])
          .filter(([, values]) => isPlainObject(values))
      )
    )
    if (Object.keys(patch).length > 0) {
      const saved = await saveConfig(patch)
      if (!saved) return { success: false, code: 'save-failed' }
    }
  }

  const syncedAt = new Date().toISOString()
  if (plan.merged.pushed.length > 0 || !remote.exists || backupPath) {
    const snapshotSections = {}
    for (const id of SYNC_SECTION_IDS) {
      if (plan.enabled.includes(id)) {
        if (plan.merged.sections[id]) snapshotSections[id] = plan.merged.sections[id]
      } else if (isPlainObject(remote.snapshot?.sections?.[id])) {
        snapshotSections[id] = remote.snapshot.sections[id]
      }
    }
    const snapshot = buildSyncSnapshot({
      sections: snapshotSections,
      device: normalizeSyncDevice({ id: state.device_id, name: state.device_name }),
      updatedAt: syncedAt
    })
    const text = passphrase
      ? encryptSnapshotText(
          JSON.stringify({ updated_at: snapshot.updated_at, device: snapshot.device, sections: snapshot.sections }),
          passphrase
        )
      : JSON.stringify(snapshot, null, 2)
    try {
      await writeFileAtomic(remotePath, text, 'utf8')
    } catch (error) {
      log.warn('写入同步文件失败:', error.message)
      return { success: false, code: 'write-failed' }
    }
  }

  for (const id of plan.enabled) {
    const entry = plan.merged.sections[id]
    if (!entry) continue
    state.sections[id] = { hash: hashValues(entry.values), updated_at: entry.updated_at }
  }
  state.last_sync_at = syncedAt
  state.last_result = {
    applied: plan.merged.applied,
    pushed: plan.merged.pushed,
    conflicts: plan.conflicts,
    remoteDevice: remote.snapshot?.device?.name || '',
    remoteUpdatedAt: remote.snapshot?.updated_at || ''
  }
  await writeState(state)

  log.info(
    `跨设备同步完成：应用 ${plan.merged.applied.length} 项，推送 ${plan.merged.pushed.length} 项，冲突 ${plan.conflicts.length} 项`
  )
  return {
    success: true,
    applied: plan.merged.applied,
    pushed: plan.merged.pushed,
    conflicts: plan.conflicts,
    disabledSections: [...state.disabled_sections],
    remoteDevice: state.last_result.remoteDevice,
    remoteUpdatedAt: state.last_result.remoteUpdatedAt,
    syncedAt,
    backupPath,
    directory: state.directory,
    status: publicStatus(state, {
      remoteExists: true,
      remoteUpdatedAt: state.last_result.remoteUpdatedAt,
      remoteNewer: false,
      remoteError: ''
    })
  }
}

let syncChain = Promise.resolve()

export function syncNow(options = {}) {
  const task = syncChain.then(() => runSync(options))
  syncChain = task.catch(() => {})
  return task
}

export function startAutoSync({ onApplied } = {}) {
  if (autoSyncTimer || autoSyncStartTimer) return
  const runOnce = async () => {
    try {
      const state = await readState()
      if (!state.auto_sync || !state.directory) return
      const result = await syncNow()
      if (result?.success && result.applied?.length > 0) onApplied?.(result)
    } catch (error) {
      log.warn('自动同步失败:', error.message)
    }
  }
  autoSyncStartTimer = setTimeout(() => {
    autoSyncStartTimer = null
    runOnce()
  }, AUTO_SYNC_START_DELAY_MS)
  autoSyncStartTimer.unref?.()
  autoSyncTimer = setInterval(runOnce, AUTO_SYNC_INTERVAL_MS)
  autoSyncTimer.unref?.()
}

export function stopAutoSync() {
  if (autoSyncStartTimer) {
    clearTimeout(autoSyncStartTimer)
    autoSyncStartTimer = null
  }
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
}
