import { t } from '@/i18n'
import { watch } from 'vue'
import {
  chat,
  dbAlterTable,
  dbCreateUser,
  dbDropUser,
  dbGetErData,
  dbGetTableMeta,
  dbGetUserGrants,
  dbPreviewAlterTable,
  dbQueryUsers,
  dbSetUserPassword,
  dbSetUserPrivileges
} from '@/api'

const HISTORY_KEY = 'ntoolbox-db-query-history'
const HISTORY_LIMIT = 200
const SNIPPET_KEY = 'ntoolbox-db-sql-snippets'
const SNIPPET_FOLDER_KEY = 'ntoolbox-db-sql-snippet-folders'

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

function createUserForm(mode = '') {
  return {
    mode,
    user: '',
    host: '%',
    password: '',
    scope: 'database',
    database: '',
    table: '*',
    privileges: ['SELECT']
  }
}

export function createAdvanced(state, api, options = {}) {
  const historyLimit = () => {
    const value = Number(options.historyLimit?.value)
    return Number.isFinite(value) && value > 0 ? value : HISTORY_LIMIT
  }
  const {
    activeTabId,
    aiDialog,
    databaseObjectsMap,
    databases,
    erDialog,
    explainDialog,
    historyDialog,
    queryHistory,
    querySnippets,
    snippetFolders,
    selectedConnection,
    selectedDatabase,
    sqlPreviewDialog,
    structureDialog,
    tableDesignerDialog,
    tabs,
    userDialog
  } = state

  queryHistory.value = readStorage(HISTORY_KEY).slice(0, historyLimit())
  querySnippets.value = readStorage(SNIPPET_KEY)
  snippetFolders.value = readStorage(SNIPPET_FOLDER_KEY).filter((folder) => typeof folder === 'string' && folder.trim())

  function persistHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(queryHistory.value.slice(0, historyLimit())))
    } catch {
      // 存储不可用时忽略
    }
  }

  if (options.historyLimit) {
    watch(options.historyLimit, () => {
      const limit = historyLimit()
      if (queryHistory.value.length > limit) {
        queryHistory.value = queryHistory.value.slice(0, limit)
        persistHistory()
      }
    })
  }

  function persistSnippets() {
    try {
      localStorage.setItem(SNIPPET_KEY, JSON.stringify(querySnippets.value))
    } catch {
      // 存储不可用时忽略
    }
  }

  function persistSnippetFolders() {
    try {
      localStorage.setItem(SNIPPET_FOLDER_KEY, JSON.stringify(snippetFolders.value))
    } catch {
      // 存储不可用时忽略
    }
  }

  function rememberSnippetFolder(folder) {
    const name = String(folder || '').trim()
    if (!name || snippetFolders.value.includes(name)) return
    snippetFolders.value.push(name)
    persistSnippetFolders()
  }

  function openSqlPreview(title, sql) {
    sqlPreviewDialog.value = { show: true, title: title || t('待执行的 SQL'), sql }
  }

  function closeSqlPreview() {
    sqlPreviewDialog.value.show = false
  }

  async function copySql(sql) {
    if (!sql) return
    try {
      await navigator.clipboard.writeText(sql)
      await api.showMessage(t('已复制到剪贴板'), 'success')
    } catch (error) {
      await api.showMessage(t('复制失败: ') + error.message, 'error')
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
    const limit = historyLimit()
    if (queryHistory.value.length > limit) {
      queryHistory.value = queryHistory.value.slice(0, limit)
    }
    persistHistory()
  }

  function removeHistoryItem(id) {
    queryHistory.value = queryHistory.value.filter((item) => item.id !== id)
    persistHistory()
  }

  async function clearHistory() {
    if (!queryHistory.value.length) return
    const confirmed = await api.showConfirm(t('确定清空全部查询历史吗？'))
    if (!confirmed) return
    queryHistory.value = []
    persistHistory()
  }

  function openHistoryDialog(section = 'history') {
    historyDialog.value = { show: true, section, keyword: '', folder: '' }
  }

  function closeHistoryDialog() {
    historyDialog.value.show = false
  }

  function openUserDialog() {
    const connection = selectedConnection.value
    if (!connection) {
      api.showMessage(t('请先在左侧选择连接'), 'warning')
      return
    }
    if (!connection.active) {
      api.showMessage(t('请先连接数据库'), 'warning')
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
      error: '',
      selected: null,
      grants: [],
      grantsLoading: false,
      grantsError: '',
      actionLoading: false,
      form: createUserForm()
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
        dialog.error = result.error || t('查询用户失败')
        return
      }
      dialog.users = result.users || []
      dialog.currentUser = result.currentUser || ''
      dialog.sessionUser = result.sessionUser || ''
      dialog.source = result.source || ''
      if (dialog.selected) {
        const match = dialog.users.find(
          (user) => user.user === dialog.selected.user && user.host === dialog.selected.host
        )
        if (match) {
          dialog.selected = match
          loadUserGrants()
        } else {
          dialog.selected = null
          dialog.grants = []
        }
      }
    } catch (error) {
      dialog.users = []
      dialog.error = t('查询用户失败: {p0}', { p0: error.message })
    } finally {
      dialog.loading = false
    }
  }

  function closeUserDialog() {
    userDialog.value.show = false
    userDialog.value.form = createUserForm()
  }

  function copyUserAccount(user) {
    if (!user?.user) return
    copySql(user.host ? `'${user.user}'@'${user.host}'` : user.user)
  }

  async function selectUser(user) {
    const dialog = userDialog.value
    if (!user) return
    dialog.selected = user
    dialog.grants = []
    dialog.grantsError = ''
    dialog.form = createUserForm()
    await loadUserGrants()
  }

  async function loadUserGrants() {
    const dialog = userDialog.value
    if (!dialog.selected) return
    dialog.grantsLoading = true
    dialog.grantsError = ''
    try {
      const result = await dbGetUserGrants(dialog.connectionName, dialog.selected.user, dialog.selected.host)
      if (!result.success) {
        dialog.grants = []
        dialog.grantsError = result.error || t('读取权限失败')
        return
      }
      dialog.grants = result.grants || []
    } catch (error) {
      dialog.grants = []
      dialog.grantsError = t('读取权限失败: ') + error.message
    } finally {
      dialog.grantsLoading = false
    }
  }

  function openUserForm(mode) {
    const dialog = userDialog.value
    const form = createUserForm(mode)
    if (mode === 'grant') {
      form.database = databases.value[0] || ''
    }
    dialog.form = form
  }

  function closeUserForm() {
    userDialog.value.form = createUserForm()
  }

  function toggleUserPrivilege(privilege) {
    const form = userDialog.value.form
    if (privilege === 'ALL PRIVILEGES') {
      form.privileges = ['ALL PRIVILEGES']
      return
    }
    const next = form.privileges.filter((item) => item !== 'ALL PRIVILEGES')
    if (next.includes(privilege)) {
      form.privileges = next.filter((item) => item !== privilege)
    } else {
      next.push(privilege)
      form.privileges = next
    }
  }

  function validateUserForm(form) {
    if (form.mode === 'create') {
      if (!form.user.trim()) return t('请输入用户名')
      if (!form.password) return t('请输入密码')
    }
    if (form.mode === 'password' && !form.password) {
      return t('请输入新密码')
    }
    if (form.mode === 'grant') {
      if (form.scope !== 'global' && !form.database.trim()) return t('请选择数据库')
      if (form.scope === 'table' && !form.table.trim()) return t('请输入表名')
      if (!form.privileges.length) return t('请至少选择一个权限')
    }
    return ''
  }

  async function submitUserForm(action = 'grant') {
    const dialog = userDialog.value
    const form = dialog.form
    if (!form.mode || dialog.actionLoading) return
    const validation = validateUserForm(form)
    if (validation) {
      await api.showMessage(validation, 'warning')
      return
    }

    dialog.actionLoading = true
    try {
      let result
      if (form.mode === 'create') {
        result = await dbCreateUser(dialog.connectionName, form.user.trim(), form.host.trim() || '%', form.password)
      } else if (form.mode === 'password') {
        result = await dbSetUserPassword(
          dialog.connectionName,
          dialog.selected.user,
          dialog.selected.host,
          form.password
        )
      } else {
        result = await dbSetUserPrivileges(
          dialog.connectionName,
          action,
          dialog.selected.user,
          dialog.selected.host,
          form.privileges,
          form.scope === 'global' ? '' : form.database.trim(),
          form.scope === 'table' ? form.table.trim() : '*'
        )
      }

      if (!result.success) {
        await api.showMessage(result.error || t('操作失败'), 'error')
        return
      }
      await api.showMessage(result.message || t('操作成功'), 'success')
      closeUserForm()
      await loadUsers()
    } catch (error) {
      await api.showMessage(t('操作失败: ') + error.message, 'error')
    } finally {
      dialog.actionLoading = false
    }
  }

  async function deleteSelectedUser() {
    const dialog = userDialog.value
    if (!dialog.selected || dialog.actionLoading) return
    const account = `${dialog.selected.user}@${dialog.selected.host}`
    const confirmed = await api.showConfirm(t('确定删除用户 {p0} 吗？该操作不可撤销。', { p0: account }))
    if (!confirmed) return

    dialog.actionLoading = true
    try {
      const result = await dbDropUser(dialog.connectionName, dialog.selected.user, dialog.selected.host)
      if (!result.success) {
        await api.showMessage(result.error || t('删除用户失败'), 'error')
        return
      }
      await api.showMessage(result.message || t('用户已删除'), 'success')
      dialog.selected = null
      dialog.grants = []
      closeUserForm()
      await loadUsers()
    } catch (error) {
      await api.showMessage(t('删除用户失败: ') + error.message, 'error')
    } finally {
      dialog.actionLoading = false
    }
  }

  async function saveSnippetFromTab(tab) {
    const sql = tab?.sqlQuery?.trim()
    if (!sql) {
      await api.showMessage(t('编辑器中没有 SQL'), 'warning')
      return
    }
    const name = await api.showPrompt('请输入片段名称：', '')
    if (!name) return
    const folder = String(historyDialog.value.folder || '').trim()
    rememberSnippetFolder(folder)
    querySnippets.value.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sql,
      folder,
      createdAt: Date.now()
    })
    persistSnippets()
    await api.showMessage(t('SQL 片段已保存'), 'success')
  }

  async function saveSnippetSql(sql) {
    const name = await api.showPrompt('请输入片段名称：', '')
    if (!name) return
    const folder = String(historyDialog.value.folder || '').trim()
    rememberSnippetFolder(folder)
    querySnippets.value.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sql,
      folder,
      createdAt: Date.now()
    })
    persistSnippets()
    await api.showMessage(t('SQL 片段已保存'), 'success')
  }

  async function deleteSnippet(id) {
    querySnippets.value = querySnippets.value.filter((item) => item.id !== id)
    persistSnippets()
  }

  function setSnippetFolder(id, folder) {
    const item = querySnippets.value.find((snippet) => snippet.id === id)
    if (!item) return
    item.folder = String(folder || '').trim()
    rememberSnippetFolder(item.folder)
    persistSnippets()
  }

  async function createSnippetFolder() {
    const name = await api.showPrompt('请输入收藏夹名称：', '')
    const folder = String(name || '').trim()
    if (!folder) return
    rememberSnippetFolder(folder)
    historyDialog.value.folder = folder
  }

  async function loadStructureMeta(tab) {
    structureDialog.value.loading = true
    try {
      const result = await dbGetTableMeta(tab.connectionName, tab.database, tab.tableName)
      if (!result.success) {
        await api.showMessage(result.error || t('读取表结构失败'), 'error')
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
        await api.showMessage(result.error || t('结构变更失败'), 'error')
        return false
      }
      if (result.renamedTo) {
        tab.tableName = result.renamedTo
        tab.name = result.renamedTo
      }
      await loadStructureMeta(tab)
      await api.executeTableQuery(tab, 1)
      await api.loadDatabaseObjects(tab.connectionName, tab.database, { force: true })
      await api.showMessage(t('表结构已更新'), 'success')
      return true
    } catch (error) {
      await api.showMessage(t('结构变更失败: ') + error.message, 'error')
      return false
    }
  }

  async function loadTableDesignerMeta(tab) {
    tableDesignerDialog.value.loading = true
    try {
      const result = await dbGetTableMeta(tab.connectionName, tab.database, tab.tableName)
      if (!result.success) {
        tableDesignerDialog.value.error = result.error || t('读取表结构失败')
        return
      }
      tableDesignerDialog.value.meta = result
    } finally {
      tableDesignerDialog.value.loading = false
    }
  }

  function openTableDesigner(tab) {
    if (!tab || tab.type !== 'table') return
    tableDesignerDialog.value = {
      show: true,
      tab,
      meta: null,
      loading: true,
      previewing: false,
      applying: false,
      sql: '',
      error: ''
    }
    loadTableDesignerMeta(tab)
  }

  function openTableDesignerTarget(target) {
    if (!target?.connection || !target.database || !target.table || target.isView) return
    openTableDesigner({
      type: 'table',
      connectionName: target.connection.name,
      database: target.database,
      tableName: target.table
    })
  }

  function closeTableDesigner() {
    tableDesignerDialog.value.show = false
    tableDesignerDialog.value.tab = null
    tableDesignerDialog.value.meta = null
    tableDesignerDialog.value.sql = ''
    tableDesignerDialog.value.error = ''
  }

  async function previewTableDesigner(tab, operations) {
    if (!tab) return null
    tableDesignerDialog.value.previewing = true
    try {
      const result = await dbPreviewAlterTable(tab.connectionName, tab.database, tab.tableName, operations)
      if (!result.success) {
        await api.showMessage(result.error || t('生成 SQL 失败'), 'error')
        return null
      }
      tableDesignerDialog.value.sql = result.sql
      return result
    } finally {
      tableDesignerDialog.value.previewing = false
    }
  }

  async function applyTableDesigner(tab, operations) {
    if (!tab) return false
    tableDesignerDialog.value.applying = true
    try {
      const result = await dbAlterTable(tab.connectionName, tab.database, tab.tableName, operations)
      if (!result.success) {
        await api.showMessage(result.error || t('结构变更失败'), 'error')
        return false
      }
      if (structureDialog.value.show && structureDialog.value.tab === tab) {
        await loadStructureMeta(tab)
      }
      const liveTab = tabs.value.find(
        (item) =>
          item.type === 'table' &&
          item.connectionName === tab.connectionName &&
          item.database === tab.database &&
          item.tableName === tab.tableName
      )
      if (liveTab) await api.executeTableQuery(liveTab, 1)
      await api.loadDatabaseObjects(tab.connectionName, tab.database, { force: true })
      await api.showMessage(t('表结构已更新'), 'success')
      closeTableDesigner()
      return true
    } catch (error) {
      await api.showMessage(t('结构变更失败: ') + error.message, 'error')
      return false
    } finally {
      tableDesignerDialog.value.applying = false
    }
  }

  async function openErDialog(tab) {
    if (!tab) return
    erDialog.value = { show: true, tab, data: null, loading: true }
    try {
      const result = await dbGetErData(tab.connectionName, tab.database)
      if (!result.success) {
        await api.showMessage(result.error || t('读取 ER 数据失败'), 'error')
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
      dialog.error = t('请描述要生成的 SQL 需求')
      return
    }

    dialog.loading = true
    dialog.error = ''
    dialog.result = ''

    try {
      const schema = await buildSchemaContext(tab)
      const content = [
        t('你是一位资深 MySQL 工程师，请根据数据库结构和需求生成可直接执行的 SQL。'),
        t('要求：只输出 SQL，使用 MySQL 语法，不要输出解释性文字；多条语句用英文分号分隔。'),
        schema ? `数据库结构:\n${schema}` : '',
        tab.sqlQuery ? `当前编辑器中的 SQL:\n${tab.sqlQuery}` : '',
        `需求: ${dialog.prompt}`
      ]
        .filter(Boolean)
        .join('\n\n')

      const result = await chat([{ role: 'user', content }], { toolsEnabled: false })
      if (!result.success) {
        dialog.error = result.error || t('AI 生成失败')
        return
      }
      dialog.result = extractSql(result.content)
      if (!dialog.result) {
        dialog.error = t('AI 未返回有效内容')
      }
    } catch (error) {
      dialog.error = t('AI 生成失败: {message}', { message: error.message })
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
    selectUser,
    loadUserGrants,
    openUserForm,
    closeUserForm,
    toggleUserPrivilege,
    submitUserForm,
    deleteSelectedUser,
    loadSqlIntoEditor,
    saveSnippetFromTab,
    saveSnippetSql,
    deleteSnippet,
    setSnippetFolder,
    createSnippetFolder,
    openStructureDialog,
    closeStructureDialog,
    loadStructureMeta,
    applyStructureChanges,
    openTableDesigner,
    openTableDesignerTarget,
    closeTableDesigner,
    previewTableDesigner,
    applyTableDesigner,
    openErDialog,
    closeErDialog,
    closeExplainDialog,
    openAiDialog,
    closeAiDialog,
    generateSqlForTab,
    applyAiResultToTab
  }
}
