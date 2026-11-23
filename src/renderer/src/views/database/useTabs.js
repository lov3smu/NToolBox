import { t } from '@/i18n'
import {
  dbApplyTableChanges,
  dbBeginTransaction,
  dbCancelQuery,
  dbCommitTransaction,
  dbExecuteQuery,
  dbExplainQuery,
  dbGetErData,
  dbGetTableMeta,
  dbRollbackTransaction,
  getConfig
} from '@/api'
import { buildPendingSql, coerceValue, keysForRow, rowKeyFor, isSameValue } from './rowEditing'
import { bindSqlParams, extractSqlParams } from './sqlParams'
import { matchesAccelerator } from '@/utils/shortcut'
import { DEFAULT_SHORTCUT_ACTIONS } from '@shared/shortcutActions'

const TAB_STORAGE_KEY = 'ntoolbox-db-tabs'

export function createTabs(state, api, options = {}) {
  const {
    activeTabId,
    autoLimit,
    connectionDatabases,
    connections,
    databaseObjectsMap,
    defaultPageSize,
    explainDialog,
    lastExecutedSql,
    lastExecutedTime,
    limitCount,
    resultCompareDialog,
    sqlParamsDialog,
    sqlPreviewDialog,
    tableSchemas,
    tabs,
    transactionConnections
  } = state

  function handleKeyDown(e) {
    const accelerator = options.runShortcut?.value || DEFAULT_SHORTCUT_ACTIONS.database_run
    if (!matchesAccelerator(e, accelerator)) return
    const activeTab = tabs.value.find((t) => t.id === activeTabId.value)
    if (activeTab?.type === 'query' && activeTab.sqlQuery && activeTab.connectionName && !activeTab.executing) {
      e.preventDefault()
      executeQueryForTab(activeTab)
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

  function createQueryTab(connName, dbName = '', options = {}) {
    const { name = t('无标题-查询'), sqlQuery = '', previewKey = null } = options

    if (previewKey) {
      const existingTab = tabs.value.find((t) => t.previewKey === previewKey)
      if (existingTab) {
        existingTab.connectionName = connName
        existingTab.database = dbName
        existingTab.sqlQuery = sqlQuery
        activeTabId.value = existingTab.id
        return existingTab
      }
    }

    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    tabs.value.push({
      id: queryId,
      name,
      type: 'query',
      closable: true,
      connectionName: connName,
      database: dbName,
      sqlQuery,
      previewKey,
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

    return tabs.value.find((t) => t.id === queryId)
  }

  function createTableTab(connName, dbName, tableName, isView = false) {
    const existingTab = tabs.value.find(
      (t) => t.type === 'table' && t.connectionName === connName && t.database === dbName && t.tableName === tableName
    )
    if (existingTab) {
      activeTabId.value = existingTab.id
      return existingTab
    }

    const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    tabs.value.push({
      id: tableId,
      name: tableName,
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
      isView,
      filters: [],
      searchKeyword: '',
      pageSize: defaultPageSize.value,
      sortField: null,
      sortDirection: null,
      sorts: [],
      hiddenFields: [],
      fieldWidths: {},
      frozenCount: 0,
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

  async function loadTabSchema(tab, { force = false } = {}) {
    if (!tab?.connectionName || !tab?.database) return
    const key = `${tab.connectionName}_${tab.database}`
    if (!force && tableSchemas.value[key]) return

    try {
      const result = await dbGetErData(tab.connectionName, tab.database)
      if (!result?.success) return
      const schema = {}
      for (const table of result.tables || []) {
        const columns = (table.columns || []).map((column) => {
          const notes = [
            column.columnKey === 'PRI' ? t('主键') : column.columnKey === 'UNI' ? t('唯一') : '',
            column.nullable === 'NO' ? t('非空') : t('可空')
          ]
          return {
            label: column.name,
            type: 'property',
            detail: column.columnType || undefined,
            info: notes.filter(Boolean).join(' · ') || undefined
          }
        })
        schema[table.name] = {
          self: {
            label: table.name,
            type: 'class',
            detail: t('表'),
            info: table.comment || undefined
          },
          children: columns
        }
      }
      tableSchemas.value = { ...tableSchemas.value, [key]: schema }
    } catch {
      return
    }
  }

  function getTabSchema(tab) {
    if (!tab?.connectionName || !tab?.database) return null
    return tableSchemas.value[`${tab.connectionName}_${tab.database}`] || null
  }

  function getTabPlaceholder(tab) {
    if (!tab.connectionName) return t('请先选择数据库连接...')
    if (!tab.database) return t('请选择数据库...')
    return t('输入SQL查询...')
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

  function getRiskyStatements(statements) {
    const risks = []
    for (const raw of statements) {
      const sql = String(raw || '').trim()
      if (!sql) continue
      const head = sql.replace(/^(?:\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\s)+/g, '')
      if (/^drop\b/i.test(head)) {
        risks.push({ sql, reason: /^drop\s+database\b/i.test(head) ? t('删除数据库') : t('删除对象') })
      } else if (/^truncate\b/i.test(head)) {
        risks.push({ sql, reason: t('清空表数据') })
      } else if (/^(update|delete)\b/i.test(head) && !/\bwhere\b/i.test(head)) {
        risks.push({ sql, reason: t('缺少 WHERE 条件') })
      }
    }
    return risks
  }

  async function confirmRiskyStatements(statements) {
    let safeMode
    try {
      const config = await getConfig()
      safeMode = config?.database?.safe_mode !== false
    } catch {
      safeMode = true
    }
    if (!safeMode) return true

    const risks = getRiskyStatements(statements)
    if (!risks.length) return true

    const preview = risks
      .slice(0, 3)
      .map((risk, index) => `${index + 1}. [${risk.reason}] ${risk.sql.split('\n')[0].slice(0, 120)}`)
      .join('\n')
    const more = risks.length > 3 ? t('… 另有 {count} 条', { count: risks.length - 3 }) : ''
    const message = [
      t('检测到 {count} 条高风险语句：', { count: risks.length }),
      preview,
      more,
      '',
      t('确认继续执行吗？')
    ]
      .filter(Boolean)
      .join('\n')
    return api.showConfirm(message, t('安全模式'))
  }

  function unquoteSqlIdentifier(value) {
    return String(value || '')
      .replace(/`{2}/g, '`')
      .replace(/^`|`$/g, '')
  }

  function parseSimpleSelectSource(sql) {
    const text = String(sql || '')
      .trim()
      .replace(/;\s*$/, '')
    const cleaned = text.replace(/^(?:\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\s)+/, '')
    if (!/^select\b/i.test(cleaned)) return null
    if (/\b(union|join|group\s+by|having|distinct|into\s+(?:outfile|dumpfile))\b/i.test(cleaned)) return null

    const fromMatch = /\bfrom\s+(`(?:[^`]|``)+`|[A-Za-z0-9_$]+)(?:\s*\.\s*(`(?:[^`]|``)+`|[A-Za-z0-9_$]+))?/i.exec(
      cleaned
    )
    if (!fromMatch) return null

    const selectPart = cleaned
      .slice(0, fromMatch.index)
      .replace(/^select\s+/i, '')
      .trim()
    if (!selectPart) return null
    for (const item of selectPart.split(',')) {
      const expression = item.trim()
      if (!expression) return null
      if (!/^(?:(?:`(?:[^`]|``)+`|[A-Za-z0-9_$]+)\s*\.\s*)?(?:\*|`(?:[^`]|``)+`|[A-Za-z0-9_$]+)$/.test(expression)) {
        return null
      }
    }

    let rest = cleaned.slice(fromMatch.index + fromMatch[0].length)
    const aliasMatch = /^\s+(?:as\s+)?(`(?:[^`]|``)+`|[A-Za-z0-9_$]+)/i.exec(rest)
    if (aliasMatch) {
      const alias = unquoteSqlIdentifier(aliasMatch[1])
      if (!/^(where|order|limit|for|lock|group|having|union|join|into|procedure)$/i.test(alias)) {
        rest = rest.slice(aliasMatch[0].length)
      }
    }
    if (/^\s*[,()]/.test(rest)) return null

    const first = unquoteSqlIdentifier(fromMatch[1])
    const second = fromMatch[2] ? unquoteSqlIdentifier(fromMatch[2]) : ''
    return second ? { database: first, tableName: second } : { database: '', tableName: first }
  }

  function findUniqueKey(meta) {
    const columnMap = new Map((meta.columns || []).map((column) => [column.name, column]))
    for (const index of meta.indexes || []) {
      if (!index.unique || index.primary || !index.columns?.length) continue
      if (index.columns.every((name) => columnMap.get(name)?.nullable === false)) {
        return [...index.columns]
      }
    }
    return []
  }

  function resetResultChanges(result) {
    result.rowEdits = {}
    result.rowDeletes = {}
    result.rowInserts = []
    result.selectedRows = {}
  }

  async function resolveResultEditing(tab, result) {
    result.editSource = null
    result.readonlyReason = ''
    result.editChecked = false
    result.editLoading = false
    result.editMode = false
    resetResultChanges(result)

    if (!result?.isSelect || !result?.rows?.length) return

    const source = parseSimpleSelectSource(result.sql)
    if (!source) {
      result.readonlyReason = t('仅支持单表 SELECT（不支持 JOIN、聚合、UNION 或字段别名）')
      result.editChecked = true
      return
    }

    const database = source.database || tab.database
    if (!database) {
      result.readonlyReason = t('无法确定结果来源数据库')
      result.editChecked = true
      return
    }

    result.editLoading = true
    try {
      const meta = await dbGetTableMeta(tab.connectionName, database, source.tableName)
      if (!meta.success) {
        result.readonlyReason = meta.error || t('读取来源表结构失败')
        return
      }
      if (meta.isView) {
        result.readonlyReason = t('视图结果不支持直接编辑')
        return
      }
      const fieldNames = (result.fields || []).map((field) => field.name)
      const columnNames = new Set((meta.columns || []).map((column) => column.name))
      if (!fieldNames.length || new Set(fieldNames).size !== fieldNames.length) {
        result.readonlyReason = t('结果字段无法唯一定位到表字段')
        return
      }
      if (fieldNames.some((name) => !columnNames.has(name))) {
        result.readonlyReason = t('结果包含表达式或别名，无法定位到表字段')
        return
      }
      const primaryKeys = meta.primaryKeys?.length ? [...meta.primaryKeys] : findUniqueKey(meta)
      if (!primaryKeys.length) {
        result.readonlyReason = t('来源表没有主键或非空唯一键，无法安全定位行')
        return
      }
      if (!primaryKeys.every((name) => fieldNames.includes(name))) {
        result.readonlyReason = t('结果缺少定位字段：{p0}', { p0: primaryKeys.join(', ') })
        return
      }
      result.editSource = {
        database,
        tableName: source.tableName,
        primaryKeys,
        isUniqueKey: !meta.primaryKeys?.length,
        columns: meta.columns || []
      }
    } catch (error) {
      result.readonlyReason = t('读取来源表结构失败: ') + error.message
    } finally {
      result.editLoading = false
      result.editChecked = true
    }
  }

  function canEditResult(result) {
    return Boolean(result?.editSource?.primaryKeys?.length)
  }

  function resultColumnMeta(result, fieldName) {
    return (result?.editSource?.columns || []).find((column) => column.name === fieldName)
  }

  function resultRowKey(result, row) {
    return rowKeyFor(result?.editSource?.primaryKeys, row)
  }

  function isResultRowDeleted(result, row) {
    const key = resultRowKey(result, row)
    return Boolean(key && result.rowDeletes?.[key])
  }

  function isResultRowUpdated(result, row) {
    const key = resultRowKey(result, row)
    return Boolean(key && result.rowEdits?.[key])
  }

  function isResultRowSelected(result, row) {
    const key = resultRowKey(result, row)
    return Boolean(key && result.selectedRows?.[key])
  }

  function getResultCellValue(result, row, fieldName) {
    const key = resultRowKey(result, row)
    const entry = key ? result.rowEdits?.[key] : null
    if (entry && Object.prototype.hasOwnProperty.call(entry.values, fieldName)) {
      return entry.values[fieldName]
    }
    return row[fieldName]
  }

  function isResultCellEdited(result, row, fieldName) {
    const key = resultRowKey(result, row)
    const entry = key ? result.rowEdits?.[key] : null
    return Boolean(entry && Object.prototype.hasOwnProperty.call(entry.values, fieldName))
  }

  function updateResultCell(result, row, fieldName, raw) {
    if (!canEditResult(result)) return
    const key = resultRowKey(result, row)
    if (!key) return
    const column = resultColumnMeta(result, fieldName)
    const value = coerceValue(column, raw)
    const entry = result.rowEdits[key] || {
      keys: keysForRow(result.editSource.primaryKeys, row),
      values: {}
    }
    if (isSameValue(value, row[fieldName])) {
      delete entry.values[fieldName]
    } else {
      entry.values[fieldName] = value
    }
    if (Object.keys(entry.values).length) {
      result.rowEdits[key] = entry
    } else {
      delete result.rowEdits[key]
    }
  }

  function toggleResultRowSelection(result, row) {
    if (!canEditResult(result)) return
    const key = resultRowKey(result, row)
    if (!key) return
    if (result.selectedRows[key]) {
      delete result.selectedRows[key]
    } else {
      result.selectedRows[key] = keysForRow(result.editSource.primaryKeys, row)
    }
  }

  function toggleAllResultRows(result, checked) {
    if (!canEditResult(result)) return
    if (!checked) {
      result.selectedRows = {}
      return
    }
    const next = {}
    for (const row of result.rows || []) {
      if (isResultRowDeleted(result, row)) continue
      const key = resultRowKey(result, row)
      if (key) next[key] = keysForRow(result.editSource.primaryKeys, row)
    }
    result.selectedRows = next
  }

  function isAllResultRowsSelected(result) {
    const rows = (result?.rows || []).filter((row) => !isResultRowDeleted(result, row))
    if (!rows.length) return false
    return rows.every((row) => isResultRowSelected(result, row))
  }

  function deleteResultRow(result, row) {
    const key = resultRowKey(result, row)
    if (!key) return
    result.rowDeletes[key] = keysForRow(result.editSource.primaryKeys, row)
    delete result.selectedRows[key]
  }

  function deleteSelectedResultRows(result) {
    const selected = Object.entries(result.selectedRows || {})
    if (!selected.length) {
      api.showMessage(t('请先勾选要删除的行'), 'warning')
      return
    }
    for (const [key, keys] of selected) {
      result.rowDeletes[key] = keys
      delete result.selectedRows[key]
    }
  }

  function restoreResultDeletedRow(result, row) {
    const key = resultRowKey(result, row)
    if (key) delete result.rowDeletes[key]
  }

  function addResultRow(result) {
    if (!canEditResult(result)) return
    const values = {}
    for (const field of result.fields || []) {
      const column = resultColumnMeta(result, field.name)
      if (column && !column.autoIncrement) values[field.name] = ''
    }
    result.rowInserts.push({ values })
  }

  function setResultNewRowValue(result, index, fieldName, raw) {
    const draft = result.rowInserts[index]
    if (!draft) return
    draft.values[fieldName] = coerceValue(resultColumnMeta(result, fieldName), raw) ?? ''
  }

  function removeResultNewRow(result, index) {
    result.rowInserts.splice(index, 1)
  }

  function getResultPendingCounts(result) {
    return {
      updated: Object.values(result?.rowEdits || {}).filter((entry) => Object.keys(entry.values || {}).length > 0)
        .length,
      deleted: Object.keys(result?.rowDeletes || {}).length,
      inserted: result?.rowInserts?.length || 0
    }
  }

  function hasResultPendingChanges(result) {
    const counts = getResultPendingCounts(result)
    return counts.updated + counts.deleted + counts.inserted > 0
  }

  async function discardResultChanges(result) {
    if (!hasResultPendingChanges(result)) return
    if (!(await api.showConfirm(t('确定撤销结果中的所有未提交修改吗？')))) return
    resetResultChanges(result)
  }

  async function toggleResultEditMode(result) {
    if (!canEditResult(result)) {
      await api.showMessage(result?.readonlyReason || t('当前结果不支持编辑'), 'warning')
      return
    }
    if (result.editMode && hasResultPendingChanges(result)) {
      const confirmed = await api.showConfirm(t('退出编辑会丢弃未提交的修改，是否继续？'))
      if (!confirmed) return
      resetResultChanges(result)
    }
    result.editMode = !result.editMode
  }

  function previewResultChanges(result) {
    if (!canEditResult(result)) return
    const sql = buildPendingSql({
      database: result.editSource.database,
      tableName: result.editSource.tableName,
      rowEdits: result.rowEdits,
      rowDeletes: result.rowDeletes,
      rowInserts: result.rowInserts
    })
    if (!sql) {
      api.showMessage(t('没有待保存的修改'), 'info')
      return
    }
    sqlPreviewDialog.value = { show: true, title: t('待执行的 SQL'), sql }
  }

  async function refreshResultAfterSave(tab, result) {
    const sql = String(result.sql || '')
      .trim()
      .replace(/;\s*$/, '')
    const hasLimit = /\blimit\b/i.test(sql)
    const limitValue = autoLimit.value ? limitCount.value : 100000
    const executed = await dbExecuteQuery(tab.connectionName, sql, result.params || [], {
      autoLimit: !hasLimit,
      limit: limitValue,
      database: result.editSource.database
    })
    if (!executed.success) throw new Error(executed.error || t('刷新结果失败'))

    result.rows = executed.rows || []
    result.fields = executed.fields || []
    result.rowCount = executed.rowCount || result.rows.length
    if (!hasLimit) {
      try {
        const countResult = await dbExecuteQuery(
          tab.connectionName,
          `SELECT COUNT(*) AS total FROM (${sql}) AS __ntb_count`,
          result.params || [],
          { autoLimit: false, database: result.editSource.database }
        )
        if (countResult.success && countResult.rows?.[0]) {
          result.totalRows = Number(countResult.rows[0].total) || result.rows.length
          result.totalPages = Math.max(1, Math.ceil(result.totalRows / limitValue))
          result.currentPage = 1
          result.jumpPage = 1
          result.pageSize = limitValue
        }
      } catch {
        // 计数失败时保留原有分页信息
      }
    }

    await resolveResultEditing(tab, result)
    if (result.editSource) result.editMode = true
  }

  async function saveResultChanges(tab, result) {
    if (!canEditResult(result) || !hasResultPendingChanges(result)) {
      await api.showMessage(t('没有待保存的修改'), 'info')
      return
    }
    result.saving = true
    try {
      const updates = Object.values(result.rowEdits)
        .filter((entry) => Object.keys(entry.values || {}).length > 0)
        .map((entry) => ({ keys: { ...entry.keys }, values: { ...entry.values } }))
      const deletes = Object.values(result.rowDeletes).map((keys) => ({ ...keys }))
      const inserts = result.rowInserts.map((draft) => {
        const values = {}
        for (const [field, raw] of Object.entries(draft.values || {})) {
          const column = resultColumnMeta(result, field)
          if (column?.autoIncrement && (raw === '' || raw === null)) continue
          values[field] = coerceValue(column, raw)
        }
        return values
      })

      const saved = await dbApplyTableChanges(
        tab.connectionName,
        result.editSource.database,
        result.editSource.tableName,
        { updates, deletes, inserts }
      )
      if (!saved.success) {
        await api.showMessage(t('保存失败: ') + (saved.error || ''), 'error')
        return
      }

      await api.showMessage(
        t('保存成功（更新 {p0}，删除 {p1}，新增 {p2}）', {
          p0: saved.updated || 0,
          p1: saved.deleted || 0,
          p2: saved.inserted || 0
        }),
        'success'
      )
      await refreshResultAfterSave(tab, result)
      await api.loadDatabaseObjects(tab.connectionName, result.editSource.database, undefined, { force: true })
    } catch (error) {
      await api.showMessage(t('保存结果失败: ') + error.message, 'error')
    } finally {
      result.saving = false
    }
  }

  function requestSqlParamValues(names, sql) {
    return new Promise((resolve) => {
      sqlParamsDialog.value = {
        show: true,
        sql,
        params: names.map((name) => ({ name, value: '' })),
        resolve
      }
    })
  }

  const isParamValueEmpty = (value) => value === '' || value === undefined || value === null

  async function executeQueryForTab(tab, sqlOverride) {
    if (!tab.connectionName) return

    const sqlContent = typeof sqlOverride === 'string' && sqlOverride.trim() ? sqlOverride : getExecutionSql(tab)
    if (!sqlContent || sqlContent.trim() === '') return

    if ((tab.queryResults || []).some(hasResultPendingChanges)) {
      const confirmed = await api.showConfirm(t('当前结果有未提交的修改，重新执行会丢弃这些修改，是否继续？'))
      if (!confirmed) return
    }

    await ensureTabConnection(tab)

    const statements = api.parseSqlStatements(sqlContent)
    if (statements.length === 0) return

    if (!(await confirmRiskyStatements(statements))) return

    if (!(await api.confirmSqlAudit(statements))) return

    const paramNames = [...new Set(statements.flatMap((statement) => extractSqlParams(statement)))]
    let paramValues = {}
    if (paramNames.length) {
      const values = await requestSqlParamValues(paramNames, sqlContent)
      if (!values) return
      const missing = paramNames.filter((name) => isParamValueEmpty(values[name]))
      if (missing.length) {
        await api.showMessage(t('参数未填写: {p0}', { p0: missing.join(', ') }), 'warning')
        return
      }
      paramValues = values
    }

    tab.executing = true
    tab.canceling = false

    if (tab.queryResult?.success && Array.isArray(tab.queryResult.rows)) {
      tab.previousResult = {
        rows: tab.queryResult.rows,
        fields: tab.queryResult.fields,
        sql: tab.queryResult.displaySql || tab.queryResult.sql,
        capturedAt: Date.now()
      }
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

        const bound = bindSqlParams(sql, paramValues)
        sql = bound.sql
        const statementParams = bound.params
        const isSelect = /^\s*(select|with)\b/i.test(sql)
        const hasLimit = /\blimit\b/i.test(sql)
        const requestId = `${tab.id}_${Date.now()}_${i}`

        const startTime = Date.now()
        const result = await dbExecuteQuery(tab.connectionName, sql, statementParams, {
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
              statementParams,
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

        const entry = {
          index: i,
          name: t('结果({p0})', { p0: i + 1 }),
          sql,
          displaySql: originalSql,
          params: statementParams,
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
        }
        tab.queryResults.push(entry)
        if (entry.isSelect) {
          await resolveResultEditing(tab, entry)
        }

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
          name: t('结果(1)'),
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

  function openResultCompare(tab) {
    if (!tab?.queryResult?.success || !tab.previousResult) return
    resultCompareDialog.value = { show: true, tab }
  }

  function closeResultCompare() {
    resultCompareDialog.value.show = false
    resultCompareDialog.value.tab = null
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
      await api.showMessage(result.error || t('无法取消查询'), 'warning')
    }
  }

  async function explainQueryForTab(tab) {
    if (!tab.connectionName) return
    const sqlContent = getExecutionSql(tab)
    if (!sqlContent || !sqlContent.trim()) {
      await api.showMessage(t('请输入要分析的 SQL'), 'warning')
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
      await api.showMessage(t('事务已开始'), 'success')
    } else {
      await api.showMessage(result.error || t('开始事务失败'), 'error')
    }
  }

  async function commitTransactionForTab(tab) {
    const result = await dbCommitTransaction(tab.connectionName)
    if (result.success) {
      tab.inTransaction = false
      transactionConnections.value = transactionConnections.value.filter((name) => name !== tab.connectionName)
      await api.showMessage(t('事务已提交'), 'success')
    } else {
      await api.showMessage(result.error || t('提交事务失败'), 'error')
    }
  }

  async function rollbackTransactionForTab(tab) {
    const result = await dbRollbackTransaction(tab.connectionName)
    if (result.success) {
      tab.inTransaction = false
      transactionConnections.value = transactionConnections.value.filter((name) => name !== tab.connectionName)
      await api.showMessage(t('事务已回滚'), 'success')
    } else {
      await api.showMessage(result.error || t('回滚事务失败'), 'error')
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
            sqlQuery: tab.sqlQuery,
            name: tab.name,
            previewKey: tab.previewKey || null
          }
        }
        return {
          type: 'table',
          connectionName: tab.connectionName,
          database: tab.database,
          tableName: tab.tableName,
          pageSize: tab.pageSize,
          isView: Boolean(tab.isView)
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
          name: item.name || t('无标题-查询'),
          type: 'query',
          closable: true,
          connectionName: item.connectionName,
          database: item.database || '',
          sqlQuery: item.sqlQuery || '',
          previewKey: item.previewKey || null,
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
        const isView = Boolean(item.isView)
        const exists = tabs.value.some(
          (tab) =>
            tab.type === 'table' &&
            tab.connectionName === item.connectionName &&
            tab.database === item.database &&
            tab.tableName === item.tableName
        )
        if (exists) continue
        const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        tabs.value.push({
          id: tableId,
          name: item.tableName,
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
          isView,
          filters: [],
          searchKeyword: '',
          pageSize: item.pageSize || defaultPageSize.value,
          sortField: null,
          sortDirection: null,
          sorts: [],
          hiddenFields: [],
          fieldWidths: {},
          frozenCount: 0,
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
    loadTabSchema,
    getTabSchema,
    getTabPlaceholder,
    onTabConnectionChange,
    onTabDatabaseChange,
    executeQueryForTab,
    switchResultTab,
    openResultCompare,
    closeResultCompare,
    canEditResult,
    resultColumnMeta,
    resultRowKey,
    getResultPendingCounts,
    hasResultPendingChanges,
    isResultRowDeleted,
    isResultRowUpdated,
    isResultRowSelected,
    getResultCellValue,
    isResultCellEdited,
    updateResultCell,
    toggleResultRowSelection,
    toggleAllResultRows,
    isAllResultRowsSelected,
    deleteResultRow,
    deleteSelectedResultRows,
    restoreResultDeletedRow,
    addResultRow,
    setResultNewRowValue,
    removeResultNewRow,
    discardResultChanges,
    toggleResultEditMode,
    previewResultChanges,
    saveResultChanges,
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
