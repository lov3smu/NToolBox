import fs from 'fs'
import pg from 'pg'
import { log } from '../../../utils'
import { t } from '../../i18n.js'
import { createSshTunnel } from '../sshTunnel.js'
import { convertQuestionMarksToDollar } from '../../../../shared/sqlPlaceholders.js'
import { getDialect, qualifyTable } from './dialect.js'

const { Pool, Client } = pg

const DEFAULT_SCHEMA = 'public'

function schemaOf(config) {
  const schema = String(config.schema || '').trim()
  return schema || DEFAULT_SCHEMA
}

function buildSslOptions(config) {
  if (!config.ssl?.enabled) return false
  const options = { rejectUnauthorized: config.ssl.verify !== false }
  const caPath = String(config.ssl.caPath || '').trim()
  if (caPath) {
    try {
      options.ca = fs.readFileSync(caPath).toString()
    } catch (error) {
      throw new Error(t('读取 SSL CA 证书失败: {p0}', { p0: error.message }), { cause: error })
    }
  }
  return options
}

function normalizeParams(params = []) {
  return params.map((value) => {
    if (value === undefined) return null
    if (value === null) return null
    if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') return value
    if (value instanceof Date || Buffer.isBuffer(value) || value instanceof Uint8Array) return value
    if (typeof value === 'bigint') return value.toString()
    return JSON.stringify(value)
  })
}

function toMillis(seconds) {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(3600, Math.floor(value)) * 1000
}

function buildPoolConfig(config, host, port, database) {
  const poolConfig = {
    host,
    port,
    user: config.user || undefined,
    password: config.password || undefined,
    database: database || config.database || 'postgres',
    max: Number(config.connectionLimit) || 10,
    application_name: 'NToolBox',
    idleTimeoutMillis: 30000
  }
  const timeout = toMillis(config.connectTimeout)
  if (timeout) poolConfig.connectionTimeoutMillis = timeout
  const ssl = buildSslOptions(config)
  if (ssl) poolConfig.ssl = ssl
  return poolConfig
}

function createPool(poolConfig) {
  const pool = new Pool(poolConfig)
  const run = pool.query.bind(pool)
  // 元数据查询统一使用 `?` 占位符，这里转换为 pg 的 `$n`
  pool.query = (sql, values) => run(typeof sql === 'string' ? convertQuestionMarksToDollar(sql) : sql, values)
  return pool
}

export function getPgPool(entry, database) {
  const name = database || entry.config.database || 'postgres'
  const existing = entry.pools.get(name)
  if (existing) return existing
  const target = entry.config.ssh?.enabled ? '127.0.0.1' : entry.config.host || 'localhost'
  const port = entry.config.ssh?.enabled ? entry.tunnelPort : Number(entry.config.port) || 5432
  const pool = createPool(buildPoolConfig(entry.config, target, port, name))
  pool.on('error', (error) => log.warn(`PostgreSQL 连接池错误: ${entry.name}:`, error.message))
  entry.pools.set(name, pool)
  return pool
}

export async function testPostgresConnection(config) {
  let client = null
  let tunnel = null
  try {
    let host = config.host || 'localhost'
    let port = Number(config.port) || 5432
    if (config.ssh?.enabled) {
      tunnel = await createSshTunnel(`__test__:${Date.now()}`, config)
      host = '127.0.0.1'
      port = tunnel.localPort
    }
    client = new Client({
      ...buildPoolConfig(config, host, port, config.database),
      connectionTimeoutMillis: toMillis(config.connectTimeout) || 10000
    })
    await client.connect()
    await client.query('SELECT 1')
    return { success: true, message: t('连接成功') }
  } catch (error) {
    return { success: false, error: error.message || t('连接失败'), code: error.code }
  } finally {
    if (client) await client.end().catch(() => {})
    if (tunnel) tunnel.close()
  }
}

export async function openPostgresConnection(name, config) {
  let tunnel = null
  try {
    let host = config.host || 'localhost'
    let port = Number(config.port) || 5432
    if (config.ssh?.enabled) {
      tunnel = await createSshTunnel(name, config)
      host = '127.0.0.1'
      port = tunnel.localPort
    }

    const entry = {
      name,
      engine: 'postgres',
      config: { ...config },
      pools: new Map(),
      tunnelPort: port,
      sshTunnel: tunnel,
      keepAliveTimer: null
    }

    const target = config.ssh?.enabled ? host : config.host || 'localhost'
    const pool = createPool(buildPoolConfig(config, target, port, config.database))
    pool.on('error', (error) => log.warn(`PostgreSQL 连接池错误: ${name}:`, error.message))
    entry.pools.set(config.database || 'postgres', pool)
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')
    } finally {
      client.release()
    }

    if (config.keepAliveInterval && Number(config.keepAliveInterval) > 0) {
      entry.keepAliveTimer = setInterval(
        () => {
          pool.query('SELECT 1').catch((error) => log.warn(`Keep-alive ping failed for ${name}:`, error.message))
        },
        Number(config.keepAliveInterval) * 1000
      )
      entry.keepAliveTimer.unref?.()
    }

    tunnel = null
    return entry
  } catch (error) {
    if (tunnel) tunnel.close()
    throw error
  }
}

export async function closePostgresConnection(entry) {
  if (entry.keepAliveTimer) clearInterval(entry.keepAliveTimer)
  for (const pool of entry.pools.values()) {
    await pool.end().catch(() => {})
  }
  entry.pools.clear()
  if (entry.sshTunnel) entry.sshTunnel.close()
}

function buildCallConfig(sql, params, timeout) {
  const config = { text: sql, values: normalizeParams(params) }
  const millis = toMillis(timeout)
  if (millis) config.query_timeout = millis
  return config
}

export async function runPostgresQuery(pool, sql, params = [], timeout) {
  const result = await pool.query(buildCallConfig(sql, params, timeout))
  const rows = Array.isArray(result.rows) ? result.rows : []
  const isSelect = result.command === 'SELECT' || result.command === 'SHOW' || rows.length > 0
  return {
    rows: isSelect ? rows : [],
    fields: (result.fields || []).map((field) => ({ name: field.name, columnType: 0 })),
    rowCount: rows.length,
    isSelect,
    affectedRows: isSelect ? 0 : result.rowCount || 0,
    changedRows: isSelect ? 0 : result.rowCount || 0,
    insertId: 0,
    info: result.command || ''
  }
}

export async function runPostgresClientQuery(client, sql, params = [], timeout) {
  const result = await client.query(buildCallConfig(sql, params, timeout))
  const rows = Array.isArray(result.rows) ? result.rows : []
  const isSelect = result.command === 'SELECT' || result.command === 'SHOW' || rows.length > 0
  return {
    rows: isSelect ? rows : [],
    fields: (result.fields || []).map((field) => ({ name: field.name, columnType: 0 })),
    rowCount: rows.length,
    isSelect,
    affectedRows: isSelect ? 0 : result.rowCount || 0,
    changedRows: isSelect ? 0 : result.rowCount || 0,
    insertId: 0,
    info: result.command || ''
  }
}

export async function acquirePostgresClient(entry, database) {
  const pool = getPgPool(entry, database)
  const client = await pool.connect()
  let pid = 0
  try {
    const result = await client.query('SELECT pg_backend_pid() AS pid')
    pid = Number(result.rows[0]?.pid) || 0
  } catch {
    // 取不到后端 PID 时取消查询会回退到失败提示
  }
  return {
    kind: 'postgres',
    client,
    pid,
    database: database || entry.config.database || 'postgres'
  }
}

export async function releasePostgresClient(tx) {
  if (!tx?.client) return
  try {
    tx.client.release()
  } catch {
    // ignore
  }
}

const IDENT = getDialect('postgres')

export async function listPostgresDatabases(entry) {
  const pool = getPgPool(entry)
  const result = await pool.query(
    `SELECT datname AS name FROM pg_database WHERE datistemplate = false AND datallowconn ORDER BY datname`
  )
  return result.rows.map((row) => row.name)
}

export async function listPostgresTables(entry, database) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query(
    `SELECT c.relname AS name,
            CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'VIEW' ELSE 'BASE TABLE' END AS type,
            CASE WHEN c.reltuples < 0 THEN 0 ELSE c.reltuples::bigint END AS "rowCount",
            pg_total_relation_size(c.oid) AS "dataLength",
            pg_indexes_size(c.oid) AS "indexLength",
            obj_description(c.oid) AS comment
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = ? AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
     ORDER BY type, name`,
    [schema]
  )
  return {
    tables: result.rows.map((row) => row.name),
    details: result.rows.map((row) => ({
      name: row.name,
      type: row.type,
      isView: row.type === 'VIEW',
      engine: '',
      rowCount: Number(row.rowCount) || 0,
      dataLength: Number(row.dataLength) || 0,
      indexLength: Number(row.indexLength) || 0,
      collation: '',
      comment: row.comment || ''
    }))
  }
}

export async function loadPostgresColumns(entry, database, tableName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query(
    `SELECT a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS "columnType",
            tp.typname AS "dataType",
            NOT a.attnotnull AS nullable,
            pg_get_expr(ad.adbin, ad.adrelid) AS "defaultValue",
            a.attnum AS position,
            a.attidentity <> '' OR a.attgenerated <> '' AS identity,
            COALESCE(col_description(c.oid, a.attnum), '') AS comment,
            COALESCE(pk.is_primary, false) AS "isPrimary"
     FROM pg_catalog.pg_attribute a
     JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_catalog.pg_type tp ON tp.oid = a.atttypid
     LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
     LEFT JOIN LATERAL (
       SELECT true AS is_primary
       FROM pg_index i
       WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY(i.indkey)
     ) pk ON true
     WHERE n.nspname = ? AND c.relname = ? AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY a.attnum`,
    [schema, tableName]
  )
  return result.rows.map((row) => ({
    name: row.name,
    dataType: row.dataType,
    columnType: row.columnType,
    nullable: row.nullable === true,
    defaultValue: row.defaultValue,
    extra: row.identity ? 'identity' : '',
    columnKey: row.isPrimary ? 'PRI' : '',
    comment: row.comment || '',
    position: row.position,
    autoIncrement: row.identity === true
  }))
}

export async function loadPostgresPrimaryKeys(entry, database, tableName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query(
    `SELECT kcu.column_name AS name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema
     WHERE tc.table_schema = ? AND tc.table_name = ? AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [schema, tableName]
  )
  return result.rows.map((row) => row.name)
}

function mapFkAction(code) {
  return (
    {
      a: 'NO ACTION',
      r: 'RESTRICT',
      c: 'CASCADE',
      n: 'SET NULL',
      d: 'SET DEFAULT'
    }[code] || ''
  )
}

async function loadPostgresIndexes(entry, database, tableName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query(
    `SELECT ic.relname AS name, i.indisunique AS unique, i.indisprimary AS primary,
            a.attname AS "columnName", k.ord
     FROM pg_index i
     JOIN pg_class tc ON tc.oid = i.indrelid
     JOIN pg_namespace n ON n.oid = tc.relnamespace
     JOIN pg_class ic ON ic.oid = i.indexrelid
     JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON k.ord <= i.indnkeyatts
     JOIN pg_attribute a ON a.attrelid = tc.oid AND a.attnum = k.attnum
     WHERE n.nspname = ? AND tc.relname = ?
     ORDER BY ic.relname, k.ord`,
    [schema, tableName]
  )
  const indexMap = new Map()
  for (const row of result.rows) {
    if (!indexMap.has(row.name)) {
      indexMap.set(row.name, {
        name: row.primary ? 'PRIMARY' : row.name,
        unique: row.unique === true,
        primary: row.primary === true,
        type: 'btree',
        cardinality: null,
        columns: []
      })
    }
    indexMap.get(row.name).columns.push(row.columnName)
  }
  return Array.from(indexMap.values())
}

async function loadPostgresForeignKeys(entry, database, tableName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query(
    `SELECT con.conname AS name, a.attname AS "columnName",
            rt.relname AS "refTable", rn.nspname AS "refSchema", ra.attname AS "refColumn",
            con.confupdtype AS "updateRule", con.confdeltype AS "deleteRule"
     FROM pg_constraint con
     JOIN pg_class t ON t.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_class rt ON rt.oid = con.confrelid
     JOIN pg_namespace rn ON rn.oid = rt.relnamespace
     JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
     JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS rk(attnum, ord) ON rk.ord = k.ord
     JOIN pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = rk.attnum
     WHERE n.nspname = ? AND t.relname = ? AND con.contype = 'f'
     ORDER BY con.conname, k.ord`,
    [schema, tableName]
  )
  const fkMap = new Map()
  for (const row of result.rows) {
    if (!fkMap.has(row.name)) {
      fkMap.set(row.name, {
        name: row.name,
        refSchema: row.refSchema,
        refTable: row.refTable,
        updateRule: mapFkAction(row.updateRule),
        deleteRule: mapFkAction(row.deleteRule),
        columns: []
      })
    }
    fkMap.get(row.name).columns.push({ column: row.columnName, refColumn: row.refColumn })
  }
  return Array.from(fkMap.values())
}

async function loadPostgresTriggers(entry, database, tableName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query(
    `SELECT trigger_name AS name, event_manipulation AS event, action_timing AS timing,
            action_statement AS statement, action_order AS "sortOrder"
     FROM information_schema.triggers
     WHERE trigger_schema = ? AND event_object_table = ?
     ORDER BY trigger_name`,
    [schema, tableName]
  )
  return result.rows
}

async function getPostgresTableInfo(entry, database, tableName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query(
    `SELECT c.relname AS name,
            CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'VIEW' ELSE 'BASE TABLE' END AS type,
            CASE WHEN c.reltuples < 0 THEN 0 ELSE c.reltuples::bigint END AS "rowCount",
            pg_total_relation_size(c.oid) AS "dataLength",
            pg_indexes_size(c.oid) AS "indexLength",
            obj_description(c.oid) AS comment
     FROM pg_catalog.pg_class c
     JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = ? AND c.relname = ?`,
    [schema, tableName]
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    name: row.name,
    type: row.type,
    isView: row.type === 'VIEW',
    rowCount: Number(row.rowCount) || 0,
    dataLength: Number(row.dataLength) || 0,
    indexLength: Number(row.indexLength) || 0,
    comment: row.comment || ''
  }
}

function buildCreateTableDdl(entry, tableName, columns, primaryKeys, indexes, foreignKeys, comment) {
  const schema = schemaOf(entry.config)
  const definitions = columns.map((column) => {
    /* PostgreSQL 列定义 */
    const parts = [IDENT.quote(column.name), column.columnType]
    if (column.defaultValue) parts.push(`DEFAULT ${column.defaultValue}`)
    if (!column.nullable) parts.push('NOT NULL')
    return `  ${parts.join(' ')}`
  })
  if (primaryKeys.length) {
    definitions.push(`  PRIMARY KEY (${primaryKeys.map((key) => IDENT.quote(key)).join(', ')})`)
  }
  const statements = [`CREATE TABLE ${qualifyTable(IDENT, schema, tableName)} (\n${definitions.join(',\n')}\n);`]
  for (const index of indexes) {
    if (index.primary) continue
    statements.push(
      `CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX ${IDENT.quote(index.name)} ON ${qualifyTable(
        IDENT,
        schema,
        tableName
      )} (${index.columns.map((column) => IDENT.quote(column)).join(', ')});`
    )
  }
  for (const fk of foreignKeys) {
    statements.push(
      `ALTER TABLE ${qualifyTable(IDENT, schema, tableName)} ADD CONSTRAINT ${IDENT.quote(fk.name)} FOREIGN KEY (${fk.columns
        .map((item) => IDENT.quote(item.column))
        .join(', ')}) REFERENCES ${qualifyTable(IDENT, fk.refSchema, fk.refTable)} (${fk.columns
        .map((item) => IDENT.quote(item.refColumn))
        .join(', ')});`
    )
  }
  if (comment) {
    statements.push(
      `COMMENT ON TABLE ${qualifyTable(IDENT, schema, tableName)} IS '${String(comment).replace(/'/g, "''")}';`
    )
  }
  return statements.join('\n\n')
}

export async function getPostgresTableMeta(entry, database, tableName) {
  const info = await getPostgresTableInfo(entry, database, tableName)
  if (!info) throw new Error(t('表不存在'))
  const [columns, primaryKeys, indexes, foreignKeys, triggers] = await Promise.all([
    loadPostgresColumns(entry, database, tableName),
    loadPostgresPrimaryKeys(entry, database, tableName),
    loadPostgresIndexes(entry, database, tableName),
    loadPostgresForeignKeys(entry, database, tableName),
    loadPostgresTriggers(entry, database, tableName)
  ])
  const ddl =
    info.type === 'VIEW'
      ? await getPostgresViewDefinition(entry, database, tableName)
      : buildCreateTableDdl(entry, tableName, columns, primaryKeys, indexes, foreignKeys, info.comment)
  return {
    columns,
    primaryKeys,
    indexes,
    foreignKeys,
    triggers,
    info,
    ddl,
    isView: info.type === 'VIEW'
  }
}

async function getPostgresViewDefinition(entry, database, tableName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const result = await pool.query('SELECT pg_get_viewdef(?::regclass, true) AS ddl', [
    `${IDENT.quote(schema)}.${IDENT.quote(tableName)}`
  ])
  return result.rows[0]?.ddl || ''
}

export async function getPostgresObjectDefinition(entry, database, type, objectName) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  if (type === 'view') {
    return { success: true, type, name: objectName, ddl: await getPostgresViewDefinition(entry, database, objectName) }
  }
  if (type === 'table') {
    const meta = await getPostgresTableMeta(entry, database, objectName)
    return { success: true, type, name: objectName, ddl: meta.ddl }
  }
  if (type === 'function' || type === 'procedure') {
    const result = await pool.query(
      `SELECT pg_get_functiondef(p.oid) AS ddl
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = ? AND p.proname = ?
       ORDER BY p.oid LIMIT 1`,
      [schema, objectName]
    )
    return { success: true, type, name: objectName, ddl: result.rows[0]?.ddl || '' }
  }
  if (type === 'trigger') {
    const result = await pool.query(
      `SELECT pg_get_triggerdef(tg.oid) AS ddl
       FROM pg_trigger tg
       JOIN pg_class c ON c.oid = tg.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = ? AND tg.tgname = ? LIMIT 1`,
      [schema, objectName]
    )
    return { success: true, type, name: objectName, ddl: result.rows[0]?.ddl || '' }
  }
  return { success: false, error: t('不支持的对象类型') }
}

export async function queryPostgresObjects(entry, database, keyword = '') {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const keywordPattern = keyword ? `%${String(keyword).replace(/[\\%_]/g, '\\$&')}%` : null
  const items = []

  const tables = await pool.query(
    `SELECT c.relname AS name,
            CASE c.relkind WHEN 'v' THEN 'VIEW' WHEN 'm' THEN 'VIEW' ELSE 'TABLE' END AS type,
            obj_description(c.oid) AS comment
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = ? AND c.relkind IN ('r', 'p', 'v', 'm') ${keywordPattern ? 'AND c.relname ILIKE ?' : ''}
     ORDER BY c.relname LIMIT 300`,
    keywordPattern ? [schema, keywordPattern] : [schema]
  )
  for (const row of tables.rows) {
    items.push({
      type: row.type === 'VIEW' ? 'view' : 'table',
      name: row.name,
      detail: row.comment || (row.type === 'VIEW' ? t('视图') : t('表'))
    })
  }

  const columns = await pool.query(
    `SELECT a.attname AS name, c.relname AS "tableName",
            format_type(a.atttypid, a.atttypmod) AS "columnType"
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = ? AND a.attnum > 0 AND NOT a.attisdropped
       ${keywordPattern ? 'AND (a.attname ILIKE ? OR c.relname ILIKE ?)' : ''}
     ORDER BY c.relname, a.attnum LIMIT 300`,
    keywordPattern ? [schema, keywordPattern, keywordPattern] : [schema]
  )
  for (const row of columns.rows) {
    items.push({
      type: 'column',
      name: row.name,
      table: row.tableName,
      detail: `${row.tableName} · ${row.columnType}`
    })
  }

  const routines = await pool.query(
    `SELECT p.proname AS name, p.prokind AS kind
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = ? ${keywordPattern ? 'AND p.proname ILIKE ?' : ''}
     ORDER BY p.proname LIMIT 200`,
    keywordPattern ? [schema, keywordPattern] : [schema]
  )
  for (const row of routines.rows) {
    const isProcedure = row.kind === 'p'
    items.push({
      type: isProcedure ? 'procedure' : 'function',
      name: row.name,
      detail: isProcedure ? t('存储过程') : t('函数')
    })
  }

  const triggers = await pool.query(
    `SELECT tg.tgname AS name, c.relname AS "tableName"
     FROM pg_trigger tg
     JOIN pg_class c ON c.oid = tg.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = ? AND NOT tg.tgisinternal ${keywordPattern ? 'AND tg.tgname ILIKE ?' : ''}
     ORDER BY tg.tgname LIMIT 200`,
    keywordPattern ? [schema, keywordPattern] : [schema]
  )
  for (const row of triggers.rows) {
    items.push({ type: 'trigger', name: row.name, table: row.tableName, detail: row.tableName })
  }

  return { success: true, items }
}

export async function getPostgresErData(entry, database, limit = 200) {
  const pool = getPgPool(entry, database)
  const schema = schemaOf(entry.config)
  const tableLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 200, 1), 1000)
  const tables = await pool.query(
    `SELECT c.relname AS name, obj_description(c.oid) AS comment
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = ? AND c.relkind IN ('r', 'p')
     ORDER BY c.relname LIMIT ${tableLimit}`,
    [schema]
  )
  const columns = await pool.query(
    `SELECT c.relname AS "tableName", a.attname AS name,
            format_type(a.atttypid, a.atttypmod) AS "columnType",
            COALESCE(NULLIF(column_key.key, ''), '') AS "columnKey",
            NOT a.attnotnull AS nullable,
            COALESCE(col_description(c.oid, a.attnum), '') AS comment
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     LEFT JOIN LATERAL (
       SELECT CASE WHEN i.indisprimary THEN 'PRI' ELSE 'UNI' END AS key
       FROM pg_index i
       WHERE i.indrelid = c.oid AND a.attnum = ANY(i.indkey) AND (i.indisprimary OR i.indisunique)
       LIMIT 1
     ) column_key ON true
     WHERE n.nspname = ? AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY c.relname, a.attnum`,
    [schema]
  )
  const foreignKeys = await pool.query(
    `SELECT con.conname AS name, t.relname AS "tableName", a.attname AS "columnName",
            rt.relname AS "refTable", ra.attname AS "refColumn"
     FROM pg_constraint con
     JOIN pg_class t ON t.oid = con.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_class rt ON rt.oid = con.confrelid
     JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
     JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum
     JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS rk(attnum, ord) ON rk.ord = k.ord
     JOIN pg_attribute ra ON ra.attrelid = con.confrelid AND ra.attnum = rk.attnum
     WHERE n.nspname = ? AND con.contype = 'f'
     ORDER BY t.relname, con.conname, k.ord`,
    [schema]
  )

  const columnMap = new Map()
  for (const column of columns.rows) {
    if (!columnMap.has(column.tableName)) columnMap.set(column.tableName, [])
    columnMap.get(column.tableName).push(column)
  }

  return {
    success: true,
    tables: tables.rows.map((table) => ({
      name: table.name,
      comment: table.comment || '',
      columns: columnMap.get(table.name) || []
    })),
    foreignKeys: foreignKeys.rows
  }
}

export async function explainPostgresQuery(entry, database, sql) {
  const pool = getPgPool(entry, database)
  const planResult = await pool.query(`EXPLAIN (VERBOSE) ${sql}`)
  const rows = planResult.rows.map((row) => ({ 'QUERY PLAN': row['QUERY PLAN'] }))
  let json = null
  try {
    const jsonResult = await pool.query(`EXPLAIN (FORMAT JSON) ${sql}`)
    json = jsonResult.rows[0]?.['QUERY PLAN'] ?? null
  } catch {
    // JSON 计划不可用时忽略
  }
  return { success: true, rows, json }
}

export async function cancelPostgresQuery(entry, backendPid) {
  const pool = getPgPool(entry)
  const result = await pool.query('SELECT pg_cancel_backend(?) AS canceled', [Number(backendPid)])
  return result.rows[0]?.canceled === true
}

export async function queryPostgresConnectionInfo(entry) {
  const pool = getPgPool(entry)
  const result = await pool.query(
    `SELECT version() AS version, current_database() AS database,
            current_user AS "user", current_setting('server_encoding') AS encoding`
  )
  return result.rows[0] || null
}

export async function queryPostgresDatabaseInfo(entry, database) {
  const pool = getPgPool(entry)
  const result = await pool.query(
    `SELECT datname AS name, pg_encoding_to_char(encoding) AS charset,
            datcollate AS collation, pg_size_pretty(pg_database_size(datname)) AS size
     FROM pg_database WHERE datname = ?`,
    [database]
  )
  return result.rows[0] || null
}

export async function queryPostgresTableDetails(entry, database) {
  const { details } = await listPostgresTables(entry, database)
  return details.map((table) => ({
    name: table.name,
    rows: table.rowCount,
    dataSize: table.dataLength,
    engine: table.isView ? 'VIEW' : 'Heap',
    modified: '',
    comment: table.comment
  }))
}

export async function queryPostgresTableInfoRow(entry, database, tableName) {
  const info = await getPostgresTableInfo(entry, database, tableName)
  if (!info) return null
  const schema = schemaOf(entry.config)
  return {
    TABLE_NAME: info.name,
    TABLE_SCHEMA: schema,
    TABLE_TYPE: info.type,
    ENGINE: info.isView ? '' : 'Heap',
    TABLE_ROWS: info.rowCount,
    DATA_LENGTH: info.dataLength,
    INDEX_LENGTH: info.indexLength,
    TABLE_COMMENT: info.comment,
    CREATE_TIME: '',
    UPDATE_TIME: ''
  }
}

export async function listPostgresSessions(entry) {
  const pool = getPgPool(entry)
  const result = await pool.query(
    `SELECT pid, usename, application_name, client_addr, state,
            COALESCE(query, '') AS query, backend_start, state_change, query_start
     FROM pg_stat_activity
     WHERE datname = current_database() AND pid <> pg_backend_pid()
     ORDER BY backend_start`
  )
  return result.rows.map((row) => ({
    id: row.pid,
    user: row.usename,
    host: row.client_addr ? String(row.client_addr) : 'local',
    db: row.application_name || '',
    command: row.state || '',
    time: row.query_start ? Math.max(0, Math.floor((Date.now() - new Date(row.query_start).getTime()) / 1000)) : 0,
    state: row.state || '',
    info: row.query || ''
  }))
}

export async function killPostgresSession(entry, pid) {
  const pool = getPgPool(entry)
  const result = await pool.query('SELECT pg_terminate_backend(?) AS killed', [Number(pid)])
  return result.rows[0]?.killed === true
}
