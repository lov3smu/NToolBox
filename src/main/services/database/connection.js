import fs from 'fs'
import mysql from 'mysql2/promise'
import { normalizeDatabaseEngine } from '../../../shared/databaseEngines.js'
import { log } from '../../utils'
import { t } from '../i18n.js'
import { createSshTunnel } from './sshTunnel.js'
import { connections, transactions, runningQueries, getEntry } from './state.js'
import { quoteIdentifier } from './helpers.js'
import {
  acquirePostgresClient,
  closePostgresConnection,
  openPostgresConnection,
  releasePostgresClient,
  testPostgresConnection
} from './engines/postgres.js'
import {
  beginSqliteTransaction,
  closeSqliteConnection,
  commitSqliteTransaction,
  openSqliteConnection,
  rollbackSqliteTransaction,
  testSqliteConnection
} from './engines/sqlite.js'

function buildSslOptions(config) {
  if (!config.ssl?.enabled) return null
  const options = { rejectUnauthorized: config.ssl.verify !== false }
  const caPath = String(config.ssl.caPath || '').trim()
  if (caPath) {
    try {
      options.ca = fs.readFileSync(caPath)
    } catch (error) {
      throw new Error(t('读取 SSL CA 证书失败: {p0}', { p0: error.message }), { cause: error })
    }
  }
  return options
}

export function buildPoolConfig(config) {
  const poolConfig = {
    host: config.host || 'localhost',
    port: Number(config.port) || 3306,
    user: config.user,
    password: config.password,
    waitForConnections: true,
    connectionLimit: Number(config.connectionLimit) || 10,
    queueLimit: 0,
    supportBigNumbers: true,
    dateStrings: true
  }

  if (config.charset) {
    poolConfig.charset = config.charset
  }

  if (config.connectTimeout) {
    poolConfig.connectTimeout = Number(config.connectTimeout) * 1000
  }

  const ssl = buildSslOptions(config)
  if (ssl) {
    poolConfig.ssl = ssl
  }

  return poolConfig
}

export async function testConnection(config) {
  const engine = normalizeDatabaseEngine(config?.engine)
  if (engine === 'postgres') return testPostgresConnection(config || {})
  if (engine === 'sqlite') return testSqliteConnection(config || {})

  let connection = null
  let tunnel = null
  try {
    let host = config.host || 'localhost'
    let port = Number(config.port) || 3306

    if (config.ssh?.enabled) {
      tunnel = await createSshTunnel(`__test__:${Date.now()}`, config)
      host = '127.0.0.1'
      port = tunnel.localPort
    }

    const connConfig = {
      host,
      port,
      user: config.user,
      password: config.password,
      dateStrings: true,
      connectTimeout: config.connectTimeout ? Number(config.connectTimeout) * 1000 : 10000
    }

    if (config.charset) {
      connConfig.charset = config.charset
    }

    const ssl = buildSslOptions(config)
    if (ssl) {
      connConfig.ssl = ssl
    }

    connection = await mysql.createConnection(connConfig)
    await connection.ping()

    return { success: true, message: t('连接成功') }
  } catch (error) {
    log.error('测试连接失败:', error)
    return {
      success: false,
      error: error.message || t('连接失败'),
      code: error.code
    }
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch {
        // ignore - connection may already be closed
      }
    }
    if (tunnel) tunnel.close()
  }
}

async function openMySqlConnection(name, config) {
  let tunnel = null
  try {
    let effectiveConfig = config
    if (config.ssh?.enabled) {
      tunnel = await createSshTunnel(name, config)
      effectiveConfig = { ...config, host: '127.0.0.1', port: tunnel.localPort }
    }

    const pool = await mysql.createPool(buildPoolConfig(effectiveConfig))

    const entry = { name, engine: 'mysql', pool, config: { ...config }, keepAliveTimer: null, sshTunnel: tunnel }
    tunnel = null

    if (config.readOnly) {
      pool.on('connection', (rawConn) => {
        rawConn.query('SET SESSION TRANSACTION READ ONLY', (error) => {
          if (error) log.warn(`只读连接设置会话只读失败: ${name}:`, error.message)
        })
      })
    }

    if (config.keepAliveInterval && Number(config.keepAliveInterval) > 0) {
      entry.keepAliveTimer = setInterval(
        async () => {
          try {
            const conn = await pool.getConnection()
            try {
              await conn.ping()
            } finally {
              conn.release()
            }
          } catch (e) {
            log.warn(`Keep-alive ping failed for ${name}:`, e.message)
          }
        },
        Number(config.keepAliveInterval) * 1000
      )
      if (typeof entry.keepAliveTimer.unref === 'function') {
        entry.keepAliveTimer.unref()
      }
    }

    return entry
  } catch (error) {
    if (tunnel) tunnel.close()
    throw error
  }
}

export async function createConnection(name, config) {
  try {
    if (connections.has(name)) {
      await closeConnection(name)
    }

    const engine = normalizeDatabaseEngine(config?.engine)
    const entry =
      engine === 'postgres'
        ? await openPostgresConnection(name, config)
        : engine === 'sqlite'
          ? await openSqliteConnection(name, config)
          : await openMySqlConnection(name, config)

    connections.set(name, entry)

    log.info(`数据库连接创建成功: ${name} (${engine})`)
    return { success: true, message: t('连接创建成功') }
  } catch (error) {
    log.error('创建连接失败:', error)
    return {
      success: false,
      error: error.message || t('创建连接失败'),
      code: error.code
    }
  }
}

async function releaseTransaction(name) {
  const tx = transactions.get(name)
  if (!tx) return
  transactions.delete(name)
  try {
    if (tx.kind === 'postgres') {
      releasePostgresClient(tx)
    } else if (tx.conn) {
      await tx.conn.release()
    }
  } catch (e) {
    log.warn(`释放事务连接失败: ${name}`, e.message)
  }
}

async function closeEntry(entry) {
  if (entry.keepAliveTimer && entry.engine === 'mysql') {
    clearInterval(entry.keepAliveTimer)
  }
  if (entry.engine === 'postgres') {
    await closePostgresConnection(entry)
    return
  }
  if (entry.engine === 'sqlite') {
    await closeSqliteConnection(entry)
    return
  }
  try {
    await entry.pool.end()
  } catch (e) {
    if (e.code !== 'PROTOCOL_CONNECTION_CLOSED' && e.code !== 'PROTOCOL_ENQUEUE_AFTER_QUIT') {
      log.warn(`关闭连接时出错: ${entry.name}`, e.message)
    }
  }
  if (entry.sshTunnel) {
    entry.sshTunnel.close()
  }
}

export async function closeConnection(name) {
  try {
    await releaseTransaction(name)

    for (const [requestId, item] of runningQueries.entries()) {
      if (item.name === name) {
        runningQueries.delete(requestId)
      }
    }

    const entry = connections.get(name)
    if (!entry) {
      return { success: false, error: t('连接不存在') }
    }

    connections.delete(name)
    await closeEntry(entry)

    log.info(`数据库连接已关闭: ${name}`)
    return { success: true, message: t('连接已关闭') }
  } catch (error) {
    log.error('关闭连接失败:', error)
    return {
      success: false,
      error: error.message || t('关闭连接失败')
    }
  }
}

export async function closeAllConnections() {
  const names = Array.from(connections.keys())
  const errors = []

  for (const name of names) {
    const result = await closeConnection(name)
    if (!result.success) {
      errors.push({ name, error: result.error })
    }
  }

  connections.clear()
  transactions.clear()
  runningQueries.clear()

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, message: t('所有连接已关闭') }
}

async function beginEngineTransaction(entry, database) {
  if (entry.engine === 'postgres') {
    const tx = await acquirePostgresClient(entry, database)
    await tx.client.query('BEGIN')
    tx.kind = 'postgres'
    tx.database = database || entry.config.database || 'postgres'
    return tx
  }
  if (entry.engine === 'sqlite') {
    return beginSqliteTransaction(entry)
  }
  const conn = await entry.pool.getConnection()
  try {
    if (database) {
      await conn.query(`USE ${quoteIdentifier(database)}`)
    }
    await conn.beginTransaction()
  } catch (error) {
    conn.release()
    throw error
  }
  return { conn, database: database || '', kind: 'mysql' }
}

export async function beginTransaction(name, database) {
  try {
    if (transactions.has(name)) {
      return { success: false, error: t('当前连接已在事务中') }
    }

    const entry = getEntry(name)
    const tx = await beginEngineTransaction(entry, database)
    transactions.set(name, tx)

    return { success: true, message: t('事务已开始') }
  } catch (error) {
    log.error('开始事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function commitTransaction(name) {
  try {
    const tx = transactions.get(name)
    if (!tx) {
      return { success: false, error: t('当前连接没有进行中的事务') }
    }

    if (tx.kind === 'postgres') {
      await tx.client.query('COMMIT')
    } else if (tx.kind === 'sqlite') {
      await commitSqliteTransaction(tx)
    } else {
      await tx.conn.commit()
    }
    await releaseTransaction(name)

    return { success: true, message: t('事务已提交') }
  } catch (error) {
    log.error('提交事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function rollbackTransaction(name) {
  try {
    const tx = transactions.get(name)
    if (!tx) {
      return { success: false, error: t('当前连接没有进行中的事务') }
    }

    if (tx.kind === 'postgres') {
      await tx.client.query('ROLLBACK')
    } else if (tx.kind === 'sqlite') {
      await rollbackSqliteTransaction(tx)
    } else {
      await tx.conn.rollback()
    }
    await releaseTransaction(name)

    return { success: true, message: t('事务已回滚') }
  } catch (error) {
    log.error('回滚事务失败:', error)
    return { success: false, error: error.message }
  }
}
