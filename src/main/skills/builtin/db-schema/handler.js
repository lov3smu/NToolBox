function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``
}

function formatValue(value) {
  if (value === undefined) return ''
  if (value === null) return 'NULL'
  return String(value)
}

function pick(...values) {
  return values.find((value) => value !== undefined && value !== null)
}

async function resolveDatabaseName(database, connectionName, requestedDatabase) {
  if (requestedDatabase) return requestedDatabase

  const result = await database.executeQuery(connectionName, 'SELECT DATABASE() AS db', [], { autoLimit: false })
  if (!result.success || !Array.isArray(result.rows) || result.rows.length === 0) return ''

  return result.rows[0]?.db || ''
}

export default async function handler(params, context) {
  const { log, database } = context
  const { action, connection_name, database: requestedDatabase, table_name } = params

  log.debug(`执行 db-schema: action=${action}`)

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

  const dbName = await resolveDatabaseName(database, connection_name, requestedDatabase)
  if (!dbName) {
    return {
      success: false,
      error: '未指定数据库，且连接没有默认数据库，请先执行 USE database 或传入 database 参数'
    }
  }

  const tableRef = `${quoteIdentifier(dbName)}.${quoteIdentifier(table_name)}`

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

      if (!Array.isArray(result.fields) || result.fields.length === 0) {
        return {
          success: false,
          error: `表 ${dbName}.${table_name} 不存在或没有字段`,
          metadata: { database: dbName, table: table_name }
        }
      }

      let content = `表结构：${table_name} (数据库: ${dbName})\n\n`
      content += '| 字段名 | 类型 | 是否为空 | 键 | 默认值 | 额外 | 注释 |\n'
      content += '|--------|------|----------|-----|---------|------|------|\n'

      for (const field of result.fields) {
        const fieldName = pick(field.name, field.Field, field.field, field.COLUMN_NAME)
        const fieldType = pick(field.columnType, field.dataType, field.Type, field.type, field.COLUMN_TYPE)
        const nullable =
          field.nullable === undefined ? pick(field.Null, field.null, field.IS_NULLABLE) : field.nullable ? 'YES' : 'NO'
        const key = pick(field.columnKey, field.Key, field.key, field.COLUMN_KEY, '')
        const defaultValue = pick(field.defaultValue, field.Default, field.default)
        const extra = pick(field.extra, field.Extra, field.EXTRA, '')

        content +=
          '| ' +
          [
            formatValue(fieldName),
            formatValue(fieldType),
            formatValue(nullable),
            formatValue(key),
            formatValue(defaultValue),
            formatValue(extra),
            formatValue(field.comment)
          ].join(' | ') +
          ' |\n'
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
      const result = await database.executeQuery(connection_name, `SHOW CREATE TABLE ${tableRef}`, [], {
        autoLimit: false
      })

      if (!result.success) {
        return {
          success: false,
          content: `查询建表语句失败：${result.error}`,
          metadata: result
        }
      }

      const createTable = Array.isArray(result.rows) ? result.rows[0] : null
      const createSql = createTable
        ? pick(createTable['Create Table'], createTable['CREATE TABLE'], createTable.create_table, '')
        : ''

      if (!createSql) {
        return {
          success: false,
          error: `未找到表 ${dbName}.${table_name} 的建表语句`,
          metadata: { database: dbName, table: table_name }
        }
      }

      return {
        success: true,
        content: `建表语句：${table_name} (数据库: ${dbName})\n\n${createSql}`,
        metadata: {
          database: dbName,
          table: table_name,
          create_sql: createSql
        }
      }
    }

    case 'show_indexes': {
      const result = await database.executeQuery(connection_name, `SHOW INDEX FROM ${tableRef}`, [], {
        autoLimit: false
      })

      if (!result.success) {
        return {
          success: false,
          content: `查询索引信息失败：${result.error}`,
          metadata: result
        }
      }

      let content = `索引信息：${table_name} (数据库: ${dbName})\n\n`
      const rows = Array.isArray(result.rows) ? result.rows : []

      if (rows.length > 0) {
        const indexes = {}
        for (const row of rows) {
          const indexName = pick(row.Key_name, row.key_name, row.INDEX_NAME, '')
          if (!indexes[indexName]) {
            indexes[indexName] = {
              name: indexName,
              unique: row.Non_unique === 0 || row.non_unique === 0,
              columns: []
            }
          }
          indexes[indexName].columns.push(pick(row.Column_name, row.column_name, row.COLUMN_NAME, ''))
        }

        for (const [name, index] of Object.entries(indexes)) {
          content += `索引: ${name}\n`
          content += `  类型: ${index.unique ? 'UNIQUE' : 'INDEX'}\n`
          content += `  列: ${index.columns.join(', ')}\n\n`
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
          indexes: rows
        }
      }
    }

    case 'show_columns': {
      const result = await database.executeQuery(connection_name, `SHOW FULL COLUMNS FROM ${tableRef}`, [], {
        autoLimit: false
      })

      if (!result.success) {
        return {
          success: false,
          content: `查询字段详情失败：${result.error}`,
          metadata: result
        }
      }

      const rows = Array.isArray(result.rows) ? result.rows : []
      if (rows.length === 0) {
        return {
          success: false,
          error: `表 ${dbName}.${table_name} 不存在或没有字段`,
          metadata: { database: dbName, table: table_name }
        }
      }

      let content = `字段详情：${table_name} (数据库: ${dbName})\n\n`
      content += '| 字段 | 类型 | 排序规则 | 允许空 | 键 | 默认值 | 额外 | 权限 | 注释 |\n'
      content += '|------|------|----------|--------|-----|---------|------|------|------|\n'

      for (const column of rows) {
        content +=
          '| ' +
          [
            pick(column.Field, column.field, ''),
            pick(column.Type, column.type, ''),
            pick(column.Collation, column.collation, ''),
            pick(column.Null, column.null, ''),
            pick(column.Key, column.key, ''),
            formatValue(pick(column.Default, column.default)),
            pick(column.Extra, column.extra, ''),
            pick(column.Privileges, column.privileges, ''),
            pick(column.Comment, column.comment, '')
          ].join(' | ') +
          ' |\n'
      }

      return {
        success: true,
        content,
        metadata: {
          database: dbName,
          table: table_name,
          columns: rows
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
