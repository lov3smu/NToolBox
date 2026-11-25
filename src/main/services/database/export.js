import { log } from '../../utils'
import { t } from '../i18n.js'
import { applyDataMasking, normalizeMaskPresetKeys } from '../../../shared/dataMasking.js'
import { getEntry } from './state.js'
import { EXPORT_BATCH_SIZE, DEFAULT_EXPORT_ROWS, loadColumns, loadPrimaryKeys, toErrorResult } from './helpers.js'
import { engineOf, getDialect, openEngineSession, queryEngineSession, tableRefOf } from './engines/index.js'
import { loadEngineColumns, loadEnginePrimaryKeys } from './engines/tableData.js'
import { getPostgresTableMeta, listPostgresTables } from './engines/postgres.js'
import { getSqliteTableMeta, listSqliteTables } from './engines/sqlite.js'

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
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return `'${value.toISOString()}'`
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return `X'${Buffer.from(value).toString('hex')}'`
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

function buildOrderSql(primaryKeys, dialect) {
  return primaryKeys.length ? ` ORDER BY ${primaryKeys.map((key) => dialect.quote(key)).join(', ')}` : ''
}

async function queryRows(session, sql, params = []) {
  const { raw } = await queryEngineSession(session, sql, params)
  return Array.isArray(raw) ? raw : []
}

async function loadSessionColumns(session, entry, database, tableName) {
  if (session.engine === 'mysql') return loadColumns(session.conn, database, tableName)
  return loadEngineColumns(entry, database, tableName)
}

async function loadSessionPrimaryKeys(session, entry, database, tableName) {
  if (session.engine === 'mysql') return loadPrimaryKeys(session.conn, database, tableName)
  return loadEnginePrimaryKeys(entry, database, tableName)
}

async function loadTableDdl(session, entry, database, tableName) {
  const engine = session.engine
  if (engine === 'postgres') return (await getPostgresTableMeta(entry, database, tableName)).ddl
  if (engine === 'sqlite') return (await getSqliteTableMeta(entry, database, tableName)).ddl
  const rows = await queryRows(session, `SHOW CREATE TABLE ${tableRefOf(entry, database, tableName)}`)
  return rows[0]?.['Create Table'] || ''
}

async function loadBaseTables(session, entry, database) {
  const engine = engineOf(entry)
  if (engine === 'postgres') {
    const { details } = await listPostgresTables(entry, database)
    return details.filter((table) => !table.isView).map((table) => table.name)
  }
  if (engine === 'sqlite') {
    const { details } = listSqliteTables(entry)
    return details.filter((table) => !table.isView).map((table) => table.name)
  }
  const rows = await queryRows(
    session,
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
    [database]
  )
  return rows.map((row) => row.name)
}

async function collectRows(session, entry, database, tableName, maxRows) {
  const dialect = getDialect(engineOf(entry))
  const primaryKeys = await loadSessionPrimaryKeys(session, entry, database, tableName)
  const orderSql = buildOrderSql(primaryKeys, dialect)
  const tableRef = tableRefOf(entry, database, tableName)
  const rows = []
  let offset = 0
  let truncated = false

  while (rows.length < maxRows) {
    const batchSize = Math.min(EXPORT_BATCH_SIZE, maxRows - rows.length)
    const batch = await queryRows(session, `SELECT * FROM ${tableRef}${orderSql} LIMIT ${batchSize} OFFSET ${offset}`)
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

export async function exportTableData(name, database, tableName, options = {}) {
  const entry = getEntry(name)
  const session = await openEngineSession(entry, database)
  try {
    const format = String(options.format || 'csv').toLowerCase()
    const maxRows = Math.max(1, Number(options.maxRows) || DEFAULT_EXPORT_ROWS)
    const dialect = getDialect(engineOf(entry))
    const tableRef = tableRefOf(entry, database, tableName)

    const columns = await loadSessionColumns(session, entry, database, tableName)
    if (!columns.length) {
      throw new Error(t('表不存在或没有可导出的字段'))
    }
    const collected = await collectRows(session, entry, database, tableName, maxRows)
    const truncated = collected.truncated
    const maskPresets = normalizeMaskPresetKeys(options.maskPresets)
    const rows = maskPresets.length ? applyDataMasking(collected.rows, maskPresets).rows : collected.rows
    const columnNames = columns.map((column) => column.name)
    let content = ''

    if (format === 'json') {
      content = JSON.stringify(rows, null, 2)
    } else if (format === 'sql') {
      const lines = []
      if (options.includeStructure) {
        const ddl = await loadTableDdl(session, entry, database, tableName)
        if (ddl) {
          lines.push(`DROP TABLE IF EXISTS ${tableRef};`)
          lines.push(`${ddl}${ddl.trimEnd().endsWith(';') ? '' : ';'}`)
          lines.push('')
        }
      }
      for (const row of rows) {
        lines.push(
          `INSERT INTO ${tableRef} (${columnNames
            .map((column) => dialect.quote(column))
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
    session.release()
  }
}

export async function exportDatabaseData(name, database, options = {}) {
  const entry = getEntry(name)
  const session = await openEngineSession(entry, database)
  try {
    const format = String(options.format || 'sql').toLowerCase()
    const maxRows = Math.max(1, Number(options.maxRows) || DEFAULT_EXPORT_ROWS)
    const engine = engineOf(entry)
    const dialect = getDialect(engine)
    const tableRef = (tableName) => tableRefOf(entry, database, tableName)
    const maskPresets = normalizeMaskPresetKeys(options.maskPresets)
    const maskRows = (rows) => (maskPresets.length ? applyDataMasking(rows, maskPresets).rows : rows)

    const tables = await loadBaseTables(session, entry, database)
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
        const result = await collectRows(session, entry, database, table, maxRows)
        nextRowCount(result)
        data.tables[table] = maskRows(result.rows)
      }
      return { success: true, content: JSON.stringify(data, null, 2), rowCount, truncated, tableCount: tables.length }
    }

    if (format === 'sql') {
      const lines = engine === 'mysql' ? ['SET NAMES utf8mb4;', 'SET FOREIGN_KEY_CHECKS=0;', ''] : []
      for (const table of tables) {
        const ddl = await loadTableDdl(session, entry, database, table)
        lines.push(`DROP TABLE IF EXISTS ${tableRef(table)};`)
        if (ddl) lines.push(`${ddl}${ddl.trimEnd().endsWith(';') ? '' : ';'}`)
        const result = await collectRows(session, entry, database, table, maxRows)
        const maskedRows = maskRows(result.rows)
        const columnNames = maskedRows.length ? Object.keys(maskedRows[0]) : []
        for (const row of maskedRows) {
          lines.push(
            `INSERT INTO ${tableRef(table)} (${columnNames
              .map((column) => dialect.quote(column))
              .join(', ')}) VALUES (${columnNames.map((column) => formatSqlValue(row[column])).join(', ')});`
          )
        }
        nextRowCount(result)
        lines.push('')
      }
      if (engine === 'mysql') lines.push('SET FOREIGN_KEY_CHECKS=1;')
      return { success: true, content: lines.join('\n'), rowCount, truncated, tableCount: tables.length }
    }

    const files = []
    for (const table of tables) {
      const columns = await loadSessionColumns(session, entry, database, table)
      const columnNames = columns.map((column) => column.name)
      const result = await collectRows(session, entry, database, table, maxRows)
      nextRowCount(result)
      const lines = [columnNames.map((column) => formatCsvCell(column)).join(',')]
      for (const row of maskRows(result.rows)) {
        lines.push(columnNames.map((column) => formatCsvCell(row[column])).join(','))
      }
      files.push({ name: table, content: lines.join('\n') })
    }
    return { success: true, files, rowCount, truncated, tableCount: tables.length }
  } catch (error) {
    log.error('导出数据库失败:', error)
    return toErrorResult(error, t('导出数据库失败'))
  } finally {
    session.release()
  }
}
