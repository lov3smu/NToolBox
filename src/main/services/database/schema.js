import { log } from '../../utils'
import { t } from '../i18n.js'
import { getEntry } from './state.js'
import {
  loadColumns,
  loadPrimaryKeys,
  quoteIdentifier,
  quoteTable,
  escapeLikePattern,
  toErrorResult
} from './helpers.js'
import { buildColumnDefinition } from './tableData.js'
import { capabilityError, engineOf } from './engines/index.js'
import { loadEngineColumns } from './engines/tableData.js'
import {
  getPostgresErData,
  getPostgresObjectDefinition,
  getPostgresTableMeta,
  listPostgresDatabases,
  listPostgresTables,
  queryPostgresConnectionInfo,
  queryPostgresDatabaseInfo,
  queryPostgresObjects,
  queryPostgresTableDetails,
  queryPostgresTableInfoRow
} from './engines/postgres.js'
import {
  getSqliteErData,
  getSqliteObjectDefinition,
  getSqliteTableMeta,
  listSqliteDatabases,
  listSqliteTables,
  querySqliteConnectionInfo,
  querySqliteDatabaseInfo,
  querySqliteObjects,
  querySqliteTableDetails,
  querySqliteTableInfoRow
} from './engines/sqlite.js'

export async function queryDatabases(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) === 'postgres') {
      return { success: true, databases: await listPostgresDatabases(entry) }
    }
    if (engineOf(entry) === 'sqlite') {
      return { success: true, databases: listSqliteDatabases(entry) }
    }
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
    if (engineOf(entry) === 'postgres') {
      const result = await listPostgresTables(entry, database)
      return { success: true, tables: result.tables, details: result.details }
    }
    if (engineOf(entry) === 'sqlite') {
      const result = listSqliteTables(entry)
      return { success: true, tables: result.tables, details: result.details }
    }
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
    if (engineOf(entry) !== 'mysql') {
      const columns = await loadEngineColumns(entry, database, tableName)
      return { success: true, fields: columns, columns }
    }
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

export async function getTableMeta(name, database, tableName) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) === 'postgres') {
      return { success: true, ...(await getPostgresTableMeta(entry, database, tableName)) }
    }
    if (engineOf(entry) === 'sqlite') {
      return { success: true, ...(await getSqliteTableMeta(entry, database, tableName)) }
    }
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
    if (engineOf(getEntry(name)) !== 'mysql' || engineOf(getEntry(targetName)) !== 'mysql') {
      return capabilityError()
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
    if (engineOf(entry) === 'postgres') return await queryPostgresObjects(entry, database, keyword)
    if (engineOf(entry) === 'sqlite') return await querySqliteObjects(entry, database, keyword)
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
  table: 'SHOW CREATE TABLE',
  view: 'SHOW CREATE VIEW',
  function: 'SHOW CREATE FUNCTION',
  procedure: 'SHOW CREATE PROCEDURE',
  trigger: 'SHOW CREATE TRIGGER',
  event: 'SHOW CREATE EVENT'
}

export async function getObjectDefinition(name, database, type, objectName) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) === 'postgres') return await getPostgresObjectDefinition(entry, database, type, objectName)
    if (engineOf(entry) === 'sqlite') return await getSqliteObjectDefinition(entry, database, type, objectName)

    const statement = OBJECT_DDL_STATEMENTS[type]
    if (!statement) {
      return { success: false, error: t('不支持的对象类型') }
    }

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

export async function getErData(name, database, limit = 200) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) === 'postgres') return await getPostgresErData(entry, database, limit)
    if (engineOf(entry) === 'sqlite') return await getSqliteErData(entry, database, limit)
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

export async function getConnectionInfo(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    const engine = engineOf(entry)
    if (engine === 'postgres') {
      return { success: true, info: await queryPostgresConnectionInfo(entry) }
    }
    if (engine === 'sqlite') {
      return { success: true, info: querySqliteConnectionInfo(entry) }
    }
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query(
      'SELECT VERSION() AS version, @@character_set_server AS charset, @@collation_server AS collation, @@session.auto_increment_increment AS autoIncrementIncrement'
    )
    return { success: true, info: rows[0] || null }
  } catch (error) {
    log.error('读取连接信息失败:', error)
    return toErrorResult(error, t('读取连接信息失败'))
  } finally {
    conn?.release()
  }
}

export async function getDatabaseInfo(name, database) {
  let conn = null
  try {
    const entry = getEntry(name)
    const engine = engineOf(entry)
    if (engine === 'postgres') {
      return { success: true, info: await queryPostgresDatabaseInfo(entry, database) }
    }
    if (engine === 'sqlite') {
      return { success: true, info: querySqliteDatabaseInfo(entry) }
    }
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query(
      `SELECT SCHEMA_NAME AS name, DEFAULT_CHARACTER_SET_NAME AS charset, DEFAULT_COLLATION_NAME AS collation
       FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
      [database]
    )
    return { success: true, info: rows[0] || null }
  } catch (error) {
    log.error('读取数据库信息失败:', error)
    return toErrorResult(error, t('读取数据库信息失败'))
  } finally {
    conn?.release()
  }
}

export async function getTableDetails(name, database) {
  let conn = null
  try {
    const entry = getEntry(name)
    const engine = engineOf(entry)
    if (engine === 'postgres') return { success: true, details: await queryPostgresTableDetails(entry, database) }
    if (engine === 'sqlite') return { success: true, details: querySqliteTableDetails(entry) }
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query(
      `SELECT TABLE_NAME AS name, TABLE_ROWS AS rows, DATA_LENGTH + INDEX_LENGTH AS dataSize,
              ENGINE AS engine, UPDATE_TIME AS modified, TABLE_COMMENT AS comment
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [database]
    )
    return { success: true, details: rows }
  } catch (error) {
    log.error('读取表详情失败:', error)
    return toErrorResult(error, t('读取表详情失败'))
  } finally {
    conn?.release()
  }
}

export async function getTableInfo(name, database, tableName) {
  let conn = null
  try {
    const entry = getEntry(name)
    const engine = engineOf(entry)
    if (engine === 'postgres') {
      return { success: true, info: await queryPostgresTableInfoRow(entry, database, tableName) }
    }
    if (engine === 'sqlite') return { success: true, info: querySqliteTableInfoRow(entry, database, tableName) }
    conn = await entry.pool.getConnection()
    const [rows] = await conn.query(
      `SELECT TABLE_NAME, TABLE_ROWS, ENGINE, AUTO_INCREMENT, ROW_FORMAT, TABLE_COLLATION, CREATE_TIME,
              UPDATE_TIME, CHECK_TIME, INDEX_LENGTH, DATA_LENGTH, MAX_DATA_LENGTH, DATA_FREE,
              CREATE_OPTIONS, TABLE_COMMENT
       FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, tableName]
    )
    return { success: true, info: rows[0] || null }
  } catch (error) {
    log.error('读取表信息失败:', error)
    return toErrorResult(error, t('读取表信息失败'))
  } finally {
    conn?.release()
  }
}
