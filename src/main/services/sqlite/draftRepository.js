import { getStorage } from './index.js'

const DRAFT_KINDS = ['markdown', 'wechat', 'wechat-draft', 'json', 'yaml', 'html']
const MAX_PAGE_SIZE = 200

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

export function isDraftKind(kind) {
  return DRAFT_KINDS.includes(kind)
}

function clampLimit(value, fallback = 50) {
  const size = Math.floor(Number(value))
  if (!Number.isFinite(size) || size <= 0) return fallback
  return Math.min(size, MAX_PAGE_SIZE)
}

function rowToDraft(row) {
  return {
    id: row.id,
    title: row.title || '',
    content: row.content || '',
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0
  }
}

export async function listDrafts(kind, { limit, offset } = {}) {
  if (!isDraftKind(kind)) return { items: [], total: 0, hasMore: false }
  const db = await getStorage()
  const size = clampLimit(limit)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const [countRow, rows] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM drafts WHERE kind = ?', [kind]),
    db.all('SELECT * FROM drafts WHERE kind = ? ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?', [
      kind,
      size,
      start
    ])
  ])
  const total = Number(countRow?.total) || 0
  return { items: rows.map(rowToDraft), total, hasMore: start + rows.length < total }
}

export async function saveDraft(kind, draft) {
  if (!isDraftKind(kind) || !draft || !draft.id) return false
  const id = String(draft.id)
  const now = Date.now()
  const createdAt = Number(draft.createdAt) || now
  const updatedAt = Number(draft.updatedAt) || now
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(
      `INSERT INTO drafts (kind, id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(kind, id) DO UPDATE SET title = excluded.title, content = excluded.content,
          updated_at = excluded.updated_at`,
      [kind, id, String(draft.title || '').slice(0, 120), String(draft.content || ''), createdAt, updatedAt]
    )
    return true
  })
}

export async function removeDraft(kind, id) {
  if (!isDraftKind(kind) || !id) return false
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM drafts WHERE kind = ? AND id = ?', [kind, String(id)])
    return true
  })
}

export async function importDrafts(kind, drafts, retentionLimit) {
  if (!isDraftKind(kind) || !Array.isArray(drafts) || !drafts.length) return 0
  const limit = Math.max(1, Math.floor(Number(retentionLimit)) || 30)
  const list = drafts.filter((draft) => draft && draft.id)
  return enqueue(async () => {
    const db = await getStorage()
    const statements = list.map((draft) => {
      const now = Date.now()
      const createdAt = Number(draft.createdAt) || now
      const updatedAt = Number(draft.updatedAt) || createdAt
      return {
        type: 'run',
        sql: 'INSERT OR IGNORE INTO drafts (kind, id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        params: [
          kind,
          String(draft.id),
          String(draft.title || '').slice(0, 120),
          String(draft.content || ''),
          createdAt,
          updatedAt
        ]
      }
    })
    statements.push({
      type: 'run',
      sql: `DELETE FROM drafts WHERE kind = ? AND id NOT IN (
        SELECT id FROM drafts WHERE kind = ? ORDER BY updated_at DESC, id DESC LIMIT ?
      )`,
      params: [kind, kind, limit]
    })
    await db.transaction(statements)
    return list.length
  })
}

export async function clearDrafts(kind) {
  if (!isDraftKind(kind)) return false
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM drafts WHERE kind = ?', [kind])
    return true
  })
}
