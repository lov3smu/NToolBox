import { app, clipboard, nativeImage, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { createHash, randomUUID } from 'crypto'
import { log } from '../utils'
import { IPC_EVENTS } from '../../shared/ipc'
import { normalizeClipboardHistoryConfig } from '../../shared/clipboardSettings.js'
import { getConfig } from './config.js'
import { imageFilePathsFromText } from './clipboardPaths.js'
import { mergeHistoryEntry, normalizeStoredHistory, trimHistory } from './clipboardHistory.js'
import {
  clearClipboardEntries,
  getClipboardPausedState,
  listClipboardEntries,
  loadClipboardEntries,
  pruneClipboardEntries,
  removeClipboardEntry as removeClipboardEntryRow,
  replaceClipboardEntries,
  saveClipboardEntry,
  setClipboardPausedState
} from './sqlite/clipboardRepository.js'

const POLL_INTERVAL = 800
const SAVE_DELAY = 500
const MAX_TEXT_LENGTH = 200000
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

let entries = []
let paused = false
let initialized = false
let pollTimer = null
let saveTimer = null
let polling = false
let lastSignature = ''
let staleHistoryRemoved = false
let dirtyIds = new Set()
let removedIds = new Set()

function getHistoryPath() {
  return path.join(app.getPath('userData'), 'clipboard-history.json')
}

function clipboardSettings() {
  return normalizeClipboardHistoryConfig(getConfig()?.clipboard_history)
}

function historyLimit() {
  return clipboardSettings().max_entries
}

async function removeHistoryFile() {
  try {
    await fs.promises.rm(getHistoryPath(), { force: true })
  } catch (error) {
    log.warn('删除剪贴板历史文件失败:', error.message)
  }
}

async function syncPersistenceState(settings) {
  if (settings.persist) {
    if (staleHistoryRemoved) {
      staleHistoryRemoved = false
      await persistAll()
    }
  } else if (!staleHistoryRemoved) {
    await clearClipboardEntries().catch(() => {})
    await removeHistoryFile()
    staleHistoryRemoved = true
  }
}

function digest(kind, data) {
  return createHash('sha256').update(kind).update('\0').update(data).digest('hex')
}

function publicEntry(entry) {
  return {
    id: entry.id,
    type: entry.type,
    ...(entry.type === 'text' ? { text: entry.text } : { image: entry.image }),
    pinned: entry.pinned,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  }
}

export function getClipboardState() {
  return { entries: entries.map(publicEntry), paused }
}

function broadcast() {
  const state = getClipboardState()
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC_EVENTS.clipboardChanged, state)
  }
}

async function persistAll() {
  const settings = clipboardSettings()
  if (!settings.persist) return
  dirtyIds = new Set()
  removedIds = new Set()
  try {
    await replaceClipboardEntries(entries, settings.max_entries)
    await setClipboardPausedState(paused)
  } catch (error) {
    log.warn('保存剪贴板历史失败:', error.message)
  }
}

async function flushPersistence() {
  const settings = clipboardSettings()
  if (!settings.persist) {
    await clearClipboardEntries().catch(() => {})
    await removeHistoryFile()
    return
  }

  const changed = entries.filter((entry) => dirtyIds.has(entry.id))
  const removed = [...removedIds]
  dirtyIds = new Set()
  removedIds = new Set()
  try {
    for (const entry of changed) await saveClipboardEntry(entry)
    for (const id of removed) await removeClipboardEntryRow(id)
    await pruneClipboardEntries(settings.max_entries)
    await setClipboardPausedState(paused)
  } catch (error) {
    log.warn('保存剪贴板历史失败:', error.message)
  }
}

function persistSoon() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void flushPersistence()
  }, SAVE_DELAY)
}

async function migrateLegacyHistory(settings) {
  let raw
  try {
    raw = JSON.parse(await fs.promises.readFile(getHistoryPath(), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') log.warn('读取剪贴板历史失败:', error.message)
    return
  }
  try {
    const existing = await listClipboardEntries({ limit: 1 })
    if (existing.total === 0) {
      const stored = normalizeStoredHistory(raw, settings.max_entries)
      await replaceClipboardEntries(stored.entries, settings.max_entries)
      await setClipboardPausedState(stored.paused)
    }
    await removeHistoryFile()
  } catch (error) {
    log.warn('迁移剪贴板历史失败:', error.message)
  }
}

function updateEntries(next) {
  const previous = new Map(entries.map((entry) => [entry.id, entry]))
  const nextIds = new Set()
  for (const entry of next) {
    nextIds.add(entry.id)
    if (previous.get(entry.id) !== entry) dirtyIds.add(entry.id)
  }
  for (const entry of entries) {
    if (!nextIds.has(entry.id)) removedIds.add(entry.id)
  }
  entries = next
  persistSoon()
  broadcast()
}

function readClipboardImage() {
  const formats = clipboard.availableFormats()
  const imageFormat = formats.find((format) => /^image\//i.test(format) || /png|tiff|jpe?g/i.test(format))
  if (!imageFormat) return null

  const buffer = clipboard.readBuffer(imageFormat)
  if (!buffer || buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null

  return {
    type: 'image',
    buffer,
    fingerprint: digest('image', buffer),
    size: buffer.length
  }
}

async function readImageFile(filePath) {
  try {
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile() || stat.size === 0 || stat.size > MAX_IMAGE_BYTES) return null

    const buffer = await fs.promises.readFile(filePath)
    if (buffer.length === 0) return null

    return {
      type: 'image',
      buffer,
      fingerprint: digest('image', buffer),
      size: buffer.length
    }
  } catch {
    return null
  }
}

// PNG 编码开销大，只在指纹变化后才执行，避免每轮轮询阻塞主线程
function encodeImageSnapshot(snapshot) {
  const image = nativeImage.createFromBuffer(snapshot.buffer)
  if (image.isEmpty()) return null
  const encoded = { ...snapshot, image: image.toDataURL() }
  delete encoded.buffer
  return encoded
}

async function readCurrentSnapshots() {
  const snapshots = []
  const text = clipboard.readText()
  if (text && text.length <= MAX_TEXT_LENGTH) {
    snapshots.push({ type: 'text', text, fingerprint: digest('text', text), size: text.length })
  }

  const clipboardImage = readClipboardImage()
  if (clipboardImage) snapshots.push(clipboardImage)

  // 复制图片文件时，剪贴板往往只有文件路径，需要按路径读取图片内容
  if (!clipboardImage && text) {
    for (const filePath of imageFilePathsFromText(text)) {
      const fileImage = await readImageFile(filePath)
      if (fileImage) {
        snapshots.push(fileImage)
        break
      }
    }
  }

  return snapshots
}

function snapshotSignature(snapshots) {
  return snapshots
    .map((snapshot) => snapshot.fingerprint)
    .sort()
    .join('|')
}

function toHistoryEntry(snapshot, now) {
  const base = {
    id: randomUUID(),
    fingerprint: snapshot.fingerprint,
    pinned: false,
    createdAt: now,
    updatedAt: now
  }
  return snapshot.type === 'image'
    ? { ...base, type: 'image', image: snapshot.image }
    : { ...base, type: 'text', text: snapshot.text }
}

async function pollClipboard() {
  if (paused || polling) return
  polling = true

  try {
    const settings = clipboardSettings()
    await syncPersistenceState(settings)
    const snapshots = await readCurrentSnapshots()
    let next = entries.length > settings.max_entries ? trimHistory(entries, settings.max_entries) : entries

    if (snapshots.length === 0) {
      lastSignature = ''
      if (next !== entries) updateEntries(next)
      return
    }

    const signature = snapshotSignature(snapshots)
    if (signature === lastSignature) {
      if (next !== entries) updateEntries(next)
      return
    }
    lastSignature = signature

    const now = Date.now()
    for (const snapshot of snapshots) {
      const resolved = snapshot.type === 'image' ? encodeImageSnapshot(snapshot) : snapshot
      if (!resolved) continue
      next = mergeHistoryEntry(next, toHistoryEntry(resolved, now), settings.max_entries)
    }
    if (next !== entries) updateEntries(next)
  } catch (error) {
    log.warn('读取剪贴板失败:', error.message)
  } finally {
    polling = false
  }
}

export async function initClipboardHistory() {
  if (initialized) return
  initialized = true

  const settings = clipboardSettings()
  if (settings.persist) {
    await migrateLegacyHistory(settings)
    try {
      const stored = await loadClipboardEntries(settings.max_entries)
      entries = trimHistory(stored, settings.max_entries)
      paused = await getClipboardPausedState()
    } catch (error) {
      log.warn('读取剪贴板历史失败:', error.message)
    }
  } else {
    await syncPersistenceState(settings)
  }

  pollTimer = setInterval(pollClipboard, POLL_INTERVAL)
  pollTimer.unref?.()
}

export function stopClipboardHistory() {
  if (!initialized) return
  initialized = false
  clearInterval(pollTimer)
  pollTimer = null
  clearTimeout(saveTimer)
  saveTimer = null
  void flushPersistence()
}

export function copyClipboardEntry(id) {
  const entry = entries.find((item) => item.id === id)
  if (!entry) return false

  if (entry.type === 'image') {
    const image = nativeImage.createFromDataURL(entry.image)
    if (image.isEmpty()) return false
    clipboard.writeImage(image)
  } else {
    clipboard.writeText(entry.text)
  }

  lastSignature = entry.fingerprint
  updateEntries(mergeHistoryEntry(entries, { ...entry, updatedAt: Date.now() }, historyLimit()))
  return true
}

export function removeClipboardEntry(id) {
  if (typeof id !== 'string') return false
  const next = entries.filter((entry) => entry.id !== id)
  if (next.length === entries.length) return false
  updateEntries(next)
  return true
}

export function toggleClipboardPin(id) {
  const entry = entries.find((item) => item.id === id)
  if (!entry) return false
  updateEntries(entries.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item)))
  return true
}

export async function clearClipboardHistory() {
  lastSignature = snapshotSignature(await readCurrentSnapshots())
  updateEntries([])
  return true
}

export function setClipboardPaused(value) {
  paused = Boolean(value)
  updateEntries(entries)
  return paused
}
