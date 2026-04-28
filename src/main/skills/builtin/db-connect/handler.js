import { getConfig } from '../../../services/config.js'
import * as database from '../../../services/database.js'

export default async function handler(params, context) {
  const { log } = context
  const { action, connection_name } = params
  
  log.info('执行 db-connect Skill', params)
  
  const config = getConfig()
  const dbConnections = config.dbConnections || []
  
  switch (action) {
    case 'list': {
      const connections = dbConnections.map(conn => ({
        name: conn.name,
        host: conn.host,
        port: conn.port,
        user: conn.user,
        group: conn.group,
        active: database.isConnectionActive(conn.name)
      }))
      
      return {
        success: true,
        content: `可用数据库连接：\n${connections.map(c => 
          `- ${c.name} (${c.host}:${c.port}) ${c.active ? '✓ 已连接' : '○ 未连接'}`
        ).join('\n')}`,
        metadata: { connections }
      }
    }
    
    case 'test': {
      if (!connection_name) {
        return {
          success: false,
          error: '请指定要测试的连接名称'
        }
      }
      
      const connConfig = dbConnections.find(c => c.name === connection_name)
      if (!connConfig) {
        return {
          success: false,
          error: `连接配置 "${connection_name}" 不存在`
        }
      }
      
      const result = await database.testConnection({
        host: connConfig.host,
        port: connConfig.port,
        user: connConfig.user,
        password: connConfig.password,
        charset: connConfig.charset,
        connectTimeout: connConfig.connectTimeout
      })
      
      return {
        success: result.success,
        content: result.success 
          ? `连接测试成功：${connection_name}`
          : `连接测试失败：${result.error}`,
        metadata: result
      }
    }
    
    case 'connect': {
      if (!connection_name) {
        return {
          success: false,
          error: '请指定要连接的数据库名称'
        }
      }
      
      const connConfig = dbConnections.find(c => c.name === connection_name)
      if (!connConfig) {
        return {
          success: false,
          error: `连接配置 "${connection_name}" 不存在`
        }
      }
      
      const result = await database.createConnection(connection_name, {
        host: connConfig.host,
        port: connConfig.port,
        user: connConfig.user,
        password: connConfig.password,
        charset: connConfig.charset,
        connectionLimit: 10,
        connectTimeout: connConfig.connectTimeout,
        readTimeout: connConfig.readTimeout,
        writeTimeout: connConfig.writeTimeout,
        keepAliveInterval: connConfig.keepAliveInterval
      })
      
      return {
        success: result.success,
        content: result.success 
          ? `已成功连接到数据库：${connection_name}`
          : `连接失败：${result.error}`,
        metadata: result
      }
    }
    
    case 'disconnect': {
      if (!connection_name) {
        return {
          success: false,
          error: '请指定要断开的连接名称'
        }
      }
      
      const result = await database.closeConnection(connection_name)
      
      return {
        success: result.success,
        content: result.success 
          ? `已断开数据库连接：${connection_name}`
          : `断开连接失败：${result.error}`,
        metadata: result
      }
    }
    
    case 'status': {
      const activeConnections = database.getActiveConnections()
        .filter(n => !n.endsWith('_keepalive'))
      
      if (connection_name) {
        const isActive = database.isConnectionActive(connection_name)
        return {
          success: true,
          content: isActive 
            ? `连接 "${connection_name}" 当前已连接`
            : `连接 "${connection_name}" 当前未连接`,
          metadata: { connection_name, active: isActive }
        }
      }
      
      return {
        success: true,
        content: activeConnections.length > 0
          ? `当前活跃连接：${activeConnections.join(', ')}`
          : '当前没有活跃的数据库连接',
        metadata: { active_connections: activeConnections }
      }
    }
    
    default:
      return {
        success: false,
        error: `未知的操作类型：${action}`
      }
  }
}