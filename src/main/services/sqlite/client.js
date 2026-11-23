import { Worker } from 'node:worker_threads'
import { DatabaseSync } from 'node:sqlite'
import { log } from '../../utils/index.js'
import { MIGRATIONS } from './schema.js'
import { SQLITE_WORKER_SOURCE } from './workerSource.js'

const OPEN_TIMEOUT = 20 * 1000
const REQUEST_TIMEOUT = 30 * 1000

function trimDbError(error) {
  return String(error?.message || error || 'SQLite 操作失败')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

function executeInline(db, statement) {
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

function applyPragmas(db) {
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec('PRAGMA foreign_keys = ON')
}

// 优先使用 worker_threads 执行 SQL，避免大结果集阻塞主进程；worker 不可用时退回主进程内执行
export class SqliteClient {
  constructor(filePath) {
    this.filePath = filePath
    this.worker = null
    this.inline = null
    this.mode = ''
    this.nextId = 1
    this.pending = new Map()
    this.opened = false
    this.opening = null
    this.closed = false
  }

  async open() {
    if (this.opened) return
    if (this.opening) return this.opening
    this.opening = this._openInternal().finally(() => {
      this.opening = null
    })
    return this.opening
  }

  async _openInternal() {
    try {
      const worker = new Worker(SQLITE_WORKER_SOURCE, { eval: true })
      this.worker = worker
      worker.on('message', (message) => this._handleMessage(message))
      worker.on('error', (error) => this._handleFatal(error))
      worker.on('exit', (code) => {
        if (this.worker === worker) this._handleFatal(new Error(`SQLite worker 已退出（code=${code}）`))
      })
      await this._send({ op: 'open', path: this.filePath }, OPEN_TIMEOUT)
      this.mode = 'worker'
    } catch (error) {
      log.warn(`SQLite worker 启动失败，回退到主进程内执行：${trimDbError(error)}`)
      this._resetWorker()
      this.inline = new DatabaseSync(this.filePath)
      applyPragmas(this.inline)
      this.mode = 'inline'
    }
    await this._migrate()
    this.opened = true
  }

  _resetWorker() {
    const worker = this.worker
    this.worker = null
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(new Error('SQLite worker 不可用'))
    }
    this.pending.clear()
    try {
      worker?.terminate()
    } catch {
      // worker 已退出
    }
  }

  _handleFatal(error) {
    if (this.closed) return
    log.warn(`SQLite worker 异常：${trimDbError(error)}`)
    this._resetWorker()
  }

  _handleMessage(message) {
    const entry = this.pending.get(message.id)
    if (!entry) return
    this.pending.delete(message.id)
    clearTimeout(entry.timer)
    if (message.error) entry.reject(new Error(message.error))
    else entry.resolve(message.response)
  }

  _send(op, timeout = REQUEST_TIMEOUT) {
    if (!this.worker) return Promise.reject(new Error('SQLite worker 未连接'))
    const id = this.nextId
    this.nextId += 1
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`SQLite 操作超时：${op.op}`))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      this.worker.postMessage({ ...op, id })
    })
  }

  async _request(statement, ensureOpen = true) {
    if (ensureOpen) await this.open()
    if (this.mode === 'inline') return executeInline(this.inline, statement)
    const response = await this._send({ op: statement.type, sql: statement.sql, params: statement.params })
    return response?.result || { type: statement.type }
  }

  async all(sql, params = []) {
    return (await this._request({ type: 'all', sql, params })).rows || []
  }

  async get(sql, params = []) {
    return (await this._request({ type: 'get', sql, params })).row || null
  }

  async run(sql, params = []) {
    return await this._request({ type: 'run', sql, params })
  }

  async exec(sql) {
    await this._request({ type: 'exec', sql })
  }

  async transaction(statements) {
    await this.open()
    if (!statements?.length) return []
    if (this.mode === 'inline') {
      this.inline.exec('BEGIN IMMEDIATE')
      try {
        const results = statements.map((statement) => executeInline(this.inline, statement))
        this.inline.exec('COMMIT')
        return results
      } catch (error) {
        try {
          this.inline.exec('ROLLBACK')
        } catch {
          // 事务已由 SQLite 自动回滚
        }
        throw error
      }
    }
    const response = await this._send({ op: 'transaction', statements }, REQUEST_TIMEOUT)
    return response?.results || []
  }

  async _migrate() {
    const row = await this._request({ type: 'get', sql: 'PRAGMA user_version', params: [] }, false)
    const current = Number(row?.row?.user_version) || 0
    for (let index = current; index < MIGRATIONS.length; index += 1) {
      const sql = MIGRATIONS[index]
      if (!sql) continue
      await this._request({ type: 'exec', sql: `${sql}\nPRAGMA user_version = ${index + 1};`, params: [] }, false)
    }
  }

  async close() {
    if (this.closed) return
    this.closed = true
    if (this.worker) {
      try {
        await this._send({ op: 'close' }, 2000)
      } catch {
        // worker 已失效，直接终止
      }
      this._resetWorker()
      this.worker = null
    }
    if (this.inline) {
      try {
        this.inline.close()
      } catch {
        // 已关闭
      }
      this.inline = null
    }
    this.opened = false
  }
}
