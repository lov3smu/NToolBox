import * as database from '../../../services/database.js'

export default async function handler(params, context) {
  const { log } = context
  const { action, connection_name, database: dbName, table_name } = params
  
  log.info('执行 db-schema Skill', params)
  
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
  
  if (!table_name) {
    return {
      success: false,
      error: '请指定要查询的表名称'
    }
  }
  
  switch (action) {
    case 'describe': {
      const result = await database.getTableStructure(connection_name, dbName, table_name)
      
      if (!result.success) {
        return {
          success: false,
          content: `查询表结构失败：${result.error}`,
          metadata: result
        }
      }
      
      let content = `表结构：${table_name}${dbName ? ` (数据库: ${dbName})` : ''}\n\n`
      content += '| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 |\n'
      content += '|--------|------|----------|-----|---------|------|\n'
      
      for (const field of result.fields) {
        const fieldLine = [
          field.Field || field.field || field.COLUMN_NAME || '',
          field.Type || field.type || field.COLUMN_TYPE || '',
          field.Null || field.null || field.IS_NULLABLE || '',
          field.Key || field.key || field.COLUMN_KEY || '',
          (field.Default !== undefined ? String(field.Default) : (field.default !== undefined ? String(field.default) : '')),
          field.Extra || field.extra || field.EXTRA || ''
        ]
        content += '| ' + fieldLine.join(' | ') + ' |\n'
      }
      
      return {
        success: true,
        content,
        metadata: { 
          database: dbName,
          table: table_name,
          fields: result.fields 
        }
      }
    }
    
    case 'show_create': {
      const result = await database.executeQuery(
        connection_name,
        `SHOW CREATE TABLE \`${table_name}\``,
        [],
        { autoLimit: false }
      )
      
      if (!result.success) {
        return {
          success: false,
          content: `查询建表语句失败：${result.error}`,
          metadata: result
        }
      }
      
      const createTable = result.rows && result.rows[0]
      const createSql = createTable 
        ? (createTable['Create Table'] || createTable['CREATE TABLE'] || createTable.create_table || '')
        : ''
      
      return {
        success: true,
        content: `建表语句：${table_name}\n\n${createSql}`,
        metadata: {
          database: dbName,
          table: table_name,
          create_sql: createSql
        }
      }
    }
    
    case 'show_indexes': {
      const result = await database.executeQuery(
        connection_name,
        `SHOW INDEX FROM \`${table_name}\``,
        [],
        { autoLimit: false }
      )
      
      if (!result.success) {
        return {
          success: false,
          content: `查询索引信息失败：${result.error}`,
          metadata: result
        }
      }
      
      let content = `索引信息：${table_name}${dbName ? ` (数据库: ${dbName})` : ''}\n\n`
      
      if (result.rows && result.rows.length > 0) {
        const indexes = {}
        for (const row of result.rows) {
          const indexName = row.Key_name || row.key_name || row.INDEX_NAME || ''
          if (!indexes[indexName]) {
            indexes[indexName] = {
              name: indexName,
              unique: (row.Non_unique === 0 || row.non_unique === 0),
              columns: []
            }
          }
          indexes[indexName].columns.push(row.Column_name || row.column_name || row.COLUMN_NAME || '')
        }
        
        for (const [name, idx] of Object.entries(indexes)) {
          content += `索引: ${name}\n`
          content += `  类型: ${idx.unique ? 'UNIQUE' : 'INDEX'}\n`
          content += `  列: ${idx.columns.join(', ')}\n\n`
        }
      } else {
        content += '该表没有索引\n'
      }
      
      return {
        success: true,
        content,
        metadata: {
          database: dbName,
          table: table_name,
          indexes: result.rows
        }
      }
    }
    
    case 'show_columns': {
      const result = await database.executeQuery(
        connection_name,
        `SHOW FULL COLUMNS FROM \`${table_name}\``,
        [],
        { autoLimit: false }
      )
      
      if (!result.success) {
        return {
          success: false,
          content: `查询字段详情失败：${result.error}`,
          metadata: result
        }
      }
      
      let content = `字段详情：${table_name}${dbName ? ` (数据库: ${dbName})` : ''}\n\n`
      
      if (result.rows && result.rows.length > 0) {
        content += '| 字段 | 类型 | 排序规则 | 允许空 | 键 | 默认值 | 额外 | 权限 | 注释 |\n'
        content += '|------|------|----------|--------|-----|---------|------|------|------|\n'
        
        for (const col of result.rows) {
          content += '| ' + [
            col.Field || col.field || '',
            col.Type || col.type || '',
            col.Collation || col.collation || '',
            col.Null || col.null || '',
            col.Key || col.key || '',
            (col.Default !== undefined ? String(col.Default) : ''),
            col.Extra || col.extra || '',
            col.Privileges || col.privileges || '',
            col.Comment || col.comment || ''
          ].join(' | ') + ' |\n'
        }
      } else {
        content += '该表没有字段\n'
      }
      
      return {
        success: true,
        content,
        metadata: {
          database: dbName,
          table: table_name,
          columns: result.rows
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