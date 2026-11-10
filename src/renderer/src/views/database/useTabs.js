import {
  dbBeginTransaction,
  dbCancelQuery,
  dbCommitTransaction,
  dbExecuteQuery,
  dbExplainQuery,
  dbRollbackTransaction
} from '@/api'

const TAB_STORAGE_KEY = 'ntoolbox-db-tabs'

export function createTabs(state, api) {
  const {
    activeTabId,
    autoLimit,
    connectionDatabases,
    connections,
    databaseObjectsMap,
    explainDialog,
    lastExecutedSql,
    lastExecutedTime,
    limitCount,
    tabs,
    transactionConnections
  } = state

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      const activeTab = tabs.value.find((t) => t.id === activeTabId.value)
      if (activeTab?.type === 'query' && activeTab.sqlQuery && activeTab.connectionName && !activeTab.executing) {
        e.preventDefault()
        executeQueryForTab(activeTab)
      }
    }
  }

  function closeOtherTabs(tabId) {
    const currentTab = tabs.value.find((t) => t.id === tabId)
    if (!currentTab) return

    tabs.value = tabs.value.filter((t) => t.id === tabId || !t.closable)

    if (!tabs.value.find((t) => t.id === activeTabId.value)) {
      activeTabId.value = tabId
    }

    api.hideTabContextMenu()
  }

  function closeAllTabs() {
    tabs.value = tabs.value.filter((t) => !t.closable)

    if (tabs.value.length === 0) {
      activeTabId.value = 'object'
    } else {
      activeTabId.value = tabs.value[0].id
    }

    api.hideTabContextMenu()
  }

  function closeTabsToRight(tabId) {
    const index = tabs.value.findIndex((t) => t.id === tabId)
    if (index === -1) return

    const tabsToKeep = tabs.value.slice(0, index + 1)
    const nonClosableTabs = tabs.value.filter((t) => !t.closable && tabs.value.findIndex((x) => x.id === t.id) > index)

    tabs.value = [...tabsToKeep, ...nonClosableTabs]

    if (!tabs.value.find((t) => t.id === activeTabId.value)) {
      activeTabId.value = tabId
    }

    api.hideTabContextMenu()
  }

  function closeTabsToLeft(tabId) {
    const index = tabs.value.findIndex((t) => t.id === tabId)
    if (index === -1) return

    const tabsToKeep = tabs.value.slice(index)
    const nonClosableTabs = tabs.value.filter((t) => !t.closable && tabs.value.findIndex((x) => x.id === t.id) < index)

    tabs.value = [...nonClosableTabs, ...tabsToKeep]

    if (!tabs.value.find((t) => t.id === activeTabId.value)) {
      activeTabId.value = tabId
    }

    api.hideTabContextMenu()
  }

  function selectTab(tabId) {
    activeTabId.value = tabId
  }

  function closeTab(tabId) {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || !tab.closable) return

    const index = tabs.value.findIndex((t) => t.id === tabId)
    tabs.value.splice(index, 1)

    if (activeTabId.value === tabId) {
      activeTabId.value = tabs.value[Math.max(0, index - 1)].id
    }
  }

  function createQueryTab(connName, dbName = '') {
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    tabs.value.push({
      id: queryId,
      name: '无标题-查询',
      type: 'query',
      closable: true,
      connectionName: connName,
      database: dbName,
      sqlQuery: '',
      queryResult: null,
      queryResults: [],
      activeResultIndex: 0,
      executing: false,
      canceling: false,
      requestId: null,
      inTransaction: false,
      editorRef: null
    })

    activeTabId.value = queryId
  }

  function createTableTab(connName, dbName, tableName) {
    const tabName = `${tableName}@${dbName}（${connName}）-表`

    const existingTab = tabs.value.find((t) => t.type === 'table' && t.name === tabName)
    if (existingTab) {
      activeTabId.value = existingTab.id
      return existingTab
    }

    const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    tabs.value.push({
      id: tableId,
      name: tabName,
      type: 'table',
      closable: true,
      connectionName: connName,
      database: dbName,
      tableName,
      queryResult: null,
      executing: false,
      fieldOrder: [],
      columns: [],
      primaryKeys: [],
      isView: false,
      filters: [],
      filterLogic: 'AND',
      searchKeyword: '',
      pageSize: limitCount.value || 100,
      sortField: null,
      sortDirection: null,
      rowEdits: {},
      rowDeletes: {},
      rowInserts: [],
      selectedRows: {},
      inTransaction: false
    })

    activeTabId.value = tableId

    return tabs.value.find((t) => t.id === tableId)
  }

  function getTabDatabases(tab) {
    if (!tab.connectionName) return []
    return connectionDatabases.value[tab.connectionName] || []
  }

  function getTabTables(tab) {
    if (!tab.connectionName || !tab.database) return []
    const key = `${tab.connectionName}_${tab.database}`
    return databaseObjectsMap.value[key]?.tables || []
  }

  function getTabPlaceholder(tab) {
    if (!tab.connectionName) return '请先选择数据库连接...'
    if (!tab.database) return '请选择数据库...'
    return '输入SQL查询...'
  }

  async function onTabConnectionChange(tab) {
    tab.database = ''
    tab.sqlQuery = ''
    tab.queryResult = null

    if (tab.connectionName) {
      await api.loadConnectionDatabases(tab.connectionName)
    }
  }

  async function onTabDatabaseChange(tab) {
    tab.sqlQuery = ''
    tab.queryResult = null

    if (tab.connectionName && tab.database) {
      const key = `${tab.connectionName}_${tab.database}`
      if (!databaseObjectsMap.value[key]) {
        await api.loadDatabaseObjects(tab.connectionName, tab.database)
      }
    }
  }

  function getExecutionSql(tab) {
    let sqlContent = tab.sqlQuery
    if (tab.editorRef && tab.editorRef.getSelectionOrAll) {
      sqlContent = tab.editorRef.getSelectionOrAll()
    }
    return sqlContent
  }

  async function ensureTabConnection(tab) {
    const conn = connections.value.find((item) => item.name === tab.connectionName)
    if (conn && !conn.active) {
      api.selectConnection(conn)
      await api.connectToDatabase()
    }
    return conn
  }

  async function executeQueryForTab(tab) {
    if (!tab.connectionName) return

    const sqlContent = getExecutionSql(tab)
    if (!sqlContent || sqlContent.trim() === '') return

    await ensureTabConnection(tab)

    tab.executing = true
    tab.canceling = false

    const statements = api.parseSqlStatements(sqlContent)

    if (statements.length === 0) {
      tab.executing = false
      return
    }

    tab.queryResults = []
    tab.activeResultIndex = 0
    const limitValue = autoLimit.value ? limitCount.value : 100000

    try {
      for (let i = 0; i < statements.length; i++) {
        const originalSql = statements[i].trim()
        let sql = originalSql
        if (sql.toLowerCase().endsWith(';')) {
          sql = sql.slice(0, -1)
        }

        const isSelect = /^\s*(select|with)\b/i.test(sql)
        const hasLimit = /\blimit\b/i.test(sql)
        const requestId = `${tab.id}_${Date.now()}_${i}`

        const startTime = Date.now()
        const result = await dbExecuteQuery(tab.connectionName, sql, [], {
          autoLimit: isSelect && !hasLimit,
          limit: limitValue,
          requestId,
          database: tab.database
        })
        tab.requestId = requestId
        const endTime = Date.now()

        let totalRows = result.rowCount || (result.rows ? result.rows.length : 0)
        if (result.success && isSelect && !hasLimit) {
          try {
            const countResult = await dbExecuteQuery(
              tab.connectionName,
              `SELECT COUNT(*) AS total FROM (${sql}) AS __ntb_count`,
              [],
              { autoLimit: false, database: tab.database }
            )
            if (countResult.success && countResult.rows?.[0]) {
              totalRows = Number(countResult.rows[0].total) || totalRows
            }
          } catch {
            // 计数失败时回退到当前结果行数
          }
        }

        const totalPages = isSelect && totalRows > limitValue ? Math.ceil(totalRows / limitValue) : 1

        tab.queryResults.push({
          index: i,
          name: `结果(${i + 1})`,
          sql: originalSql,
          success: result.success,
          canceled: result.canceled,
          rows: result.rows,
          fields: result.fields,
          error: result.error,
          duration: endTime - startTime,
          rowCount: result.rowCount || 0,
          totalRows,
          currentPage: 1,
          totalPages,
          pageSize: limitValue,
          jumpPage: 1,
          isSelect
        })

        lastExecutedSql.value = originalSql
        lastExecutedTime.value = endTime - startTime

        api.pushHistory?.({
          sql: originalSql,
          connectionName: tab.connectionName,
          database: tab.database,
          duration: endTime - startTime,
          success: result.success,
          error: result.error || ''
        })
      }

      tab.queryResult = tab.queryResults[0]
    } catch (error) {
      console.error('执行查询失败:', error)
      tab.queryResults = [
        {
          index: 0,
          name: '结果(1)',
          sql: sqlContent,
          success: false,
          error: error.message
        }
      ]
      tab.queryResult = tab.queryResults[0]
    } finally {
      tab.executing = false
      tab.canceling = false
      tab.requestId = null
    }
  }

  function switchResultTab(tab, index) {
    if (tab.queryResults && tab.queryResults[index]) {
      tab.activeResultIndex = index
      tab.queryResult = tab.queryResults[index]
    }
  }

  async function stopQueryForTab(tab) {
    if (!tab.requestId) {
      tab.executing = false
      return
    }
    tab.canceling = true
    const result = await dbCancelQuery(tab.connectionName, tab.requestId)
    if (!result.success) {
      tab.canceling = false
      await api.showMessage(result.error || '无法取消查询', 'warning')
    }
  }

  async function explainQueryForTab(tab) {
    if (!tab.connectionName) return
    const sqlContent = getExecutionSql(tab)
    if (!sqlContent || !sqlContent.trim()) {
      await api.showMessage('请输入要分析的 SQL', 'warning')
      return
    }

    explainDialog.value = { show: true, tab, result: null, loading: true }
    try {
      const result = await dbExplainQuery(tab.connectionName, tab.database, sqlContent)
      explainDialog.value = { show: true, tab, result, loading: false }
    } catch (error) {
      explainDialog.value = {
        show: true,
        tab,
        result: { success: false, error: error.message },
        loading: false
      }
    }
  }

  function formatSqlForTab(tab) {
    if (!tab.sqlQuery) return

    let sql = tab.sqlQuery

    sql = sql.replace(/\s+/g, ' ')

    const keywords = [
      'SELECT',
      'FROM',
      'WHERE',
      'AND',
      'OR',
      'ORDER BY',
      'GROUP BY',
      'HAVING',
      'LIMIT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'CREATE',
      'ALTER',
      'DROP',
      'JOIN',
      'LEFT JOIN',
      'RIGHT JOIN',
      'INNER JOIN',
      'ON',
      'AS',
      'SET',
      'VALUES',
      'INTO'
    ]

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
      sql = sql.replace(regex, keyword.toUpperCase())
    })

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\s*${keyword.toUpperCase()}\\s*`, 'g')
      if (
        keyword === 'SELECT' ||
        keyword === 'FROM' ||
        keyword === 'WHERE' ||
        keyword === 'ORDER BY' ||
        keyword === 'GROUP BY' ||
        keyword === 'HAVING' ||
        keyword === 'LIMIT'
      ) {
        sql = sql.replace(regex, `\n${keyword.toUpperCase()}\n`)
      } else if (keyword === 'AND' || keyword === 'OR' || keyword === 'ON') {
        sql = sql.replace(regex, `\n  ${keyword.toUpperCase()}\n`)
      }
    })

    sql = sql.replace(/\n\s*\n/g, '\n')
    sql = sql.trim()

    tab.sqlQuery = sql

    if (tab.editorRef && tab.editorRef.setContent) {
      tab.editorRef.setContent(sql)
    }
  }

  function clearQueryForTab(tab) {
    tab.sqlQuery = ''
    tab.queryResult = null
    tab.queryResults = []
    tab.activeResultIndex = 0
  }

  async function beginTransactionForTab(tab) {
    if (!tab.connectionName) return
    const result = await dbBeginTransaction(tab.connectionName, tab.database)
    if (result.success) {
      tab.inTransaction = true
      if (!transactionConnections.value.includes(tab.connectionName)) {
        transactionConnections.value.push(tab.connectionName)
      }
      await api.showMessage('事务已开始', 'success')
    } else {
      await api.showMessage(result.error || '开始事务失败', 'error')
    }
  }

  async function commitTransactionForTab(tab) {
    const result = await dbCommitTransaction(tab.connectionName)
    if (result.success) {
      tab.inTransaction = false
      transactionConnections.value = transactionConnections.value.filter((name) => name !== tab.connectionName)
      await api.showMessage('事务已提交', 'success')
    } else {
      await api.showMessage(result.error || '提交事务失败', 'error')
    }
  }

  async function rollbackTransactionForTab(tab) {
    const result = await dbRollbackTransaction(tab.connectionName)
    if (result.success) {
      tab.inTransaction = false
      transactionConnections.value = transactionConnections.value.filter((name) => name !== tab.connectionName)
      await api.showMessage('事务已回滚', 'success')
    } else {
      await api.showMessage(result.error || '回滚事务失败', 'error')
    }
  }

  function serializeTabs() {
    return tabs.value
      .filter((tab) => tab.closable)
      .map((tab) => {
        if (tab.type === 'query') {
          return {
            type: 'query',
            connectionName: tab.connectionName,
            database: tab.database,
            sqlQuery: tab.sqlQuery
          }
        }
        return {
          type: 'table',
          connectionName: tab.connectionName,
          database: tab.database,
          tableName: tab.tableName,
          pageSize: tab.pageSize
        }
      })
  }

  function saveTabs() {
    try {
      localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(serializeTabs()))
    } catch (error) {
      console.warn('保存数据库标签页失败:', error)
    }
  }

  function restoreTabs() {
    let saved
    try {
      saved = JSON.parse(localStorage.getItem(TAB_STORAGE_KEY) || '[]')
    } catch {
      return false
    }
    if (!Array.isArray(saved) || saved.length === 0) return false

    let lastId = null
    for (const item of saved) {
      if (!item?.connectionName) continue
      if (item.type === 'query') {
        const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        tabs.value.push({
          id: queryId,
          name: '无标题-查询',
          type: 'query',
          closable: true,
          connectionName: item.connectionName,
          database: item.database || '',
          sqlQuery: item.sqlQuery || '',
          queryResult: null,
          queryResults: [],
          activeResultIndex: 0,
          executing: false,
          canceling: false,
          requestId: null,
          inTransaction: false,
          editorRef: null
        })
        lastId = queryId
      } else if (item.type === 'table' && item.tableName) {
        const tabName = `${item.tableName}@${item.database}（${item.connectionName}）-表`
        if (tabs.value.some((tab) => tab.name === tabName)) continue
        const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        tabs.value.push({
          id: tableId,
          name: tabName,
          type: 'table',
          closable: true,
          connectionName: item.connectionName,
          database: item.database,
          tableName: item.tableName,
          queryResult: null,
          executing: false,
          fieldOrder: [],
          columns: [],
          primaryKeys: [],
          isView: false,
          filters: [],
          filterLogic: 'AND',
          searchKeyword: '',
          pageSize: item.pageSize || 100,
          sortField: null,
          sortDirection: null,
          rowEdits: {},
          rowDeletes: {},
          rowInserts: [],
          selectedRows: {},
          inTransaction: false
        })
        lastId = tableId
      }
    }

    if (lastId) activeTabId.value = lastId
    return Boolean(lastId)
  }

  return {
    closeOtherTabs,
    closeAllTabs,
    closeTabsToRight,
    closeTabsToLeft,
    selectTab,
    closeTab,
    createQueryTab,
    createTableTab,
    getTabDatabases,
    getTabTables,
    getTabPlaceholder,
    onTabConnectionChange,
    onTabDatabaseChange,
    executeQueryForTab,
    switchResultTab,
    stopQueryForTab,
    explainQueryForTab,
    formatSqlForTab,
    clearQueryForTab,
    beginTransactionForTab,
    commitTransactionForTab,
    rollbackTransactionForTab,
    saveTabs,
    restoreTabs,
    handleKeyDown
  }
}
