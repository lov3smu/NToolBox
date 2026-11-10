export function createFormat(state, api) {
  const { databaseObjectsMap, selectedCategory, selectedConnection, selectedGroup, selectedInfoType, selectedObject } =
    state

  function parseSqlStatements(sql) {
    const statements = []
    let currentStatement = ''
    let inString = false
    let stringChar = null

    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]

      if (!inString && (char === "'" || char === '"' || char === '`')) {
        inString = true
        stringChar = char
        currentStatement += char
      } else if (inString && char === stringChar) {
        if (sql[i - 1] !== '\\') {
          inString = false
          stringChar = null
        }
        currentStatement += char
      } else if (!inString && char === ';') {
        if (currentStatement.trim()) {
          statements.push(currentStatement.trim())
        }
        currentStatement = ''
      } else {
        currentStatement += char
      }
    }

    if (currentStatement.trim()) {
      statements.push(currentStatement.trim())
    }

    return statements
  }

  function formatCellValue(value) {
    if (value === null) return 'NULL'
    if (value === '') return ''
    if (value instanceof Date) {
      const year = value.getFullYear()
      const month = String(value.getMonth() + 1).padStart(2, '0')
      const day = String(value.getDate()).padStart(2, '0')
      const hours = String(value.getHours()).padStart(2, '0')
      const minutes = String(value.getMinutes()).padStart(2, '0')
      const seconds = String(value.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}:\d{2}/)) {
      const date = new Date(value)
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
      }
    }
    return value
  }

  function truncateSql(sql) {
    if (!sql) return ''
    const maxLength = 60
    if (sql.length <= maxLength) return sql
    return sql.substring(0, maxLength) + '...'
  }

  function formatSize(bytes) {
    if (!bytes || bytes === 0) return '--'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  function formatDate(time) {
    if (!time) return '--'
    const date = new Date(time)
    if (isNaN(date.getTime())) return '--'
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function getInfoHeaderName() {
    if (selectedInfoType.value === 'group') return selectedGroup.value?.name
    if (selectedInfoType.value === 'connection') return selectedConnection.value?.name
    if (selectedInfoType.value === 'database') return selectedObject.value?.name
    if (selectedInfoType.value === 'table') return selectedObject.value?.name
    if (selectedInfoType.value === 'object') return selectedObject.value?.name
    if (selectedInfoType.value === 'category') {
      const typeLabels = {
        tables: '表',
        views: '视图',
        functions: '函数',
        procedures: '存储过程',
        triggers: '触发器',
        events: '事件'
      }
      return typeLabels[selectedCategory.value?.type] || ''
    }
    return ''
  }

  function getInfoHeaderDesc() {
    if (selectedInfoType.value === 'group') return '分组'
    if (selectedInfoType.value === 'connection') return selectedConnection.value?.active ? '已连接' : '未连接'
    if (selectedInfoType.value === 'database') return '数据库'
    if (selectedInfoType.value === 'table') return selectedObject.value?.database || ''
    if (selectedInfoType.value === 'object') return selectedObject.value?.database || ''
    if (selectedInfoType.value === 'category') return selectedCategory.value?.database || ''
    return ''
  }

  function getCategoryList() {
    if (!selectedCategory.value) return []
    const key = `${selectedCategory.value.connectionName}_${selectedCategory.value.database}`
    const objects = databaseObjectsMap.value[key]
    if (!objects) return []
    return objects[selectedCategory.value.type] || []
  }

  function handleCategoryItemClick(item) {
    if (selectedCategory.value?.type === 'tables') {
      api.selectTableObject(item)
    } else if (selectedCategory.value?.type === 'views') {
      api.selectViewObject(item)
    } else if (selectedCategory.value?.type === 'functions') {
      api.selectFunctionObject(item)
    } else if (selectedCategory.value?.type === 'procedures') {
      api.selectProcedureObject(item)
    } else if (selectedCategory.value?.type === 'triggers') {
      api.selectTriggerObject(item)
    } else if (selectedCategory.value?.type === 'events') {
      api.selectEventObject(item)
    }
  }

  function highlightSql(sql) {
    if (!sql) return ''

    const keywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'AND',
      'OR',
      'NOT',
      'IN',
      'LIKE',
      'BETWEEN',
      'JOIN',
      'LEFT',
      'RIGHT',
      'INNER',
      'OUTER',
      'ON',
      'AS',
      'GROUP',
      'BY',
      'ORDER',
      'HAVING',
      'LIMIT',
      'OFFSET',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'ALTER',
      'DROP',
      'TABLE',
      'DATABASE',
      'INDEX',
      'VIEW',
      'PRIMARY',
      'KEY',
      'FOREIGN',
      'REFERENCES',
      'UNIQUE',
      'DEFAULT',
      'NULL',
      'AUTO_INCREMENT',
      'ENGINE',
      'CHARSET',
      'COLLATE',
      'COMMENT',
      'INT',
      'VARCHAR',
      'TEXT',
      'BIGINT',
      'SMALLINT',
      'TINYINT',
      'DECIMAL',
      'FLOAT',
      'DOUBLE',
      'DATE',
      'DATETIME',
      'TIMESTAMP',
      'BOOLEAN',
      'BOOL',
      'ENUM',
      'SET',
      'IF',
      'ELSE',
      'THEN',
      'END',
      'CASE',
      'WHEN',
      'BEGIN',
      'COMMIT',
      'ROLLBACK',
      'TRUNCATE',
      'REPLACE',
      'INTO',
      'VALUES',
      'SHOW',
      'DESCRIBE',
      'DESC',
      'USE',
      'GRANT',
      'REVOKE',
      'UNION',
      'ALL',
      'DISTINCT',
      'EXISTS',
      'ASC',
      'DESC',
      'CONSTRAINT',
      'ADD',
      'COLUMN',
      'MODIFY',
      'CHANGE',
      'RENAME',
      'AFTER',
      'FIRST',
      'PARTITION',
      'PARTITIONS',
      'PROCEDURE',
      'FUNCTION',
      'TRIGGER',
      'RETURNS',
      'DECLARE',
      'RETURN',
      'CALL',
      'EXECUTE',
      'PREPARE',
      'CURRENT_TIMESTAMP'
    ]

    const functions = [
      'COUNT',
      'SUM',
      'AVG',
      'MIN',
      'MAX',
      'CONCAT',
      'SUBSTRING',
      'LENGTH',
      'UPPER',
      'LOWER',
      'TRIM',
      'LTRIM',
      'RTRIM',
      'REPLACE',
      'FORMAT',
      'NOW',
      'CURDATE',
      'CURTIME',
      'DATE_FORMAT',
      'YEAR',
      'MONTH',
      'DAY',
      'HOUR',
      'MINUTE',
      'SECOND',
      'IFNULL',
      'COALESCE',
      'NULLIF',
      'CAST',
      'CONVERT',
      'ABS',
      'ROUND',
      'CEIL',
      'FLOOR',
      'MOD',
      'POWER',
      'SQRT',
      'RAND',
      'SIGN',
      'EXP',
      'LOG',
      'LN',
      'SIN',
      'COS',
      'TAN',
      'ASCII',
      'CHAR',
      'HEX',
      'UNHEX',
      'INSTR',
      'LOCATE',
      'LEFT',
      'RIGHT',
      'LPAD',
      'RPAD',
      'REVERSE',
      'SPACE',
      'STRCMP',
      'UUID',
      'MD5',
      'SHA1',
      'SHA2'
    ]

    let result = sql

    result = result.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>')
    result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="sql-comment">$1</span>')

    result = result.replace(/'([^']*)'/g, '<span class="sql-string">\'$1\'</span>')
    result = result.replace(/"(?![^<]*>)([^"]*)"(?![^<]*>)/g, '<span class="sql-string">"$1"</span>')

    result = result.replace(/`([^`]+)`/g, '<span class="sql-identifier">`$1`</span>')

    const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi')
    result = result.replace(keywordRegex, '<span class="sql-keyword">$&</span>')

    const functionRegex = new RegExp(`\\b(${functions.join('|')})\\b`, 'gi')
    result = result.replace(functionRegex, '<span class="sql-function">$&</span>')

    result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="sql-number">$1</span>')

    return result
  }

  return {
    formatCellValue,
    truncateSql,
    formatSize,
    formatDate,
    getInfoHeaderName,
    getInfoHeaderDesc,
    getCategoryList,
    handleCategoryItemClick,
    highlightSql,
    parseSqlStatements
  }
}
