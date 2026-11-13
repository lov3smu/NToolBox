import { chat, dbAlterTable, dbGetErData, dbGetTableMeta, dbQueryObjects, dbQueryUsers } from '@/api'

const HISTORY_KEY = 'ntoolbox-db-query-history'
const SNIPPET_KEY = 'ntoolbox-db-sql-snippets'
const HISTORY_LIMIT = 200

function readStorage(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function extractSql(content) {
  const text = String(content || '').trim()
  const fenced = text.match(/```(?:sql)?\s*([\s\S]*?)```/i)
  return fenced ? fenced[1].trim() : text
}

export function createAdvanced(state, api) {
  const {
    activeTabId,
    aiDialog,
    databaseObjectsMap,
    erDialog,
    explainDialog,
    historyDialog,
    objectSearchDialog,
    queryHistory,
    querySnippets,
    selectedConnection,
    selectedDatabase,
    sqlPreviewDialog,
    structureDialog,
    tabs,
    userDialog
  } = state

  queryHistory.value = readStorage(HISTORY_KEY).slice(0, HISTORY_LIMIT)
  querySnippets.value = readStorage(SNIPPET_KEY)

  function persistHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(queryHistory.value.slice(0, HISTORY_LIMIT)))
    } catch {
      // 存储不可用时忽略
    }
  }

  function persistSnippets() {
    try {
      localStorage.setItem(SNIPPET_KEY, JSON.stringify(querySnippets.value))
    } catch {
      // 存储不可用时忽略
    }
  }

  function openSqlPreview(title, sql) {
    sqlPreviewDialog.value = { show: true, title: title || '待执行的 SQL', sql }
  }

  function closeSqlPreview() {
    sqlPreviewDialog.value.show = false
  }

  async function copySql(sql) {
    if (!sql) return
    try {
      await navigator.clipboard.writeText(sql)
      await api.showMessage('已复制到剪贴板', 'success')
    } catch (error) {
      await api.showMessage('复制失败: ' + error.message, 'error')
    }
  }

  function getActiveQueryTab() {
    const active = tabs.value.find((tab) => tab.id === activeTabId.value && tab.type === 'query')
    if (active) return active
    return tabs.value.find((tab) => tab.type === 'query') || null
  }

  function loadSqlIntoEditor(sql) {
    let tab = getActiveQueryTab()
    if (!tab) {
      tab = api.createQueryTab(selectedConnection.value?.name || '', selectedDatabase.value || '')
    }
    if (tab) {
      tab.sqlQuery = sql
      activeTabId.value = tab.id
    }
    historyDialog.value.show = false
  }

  function pushHistory(entry) {
    if (!entry?.sql) return
    queryHistory.value.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      ...entry
    })
    if (queryHistory.value.length > HISTORY_LIMIT) {
      queryHistory.value = queryHistory.value.slice(0, HISTORY_LIMIT)
    }
    persistHistory()
  }

  function removeHistoryItem(id) {
    queryHistory.value = queryHistory.value.filter((item) => item.id !== id)
    persistHistory()
  }

  async function clearHistory() {
    if (!queryHistory.value.length) return
    const confirmed = await api.showConfirm('确定清空全部查询历史吗？')
    if (!confirmed) return
    queryHistory.value = []
    persistHistory()
  }

  function openHistoryDialog(section = 'history') {
    historyDialog.value = { show: true, section, keyword: '' }
  }

  function closeHistoryDialog() {
    historyDialog.value.show = false
  }

  function openUserDialog() {
    const connection = selectedConnection.value
    if (!connection) {
      api.showMessage('请先在左侧选择连接', 'warning')
      return
    }
    if (!connection.active) {
      api.showMessage('请先连接数据库', 'warning')
      return
    }
    userDialog.value = {
      show: true,
      loading: true,
      keyword: '',
      connectionName: connection.name,
      currentUser: '',
      sessionUser: '',
      users: [],
      source: '',
      error: ''
    }
    loadUsers()
  }

  async function loadUsers() {
    const dialog = userDialog.value
    if (!dialog.connectionName) return
    dialog.loading = true
    dialog.error = ''
    try {
      const result = await dbQueryUsers(dialog.connectionName)
      if (!result.success) {
        dialog.users = []
        dialog.error = result.error || '查询用户失败'
        return
      }
      dialog.users = result.users || []
      dialog.currentUser = result.currentUser || ''
      dialog.sessionUser = result.sessionUser || ''
      dialog.source = result.source || ''
    } catch (error) {
      dialog.users = []
      dialog.error = '查询用户失败: ' + error.message
    } finally {
      dialog.loading = false
    }
  }

  function closeUserDialog() {
    userDialog.value.show = false
  }

  function copyUserAccount(user) {
    if (!user?.user) return
    copySql(user.host ? `'${user.user}'@'${user.host}'` : user.user)
  }

  async function saveSnippetFromTab(tab) {
    const sql = tab?.sqlQuery?.trim()
    if (!sql) {
      await api.showMessage('编辑器中没有 SQL', 'warning')
      return
    }
    const name = await api.showPrompt('请输入片段名称：', '')
    if (!name) return
    querySnippets.value.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sql,
      createdAt: Date.now()
    })
    persistSnippets()
    await api.showMessage('SQL 片段已保存', 'success')
  }

  async function saveSnippetSql(sql) {
    const name = await api.showPrompt('请输入片段名称：', '')
    if (!name) return
    querySnippets.value.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sql,
      createdAt: Date.now()
    })
    persistSnippets()
    await api.showMessage('SQL 片段已保存', 'success')
  }

  async function deleteSnippet(id) {
    querySnippets.value = querySnippets.value.filter((item) => item.id !== id)
    persistSnippets()
  }

  function openObjectSearchDialog() {
    if (!selectedConnection.value || !selectedDatabase.value) {
      api.showMessage('请先在左侧选择数据库', 'warning')
      return
    }
    objectSearchDialog.value = { show: true, keyword: '', items: [], loading: false }
    searchDatabaseObjects()
  }

  function closeObjectSearchDialog() {
    objectSearchDialog.value.show = false
  }

  async function searchDatabaseObjects() {
    const connection = selectedConnection.value
    const database = selectedDatabase.value
    if (!connection || !database) return

    const dialog = objectSearchDialog.value
    dialog.loading = true
    try {
      const result = await dbQueryObjects(connection.name, database, dialog.keyword.trim())
      dialog.items = result.success ? result.items || [] : []
      if (!result.success) {
        await api.showMessage(result.error || '搜索失败', 'error')
      }
    } catch (error) {
      dialog.items = []
      await api.showMessage('搜索失败: ' + error.message, 'error')
    } finally {
      dialog.loading = false
    }
  }

  async function openSearchItem(item) {
    const connection = selectedConnection.value
    const database = selectedDatabase.value
    if (!connection || !database || !item) return

    objectSearchDialog.value.show = false

    if (item.type === 'table' || item.type === 'view') {
      await api.openTable({ connection, database, table: item.name })
      return
    }

    if (item.type === 'column' && item.table) {
      await api.openTable({ connection, database, table: item.table })
      return
    }

    const tab = api.createQueryTab(connection.name, database)
    if (!tab) return

    if (item.type === 'trigger') {
      tab.sqlQuery = `SHOW CREATE TRIGGER \`${item.name}\`;`
    } else if (item.type === 'function' || item.type === 'procedure' || item.type === 'event') {
      tab.sqlQuery = `SHOW CREATE ${item.type.toUpperCase()} \`${item.name}\`;`
    }
  }

  async function loadStructureMeta(tab) {
    structureDialog.value.loading = true
    try {
      const result = await dbGetTableMeta(tab.connectionName, tab.database, tab.tableName)
      if (!result.success) {
        await api.showMessage(result.error || '读取表结构失败', 'error')
        return
      }
      structureDialog.value.meta = result
    } finally {
      structureDialog.value.loading = false
    }
  }

  function openStructureDialog(tab) {
    if (!tab || tab.type !== 'table') return
    structureDialog.value = {
      show: true,
      tab,
      meta: null,
      loading: true,
      section: 'columns'
    }
    loadStructureMeta(tab)
  }

  function closeStructureDialog() {
    structureDialog.value.show = false
    structureDialog.value.tab = null
  }

  async function applyStructureChanges(tab, operations) {
    if (!tab) return false
    try {
      const result = await dbAlterTable(tab.connectionName, tab.database, tab.tableName, operations)
      if (!result.success) {
        await api.showMessage(result.error || '结构变更失败', 'error')
        return false
      }
      if (result.renamedTo) {
        tab.tableName = result.renamedTo
        tab.name = `${result.renamedTo}@${tab.database}（${tab.connectionName}）-表`
      }
      await loadStructureMeta(tab)
      await api.executeTableQuery(tab, 1)
      await api.loadDatabaseObjects(tab.connectionName, tab.database)
      await api.showMessage('表结构已更新', 'success')
      return true
    } catch (error) {
      await api.showMessage('结构变更失败: ' + error.message, 'error')
      return false
    }
  }

  async function openErDialog(tab) {
    if (!tab) return
    erDialog.value = { show: true, tab, data: null, loading: true }
    try {
      const result = await dbGetErData(tab.connectionName, tab.database)
      if (!result.success) {
        await api.showMessage(result.error || '读取 ER 数据失败', 'error')
        return
      }
      erDialog.value.data = result
    } finally {
      erDialog.value.loading = false
    }
  }

  function closeErDialog() {
    erDialog.value.show = false
    erDialog.value.tab = null
  }

  function closeExplainDialog() {
    explainDialog.value.show = false
    explainDialog.value.tab = null
  }

  function openAiDialog(tab) {
    aiDialog.value = {
      show: true,
      tab,
      prompt: '',
      loading: false,
      result: '',
      error: ''
    }
  }

  function closeAiDialog() {
    aiDialog.value.show = false
    aiDialog.value.tab = null
  }

  async function buildSchemaContext(tab) {
    const lines = []
    const key = `${tab.connectionName}_${tab.database}`
    const objects = databaseObjectsMap.value[key]

    if (objects?.tables?.length) {
      lines.push(`数据库 ${tab.database} 中的表: ${objects.tables.slice(0, 80).join(', ')}`)
    }

    if (tab.tableName) {
      const result = await dbGetTableMeta(tab.connectionName, tab.database, tab.tableName)
      if (result.success) {
        lines.push(`表 ${tab.tableName} 的结构:`)
        for (const column of result.columns) {
          const flags = [
            column.columnType,
            column.nullable ? '' : 'NOT NULL',
            column.columnKey === 'PRI' ? 'PRIMARY KEY' : '',
            column.comment ? `/* ${column.comment} */` : ''
          ]
            .filter(Boolean)
            .join(' ')
          lines.push(`- ${column.name} ${flags}`)
        }
        if (result.indexes?.length) {
          lines.push(`索引: ${result.indexes.map((index) => `${index.name}(${index.columns.join(', ')})`).join('; ')}`)
        }
      }
    }

    return lines.join('\n')
  }

  async function generateSqlForTab(tab) {
    const dialog = aiDialog.value
    if (!tab) return
    if (!dialog.prompt.trim()) {
      dialog.error = '请描述要生成的 SQL 需求'
      return
    }

    dialog.loading = true
    dialog.error = ''
    dialog.result = ''

    try {
      const schema = await buildSchemaContext(tab)
      const content = [
        '你是一位资深 MySQL 工程师，请根据数据库结构和需求生成可直接执行的 SQL。',
        '要求：只输出 SQL，使用 MySQL 语法，不要输出解释性文字；多条语句用英文分号分隔。',
        schema ? `数据库结构:\n${schema}` : '',
        tab.sqlQuery ? `当前编辑器中的 SQL:\n${tab.sqlQuery}` : '',
        `需求: ${dialog.prompt}`
      ]
        .filter(Boolean)
        .join('\n\n')

      const result = await chat([{ role: 'user', content }], { toolsEnabled: false })
      if (!result.success) {
        dialog.error = result.error || 'AI 生成失败'
        return
      }
      dialog.result = extractSql(result.content)
      if (!dialog.result) {
        dialog.error = 'AI 未返回有效内容'
      }
    } catch (error) {
      dialog.error = 'AI 生成失败: ' + error.message
    } finally {
      dialog.loading = false
    }
  }

  function applyAiResultToTab() {
    const dialog = aiDialog.value
    const tab = dialog.tab
    if (!tab || !dialog.result) return
    tab.sqlQuery = dialog.result
    closeAiDialog()
  }

  return {
    openSqlPreview,
    closeSqlPreview,
    copySql,
    pushHistory,
    removeHistoryItem,
    clearHistory,
    openHistoryDialog,
    closeHistoryDialog,
    openUserDialog,
    loadUsers,
    closeUserDialog,
    copyUserAccount,
    loadSqlIntoEditor,
    saveSnippetFromTab,
    saveSnippetSql,
    deleteSnippet,
    openObjectSearchDialog,
    closeObjectSearchDialog,
    searchDatabaseObjects,
    openSearchItem,
    openStructureDialog,
    closeStructureDialog,
    loadStructureMeta,
    applyStructureChanges,
    openErDialog,
    closeErDialog,
    closeExplainDialog,
    openAiDialog,
    closeAiDialog,
    generateSqlForTab,
    applyAiResultToTab
  }
}
