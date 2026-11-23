import { getStorage } from './index.js'

export const DB_HISTORY_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

function clampPageSize(value, fallback = DB_HISTORY_PAGE_SIZE) {
  const size = Math.floor(Number(value))
  if (!Number.isFinite(size) || size <= 0) return fallback
  return Math.min(size, MAX_PAGE_SIZE)
}

function historyRow(entry) {
  const createdAt = Number(entry.createdAt) || Date.now()
  return {
    id: String(entry.id || ''),
    payload: JSON.stringify({
      sql: String(entry.sql || ''),
      connectionName: String(entry.connectionName || ''),
      database: String(entry.database || ''),
      duration: Number(entry.duration) || 0,
      success: entry.success !== false
    }),
    createdAt,
    updatedAt: Number(entry.updatedAt) || createdAt
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

function historyItem(row) {
  const payload = parsePayload(row.payload)
  return {
    id: row.id,
    sql: typeof payload.sql === 'string' ? payload.sql : '',
    connectionName: typeof payload.connectionName === 'string' ? payload.connectionName : '',
    database: typeof payload.database === 'string' ? payload.database : '',
    duration: Number(payload.duration) || 0,
    success: payload.success !== false,
    createdAt: Number(row.created_at) || 0
  }
}

export async function listDbQueryHistory({ limit, offset } = {}) {
  const db = await getStorage()
  const size = clampPageSize(limit)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const [countRow, rows] = await Promise.all([
    db.get('SELECT COUNT(*) AS total FROM db_query_history'),
    db.all('SELECT * FROM db_query_history ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?', [size, start])
  ])
  const total = Number(countRow?.total) || 0
  return { items: rows.map(historyItem), total, hasMore: start + rows.length < total }
}

export async function addDbQueryHistory(entry, retentionLimit) {
  if (!entry || !entry.id || !entry.sql) return false
  const row = historyRow(entry)
  const limit = Math.max(1, Math.floor(Number(retentionLimit)) || 200)
  return enqueue(async () => {
    const db = await getStorage()
    await db.transaction([
      {
        type: 'run',
        sql: `INSERT INTO db_query_history (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at,
            updated_at = excluded.updated_at`,
        params: [row.id, row.payload, row.createdAt, row.updatedAt]
      },
      {
        type: 'run',
        sql: `DELETE FROM db_query_history WHERE id NOT IN (
          SELECT id FROM db_query_history ORDER BY created_at DESC, id DESC LIMIT ?
        )`,
        params: [limit]
      }
    ])
    return true
  })
}

export async function importDbQueryHistory(records, retentionLimit) {
  const list = Array.isArray(records) ? records.filter((item) => item && item.id && item.sql) : []
  if (!list.length) return 0
  const limit = Math.max(1, Math.floor(Number(retentionLimit)) || 200)
  return enqueue(async () => {
    const db = await getStorage()
    const statements = list.map((entry) => {
      const row = historyRow(entry)
      return {
        type: 'run',
        sql: 'INSERT OR IGNORE INTO db_query_history (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)',
        params: [row.id, row.payload, row.createdAt, row.updatedAt]
      }
    })
    statements.push({
      type: 'run',
      sql: `DELETE FROM db_query_history WHERE id NOT IN (
        SELECT id FROM db_query_history ORDER BY created_at DESC, id DESC LIMIT ?
      )`,
      params: [limit]
    })
    await db.transaction(statements)
    return list.length
  })
}

export async function pruneDbQueryHistory(retentionLimit) {
  const limit = Math.max(1, Math.floor(Number(retentionLimit)) || 200)
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(
      `DELETE FROM db_query_history WHERE id NOT IN (
        SELECT id FROM db_query_history ORDER BY created_at DESC, id DESC LIMIT ?
      )`,
      [limit]
    )
    return true
  })
}

export async function removeDbQueryHistory(id) {
  const historyId = String(id || '')
  if (!historyId) return false
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM db_query_history WHERE id = ?', [historyId])
    return true
  })
}

export async function clearDbQueryHistory() {
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM db_query_history')
    return true
  })
}

function snippetPayload(entry) {
  return JSON.stringify({
    name: String(entry.name || ''),
    sql: String(entry.sql || ''),
    folder: String(entry.folder || '')
  })
}

function snippetItem(row) {
  const payload = parsePayload(row.payload)
  return {
    id: row.id,
    name: typeof payload.name === 'string' ? payload.name : '',
    sql: typeof payload.sql === 'string' ? payload.sql : '',
    folder: typeof payload.folder === 'string' ? payload.folder : '',
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0
  }
}

export async function listDbSnippets() {
  const db = await getStorage()
  const rows = await db.all('SELECT * FROM db_sql_snippets ORDER BY created_at DESC, id DESC')
  return rows.map(snippetItem)
}

export async function saveDbSnippet(entry) {
  if (!entry || !entry.id || !entry.sql) return false
  const now = Date.now()
  const createdAt = Number(entry.createdAt) || now
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(
      `INSERT INTO db_sql_snippets (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      [String(entry.id), snippetPayload(entry), createdAt, now]
    )
    return true
  })
}

export async function importDbSnippets(records) {
  const list = Array.isArray(records) ? records.filter((item) => item && item.id && item.sql) : []
  if (!list.length) return 0
  return enqueue(async () => {
    const db = await getStorage()
    const statements = list.map((entry) => {
      const createdAt = Number(entry.createdAt) || Date.now()
      return {
        type: 'run',
        sql: 'INSERT OR IGNORE INTO db_sql_snippets (id, payload, created_at, updated_at) VALUES (?, ?, ?, ?)',
        params: [String(entry.id), snippetPayload(entry), createdAt, createdAt]
      }
    })
    await db.transaction(statements)
    return list.length
  })
}

export async function removeDbSnippet(id) {
  const snippetId = String(id || '')
  if (!snippetId) return false
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('DELETE FROM db_sql_snippets WHERE id = ?', [snippetId])
    return true
  })
}

export async function listDbSnippetFolders() {
  const db = await getStorage()
  const rows = await db.all('SELECT name FROM db_sql_folders ORDER BY created_at ASC, name ASC')
  return rows.map((row) => row.name).filter(Boolean)
}

export async function addDbSnippetFolder(name) {
  const folder = String(name || '').trim()
  if (!folder) return false
  const now = Date.now()
  return enqueue(async () => {
    const db = await getStorage()
    await db.run('INSERT OR IGNORE INTO db_sql_folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [
      folder,
      folder,
      now,
      now
    ])
    return true
  })
}

export async function importDbSnippetFolders(folders) {
  const list = Array.isArray(folders) ? folders.map((item) => String(item || '').trim()).filter(Boolean) : []
  if (!list.length) return 0
  return enqueue(async () => {
    const db = await getStorage()
    const now = Date.now()
    await db.transaction(
      list.map((folder, index) => ({
        type: 'run',
        sql: 'INSERT OR IGNORE INTO db_sql_folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        params: [folder, folder, now + index, now + index]
      }))
    )
    return list.length
  })
}

function memoryRow(scope, workspace, entry) {
  return {
    scope: String(scope),
    workspace: String(workspace || ''),
    id: String(entry.id || ''),
    title: String(entry.title || entry.content || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120),
    category: String(entry.category || ''),
    content: String(entry.content || ''),
    createdAt: Number(entry.createdAt) || 0,
    updatedAt: Number(entry.updatedAt) || Number(entry.createdAt) || 0
  }
}

export async function replaceMemoryEntries(scope, workspace, entries) {
  if (scope !== 'global' && scope !== 'project') return false
  const key = scope === 'project' ? String(workspace || '') : ''
  const list = Array.isArray(entries) ? entries.filter((entry) => entry && entry.id) : []
  return enqueue(async () => {
    const db = await getStorage()
    const statements = [
      {
        type: 'run',
        sql: 'DELETE FROM memory_entries WHERE scope = ? AND workspace = ?',
        params: [scope, key]
      },
      ...list.map((entry) => {
        const row = memoryRow(scope, key, entry)
        return {
          type: 'run',
          sql: `INSERT INTO memory_entries
            (scope, workspace, id, title, category, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          params: [row.scope, row.workspace, row.id, row.title, row.category, row.content, row.createdAt, row.updatedAt]
        }
      })
    ]
    await db.transaction(statements)
    return list.length
  })
}

export async function listMemoryEntries({ scope, workspace, limit, offset } = {}) {
  const db = await getStorage()
  const size = clampPageSize(limit, 50)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const filters = []
  const params = []
  if (scope === 'global' || scope === 'project') {
    filters.push('scope = ?')
    params.push(scope)
  }
  if (scope === 'project') {
    filters.push('workspace = ?')
    params.push(String(workspace || ''))
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const [countRow, rows] = await Promise.all([
    db.get(`SELECT COUNT(*) AS total FROM memory_entries ${where}`, params),
    db.all(`SELECT * FROM memory_entries ${where} ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?`, [
      ...params,
      size,
      start
    ])
  ])
  const total = Number(countRow?.total) || 0
  return {
    items: rows.map((row) => ({
      id: row.id,
      scope: row.scope,
      workspace: row.workspace,
      title: row.title,
      category: row.category,
      content: row.content,
      createdAt: Number(row.created_at) || 0,
      updatedAt: Number(row.updated_at) || 0
    })),
    total,
    hasMore: start + rows.length < total
  }
}
