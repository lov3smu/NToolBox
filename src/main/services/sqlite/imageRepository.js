import { getStorage } from './index.js'

export const IMAGE_HISTORY_PAGE_SIZE = 40
const MAX_PAGE_SIZE = 200

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

function clampPageSize(value, max = MAX_PAGE_SIZE) {
  const size = Math.floor(Number(value))
  if (!Number.isFinite(size) || size <= 0) return IMAGE_HISTORY_PAGE_SIZE
  return Math.min(size, max)
}

function toRow(record) {
  const uploadedAt = Number(record.uploadedAt) || 0
  const now = Date.now()
  return {
    id: String(record.id || ''),
    name: typeof record.name === 'string' ? record.name : '',
    url: typeof record.url === 'string' ? record.url : '',
    provider: typeof record.provider === 'string' ? record.provider : '',
    provider_name: typeof record.providerName === 'string' ? record.providerName : '',
    size: Number(record.size) || 0,
    uploaded_at: uploadedAt,
    created_at: Number(record.createdAt) || uploadedAt || now,
    updated_at: Number(record.updatedAt) || uploadedAt || now
  }
}

function fromRow(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    provider: row.provider,
    providerName: row.provider_name,
    size: Number(row.size) || 0,
    uploadedAt: Number(row.uploaded_at) || 0
  }
}

function insertStatement(record, ignore = false) {
  const row = toRow(record)
  return {
    type: 'run',
    sql: `INSERT ${ignore ? 'OR IGNORE ' : ''}INTO image_uploads
      (id, name, url, provider, provider_name, size, uploaded_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [
      row.id,
      row.name,
      row.url,
      row.provider,
      row.provider_name,
      row.size,
      row.uploaded_at,
      row.created_at,
      row.updated_at
    ]
  }
}

function pruneStatement(retentionLimit) {
  return {
    type: 'run',
    sql: `DELETE FROM image_uploads WHERE id NOT IN (
      SELECT id FROM image_uploads ORDER BY uploaded_at DESC, id DESC LIMIT ?
    )`,
    params: [Math.max(1, Math.floor(Number(retentionLimit)) || 1)]
  }
}

export async function listImageUploads({ limit, offset } = {}) {
  const db = await getStorage()
  const size = clampPageSize(limit)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const [countRow, rows] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM image_uploads'),
    db.all('SELECT * FROM image_uploads ORDER BY uploaded_at DESC, id DESC LIMIT ? OFFSET ?', [size, start])
  ])
  const total = Number(countRow?.total) || 0
  return { items: rows.map(fromRow), total, hasMore: start + rows.length < total }
}

export async function countImageUploads() {
  const db = await getStorage()
  const row = await db.get('SELECT COUNT(*) AS total FROM image_uploads')
  return Number(row?.total) || 0
}

export async function addImageUploads(records, retentionLimit) {
  const list = Array.isArray(records) ? records.filter((item) => item && item.id) : []
  if (!list.length) return 0
  return enqueue(async () => {
    const db = await getStorage()
    const statements = list.map((record) => insertStatement(record))
    if (retentionLimit) statements.push(pruneStatement(retentionLimit))
    await db.transaction(statements)
    return list.length
  })
}

export async function importImageUploads(records, retentionLimit) {
  const list = Array.isArray(records) ? records.filter((item) => item && item.id && item.url) : []
  if (!list.length) return 0
  return enqueue(async () => {
    const db = await getStorage()
    const statements = list.map((record) => insertStatement(record, true))
    if (retentionLimit) statements.push(pruneStatement(retentionLimit))
    await db.transaction(statements)
    return list.length
  })
}

export async function pruneImageUploads(retentionLimit) {
  if (!retentionLimit) return
  const db = await getStorage()
  await db.run(pruneStatement(retentionLimit).sql, pruneStatement(retentionLimit).params)
}

export async function removeImageUpload(id) {
  const uploadId = String(id || '')
  if (!uploadId) return false
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM image_uploads WHERE id = ?', [uploadId])
    return true
  })
}

export async function clearImageUploads() {
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM image_uploads')
    return true
  })
}
