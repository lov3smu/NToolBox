const ALLOWED_SQL_KEYWORDS = ['SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'WITH']
const FORBIDDEN_SQL_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'REPLACE',
  'GRANT',
  'REVOKE'
]
const DANGEROUS_SQL_PATTERNS = [
  { pattern: /\bINTO\s+(OUTFILE|DUMPFILE)\b/, reason: '不允许导出文件' },
  { pattern: /\bLOAD_FILE\s*\(/, reason: '不允许读取服务器文件' },
  { pattern: /\b(SLEEP|BENCHMARK)\s*\(/, reason: '不允许执行阻塞或压测函数' },
  { pattern: /\bFOR\s+UPDATE\b/, reason: '不允许加锁查询' },
  { pattern: /\bLOCK\s+IN\s+SHARE\s+MODE\b/, reason: '不允许加锁查询' },
  { pattern: /\b(GET_LOCK|RELEASE_LOCK|IS_FREE_LOCK|IS_USED_LOCK)\s*\(/, reason: '不允许操作命名锁' }
]

const TOOL_DEFAULT_ROWS = 100
const TOOL_MAX_ROWS = 200
const TOOL_CONTEXT_ROWS = 50
const DISPLAY_ROWS = 20
const MAX_CELL_WIDTH = 30

function stripSqlNoise(sql) {
  return sql
    .replace(/'(?:''|\\.|[^'\\])*'/g, "''")
    .replace(/"(?:""|\\.|[^"\\])*"/g, '""')
    .replace(/`(?:``|[^`])*`/g, '``')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/#[^\n]*/g, ' ')
}

function validateSQLSafety(sql) {
  const cleaned = stripSqlNoise(sql).trim()
  const statement = cleaned.replace(/;+\s*$/, '')

  if (!statement) {
    return { safe: false, error: '请提供要执行的SQL语句' }
  }

  if (statement.includes(';')) {
    return { safe: false, error: '安全限制：一次只能执行一条 SQL 语句' }
  }

  for (const { pattern, reason } of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(statement)) {
      return { safe: false, error: `安全限制：${reason}` }
    }
  }

  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    if (new RegExp(`\\b${keyword}\\b`).test(statement)) {
      return {
        safe: false,
        error: `安全限制：禁止执行 ${keyword} 语句。只允许执行查询类语句（SELECT、SHOW、DESCRIBE等）。`
      }
    }
  }

  const keywordMatch = statement.match(/^\(*\s*([A-Za-z]+)/)
  const firstKeyword = keywordMatch ? keywordMatch[1].toUpperCase() : ''

  if (!ALLOWED_SQL_KEYWORDS.includes(firstKeyword)) {
    return {
      safe: false,
      error: '安全限制：只允许执行查询类语句（SELECT、SHOW、DESCRIBE、EXPLAIN等）。禁止执行修改、删除、插入等操作。'
    }
  }

  return { safe: true }
}

function formatCell(value) {
  if (value === null) return 'NULL'
  if (value === undefined) return ''

  let text = String(value).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|')
  if (text.length > MAX_CELL_WIDTH) text = `${text.slice(0, MAX_CELL_WIDTH - 3)}...`
  return text
}

function formatRows(rows, fields, rowCount, duration) {
  let content = `执行成功，返回 ${rowCount} 条记录，耗时 ${duration}ms\n\n`

  if (!Array.isArray(rows) || rows.length === 0) {
    return `${content}无数据返回\n`
  }

  const fieldNames = fields.map((field) => field.name)

  content += '| ' + fieldNames.map((name) => formatCell(name)).join(' | ') + ' |\n'
  content += '| ' + fieldNames.map(() => '-'.repeat(Math.min(10, MAX_CELL_WIDTH))).join(' | ') + ' |\n'

  for (const row of rows.slice(0, DISPLAY_ROWS)) {
    content += '| ' + fieldNames.map((name) => formatCell(row[name])).join(' | ') + ' |\n'
  }

  if (rows.length > DISPLAY_ROWS) {
    content += `\n... 还有 ${rows.length - DISPLAY_ROWS} 条记录未显示`
  }

  return content
}

export default async function handler(params, context) {
  const { log, database } = context
  const { action, connection_name, database: targetDatabase, sql, params: sqlParams, limit } = params

  log.debug(`执行 db-query: action=${action}`)

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
        content: `数据库列表（共${result.databases.length}个）：\n${result.databases.map((db) => `- ${db}`).join('\n')}`,
        metadata: { databases: result.databases }
      }
    }

    case 'list_tables': {
      const result = await database.queryTables(connection_name, targetDatabase)

      if (!result.success) {
        return {
          success: false,
          content: `查询表列表失败：${result.error}`,
          metadata: result
        }
      }

      return {
        success: true,
        content: `表列表${targetDatabase ? `（数据库：${targetDatabase}）` : ''}（共${result.tables.length}个）：\n${result.tables.map((t) => `- ${t}`).join('\n')}`,
        metadata: {
          database: targetDatabase,
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
        log.warn('SQL 安全检查拒绝:', safetyCheck.error)
        return {
          success: false,
          error: safetyCheck.error,
          metadata: { reason: '安全限制' }
        }
      }

      const requestedLimit = Number(limit)
      const rowLimit =
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(TOOL_MAX_ROWS, Math.floor(requestedLimit))
          : TOOL_DEFAULT_ROWS

      const result = await database.executeQuery(connection_name, sql, sqlParams || [], {
        limit: rowLimit,
        autoLimit: true,
        database: targetDatabase
      })

      if (!result.success) {
        return {
          success: false,
          content: `执行SQL失败：${result.error}`,
          metadata: result
        }
      }

      const rows = result.rows
      const fields = result.fields || []

      let content = formatRows(rows, fields, result.rowCount, result.duration)
      if (rows && !Array.isArray(rows)) {
        content += `受影响的行数：${rows.affectedRows || 0}\n`
        if (rows.insertId) {
          content += `插入ID：${rows.insertId}\n`
        }
      }

      const contextRows = Array.isArray(rows) ? rows.slice(0, TOOL_CONTEXT_ROWS) : rows

      return {
        success: true,
        content,
        metadata: {
          rowCount: result.rowCount,
          duration: result.duration,
          limit: rowLimit,
          returnedRows: Array.isArray(rows) ? rows.length : 0,
          truncated: Array.isArray(rows) && rows.length > TOOL_CONTEXT_ROWS,
          fields: fields.map((field) => ({ name: field.name, type: field.type })),
          rows: contextRows
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
