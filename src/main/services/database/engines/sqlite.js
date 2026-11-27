import fs from 'fs'
import path from 'path'
import { t } from '../../i18n.js'
import { splitSqlStatements } from '../../../../shared/sqlStatements.js'
import { getDialect } from './dialect.js'

const IDENT = getDialect('sqlite')

let sqliteModule = null

async function loadSqliteModule() {
  if (!sqliteModule) {
    try {
      sqliteModule = await import('node:sqlite')
    } catch {
      throw new Error(t('当前运行环境不支持内置 SQLite 驱动'))
    }
  }
  return sqliteModule
}

function databaseName(config) {
  return path.basename(String(config.filePath || '')) || 'main'
}

function normalizeValue(value) {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint') return value
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value)
}

function normalizeParams(params = []) {
  return params.map(normalizeValue)
}

function normalizeRows(rows = []) {
  return rows.map((row) => {
    const next = {}
    for (const [key, value] of Object.entries(row)) {
      next[key] = typeof value === 'bigint' ? Number(value) : value
    }
    return next
  })
}

export async function testSqliteConnection(config) {
  const filePath = String(config.filePath || '').trim()
  if (!filePath) return { success: false, error: t('请选择 SQLite 数据库文件') }
  if (!fs.existsSync(filePath)) return { success: false, error: t('数据库文件不存在: {p0}', { p0: filePath }) }
  let db = null
  try {
    const { DatabaseSync } = await loadSqliteModule()
    db = new DatabaseSync(filePath, { readOnly: true })
    db.prepare('SELECT 1 AS ok').get()
    return { success: true, message: t('连接成功') }
  } catch (error) {
    return { success: false, error: error.message || t('连接失败'), code: error.code }
  } finally {
    try {
      db?.close()
    } catch {
      // ignore
    }
  }
}

export async function openSqliteConnection(name, config) {
  const filePath = String(config.filePath || '').trim()
  if (!filePath) throw new Error(t('请选择 SQLite 数据库文件'))
  const readOnly = config.readOnly === true
  if (!readOnly && !fs.existsSync(filePath)) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) throw new Error(t('数据库目录不存在: {p0}', { p0: dir }))
  }
  const { DatabaseSync } = await loadSqliteModule()
  const db = new DatabaseSync(filePath, {
    readOnly,
    enableForeignKeyConstraints: true
  })
  return {
    name,
    engine: 'sqlite',
    config: { ...config },
    db,
    filePath,
    keepAliveTimer: null
  }
}

export async function closeSqliteConnection(entry) {
  try {
    entry.db?.close()
  } catch {
    // ignore
  }
}

export async function runSqliteQuery(entry, _database, sql, params = []) {
  const statement = entry.db.prepare(sql)
  const columns = typeof statement.columns === 'function' ? statement.columns() : []
  if (columns.length > 0) {
    const rows = normalizeRows(statement.all(...normalizeParams(params)))
    return {
      rows,
      fields: columns.map((column) => ({ name: column.name, columnType: 0 })),
      rowCount: rows.length,
      isSelect: true,
      affectedRows: 0,
      changedRows: 0,
      insertId: 0,
      info: ''
    }
  }
  const result = statement.run(...normalizeParams(params))
  return {
    rows: [],
    fields: [],
    rowCount: 0,
    isSelect: false,
    affectedRows: Number(result.changes) || 0,
    changedRows: Number(result.changes) || 0,
    insertId: Number(result.lastInsertRowid) || 0,
    info: ''
  }
}

export function runSqliteClientQuery(tx, database, sql, params = []) {
  return runSqliteQuery(tx.entry, database, sql, params)
}

export async function runSqliteScript(entry, _database, sql) {
  const statements = splitSqlStatements(sql)
  const results = []
  for (const statement of statements) {
    results.push(await runSqliteQuery(entry, _database, statement))
  }
  const rows = results.reduce((found, result) => (result.isSelect ? result.rows : found), [])
  return {
    results,
    statementCount: statements.length,
    rows,
    fields: results.find((result) => result.isSelect)?.fields || [],
    affectedRows: results.reduce((sum, result) => sum + (result.isSelect ? 0 : result.affectedRows), 0)
  }
}

export async function beginSqliteTransaction(entry) {
  entry.db.exec('BEGIN IMMEDIATE')
  return { kind: 'sqlite', entry }
}

export async function commitSqliteTransaction(tx) {
  tx.entry.db.exec('COMMIT')
}

export async function rollbackSqliteTransaction(tx) {
  tx.entry.db.exec('ROLLBACK')
}

export function listSqliteDatabases(entry) {
  return [databaseName(entry.config)]
}

export function listSqliteTables(entry) {
  const rows = entry.db
    .prepare(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY type DESC, name`
    )
    .all()
  const details = rows.map((row) => {
    let rowCount = 0
    if (row.type === 'table') {
      try {
        rowCount = Number(entry.db.prepare(`SELECT COUNT(*) AS total FROM ${IDENT.quote(row.name)}`).get()?.total || 0)
      } catch {
        rowCount = 0
      }
    }
    return {
      name: row.name,
      type: row.type === 'view' ? 'VIEW' : 'BASE TABLE',
      isView: row.type === 'view',
      engine: 'SQLite',
      rowCount,
      dataLength: 0,
      indexLength: 0,
      collation: '',
      comment: ''
    }
  })
  return { tables: rows.map((row) => row.name), details }
}

function getTableSql(entry, tableName) {
  try {
    const row = entry.db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(tableName)
    return row?.sql || ''
  } catch {
    return ''
  }
}

export async function loadSqliteColumns(entry, _database, tableName) {
  const tableSql = getTableSql(entry, tableName)
  const rows = entry.db.prepare(`PRAGMA table_info(${IDENT.quote(tableName)})`).all()
  return rows.map((row) => {
    const type = String(row.type || '')
    const autoIncrement = row.pk > 0 && /^integer$/i.test(type) && (/autoincrement/i.test(tableSql) || row.pk === 1)
    return {
      name: row.name,
      dataType: type.toLowerCase(),
      columnType: type,
      nullable: row.notnull === 0,
      defaultValue: row.dflt_value,
      extra: row.pk > 0 ? 'primary key' : '',
      columnKey: row.pk > 0 ? 'PRI' : '',
      comment: '',
      position: Number(row.cid) + 1,
      autoIncrement
    }
  })
}

export async function loadSqlitePrimaryKeys(entry, _database, tableName) {
  const rows = entry.db.prepare(`PRAGMA table_info(${IDENT.quote(tableName)})`).all()
  return rows
    .filter((row) => Number(row.pk) > 0)
    .sort((a, b) => Number(a.pk) - Number(b.pk))
    .map((row) => row.name)
}

async function loadSqliteIndexes(entry, tableName) {
  const list = entry.db.prepare(`PRAGMA index_list(${IDENT.quote(tableName)})`).all()
  return list.map((index) => {
    const columns = entry.db
      .prepare(`PRAGMA index_info(${IDENT.quote(index.name)})`)
      .all()
      .map((info) => info.name)
    return {
      name: index.name,
      unique: Number(index.unique) === 1,
      primary: index.origin === 'pk',
      type: 'btree',
      cardinality: null,
      columns
    }
  })
}

async function loadSqliteForeignKeys(entry, tableName) {
  const rows = entry.db.prepare(`PRAGMA foreign_key_list(${IDENT.quote(tableName)})`).all()
  const fkMap = new Map()
  for (const row of rows) {
    const name = `fk_${tableName}_${row.id}`
    if (!fkMap.has(name)) {
      fkMap.set(name, {
        name,
        refSchema: '',
        refTable: row.table,
        updateRule: row.on_update || '',
        deleteRule: row.on_delete || '',
        columns: []
      })
    }
    fkMap.get(name).columns.push({ column: row.from, refColumn: row.to })
  }
  return Array.from(fkMap.values())
}

function loadSqliteTriggers(entry, tableName) {
  return entry.db
    .prepare(`SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = ? ORDER BY name`)
    .all(tableName)
    .map((row) => ({ name: row.name, event: '', timing: '', statement: row.sql || '', sortOrder: 0 }))
}

export function getSqliteTableInfo(entry, _database, tableName) {
  const row = entry.db.prepare('SELECT name, type, sql FROM sqlite_master WHERE name = ?').get(tableName)
  if (!row) return null
  return {
    name: row.name,
    type: row.type === 'view' ? 'VIEW' : 'BASE TABLE',
    isView: row.type === 'view',
    rowCount: null,
    dataLength: 0,
    indexLength: 0,
    comment: '',
    ddl: row.sql || ''
  }
}

export async function getSqliteTableMeta(entry, _database, tableName) {
  const info = getSqliteTableInfo(entry, _database, tableName)
  if (!info) throw new Error(t('表不存在'))
  const columns = await loadSqliteColumns(entry, _database, tableName)
  const primaryKeys = await loadSqlitePrimaryKeys(entry, _database, tableName)
  const indexes = await loadSqliteIndexes(entry, tableName)
  const foreignKeys = await loadSqliteForeignKeys(entry, tableName)
  const triggers = loadSqliteTriggers(entry, tableName)
  return {
    columns,
    primaryKeys,
    indexes,
    foreignKeys,
    triggers,
    info,
    ddl: info.ddl,
    isView: info.isView
  }
}

export async function getSqliteObjectDefinition(entry, _database, type, objectName) {
  if (!['table', 'view', 'trigger', 'index'].includes(type)) {
    return { success: false, error: t('不支持的对象类型') }
  }
  const row = entry.db.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(objectName)
  return { success: true, type, name: objectName, ddl: row?.sql || '' }
}

export async function querySqliteObjects(entry, _database, keyword = '') {
  const pattern = `%${String(keyword).replace(/[\\%_]/g, '\\$&')}%`
  const hasKeyword = Boolean(keyword)
  const items = []

  const tables = entry.db
    .prepare(
      `SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
       ${hasKeyword ? 'AND name LIKE ?' : ''} ORDER BY name LIMIT 300`
    )
    .all(...(hasKeyword ? [pattern] : []))
  for (const row of tables) {
    items.push({
      type: row.type === 'view' ? 'view' : 'table',
      name: row.name,
      detail: row.type === 'view' ? t('视图') : t('表')
    })
  }

  for (const table of tables.filter((row) => row.type === 'table')) {
    let columns
    try {
      columns = entry.db.prepare(`PRAGMA table_info(${IDENT.quote(table.name)})`).all()
    } catch {
      columns = []
    }
    for (const column of columns) {
      if (hasKeyword && !String(column.name).toLowerCase().includes(String(keyword).toLowerCase())) continue
      items.push({
        type: 'column',
        name: column.name,
        table: table.name,
        detail: `${table.name} · ${column.type || ''}`
      })
      if (items.length >= 600) break
    }
  }

  const triggers = entry.db
    .prepare(
      `SELECT name, tbl_name FROM sqlite_master WHERE type = 'trigger' ${hasKeyword ? 'AND name LIKE ?' : ''}
       ORDER BY name LIMIT 200`
    )
    .all(...(hasKeyword ? [pattern] : []))
  for (const row of triggers) {
    items.push({ type: 'trigger', name: row.name, table: row.tbl_name, detail: row.tbl_name })
  }

  return { success: true, items }
}

export async function getSqliteErData(entry, _database, limit = 200) {
  const tableLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 200, 1), 1000)
  const tables = entry.db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT ${tableLimit}`
    )
    .all()
  const foreignKeys = []
  const tableList = []
  for (const table of tables) {
    const columns = entry.db.prepare(`PRAGMA table_info(${IDENT.quote(table.name)})`).all()
    tableList.push({
      name: table.name,
      comment: '',
      columns: columns.map((column) => ({
        name: column.name,
        columnType: column.type || '',
        columnKey: Number(column.pk) > 0 ? 'PRI' : '',
        nullable: column.notnull === 0,
        comment: ''
      }))
    })
    const fks = entry.db.prepare(`PRAGMA foreign_key_list(${IDENT.quote(table.name)})`).all()
    for (const fk of fks) {
      foreignKeys.push({
        name: `fk_${table.name}_${fk.id}`,
        tableName: table.name,
        columnName: fk.from,
        refTable: fk.table,
        refColumn: fk.to
      })
    }
  }
  return { success: true, tables: tableList, foreignKeys }
}

export function explainSqliteQuery(entry, _database, sql) {
  const rows = entry.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all()
  return { success: true, rows: normalizeRows(rows), json: null }
}

export function querySqliteConnectionInfo(entry) {
  const version = entry.db.prepare('SELECT sqlite_version() AS version').get()?.version
  return {
    version: `SQLite ${version}`,
    database: databaseName(entry.config),
    user: 'sqlite',
    encoding: 'UTF-8'
  }
}

export function querySqliteDatabaseInfo(entry) {
  let size
  try {
    size = fs.statSync(entry.filePath).size
  } catch {
    size = 0
  }
  return {
    name: databaseName(entry.config),
    charset: 'UTF-8',
    collation: 'BINARY',
    size
  }
}

export function querySqliteTableDetails(entry) {
  const { details } = listSqliteTables(entry)
  return details.map((table) => ({
    name: table.name,
    rows: table.rowCount,
    dataSize: table.dataLength,
    engine: table.isView ? 'VIEW' : 'SQLite',
    modified: '',
    comment: ''
  }))
}

export function querySqliteTableInfoRow(entry, _database, tableName) {
  const info = getSqliteTableInfo(entry, _database, tableName)
  if (!info) return null
  return {
    TABLE_NAME: info.name,
    TABLE_TYPE: info.type,
    ENGINE: info.isView ? '' : 'SQLite',
    TABLE_ROWS: '',
    TABLE_COMMENT: '',
    CREATE_TIME: '',
    UPDATE_TIME: ''
  }
}
