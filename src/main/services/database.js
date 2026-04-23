import mysql from 'mysql2/promise'
import { log } from '../utils'

const connections = new Map()

export async function testConnection(config) {
  let connection = null
  try {
    const connConfig = {
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user,
      password: config.password
    }
    
    if (config.charset) {
      connConfig.charset = config.charset
    }
    
    if (config.connectTimeout) {
      connConfig.connectTimeout = config.connectTimeout * 1000
    }
    
    connection = await mysql.createConnection(connConfig)
    
    await connection.ping()
    
    return { success: true, message: '连接成功' }
  } catch (error) {
    log.error('测试连接失败:', error)
    return { 
      success: false, 
      error: error.message || '连接失败',
      code: error.code 
    }
  } finally {
    if (connection) {
      try {
        await connection.end()
      } catch (e) {
        // ignore - connection may already be closed
      }
    }
  }
}

export async function createConnection(name, config) {
  try {
    if (connections.has(name)) {
      const existing = connections.get(name)
      try {
        await existing.end()
      } catch (e) {
        // ignore
      }
      connections.delete(name)
    }
    
    const poolConfig = {
      host: config.host || 'localhost',
      port: config.port || 3306,
      user: config.user,
      password: config.password,
      waitForConnections: true,
      connectionLimit: config.connectionLimit || 10,
      queueLimit: 0
    }
    
    if (config.charset) {
      poolConfig.charset = config.charset
    }
    
    if (config.connectTimeout) {
      poolConfig.connectTimeout = config.connectTimeout * 1000
    }
    
    if (config.readTimeout) {
      poolConfig.waitTimeout = config.readTimeout * 1000
    }
    
    if (config.writeTimeout) {
      poolConfig.acquireTimeout = config.writeTimeout * 1000
    }
    
    const connection = await mysql.createPool(poolConfig)
    
    connections.set(name, connection)
    
    if (config.keepAliveInterval && config.keepAliveInterval > 0) {
      const keepAliveTimer = setInterval(async () => {
        const conn = connections.get(name)
        if (conn) {
          try {
            const poolConn = await conn.getConnection()
            await poolConn.ping()
            poolConn.release()
          } catch (e) {
            log.warn(`Keep-alive ping failed for ${name}:`, e.message)
          }
        }
      }, config.keepAliveInterval * 1000)
      connections.set(`${name}_keepalive`, keepAliveTimer)
    }
    
    log.info(`数据库连接创建成功: ${name}`)
    return { success: true, message: '连接创建成功' }
  } catch (error) {
    log.error('创建连接失败:', error)
    return { 
      success: false, 
      error: error.message || '创建连接失败',
      code: error.code 
    }
  }
}

export async function closeConnection(name) {
  try {
    const keepAliveTimer = connections.get(`${name}_keepalive`)
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer)
      connections.delete(`${name}_keepalive`)
    }
    
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    connections.delete(name)
    
    try {
      await connection.end()
    } catch (e) {
      // Connection may already be closed or in bad state
      if (e.code !== 'PROTOCOL_CONNECTION_CLOSED' && e.code !== 'PROTOCOL_ENQUEUE_AFTER_QUIT') {
        log.warn(`关闭连接时出错: ${name}`, e.message)
      }
    }
    
    log.info(`数据库连接已关闭: ${name}`)
    return { success: true, message: '连接已关闭' }
  } catch (error) {
    log.error('关闭连接失败:', error)
    return { 
      success: false, 
      error: error.message || '关闭连接失败' 
    }
  }
}

export async function closeAllConnections() {
  const names = Array.from(connections.keys()).filter(n => !n.endsWith('_keepalive'))
  const errors = []
  
  for (const name of names) {
    try {
      const keepAliveTimer = connections.get(`${name}_keepalive`)
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer)
        connections.delete(`${name}_keepalive`)
      }
      
      const connection = connections.get(name)
      if (connection) {
        await connection.end()
        log.info(`数据库连接已关闭: ${name}`)
      }
    } catch (error) {
      errors.push({ name, error: error.message })
      log.error(`关闭连接失败: ${name}`, error)
    }
    connections.delete(name)
  }
  
  connections.clear()
  
  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, message: '所有连接已关闭' }
}

const DEFAULT_LIMIT = 1000

function addLimitToQuery(sql, limit = DEFAULT_LIMIT) {
  const upperSql = sql.trim().toUpperCase()
  if (upperSql.startsWith('SELECT')) {
    if (!upperSql.includes(' LIMIT ')) {
      const limitMatch = upperSql.match(/\s+LIMIT\s+(\d+|\?)\s*$/i)
      if (!limitMatch) {
        return { sql: `${sql.trim()} LIMIT ${limit}`, limited: true }
      }
    }
  }
  return { sql, limited: false }
}

export async function executeQuery(name, sql, params = [], options = {}) {
  try {
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在，请先创建连接' }
    }
    
    const limit = options.limit ?? DEFAULT_LIMIT
    const autoLimit = options.autoLimit !== false
    let finalSql = sql
    
    if (autoLimit) {
      const result = addLimitToQuery(sql, limit)
      finalSql = result.sql
    }
    
    const startTime = Date.now()
    const [rows, fields] = await connection.query(finalSql, params)
    const duration = Date.now() - startTime
    
    log.info(`执行查询成功: ${name}, 耗时: ${duration}ms`)
    
    return { 
      success: true, 
      rows,
      fields,
      duration,
      rowCount: Array.isArray(rows) ? rows.length : (rows.affectedRows || 0)
    }
  } catch (error) {
    log.error('执行查询失败:', error)
    return { 
      success: false, 
      error: error.message || '执行查询失败',
      code: error.code,
      sql: error.sql 
    }
  }
}

export async function queryDatabases(name) {
  try {
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    const [rows] = await connection.execute('SHOW DATABASES')
    const databases = rows.map(row => row.Database)
    
    return { success: true, databases }
  } catch (error) {
    log.error('查询数据库列表失败:', error)
    return { success: false, error: error.message }
  }
}

export async function queryTables(name, database) {
  try {
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    if (database) {
      await connection.query(`USE \`${database}\``)
    }
    
    const [rows] = await connection.query('SHOW TABLES')
    const tables = rows.map(row => Object.values(row)[0])
    
    return { success: true, tables }
  } catch (error) {
    log.error('查询表列表失败:', error)
    return { success: false, error: error.message }
  }
}

export async function getTableStructure(name, database, tableName) {
  try {
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    if (database) {
      await connection.query(`USE \`${database}\``)
    }
    
    const [fields] = await connection.query(`DESCRIBE \`${tableName}\``)
    
    return { success: true, fields }
  } catch (error) {
    log.error('查询表结构失败:', error)
    return { success: false, error: error.message }
  }
}

export function getActiveConnections() {
  return Array.from(connections.keys())
}

export function isConnectionActive(name) {
  return connections.has(name)
}

export async function beginTransaction(name) {
  try {
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    const conn = await connection.getConnection()
    await conn.beginTransaction()
    conn.release()
    
    return { success: true, message: '事务已开始' }
  } catch (error) {
    log.error('开始事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function commitTransaction(name) {
  try {
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    const conn = await connection.getConnection()
    await conn.commit()
    conn.release()
    
    return { success: true, message: '事务已提交' }
  } catch (error) {
    log.error('提交事务失败:', error)
    return { success: false, error: error.message }
  }
}

export async function rollbackTransaction(name) {
  try {
    const connection = connections.get(name)
    if (!connection) {
      return { success: false, error: '连接不存在' }
    }
    
    const conn = await connection.getConnection()
    await conn.rollback()
    conn.release()
    
    return { success: true, message: '事务已回滚' }
  } catch (error) {
    log.error('回滚事务失败:', error)
    return { success: false, error: error.message }
  }
}