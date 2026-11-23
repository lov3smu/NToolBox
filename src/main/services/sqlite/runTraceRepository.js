import { getStorage } from './index.js'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 200

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

function clampLimit(value) {
  const size = Math.floor(Number(value))
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_LIMIT
  return Math.min(size, MAX_LIMIT)
}

function upsertStatement(row) {
  const now = Date.now()
  const startedAt = Number(row.startedAt) || now
  const endedAt = Number.isFinite(Number(row.endedAt)) ? Number(row.endedAt) : null
  return {
    type: 'run',
    sql: `INSERT INTO run_traces
      (id, started_at, ended_at, duration_ms, status, termination, goal, workspace, conversation_id,
        provider, model, tool_calls, error, file_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        duration_ms = excluded.duration_ms,
        status = excluded.status,
        termination = excluded.termination,
        goal = excluded.goal,
        workspace = excluded.workspace,
        conversation_id = excluded.conversation_id,
        provider = excluded.provider,
        model = excluded.model,
        tool_calls = excluded.tool_calls,
        error = excluded.error,
        file_path = excluded.file_path,
        updated_at = excluded.updated_at`,
    params: [
      String(row.id || ''),
      startedAt,
      endedAt,
      Number(row.durationMs) || 0,
      String(row.status || ''),
      String(row.termination || ''),
      String(row.goal || ''),
      String(row.workspace || ''),
      String(row.conversationId || ''),
      String(row.provider || ''),
      String(row.model || ''),
      Number(row.toolCalls) || 0,
      String(row.error || ''),
      String(row.filePath || ''),
      startedAt,
      endedAt || startedAt
    ]
  }
}

function fromRow(row) {
  return {
    id: row.id,
    startedAt: Number(row.started_at) || 0,
    endedAt: Number(row.ended_at) || null,
    durationMs: Number(row.duration_ms) || 0,
    status: row.status,
    termination: row.termination,
    goal: row.goal,
    workspace: row.workspace,
    conversationId: row.conversation_id,
    provider: row.provider,
    model: row.model,
    toolCalls: Number(row.tool_calls) || 0,
    error: row.error,
    filePath: row.file_path
  }
}

const STATUS_GROUPS = {
  done: ['goal_reached'],
  stopped: ['cancelled'],
  error: ['error', 'timeout', 'max_steps']
}

export async function upsertRunTrace(row) {
  if (!row || !row.id) return false
  const statement = upsertStatement(row)
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(statement.sql, statement.params)
    return true
  })
}

export async function upsertRunTraces(rows) {
  const list = Array.isArray(rows) ? rows.filter((row) => row && row.id) : []
  if (!list.length) return 0
  return enqueue(async () => {
    const db = await getStorage()
    await db.transaction(list.map((row) => upsertStatement(row)))
    return list.length
  })
}

export async function listRunTraces({ limit, offset, keyword, status, conversationId, since } = {}) {
  const db = await getStorage()
  const size = clampLimit(limit)
  const start = Math.max(0, Math.floor(Number(offset)) || 0)
  const filters = []
  const params = []
  const search = String(keyword || '')
    .trim()
    .toLowerCase()
  if (search) {
    filters.push('(lower(goal) LIKE ? OR lower(workspace) LIKE ? OR lower(model) LIKE ? OR lower(termination) LIKE ?)')
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
  }
  const group = STATUS_GROUPS[status]
  if (group) {
    filters.push(`COALESCE(NULLIF(termination, ''), status) IN (${group.map(() => '?').join(', ')})`)
    params.push(...group)
  }
  if (conversationId) {
    filters.push('conversation_id = ?')
    params.push(String(conversationId))
  }
  if (Number.isFinite(Number(since))) {
    filters.push('started_at >= ?')
    params.push(Number(since))
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const [countRow, rows] = await Promise.all([
    db.get(`SELECT COUNT(*) AS total FROM run_traces ${where}`, params),
    db.all(`SELECT * FROM run_traces ${where} ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?`, [
      ...params,
      size,
      start
    ])
  ])
  const total = Number(countRow?.total) || 0
  return { items: rows.map(fromRow), total, hasMore: start + rows.length < total }
}

export async function runTraceStats({ since } = {}) {
  const db = await getStorage()
  const filters = []
  const params = []
  if (Number.isFinite(Number(since))) {
    filters.push('started_at >= ?')
    params.push(Number(since))
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : ''
  const [countRow, rows] = await Promise.all([
    db.get(`SELECT COUNT(*) AS total FROM run_traces ${where}`, params),
    db.all(`SELECT workspace, COUNT(*) AS count FROM run_traces ${where} GROUP BY workspace`, params)
  ])
  const byWorkspace = {}
  for (const row of rows) {
    if (!row.workspace) continue
    byWorkspace[row.workspace] = Number(row.count) || 0
  }
  return { total: Number(countRow?.total) || 0, byWorkspace }
}

export async function pruneRunTraces(cutoff) {
  const value = Number(cutoff)
  if (!Number.isFinite(value)) return 0
  return enqueue(async () => {
    const db = await getStorage()
    const result = await db.run('DELETE FROM run_traces WHERE started_at < ?', [value])
    return Number(result?.changes) || 0
  })
}

export async function getRunTraceRow(id) {
  const traceId = String(id || '')
  if (!traceId) return null
  const db = await getStorage()
  const row = await db.get('SELECT * FROM run_traces WHERE id = ?', [traceId])
  return row ? fromRow(row) : null
}
