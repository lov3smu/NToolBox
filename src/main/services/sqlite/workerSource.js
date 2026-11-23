// 以字符串形式注入 worker：electron-vite 会把主进程打包成单文件，独立 worker 文件无法随包分发
export const SQLITE_WORKER_SOURCE = String.raw`
import { parentPort } from 'node:worker_threads'
import { DatabaseSync } from 'node:sqlite'

let db = null

function execute(statement) {
  const type = statement.type || 'run'
  const params = Array.isArray(statement.params) ? statement.params : []
  if (type === 'exec') {
    db.exec(statement.sql)
    return { type }
  }
  const prepared = db.prepare(statement.sql)
  if (type === 'all') return { type, rows: prepared.all(...params) }
  if (type === 'get') return { type, row: prepared.get(...params) ?? null }
  const result = prepared.run(...params)
  return {
    type,
    changes: Number(result.changes) || 0,
    lastInsertRowid: Number(result.lastInsertRowid) || 0
  }
}

function handle(message) {
  switch (message.op) {
    case 'open':
      db = new DatabaseSync(message.path)
      db.exec('PRAGMA journal_mode = WAL')
      db.exec('PRAGMA synchronous = NORMAL')
      db.exec('PRAGMA busy_timeout = 5000')
      db.exec('PRAGMA foreign_keys = ON')
      return { ok: true }
    case 'exec':
    case 'all':
    case 'get':
    case 'run':
      return { ok: true, result: execute({ type: message.op, sql: message.sql, params: message.params }) }
    case 'transaction': {
      db.exec('BEGIN IMMEDIATE')
      try {
        const results = []
        for (const statement of message.statements || []) results.push(execute(statement))
        db.exec('COMMIT')
        return { ok: true, results }
      } catch (error) {
        try {
          db.exec('ROLLBACK')
        } catch {
          // 事务已由 SQLite 自动回滚
        }
        throw error
      }
    }
    case 'close':
      if (db) db.close()
      db = null
      return { ok: true }
    default:
      throw new Error('Unknown sqlite op: ' + message.op)
  }
}

parentPort.on('message', (message) => {
  try {
    parentPort.postMessage({ id: message.id, response: handle(message) })
  } catch (error) {
    parentPort.postMessage({ id: message.id, error: String((error && error.message) || error) })
  }
})
`
