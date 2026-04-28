import * as database from '../../../services/database.js' // eslint-disable-line no-unused-vars

const ALLOWED_SQL_KEYWORDS = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH']
const FORBIDDEN_SQL_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'REPLACE', 'GRANT', 'REVOKE']

function validateSQLSafety(sql) {
  const upperSQL = sql.trim().toUpperCase()
  
  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    if (upperSQL.startsWith(keyword) || upperSQL.includes(keyword + ' ') || upperSQL.includes(keyword + '\n')) {
      return {
        safe: false,
        error: `安全限制：禁止执行 ${keyword} 语句。只允许执行查询类语句（SELECT、SHOW、DESCRIBE等）。`
      }
    }
  }
  
  const isAllowed = ALLOWED_SQL_KEYWORDS.some(keyword => upperSQL.startsWith(keyword))
  
  if (!isAllowed) {
    return {
      safe: false,
      error: '安全限制：只允许执行查询类语句（SELECT、SHOW、DESCRIBE、EXPLAIN等）。禁止执行修改、删除、插入等操作。'
    }
  }
  
  return { safe: true }
}

export default async function handler(params, context) {
  const { log } = context
  const { action, connection_name, database, sql, params: sqlParams, limit } = params
  
  log.info('执行 db-query Skill', params)
  
  if (!connection_name) {
    return {
      success: false,
      error: '请指定数据库连接名称'
    }
  }
  
  if (!database.isConnectionActive(connection_name)) {
    return {
      success: false,
      error: `连接 "${connection_name}" 未激活，请先使用 db-connect 连接数据库`
    }
  }
  
  switch (action) {
    case 'list_databases': {
      const result = await database.queryDatabases(connection_name)
      
      if (!result.success) {
        return {
          success: false,
          content: `查询数据库列表失败：${result.error}`,
          metadata: result
        }
      }
      
      return {
        success: true,
        content: `数据库列表（共${result.databases.length}个）：\n${result.databases.map(db => `- ${db}`).join('\n')}`,
        metadata: { databases: result.databases }
      }
    }
    
    case 'list_tables': {
      const result = await database.queryTables(connection_name, database)
      
      if (!result.success) {
        return {
          success: false,
          content: `查询表列表失败：${result.error}`,
          metadata: result
        }
      }
      
      return {
        success: true,
        content: `表列表${database ? `（数据库：${database}）` : ''}（共${result.tables.length}个）：\n${result.tables.map(t => `- ${t}`).join('\n')}`,
        metadata: { 
          database,
          tables: result.tables 
        }
      }
    }
    
    case 'execute': {
      if (!sql) {
        return {
          success: false,
          error: '请提供要执行的SQL语句'
        }
      }
      
      const safetyCheck = validateSQLSafety(sql)
      if (!safetyCheck.safe) {
        log.warn('SQL安全检查失败:', sql, safetyCheck.error)
        return {
          success: false,
          error: safetyCheck.error,
          metadata: { sql, reason: '安全限制' }
        }
      }
      
      const result = await database.executeQuery(
        connection_name, 
        sql, 
        sqlParams || [], 
        { limit: limit || 1000, autoLimit: true }
      )
      
      if (!result.success) {
        return {
          success: false,
          content: `执行SQL失败：${result.error}`,
          metadata: result
        }
      }
      
      const rows = result.rows
      const fields = result.fields
      
      let content = `执行成功，返回 ${result.rowCount} 条记录，耗时 ${result.duration}ms\n\n`
      
      if (Array.isArray(rows) && rows.length > 0) {
        const fieldNames = fields.map(f => f.name)
        const maxColWidth = 30
        
        content += '| ' + fieldNames.map(name => 
          name.length > maxColWidth ? name.substring(0, maxColWidth - 3) + '...' : name
        ).join(' | ') + ' |\n'
        content += '| ' + fieldNames.map(() => '-'.repeat(Math.min(10, maxColWidth))).join(' | ') + ' |\n'
        
        const displayRows = rows.slice(0, 20)
        for (const row of displayRows) {
          const values = fieldNames.map(name => {
            const val = row[name]
            if (val === null) return 'NULL'
            if (val === undefined) return ''
            const str = String(val)
            return str.length > maxColWidth ? str.substring(0, maxColWidth - 3) + '...' : str
          })
          content += '| ' + values.join(' | ') + ' |\n'
        }
        
        if (rows.length > 20) {
          content += `\n... 还有 ${rows.length - 20} 条记录未显示`
        }
      } else if (rows && !Array.isArray(rows)) {
        content += `受影响的行数：${rows.affectedRows || 0}\n`
        if (rows.insertId) {
          content += `插入ID：${rows.insertId}\n`
        }
      } else {
        content += '无数据返回\n'
      }
      
      return {
        success: true,
        content,
        metadata: {
          rowCount: result.rowCount,
          duration: result.duration,
          fields: fields.map(f => ({ name: f.name, type: f.type })),
          rows: rows
        }
      }
    }
    
    default:
      return {
        success: false,
        error: `未知的操作类型：${action}`
      }
  }
}