import { t } from '@/i18n'
import { watch } from 'vue'
import { rankSchemaTables } from './schemaContext'
import { formatSql } from './sqlFormat'
import {
  chat,
  dbAlterTable,
  dbCreateUser,
  dbDropUser,
  dbGetErData,
  dbGetTableMeta,
  dbGetUserGrants,
  dbHistoryAdd,
  dbHistoryClear,
  dbHistoryRemove,
  dbPreviewAlterTable,
  dbQueryUsers,
  dbSetUserPassword,
  dbSetUserPrivileges,
  dbSnippetFolderAdd,
  dbSnippetRemove,
  dbSnippetSave,
  dbToolsState
} from '@/api'

const HISTORY_KEY = 'ntoolbox-db-query-history'
const HISTORY_LIMIT = 200
const SNIPPET_KEY = 'ntoolbox-db-sql-snippets'
const SNIPPET_FOLDER_KEY = 'ntoolbox-db-sql-snippet-folders'
const LEGACY_KEYS = [HISTORY_KEY, SNIPPET_KEY, SNIPPET_FOLDER_KEY]

function readLegacy(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function clearLegacy() {
  for (const key of LEGACY_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      // 存储不可用时忽略
    }
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
    historyHasMore,
    historyLoading,
    historyTotal,
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

  function applyHistoryPage(page, append = false) {
    if (!page) return
    const items = Array.isArray(page.items) ? page.items : []
    queryHistory.value = append ? [...queryHistory.value, ...items] : items
    historyTotal.value = Number(page.total) || 0
    historyHasMore.value = Boolean(page.hasMore)
  }

  async function loadAdvancedState(options = {}) {
    try {
      const result = await dbToolsState({
        historyLimit: historyLimit(),
        offset: options.offset || 0,
        legacy: options.legacy
      })
      applyHistoryPage(result.history, Boolean(options.offset))
      querySnippets.value = Array.isArray(result.snippets) ? result.snippets : []
      snippetFolders.value = Array.isArray(result.folders) ? result.folders : []
      if (options.legacy) clearLegacy()
    } catch {
      // 读取失败时保持空列表
    }
  }

  loadAdvancedState({
    legacy: {
      history: readLegacy(HISTORY_KEY),
      snippets: readLegacy(SNIPPET_KEY),
      folders: readLegacy(SNIPPET_FOLDER_KEY)
    }
  })

  if (options.historyLimit) {
    watch(options.historyLimit, () => {
      void loadAdvancedState()
    })
  }

  async function loadMoreHistory() {
    if (historyLoading.value || !historyHasMore.value) return
    historyLoading.value = true
    try {
      await loadAdvancedState({ offset: queryHistory.value.length })
    } finally {
      historyLoading.value = false
    }
  }

  function rememberSnippetFolder(folder) {
    const name = String(folder || '').trim()
    if (!name) return
    if (!snippetFolders.value.includes(name)) snippetFolders.value.push(name)
    void dbSnippetFolderAdd(name).catch(() => {})
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
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      ...entry
    }
    queryHistory.value.unshift(item)
    const limit = historyLimit()
    if (queryHistory.value.length > limit) {
      queryHistory.value = queryHistory.value.slice(0, limit)
    }
    historyTotal.value = Math.min(historyTotal.value + 1, limit)
    historyHasMore.value = queryHistory.value.length < historyTotal.value
    void dbHistoryAdd(item, { historyLimit: limit }).catch(() => {})
  }

  async function removeHistoryItem(id) {
    queryHistory.value = queryHistory.value.filter((item) => item.id !== id)
    historyTotal.value = Math.max(0, historyTotal.value - 1)
    historyHasMore.value = queryHistory.value.length < historyTotal.value
    await dbHistoryRemove(id).catch(() => {})
  }

  async function clearHistory() {
    if (!historyTotal.value && !queryHistory.value.length) return
    const confirmed = await api.showConfirm(t('确定清空全部查询历史吗？'))
    if (!confirmed) return
    queryHistory.value = []
    historyTotal.value = 0
    historyHasMore.value = false
    await dbHistoryClear().catch(() => {})
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
    const snippet = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sql,
      folder,
      createdAt: Date.now()
    }
    querySnippets.value.unshift(snippet)
    void dbSnippetSave(snippet).catch(() => {})
    await api.showMessage(t('SQL 片段已保存'), 'success')
  }

  async function saveSnippetSql(sql) {
    const name = await api.showPrompt('请输入片段名称：', '')
    if (!name) return
    const folder = String(historyDialog.value.folder || '').trim()
    rememberSnippetFolder(folder)
    const snippet = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      sql,
      folder,
      createdAt: Date.now()
    }
    querySnippets.value.unshift(snippet)
    void dbSnippetSave(snippet).catch(() => {})
    await api.showMessage(t('SQL 片段已保存'), 'success')
  }

  async function deleteSnippet(id) {
    querySnippets.value = querySnippets.value.filter((item) => item.id !== id)
    await dbSnippetRemove(id).catch(() => {})
  }

  function setSnippetFolder(id, folder) {
    const item = querySnippets.value.find((snippet) => snippet.id === id)
    if (!item) return
    item.folder = String(folder || '').trim()
    rememberSnippetFolder(item.folder)
    void dbSnippetSave(item).catch(() => {})
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
      database: tab?.database || selectedDatabase.value || '',
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

  const SCHEMA_FETCH_LIMIT = 1000
  const SCHEMA_TABLE_LIMIT = 200
  const SCHEMA_CHAR_BUDGET = 64000
  const SCHEMA_NAME_BUDGET = 4000
  const SCHEMA_FK_LIMIT = 200

  function schemaColumnLine(column) {
    const parts = [`  - ${column.name} ${column.columnType || ''}`.trimEnd()]
    if (column.columnKey === 'PRI') parts.push('PK')
    if (column.nullable === 'NO') parts.push('NOT NULL')
    if (column.comment) parts.push(`-- ${column.comment}`)
    return parts.join(' ')
  }

  async function buildSchemaContext(tab, database, prompt) {
    const lines = []
    const key = `${tab.connectionName}_${database}`
    const objects = databaseObjectsMap.value[key]
    let liveTables = null
    let foreignKeys = []

    if (tab.connectionName && database) {
      const result = await dbGetErData(tab.connectionName, database, SCHEMA_FETCH_LIMIT)
      if (result.success && Array.isArray(result.tables)) {
        liveTables = result.tables
        foreignKeys = result.foreignKeys || []
      }
    }

    if (liveTables?.length) {
      const ranked = rankSchemaTables(liveTables, prompt).slice(0, SCHEMA_TABLE_LIMIT)
      lines.push(`数据库: ${database}`, `表结构（共 ${liveTables.length} 张表）:`)
      let used = lines.join('\n').length
      const listedTables = []
      for (const table of ranked) {
        const block = [`- ${table.name}${table.comment ? ` -- ${table.comment}` : ''}`]
        for (const column of table.columns || []) block.push(schemaColumnLine(column))
        const text = block.join('\n')
        if (used + text.length > SCHEMA_CHAR_BUDGET) break
        lines.push(text)
        used += text.length + 1
        listedTables.push(table.name)
      }
      if (listedTables.length < liveTables.length) {
        const omitted = ranked
          .slice(listedTables.length)
          .map((table) => table.name)
          .filter(Boolean)
        const names = []
        let nameLength = 0
        for (const name of omitted) {
          if (nameLength + name.length > SCHEMA_NAME_BUDGET) break
          names.push(name)
          nameLength += name.length + 2
        }
        lines.push(
          names.length
            ? `（其余 ${liveTables.length - listedTables.length} 张表仅列出表名: ${names.join(', ')}${
                names.length < omitted.length ? ' 等' : ''
              }）`
            : `（其余 ${liveTables.length - listedTables.length} 张表未列出）`
        )
      }
      if (foreignKeys.length) {
        const tableSet = new Set(listedTables)
        const relevant = foreignKeys.filter((fk) => tableSet.has(fk.tableName) || tableSet.has(fk.refTable))
        lines.push('外键关系:')
        for (const fk of (relevant.length ? relevant : foreignKeys).slice(0, SCHEMA_FK_LIMIT)) {
          lines.push(`- ${fk.tableName}.${fk.columnName} -> ${fk.refTable}.${fk.refColumn}`)
        }
      }
      if (objects?.views?.length) lines.push(`视图: ${objects.views.slice(0, 60).join(', ')}`)
    } else if (objects?.tables?.length) {
      lines.push(
        `数据库 ${database} 中的表: ${objects.tables.slice(0, 120).join(', ')}${
          objects.views?.length ? `\n视图: ${objects.views.slice(0, 60).join(', ')}` : ''
        }`
      )
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
      const database = tab.database || selectedDatabase.value || ''
      if (!tab.connectionName || !database) {
        dialog.error = t('请先选择要分析的目标数据库')
        return
      }
      dialog.database = database
      const schema = await buildSchemaContext(tab, database, dialog.prompt)
      const content = [
        t(
          '你是一位资深 MySQL 工程师。请先分析下面数据库中的表、字段、注释和外键关系，再根据需求生成可直接执行的 SQL。'
        ),
        t('要求：只使用结构中真实存在的表和字段，不得臆造；表或字段含义不明确时按名称与注释选择最匹配的。'),
        t(
          '生成前先在表结构中定位需求涉及的业务表：按表名、表注释和字段注释匹配业务含义（例如需求提到“合同”，应使用表名或注释中含“合同”的表），表名是英文或缩写时也不要跳过。'
        ),
        t('需要多表关联时优先使用外键关系；只输出 SQL，使用 MySQL 语法，不要输出解释性文字，多条语句用英文分号分隔。'),
        schema ? `数据库结构:\n${schema}` : t('未能读取数据库结构，请根据常见命名约定谨慎推断。'),
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
      const sql = extractSql(result.content)
      dialog.result = sql ? formatSql(sql) : ''
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
    loadMoreHistory,
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
