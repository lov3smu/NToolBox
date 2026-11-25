import { log } from '../../../utils'
import { t } from '../../i18n.js'
import { inlineSqlParameters } from '../../../../shared/sqlPlaceholders.js'
import {
  APPROXIMATE_ROW_THRESHOLD,
  READONLY_BLOCK_MESSAGE,
  TABLE_PAGE_SIZE_LIMIT,
  auditWrite,
  buildOrderBy,
  buildWhereClause,
  normalizeResult,
  toErrorResult
} from '../helpers.js'
import { engineOf, getDialect, openEngineSession, queryEngineSession, tableRefOf } from './index.js'
import { loadPostgresColumns, loadPostgresPrimaryKeys, queryPostgresTableInfoRow } from './postgres.js'
import { loadSqliteColumns, loadSqlitePrimaryKeys, querySqliteTableInfoRow } from './sqlite.js'

const TABLE_COUNT_CACHE_TTL = 15000
const tableCountCache = new Map()

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

function isLazyColumn(engine, column) {
  const type = String(column?.dataType || '').toLowerCase()
  if (engine === 'postgres') return type === 'bytea'
  if (engine === 'sqlite') return /blob/.test(type)
  return false
}

function lazyLengthExpression(engine, quotedColumn) {
  if (engine === 'postgres') return `octet_length(${quotedColumn})`
  return `length(${quotedColumn})`
}

function isViewInfo(tableInfo) {
  return String(tableInfo?.TABLE_TYPE || '').toUpperCase() === 'VIEW'
}

export async function loadEngineColumns(entry, database, tableName) {
  const engine = engineOf(entry)
  if (engine === 'postgres') return loadPostgresColumns(entry, database, tableName)
  return loadSqliteColumns(entry, database, tableName)
}

export async function loadEnginePrimaryKeys(entry, database, tableName) {
  const engine = engineOf(entry)
  if (engine === 'postgres') return loadPostgresPrimaryKeys(entry, database, tableName)
  return loadSqlitePrimaryKeys(entry, database, tableName)
}

async function loadEngineTableInfoRow(entry, database, tableName) {
  const engine = engineOf(entry)
  if (engine === 'postgres') return queryPostgresTableInfoRow(entry, database, tableName)
  return querySqliteTableInfoRow(entry, database, tableName)
}

export async function getEngineTableData(entry, database, tableName, options = {}) {
  const engine = engineOf(entry)
  const dialect = getDialect(engine)
  const name = entry.name
  const session = await openEngineSession(entry, database)

  try {
    const page = Math.max(1, Number(options.page) || 1)
    const pageSize = Math.min(TABLE_PAGE_SIZE_LIMIT, Math.max(1, Number(options.pageSize) || 100))

    const [columns, primaryKeys, tableInfo] = await Promise.all([
      loadEngineColumns(entry, database, tableName),
      loadEnginePrimaryKeys(entry, database, tableName),
      loadEngineTableInfoRow(entry, database, tableName)
    ])
    if (!columns.length) {
      throw new Error(t('表不存在或没有可读取的字段'))
    }

    const { whereSql, params } = buildWhereClause(columns, options, dialect)
    const orderSql = buildOrderBy(columns, options.sort, dialect)
    const tableRef = tableRefOf(entry, database, tableName)
    const lazyColumns = columns.filter((column) => isLazyColumn(engine, column)).map((column) => column.name)
    const lazyColumnSet = new Set(lazyColumns)
    const selectList = columns
      .map((column) => {
        const quoted = dialect.quote(column.name)
        return lazyColumnSet.has(column.name) ? `${lazyLengthExpression(engine, quoted)} AS ${quoted}` : quoted
      })
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
      const approximateRows = Number(tableInfo?.TABLE_ROWS)
      if (Number.isFinite(approximateRows) && approximateRows >= APPROXIMATE_ROW_THRESHOLD) {
        total = approximateRows
        countApproximate = true
      }
    }

    const readRows = async (sql) => {
      const { raw } = await queryEngineSession(session, sql, params, options.timeout)
      return Array.isArray(raw) ? raw : []
    }

    let rows = []
    let currentPage = page

    if (total === null) {
      total = Number((await readRows(countSql))[0]?.total || 0)
      const pageCount = Math.max(1, Math.ceil(total / pageSize))
      currentPage = Math.min(page, pageCount)
      rows = await readRows(pageSql((currentPage - 1) * pageSize))
      rememberTableCount(countCacheKey, total)
    } else {
      const pageCount = Math.max(1, Math.ceil(total / pageSize))
      currentPage = Math.min(page, pageCount)
      rows = await readRows(pageSql((currentPage - 1) * pageSize))
    }

    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const previewSql = inlineSqlParameters(dialect.convertPlaceholders(pageSql((currentPage - 1) * pageSize)), params)

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
      isView: isViewInfo(tableInfo),
      tableInfo,
      sql: previewSql
    }
  } catch (error) {
    log.error('读取表数据失败:', error)
    return toErrorResult(error, t('读取表数据失败'))
  } finally {
    session.release()
  }
}

export async function getEngineCellValue(entry, database, tableName, columnName, keys = {}, options = {}) {
  const engine = engineOf(entry)
  const dialect = getDialect(engine)
  const session = await openEngineSession(entry, database)

  try {
    const columns = await loadEngineColumns(entry, database, tableName)
    if (!columns.some((column) => column.name === columnName)) {
      throw new Error(`无效的字段: ${columnName}`)
    }
    const primaryKeys = await loadEnginePrimaryKeys(entry, database, tableName)
    if (!primaryKeys.length) {
      throw new Error(t('表没有主键，无法定位单元格'))
    }
    const clauses = []
    const params = []
    for (const key of primaryKeys) {
      if (!Object.prototype.hasOwnProperty.call(keys, key)) {
        throw new Error(`缺少主键字段: ${key}`)
      }
      clauses.push(dialect.nullSafeEquals(dialect.quote(key)))
      params.push(keys[key] === undefined ? null : keys[key])
    }
    const { raw } = await queryEngineSession(
      session,
      `SELECT ${dialect.quote(columnName)} AS value FROM ${tableRefOf(
        entry,
        database,
        tableName
      )} WHERE ${clauses.join(' AND ')} LIMIT 1`,
      params,
      options.timeout
    )
    const rows = Array.isArray(raw) ? raw : []
    if (!rows.length) {
      throw new Error(t('未找到该行数据'))
    }
    return { success: true, value: rows[0].value ?? null }
  } catch (error) {
    log.error('读取单元格数据失败:', error)
    return toErrorResult(error, t('读取单元格数据失败'))
  } finally {
    session.release()
  }
}

function buildInsertSql(entry, database, tableName, rows, columns) {
  const dialect = getDialect(engineOf(entry))
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
  const sql = `INSERT INTO ${tableRefOf(entry, database, tableName)} (${keys
    .map((key) => dialect.quote(key))
    .join(', ')}) VALUES ${placeholders}`
  const params = rows.flatMap((row) => keys.map((key) => (row[key] === undefined ? null : row[key])))

  return { sql, params }
}

export async function insertEngineRows(entry, database, tableName, rows = [], options = {}) {
  const name = entry.name
  const session = await openEngineSession(entry, database)

  try {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error(t('没有可导入的数据'))
    }
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)

    const columns = await loadEngineColumns(entry, database, tableName)
    const { sql, params } = buildInsertSql(entry, database, tableName, rows, columns)
    const { raw, fields } = await queryEngineSession(session, sql, params, options.timeout)
    const result = normalizeResult(raw, fields, 0)
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
    session.release()
  }
}

function buildKeyClause(keys, columnNames, dialect) {
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
    parts.push(dialect.nullSafeEquals(dialect.quote(key)))
    params.push(value === undefined ? null : value)
  }

  return { sql: parts.join(' AND '), params }
}

export async function applyEngineTableChanges(entry, database, tableName, changes = {}) {
  const engine = engineOf(entry)
  const dialect = getDialect(engine)
  const name = entry.name
  const session = await openEngineSession(entry, database)

  try {
    if (entry.config?.readOnly) throw new Error(READONLY_BLOCK_MESSAGE)
    const columns = await loadEngineColumns(entry, database, tableName)
    if (!columns.length) {
      throw new Error(t('表不存在或没有可编辑的字段'))
    }
    const columnNames = new Set(columns.map((column) => column.name))
    const tableRef = tableRefOf(entry, database, tableName)

    const updates = changes.updates || []
    const deletes = changes.deletes || []
    const inserts = changes.inserts || []

    let updated = 0
    let deleted = 0
    let inserted = 0

    if (engine === 'postgres') await session.client.query('BEGIN')
    else session.entry.db.exec('BEGIN IMMEDIATE')

    try {
      for (const item of updates) {
        const values = Object.entries(item.values || {}).filter(([key]) => columnNames.has(key))
        if (!values.length) continue
        const keyClause = buildKeyClause(item.keys, columnNames, dialect)
        const sql = `UPDATE ${tableRef} SET ${values
          .map(([key]) => `${dialect.quote(key)} = ?`)
          .join(', ')} WHERE ${keyClause.sql}`
        const { raw, fields } = await queryEngineSession(session, sql, [
          ...values.map(([, value]) => value),
          ...keyClause.params
        ])
        updated += normalizeResult(raw, fields, 0).affectedRows ?? 0
      }

      for (const item of deletes) {
        const keyClause = buildKeyClause(item.keys || item, columnNames, dialect)
        const { raw, fields } = await queryEngineSession(
          session,
          `DELETE FROM ${tableRef} WHERE ${keyClause.sql}`,
          keyClause.params
        )
        deleted += normalizeResult(raw, fields, 0).affectedRows ?? 0
      }

      if (inserts.length) {
        const { sql, params } = buildInsertSql(entry, database, tableName, inserts, columns)
        const { raw, fields } = await queryEngineSession(session, sql, params)
        inserted += normalizeResult(raw, fields, 0).affectedRows ?? inserts.length
      }

      if (engine === 'postgres') await session.client.query('COMMIT')
      else session.entry.db.exec('COMMIT')
    } catch (error) {
      try {
        if (engine === 'postgres') await session.client.query('ROLLBACK')
        else session.entry.db.exec('ROLLBACK')
      } catch {
        // ignore rollback failure
      }
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
    session.release()
  }
}
