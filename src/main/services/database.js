import mysql from 'mysql2/promise'
import { log } from '../utils'

const connections = new Map()
const transactions = new Map()
const runningQueries = new Map()

const DEFAULT_LIMIT = 1000
const MAX_LIMIT = 1000000
const EXPORT_BATCH_SIZE = 2000
const DEFAULT_EXPORT_ROWS = 100000

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
    throw new Error('连接不存在，请先创建连接')
  }
  return entry
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

  return poolConfig
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

function assertColumnName(value, label = '字段') {
  if (!value || typeof value !== 'string') {
    throw new Error(`${label}不能为空`)
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
  const field = assertColumnName(filter?.field, '筛选字段')
  if (!columnNames.has(field)) {
    throw new Error(`无效的筛选字段: ${field}`)
  }

  const operator = String(filter.operator || '=').toUpperCase()
  if (!FILTER_OPERATORS.includes(operator)) {
    throw new Error(`不支持的筛选运算符: ${filter.operator}`)
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
      throw new Error(`筛选字段 ${field} 的取值不能为空`)
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

function buildWhereClause(columns, options = {}) {
  const columnNames = new Set(columns.map((column) => column.name))
  const parts = []
  const params = []
  const logic = String(options.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND'

  for (const filter of options.filters || []) {
    const clause = buildFilterClause(filter, columnNames)
    parts.push(clause.sql)
    params.push(...clause.params)
  }

  const keyword = typeof options.search === 'string' ? options.search.trim() : ''
  if (keyword) {
    const searchColumns = Array.isArray(options.searchColumns)
      ? options.searchColumns.filter((name) => columnNames.has(name))
      : columns.map((column) => column.name)
    const effectiveColumns = searchColumns.length > 0 ? searchColumns : columns.map((column) => column.name)
    const pattern = `%${escapeLikePattern(keyword)}%`
    const searchParts = effectiveColumns.map((name) => `CAST(${quoteIdentifier(name)} AS CHAR) LIKE ?`)
    parts.push(`(${searchParts.join(' OR ')})`)
    params.push(...effectiveColumns.map(() => pattern))
  }

  return {
    whereSql: parts.length ? ` WHERE ${parts.join(` ${logic} `)}` : '',
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
  try {
    const connConfig = {
      host: config.host || 'localhost',
      port: Number(config.port) || 3306,
      user: config.user,
      password: config.password,
      dateStrings: true,
      connectTimeout: config.connectTimeout ? Number(config.connectTimeout) * 1000 : 10000
    }

    if (config.charset) {
      connConfig.charset = config.charset
    }

    connection = await mysql.createConnection(connConfig)
    await connection.ping()

    return { success: true, message: '连接成功' }
  } catch (error) {
    log.error('测试连接失败:', error)
    return {
      success: false,
      error: error.message || '连接失败',
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
  }
}

export async function createConnection(name, config) {
  try {
    if (connections.has(name)) {
      await closeConnection(name)
    }

    const pool = await mysql.createPool(buildPoolConfig(config))

    const entry = { pool, config: { ...config }, keepAliveTimer: null }

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
    return { success: true, message: '连接创建成功' }
  } catch (error) {
    log.error('创建连接失败:', error)
    return {
      success: false,
      error: error.message || '创建连接失败',
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
      return { success: false, error: '连接不存在' }
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

    log.info(`数据库连接已关闭: ${name}`)
    return { success: true, message: '连接已关闭' }
  } catch (error) {
    log.error('关闭连接失败:', error)
    return {
      success: false,
      error: error.message || '关闭连接失败'
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
  return { success: true, message: '所有连接已关闭' }
}

export async function executeQuery(name, sql, params = [], options = {}) {
  let conn = null
  let shouldRelease = false
  const requestId = options.requestId
  const startedAt = Date.now()

  try {
    const entry = getEntry(name)
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

    const [rows, fields] = await conn.query(finalSql, params)
    const duration = Date.now() - startedAt

    log.info(`执行查询成功: ${name}, 耗时: ${duration}ms`)

    return normalizeResult(rows, fields, duration)
  } catch (error) {
    if (error.code === 'ER_QUERY_INTERRUPTED') {
      log.warn(`查询已取消: ${name}`)
      return { success: false, canceled: true, error: '查询已取消' }
    }
    log.error('执行查询失败:', error)
    return toErrorResult(error, '执行查询失败')
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

    return {
      success: true,
      duration,
      statementCount: list.length,
      rows,
      fields: [],
      rowCount: rows.length,
      affectedRows,
      isSelect: rows.length > 0
    }
  } catch (error) {
    log.error('执行脚本失败:', error)
    return toErrorResult(error, '执行脚本失败')
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
      return { success: false, error: '查询已结束或不存在' }
    }

    const threadId = Number(item.threadId)
    if (!Number.isInteger(threadId) || threadId <= 0) {
      return { success: false, error: '无法获取查询线程' }
    }

    await entry.pool.query(`KILL QUERY ${threadId}`)
    log.info(`已请求取消查询: ${name}, thread: ${threadId}`)
    return { success: true, message: '已发送取消请求' }
  } catch (error) {
    log.error('取消查询失败:', error)
    return { success: false, error: error.message || '取消查询失败' }
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

export async function getTableData(name, database, tableName, options = {}) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const columns = await loadColumns(conn, database, tableName)
    if (!columns.length) {
      throw new Error('表不存在或没有可读取的字段')
    }

    const primaryKeys = await loadPrimaryKeys(conn, database, tableName)
    const page = Math.max(1, Number(options.page) || 1)
    const pageSize = Math.min(MAX_LIMIT, Math.max(1, Number(options.pageSize) || 100))
    const { whereSql, params } = buildWhereClause(columns, options)
    const orderSql = buildOrderBy(columns, options.sort)
    const tableRef = quoteTable(database, tableName)

    const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM ${tableRef}${whereSql}`, params)
    const total = Number(countRows[0]?.total || 0)
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const currentPage = Math.min(page, pageCount)
    const offset = (currentPage - 1) * pageSize

    const [rows] = await conn.query(
      `SELECT * FROM ${tableRef}${whereSql}${orderSql} LIMIT ${pageSize} OFFSET ${offset}`,
      params
    )

    const [tableInfoRows] = await conn.query(
      `SELECT TABLE_TYPE AS type, ENGINE AS engine, TABLE_ROWS AS rowCount,
              DATA_LENGTH AS dataLength, INDEX_LENGTH AS indexLength,
              TABLE_COLLATION AS collation, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, tableName]
    )

    return {
      success: true,
      rows,
      fields: columns.map((column) => ({ name: column.name, columnType: column.columnType })),
      columns,
      primaryKeys,
      total,
      page: currentPage,
      pageSize,
      pageCount,
      isView: tableInfoRows[0]?.type === 'VIEW',
      tableInfo: tableInfoRows[0] || null
    }
  } catch (error) {
    log.error('读取表数据失败:', error)
    return toErrorResult(error, '读取表数据失败')
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
    return toErrorResult(error, '读取表元数据失败')
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
    throw new Error('没有可写入的数据')
  }

  const placeholders = rows.map(() => `(${keys.map(() => '?').join(', ')})`).join(', ')
  const sql = `INSERT INTO ${quoteTable(database, tableName)} (${keys
    .map((key) => quoteIdentifier(key))
    .join(', ')}) VALUES ${placeholders}`
  const params = rows.flatMap((row) => keys.map((key) => (row[key] === undefined ? null : row[key])))

  return { sql, params, keys }
}

export async function insertRows(name, database, tableName, rows = []) {
  let conn = null
  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('没有可导入的数据')
    }

    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    const { sql, params } = buildInsertSql(database, tableName, rows, columns)
    const [result] = await conn.query(sql, params)

    return { success: true, inserted: result.affectedRows ?? rows.length, insertId: result.insertId }
  } catch (error) {
    log.error('插入数据失败:', error)
    return toErrorResult(error, '插入数据失败')
  } finally {
    conn?.release()
  }
}

function buildKeyClause(keys, columnNames) {
  const entries = Object.entries(keys || {})
  if (!entries.length) {
    throw new Error('缺少定位行的主键值')
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
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    if (!columns.length) {
      throw new Error('表不存在或没有可编辑的字段')
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

    log.info(`保存表数据: ${name}.${database}.${tableName}, 更新: ${updated}, 删除: ${deleted}, 新增: ${inserted}`)

    return { success: true, updated, deleted, inserted }
  } catch (error) {
    log.error('保存表数据失败:', error)
    return toErrorResult(error, '保存表数据失败')
  } finally {
    conn?.release()
  }
}

function assertColumnType(type) {
  const value = String(type || '').trim()
  if (!/^[A-Za-z0-9_]+(\s*\([0-9,\s]+\))?(\s+unsigned)?(\s+zerofill)?$/i.test(value)) {
    throw new Error(`字段类型不合法: ${type}`)
  }
  return value
}

function buildColumnDefinition(column = {}) {
  const name = assertColumnName(column.name, '字段名')
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

export async function alterTable(name, database, tableName, operations = {}) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()
    const columns = await loadColumns(conn, database, tableName)
    if (!columns.length) {
      throw new Error('表不存在')
    }
    const columnNames = new Set(columns.map((column) => column.name))
    const tableRef = quoteTable(database, tableName)
    const clauses = []

    for (const column of operations.addColumns || []) {
      let clause = `ADD COLUMN ${buildColumnDefinition(column)}`
      if (column.after && columnNames.has(column.after)) {
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

    for (const index of operations.addIndexes || []) {
      const indexColumns = (index.columns || []).filter((column) => columnNames.has(column))
      if (!indexColumns.length) {
        throw new Error('索引至少需要一个有效字段')
      }
      const indexName = index.name || `idx_${tableName}_${indexColumns.join('_')}`
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

    if (operations.renameTable) {
      clauses.push(`RENAME TO ${quoteTable(database, operations.renameTable)}`)
    }

    if (!clauses.length) {
      throw new Error('没有需要执行的结构变更')
    }

    await conn.query(`ALTER TABLE ${tableRef} ${clauses.join(', ')}`)
    log.info(`表结构变更完成: ${name}.${database}.${tableName}`)

    return { success: true, statements: clauses, renamedTo: operations.renameTable || '' }
  } catch (error) {
    log.error('表结构变更失败:', error)
    return toErrorResult(error, '表结构变更失败')
  } finally {
    conn?.release()
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
        detail: row.comment || (row.type === 'VIEW' ? '视图' : '表')
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
        detail: row.type === 'FUNCTION' ? '函数' : '存储过程'
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
        detail: row.status || '事件'
      })
    }

    return { success: true, items }
  } catch (error) {
    log.error('搜索数据库对象失败:', error)
    return toErrorResult(error, '搜索数据库对象失败')
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
      return { success: false, error: '不支持的对象类型' }
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
    return toErrorResult(error, '获取对象定义失败')
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
    return toErrorResult(error, '查询数据库用户失败')
  } finally {
    conn?.release()
  }
}

export async function getErData(name, database) {
  let conn = null
  try {
    const entry = getEntry(name)
    conn = await entry.pool.getConnection()

    const [tables] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME LIMIT 200`,
      [database]
    )

    const [columns] = await conn.query(
      `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name, COLUMN_TYPE AS columnType,
              COLUMN_KEY AS columnKey, IS_NULLABLE AS nullable
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
    return toErrorResult(error, '读取 ER 数据失败')
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
      throw new Error('仅支持对 SELECT/INSERT/UPDATE/DELETE 语句查看执行计划')
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
    return toErrorResult(error, '获取执行计划失败')
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
      throw new Error('表不存在或没有可导出的字段')
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
    return toErrorResult(error, '导出表数据失败')
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
      return { success: false, error: '当前连接已在事务中' }
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

    return { success: true, message: '事务已开始' }
  } catch (error) {
    log.error('开始事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function commitTransaction(name) {
  try {
    const tx = transactions.get(name)
    if (!tx) {
      return { success: false, error: '当前连接没有进行中的事务' }
    }

    await tx.conn.commit()
    await releaseTransaction(name)

    return { success: true, message: '事务已提交' }
  } catch (error) {
    log.error('提交事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function rollbackTransaction(name) {
  try {
    const tx = transactions.get(name)
    if (!tx) {
      return { success: false, error: '当前连接没有进行中的事务' }
    }

    await tx.conn.rollback()
    await releaseTransaction(name)

    return { success: true, message: '事务已回滚' }
  } catch (error) {
    log.error('回滚事务失败:', error)
    return { success: false, error: error.message }
  }
}

export function isTransactionActive(name) {
  return transactions.has(name)
}
