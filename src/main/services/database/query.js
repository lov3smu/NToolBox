import mysql from 'mysql2/promise'
import { log } from '../../utils'
import { t } from '../i18n.js'
import { splitSqlStatements } from '../../../shared/sqlStatements.js'
import { getEntry, transactions, runningQueries } from './state.js'
import { buildPoolConfig } from './connection.js'
import { engineOf, openEngineSession, queryEngineSession } from './engines/index.js'
import { cancelPostgresQuery, explainPostgresQuery } from './engines/postgres.js'
import { explainSqliteQuery, runSqliteScript } from './engines/sqlite.js'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  readOnlyBlock,
  auditSqlResult,
  addLimitToQuery,
  normalizeResult,
  toErrorResult,
  runQuery,
  quoteIdentifier
} from './helpers.js'

function isCanceledError(error) {
  return (
    error?.code === 'ER_QUERY_INTERRUPTED' ||
    error?.code === '57014' ||
    /canceling statement due to user request/i.test(String(error?.message || ''))
  )
}

async function executeEngineQuery(entry, name, sql, params, options, startedAt) {
  let session = null
  let shouldRelease = false
  const requestId = options.requestId

  try {
    const tx = transactions.get(name)
    if (tx) {
      session = tx
    } else {
      session = await openEngineSession(entry, options.database)
      shouldRelease = true
    }

    if (requestId) {
      runningQueries.set(requestId, { name, backendPid: session.pid || 0 })
    }

    const autoLimit = options.autoLimit === true
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(options.limit) || DEFAULT_LIMIT))
    const finalSql = autoLimit ? addLimitToQuery(sql, limit) : sql

    const { raw, fields } = await queryEngineSession(session, finalSql, params, options.timeout)
    const duration = Date.now() - startedAt

    log.info(`执行查询成功: ${name} (${entry.engine}), 耗时: ${duration}ms`)

    return auditSqlResult(name, options.database, sql, normalizeResult(raw, fields, duration), duration, 'query')
  } catch (error) {
    const duration = Date.now() - startedAt
    if (isCanceledError(error)) {
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
    if (session && shouldRelease) {
      session.release()
    }
  }
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

    if (engineOf(entry) !== 'mysql') {
      return executeEngineQuery(entry, name, sql, params, options, startedAt)
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

async function executeEngineScript(entry, name, sql, options) {
  const engine = engineOf(entry)
  const statements = splitSqlStatements(sql)
  const results = []
  let affectedRows = 0
  let rows = []
  let fields = []

  if (engine === 'sqlite') {
    const outcome = await runSqliteScript(entry, options.database, sql)
    return {
      results: outcome.results,
      statementCount: outcome.statementCount,
      rows: outcome.rows,
      fields: outcome.fields,
      affectedRows: outcome.affectedRows
    }
  }

  const tx = transactions.get(name)
  const session = tx || (await openEngineSession(entry, options.database))
  try {
    for (const statement of statements) {
      const { raw, fields: statementFields } = await queryEngineSession(session, statement, [], options.timeout)
      const result = normalizeResult(raw, statementFields, 0)
      results.push(result)
      if (result.isSelect) {
        rows = result.rows
        fields = result.fields
      } else {
        affectedRows += result.affectedRows || 0
      }
    }
  } finally {
    if (!tx) session.release()
  }

  return { results, statementCount: statements.length, rows, fields, affectedRows }
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

    if (engineOf(entry) !== 'mysql') {
      const outcome = await executeEngineScript(entry, name, sql, options)
      const duration = Date.now() - startedAt
      log.info(`执行脚本成功: ${name} (${entry.engine}), 语句: ${outcome.statementCount}, 耗时: ${duration}ms`)
      const result = {
        success: true,
        duration,
        statementCount: outcome.statementCount,
        rows: outcome.rows,
        fields: outcome.fields,
        rowCount: outcome.rows.length,
        affectedRows: outcome.affectedRows,
        isSelect: outcome.rows.length > 0
      }
      return auditSqlResult(name, options.database, sql, result, duration, 'script')
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

    if (engineOf(entry) === 'postgres') {
      const pid = Number(item.backendPid)
      if (!Number.isInteger(pid) || pid <= 0) {
        return { success: false, error: t('无法获取查询线程') }
      }
      await cancelPostgresQuery(entry, pid)
      log.info(`已请求取消查询: ${name}, pid: ${pid}`)
      return { success: true, message: t('已发送取消请求') }
    }

    if (engineOf(entry) === 'sqlite') {
      return { success: false, error: t('当前数据库引擎暂不支持该功能') }
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
    if (engineOf(entry) === 'postgres') {
      return await explainPostgresQuery(entry, database, trimmed)
    }
    if (engineOf(entry) === 'sqlite') {
      return explainSqliteQuery(entry, database, trimmed)
    }

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
