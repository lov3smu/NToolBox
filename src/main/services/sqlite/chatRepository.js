import { getStorage } from './index.js'

const MESSAGE_PAGE_SIZE = 60
const SUMMARY_PAGE_SIZE = 60
const MAX_MESSAGE_PAGE = 200
const MAX_SUMMARY_PAGE = 200

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

function clampPageSize(value, fallback, max) {
  const size = Math.floor(Number(value))
  if (!Number.isFinite(size) || size <= 0) return fallback
  return Math.min(size, max)
}

function toSessionRow(session) {
  const now = Date.now()
  const meta = {}
  if (session.usage && typeof session.usage === 'object') meta.usage = session.usage
  if (session.contextUsage && typeof session.contextUsage === 'object') meta.contextUsage = session.contextUsage
  if (session.context && typeof session.context === 'object') meta.context = session.context
  if (Array.isArray(session.toolAllowlist)) meta.toolAllowlist = session.toolAllowlist
  return {
    id: String(session.id || ''),
    title: typeof session.title === 'string' ? session.title : '',
    workspace: typeof session.workspace === 'string' ? session.workspace : '',
    provider: typeof session.provider === 'string' ? session.provider : '',
    model: typeof session.model === 'string' ? session.model : '',
    pinned: session.pinned === true ? 1 : 0,
    archived: session.archived === true ? 1 : 0,
    unread: session.unread === true ? 1 : 0,
    forked_from: typeof session.forkedFrom === 'string' ? session.forkedFrom : '',
    created_at: Number(session.createdAt) || now,
    updated_at: Number(session.updatedAt) || now,
    meta_json: JSON.stringify(meta)
  }
}

function fromSessionRow(row) {
  let meta = {}
  try {
    const parsed = JSON.parse(row.meta_json || '{}')
    if (parsed && typeof parsed === 'object') meta = parsed
  } catch {
    meta = {}
  }
  const session = {
    id: row.id,
    title: row.title,
    messages: [],
    workspace: row.workspace || '',
    provider: row.provider || '',
    model: row.model || '',
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0
  }
  if (row.pinned) session.pinned = true
  if (row.archived) session.archived = true
  if (row.unread) session.unread = true
  if (row.forked_from) session.forkedFrom = row.forked_from
  if (meta.usage) session.usage = meta.usage
  if (meta.contextUsage) session.contextUsage = meta.contextUsage
  if (meta.context) session.context = meta.context
  if (Array.isArray(meta.toolAllowlist)) session.toolAllowlist = meta.toolAllowlist
  return session
}

function messageStatements(session) {
  const statements = [{ type: 'run', sql: 'DELETE FROM chat_messages WHERE session_id = ?', params: [session.id] }]
  const messages = Array.isArray(session.messages) ? session.messages : []
  const fallbackTime = Number(session.updatedAt) || Date.now()
  messages.forEach((message, index) => {
    if (!message || typeof message !== 'object') return
    statements.push({
      type: 'run',
      sql: 'INSERT INTO chat_messages (id, session_id, seq, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      params: [
        `${session.id}:${index}`,
        session.id,
        index,
        JSON.stringify(message),
        Number(message.createdAt) || fallbackTime,
        Number(message.updatedAt) || Number(message.createdAt) || fallbackTime
      ]
    })
  })
  return statements
}

function upsertSessionStatement(row) {
  return {
    type: 'run',
    sql: `INSERT INTO chat_sessions
      (id, title, workspace, provider, model, pinned, archived, unread, forked_from, created_at, updated_at, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        workspace = excluded.workspace,
        provider = excluded.provider,
        model = excluded.model,
        pinned = excluded.pinned,
        archived = excluded.archived,
        unread = excluded.unread,
        forked_from = excluded.forked_from,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        meta_json = excluded.meta_json`,
    params: [
      row.id,
      row.title,
      row.workspace,
      row.provider,
      row.model,
      row.pinned,
      row.archived,
      row.unread,
      row.forked_from,
      row.created_at,
      row.updated_at,
      row.meta_json
    ]
  }
}

export async function loadChatSessions() {
  const db = await getStorage()
  const [sessionRows, messageRows] = await Promise.all([
    db.all('SELECT * FROM chat_sessions ORDER BY updated_at DESC, created_at DESC'),
    db.all('SELECT session_id, payload FROM chat_messages ORDER BY session_id ASC, seq ASC')
  ])
  const messagesBySession = new Map()
  for (const row of messageRows) {
    let message
    try {
      message = JSON.parse(row.payload)
    } catch {
      continue
    }
    if (!message || typeof message !== 'object') continue
    const list = messagesBySession.get(row.session_id)
    if (list) list.push(message)
    else messagesBySession.set(row.session_id, [message])
  }
  return sessionRows.map((row) => {
    const session = fromSessionRow(row)
    session.messages = messagesBySession.get(row.id) || []
    return session
  })
}

export async function loadChatSessionSummaries({ limit, offset, keyword, includeArchived = true } = {}) {
  const db = await getStorage()
  const size = clampPageSize(limit, SUMMARY_PAGE_SIZE, MAX_SUMMARY_PAGE)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const search = String(keyword || '')
    .trim()
    .toLowerCase()
  const filters = []
  const params = []
  if (!includeArchived) filters.push('archived = 0')
  if (search) {
    filters.push('(lower(title) LIKE ? OR lower(workspace) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const [countRow, rows] = await Promise.all([
    db.get(`SELECT COUNT(*) AS total FROM chat_sessions ${where}`, params),
    db.all(`SELECT * FROM chat_sessions ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?`, [
      ...params,
      size,
      start
    ])
  ])
  const total = Number(countRow?.total) || 0
  return {
    items: rows.map((row) => {
      const session = fromSessionRow(row)
      delete session.messages
      return session
    }),
    total,
    hasMore: start + rows.length < total
  }
}

export async function saveChatSession(rawSession) {
  if (!rawSession || typeof rawSession !== 'object') return false
  const session = JSON.parse(JSON.stringify(rawSession))
  if (!session.id) return false
  const row = toSessionRow(session)
  return enqueue(async () => {
    const db = await getStorage()
    await db.transaction([upsertSessionStatement(row), ...messageStatements(session)])
    return true
  })
}

export async function importChatSessions(list) {
  if (!Array.isArray(list) || list.length === 0) return 0
  const sessions = list
    .filter((item) => item && typeof item === 'object' && item.id)
    .map((item) => JSON.parse(JSON.stringify(item)))
  if (!sessions.length) return 0
  return enqueue(async () => {
    const db = await getStorage()
    const statements = []
    for (const session of sessions) {
      statements.push(upsertSessionStatement(toSessionRow(session)))
      statements.push(...messageStatements(session))
    }
    await db.transaction(statements)
    return sessions.length
  })
}

export async function deleteChatSession(id) {
  const sessionId = String(id || '')
  if (!sessionId) return false
  return enqueue(async () => {
    const db = await getStorage()
    await db.transaction([
      { type: 'run', sql: 'DELETE FROM chat_messages WHERE session_id = ?', params: [sessionId] },
      { type: 'run', sql: 'DELETE FROM chat_sessions WHERE id = ?', params: [sessionId] }
    ])
    return true
  })
}

export async function loadChatMessagePage({ sessionId, limit, beforeSeq } = {}) {
  const id = String(sessionId || '')
  if (!id) return { items: [], total: 0, hasMore: false, nextBeforeSeq: null }
  const db = await getStorage()
  const size = clampPageSize(limit, MESSAGE_PAGE_SIZE, MAX_MESSAGE_PAGE)
  const before = Number(beforeSeq)
  const hasCursor = Number.isFinite(before)
  const countRow = await db.get('SELECT COUNT(*) AS total FROM chat_messages WHERE session_id = ?', [id])
  const rows = hasCursor
    ? await db.all(
        'SELECT seq, payload FROM chat_messages WHERE session_id = ? AND seq < ? ORDER BY seq DESC LIMIT ?',
        [id, before, size]
      )
    : await db.all('SELECT seq, payload FROM chat_messages WHERE session_id = ? ORDER BY seq DESC LIMIT ?', [id, size])
  const items = []
  for (const row of [...rows].reverse()) {
    try {
      const message = JSON.parse(row.payload)
      if (message && typeof message === 'object') items.push({ seq: row.seq, message })
    } catch {
      // 跳过损坏的消息行
    }
  }
  const total = Number(countRow?.total) || 0
  const oldest = rows.length ? rows[rows.length - 1].seq : null
  return {
    items,
    total,
    hasMore: rows.length === size && oldest !== null && oldest > 0,
    nextBeforeSeq: oldest
  }
}

export async function countChatSessions() {
  const db = await getStorage()
  const row = await db.get('SELECT COUNT(*) AS total FROM chat_sessions')
  return Number(row?.total) || 0
}
