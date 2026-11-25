import { getEngineCapabilities, normalizeDatabaseEngine } from '../../../../shared/databaseEngines.js'
import { t } from '../../i18n.js'
import { runQuery } from '../helpers.js'
import { getDialect } from './dialect.js'
import { getPgPool, runPostgresClientQuery } from './postgres.js'
import { runSqliteQuery } from './sqlite.js'

export { getDialect, qualifyTable } from './dialect.js'

export function engineOf(entry) {
  return normalizeDatabaseEngine(entry?.engine)
}

export function capabilitiesOf(entry) {
  return getEngineCapabilities(engineOf(entry))
}

export function capabilityError() {
  return { success: false, error: t('当前数据库引擎暂不支持该功能') }
}

export function assertCapability(entry, feature) {
  const capabilities = capabilitiesOf(entry)
  if (capabilities[feature] === false) {
    throw new Error(t('当前数据库引擎暂不支持该功能'))
  }
}

export function tableRefOf(entry, database, tableName) {
  const engine = engineOf(entry)
  const dialect = getDialect(engine)
  if (engine === 'postgres') {
    const schema = String(entry.config?.schema || '').trim() || 'public'
    return `${dialect.quote(schema)}.${dialect.quote(tableName)}`
  }
  if (engine === 'mysql' && database) {
    return `${dialect.quote(database)}.${dialect.quote(tableName)}`
  }
  return dialect.quote(tableName)
}

export async function openEngineSession(entry, database) {
  const engine = engineOf(entry)
  if (engine === 'postgres') {
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
      engine,
      client,
      pid,
      database: database || entry.config.database || 'postgres',
      release: () => client.release()
    }
  }
  if (engine === 'sqlite') {
    return { engine, entry, database: database || '', release: () => {} }
  }
  const conn = await entry.pool.getConnection()
  if (database) {
    await conn.query(`USE \`${String(database).replace(/`/g, '``')}\``)
  }
  return {
    engine,
    conn,
    pid: conn.threadId,
    database: database || '',
    release: () => conn.release()
  }
}

export async function queryEngineSession(session, sql, params = [], timeout) {
  if (session.engine === 'postgres') {
    const text = getDialect('postgres').convertPlaceholders(sql)
    const result = await runPostgresClientQuery(session.client, text, params, timeout)
    return {
      raw: result.isSelect
        ? result.rows
        : {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows,
            insertId: result.insertId,
            info: result.info
          },
      fields: result.fields
    }
  }
  if (session.engine === 'sqlite') {
    const result = await runSqliteQuery(session.entry, session.database, sql, params)
    return {
      raw: result.isSelect
        ? result.rows
        : {
            affectedRows: result.affectedRows,
            changedRows: result.changedRows,
            insertId: result.insertId,
            info: result.info
          },
      fields: result.fields
    }
  }
  const [raw, fields] = await runQuery(session.conn, sql, params, timeout)
  return { raw, fields }
}

export async function runOnEntry(entry, database, sql, params = [], timeout) {
  const session = await openEngineSession(entry, database)
  try {
    return await queryEngineSession(session, sql, params, timeout)
  } finally {
    session.release()
  }
}
