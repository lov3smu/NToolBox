import mysql from 'mysql2/promise'
import { log } from '../../utils'
import { t } from '../i18n.js'
import { getEntry } from './state.js'
import { capabilityError, engineOf } from './engines/index.js'
import {
  applyEngineTableChanges,
  getEngineCellValue,
  getEngineTableData,
  insertEngineRows
} from './engines/tableData.js'
import {
  TABLE_PAGE_SIZE_LIMIT,
  APPROXIMATE_ROW_THRESHOLD,
  quoteIdentifier,
  quoteTable,
  loadColumns,
  loadPrimaryKeys,
  runQuery,
  buildWhereClause,
  buildOrderBy,
  toErrorResult,
  auditWrite,
  assertColumnName,
  READONLY_BLOCK_MESSAGE
} from './helpers.js'

const TABLE_COUNT_CACHE_TTL = 15000
const tableCountCache = new Map()
const LAZY_BINARY_TYPE_PATTERN =
  /^(tiny|medium|long)?blob$|^binary$|^varbinary$|^(multi)?(point|polygon|linestring)$|^geometry(collection)?$/i

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
    if (engineOf(entry) !== 'mysql') {
      return await getEngineTableData(entry, database, tableName, options)
    }
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
    if (engineOf(entry) !== 'mysql') {
      return await getEngineCellValue(entry, database, tableName, columnName, keys, options)
    }
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
    if (engineOf(entry) !== 'mysql') {
      return await insertEngineRows(entry, database, tableName, rows, options)
    }
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
    if (engineOf(entry) !== 'mysql') {
      return await applyEngineTableChanges(entry, database, tableName, changes)
    }
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

export function buildColumnDefinition(column = {}) {
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
    if (engineOf(entry) !== 'mysql') return capabilityError()
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
    if (engineOf(entry) !== 'mysql') return capabilityError()
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
    if (engineOf(getEntry(name)) !== 'mysql') return capabilityError()
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
