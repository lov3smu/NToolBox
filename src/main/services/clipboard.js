import { app, clipboard, nativeImage, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import { createHash, randomUUID } from 'crypto'
import { log } from '../utils'
import { IPC_EVENTS } from '../../shared/ipc'
import {
  CLIPBOARD_HISTORY_VERSION,
  MAX_CLIPBOARD_ENTRIES,
  mergeHistoryEntry,
  normalizeStoredHistory
} from './clipboardHistory.js'

const POLL_INTERVAL = 800
const SAVE_DELAY = 500
const MAX_TEXT_LENGTH = 200000
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

let entries = []
let paused = false
let initialized = false
let pollTimer = null
let saveTimer = null
let lastFingerprint = ''

function getHistoryPath() {
  return path.join(app.getPath('userData'), 'clipboard-history.json')
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

function serializeHistory() {
  return JSON.stringify({ version: CLIPBOARD_HISTORY_VERSION, paused, entries })
}

async function persistNow() {
  const file = getHistoryPath()
  const temp = `${file}.tmp`
  try {
    await fs.promises.writeFile(temp, serializeHistory(), { mode: 0o600 })
    await fs.promises.rename(temp, file)
  } catch (error) {
    log.warn('保存剪贴板历史失败:', error.message)
  }
}

function persistSoon() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void persistNow()
  }, SAVE_DELAY)
}

function persistSync() {
  try {
    fs.writeFileSync(getHistoryPath(), serializeHistory(), { mode: 0o600 })
  } catch (error) {
    log.warn('保存剪贴板历史失败:', error.message)
  }
}

function updateEntries(next) {
  entries = next
  persistSoon()
  broadcast()
}

function readCurrentSnapshot() {
  const text = clipboard.readText()
  if (text) {
    return { type: 'text', text, fingerprint: digest('text', text), size: text.length }
  }

  const formats = clipboard.availableFormats()
  const imageFormat = formats.find((format) => /^image\//i.test(format) || /png|tiff|jpe?g/i.test(format))
  if (!imageFormat) return null

  const buffer = clipboard.readBuffer(imageFormat)
  if (!buffer || buffer.length === 0) return null
  return { type: 'image-buffer', buffer, fingerprint: digest('image', buffer), size: buffer.length }
}

function pollClipboard() {
  if (paused) return

  try {
    const snapshot = readCurrentSnapshot()
    if (!snapshot) {
      lastFingerprint = ''
      return
    }
    if (snapshot.fingerprint === lastFingerprint) return
    lastFingerprint = snapshot.fingerprint

    if (snapshot.type === 'text') {
      if (snapshot.size > MAX_TEXT_LENGTH) return
      const now = Date.now()
      updateEntries(
        mergeHistoryEntry(
          entries,
          {
            id: randomUUID(),
            type: 'text',
            text: snapshot.text,
            fingerprint: snapshot.fingerprint,
            pinned: false,
            createdAt: now,
            updatedAt: now
          },
          MAX_CLIPBOARD_ENTRIES
        )
      )
      return
    }

    if (snapshot.size > MAX_IMAGE_BYTES) return
    const image = clipboard.readImage()
    if (image.isEmpty()) return
    const now = Date.now()
    updateEntries(
      mergeHistoryEntry(
        entries,
        {
          id: randomUUID(),
          type: 'image',
          image: image.toDataURL(),
          fingerprint: snapshot.fingerprint,
          pinned: false,
          createdAt: now,
          updatedAt: now
        },
        MAX_CLIPBOARD_ENTRIES
      )
    )
  } catch (error) {
    log.warn('读取剪贴板失败:', error.message)
  }
}

export async function initClipboardHistory() {
  if (initialized) return
  initialized = true

  try {
    const raw = JSON.parse(await fs.promises.readFile(getHistoryPath(), 'utf8'))
    const stored = normalizeStoredHistory(raw)
    entries = stored.entries
    paused = stored.paused
  } catch (error) {
    if (error.code !== 'ENOENT') log.warn('读取剪贴板历史失败:', error.message)
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
  persistSync()
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

  lastFingerprint = entry.fingerprint
  updateEntries(mergeHistoryEntry(entries, { ...entry, updatedAt: Date.now() }, MAX_CLIPBOARD_ENTRIES))
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
  entry.pinned = !entry.pinned
  updateEntries(entries)
  return true
}

export function clearClipboardHistory() {
  const snapshot = readCurrentSnapshot()
  if (snapshot) lastFingerprint = snapshot.fingerprint
  updateEntries([])
  return true
}

export function setClipboardPaused(value) {
  paused = Boolean(value)
  updateEntries(entries)
  return paused
}
