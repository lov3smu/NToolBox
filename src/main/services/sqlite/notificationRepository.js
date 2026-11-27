import { getStorage } from './index.js'

const MAX_PAGE_SIZE = 100
const RETENTION_COUNT = 200

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

function clampLimit(value, fallback = 30) {
  const size = Math.floor(Number(value))
  if (!Number.isFinite(size) || size <= 0) return fallback
  return Math.min(size, MAX_PAGE_SIZE)
}

function makeId() {
  return `ntf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function rowToNotification(row) {
  return {
    id: row.id,
    kind: row.kind || '',
    level: row.level || 'info',
    title: row.title || '',
    body: row.body || '',
    read: Number(row.read) === 1,
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0
  }
}

export async function addNotification(entry) {
  if (!entry || typeof entry !== 'object') return null
  const now = Date.now()
  const id = String(entry.id || makeId())
  const record = {
    id,
    kind: String(entry.kind || '').slice(0, 60),
    level: String(entry.level || 'info'),
    title: String(entry.title || '').slice(0, 200),
    body: String(entry.body || '').slice(0, 2000),
    read: entry.read === true ? 1 : 0,
    created_at: Number(entry.createdAt) || now,
    updated_at: now
  }
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(
      `INSERT INTO notifications (id, kind, level, title, body, read, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.kind,
        record.level,
        record.title,
        record.body,
        record.read,
        record.created_at,
        record.updated_at
      ]
    )
    await db.run(
      `DELETE FROM notifications WHERE id NOT IN (
        SELECT id FROM notifications ORDER BY created_at DESC, id DESC LIMIT ?
      )`,
      [RETENTION_COUNT]
    )
    return rowToNotification(record)
  })
}

export async function listNotifications({ limit, offset } = {}) {
  const db = await getStorage()
  const size = clampLimit(limit)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const [countRow, unreadRow, rows] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM notifications', []),
    db.get('SELECT COUNT(*) AS unread FROM notifications WHERE read = 0', []),
    db.all('SELECT * FROM notifications ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?', [size, start])
  ])
  const total = Number(countRow?.total) || 0
  return {
    items: rows.map(rowToNotification),
    total,
    unread: Number(unreadRow?.unread) || 0,
    hasMore: start + rows.length < total
  }
}

export async function unreadNotificationCount() {
  const db = await getStorage()
  const row = await db.get('SELECT COUNT(*) AS unread FROM notifications WHERE read = 0', [])
  return Number(row?.unread) || 0
}

export async function markNotificationsRead(ids) {
  return enqueue(async () => {
    const db = await getStorage()
    const now = Date.now()
    if (Array.isArray(ids) && ids.length > 0) {
      const list = ids.map((id) => String(id)).filter(Boolean)
      if (!list.length) return false
      const placeholders = list.map(() => '?').join(', ')
      await db.run(`UPDATE notifications SET read = 1, updated_at = ? WHERE id IN (${placeholders})`, [now, ...list])
      return true
    }
    await db.run('UPDATE notifications SET read = 1, updated_at = ? WHERE read = 0', [now])
    return true
  })
}

export async function clearNotifications() {
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM notifications', [])
    return true
  })
}
