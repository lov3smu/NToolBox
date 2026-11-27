import fs from 'fs'
import path from 'path'
import { log } from '../utils'
import { writeFileAtomic } from '../utils/atomicFile'
import { getConfigPath } from '../utils/path'
import { netFetch } from './network'
import { isHttpUrl } from '../../shared/network.js'
import {
  MANAGED_PROFILE_MAX_BYTES,
  MANAGED_PROFILE_TYPE,
  MANAGED_PROFILE_VERSION,
  parseManagedProfile
} from '../../shared/managedProfile.js'

const FETCH_TIMEOUT_MS = 20000
const MAX_SOURCE_LENGTH = 2048

let activeProfile = null

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function normalizeSource(raw) {
  if (!isPlainObject(raw)) return null
  const kind = raw.kind === 'url' || raw.kind === 'file' ? raw.kind : ''
  const value = typeof raw.value === 'string' ? raw.value.trim().slice(0, MAX_SOURCE_LENGTH) : ''
  if (!kind || !value) return null
  return { kind, value }
}

export function getManagedProfilePath() {
  return path.join(path.dirname(getConfigPath()), 'managed-profile.json')
}

export function getManagedSettings() {
  return activeProfile?.settings || null
}

export function getManagedProfileInfo() {
  if (!activeProfile) return { active: false, path: getManagedProfilePath() }
  return {
    active: true,
    path: getManagedProfilePath(),
    name: activeProfile.name,
    owner: activeProfile.owner,
    description: activeProfile.description,
    updatedAt: activeProfile.updatedAt,
    appliedAt: activeProfile.appliedAt,
    source: activeProfile.source ? { ...activeProfile.source } : null,
    paths: [...activeProfile.paths]
  }
}

function toActiveProfile(stored) {
  const parsed = parseManagedProfile(stored)
  if (!parsed.ok) return null
  return {
    ...parsed.profile,
    appliedAt: typeof stored.applied_at === 'string' ? stored.applied_at : '',
    source: normalizeSource(stored.source),
    restore: isPlainObject(stored.restore) ? cloneValue(stored.restore) : {}
  }
}

export async function readManagedProfileFile() {
  const filePath = getManagedProfilePath()
  let text
  try {
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) return { ok: false, code: 'read' }
    if (stat.size > MANAGED_PROFILE_MAX_BYTES) return { ok: false, code: 'size' }
    text = await fs.promises.readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return { ok: false, code: 'missing' }
    log.warn('读取团队托管配置失败:', error.message)
    return { ok: false, code: 'read' }
  }

  try {
    const stored = JSON.parse(text)
    if (!isPlainObject(stored)) return { ok: false, code: 'format' }
    return { ok: true, stored }
  } catch {
    return { ok: false, code: 'format' }
  }
}

export async function initManagedProfile() {
  const loaded = await readManagedProfileFile()
  if (!loaded.ok) {
    if (loaded.code !== 'missing') log.warn('团队托管配置无效，已忽略:', loaded.code)
    activeProfile = null
    return null
  }
  activeProfile = toActiveProfile(loaded.stored)
  if (!activeProfile) {
    log.warn('团队托管配置解析失败，已忽略')
    return null
  }
  log.info(`已加载团队托管配置：${activeProfile.name}`)
  return getManagedProfileInfo()
}

export async function writeManagedProfileFile(stored) {
  const payload = {
    type: MANAGED_PROFILE_TYPE,
    version: MANAGED_PROFILE_VERSION,
    name: stored?.name,
    owner: stored?.owner,
    description: stored?.description,
    updated_at: stored?.updated_at,
    applied_at: typeof stored?.applied_at === 'string' ? stored.applied_at : '',
    source: normalizeSource(stored?.source),
    settings: stored?.settings,
    restore: isPlainObject(stored?.restore) ? cloneValue(stored.restore) : {}
  }
  const parsed = parseManagedProfile(payload)
  if (!parsed.ok) return { success: false, code: parsed.code }
  const normalized = {
    type: MANAGED_PROFILE_TYPE,
    version: MANAGED_PROFILE_VERSION,
    name: parsed.profile.name,
    owner: parsed.profile.owner,
    description: parsed.profile.description,
    updated_at: parsed.profile.updatedAt,
    applied_at: payload.applied_at,
    source: payload.source,
    settings: parsed.profile.settings,
    restore: payload.restore
  }
  try {
    await writeFileAtomic(getManagedProfilePath(), JSON.stringify(normalized, null, 2), 'utf8')
    activeProfile = toActiveProfile(normalized)
    return { success: true, info: getManagedProfileInfo() }
  } catch (error) {
    log.error('保存团队托管配置失败:', error)
    return { success: false, code: 'read' }
  }
}

export async function removeManagedProfileFile() {
  activeProfile = null
  try {
    await fs.promises.rm(getManagedProfilePath(), { force: true })
  } catch (error) {
    log.warn('删除团队托管配置失败:', error.message)
  }
}

export async function readManagedProfileFilePreview(filePath) {
  try {
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) return { success: false, code: 'read' }
    if (stat.size > MANAGED_PROFILE_MAX_BYTES) return { success: false, code: 'size' }
    const text = await fs.promises.readFile(filePath, 'utf8')
    const parsed = parseManagedProfile(text)
    if (!parsed.ok) return { success: false, code: parsed.code }
    return {
      success: true,
      raw: text,
      profile: parsed.profile,
      source: { kind: 'file', value: filePath }
    }
  } catch (error) {
    log.warn('读取团队托管配置失败:', error.message)
    return { success: false, code: 'read' }
  }
}

export async function fetchManagedProfileText(url) {
  const target = typeof url === 'string' ? url.trim() : ''
  if (!isHttpUrl(target)) return { success: false, code: 'url' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await netFetch(target, {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    })
    if (!response || !response.ok) return { success: false, code: 'network' }
    const declared = Number(response.headers?.get?.('content-length') || 0)
    if (declared > MANAGED_PROFILE_MAX_BYTES) return { success: false, code: 'size' }
    const text = await response.text()
    if (text.length > MANAGED_PROFILE_MAX_BYTES) return { success: false, code: 'size' }
    return { success: true, text }
  } catch (error) {
    log.warn('下载团队托管配置失败:', error.message)
    return { success: false, code: 'network' }
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchManagedProfilePreview(url) {
  const target = typeof url === 'string' ? url.trim() : ''
  const fetched = await fetchManagedProfileText(target)
  if (!fetched.success) return fetched
  const parsed = parseManagedProfile(fetched.text)
  if (!parsed.ok) return { success: false, code: parsed.code }
  return {
    success: true,
    raw: fetched.text,
    profile: parsed.profile,
    source: { kind: 'url', value: target.slice(0, MAX_SOURCE_LENGTH) }
  }
}
