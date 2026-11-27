import { log } from '../../utils'
import { t } from '../i18n.js'
import { getEntry } from './state.js'
import { optionalQuery, toErrorResult } from './helpers.js'
import { capabilityError, engineOf } from './engines/index.js'
import { cancelPostgresQuery, killPostgresSession, listPostgresSessions } from './engines/postgres.js'

async function loadProcesslist(conn) {
  try {
    const [rows] = await conn.query(
      `SELECT ID AS id, USER AS user, HOST AS host, DB AS db, COMMAND AS command,
              TIME AS time, STATE AS state, INFO AS info
       FROM information_schema.PROCESSLIST`
    )
    return rows
  } catch {
    const [rows] = await conn.query('SHOW PROCESSLIST')
    return rows.map((row) => ({
      id: row.Id,
      user: row.User,
      host: row.Host,
      db: row.db,
      command: row.Command,
      time: row.Time,
      state: row.State,
      info: row.Info
    }))
  }
}

function normalizeTrxId(value) {
  return value === null || value === undefined ? '' : String(value)
}

export async function getSessionInfo(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) === 'sqlite') return capabilityError()
    if (engineOf(entry) === 'postgres') {
      const sessions = await listPostgresSessions(entry)
      return {
        success: true,
        selfId: 0,
        version: 'PostgreSQL',
        sessions: sessions.map((session) => ({ ...session, isSelf: false })),
        transactions: [],
        locks: [],
        waits: [],
        deadlockText: ''
      }
    }
    conn = await entry.pool.getConnection()

    const [identityRows] = await conn.query('SELECT CONNECTION_ID() AS id, VERSION() AS version')
    const selfId = Number(identityRows[0]?.id) || 0
    const version = String(identityRows[0]?.version || '')

    const sessions = (await loadProcesslist(conn)).map((row) => ({
      id: Number(row.id) || 0,
      user: row.user || '',
      host: row.host || '',
      db: row.db || '',
      command: row.command || '',
      time: Number(row.time) || 0,
      state: row.state || '',
      info: row.info || '',
      isSelf: Number(row.id) === selfId
    }))
    sessions.sort((left, right) => right.time - left.time)

    const trxRows =
      (await optionalQuery(
        conn,
        `SELECT trx_id AS trxId, trx_state AS state, trx_started AS started,
                trx_wait_started AS waitStarted, trx_mysql_thread_id AS threadId,
                trx_rows_locked AS rowsLocked, trx_rows_modified AS rowsModified,
                trx_query AS query
         FROM information_schema.INNODB_TRX`
      )) || []
    const trxMap = new Map()
    const transactions = trxRows.map((row) => {
      const transaction = {
        trxId: normalizeTrxId(row.trxId),
        state: row.state || '',
        started: row.started ? new Date(row.started).toISOString() : '',
        waitStarted: row.waitStarted ? new Date(row.waitStarted).toISOString() : '',
        threadId: Number(row.threadId) || 0,
        rowsLocked: Number(row.rowsLocked) || 0,
        rowsModified: Number(row.rowsModified) || 0,
        query: row.query || ''
      }
      trxMap.set(transaction.trxId, transaction)
      return transaction
    })
    transactions.sort((left, right) => {
      if (left.state === 'LOCK WAIT' && right.state !== 'LOCK WAIT') return -1
      if (right.state === 'LOCK WAIT' && left.state !== 'LOCK WAIT') return 1
      return String(left.started).localeCompare(String(right.started))
    })

    let lockRows = await optionalQuery(
      conn,
      `SELECT ENGINE_TRANSACTION_ID AS trxId, ENGINE_LOCK_ID AS lockId,
              OBJECT_SCHEMA AS db, OBJECT_NAME AS tableName, INDEX_NAME AS indexName,
              LOCK_TYPE AS lockType, LOCK_MODE AS lockMode, LOCK_STATUS AS lockStatus
       FROM performance_schema.data_locks`
    )
    if (!lockRows) {
      lockRows = await optionalQuery(
        conn,
        `SELECT lock_trx_id AS trxId, lock_id AS lockId, lock_type AS lockType,
                lock_mode AS lockMode, lock_table AS lockTable, lock_index AS indexName
         FROM information_schema.INNODB_LOCKS`
      )
    }
    lockRows = lockRows || []

    let waitRows = await optionalQuery(
      conn,
      `SELECT REQUESTING_ENGINE_TRANSACTION_ID AS waitingTrxId,
              BLOCKING_ENGINE_TRANSACTION_ID AS blockingTrxId,
              REQUESTING_ENGINE_LOCK_ID AS waitingLockId,
              BLOCKING_ENGINE_LOCK_ID AS blockingLockId
       FROM performance_schema.data_lock_waits`
    )
    if (!waitRows) {
      waitRows = await optionalQuery(
        conn,
        `SELECT requesting_trx_id AS waitingTrxId, blocking_trx_id AS blockingTrxId,
                requested_lock_id AS waitingLockId, blocking_lock_id AS blockingLockId
         FROM information_schema.INNODB_LOCK_WAITS`
      )
    }
    waitRows = waitRows || []

    const waitingLockIds = new Set(waitRows.map((row) => String(row.waitingLockId || '')))
    const locks = lockRows.map((row) => {
      const trxId = normalizeTrxId(row.trxId)
      const transaction = trxMap.get(trxId)
      let db = row.db || ''
      let tableName = row.tableName || ''
      if (!db && row.lockTable) {
        const match = /^`([^`]+)`\.`([^`]+)`$/.exec(String(row.lockTable))
        if (match) {
          db = match[1]
          tableName = match[2]
        } else {
          tableName = String(row.lockTable)
        }
      }
      const lockStatus = row.lockStatus || (waitingLockIds.has(String(row.lockId || '')) ? 'WAITING' : 'GRANTED')
      return {
        lockId: String(row.lockId || ''),
        trxId,
        processId: transaction?.threadId || 0,
        db,
        tableName,
        indexName: row.indexName || '',
        lockType: row.lockType || '',
        lockMode: row.lockMode || '',
        lockStatus
      }
    })
    const lockMap = new Map(locks.map((lock) => [lock.lockId, lock]))

    const waits = waitRows.map((row) => {
      const waiting = trxMap.get(normalizeTrxId(row.waitingTrxId))
      const blocking = trxMap.get(normalizeTrxId(row.blockingTrxId))
      const waitingLock = lockMap.get(String(row.waitingLockId || ''))
      const blockingLock = lockMap.get(String(row.blockingLockId || ''))
      return {
        waitingTrxId: normalizeTrxId(row.waitingTrxId),
        blockingTrxId: normalizeTrxId(row.blockingTrxId),
        waitingThreadId: waiting?.threadId || waitingLock?.processId || 0,
        blockingThreadId: blocking?.threadId || blockingLock?.processId || 0,
        waitingQuery: waiting?.query || '',
        blockingQuery: blocking?.query || '',
        db: waitingLock?.db || blockingLock?.db || '',
        tableName: waitingLock?.tableName || blockingLock?.tableName || '',
        waitingLockMode: waitingLock?.lockMode || '',
        blockingLockMode: blockingLock?.lockMode || ''
      }
    })

    const engineRows = await optionalQuery(conn, 'SHOW ENGINE INNODB STATUS')
    const engineStatus = engineRows?.[0]?.Status || ''
    let deadlockText = ''
    const deadlockIndex = engineStatus.indexOf('LATEST DETECTED DEADLOCK')
    if (deadlockIndex >= 0) {
      const endIndex = engineStatus.indexOf('TRANSACTIONS', deadlockIndex)
      deadlockText = engineStatus
        .slice(deadlockIndex, endIndex > deadlockIndex ? endIndex : deadlockIndex + 4000)
        .trim()
    }

    return {
      success: true,
      selfId,
      version,
      sessions,
      transactions,
      locks,
      waits,
      deadlockText
    }
  } catch (error) {
    log.error('读取会话信息失败:', error)
    return toErrorResult(error, t('读取会话信息失败'))
  } finally {
    conn?.release()
  }
}

export async function killSession(name, threadId, mode = 'connection') {
  let conn = null
  try {
    const id = Number(threadId)
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(t('无效的会话 ID'))
    }

    const entry = getEntry(name)
    if (engineOf(entry) === 'sqlite') return capabilityError()
    if (engineOf(entry) === 'postgres') {
      if (mode === 'query') {
        const canceled = await cancelPostgresQuery(entry, id)
        if (!canceled) return { success: false, error: t('操作会话失败') }
        log.info(`已请求取消会话查询: ${name}, pid: ${id}`)
        return { success: true, message: t('已取消该会话正在执行的查询') }
      }
      const killed = await killPostgresSession(entry, id)
      if (!killed) return { success: false, error: t('操作会话失败') }
      log.info(`已终止会话: ${name}, pid: ${id}`)
      return { success: true, message: t('会话已终止') }
    }
    conn = await entry.pool.getConnection()
    const [identityRows] = await conn.query('SELECT CONNECTION_ID() AS id')
    if (Number(identityRows[0]?.id) === id) {
      throw new Error(t('不能操作当前正在使用的会话'))
    }

    if (mode === 'query') {
      await conn.query(`KILL QUERY ${id}`)
      log.info(`已请求取消会话查询: ${name}, thread: ${id}`)
      return { success: true, message: t('已取消该会话正在执行的查询') }
    }

    await conn.query(`KILL CONNECTION ${id}`)
    log.info(`已终止会话: ${name}, thread: ${id}`)
    return { success: true, message: t('会话已终止') }
  } catch (error) {
    log.error('操作会话失败:', error)
    return toErrorResult(error, t('操作会话失败'))
  } finally {
    conn?.release()
  }
}

function parseStatusCounters(rows = []) {
  const counters = {}
  for (const row of rows) {
    counters[row.Variable_name] = row.Value
  }
  return counters
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

export async function queryServerStatus(name) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) !== 'mysql') return capabilityError()
    conn = await entry.pool.getConnection()

    const [identityRows] = await conn.query(
      'SELECT VERSION() AS version, CURRENT_USER() AS currentUser, @@max_connections AS maxConnections'
    )
    const identity = identityRows[0] || {}
    const [statusRows] = await conn.query('SHOW GLOBAL STATUS')
    const counters = parseStatusCounters(statusRows)
    const variableRows =
      (await optionalQuery(
        conn,
        `SHOW GLOBAL VARIABLES WHERE Variable_name IN
           ('slow_query_log', 'long_query_time', 'innodb_buffer_pool_size', 'performance_schema')`
      )) || []
    const variables = {}
    for (const row of variableRows) variables[row.Variable_name] = row.Value

    const uptime = toFiniteNumber(counters.Uptime)
    const questions = toFiniteNumber(counters.Questions)
    const readRequests = toFiniteNumber(counters.Innodb_buffer_pool_read_requests)
    const reads = toFiniteNumber(counters.Innodb_buffer_pool_reads)
    const hitRate = readRequests > 0 ? Math.max(0, Math.min(1, 1 - reads / readRequests)) : null

    return {
      success: true,
      sampledAt: Date.now(),
      version: String(identity.version || ''),
      currentUser: String(identity.currentUser || ''),
      uptimeSeconds: uptime,
      questions,
      qpsAvg: uptime > 0 ? questions / uptime : 0,
      threadsConnected: toFiniteNumber(counters.Threads_connected),
      threadsRunning: toFiniteNumber(counters.Threads_running),
      maxConnections: toFiniteNumber(identity.maxConnections),
      slowQueries: toFiniteNumber(counters.Slow_queries),
      abortedConnects: toFiniteNumber(counters.Aborted_connects),
      slowQueryLog: variables.slow_query_log === 'ON',
      longQueryTime: toFiniteNumber(variables.long_query_time),
      performanceSchema: variables.performance_schema === 'ON',
      bufferPool: {
        sizeMb: Math.round(toFiniteNumber(variables.innodb_buffer_pool_size) / 1048576),
        pagesTotal: toFiniteNumber(counters.Innodb_buffer_pool_pages_total),
        pagesFree: toFiniteNumber(counters.Innodb_buffer_pool_pages_free),
        readRequests,
        reads,
        hitRate
      }
    }
  } catch (error) {
    log.error('读取实例状态失败:', error)
    return toErrorResult(error, t('读取实例状态失败'))
  } finally {
    conn?.release()
  }
}

export async function querySlowQueries(name, database = '', limit = 10) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) !== 'mysql') return capabilityError()
    conn = await entry.pool.getConnection()

    const [enabledRows] = await conn.query('SELECT @@performance_schema AS enabled')
    if (!Number(enabledRows[0]?.enabled)) {
      return { success: true, enabled: false, reason: t('performance_schema 未启用'), queries: [] }
    }

    const max = Math.min(50, Math.max(1, Number(limit) || 10))
    const params = []
    let where = 'DIGEST_TEXT IS NOT NULL'
    if (database) {
      where += ' AND SCHEMA_NAME = ?'
      params.push(database)
    }

    const [rows] = await conn.query(
      `SELECT DIGEST_TEXT AS \`sql\`, COUNT_STAR AS executions,
              ROUND(AVG_TIMER_WAIT / 1000000000, 2) AS avgMs,
              ROUND(MAX_TIMER_WAIT / 1000000000, 2) AS maxMs,
              ROUND(SUM_TIMER_WAIT / 1000000000, 2) AS totalMs,
              SUM_ROWS_EXAMINED AS rowsExamined, SUM_ROWS_SENT AS rowsSent
       FROM performance_schema.events_statements_summary_by_digest
       WHERE ${where}
       ORDER BY SUM_TIMER_WAIT DESC
       LIMIT ${max}`,
      params
    )

    return {
      success: true,
      enabled: true,
      queries: rows.map((row) => ({
        sql: String(row.sql || ''),
        executions: toFiniteNumber(row.executions),
        avgMs: toFiniteNumber(row.avgMs),
        maxMs: toFiniteNumber(row.maxMs),
        totalMs: toFiniteNumber(row.totalMs),
        rowsExamined: toFiniteNumber(row.rowsExamined),
        rowsSent: toFiniteNumber(row.rowsSent)
      }))
    }
  } catch (error) {
    return {
      success: true,
      enabled: false,
      reason: error.message || t('无法读取 performance_schema'),
      queries: []
    }
  } finally {
    conn?.release()
  }
}

const MB = 1024 * 1024

function formatBytesForMessage(bytes) {
  const value = Number(bytes) || 0
  if (value >= 1024 * MB) return `${(value / (1024 * MB)).toFixed(2)} GB`
  if (value >= MB) return `${(value / MB).toFixed(2)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${Math.round(value)} B`
}

export async function queryDatabaseHealth(name, database) {
  let conn = null
  try {
    const entry = getEntry(name)
    if (engineOf(entry) !== 'mysql') return capabilityError()
    const dbName = String(database || '').trim()
    if (!dbName) throw new Error(t('请选择要检查的数据库'))
    conn = await entry.pool.getConnection()

    const [tableRows] = await conn.query(
      `SELECT TABLE_NAME AS name, ENGINE AS engine, TABLE_ROWS AS rowEstimate,
              DATA_LENGTH AS dataLength, INDEX_LENGTH AS indexLength, DATA_FREE AS dataFree,
              AVG_ROW_LENGTH AS avgRowLength, TABLE_COLLATION AS collation, TABLE_COMMENT AS comment,
              UPDATE_TIME AS updateTime
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY (IFNULL(DATA_LENGTH, 0) + IFNULL(INDEX_LENGTH, 0)) DESC`,
      [dbName]
    )
    const [primaryRows] = await conn.query(
      `SELECT DISTINCT TABLE_NAME AS name FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND INDEX_NAME = 'PRIMARY'`,
      [dbName]
    )
    const [indexRows] = await conn.query(
      `SELECT TABLE_NAME AS name, COUNT(DISTINCT INDEX_NAME) AS indexCount
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? GROUP BY TABLE_NAME`,
      [dbName]
    )
    const [viewRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'VIEW'`,
      [dbName]
    )
    const [identityRows] = await conn.query(
      'SELECT VERSION() AS version, CURRENT_USER() AS currentUser, @@max_connections AS maxConnections'
    )
    const identity = identityRows[0] || {}
    const variableRows =
      (await optionalQuery(
        conn,
        `SHOW GLOBAL VARIABLES WHERE Variable_name IN
           ('log_bin', 'slow_query_log', 'long_query_time', 'innodb_buffer_pool_size',
            'innodb_file_per_table', 'performance_schema')`
      )) || []
    const variables = {}
    for (const row of variableRows) variables[row.Variable_name] = row.Value
    const statusRows =
      (await optionalQuery(conn, `SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected', 'Uptime')`)) || []
    const counters = parseStatusCounters(statusRows)

    const primarySet = new Set(primaryRows.map((row) => row.name))
    const indexMap = new Map(indexRows.map((row) => [row.name, toFiniteNumber(row.indexCount)]))

    const tables = tableRows.map((row) => {
      const dataLength = toFiniteNumber(row.dataLength)
      const indexLength = toFiniteNumber(row.indexLength)
      const dataFree = toFiniteNumber(row.dataFree)
      const totalLength = dataLength + indexLength
      const indexCount = indexMap.get(row.name) || 0
      return {
        name: String(row.name || ''),
        engine: String(row.engine || ''),
        rowEstimate: toFiniteNumber(row.rowEstimate),
        dataLength,
        indexLength,
        totalLength,
        dataFree,
        freeRatio: dataLength > 0 ? Math.min(1, dataFree / dataLength) : 0,
        hasPrimaryKey: primarySet.has(row.name),
        indexCount,
        collation: String(row.collation || ''),
        comment: String(row.comment || ''),
        updateTime: row.updateTime || null
      }
    })

    const totals = tables.reduce(
      (acc, table) => {
        acc.dataLength += table.dataLength
        acc.indexLength += table.indexLength
        acc.dataFree += table.dataFree
        acc.rowEstimate += table.rowEstimate
        return acc
      },
      { dataLength: 0, indexLength: 0, dataFree: 0, rowEstimate: 0 }
    )

    const issues = []
    for (const table of tables) {
      if (!table.hasPrimaryKey) {
        issues.push({
          level: 'warn',
          scope: 'table',
          table: table.name,
          title: t('缺少主键'),
          detail: t('无主键会影响主从复制与行级更新效率，建议补充自增或唯一主键')
        })
      }
      if (table.engine && table.engine.toLowerCase() !== 'innodb') {
        issues.push({
          level: 'warn',
          scope: 'table',
          table: table.name,
          title: t('非 InnoDB 引擎（{p0}）', { p0: table.engine }),
          detail: t('MyISAM 等引擎不支持事务与崩溃恢复，建议转换为 InnoDB')
        })
      }
      if (!table.indexCount) {
        issues.push({
          level: 'info',
          scope: 'table',
          table: table.name,
          title: t('没有任何索引'),
          detail: t('按条件查询只能全表扫描，建议为常用过滤字段建立索引')
        })
      }
      if (table.dataFree > MB && table.freeRatio >= 0.2) {
        issues.push({
          level: 'info',
          scope: 'table',
          table: table.name,
          title: t('存在可回收空间'),
          detail: t('空闲 {p0}（占数据量 {p1}%），可执行 OPTIMIZE TABLE 回收', {
            p0: formatBytesForMessage(table.dataFree),
            p1: Math.round(table.freeRatio * 100)
          })
        })
      }
    }

    const bufferPoolBytes = toFiniteNumber(variables.innodb_buffer_pool_size)
    const bufferPoolMb = Math.round(bufferPoolBytes / MB)
    const threadsConnected = toFiniteNumber(counters.Threads_connected)
    const maxConnections = toFiniteNumber(identity.maxConnections)
    const connectionUsage = maxConnections > 0 ? Math.min(1, threadsConnected / maxConnections) : 0
    const slowQueryOn = variables.slow_query_log === 'ON'
    const binlogOn = variables.log_bin === 'ON'
    const filePerTableOn = variables.innodb_file_per_table === 'ON'

    if (!binlogOn) {
      issues.push({
        level: 'info',
        scope: 'server',
        title: t('binlog 未开启'),
        detail: t('无法进行时间点恢复与主从复制，若需要请开启 log_bin')
      })
    }
    if (!slowQueryOn) {
      issues.push({
        level: 'info',
        scope: 'server',
        title: t('慢查询日志未开启'),
        detail: t('开启 slow_query_log 后可配合慢查询面板定位性能问题')
      })
    }
    if (!filePerTableOn) {
      issues.push({
        level: 'warn',
        scope: 'server',
        title: t('innodb_file_per_table 已关闭'),
        detail: t('独立表空间关闭后，单表删除或整理无法释放磁盘空间')
      })
    }
    if (bufferPoolBytes > 0 && totals.dataLength > bufferPoolBytes * 2) {
      issues.push({
        level: 'info',
        scope: 'server',
        title: t('缓冲池小于数据量'),
        detail: t('InnoDB 缓冲池 {p0}，数据量 {p1}，热点数据可能频繁读盘', {
          p0: formatBytesForMessage(bufferPoolBytes),
          p1: formatBytesForMessage(totals.dataLength)
        })
      })
    }
    if (connectionUsage >= 0.8) {
      issues.push({
        level: 'warn',
        scope: 'server',
        title: t('连接数接近上限'),
        detail: t('当前 {p0} / {p1}（{p2}%），建议检查连接释放或调大 max_connections', {
          p0: threadsConnected,
          p1: maxConnections,
          p2: Math.round(connectionUsage * 100)
        })
      })
    }

    const levelWeight = { warn: 0, info: 1 }
    issues.sort((left, right) => (levelWeight[left.level] ?? 9) - (levelWeight[right.level] ?? 9))

    return {
      success: true,
      sampledAt: Date.now(),
      database: dbName,
      version: String(identity.version || ''),
      currentUser: String(identity.currentUser || ''),
      uptimeSeconds: toFiniteNumber(counters.Uptime),
      totals: {
        tableCount: tables.length,
        viewCount: toFiniteNumber(viewRows[0]?.total),
        dataLength: totals.dataLength,
        indexLength: totals.indexLength,
        totalLength: totals.dataLength + totals.indexLength,
        dataFree: totals.dataFree,
        rowEstimate: totals.rowEstimate
      },
      tables: tables.slice(0, 50),
      issues,
      server: {
        binlog: binlogOn,
        slowQueryLog: slowQueryOn,
        longQueryTime: toFiniteNumber(variables.long_query_time),
        bufferPoolMb,
        filePerTable: filePerTableOn,
        performanceSchema: variables.performance_schema === 'ON',
        threadsConnected,
        maxConnections,
        connectionUsage
      }
    }
  } catch (error) {
    log.error('数据库健康检查失败:', error)
    return toErrorResult(error, t('数据库健康检查失败'))
  } finally {
    conn?.release()
  }
}
