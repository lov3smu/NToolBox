import { t } from '../i18n.js'
import { recordDbOperation } from './dbAuditLog.js'
import { splitSqlStatementRanges } from '../../../shared/sqlStatements.js'
import { getDialect } from './engines/dialect.js'

export const DEFAULT_LIMIT = 1000
export const MAX_LIMIT = 1000000
export const EXPORT_BATCH_SIZE = 2000
export const DEFAULT_EXPORT_ROWS = 100000
export const TABLE_PAGE_SIZE_LIMIT = 500
export const APPROXIMATE_ROW_THRESHOLD = 200000

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

export function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``
}

export function quoteTable(database, tableName) {
  return database ? `${quoteIdentifier(database)}.${quoteIdentifier(tableName)}` : quoteIdentifier(tableName)
}

export const READONLY_BLOCK_MESSAGE = t('只读连接不允许执行写操作，请在连接设置中关闭只读模式')
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

export function auditWrite(
  name,
  database,
  action,
  sql,
  result,
  { duration = 0, rows = 0, table = '', source = '' } = {}
) {
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

export function auditSqlResult(name, database, sql, result, duration, source) {
  if (hasWriteStatement(sql)) {
    auditWrite(name, database, sqlVerb(sql), sql, result, {
      duration,
      rows: result?.affectedRows ?? result?.rowCount ?? 0,
      source
    })
  }
  return result
}

export function readOnlyBlock(entry, sql, { multiple = false } = {}) {
  if (!entry?.config?.readOnly) return null
  const statements = multiple ? splitSqlStatementRanges(String(sql || '')).map((statement) => statement.text) : [sql]
  for (const statement of statements) {
    if (WRITE_STATEMENT_PATTERN.test(stripSqlLeadingComments(statement))) {
      return READONLY_BLOCK_MESSAGE
    }
  }
  return null
}

function toQueryTimeout(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(3600, Math.floor(value)) * 1000
}

export function runQuery(conn, sql, params = [], timeoutSeconds) {
  const timeout = toQueryTimeout(timeoutSeconds)
  return timeout ? conn.query({ sql, timeout }, params) : conn.query(sql, params)
}

function normalizeFields(fields = []) {
  return fields.map((field) => ({
    name: field.name,
    columnType: field.columnType ?? 0
  }))
}

export function addLimitToQuery(sql, limit) {
  const trimmed = sql.trim().replace(/;\s*$/, '')
  if (!/^\s*SELECT\b/i.test(trimmed) || /\bLIMIT\b/i.test(trimmed)) {
    return trimmed
  }
  return `${trimmed} LIMIT ${limit}`
}

export function normalizeResult(rows, fields, duration) {
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

export function toErrorResult(error, fallbackMessage) {
  return {
    success: false,
    error: error.message || fallbackMessage,
    code: error.code,
    sql: error.sql
  }
}

export function assertColumnName(value, label = t('字段')) {
  if (!value || typeof value !== 'string') {
    throw new Error(t('{p0}不能为空', { p0: label }))
  }
  return value
}

export function escapeLikePattern(value) {
  return String(value).replace(/([\\%_])/g, '\\$1')
}

export async function loadColumns(conn, database, tableName) {
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

export async function loadPrimaryKeys(conn, database, tableName) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
     ORDER BY ORDINAL_POSITION`,
    [database, tableName]
  )
  return rows.map((row) => row.name)
}

function buildFilterClause(filter, columnNames, dialect) {
  const field = assertColumnName(filter?.field, t('筛选字段'))
  if (!columnNames.has(field)) {
    throw new Error(t('无效的筛选字段: {p0}', { p0: field }))
  }

  const operator = String(filter.operator || '=').toUpperCase()
  if (!FILTER_OPERATORS.includes(operator)) {
    throw new Error(t('不支持的筛选运算符: {p0}', { p0: filter.operator }))
  }

  const column = dialect.quote(field)
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
    return { sql: `${dialect.castText(column)} ${operator} ?`, params: [value ?? ''] }
  }

  return { sql: `${column} ${operator} ?`, params: [value] }
}

export function buildWhereClause(columns, options = {}, dialect = getDialect('mysql')) {
  const columnNames = new Set(columns.map((column) => column.name))
  const params = []
  let expression = ''

  for (const filter of options.filters || []) {
    const clause = buildFilterClause(filter, columnNames, dialect)
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
    const searchParts = effectiveColumns.map((name) => `${dialect.castText(dialect.quote(name))} LIKE ?`)
    const searchSql = `(${searchParts.join(' OR ')})`
    params.push(...effectiveColumns.map(() => pattern))
    expression = expression ? `(${expression} AND ${searchSql})` : searchSql
  }

  return {
    whereSql: expression ? ` WHERE ${expression}` : '',
    params
  }
}

export function buildOrderBy(columns, sort, dialect = getDialect('mysql')) {
  const columnNames = new Set(columns.map((column) => column.name))
  const entries = Array.isArray(sort) ? sort : sort ? [sort] : []
  const parts = []

  for (const item of entries) {
    const field = item?.field || item?.column
    if (!field || !columnNames.has(field)) continue
    const order = String(item.order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
    parts.push(`${dialect.quote(field)} ${order}`)
  }

  return parts.length ? ` ORDER BY ${parts.join(', ')}` : ''
}

export async function optionalQuery(conn, sql) {
  try {
    const [rows] = await conn.query(sql)
    return rows
  } catch {
    return null
  }
}
