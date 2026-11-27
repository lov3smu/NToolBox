import { getStorage } from './index.js'

const MAX_PAGE_SIZE = 300
const PAUSED_KEY = 'clipboard.paused'

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

function clampLimit(value, fallback = MAX_PAGE_SIZE) {
  const size = Math.floor(Number(value))
  if (!Number.isFinite(size) || size <= 0) return fallback
  return Math.min(size, MAX_PAGE_SIZE)
}

function entryRow(entry) {
  const type = entry.type === 'image' ? 'image' : 'text'
  const content = type === 'image' ? String(entry.image || '') : String(entry.text || '')
  const createdAt = Number(entry.createdAt) || 0
  const updatedAt = Number(entry.updatedAt) || createdAt || Date.now()
  return {
    id: String(entry.id),
    payload: JSON.stringify({
      type,
      fingerprint: String(entry.fingerprint || ''),
      ...(type === 'image' ? { image: content } : { text: content }),
      createdAt,
      updatedAt
    }),
    preview: type === 'text' ? content.replace(/\s+/g, ' ').trim().slice(0, 200) : '',
    pinned: entry.pinned === true ? 1 : 0,
    size: content.length,
    created_at: createdAt || updatedAt,
    updated_at: updatedAt
  }
}

function parsePayload(raw) {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function rowToEntry(row) {
  const payload = parsePayload(row.payload)
  const type = payload.type === 'image' ? 'image' : 'text'
  return {
    id: row.id,
    type,
    ...(type === 'image' ? { image: String(payload.image || '') } : { text: String(payload.text || '') }),
    fingerprint: String(payload.fingerprint || ''),
    pinned: Number(row.pinned) === 1,
    createdAt: Number(payload.createdAt) || 0,
    updatedAt: Number(payload.updatedAt) || Number(row.updated_at) || Number(payload.createdAt) || 0
  }
}

export async function listClipboardEntries({ limit, offset } = {}) {
  const db = await getStorage()
  const size = clampLimit(limit)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const [countRow, rows] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM clipboard_history'),
    db.all('SELECT * FROM clipboard_history ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?', [size, start])
  ])
  const total = Number(countRow?.total) || 0
  return { items: rows.map(rowToEntry), total, hasMore: start + rows.length < total }
}

export async function loadClipboardEntries(limit) {
  const page = await listClipboardEntries({ limit: clampLimit(limit) })
  return page.items
}

export async function saveClipboardEntry(entry) {
  if (!entry || !entry.id) return false
  const row = entryRow(entry)
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(
      `INSERT INTO clipboard_history (id, payload, preview, pinned, size, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, preview = excluded.preview,
          pinned = excluded.pinned, size = excluded.size, created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
      [row.id, row.payload, row.preview, row.pinned, row.size, row.created_at, row.updated_at]
    )
    return true
  })
}

export async function removeClipboardEntry(id) {
  const entryId = String(id || '')
  if (!entryId) return false
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM clipboard_history WHERE id = ?', [entryId])
    return true
  })
}

export async function clearClipboardEntries() {
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM clipboard_history')
    return true
  })
}

// 置顶条目不计入保留条数，与内存中的 trimHistory 语义保持一致
export async function pruneClipboardEntries(retentionLimit) {
  const limit = Math.max(1, Math.floor(Number(retentionLimit)) || 120)
  return enqueue(async () => {
    const db = await getStorage()
    const pinnedRow = await db.get('SELECT COUNT(*) AS total FROM clipboard_history WHERE pinned = 1')
    const pinned = Number(pinnedRow?.total) || 0
    const keep = Math.max(0, limit - pinned)
    await db.run(
      `DELETE FROM clipboard_history WHERE pinned = 0 AND id NOT IN (
        SELECT id FROM clipboard_history WHERE pinned = 0 ORDER BY updated_at DESC, id DESC LIMIT ?
      )`,
      [keep]
    )
    return true
  })
}

export async function replaceClipboardEntries(entries, retentionLimit) {
  const list = Array.isArray(entries) ? entries.filter((entry) => entry && entry.id) : []
  const limit = Math.max(1, Math.floor(Number(retentionLimit)) || 120)
  const pinned = list.filter((entry) => entry.pinned === true).length
  const keep = Math.max(0, limit - pinned)
  return enqueue(async () => {
    const db = await getStorage()
    await db.transaction([
      { type: 'run', sql: 'DELETE FROM clipboard_history', params: [] },
      ...list.map((entry) => {
        const row = entryRow(entry)
        return {
          type: 'run',
          sql: `INSERT OR REPLACE INTO clipboard_history
            (id, payload, preview, pinned, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          params: [row.id, row.payload, row.preview, row.pinned, row.size, row.created_at, row.updated_at]
        }
      }),
      {
        type: 'run',
        sql: `DELETE FROM clipboard_history WHERE pinned = 0 AND id NOT IN (
          SELECT id FROM clipboard_history WHERE pinned = 0 ORDER BY updated_at DESC, id DESC LIMIT ?
        )`,
        params: [keep]
      }
    ])
    return list.length
  })
}

export async function getClipboardPausedState() {
  const db = await getStorage()
  const row = await db.get('SELECT value FROM app_state WHERE key = ?', [PAUSED_KEY])
  return row?.value === '1'
}

export async function setClipboardPausedState(value) {
  const paused = value === true ? '1' : '0'
  return enqueue(async () => {
    const db = await getStorage()
    const now = Date.now()
    await db.run(
      `INSERT INTO app_state (id, key, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [PAUSED_KEY, PAUSED_KEY, paused, now, now]
    )
    return true
  })
}
