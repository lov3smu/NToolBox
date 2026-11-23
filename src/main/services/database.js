import fs from 'fs'
import mysql from 'mysql2/promise'
import { log } from '../utils'
import { t } from './i18n.js'
import { createSshTunnel } from './sshTunnel'
import { recordDbOperation } from './dbAuditLog'

const connections = new Map()
const transactions = new Map()
const runningQueries = new Map()

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 1000000
const EXPORT_BATCH_SIZE = 2000
const DEFAULT_EXPORT_ROWS = 100000
const TABLE_PAGE_SIZE_LIMIT = 500
const APPROXIMATE_ROW_THRESHOLD = 200000
const TABLE_COUNT_CACHE_TTL = 15000
const tableCountCache = new Map()
const LAZY_BINARY_TYPE_PATTERN =
  /^(tiny|medium|long)?blob$|^binary$|^varbinary$|^(multi)?(point|polygon|linestring)$|^geometry(collection)?$/i

const FILTER_OPERATORS = [
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'LIKE',
  'NOT LIKE',
  'IN',
  'NOT IN',
  'IS NULL',
  'IS NOT NULL',
  'BETWEEN'
]

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``
}

function quoteTable(database, tableName) {
  return database ? `${quoteIdentifier(database)}.${quoteIdentifier(tableName)}` : quoteIdentifier(tableName)
}

function getEntry(name) {
  const entry = connections.get(name)
  if (!entry) {
    throw new Error(t('连接不存在，请先创建连接'))
  }
  return entry
}

const READONLY_BLOCK_MESSAGE = t('只读连接不允许执行写操作，请在连接设置中关闭只读模式')
const WRITE_STATEMENT_PATTERN =
  /^\s*(insert|update|delete|replace|create|alter|drop|truncate|rename|grant|revoke|load\s+(?:data|xml)|lock\s+tables?|unlock\s+tables?|optimize|repair|analyze|flush|kill|call)\b/i

function stripSqlLeadingComments(sql) {
  return String(sql || '').replace(/^(?:\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\s)+/g, '')
}

function sqlVerb(sql) {
  const match = /^([a-zA-Z]+)/.exec(stripSqlLeadingComments(String(sql || '').trim()))
  return match ? match[1].toUpperCase() : 'SQL'
}

function hasWriteStatement(sql) {
  return String(sql || '')
    .split(';')
    .some((statement) => WRITE_STATEMENT_PATTERN.test(stripSqlLeadingComments(statement)))
}

function auditWrite(name, database, action, sql, result, { duration = 0, rows = 0, table = '', source = '' } = {}) {
  recordDbOperation({
    connection: name,
    database: database || '',
    table,
    action,
    sql,
    success: result?.success !== false,
    duration,
    rows,
    source,
    error: result?.error || '',
    readonlyBlocked: result?.readonlyBlocked === true || String(result?.error || '').includes(READONLY_BLOCK_MESSAGE)
  })
}

function auditSqlResult(name, database, sql, result, duration, source) {
  if (hasWriteStatement(sql)) {
    auditWrite(name, database, sqlVerb(sql), sql, result, {
      duration,
      rows: result?.affectedRows ?? result?.rowCount ?? 0,
      source
    })
  }
  return result
}

function readOnlyBlock(entry, sql, { multiple = false } = {}) {
  if (!entry?.config?.readOnly) return null
  const statements = multiple ? String(sql || '').split(';') : [sql]
  for (const statement of statements) {
    if (WRITE_STATEMENT_PATTERN.test(stripSqlLeadingComments(statement))) {
      return READONLY_BLOCK_MESSAGE
    }
  }
  return null
}

function buildSslOptions(config) {
  if (!config.ssl?.enabled) return null
  const options = { rejectUnauthorized: config.ssl.verify !== false }
  const caPath = String(config.ssl.caPath || '').trim()
  if (caPath) {
    try {
      options.ca = fs.readFileSync(caPath)
    } catch (error) {
      throw new Error(t('读取 SSL CA 证书失败: {p0}', { p0: error.message }), { cause: error })
    }
  }
  return options
}

function buildPoolConfig(config) {
  const poolConfig = {
    host: config.host || 'localhost',
    port: Number(config.port) || 3306,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: Number(config.connectionLimit) || 10,
    queueLimit: 0,
    supportBigNumbers: true,
    dateStrings: true
  }

  if (config.charset) {
    poolConfig.charset = config.charset
  }

  if (config.connectTimeout) {
    poolConfig.connectTimeout = Number(config.connectTimeout) * 1000
  }

  const ssl = buildSslOptions(config)
  if (ssl) {
    poolConfig.ssl = ssl
  }

  return poolConfig
}

function toQueryTimeout(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(3600, Math.floor(value)) * 1000
}

function runQuery(conn, sql, params = [], timeoutSeconds) {
  const timeout = toQueryTimeout(timeoutSeconds)
  return timeout ? conn.query({ sql, timeout }, params) : conn.query(sql, params)
}

function normalizeFields(fields = []) {
  return fields.map((field) => ({
    name: field.name,
    columnType: field.columnType ?? 0
  }))
}

function addLimitToQuery(sql, limit) {
  const trimmed = sql.trim().replace(/;\s*$/, '')
  if (!/^\s*SELECT\b/i.test(trimmed) || /\bLIMIT\b/i.test(trimmed)) {
    return trimmed
  }
  return `${trimmed} LIMIT ${limit}`
}

function normalizeResult(rows, fields, duration) {
  if (Array.isArray(rows)) {
    return {
      success: true,
      rows,
      fields: normalizeFields(fields),
      duration,
      rowCount: rows.length,
      isSelect: true
    }
  }

  return {
    success: true,
    rows: [],
    fields: [],
    duration,
    rowCount: rows?.affectedRows ?? 0,
    affectedRows: rows?.affectedRows ?? 0,
    changedRows: rows?.changedRows ?? 0,
    insertId: rows?.insertId ?? 0,
    isSelect: false,
    info: rows?.info || ''
  }
}

function toErrorResult(error, fallbackMessage) {
  return {
    success: false,
    error: error.message || fallbackMessage,
    code: error.code,
    sql: error.sql
  }
}

function assertColumnName(value, label = t('字段')) {
  if (!value || typeof value !== 'string') {
    throw new Error(t('{p0}不能为空', { p0: label }))
  }
  return value
}

function escapeLikePattern(value) {
  return String(value).replace(/([\\%_])/g, '\\$1')
}

function parseGrantee(grantee) {
  const match = /^'(.*)'@'(.*)'$/.exec(String(grantee || ''))
  if (match) return { user: match[1], host: match[2] }
  return { user: String(grantee || ''), host: '' }
}

async function loadColumns(conn, database, tableName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType,
            IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra,
            COLUMN_KEY AS columnKey, COLUMN_COMMENT AS comment, ORDINAL_POSITION AS position
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    [database, tableName]
  )
  return rows.map((row) => ({
    name: row.name,
    dataType: row.dataType,
    columnType: row.columnType,
    nullable: row.nullable === 'YES',
    defaultValue: row.defaultValue,
    extra: row.extra || '',
    columnKey: row.columnKey || '',
    comment: row.comment || '',
    position: row.position,
    autoIncrement: /auto_increment/i.test(row.extra || '')
  }))
}

async function loadPrimaryKeys(conn, database, tableName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [database, tableName]
  )
  return rows.map((row) => row.name)
}

function buildFilterClause(filter, columnNames) {
  const field = assertColumnName(filter?.field, t('筛选字段'))
  if (!columnNames.has(field)) {
    throw new Error(t('无效的筛选字段: {p0}', { p0: field }))
  }

  const operator = String(filter.operator || '=').toUpperCase()
  if (!FILTER_OPERATORS.includes(operator)) {
    throw new Error(t('不支持的筛选运算符: {p0}', { p0: filter.operator }))
  }

  const column = quoteIdentifier(field)
  const value = filter.value === undefined ? null : filter.value

  if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
    return { sql: `${column} ${operator}`, params: [] }
  }

  if (operator === 'IN' || operator === 'NOT IN') {
    const values = Array.isArray(value)
      ? value
      : String(value ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item !== '')
    if (!values.length) {
      throw new Error(t('筛选字段 {p0} 的取值不能为空', { p0: field }))
    }
    return {
      sql: `${column} ${operator} (${values.map(() => '?').join(', ')})`,
      params: values
    }
  }

  if (operator === 'BETWEEN') {
    const values = Array.isArray(value) ? value : [value?.start, value?.end]
    return {
      sql: `${column} BETWEEN ? AND ?`,
      params: [values[0] ?? null, values[1] ?? null]
    }
  }

  if (operator === 'LIKE' || operator === 'NOT LIKE') {
    return { sql: `CAST(${column} AS CHAR) ${operator} ?`, params: [value ?? ''] }
  }

  return { sql: `${column} ${operator} ?`, params: [value] }
}

export function buildWhereClause(columns, options = {}) {
  const columnNames = new Set(columns.map((column) => column.name))
  const params = []
  let expression = ''

  for (const filter of options.filters || []) {
    const clause = buildFilterClause(filter, columnNames)
    params.push(...clause.params)
    if (!expression) {
      expression = clause.sql
      continue
    }
    const connector = String(filter.connector || options.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND'
    expression = `(${expression} ${connector} ${clause.sql})`
  }

  const keyword = typeof options.search === 'string' ? options.search.trim() : ''
  if (keyword) {
    const searchColumns = Array.isArray(options.searchColumns)
      ? options.searchColumns.filter((name) => columnNames.has(name))
      : columns.map((column) => column.name)
    const effectiveColumns = searchColumns.length > 0 ? searchColumns : columns.map((column) => column.name)
    const pattern = `%${escapeLikePattern(keyword)}%`
    const searchParts = effectiveColumns.map((name) => `CAST(${quoteIdentifier(name)} AS CHAR) LIKE ?`)
    const searchSql = `(${searchParts.join(' OR ')})`
    params.push(...effectiveColumns.map(() => pattern))
    expression = expression ? `(${expression} AND ${searchSql})` : searchSql
  }

  return {
    whereSql: expression ? ` WHERE ${expression}` : '',
    params
  }
}

function buildOrderBy(columns, sort) {
  const columnNames = new Set(columns.map((column) => column.name))
  const entries = Array.isArray(sort) ? sort : sort ? [sort] : []
  const parts = []

  for (const item of entries) {
    const field = item?.field || item?.column
    if (!field || !columnNames.has(field)) continue
    const order = String(item.order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    parts.push(`${quoteIdentifier(field)} ${order}`)
  }

  return parts.length ? ` ORDER BY ${parts.join(', ')}` : ''
}

export async function testConnection(config) {
  let connection = null
  let tunnel = null
  try {
    let host = config.host || 'localhost'
    let port = Number(config.port) || 3306

    if (config.ssh?.enabled) {
      tunnel = await createSshTunnel(`__test__:${Date.now()}`, config)
      host = '127.0.0.1'
      port = tunnel.localPort
    }

    const connConfig = {
      host,
      port,
      user: config.user,
      password: config.password,
      dateStrings: true,
      connectTimeout: config.connectTimeout ? Number(config.connectTimeout) * 1000 : 10000
    }

    if (config.charset) {
      connConfig.charset = config.charset
    }

    const ssl = buildSslOptions(config)
    if (ssl) {
      connConfig.ssl = ssl
    }

    connection = await mysql.createConnection(connConfig)
    await connection.ping()

    return { success: true, message: t('连接成功') }
  } catch (error) {
    log.error('测试连接失败:', error)
    return {
      success: false,
      error: error.message || t('连接失败'),
      code: error.code
    }
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch {
        // ignore - connection may already be closed
      }
    }
    if (tunnel) tunnel.close()
  }
}

export async function createConnection(name, config) {
  let tunnel = null
  try {
    if (connections.has(name)) {
      await closeConnection(name)
    }

    let effectiveConfig = config
    if (config.ssh?.enabled) {
      tunnel = await createSshTunnel(name, config)
      effectiveConfig = { ...config, host: '127.0.0.1', port: tunnel.localPort }
    }

    const pool = await mysql.createPool(buildPoolConfig(effectiveConfig))

    const entry = { pool, config: { ...config }, keepAliveTimer: null, sshTunnel: tunnel }
    tunnel = null

    if (config.readOnly) {
      pool.on('connection', (rawConn) => {
        rawConn.query('SET SESSION TRANSACTION READ ONLY', (error) => {
          if (error) log.warn(`只读连接设置会话只读失败: ${name}:`, error.message)
        })
      })
    }

    if (config.keepAliveInterval && Number(config.keepAliveInterval) > 0) {
      entry.keepAliveTimer = setInterval(
        async () => {
          try {
            const conn = await pool.getConnection()
            try {
              await conn.ping()
            } finally {
              conn.release()
            }
          } catch (e) {
            log.warn(`Keep-alive ping failed for ${name}:`, e.message)
          }
        },
        Number(config.keepAliveInterval) * 1000
      )
      if (typeof entry.keepAliveTimer.unref === 'function') {
        entry.keepAliveTimer.unref()
      }
    }

    connections.set(name, entry)

    log.info(`数据库连接创建成功: ${name}`)
    return { success: true, message: t('连接创建成功') }
  } catch (error) {
    if (tunnel) tunnel.close()
    log.error('创建连接失败:', error)
    return {
      success: false,
      error: error.message || t('创建连接失败'),
      code: error.code
    }
  }
}

async function releaseTransaction(name) {
  const tx = transactions.get(name)
  if (!tx) return
  transactions.delete(name)
  try {
    await tx.conn.release()
  } catch (e) {
    log.warn(`释放事务连接失败: ${name}`, e.message)
  }
}

export async function closeConnection(name) {
  try {
    await releaseTransaction(name)

    for (const [requestId, item] of runningQueries.entries()) {
      if (item.name === name) {
        runningQueries.delete(requestId)
      }
    }

    const entry = connections.get(name)
    if (!entry) {
      return { success: false, error: t('连接不存在') }
    }

    connections.delete(name)

    if (entry.keepAliveTimer) {
      clearInterval(entry.keepAliveTimer)
    }

    try {
      await entry.pool.end()
    } catch (e) {
      if (e.code !== 'PROTOCOL_CONNECTION_CLOSED' && e.code !== 'PROTOCOL_ENQUEUE_AFTER_QUIT') {
        log.warn(`关闭连接时出错: ${name}`, e.message)
      }
    }

    if (entry.sshTunnel) {
      entry.sshTunnel.close()
    }

    log.info(`数据库连接已关闭: ${name}`)
    return { success: true, message: t('连接已关闭') }
  } catch (error) {
    log.error('关闭连接失败:', error)
    return {
      success: false,
      error: error.message || t('关闭连接失败')
    }
  }
}

export async function closeAllConnections() {
  const names = Array.from(connections.keys())
  const errors = []

  for (const name of names) {
    const result = await closeConnection(name)
    if (!result.success) {
      errors.push({ name, error: result.error })
    }
  }

  connections.clear()
  transactions.clear()
  runningQueries.clear()

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, message: t('所有连接已关闭') }
}

export async function executeQuery(name, sql, params = [], options = {}) {
  let conn = null
  let shouldRelease = false
  const requestId = options.requestId
  const startedAt = Date.now()

  try {
    const entry = getEntry(name)
    const blocked = readOnlyBlock(entry, sql)
    if (blocked) {
      return auditSqlResult(
        name,
        options.database,
        sql,
        { success: false, error: blocked, readonlyBlocked: true },
        0,
        'query'
      )
    }

    const tx = transactions.get(name)

    if (tx) {
      conn = tx.conn
    } else {
      conn = await entry.pool.getConnection()
      shouldRelease = true
      if (options.database) {
        await conn.query(`USE ${quoteIdentifier(options.database)}`)
      }
    }

    if (requestId) {
      runningQueries.set(requestId, { name, threadId: conn.threadId })
    }

    const autoLimit = options.autoLimit === true
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(options.limit) || DEFAULT_LIMIT))
    const finalSql = autoLimit ? addLimitToQuery(sql, limit) : sql

    const [rows, fields] = await runQuery(conn, finalSql, params, options.timeout)
    const duration = Date.now() - startedAt

    log.info(`执行查询成功: ${name}, 耗时: ${duration}ms`)

    return auditSqlResult(name, options.database, sql, normalizeResult(rows, fields, duration), duration, 'query')
  } catch (error) {
    const duration = Date.now() - startedAt
    if (error.code === 'ER_QUERY_INTERRUPTED') {
      log.warn(`查询已取消: ${name}`)
      return auditSqlResult(
        name,
        options.database,
        sql,
        { success: false, canceled: true, error: t('查询已取消') },
        duration,
        'query'
      )
    }
    log.error('执行查询失败:', error)
    return auditSqlResult(name, options.database, sql, toErrorResult(error, t('执行查询失败')), duration, 'query')
  } finally {
    if (requestId) {
      runningQueries.delete(requestId)
    }
    if (conn && shouldRelease) {
      conn.release()
    }
  }
}

export async function executeScript(name, sql, options = {}) {
  let conn = null
  const startedAt = Date.now()

  try {
    const entry = getEntry(name)
    const blocked = readOnlyBlock(entry, sql, { multiple: true })
    if (blocked) {
      return auditSqlResult(
        name,
        options.database,
        sql,
        { success: false, error: blocked, readonlyBlocked: true },
        0,
        'script'
      )
    }

    const config = buildPoolConfig(entry.config)
    delete config.waitForConnections
    delete config.connectionLimit
    delete config.queueLimit

    conn = await mysql.createConnection({ ...config, multipleStatements: true })

    if (options.database) {
      await conn.query(`USE ${quoteIdentifier(options.database)}`)
    }

    const [results] = await conn.query(sql)
    const duration = Date.now() - startedAt
    const list = Array.isArray(results) ? results : [results]
    let rows = []
    let affectedRows = 0

    for (const item of list) {
      if (Array.isArray(item)) {
        rows = item
      } else {
        affectedRows += item?.affectedRows ?? 0
      }
    }

    log.info(`执行脚本成功: ${name}, 语句: ${list.length}, 耗时: ${duration}ms`)

    const result = {
      success: true,
      duration,
      statementCount: list.length,
      rows,
      fields: [],
      rowCount: rows.length,
      affectedRows,
      isSelect: rows.length > 0
    }
    return auditSqlResult(name, options.database, sql, result, duration, 'script')
  } catch (error) {
    log.error('执行脚本失败:', error)
    return auditSqlResult(
      name,
      options.database,
      sql,
      toErrorResult(error, t('执行脚本失败')),
      Date.now() - startedAt,
      'script'
    )
  } finally {
    if (conn) {
      try {
        await conn.end()
      } catch {
        // ignore
      }
    }
  }
}

export async function cancelQuery(name, requestId) {
  try {
    const entry = getEntry(name)
    const item = runningQueries.get(requestId)
    if (!item) {
      return { success: false, error: t('查询已结束或不存在') }
    }

    const threadId = Number(item.threadId)
    if (!Number.isInteger(threadId) || threadId <= 0) {
      return { success: false, error: t('无法获取查询线程') }
    }

    await entry.pool.query(`KILL QUERY ${threadId}`)
    log.info(`已请求取消查询: ${name}, thread: ${threadId}`)
    return { success: true, message: t('已发送取消请求') }
  } catch (error) {
    log.error('取消查询失败:', error)
    return { success: false, error: error.message || t('取消查询失败') }
  }
}

async function optionalQuery(conn, sql) {
  try {
    const [rows] = await conn.query(sql)
    return rows
  } catch {
    return null
  }
}

async function loadProcesslist(conn) {
  try {
    const [rows] = await conn.query(
      `SELECT ID AS id, USER AS user, HOST AS host, DB AS db, COMMAND AS command,
              TIME AS time, STATE AS state, INFO AS info
       FROM information_schema.PROCESSLIST`
    )
    return rows
  } catch {
    const [rows] = await conn.query('SHOW PROCESSLIST')
    return rows.map((row) => ({
      id: row.Id,
      user: row.User,
      host: row.Host,
      db: row.db,
      command: row.Command,
      time: row.Time,
      state: row.State,
      info: row.Info
    }))
  }
}

function normalizeTrxId(value) {
  return value === null || value === undefined ? '' : String(value)
}

export async function getSessionInfo(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [identityRows] = await conn.query('SELECT CONNECTION_ID() AS id, VERSION() AS version')
    const selfId = Number(identityRows[0]?.id) || 0
    const version = String(identityRows[0]?.version || '')

    const sessions = (await loadProcesslist(conn)).map((row) => ({
      id: Number(row.id) || 0,
      user: row.user || '',
      host: row.host || '',
      db: row.db || '',
      command: row.command || '',
      time: Number(row.time) || 0,
      state: row.state || '',
      info: row.info || '',
      isSelf: Number(row.id) === selfId
    }))
    sessions.sort((left, right) => right.time - left.time)

    const trxRows =
      (await optionalQuery(
        conn,
        `SELECT trx_id AS trxId, trx_state AS state, trx_started AS started,
                trx_wait_started AS waitStarted, trx_mysql_thread_id AS threadId,
                trx_rows_locked AS rowsLocked, trx_rows_modified AS rowsModified,
                trx_query AS query
         FROM information_schema.INNODB_TRX`
      )) || []
    const trxMap = new Map()
    const transactions = trxRows.map((row) => {
      const transaction = {
        trxId: normalizeTrxId(row.trxId),
        state: row.state || '',
        started: row.started ? new Date(row.started).toISOString() : '',
        waitStarted: row.waitStarted ? new Date(row.waitStarted).toISOString() : '',
        threadId: Number(row.threadId) || 0,
        rowsLocked: Number(row.rowsLocked) || 0,
        rowsModified: Number(row.rowsModified) || 0,
        query: row.query || ''
      }
      trxMap.set(transaction.trxId, transaction)
      return transaction
    })
    transactions.sort((left, right) => {
      if (left.state === 'LOCK WAIT' && right.state !== 'LOCK WAIT') return -1
      if (right.state === 'LOCK WAIT' && left.state !== 'LOCK WAIT') return 1
      return String(left.started).localeCompare(String(right.started))
    })

    let lockRows = await optionalQuery(
      conn,
      `SELECT ENGINE_TRANSACTION_ID AS trxId, ENGINE_LOCK_ID AS lockId,
              OBJECT_SCHEMA AS db, OBJECT_NAME AS tableName, INDEX_NAME AS indexName,
              LOCK_TYPE AS lockType, LOCK_MODE AS lockMode, LOCK_STATUS AS lockStatus
       FROM performance_schema.data_locks`
    )
    if (!lockRows) {
      lockRows = await optionalQuery(
        conn,
        `SELECT lock_trx_id AS trxId, lock_id AS lockId, lock_type AS lockType,
                lock_mode AS lockMode, lock_table AS lockTable, lock_index AS indexName
         FROM information_schema.INNODB_LOCKS`
      )
    }
    lockRows = lockRows || []

    let waitRows = await optionalQuery(
      conn,
      `SELECT REQUESTING_ENGINE_TRANSACTION_ID AS waitingTrxId,
              BLOCKING_ENGINE_TRANSACTION_ID AS blockingTrxId,
              REQUESTING_ENGINE_LOCK_ID AS waitingLockId,
              BLOCKING_ENGINE_LOCK_ID AS blockingLockId
       FROM performance_schema.data_lock_waits`
    )
    if (!waitRows) {
      waitRows = await optionalQuery(
        conn,
        `SELECT requesting_trx_id AS waitingTrxId, blocking_trx_id AS blockingTrxId,
                requested_lock_id AS waitingLockId, blocking_lock_id AS blockingLockId
         FROM information_schema.INNODB_LOCK_WAITS`
      )
    }
    waitRows = waitRows || []

    const waitingLockIds = new Set(waitRows.map((row) => String(row.waitingLockId || '')))
    const locks = lockRows.map((row) => {
      const trxId = normalizeTrxId(row.trxId)
      const transaction = trxMap.get(trxId)
      let db = row.db || ''
      let tableName = row.tableName || ''
      if (!db && row.lockTable) {
        const match = /^`([^`]+)`\.`([^`]+)`$/.exec(String(row.lockTable))
        if (match) {
          db = match[1]
          tableName = match[2]
        } else {
          tableName = String(row.lockTable)
        }
      }
      const lockStatus = row.lockStatus || (waitingLockIds.has(String(row.lockId || '')) ? 'WAITING' : 'GRANTED')
      return {
        lockId: String(row.lockId || ''),
        trxId,
        processId: transaction?.threadId || 0,
        db,
        tableName,
        indexName: row.indexName || '',
        lockType: row.lockType || '',
        lockMode: row.lockMode || '',
        lockStatus
      }
    })
    const lockMap = new Map(locks.map((lock) => [lock.lockId, lock]))

    const waits = waitRows.map((row) => {
      const waiting = trxMap.get(normalizeTrxId(row.waitingTrxId))
      const blocking = trxMap.get(normalizeTrxId(row.blockingTrxId))
      const waitingLock = lockMap.get(String(row.waitingLockId || ''))
      const blockingLock = lockMap.get(String(row.blockingLockId || ''))
      return {
        waitingTrxId: normalizeTrxId(row.waitingTrxId),
        blockingTrxId: normalizeTrxId(row.blockingTrxId),
        waitingThreadId: waiting?.threadId || waitingLock?.processId || 0,
        blockingThreadId: blocking?.threadId || blockingLock?.processId || 0,
        waitingQuery: waiting?.query || '',
        blockingQuery: blocking?.query || '',
        db: waitingLock?.db || blockingLock?.db || '',
        tableName: waitingLock?.tableName || blockingLock?.tableName || '',
        waitingLockMode: waitingLock?.lockMode || '',
        blockingLockMode: blockingLock?.lockMode || ''
      }
    })

    const engineRows = await optionalQuery(conn, 'SHOW ENGINE INNODB STATUS')
    const engineStatus = engineRows?.[0]?.Status || ''
    let deadlockText = ''
    const deadlockIndex = engineStatus.indexOf('LATEST DETECTED DEADLOCK')
    if (deadlockIndex >= 0) {
      const endIndex = engineStatus.indexOf('TRANSACTIONS', deadlockIndex)
      deadlockText = engineStatus
        .slice(deadlockIndex, endIndex > deadlockIndex ? endIndex : deadlockIndex + 4000)
        .trim()
    }

    return {
      success: true,
      selfId,
      version,
      sessions,
      transactions,
      locks,
      waits,
      deadlockText
    }
  } catch (error) {
    log.error('读取会话信息失败:', error)
    return toErrorResult(error, t('读取会话信息失败'))
  } finally {
    conn?.release()
  }
}

export async function killSession(name, threadId, mode = 'connection') {
  let conn = null
  try {
    const id = Number(threadId)
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(t('无效的会话 ID'))
    }

    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const [identityRows] = await conn.query('SELECT CONNECTION_ID() AS id')
    if (Number(identityRows[0]?.id) === id) {
      throw new Error(t('不能操作当前正在使用的会话'))
    }

    if (mode === 'query') {
      await conn.query(`KILL QUERY ${id}`)
      log.info(`已请求取消会话查询: ${name}, thread: ${id}`)
      return { success: true, message: t('已取消该会话正在执行的查询') }
    }

    await conn.query(`KILL CONNECTION ${id}`)
    log.info(`已终止会话: ${name}, thread: ${id}`)
    return { success: true, message: t('会话已终止') }
  } catch (error) {
    log.error('操作会话失败:', error)
    return toErrorResult(error, t('操作会话失败'))
  } finally {
    conn?.release()
  }
}

export async function queryDatabases(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query('SHOW DATABASES')
    const databases = rows.map((row) => row.Database)

    return { success: true, databases }
  } catch (error) {
    log.error('查询数据库列表失败:', error)
    return { success: false, error: error.message }
  } finally {
    conn?.release()
  }
}

export async function queryTables(name, database) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [rows] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS type, ENGINE AS engine,
              TABLE_ROWS AS rowCount, DATA_LENGTH AS dataLength, INDEX_LENGTH AS indexLength,
              TABLE_COLLATION AS collation, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_TYPE, TABLE_NAME`,
      [database]
    )

    return {
      success: true,
      tables: rows.map((row) => row.name),
      details: rows.map((row) => ({
        name: row.name,
        type: row.type,
        isView: row.type === 'VIEW',
        engine: row.engine,
        rowCount: row.rowCount,
        dataLength: row.dataLength,
        indexLength: row.indexLength,
        collation: row.collation,
        comment: row.comment
      }))
    }
  } catch (error) {
    log.error('查询表列表失败:', error)
    return { success: false, error: error.message }
  } finally {
    conn?.release()
  }
}

export async function getTableStructure(name, database, tableName) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    return { success: true, fields: columns, columns }
  } catch (error) {
    log.error('查询表结构失败:', error)
    return { success: false, error: error.message }
  } finally {
    conn?.release()
  }
}

function isLazyBinaryColumn(column) {
  return LAZY_BINARY_TYPE_PATTERN.test(String(column?.dataType || '').trim())
}

function rememberTableCount(key, total) {
  if (tableCountCache.size >= 200) tableCountCache.clear()
  tableCountCache.set(key, { total, expiresAt: Date.now() + TABLE_COUNT_CACHE_TTL })
}

function invalidateTableCounts(name, database, tableName) {
  const prefix = `${name}|${database}|${tableName}|`
  for (const key of tableCountCache.keys()) {
    if (key.startsWith(prefix)) tableCountCache.delete(key)
  }
}

export async function getTableData(name, database, tableName, options = {}) {
  try {
    const entry = getEntry(name)
    const page = Math.max(1, Number(options.page) || 1)
    const pageSize = Math.min(TABLE_PAGE_SIZE_LIMIT, Math.max(1, Number(options.pageSize) || 100))

    const [columns, primaryKeys, tableInfoResult] = await Promise.all([
      loadColumns(entry.pool, database, tableName),
      loadPrimaryKeys(entry.pool, database, tableName),
      runQuery(
        entry.pool,
        `SELECT TABLE_TYPE AS type, ENGINE AS engine, TABLE_ROWS AS rowCount,
                DATA_LENGTH AS dataLength, INDEX_LENGTH AS indexLength,
                TABLE_COLLATION AS collation, TABLE_COMMENT AS comment
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [database, tableName],
        options.timeout
      )
    ])
    if (!columns.length) {
      throw new Error(t('表不存在或没有可读取的字段'))
    }

    const { whereSql, params } = buildWhereClause(columns, options)
    const orderSql = buildOrderBy(columns, options.sort)
    const tableRef = quoteTable(database, tableName)
    const tableInfo = tableInfoResult[0][0] || null
    const lazyColumns = columns.filter(isLazyBinaryColumn).map((column) => column.name)
    const lazyColumnSet = new Set(lazyColumns)
    const selectList = columns
      .map((column) =>
        lazyColumnSet.has(column.name)
          ? `LENGTH(${quoteIdentifier(column.name)}) AS ${quoteIdentifier(column.name)}`
          : quoteIdentifier(column.name)
      )
      .join(', ')
    const countSql = `SELECT COUNT(*) AS total FROM ${tableRef}${whereSql}`
    const pageSql = (offset) =>
      `SELECT ${selectList} FROM ${tableRef}${whereSql}${orderSql} LIMIT ${pageSize} OFFSET ${offset}`
    const countCacheKey = `${name}|${database}|${tableName}|${whereSql}|${JSON.stringify(params)}`

    const providedTotal =
      options.total === undefined || options.total === null || options.total === '' ? null : Number(options.total)
    let total = Number.isFinite(providedTotal) && providedTotal >= 0 ? Math.floor(providedTotal) : null
    let countApproximate = false

    if (total === null) {
      const cached = tableCountCache.get(countCacheKey)
      if (cached && cached.expiresAt > Date.now()) {
        total = cached.total
      }
    }

    if (total === null && !whereSql && options.exactCount !== true) {
      const approximateRows = Number(tableInfo?.rowCount)
      if (Number.isFinite(approximateRows) && approximateRows >= APPROXIMATE_ROW_THRESHOLD) {
        total = approximateRows
        countApproximate = true
      }
    }

    let rows = []
    let currentPage = page

    if (total === null) {
      if (page === 1) {
        const [[countRows], [pageRows]] = await Promise.all([
          runQuery(entry.pool, countSql, params, options.timeout),
          runQuery(entry.pool, pageSql(0), params, options.timeout)
        ])
        total = Number(countRows[0]?.total || 0)
        rows = pageRows
      } else {
        const [countRows] = await runQuery(entry.pool, countSql, params, options.timeout)
        total = Number(countRows[0]?.total || 0)
        const pageCount = Math.max(1, Math.ceil(total / pageSize))
        currentPage = Math.min(page, pageCount)
        const [pageRows] = await runQuery(entry.pool, pageSql((currentPage - 1) * pageSize), params, options.timeout)
        rows = pageRows
      }
      rememberTableCount(countCacheKey, total)
    } else {
      const pageCount = Math.max(1, Math.ceil(total / pageSize))
      currentPage = Math.min(page, pageCount)
      const [pageRows] = await runQuery(entry.pool, pageSql((currentPage - 1) * pageSize), params, options.timeout)
      rows = pageRows
    }

    const pageCount = Math.max(1, Math.ceil(total / pageSize))

    return {
      success: true,
      rows,
      fields: columns.map((column) => ({ name: column.name, columnType: column.columnType })),
      columns,
      primaryKeys,
      lazyColumns,
      countApproximate,
      total,
      page: currentPage,
      pageSize,
      pageCount,
      isView: tableInfo?.type === 'VIEW',
      tableInfo,
      sql: mysql.format(pageSql((currentPage - 1) * pageSize), params)
    }
  } catch (error) {
    log.error('读取表数据失败:', error)
    return toErrorResult(error, t('读取表数据失败'))
  }
}

export async function getTableCellValue(name, database, tableName, columnName, keys = {}, options = {}) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    if (!columns.some((column) => column.name === columnName)) {
      throw new Error(`无效的字段: ${columnName}`)
    }
    const primaryKeys = await loadPrimaryKeys(conn, database, tableName)
    if (!primaryKeys.length) {
      throw new Error(t('表没有主键，无法定位单元格'))
    }
    const clauses = []
    const params = []
    for (const key of primaryKeys) {
      if (!Object.prototype.hasOwnProperty.call(keys, key)) {
        throw new Error(`缺少主键字段: ${key}`)
      }
      clauses.push(`${quoteIdentifier(key)} <=> ?`)
      params.push(keys[key] === undefined ? null : keys[key])
    }
    const [rows] = await runQuery(
      conn,
      `SELECT ${quoteIdentifier(columnName)} AS value FROM ${quoteTable(
        database,
        tableName
      )} WHERE ${clauses.join(' AND ')} LIMIT 1`,
      params,
      options.timeout
    )
    if (!rows.length) {
      throw new Error(t('未找到该行数据'))
    }
    return { success: true, value: rows[0].value ?? null }
  } catch (error) {
    log.error('读取单元格数据失败:', error)
    return toErrorResult(error, t('读取单元格数据失败'))
  } finally {
    conn?.release()
  }
}

export async function getTableMeta(name, database, tableName) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [columns, primaryKeys, indexesResult, foreignKeysResult, triggersResult, infoResult, ddlResult] =
      await Promise.all([
        loadColumns(conn, database, tableName),
        loadPrimaryKeys(conn, database, tableName),
        conn.query(
          `SELECT INDEX_NAME AS name, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS seq,
                  COLUMN_NAME AS columnName, INDEX_TYPE AS type, CARDINALITY AS cardinality
           FROM information_schema.STATISTICS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
          [database, tableName]
        ),
        conn.query(
          `SELECT k.CONSTRAINT_NAME AS name, k.COLUMN_NAME AS columnName,
                  k.REFERENCED_TABLE_SCHEMA AS refSchema, k.REFERENCED_TABLE_NAME AS refTable,
                  k.REFERENCED_COLUMN_NAME AS refColumn,
                  r.UPDATE_RULE AS updateRule, r.DELETE_RULE AS deleteRule
           FROM information_schema.KEY_COLUMN_USAGE k
           LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS r
             ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
            AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
            AND r.TABLE_NAME = k.TABLE_NAME
           WHERE k.TABLE_SCHEMA = ? AND k.TABLE_NAME = ? AND k.REFERENCED_TABLE_NAME IS NOT NULL
           ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
          [database, tableName]
        ),
        conn.query(
          `SELECT TRIGGER_NAME AS name, EVENT_MANIPULATION AS event, ACTION_TIMING AS timing,
                  ACTION_STATEMENT AS statement, ACTION_ORDER AS sortOrder
           FROM information_schema.TRIGGERS
           WHERE EVENT_OBJECT_SCHEMA = ? AND EVENT_OBJECT_TABLE = ?
           ORDER BY ACTION_ORDER`,
          [database, tableName]
        ),
        conn.query(
          `SELECT TABLE_TYPE AS type, ENGINE AS engine, TABLE_ROWS AS rowCount,
                  DATA_LENGTH AS dataLength, INDEX_LENGTH AS indexLength,
                  AUTO_INCREMENT AS autoIncrement, TABLE_COLLATION AS collation,
                  TABLE_COMMENT AS comment, CREATE_TIME AS createTime, UPDATE_TIME AS updateTime
           FROM information_schema.TABLES
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
          [database, tableName]
        ),
        conn.query(`SHOW CREATE TABLE ${quoteTable(database, tableName)}`)
      ])

    const indexMap = new Map()
    for (const row of indexesResult[0]) {
      if (!indexMap.has(row.name)) {
        indexMap.set(row.name, {
          name: row.name,
          unique: !row.nonUnique,
          primary: row.name === 'PRIMARY',
          type: row.type,
          cardinality: row.cardinality,
          columns: []
        })
      }
      indexMap.get(row.name).columns.push(row.columnName)
    }

    const foreignKeyMap = new Map()
    for (const row of foreignKeysResult[0]) {
      if (!foreignKeyMap.has(row.name)) {
        foreignKeyMap.set(row.name, {
          name: row.name,
          refSchema: row.refSchema,
          refTable: row.refTable,
          updateRule: row.updateRule,
          deleteRule: row.deleteRule,
          columns: []
        })
      }
      foreignKeyMap.get(row.name).columns.push({
        column: row.columnName,
        refColumn: row.refColumn
      })
    }

    const ddlRow = ddlResult[0]?.[0]
    const ddl = ddlRow ? ddlRow['Create View'] || ddlRow['Create Table'] || '' : ''

    return {
      success: true,
      columns,
      primaryKeys,
      indexes: Array.from(indexMap.values()),
      foreignKeys: Array.from(foreignKeyMap.values()),
      triggers: triggersResult[0],
      info: infoResult[0][0] || null,
      ddl,
      isView: infoResult[0][0]?.type === 'VIEW'
    }
  } catch (error) {
    log.error('读取表元数据失败:', error)
    return toErrorResult(error, t('读取表元数据失败'))
  } finally {
    conn?.release()
  }
}

function buildInsertSql(database, tableName, rows, columns) {
  const columnNames = new Set(columns.map((column) => column.name))
  const keys = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key))
      return set
    }, new Set())
  )

  for (const key of keys) {
    if (!columnNames.has(key)) {
      throw new Error(`无效的字段: ${key}`)
    }
  }

  if (!keys.length) {
    throw new Error(t('没有可写入的数据'))
  }

  const placeholders = rows.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ')
  const sql = `INSERT INTO ${quoteTable(database, tableName)} (${keys
    .map((key) => quoteIdentifier(key))
    .join(', ')}) VALUES ${placeholders}`
  const params = rows.flatMap((row) => keys.map((key) => (row[key] === undefined ? null : row[key])))

  return { sql, params, keys }
}

export async function insertRows(name, database, tableName, rows = [], options = {}) {
  let conn = null
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(t('没有可导入的数据'))
    }

    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    const { sql, params } = buildInsertSql(database, tableName, rows, columns)
    const [result] = await runQuery(conn, sql, params, options.timeout)
    invalidateTableCounts(name, database, tableName)

    const summary = { success: true, inserted: result.affectedRows ?? rows.length, insertId: result.insertId }
    auditWrite(name, database, 'INSERT', '', summary, { rows: summary.inserted, table: tableName, source: 'grid' })
    return summary
  } catch (error) {
    log.error('插入数据失败:', error)
    const result = toErrorResult(error, t('插入数据失败'))
    auditWrite(name, database, 'INSERT', '', result, { table: tableName, source: 'grid' })
    return result
  } finally {
    conn?.release()
  }
}

function buildKeyClause(keys, columnNames) {
  const entries = Object.entries(keys || {})
  if (!entries.length) {
    throw new Error(t('缺少定位行的主键值'))
  }

  const parts = []
  const params = []
  for (const [key, value] of entries) {
    if (!columnNames.has(key)) {
      throw new Error(`无效的主键字段: ${key}`)
    }
    parts.push(`${quoteIdentifier(key)} <=> ?`)
    params.push(value === undefined ? null : value)
  }

  return { sql: parts.join(' AND '), params }
}

export async function applyTableChanges(name, database, tableName, changes = {}) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    if (!columns.length) {
      throw new Error(t('表不存在或没有可编辑的字段'))
    }
    const columnNames = new Set(columns.map((column) => column.name))
    const tableRef = quoteTable(database, tableName)

    const updates = changes.updates || []
    const deletes = changes.deletes || []
    const inserts = changes.inserts || []

    let updated = 0
    let deleted = 0
    let inserted = 0

    await conn.beginTransaction()
    try {
      for (const item of updates) {
        const values = Object.entries(item.values || {}).filter(([key]) => columnNames.has(key))
        if (!values.length) continue
        const keyClause = buildKeyClause(item.keys, columnNames)
        const sql = `UPDATE ${tableRef} SET ${values
          .map(([key]) => `${quoteIdentifier(key)} = ?`)
          .join(', ')} WHERE ${keyClause.sql}`
        const [result] = await conn.query(sql, [...values.map(([, value]) => value), ...keyClause.params])
        updated += result.affectedRows ?? 0
      }

      for (const item of deletes) {
        const keyClause = buildKeyClause(item.keys || item, columnNames)
        const [result] = await conn.query(`DELETE FROM ${tableRef} WHERE ${keyClause.sql}`, keyClause.params)
        deleted += result.affectedRows ?? 0
      }

      if (inserts.length) {
        const { sql, params } = buildInsertSql(database, tableName, inserts, columns)
        const [result] = await conn.query(sql, params)
        inserted += result.affectedRows ?? inserts.length
      }

      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    }
    invalidateTableCounts(name, database, tableName)

    log.info(`保存表数据: ${name}.${database}.${tableName}, 更新: ${updated}, 删除: ${deleted}, 新增: ${inserted}`)

    const result = { success: true, updated, deleted, inserted }
    auditWrite(name, database, 'DATA', '', result, {
      rows: updated + deleted + inserted,
      table: tableName,
      source: 'grid'
    })
    return result
  } catch (error) {
    log.error('保存表数据失败:', error)
    const result = toErrorResult(error, t('保存表数据失败'))
    auditWrite(name, database, 'DATA', '', result, { table: tableName, source: 'grid' })
    return result
  } finally {
    conn?.release()
  }
}

function assertColumnType(type) {
  const value = String(type || '').trim()
  if (!/^[A-Za-z0-9_]+(\s*\([0-9,\s]+\))?(\s+unsigned)?(\s+zerofill)?$/i.test(value)) {
    throw new Error(t('字段类型不合法: {p0}', { p0: type }))
  }
  return value
}

function buildColumnDefinition(column = {}) {
  const name = assertColumnName(column.name, t('字段名'))
  const type = assertColumnType(column.type || column.columnType)
  const parts = [quoteIdentifier(name), type]

  if (column.autoIncrement) parts.push('AUTO_INCREMENT')
  parts.push(column.nullable === false ? 'NOT NULL' : 'NULL')

  if (column.defaultValue !== undefined) {
    if (column.defaultValue === null) {
      parts.push('DEFAULT NULL')
    } else if (/^(CURRENT_TIMESTAMP(\(\d*\))?|NULL|TRUE|FALSE)$/i.test(String(column.defaultValue).trim())) {
      parts.push(`DEFAULT ${String(column.defaultValue).trim()}`)
    } else {
      parts.push(`DEFAULT ${mysql.escape(column.defaultValue)}`)
    }
  }

  if (column.comment) {
    parts.push(`COMMENT ${mysql.escape(String(column.comment))}`)
  }

  return parts.join(' ')
}

const FK_ACTIONS = new Set(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'])

function normalizeFkAction(value, label) {
  const action = String(value || '')
    .trim()
    .toUpperCase()
  if (!action) return ''
  if (!FK_ACTIONS.has(action)) {
    throw new Error(t('{p0}不合法: {p1}', { p0: label, p1: value }))
  }
  return action
}

function buildAlterClauses(columnNames, primaryKeys, database, tableName, operations = {}) {
  const clauses = []
  const renameTargets = new Set(
    (operations.renameColumns || []).map((column) => String(column.to || '').trim()).filter(Boolean)
  )
  const knownColumns = new Set([...columnNames, ...renameTargets])

  for (const fkName of operations.dropForeignKeys || []) {
    clauses.push(`DROP FOREIGN KEY ${quoteIdentifier(fkName)}`)
  }

  for (const column of operations.renameColumns || []) {
    if (!columnNames.has(column.name)) {
      throw new Error(`字段不存在: ${column.name}`)
    }
    const target = String(column.to || '').trim()
    if (!target) {
      throw new Error(t('新字段名不能为空'))
    }
    clauses.push(`CHANGE COLUMN ${quoteIdentifier(column.name)} ${buildColumnDefinition({ ...column, name: target })}`)
  }

  for (const column of operations.addColumns || []) {
    let clause = `ADD COLUMN ${buildColumnDefinition(column)}`
    if (column.after && knownColumns.has(column.after)) {
      clause += ` AFTER ${quoteIdentifier(column.after)}`
    } else if (column.first) {
      clause += ' FIRST'
    }
    clauses.push(clause)
  }

  for (const column of operations.modifyColumns || []) {
    if (!columnNames.has(column.name)) {
      throw new Error(`字段不存在: ${column.name}`)
    }
    clauses.push(`MODIFY COLUMN ${buildColumnDefinition(column)}`)
  }

  for (const columnName of operations.dropColumns || []) {
    if (!columnNames.has(columnName)) {
      throw new Error(`字段不存在: ${columnName}`)
    }
    clauses.push(`DROP COLUMN ${quoteIdentifier(columnName)}`)
  }

  if (Array.isArray(operations.primaryKeys)) {
    const keys = operations.primaryKeys.map((column) => String(column).trim()).filter(Boolean)
    const missing = keys.filter((column) => !knownColumns.has(column))
    if (missing.length) {
      throw new Error(`主键字段不存在: ${missing.join(', ')}`)
    }
    const current = primaryKeys || []
    const changed = keys.length !== current.length || keys.some((column, index) => current[index] !== column)
    if (changed) {
      if (current.length) clauses.push('DROP PRIMARY KEY')
      if (keys.length) {
        clauses.push(`ADD PRIMARY KEY (${keys.map((column) => quoteIdentifier(column)).join(', ')})`)
      }
    }
  }

  for (const index of operations.addIndexes || []) {
    const indexColumns = (index.columns || []).filter((column) => knownColumns.has(column))
    if (!indexColumns.length) {
      throw new Error(t('索引至少需要一个有效字段'))
    }
    const indexName = String(index.name || `idx_${tableName}_${indexColumns.join('_')}`).trim()
    clauses.push(
      `ADD ${index.unique ? 'UNIQUE ' : ''}KEY ${quoteIdentifier(indexName)} (${indexColumns
        .map((column) => quoteIdentifier(column))
        .join(', ')})`
    )
  }

  for (const indexName of operations.dropIndexes || []) {
    if (indexName === 'PRIMARY') continue
    clauses.push(`DROP INDEX ${quoteIdentifier(indexName)}`)
  }

  for (const fk of operations.addForeignKeys || []) {
    const fkColumns = (fk.columns || []).map((column) => String(column).trim()).filter(Boolean)
    if (!fkColumns.length) {
      throw new Error(t('外键至少需要一个字段'))
    }
    const missing = fkColumns.filter((column) => !knownColumns.has(column))
    if (missing.length) {
      throw new Error(`外键字段不存在: ${missing.join(', ')}`)
    }
    const refColumns = (fk.refColumns || []).map((column) => String(column).trim()).filter(Boolean)
    if (refColumns.length !== fkColumns.length) {
      throw new Error(t('外键字段与引用字段数量不一致'))
    }
    const refTable = String(fk.refTable || '').trim()
    if (!refTable) {
      throw new Error(t('外键引用表不能为空'))
    }
    const refSchema = String(fk.refSchema || database || '').trim()
    const constraintName = String(fk.name || `fk_${tableName}_${fkColumns.join('_')}`).trim()
    let clause = `ADD CONSTRAINT ${quoteIdentifier(constraintName)} FOREIGN KEY (${fkColumns
      .map((column) => quoteIdentifier(column))
      .join(', ')}) REFERENCES ${quoteTable(refSchema, refTable)} (${refColumns
      .map((column) => quoteIdentifier(column))
      .join(', ')})`
    const onDelete = normalizeFkAction(fk.onDelete, t('ON DELETE 操作'))
    const onUpdate = normalizeFkAction(fk.onUpdate, t('ON UPDATE 操作'))
    if (onDelete) clause += ` ON DELETE ${onDelete}`
    if (onUpdate) clause += ` ON UPDATE ${onUpdate}`
    clauses.push(clause)
  }

  const charset = String(operations.charset || '')
    .trim()
    .toLowerCase()
  if (charset) {
    if (!SAFE_CHARSETS.has(charset)) {
      throw new Error(t('字符集不合法: {p0}', { p0: operations.charset }))
    }
    clauses.push(`DEFAULT CHARSET=${charset}`)
  }

  if (operations.tableComment !== undefined && operations.tableComment !== null) {
    clauses.push(`COMMENT=${mysql.escape(String(operations.tableComment))}`)
  }

  if (operations.renameTable) {
    clauses.push(`RENAME TO ${quoteTable(database, operations.renameTable)}`)
  }

  return clauses
}

export async function alterTable(name, database, tableName, operations = {}) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    if (!columns.length) {
      throw new Error(t('表不存在'))
    }
    const primaryKeys = await loadPrimaryKeys(conn, database, tableName)
    const clauses = buildAlterClauses(
      new Set(columns.map((column) => column.name)),
      primaryKeys,
      database,
      tableName,
      operations
    )

    if (!clauses.length) {
      throw new Error(t('没有需要执行的结构变更'))
    }

    const sql = `ALTER TABLE ${quoteTable(database, tableName)} ${clauses.join(', ')}`
    await conn.query(sql)
    log.info(`表结构变更完成: ${name}.${database}.${tableName}`)

    const result = { success: true, statements: clauses, sql, renamedTo: operations.renameTable || '' }
    auditWrite(name, database, 'ALTER', sql, result, { table: tableName, source: 'designer' })
    return result
  } catch (error) {
    log.error('表结构变更失败:', error)
    const result = toErrorResult(error, t('表结构变更失败'))
    auditWrite(name, database, 'ALTER', '', result, { table: tableName, source: 'designer' })
    return result
  } finally {
    conn?.release()
  }
}

export async function previewAlterTable(name, database, tableName, operations = {}) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    if (!columns.length) {
      throw new Error(t('表不存在'))
    }
    const primaryKeys = await loadPrimaryKeys(conn, database, tableName)
    const clauses = buildAlterClauses(
      new Set(columns.map((column) => column.name)),
      primaryKeys,
      database,
      tableName,
      operations
    )
    if (!clauses.length) {
      throw new Error(t('没有需要执行的结构变更'))
    }

    return {
      success: true,
      statements: clauses,
      sql: `ALTER TABLE ${quoteTable(database, tableName)} ${clauses.join(', ')};`
    }
  } catch (error) {
    log.error('生成表结构变更预览失败:', error)
    return toErrorResult(error, t('生成表结构变更预览失败'))
  } finally {
    conn?.release()
  }
}

const SAFE_CHARSETS = new Set(['utf8mb4', 'utf8', 'utf8mb3', 'gbk', 'gb18030', 'big5', 'latin1', 'ascii'])

export async function createTable(name, database, tableName, options = {}) {
  let conn = null
  try {
    const table = String(tableName || '').trim()
    if (!table) throw new Error(t('表名不能为空'))
    if (table.length > 64) throw new Error(t('表名长度不能超过 64 个字符'))
    if (!database) throw new Error(t('请选择数据库'))

    const columns = Array.isArray(options.columns) ? options.columns : []
    if (!columns.length) throw new Error(t('至少需要一个字段'))

    const seen = new Set()
    for (const column of columns) {
      const columnName = String(column?.name || '').trim()
      if (!columnName) throw new Error(t('字段名不能为空'))
      const key = columnName.toLowerCase()
      if (seen.has(key)) throw new Error(`字段名重复: ${columnName}`)
      seen.add(key)
      assertColumnType(column.type || column.columnType)
    }

    const autoColumns = columns.filter((column) => column.autoIncrement)
    if (autoColumns.length > 1) throw new Error(t('只能设置一个自增字段'))
    if (autoColumns.length && !autoColumns[0].primaryKey) {
      throw new Error(t('自增字段必须同时设置为主键'))
    }

    const primaryKeys = columns.filter((column) => column.primaryKey).map((column) => String(column.name).trim())
    const definitions = columns.map((column) =>
      buildColumnDefinition({
        ...column,
        name: String(column.name).trim(),
        nullable: primaryKeys.includes(String(column.name).trim()) ? false : column.nullable
      })
    )
    if (primaryKeys.length) {
      definitions.push(`PRIMARY KEY (${primaryKeys.map((column) => quoteIdentifier(column)).join(', ')})`)
    }

    const indexes = Array.isArray(options.indexes) ? options.indexes : []
    const indexNames = new Set()
    for (const index of indexes) {
      const indexColumns = (index.columns || []).map((column) => String(column).trim()).filter(Boolean)
      const validColumns = indexColumns.filter((column) => seen.has(column.toLowerCase()))
      if (!validColumns.length) throw new Error(t('索引至少需要一个已有字段'))
      const indexName = String(index.name || `idx_${table}_${validColumns.join('_')}`).trim()
      if (indexNames.has(indexName.toLowerCase())) throw new Error(t('索引名重复: {p0}', { p0: indexName }))
      indexNames.add(indexName.toLowerCase())
      definitions.push(
        `${index.unique ? 'UNIQUE KEY' : 'KEY'} ${quoteIdentifier(indexName)} (${validColumns
          .map((column) => quoteIdentifier(column))
          .join(', ')})`
      )
    }

    const charset = SAFE_CHARSETS.has(String(options.charset || '').toLowerCase())
      ? String(options.charset).toLowerCase()
      : 'utf8mb4'
    const tableOptions = ['ENGINE=InnoDB', `DEFAULT CHARSET=${charset}`]
    const comment = String(options.comment || '').trim()
    if (comment) tableOptions.push(`COMMENT=${mysql.escape(comment)}`)

    const sql = `CREATE TABLE ${options.ifNotExists ? 'IF NOT EXISTS ' : ''}${quoteTable(database, table)} (\n  ${definitions.join(
      ',\n  '
    )}\n) ${tableOptions.join(' ')}`

    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    await conn.query(sql)
    log.info(`创建表成功: ${name}.${database}.${table}`)

    const result = { success: true, sql }
    auditWrite(name, database, 'CREATE', sql, result, { table, source: 'designer' })
    return result
  } catch (error) {
    log.error('创建表失败:', error)
    const result = toErrorResult(error, t('创建表失败'))
    auditWrite(name, database, 'CREATE', '', result, { table: String(tableName || ''), source: 'designer' })
    return result
  } finally {
    conn?.release()
  }
}

async function loadSchemaSnapshot(conn, database) {
  const [tableRows] = await conn.query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    [database]
  )
  const [columnRows] = await conn.query(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType,
            IS_NULLABLE AS nullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra,
            COLUMN_COMMENT AS comment, ORDINAL_POSITION AS position
     FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [database]
  )
  const [indexRows] = await conn.query(
    `SELECT TABLE_NAME AS tableName, INDEX_NAME AS name, NON_UNIQUE AS nonUnique,
            SEQ_IN_INDEX AS seq, COLUMN_NAME AS columnName
     FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ?
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    [database]
  )

  const tables = new Map()
  for (const row of tableRows) {
    tables.set(row.name, { name: row.name, columns: new Map(), indexes: new Map() })
  }
  for (const row of columnRows) {
    tables.get(row.tableName)?.columns.set(row.name, row)
  }
  for (const row of indexRows) {
    const table = tables.get(row.tableName)
    if (!table) continue
    let index = table.indexes.get(row.name)
    if (!index) {
      index = { name: row.name, unique: Number(row.nonUnique) === 0, columns: [] }
      table.indexes.set(row.name, index)
    }
    if (row.columnName) index.columns.push(row.columnName)
  }
  return tables
}

function columnSignature(column) {
  return [
    String(column.columnType || '').toLowerCase(),
    column.nullable,
    column.defaultValue === null ? '' : String(column.defaultValue),
    /auto_increment/i.test(column.extra || '') ? '1' : '0',
    column.comment || ''
  ].join('|')
}

function columnToDefinition(column) {
  return buildColumnDefinition({
    name: column.name,
    type: column.columnType,
    nullable: column.nullable === 'YES',
    defaultValue: column.defaultValue === null ? undefined : column.defaultValue,
    autoIncrement: /auto_increment/i.test(column.extra || ''),
    comment: column.comment || ''
  })
}

function indexSignature(index) {
  return `${index.unique ? '1' : '0'}|${index.columns.join(',')}`
}

export async function compareSchemas(name, baseDatabase, targetName, targetDatabase) {
  let baseConn = null
  let targetConn = null
  try {
    if (!baseDatabase || !targetDatabase) throw new Error(t('请选择源数据库和目标数据库'))
    if (name === targetName && baseDatabase === targetDatabase) {
      throw new Error(t('源数据库和目标数据库相同，无需对比'))
    }

    baseConn = await getEntry(name).pool.getConnection()
    targetConn = await getEntry(targetName).pool.getConnection()

    const baseTables = await loadSchemaSnapshot(baseConn, baseDatabase)
    const targetTables = await loadSchemaSnapshot(targetConn, targetDatabase)

    const missingTables = []
    const extraTables = []
    const tableDetails = []
    const missingColumns = []
    const extraColumns = []
    const changedColumns = []
    const missingIndexes = []
    const extraIndexes = []
    const changedIndexes = []

    for (const [tableName, baseTable] of baseTables) {
      const targetTable = targetTables.get(tableName)
      if (!targetTable) {
        missingTables.push(tableName)
        tableDetails.push({ name: tableName, status: 'missing', columns: [], indexes: [] })
        continue
      }

      const tableColumns = []
      for (const [columnName, baseColumn] of baseTable.columns) {
        const targetColumn = targetTable.columns.get(columnName)
        if (!targetColumn) {
          missingColumns.push({ table: tableName, column: columnName })
          tableColumns.push({ name: columnName, status: 'missing' })
        } else if (columnSignature(baseColumn) !== columnSignature(targetColumn)) {
          changedColumns.push({ table: tableName, column: columnName })
          tableColumns.push({ name: columnName, status: 'changed' })
        }
      }
      for (const columnName of targetTable.columns.keys()) {
        if (!baseTable.columns.has(columnName)) {
          extraColumns.push({ table: tableName, column: columnName })
          tableColumns.push({ name: columnName, status: 'extra' })
        }
      }

      const tableIndexes = []
      for (const [indexName, baseIndex] of baseTable.indexes) {
        const targetIndex = targetTable.indexes.get(indexName)
        if (!targetIndex) {
          missingIndexes.push({ table: tableName, index: indexName })
          tableIndexes.push({ name: indexName, status: 'missing' })
        } else if (indexSignature(baseIndex) !== indexSignature(targetIndex)) {
          changedIndexes.push({ table: tableName, index: indexName })
          tableIndexes.push({ name: indexName, status: 'changed' })
        }
      }
      for (const indexName of targetTable.indexes.keys()) {
        if (!baseTable.indexes.has(indexName)) {
          extraIndexes.push({ table: tableName, index: indexName })
          tableIndexes.push({ name: indexName, status: 'extra' })
        }
      }

      const changed =
        tableColumns.some((column) => column.status !== 'extra') ||
        tableIndexes.some((index) => index.status !== 'extra')
      tableDetails.push({
        name: tableName,
        status: changed ? 'different' : 'same',
        columns: tableColumns,
        indexes: tableIndexes
      })
    }

    for (const tableName of targetTables.keys()) {
      if (!baseTables.has(tableName)) {
        extraTables.push(tableName)
        tableDetails.push({ name: tableName, status: 'extra', columns: [], indexes: [] })
      }
    }

    const statements = []
    const warnings = []
    const targetRef = (tableName) => quoteTable(targetDatabase, tableName)

    for (const tableName of missingTables) {
      const [rows] = await baseConn.query(`SHOW CREATE TABLE ${quoteTable(baseDatabase, tableName)}`)
      const createSql = rows?.[0]?.['Create Table']
      if (!createSql) {
        warnings.push(t('无法读取表 {p0} 的建表语句', { p0: tableName }))
        continue
      }
      statements.push(createSql.replace(/^CREATE TABLE\s+`(?:[^`]|``)+`/, `CREATE TABLE ${targetRef(tableName)}`))
    }

    for (const item of missingColumns) {
      const column = baseTables.get(item.table).columns.get(item.column)
      statements.push(`ALTER TABLE ${targetRef(item.table)} ADD COLUMN ${columnToDefinition(column)}`)
    }

    for (const item of changedColumns) {
      const column = baseTables.get(item.table).columns.get(item.column)
      statements.push(`ALTER TABLE ${targetRef(item.table)} MODIFY COLUMN ${columnToDefinition(column)}`)
    }

    for (const item of missingIndexes) {
      const index = baseTables.get(item.table).indexes.get(item.index)
      if (item.index === 'PRIMARY') {
        statements.push(
          `ALTER TABLE ${targetRef(item.table)} ADD PRIMARY KEY (${index.columns
            .map((column) => quoteIdentifier(column))
            .join(', ')})`
        )
        continue
      }
      statements.push(
        `ALTER TABLE ${targetRef(item.table)} ADD ${index.unique ? 'UNIQUE ' : ''}KEY ${quoteIdentifier(
          item.index
        )} (${index.columns.map((column) => quoteIdentifier(column)).join(', ')})`
      )
    }

    for (const item of changedIndexes) {
      const index = baseTables.get(item.table).indexes.get(item.index)
      if (item.index === 'PRIMARY') {
        warnings.push(t('表 {p0} 的主键定义不同，请手动处理', { p0: item.table }))
        continue
      }
      statements.push(
        `ALTER TABLE ${targetRef(item.table)} DROP INDEX ${quoteIdentifier(item.index)},
  ADD ${index.unique ? 'UNIQUE ' : ''}KEY ${quoteIdentifier(item.index)} (${index.columns
    .map((column) => quoteIdentifier(column))
    .join(', ')})`
      )
    }

    if (extraTables.length) {
      warnings.push(t('目标库多出 {p0} 张表，未生成删除语句', { p0: extraTables.length }))
    }
    if (extraColumns.length) {
      warnings.push(t('目标库多出 {p0} 个字段，未生成删除语句', { p0: extraColumns.length }))
    }
    if (extraIndexes.length) {
      warnings.push(t('目标库多出 {p0} 个索引，未生成删除语句', { p0: extraIndexes.length }))
    }

    const summary = {
      baseTables: baseTables.size,
      targetTables: targetTables.size,
      missingTables: missingTables.length,
      extraTables: extraTables.length,
      changedTables: tableDetails.filter((table) => table.status === 'different').length,
      missingColumns: missingColumns.length,
      extraColumns: extraColumns.length,
      changedColumns: changedColumns.length,
      missingIndexes: missingIndexes.length,
      extraIndexes: extraIndexes.length,
      changedIndexes: changedIndexes.length
    }

    return {
      success: true,
      summary,
      tables: tableDetails,
      statements,
      warnings,
      base: { connection: name, database: baseDatabase },
      target: { connection: targetName, database: targetDatabase }
    }
  } catch (error) {
    log.error('结构对比失败:', error)
    return toErrorResult(error, t('结构对比失败'))
  } finally {
    baseConn?.release()
    targetConn?.release()
  }
}

export async function queryObjects(name, database, keyword = '') {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const pattern = `%${escapeLikePattern(keyword)}%`
    const hasKeyword = Boolean(keyword)

    const [tables] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_TYPE AS type, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? ${hasKeyword ? 'AND TABLE_NAME LIKE ?' : ''}
       ORDER BY TABLE_NAME LIMIT 300`,
      hasKeyword ? [database, pattern] : [database]
    )

    const [columns] = await conn.query(
      `SELECT COLUMN_NAME AS name, TABLE_NAME AS tableName, COLUMN_TYPE AS columnType
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? ${hasKeyword ? 'AND (COLUMN_NAME LIKE ? OR TABLE_NAME LIKE ?)' : ''}
       ORDER BY TABLE_NAME, ORDINAL_POSITION LIMIT 300`,
      hasKeyword ? [database, pattern, pattern] : [database]
    )

    const [routines] = await conn.query(
      `SELECT ROUTINE_NAME AS name, ROUTINE_TYPE AS type
       FROM information_schema.ROUTINES
       WHERE ROUTINE_SCHEMA = ? ${hasKeyword ? 'AND ROUTINE_NAME LIKE ?' : ''}
       ORDER BY ROUTINE_TYPE, ROUTINE_NAME LIMIT 200`,
      hasKeyword ? [database, pattern] : [database]
    )

    const [triggers] = await conn.query(
      `SELECT TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS tableName, ACTION_TIMING AS timing,
              EVENT_MANIPULATION AS event
       FROM information_schema.TRIGGERS
       WHERE EVENT_OBJECT_SCHEMA = ? ${hasKeyword ? 'AND (TRIGGER_NAME LIKE ? OR EVENT_OBJECT_TABLE LIKE ?)' : ''}
       ORDER BY TRIGGER_NAME LIMIT 200`,
      hasKeyword ? [database, pattern, pattern] : [database]
    )

    const [events] = await conn.query(
      `SELECT EVENT_NAME AS name, STATUS AS status
       FROM information_schema.EVENTS
       WHERE EVENT_SCHEMA = ? ${hasKeyword ? 'AND EVENT_NAME LIKE ?' : ''}
       ORDER BY EVENT_NAME LIMIT 200`,
      hasKeyword ? [database, pattern] : [database]
    )

    const items = []

    for (const row of tables) {
      items.push({
        type: row.type === 'VIEW' ? 'view' : 'table',
        name: row.name,
        detail: row.comment || (row.type === 'VIEW' ? t('视图') : t('表'))
      })
    }

    for (const row of columns) {
      items.push({
        type: 'column',
        name: row.name,
        table: row.tableName,
        detail: `${row.tableName} · ${row.columnType}`
      })
    }

    for (const row of routines) {
      items.push({
        type: row.type === 'FUNCTION' ? 'function' : 'procedure',
        name: row.name,
        detail: row.type === 'FUNCTION' ? t('函数') : t('存储过程')
      })
    }

    for (const row of triggers) {
      items.push({
        type: 'trigger',
        name: row.name,
        table: row.tableName,
        detail: `${row.tableName} · ${row.timing} ${row.event}`
      })
    }

    for (const row of events) {
      items.push({
        type: 'event',
        name: row.name,
        detail: row.status || t('事件')
      })
    }

    return { success: true, items }
  } catch (error) {
    log.error('搜索数据库对象失败:', error)
    return toErrorResult(error, t('搜索数据库对象失败'))
  } finally {
    conn?.release()
  }
}

const OBJECT_DDL_STATEMENTS = {
  view: 'SHOW CREATE VIEW',
  function: 'SHOW CREATE FUNCTION',
  procedure: 'SHOW CREATE PROCEDURE',
  trigger: 'SHOW CREATE TRIGGER',
  event: 'SHOW CREATE EVENT'
}

export async function getObjectDefinition(name, database, type, objectName) {
  let conn = null
  try {
    const statement = OBJECT_DDL_STATEMENTS[type]
    if (!statement) {
      return { success: false, error: t('不支持的对象类型') }
    }

    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query(`${statement} ${quoteTable(database, objectName)}`)
    const row = rows[0] || {}
    const definition = Object.entries(row).find(
      ([key]) => key.startsWith('Create ') || key === 'SQL Original Statement'
    )

    return {
      success: true,
      type,
      name: objectName,
      ddl: definition ? definition[1] : ''
    }
  } catch (error) {
    log.error('获取对象定义失败:', error)
    return toErrorResult(error, t('获取对象定义失败'))
  } finally {
    conn?.release()
  }
}

export async function queryUsers(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [sessionRows] = await conn.query('SELECT CURRENT_USER() AS currentUser, USER() AS sessionUser')
    const session = sessionRows[0] || {}

    let users = []
    let source = 'mysql.user'
    try {
      const [rows] = await conn.query('SELECT User AS user, Host AS host FROM mysql.user ORDER BY User, Host')
      users = rows.map((row) => ({ user: row.user, host: row.host }))
    } catch {
      // 无 mysql.user 读取权限时回退到 information_schema
      const [rows] = await conn.query(
        'SELECT DISTINCT GRANTEE AS grantee FROM information_schema.USER_PRIVILEGES ORDER BY GRANTEE'
      )
      users = rows.map((row) => parseGrantee(row.grantee))
      source = 'information_schema'
    }

    return {
      success: true,
      currentUser: session.currentUser || '',
      sessionUser: session.sessionUser || '',
      users,
      source
    }
  } catch (error) {
    log.error('查询数据库用户失败:', error)
    return toErrorResult(error, t('查询数据库用户失败'))
  } finally {
    conn?.release()
  }
}

function parseStatusCounters(rows = []) {
  const counters = {}
  for (const row of rows) {
    counters[row.Variable_name] = row.Value
  }
  return counters
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export async function queryServerStatus(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [identityRows] = await conn.query(
      'SELECT VERSION() AS version, CURRENT_USER() AS currentUser, @@max_connections AS maxConnections'
    )
    const identity = identityRows[0] || {}
    const [statusRows] = await conn.query('SHOW GLOBAL STATUS')
    const counters = parseStatusCounters(statusRows)
    const variableRows =
      (await optionalQuery(
        conn,
        `SHOW GLOBAL VARIABLES WHERE Variable_name IN
           ('slow_query_log', 'long_query_time', 'innodb_buffer_pool_size', 'performance_schema')`
      )) || []
    const variables = {}
    for (const row of variableRows) variables[row.Variable_name] = row.Value

    const uptime = toFiniteNumber(counters.Uptime)
    const questions = toFiniteNumber(counters.Questions)
    const readRequests = toFiniteNumber(counters.Innodb_buffer_pool_read_requests)
    const reads = toFiniteNumber(counters.Innodb_buffer_pool_reads)
    const hitRate = readRequests > 0 ? Math.max(0, Math.min(1, 1 - reads / readRequests)) : null

    return {
      success: true,
      sampledAt: Date.now(),
      version: String(identity.version || ''),
      currentUser: String(identity.currentUser || ''),
      uptimeSeconds: uptime,
      questions,
      qpsAvg: uptime > 0 ? questions / uptime : 0,
      threadsConnected: toFiniteNumber(counters.Threads_connected),
      threadsRunning: toFiniteNumber(counters.Threads_running),
      maxConnections: toFiniteNumber(identity.maxConnections),
      slowQueries: toFiniteNumber(counters.Slow_queries),
      abortedConnects: toFiniteNumber(counters.Aborted_connects),
      slowQueryLog: variables.slow_query_log === 'ON',
      longQueryTime: toFiniteNumber(variables.long_query_time),
      performanceSchema: variables.performance_schema === 'ON',
      bufferPool: {
        sizeMb: Math.round(toFiniteNumber(variables.innodb_buffer_pool_size) / 1048576),
        pagesTotal: toFiniteNumber(counters.Innodb_buffer_pool_pages_total),
        pagesFree: toFiniteNumber(counters.Innodb_buffer_pool_pages_free),
        readRequests,
        reads,
        hitRate
      }
    }
  } catch (error) {
    log.error('读取实例状态失败:', error)
    return toErrorResult(error, t('读取实例状态失败'))
  } finally {
    conn?.release()
  }
}

export async function querySlowQueries(name, database = '', limit = 10) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [enabledRows] = await conn.query('SELECT @@performance_schema AS enabled')
    if (!Number(enabledRows[0]?.enabled)) {
      return { success: true, enabled: false, reason: t('performance_schema 未启用'), queries: [] }
    }

    const max = Math.min(50, Math.max(1, Number(limit) || 10))
    const params = []
    let where = 'DIGEST_TEXT IS NOT NULL'
    if (database) {
      where += ' AND SCHEMA_NAME = ?'
      params.push(database)
    }

    const [rows] = await conn.query(
      `SELECT DIGEST_TEXT AS \`sql\`, COUNT_STAR AS executions,
              ROUND(AVG_TIMER_WAIT / 1000000000, 2) AS avgMs,
              ROUND(MAX_TIMER_WAIT / 1000000000, 2) AS maxMs,
              ROUND(SUM_TIMER_WAIT / 1000000000, 2) AS totalMs,
              SUM_ROWS_EXAMINED AS rowsExamined, SUM_ROWS_SENT AS rowsSent
       FROM performance_schema.events_statements_summary_by_digest
       WHERE ${where}
       ORDER BY SUM_TIMER_WAIT DESC
       LIMIT ${max}`,
      params
    )

    return {
      success: true,
      enabled: true,
      queries: rows.map((row) => ({
        sql: String(row.sql || ''),
        executions: toFiniteNumber(row.executions),
        avgMs: toFiniteNumber(row.avgMs),
        maxMs: toFiniteNumber(row.maxMs),
        totalMs: toFiniteNumber(row.totalMs),
        rowsExamined: toFiniteNumber(row.rowsExamined),
        rowsSent: toFiniteNumber(row.rowsSent)
      }))
    }
  } catch (error) {
    return {
      success: true,
      enabled: false,
      reason: error.message || t('无法读取 performance_schema'),
      queries: []
    }
  } finally {
    conn?.release()
  }
}

const MB = 1024 * 1024

function formatBytesForMessage(bytes) {
  const value = Number(bytes) || 0
  if (value >= 1024 * MB) return `${(value / (1024 * MB)).toFixed(2)} GB`
  if (value >= MB) return `${(value / MB).toFixed(2)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${Math.round(value)} B`
}

export async function queryDatabaseHealth(name, database) {
  let conn = null
  try {
    const entry = getEntry(name)
    const dbName = String(database || '').trim()
    if (!dbName) throw new Error(t('请选择要检查的数据库'))
    conn = await entry.pool.getConnection()

    const [tableRows] = await conn.query(
      `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_ROWS AS rowEstimate,
              DATA_LENGTH AS dataLength, INDEX_LENGTH AS indexLength, DATA_FREE AS dataFree,
              AVG_ROW_LENGTH AS avgRowLength, TABLE_COLLATION AS collation, TABLE_COMMENT AS comment,
              UPDATE_TIME AS updateTime
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY (IFNULL(DATA_LENGTH, 0) + IFNULL(INDEX_LENGTH, 0)) DESC`,
      [dbName]
    )
    const [primaryRows] = await conn.query(
      `SELECT DISTINCT TABLE_NAME AS name FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND INDEX_NAME = 'PRIMARY'`,
      [dbName]
    )
    const [indexRows] = await conn.query(
      `SELECT TABLE_NAME AS name, COUNT(DISTINCT INDEX_NAME) AS indexCount
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? GROUP BY TABLE_NAME`,
      [dbName]
    )
    const [viewRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW'`,
      [dbName]
    )
    const [identityRows] = await conn.query(
      'SELECT VERSION() AS version, CURRENT_USER() AS currentUser, @@max_connections AS maxConnections'
    )
    const identity = identityRows[0] || {}
    const variableRows =
      (await optionalQuery(
        conn,
        `SHOW GLOBAL VARIABLES WHERE Variable_name IN
           ('log_bin', 'slow_query_log', 'long_query_time', 'innodb_buffer_pool_size',
            'innodb_file_per_table', 'performance_schema')`
      )) || []
    const variables = {}
    for (const row of variableRows) variables[row.Variable_name] = row.Value
    const statusRows =
      (await optionalQuery(conn, `SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Uptime')`)) || []
    const counters = parseStatusCounters(statusRows)

    const primarySet = new Set(primaryRows.map((row) => row.name))
    const indexMap = new Map(indexRows.map((row) => [row.name, toFiniteNumber(row.indexCount)]))

    const tables = tableRows.map((row) => {
      const dataLength = toFiniteNumber(row.dataLength)
      const indexLength = toFiniteNumber(row.indexLength)
      const dataFree = toFiniteNumber(row.dataFree)
      const totalLength = dataLength + indexLength
      const indexCount = indexMap.get(row.name) || 0
      return {
        name: String(row.name || ''),
        engine: String(row.engine || ''),
        rowEstimate: toFiniteNumber(row.rowEstimate),
        dataLength,
        indexLength,
        totalLength,
        dataFree,
        freeRatio: dataLength > 0 ? Math.min(1, dataFree / dataLength) : 0,
        hasPrimaryKey: primarySet.has(row.name),
        indexCount,
        collation: String(row.collation || ''),
        comment: String(row.comment || ''),
        updateTime: row.updateTime || null
      }
    })

    const totals = tables.reduce(
      (acc, table) => {
        acc.dataLength += table.dataLength
        acc.indexLength += table.indexLength
        acc.dataFree += table.dataFree
        acc.rowEstimate += table.rowEstimate
        return acc
      },
      { dataLength: 0, indexLength: 0, dataFree: 0, rowEstimate: 0 }
    )

    const issues = []
    for (const table of tables) {
      if (!table.hasPrimaryKey) {
        issues.push({
          level: 'warn',
          scope: 'table',
          table: table.name,
          title: t('缺少主键'),
          detail: t('无主键会影响主从复制与行级更新效率，建议补充自增或唯一主键')
        })
      }
      if (table.engine && table.engine.toLowerCase() !== 'innodb') {
        issues.push({
          level: 'warn',
          scope: 'table',
          table: table.name,
          title: t('非 InnoDB 引擎（{p0}）', { p0: table.engine }),
          detail: t('MyISAM 等引擎不支持事务与崩溃恢复，建议转换为 InnoDB')
        })
      }
      if (!table.indexCount) {
        issues.push({
          level: 'info',
          scope: 'table',
          table: table.name,
          title: t('没有任何索引'),
          detail: t('按条件查询只能全表扫描，建议为常用过滤字段建立索引')
        })
      }
      if (table.dataFree > MB && table.freeRatio >= 0.2) {
        issues.push({
          level: 'info',
          scope: 'table',
          table: table.name,
          title: t('存在可回收空间'),
          detail: t('空闲 {p0}（占数据量 {p1}%），可执行 OPTIMIZE TABLE 回收', {
            p0: formatBytesForMessage(table.dataFree),
            p1: Math.round(table.freeRatio * 100)
          })
        })
      }
    }

    const bufferPoolBytes = toFiniteNumber(variables.innodb_buffer_pool_size)
    const bufferPoolMb = Math.round(bufferPoolBytes / MB)
    const threadsConnected = toFiniteNumber(counters.Threads_connected)
    const maxConnections = toFiniteNumber(identity.maxConnections)
    const connectionUsage = maxConnections > 0 ? Math.min(1, threadsConnected / maxConnections) : 0
    const slowQueryOn = variables.slow_query_log === 'ON'
    const binlogOn = variables.log_bin === 'ON'
    const filePerTableOn = variables.innodb_file_per_table === 'ON'

    if (!binlogOn) {
      issues.push({
        level: 'info',
        scope: 'server',
        title: t('binlog 未开启'),
        detail: t('无法进行时间点恢复与主从复制，若需要请开启 log_bin')
      })
    }
    if (!slowQueryOn) {
      issues.push({
        level: 'info',
        scope: 'server',
        title: t('慢查询日志未开启'),
        detail: t('开启 slow_query_log 后可配合慢查询面板定位性能问题')
      })
    }
    if (!filePerTableOn) {
      issues.push({
        level: 'warn',
        scope: 'server',
        title: t('innodb_file_per_table 已关闭'),
        detail: t('独立表空间关闭后，单表删除或整理无法释放磁盘空间')
      })
    }
    if (bufferPoolBytes > 0 && totals.dataLength > bufferPoolBytes * 2) {
      issues.push({
        level: 'info',
        scope: 'server',
        title: t('缓冲池小于数据量'),
        detail: t('InnoDB 缓冲池 {p0}，数据量 {p1}，热点数据可能频繁读盘', {
          p0: formatBytesForMessage(bufferPoolBytes),
          p1: formatBytesForMessage(totals.dataLength)
        })
      })
    }
    if (connectionUsage >= 0.8) {
      issues.push({
        level: 'warn',
        scope: 'server',
        title: t('连接数接近上限'),
        detail: t('当前 {p0} / {p1}（{p2}%），建议检查连接释放或调大 max_connections', {
          p0: threadsConnected,
          p1: maxConnections,
          p2: Math.round(connectionUsage * 100)
        })
      })
    }

    const levelWeight = { warn: 0, info: 1 }
    issues.sort((left, right) => (levelWeight[left.level] ?? 9) - (levelWeight[right.level] ?? 9))

    return {
      success: true,
      sampledAt: Date.now(),
      database: dbName,
      version: String(identity.version || ''),
      currentUser: String(identity.currentUser || ''),
      uptimeSeconds: toFiniteNumber(counters.Uptime),
      totals: {
        tableCount: tables.length,
        viewCount: toFiniteNumber(viewRows[0]?.total),
        dataLength: totals.dataLength,
        indexLength: totals.indexLength,
        totalLength: totals.dataLength + totals.indexLength,
        dataFree: totals.dataFree,
        rowEstimate: totals.rowEstimate
      },
      tables: tables.slice(0, 50),
      issues,
      server: {
        binlog: binlogOn,
        slowQueryLog: slowQueryOn,
        longQueryTime: toFiniteNumber(variables.long_query_time),
        bufferPoolMb,
        filePerTable: filePerTableOn,
        performanceSchema: variables.performance_schema === 'ON',
        threadsConnected,
        maxConnections,
        connectionUsage
      }
    }
  } catch (error) {
    log.error('数据库健康检查失败:', error)
    return toErrorResult(error, t('数据库健康检查失败'))
  } finally {
    conn?.release()
  }
}

const USER_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'DROP',
  'ALTER',
  'INDEX',
  'CREATE VIEW',
  'SHOW VIEW',
  'TRIGGER',
  'EXECUTE',
  'REFERENCES',
  'CREATE ROUTINE',
  'ALTER ROUTINE'
]

const ACCOUNT_PART_PATTERN = /^[A-Za-z0-9_.%-]+$/

function escapeSqlLiteral(value) {
  return `'${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")}'`
}

function normalizeAccount(user, host) {
  const userName = String(user || '').trim()
  const hostName = String(host || '').trim() || '%'
  if (!userName) throw new Error(t('用户名不能为空'))
  if (!ACCOUNT_PART_PATTERN.test(userName)) throw new Error(t('用户名包含不支持的字符'))
  if (!ACCOUNT_PART_PATTERN.test(hostName)) throw new Error(t('主机名包含不支持的字符'))
  return { user: userName, host: hostName, quoted: `${escapeSqlLiteral(userName)}@${escapeSqlLiteral(hostName)}` }
}

function normalizeUserPrivileges(list) {
  const privileges = []
  for (const item of Array.isArray(list) ? list : []) {
    const privilege = String(item || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
    if (!privilege) continue
    if (privilege === 'ALL PRIVILEGES') return ['ALL PRIVILEGES']
    if (!USER_PRIVILEGES.includes(privilege)) throw new Error(t('不支持的权限: {p0}', { p0: item }))
    if (!privileges.includes(privilege)) privileges.push(privilege)
  }
  if (!privileges.length) throw new Error(t('请至少选择一个权限'))
  return privileges
}

function buildPrivilegeScope(database, table) {
  const databaseName = String(database || '').trim()
  if (!databaseName || databaseName === '*') return '*.*'
  const tableName = String(table || '').trim() || '*'
  if (tableName === '*') return `${quoteIdentifier(databaseName)}.*`
  return `${quoteIdentifier(databaseName)}.${quoteIdentifier(tableName)}`
}

export async function getUserGrants(name, user, host) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query(`SHOW GRANTS FOR ${account.quoted}`)
    return {
      success: true,
      grants: rows.map((row) => String(Object.values(row)[0] || '')).filter(Boolean)
    }
  } catch (error) {
    log.error('读取用户权限失败:', error)
    return toErrorResult(error, t('读取用户权限失败'))
  } finally {
    conn?.release()
  }
}

export async function createDatabaseUser(name, user, host, password) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    if (!String(password ?? '').length) throw new Error(t('密码不能为空'))
    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    await conn.query(`CREATE USER ${account.quoted} IDENTIFIED BY ${escapeSqlLiteral(password)}`)
    log.info(`已创建数据库用户: ${name}, ${account.quoted}`)
    const result = { success: true, message: t('用户已创建') }
    auditWrite(name, '', 'CREATE USER', `CREATE USER ${account.user}@${account.host}`, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('创建用户失败:', error)
    const result = toErrorResult(error, t('创建用户失败'))
    auditWrite(name, '', 'CREATE USER', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}

export async function dropDatabaseUser(name, user, host) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    const [identityRows] = await conn.query('SELECT CURRENT_USER() AS currentUser')
    if (String(identityRows[0]?.currentUser || '') === `${account.user}@${account.host}`) {
      throw new Error(t('不能删除当前登录用户'))
    }
    await conn.query(`DROP USER ${account.quoted}`)
    log.info(`已删除数据库用户: ${name}, ${account.quoted}`)
    const result = { success: true, message: t('用户已删除') }
    auditWrite(name, '', 'DROP USER', `DROP USER ${account.user}@${account.host}`, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('删除用户失败:', error)
    const result = toErrorResult(error, t('删除用户失败'))
    auditWrite(name, '', 'DROP USER', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}

export async function setDatabaseUserPassword(name, user, host, password) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    if (!String(password ?? '').length) throw new Error(t('密码不能为空'))
    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    await conn.query(`ALTER USER ${account.quoted} IDENTIFIED BY ${escapeSqlLiteral(password)}`)
    log.info(`已修改用户密码: ${name}, ${account.quoted}`)
    const result = { success: true, message: t('密码已更新') }
    auditWrite(name, '', 'ALTER USER', `ALTER USER ${account.user}@${account.host}`, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('修改用户密码失败:', error)
    const result = toErrorResult(error, t('修改用户密码失败'))
    auditWrite(name, '', 'ALTER USER', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}

export async function setDatabaseUserPrivileges(name, action, user, host, privileges, database, table) {
  let conn = null
  try {
    const account = normalizeAccount(user, host)
    if (action !== 'grant' && action !== 'revoke') {
      throw new Error(t('无效的权限操作'))
    }
    const privilegeList = normalizeUserPrivileges(privileges)
    const scope = buildPrivilegeScope(database, table)
    const keyword = action === 'grant' ? 'GRANT' : 'REVOKE'
    const target = action === 'grant' ? 'TO' : 'FROM'
    const entry = getEntry(name)
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    conn = await entry.pool.getConnection()
    await conn.query(`${keyword} ${privilegeList.join(', ')} ON ${scope} ${target} ${account.quoted}`)
    log.info(`已${action === 'grant' ? '授予' : '撤销'}用户权限: ${name}, ${account.quoted}, ${scope}`)
    const result = {
      success: true,
      message: action === 'grant' ? t('权限已授予') : t('权限已撤销')
    }
    const summary = `${keyword} ${privilegeList.join(', ')} ON ${scope} ${target} ${account.user}@${account.host}`
    auditWrite(name, database || '', keyword, summary, result, { source: 'user' })
    return result
  } catch (error) {
    log.error('更新用户权限失败:', error)
    const result = toErrorResult(error, t('更新用户权限失败'))
    auditWrite(name, database || '', action === 'grant' ? 'GRANT' : 'REVOKE', '', result, { source: 'user' })
    return result
  } finally {
    conn?.release()
  }
}

export async function getErData(name, database, limit = 200) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const tableLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 200, 1), 1000)
    const [tables] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME LIMIT ${tableLimit}`,
      [database]
    )

    const [columns] = await conn.query(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
              COLUMN_KEY AS columnKey, IS_NULLABLE AS nullable, COLUMN_COMMENT AS comment
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [database]
    )

    const [foreignKeys] = await conn.query(
      `SELECT CONSTRAINT_NAME AS name, TABLE_NAME AS tableName, COLUMN_NAME AS columnName,
              REFERENCED_TABLE_NAME AS refTable, REFERENCED_COLUMN_NAME AS refColumn
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`,
      [database]
    )

    const columnMap = new Map()
    for (const column of columns) {
      if (!columnMap.has(column.tableName)) {
        columnMap.set(column.tableName, [])
      }
      columnMap.get(column.tableName).push(column)
    }

    return {
      success: true,
      tables: tables.map((table) => ({
        name: table.name,
        comment: table.comment,
        columns: columnMap.get(table.name) || []
      })),
      foreignKeys
    }
  } catch (error) {
    log.error('读取 ER 数据失败:', error)
    return toErrorResult(error, t('读取 ER 数据失败'))
  } finally {
    conn?.release()
  }
}

export async function explainQuery(name, database, sql) {
  let conn = null
  try {
    const trimmed = String(sql || '')
      .trim()
      .replace(/;\s*$/, '')
    if (!/^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH)\b/i.test(trimmed)) {
      throw new Error(t('仅支持对 SELECT/INSERT/UPDATE/DELETE 语句查看执行计划'))
    }

    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    if (database) {
      await conn.query(`USE ${quoteIdentifier(database)}`)
    }

    const [rows] = await conn.query(`EXPLAIN ${trimmed}`)

    let json = null
    try {
      const [jsonRows] = await conn.query(`EXPLAIN FORMAT=JSON ${trimmed}`)
      const raw = jsonRows[0]?.EXPLAIN
      if (raw) {
        json = typeof raw === 'string' ? JSON.parse(raw) : raw
      }
    } catch {
      // JSON 计划在旧版本可能不可用，忽略
    }

    return { success: true, rows, json }
  } catch (error) {
    log.error('获取执行计划失败:', error)
    return toErrorResult(error, t('获取执行计划失败'))
  } finally {
    conn?.release()
  }
}

function formatCsvCell(value) {
  if (value === null || value === undefined) return ''
  const text = value instanceof Date ? value.toISOString() : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function formatMarkdownCell(value) {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function formatSqlValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return mysql.escape(value)
}

export async function exportTableData(name, database, tableName, options = {}) {
  let conn = null
  try {
    const format = String(options.format || 'csv').toLowerCase()
    const maxRows = Math.max(1, Number(options.maxRows) || DEFAULT_EXPORT_ROWS)
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const columns = await loadColumns(conn, database, tableName)
    if (!columns.length) {
      throw new Error(t('表不存在或没有可导出的字段'))
    }
    const primaryKeys = await loadPrimaryKeys(conn, database, tableName)
    const orderSql = primaryKeys.length ? ` ORDER BY ${primaryKeys.map((key) => quoteIdentifier(key)).join(', ')}` : ''

    const rows = []
    let offset = 0
    let truncated = false

    while (rows.length < maxRows) {
      const batchSize = Math.min(EXPORT_BATCH_SIZE, maxRows - rows.length)
      const [batch] = await conn.query(
        `SELECT * FROM ${quoteTable(database, tableName)}${orderSql} LIMIT ${batchSize} OFFSET ${offset}`
      )
      rows.push(...batch)
      if (batch.length < batchSize) break
      offset += batchSize
      if (rows.length >= maxRows) {
        truncated = true
        break
      }
    }

    const columnNames = columns.map((column) => column.name)
    let content = ''

    if (format === 'json') {
      content = JSON.stringify(rows, null, 2)
    } else if (format === 'sql') {
      const lines = []
      if (options.includeStructure) {
        const [ddlRows] = await conn.query(`SHOW CREATE TABLE ${quoteTable(database, tableName)}`)
        const ddl = ddlRows[0]?.['Create Table']
        if (ddl) {
          lines.push(`DROP TABLE IF EXISTS ${quoteTable(database, tableName)};`)
          lines.push(`${ddl};`)
          lines.push('')
        }
      }
      for (const row of rows) {
        lines.push(
          `INSERT INTO ${quoteTable(database, tableName)} (${columnNames
            .map((column) => quoteIdentifier(column))
            .join(', ')}) VALUES (${columnNames.map((column) => formatSqlValue(row[column])).join(', ')});`
        )
      }
      content = lines.join('\n')
    } else if (format === 'markdown') {
      const lines = [
        `| ${columnNames.map((column) => formatMarkdownCell(column)).join(' | ')} |`,
        `| ${columnNames.map(() => '---').join(' | ')} |`
      ]
      for (const row of rows) {
        lines.push(`| ${columnNames.map((column) => formatMarkdownCell(row[column])).join(' | ')} |`)
      }
      content = lines.join('\n')
    } else {
      const lines = [columnNames.map((column) => formatCsvCell(column)).join(',')]
      for (const row of rows) {
        lines.push(columnNames.map((column) => formatCsvCell(row[column])).join(','))
      }
      content = lines.join('\n')
    }

    return { success: true, content, rowCount: rows.length, truncated }
  } catch (error) {
    log.error('导出表数据失败:', error)
    return toErrorResult(error, t('导出表数据失败'))
  } finally {
    conn?.release()
  }
}

async function loadBackupRows(conn, database, tableName, maxRows) {
  const primaryKeys = await loadPrimaryKeys(conn, database, tableName)
  const orderSql = primaryKeys.length ? ` ORDER BY ${primaryKeys.map((key) => quoteIdentifier(key)).join(', ')}` : ''
  const rows = []
  let offset = 0
  let truncated = false

  while (rows.length < maxRows) {
    const batchSize = Math.min(EXPORT_BATCH_SIZE, maxRows - rows.length)
    const [batch] = await conn.query(
      `SELECT * FROM ${quoteTable(database, tableName)}${orderSql} LIMIT ${batchSize} OFFSET ${offset}`
    )
    rows.push(...batch)
    if (batch.length < batchSize) break
    offset += batchSize
    if (rows.length >= maxRows) {
      truncated = true
      break
    }
  }

  return { rows, truncated }
}

export async function exportDatabaseData(name, database, options = {}) {
  let conn = null
  try {
    const format = String(options.format || 'sql').toLowerCase()
    const maxRows = Math.max(1, Number(options.maxRows) || DEFAULT_EXPORT_ROWS)
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [tableRows] = await conn.query(
      `SELECT TABLE_NAME AS name FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [database]
    )
    const tables = tableRows.map((row) => row.name)
    if (!tables.length) throw new Error(t('数据库中没有可备份的表'))

    let rowCount = 0
    let truncated = false
    const nextRowCount = (result) => {
      rowCount += result.rows.length
      truncated = truncated || result.truncated
    }

    if (format === 'json') {
      const data = { database, exportedAt: new Date().toISOString(), tables: {} }
      for (const table of tables) {
        const result = await loadBackupRows(conn, database, table, maxRows)
        nextRowCount(result)
        data.tables[table] = result.rows
      }
      return { success: true, content: JSON.stringify(data, null, 2), rowCount, truncated, tableCount: tables.length }
    }

    if (format === 'sql') {
      const lines = ['SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS=0;', '']
      for (const table of tables) {
        const [ddlRows] = await conn.query(`SHOW CREATE TABLE ${quoteTable(database, table)}`)
        const ddl = ddlRows[0]?.['Create Table']
        lines.push(`DROP TABLE IF EXISTS ${quoteTable(database, table)};`)
        if (ddl) lines.push(`${ddl};`)
        const result = await loadBackupRows(conn, database, table, maxRows)
        const columnNames = result.rows.length ? Object.keys(result.rows[0]) : []
        for (const row of result.rows) {
          lines.push(
            `INSERT INTO ${quoteTable(database, table)} (${columnNames
              .map((column) => quoteIdentifier(column))
              .join(', ')}) VALUES (${columnNames.map((column) => formatSqlValue(row[column])).join(', ')});`
          )
        }
        nextRowCount(result)
        lines.push('')
      }
      lines.push('SET FOREIGN_KEY_CHECKS=1;')
      return { success: true, content: lines.join('\n'), rowCount, truncated, tableCount: tables.length }
    }

    const files = []
    for (const table of tables) {
      const columns = await loadColumns(conn, database, table)
      const columnNames = columns.map((column) => column.name)
      const result = await loadBackupRows(conn, database, table, maxRows)
      nextRowCount(result)
      const lines = [columnNames.map((column) => formatCsvCell(column)).join(',')]
      for (const row of result.rows) {
        lines.push(columnNames.map((column) => formatCsvCell(row[column])).join(','))
      }
      files.push({ name: table, content: lines.join('\n') })
    }
    return { success: true, files, rowCount, truncated, tableCount: tables.length }
  } catch (error) {
    log.error('导出数据库失败:', error)
    return toErrorResult(error, t('导出数据库失败'))
  } finally {
    conn?.release()
  }
}

export function getActiveConnections() {
  return Array.from(connections.keys())
}

export function isConnectionActive(name) {
  return connections.has(name)
}

export async function beginTransaction(name, database) {
  try {
    if (transactions.has(name)) {
      return { success: false, error: t('当前连接已在事务中') }
    }

    const entry = getEntry(name)
    const conn = await entry.pool.getConnection()
    try {
      if (database) {
        await conn.query(`USE ${quoteIdentifier(database)}`)
      }
      await conn.beginTransaction()
    } catch (error) {
      conn.release()
      throw error
    }

    transactions.set(name, { conn, database: database || '' })

    return { success: true, message: t('事务已开始') }
  } catch (error) {
    log.error('开始事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function commitTransaction(name) {
  try {
    const tx = transactions.get(name)
    if (!tx) {
      return { success: false, error: t('当前连接没有进行中的事务') }
    }

    await tx.conn.commit()
    await releaseTransaction(name)

    return { success: true, message: t('事务已提交') }
  } catch (error) {
    log.error('提交事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function rollbackTransaction(name) {
  try {
    const tx = transactions.get(name)
    if (!tx) {
      return { success: false, error: t('当前连接没有进行中的事务') }
    }

    await tx.conn.rollback()
    await releaseTransaction(name)

    return { success: true, message: t('事务已回滚') }
  } catch (error) {
    log.error('回滚事务失败:', error)
    return { success: false, error: error.message }
  }
}

export function isTransactionActive(name) {
  return transactions.has(name)
}
