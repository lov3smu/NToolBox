import { t } from '@/i18n'
import {
  dbApplyTableChanges,
  dbExportTable,
  dbGetTableCellValue,
  dbGetTableData,
  dbGetTableMeta,
  saveSqlFile,
  writeFile
} from '@/api'
import { copyToClipboard } from '@/utils/clipboard'
import { buildPendingSql, coerceValue, isSameValue, quoteIdentifier, escapeSqlValue } from './rowEditing'

export function createTableOps(state, api) {
  const { defaultPageSize, lastExecutedSql, lastExecutedTime, selectedDatabase, sqlPreviewDialog, cellFilterMenu } =
    state

  const TABLE_VIEW_KEY = 'ntoolbox-db-table-views'
  const rowKeyCache = new WeakMap()

  function tableViewKey(tab) {
    return [tab.connectionName, tab.database, tab.tableName].join('|')
  }

  function readTableViewConfigs() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TABLE_VIEW_KEY) || '{}')
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  }

  function loadTableViewConfig(tab) {
    if (tab.viewConfigLoaded) return
    tab.viewConfigLoaded = true
    const config = readTableViewConfigs()[tableViewKey(tab)] || {}
    if (Array.isArray(config.hiddenFields)) tab.hiddenFields = config.hiddenFields
    if (config.fieldWidths && typeof config.fieldWidths === 'object') tab.fieldWidths = config.fieldWidths
    if (Number.isFinite(config.frozenCount)) tab.frozenCount = config.frozenCount
  }

  function saveTableViewConfig(tab) {
    try {
      const configs = readTableViewConfigs()
      configs[tableViewKey(tab)] = {
        hiddenFields: tab.hiddenFields || [],
        fieldWidths: tab.fieldWidths || {},
        frozenCount: tab.frozenCount || 0
      }
      localStorage.setItem(TABLE_VIEW_KEY, JSON.stringify(configs))
    } catch {
      // 本地存储不可用时忽略列视图记忆
    }
  }

  function syncSortState(tab) {
    const current = Array.isArray(tab.sorts) ? tab.sorts : []
    const valid = current.filter((item) => item && item.field)
    if (valid.length !== current.length) tab.sorts = valid
    const firstField = valid[0]?.field || null
    const firstOrder = valid[0]?.order || null
    if (tab.sortField !== firstField) tab.sortField = firstField
    if (tab.sortDirection !== firstOrder) tab.sortDirection = firstOrder
  }

  function ensureTableState(tab) {
    if (!tab.filters) tab.filters = []
    for (const filter of tab.filters) {
      if (!filter.connector) filter.connector = 'AND'
    }
    if (tab.searchKeyword === undefined) tab.searchKeyword = ''
    if (!tab.pageSize) tab.pageSize = defaultPageSize.value
    if (!Array.isArray(tab.sorts)) {
      tab.sorts = tab.sortField ? [{ field: tab.sortField, order: tab.sortDirection || 'ASC' }] : []
    }
    syncSortState(tab)
    if (!tab.rowEdits) tab.rowEdits = {}
    if (!tab.rowDeletes) tab.rowDeletes = {}
    if (!tab.rowInserts) tab.rowInserts = []
    if (!tab.selectedRows) tab.selectedRows = {}
    if (!tab.columns) tab.columns = []
    if (!tab.primaryKeys) tab.primaryKeys = []
    if (!tab.fieldOrder) tab.fieldOrder = []
    if (!Array.isArray(tab.hiddenFields)) tab.hiddenFields = []
    if (!tab.fieldWidths || typeof tab.fieldWidths !== 'object') tab.fieldWidths = {}
    if (!Number.isFinite(tab.frozenCount)) tab.frozenCount = 0
    if (tab.isView === undefined) tab.isView = false
    loadTableViewConfig(tab)
  }

  async function openTable(target) {
    if (!target.connection || !target.database || !target.table) return

    api.selectConnection(target.connection)
    selectedDatabase.value = target.database

    if (!target.connection.active) {
      await api.connectToDatabase()
    }

    const tab = api.createTableTab(target.connection.name, target.database, target.table, Boolean(target.isView))
    if (tab) {
      await executeTableQuery(tab, 1)
    }
  }

  async function executeTableQuery(tab, page) {
    ensureTableState(tab)
    if (!tab.connectionName || !tab.database || !tab.tableName) return

    const requestedPage = Math.max(1, Number(page) || 1)
    tab.executing = true
    const startedAt = Date.now()

    try {
      const filters = tab.filters
        .filter((filter) => filter.field && filter.operator)
        .map((filter) => {
          if (filter.operator === 'BETWEEN' && typeof filter.value === 'string') {
            const [start, end] = filter.value.split(/[,~]/).map((value) => value.trim())
            return { ...filter, value: [start ?? null, end ?? null] }
          }
          return { ...filter }
        })
      const countSignature = JSON.stringify({ filters, search: tab.searchKeyword })
      const previousResult = tab.queryResult?.success ? tab.queryResult : null
      const reuseTotal =
        requestedPage > 1 &&
        previousResult?.countSignature === countSignature &&
        Number.isFinite(previousResult.totalRows)

      const result = await dbGetTableData(tab.connectionName, tab.database, tab.tableName, {
        page: requestedPage,
        pageSize: tab.pageSize,
        filters,
        search: tab.searchKeyword,
        sort: tab.sorts.length ? tab.sorts.map((item) => ({ field: item.field, order: item.order })) : null,
        total: reuseTotal ? previousResult.totalRows : undefined
      })

      if (!result.success) {
        tab.queryResult = { success: false, error: result.error }
        return
      }

      lastExecutedSql.value = result.sql || ''
      lastExecutedTime.value = Date.now() - startedAt

      const fieldNames = (result.fields || []).map((field) => field.name)
      const keepOrder =
        tab.fieldOrder.length > 0 &&
        fieldNames.every((name) => tab.fieldOrder.includes(name)) &&
        tab.fieldOrder.every((name) => fieldNames.includes(name))
      tab.fieldOrder = keepOrder ? tab.fieldOrder : fieldNames

      tab.columns = result.columns || []
      tab.primaryKeys = result.primaryKeys || []
      tab.isView = Boolean(result.isView)

      tab.queryResult = {
        success: true,
        rows: result.rows || [],
        fields: result.fields || [],
        lazyColumns: result.lazyColumns || [],
        countApproximate: Boolean(result.countApproximate),
        countSignature,
        totalRows: result.total,
        currentPage: result.page,
        totalPages: result.pageCount,
        pageSize: result.pageSize,
        isSelect: true,
        isView: tab.isView,
        duration: Date.now() - startedAt,
        jumpPage: result.page
      }

      tab.selectedRows = {}
      tab.rowEdits = {}
      tab.rowDeletes = {}
      tab.rowInserts = []
    } catch (error) {
      console.error('查询表数据失败:', error)
      tab.queryResult = { success: false, error: error.message }
    } finally {
      tab.executing = false
    }
  }

  function hasPendingChanges(tab) {
    ensureTableState(tab)
    return Object.keys(tab.rowEdits).length > 0 || Object.keys(tab.rowDeletes).length > 0 || tab.rowInserts.length > 0
  }

  function getPendingCounts(tab) {
    ensureTableState(tab)
    return {
      updated: Object.values(tab.rowEdits).filter((entry) => Object.keys(entry.values || {}).length > 0).length,
      deleted: Object.keys(tab.rowDeletes).length,
      inserted: tab.rowInserts.length
    }
  }

  function canEditTable(tab) {
    return !tab.isView && Array.isArray(tab.primaryKeys) && tab.primaryKeys.length > 0
  }

  async function confirmDiscardPending(tab) {
    if (!hasPendingChanges(tab)) return true
    return Boolean(await api.showConfirm(t('此操作会丢弃未保存的修改，是否继续？')))
  }

  function rowKey(tab, row) {
    const primaryKeys = tab.primaryKeys || []
    if (!primaryKeys.length || !row || typeof row !== 'object') return null
    if (rowKeyCache.has(row)) return rowKeyCache.get(row)
    const key = JSON.stringify(primaryKeys.map((key) => (row[key] === undefined ? null : row[key])))
    rowKeyCache.set(row, key)
    return key
  }

  function keysForRow(tab, row) {
    const keys = {}
    for (const key of tab.primaryKeys || []) {
      keys[key] = row[key] === undefined ? null : row[key]
    }
    return keys
  }

  function isRowDeleted(tab, row) {
    const key = rowKey(tab, row)
    return Boolean(key && tab.rowDeletes[key])
  }

  function isRowUpdated(tab, row) {
    const key = rowKey(tab, row)
    return Boolean(key && tab.rowEdits[key])
  }

  function isRowSelected(tab, row) {
    const key = rowKey(tab, row)
    return Boolean(key && tab.selectedRows[key])
  }

  function getCellValue(tab, row, field) {
    const key = rowKey(tab, row)
    const edit = key ? tab.rowEdits[key] : null
    if (edit && Object.prototype.hasOwnProperty.call(edit.values, field)) {
      return edit.values[field]
    }
    return row[field]
  }

  function fetchTableCellValue(tab, row, field) {
    return dbGetTableCellValue(tab.connectionName, tab.database, tab.tableName, field, keysForRow(tab, row))
  }

  function isLazyCell(tab, field) {
    return (tab.queryResult?.lazyColumns || []).includes(field)
  }

  async function resolveLazyRowValues(tab, rows) {
    const lazyColumns = tab.queryResult?.lazyColumns || []
    if (!lazyColumns.length) return rows
    const resolved = []
    for (const row of rows) {
      const copy = { ...row }
      for (const field of lazyColumns) {
        if (copy[field] === null || copy[field] === undefined) continue
        const result = await fetchTableCellValue(tab, row, field)
        if (result?.success) copy[field] = result.value
      }
      resolved.push(copy)
    }
    return resolved
  }

  function updateCell(tab, row, field, raw) {
    ensureTableState(tab)
    const key = rowKey(tab, row)
    if (!key) return

    const column = tab.columns.find((item) => item.name === field)
    const value = coerceValue(column, raw)
    const entry = tab.rowEdits[key] || { keys: keysForRow(tab, row), values: {} }

    if (isSameValue(value, row[field])) {
      delete entry.values[field]
    } else {
      entry.values[field] = value
    }

    if (Object.keys(entry.values).length > 0) {
      tab.rowEdits[key] = entry
    } else {
      delete tab.rowEdits[key]
    }
  }

  function toggleRowSelection(tab, row) {
    ensureTableState(tab)
    const key = rowKey(tab, row)
    if (!key) return
    if (tab.selectedRows[key]) {
      delete tab.selectedRows[key]
    } else {
      tab.selectedRows[key] = keysForRow(tab, row)
    }
  }

  function toggleAllRows(tab, checked) {
    ensureTableState(tab)
    if (!checked) {
      tab.selectedRows = {}
      return
    }
    const next = {}
    for (const row of tab.queryResult?.rows || []) {
      if (isRowDeleted(tab, row)) continue
      const key = rowKey(tab, row)
      if (key) next[key] = keysForRow(tab, row)
    }
    tab.selectedRows = next
  }

  function isAllSelected(tab) {
    const rows = (tab.queryResult?.rows || []).filter((row) => !isRowDeleted(tab, row))
    if (!rows.length) return false
    return rows.every((row) => isRowSelected(tab, row))
  }

  function deleteSelectedRows(tab) {
    ensureTableState(tab)
    const selected = Object.entries(tab.selectedRows)
    if (!selected.length) {
      api.showMessage(t('请先选择要删除的行'), 'warning')
      return
    }
    for (const [key, keys] of selected) {
      tab.rowDeletes[key] = keys
      delete tab.selectedRows[key]
    }
  }

  function deleteRow(tab, row) {
    ensureTableState(tab)
    const key = rowKey(tab, row)
    if (!key) return
    tab.rowDeletes[key] = keysForRow(tab, row)
    delete tab.selectedRows[key]
  }

  function restoreDeletedRow(tab, row) {
    const key = rowKey(tab, row)
    if (key) delete tab.rowDeletes[key]
  }

  async function discardTableChanges(tab) {
    ensureTableState(tab)
    if (!hasPendingChanges(tab)) return
    if (!(await api.showConfirm(t('确定撤销所有未提交的修改吗？')))) return
    tab.rowEdits = {}
    tab.rowDeletes = {}
    tab.rowInserts = []
    tab.selectedRows = {}
  }

  function addRow(tab) {
    ensureTableState(tab)
    if (!canEditTable(tab)) {
      api.showMessage(t('视图或没有主键的表不支持直接编辑'), 'warning')
      return
    }
    const values = {}
    for (const column of tab.columns) {
      if (!column.autoIncrement) values[column.name] = ''
    }
    tab.rowInserts.push({ values })
  }

  function setNewRowValue(tab, index, field, raw) {
    const draft = tab.rowInserts[index]
    if (!draft) return
    const column = tab.columns.find((item) => item.name === field)
    draft.values[field] = coerceValue(column, raw) ?? ''
  }

  function removeNewRow(tab, index) {
    tab.rowInserts.splice(index, 1)
  }

  function buildPendingSqlForTab(tab) {
    ensureTableState(tab)
    return buildPendingSql({
      database: tab.database,
      tableName: tab.tableName,
      rowEdits: tab.rowEdits,
      rowDeletes: tab.rowDeletes,
      rowInserts: tab.rowInserts
    })
  }

  function previewChanges(tab) {
    const sql = buildPendingSqlForTab(tab)
    if (!sql) {
      api.showMessage(t('没有待保存的修改'), 'info')
      return
    }
    sqlPreviewDialog.value = {
      show: true,
      title: t('待执行的 SQL'),
      sql
    }
  }

  async function saveTableChanges(tab) {
    ensureTableState(tab)
    if (!hasPendingChanges(tab)) {
      api.showMessage(t('没有待保存的修改'), 'info')
      return
    }

    tab.executing = true
    try {
      // 传纯对象，响应式代理无法通过 Electron IPC 的结构化克隆
      const updates = Object.values(tab.rowEdits)
        .filter((entry) => Object.keys(entry.values || {}).length > 0)
        .map((entry) => ({ keys: { ...entry.keys }, values: { ...entry.values } }))
      const deletes = Object.values(tab.rowDeletes).map((keys) => ({ ...keys }))
      const inserts = tab.rowInserts.map((draft) => {
        const values = {}
        for (const [field, raw] of Object.entries(draft.values || {})) {
          const column = tab.columns.find((item) => item.name === field)
          if (column?.autoIncrement && (raw === '' || raw === null)) continue
          values[field] = coerceValue(column, raw)
        }
        return values
      })

      const result = await dbApplyTableChanges(tab.connectionName, tab.database, tab.tableName, {
        updates,
        deletes,
        inserts
      })

      if (!result.success) {
        await api.showMessage(t('保存失败: ') + result.error, 'error')
        return
      }

      await api.showMessage(
        t('保存成功（更新 {p0}，删除 {p1}，新增 {p2}）', {
          p0: result.updated || 0,
          p1: result.deleted || 0,
          p2: result.inserted || 0
        }),
        'success'
      )
      await executeTableQuery(tab, tab.queryResult?.currentPage || 1)
      await api.loadDatabaseObjects(tab.connectionName, tab.database, { force: true })
    } catch (error) {
      console.error('保存表数据失败:', error)
      await api.showMessage(t('保存表数据失败: ') + error.message, 'error')
    } finally {
      tab.executing = false
    }
  }

  function isComparisonColumn(column) {
    const type = String(column?.dataType || column?.columnType || '').toLowerCase()
    return /int|decimal|numeric|float|double|real|year|bit|date|time/.test(type)
  }

  function defaultFilterOperator(column) {
    return isComparisonColumn(column) ? '=' : 'LIKE'
  }

  function addTableFilter(tab) {
    ensureTableState(tab)
    const column = tab.columns[0]
    tab.filters.push({
      field: column?.name || '',
      operator: defaultFilterOperator(column),
      value: '',
      connector: 'AND'
    })
  }

  function removeTableFilter(tab, index) {
    tab.filters.splice(index, 1)
  }

  async function applyTableFilters(tab) {
    ensureTableState(tab)
    for (const filter of tab.filters) {
      if (!filter.field) {
        await api.showMessage(t('请选择筛选字段'), 'warning')
        return
      }
      if (!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && filter.value === '') {
        await api.showMessage(t('请填写筛选值'), 'warning')
        return
      }
    }
    if (!(await confirmDiscardPending(tab))) return
    await executeTableQuery(tab, 1)
  }

  async function searchTableData(tab) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    await executeTableQuery(tab, 1)
  }

  async function resetTableFilters(tab) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    tab.filters = []
    tab.searchKeyword = ''
    tab.sorts = []
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function applyTableSort(tab, field, direction) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    tab.sorts = field ? [{ field, order: direction || 'ASC' }] : []
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function setTableSort(tab, field, append = false) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    const existing = tab.sorts.find((item) => item.field === field)
    if (append) {
      if (!existing) {
        tab.sorts.push({ field, order: 'ASC' })
      } else if (existing.order === 'ASC') {
        existing.order = 'DESC'
      } else {
        tab.sorts = tab.sorts.filter((item) => item !== existing)
      }
    } else if (tab.sorts.length && tab.sorts[0].field === field) {
      if (tab.sorts[0].order === 'ASC') {
        tab.sorts[0].order = 'DESC'
      } else {
        tab.sorts = []
      }
    } else {
      tab.sorts = [{ field, order: 'ASC' }]
    }
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function addTableSort(tab, field) {
    ensureTableState(tab)
    if (!field || tab.sorts.some((item) => item.field === field)) return
    if (!(await confirmDiscardPending(tab))) return
    tab.sorts.push({ field, order: 'ASC' })
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function appendTableSort(tab, field, order = 'ASC') {
    ensureTableState(tab)
    if (!field) return
    if (!(await confirmDiscardPending(tab))) return
    const existing = tab.sorts.find((item) => item.field === field)
    if (existing) {
      existing.order = order === 'DESC' ? 'DESC' : 'ASC'
    } else {
      tab.sorts.push({ field, order: order === 'DESC' ? 'DESC' : 'ASC' })
    }
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function clearTableSort(tab) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    tab.sorts = []
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function changeTableSortOrder(tab, field, order) {
    ensureTableState(tab)
    const entry = tab.sorts.find((item) => item.field === field)
    if (!entry) return
    if (!(await confirmDiscardPending(tab))) return
    entry.order = order === 'DESC' ? 'DESC' : 'ASC'
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function changeTableSortField(tab, index, field) {
    ensureTableState(tab)
    const entry = tab.sorts[index]
    if (!entry || !field || entry.field === field) return
    if (tab.sorts.some((item, itemIndex) => itemIndex !== index && item.field === field)) return
    if (!(await confirmDiscardPending(tab))) return
    entry.field = field
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  async function removeTableSort(tab, field) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    tab.sorts = tab.sorts.filter((item) => item.field !== field)
    syncSortState(tab)
    await executeTableQuery(tab, 1)
  }

  function toggleColumnVisibility(tab, field) {
    ensureTableState(tab)
    const hidden = new Set(tab.hiddenFields)
    if (hidden.has(field)) hidden.delete(field)
    else hidden.add(field)
    tab.hiddenFields = [...hidden]
    const visibleCount = (tab.fieldOrder || []).filter((name) => !hidden.has(name)).length
    if (tab.frozenCount > visibleCount) tab.frozenCount = visibleCount
    saveTableViewConfig(tab)
  }

  function setColumnWidth(tab, field, width) {
    ensureTableState(tab)
    const value = Math.min(720, Math.max(60, Math.round(Number(width) || 0)))
    tab.fieldWidths = { ...tab.fieldWidths, [field]: value }
    saveTableViewConfig(tab)
  }

  function resetColumnWidths(tab) {
    ensureTableState(tab)
    tab.fieldWidths = {}
    saveTableViewConfig(tab)
  }

  function showAllColumns(tab) {
    ensureTableState(tab)
    tab.hiddenFields = []
    saveTableViewConfig(tab)
  }

  function setFrozenColumnCount(tab, count) {
    ensureTableState(tab)
    tab.frozenCount = Math.min(20, Math.max(0, Number(count) || 0))
    saveTableViewConfig(tab)
  }

  function openCellFilterMenu(event, tab, fieldName, value) {
    cellFilterMenu.value = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      tab,
      fieldName,
      value
    }
  }

  function hideCellFilterMenu() {
    cellFilterMenu.value.show = false
  }

  async function applyCellFilter(operator) {
    const { tab, fieldName, value } = cellFilterMenu.value
    hideCellFilterMenu()
    if (!tab || !fieldName) return
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    const raw = value === null || value === undefined ? '' : String(value)
    const filterValue = operator === 'LIKE' ? `%${raw}%` : raw
    tab.filters = [
      ...tab.filters.filter((filter) => filter.field !== fieldName),
      { connector: 'AND', field: fieldName, operator, value: filterValue }
    ]
    await executeTableQuery(tab, 1)
  }

  async function setTablePageSize(tab, size) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    const value = Math.min(500, Math.max(1, Number(size) || 100))
    tab.pageSize = value
    await executeTableQuery(tab, 1)
  }

  let draggedFieldName = null

  function onFieldDragStart(event, tab, fieldName) {
    draggedFieldName = fieldName
    event.dataTransfer.effectAllowed = 'move'
  }

  function onFieldDragOver(event) {
    event.dataTransfer.dropEffect = 'move'
  }

  function onFieldDrop(event, tab, fieldName) {
    if (!draggedFieldName || draggedFieldName === fieldName) return

    const fieldOrder = tab.fieldOrder || tab.queryResult.fields.map((field) => field.name)
    const draggedIndex = fieldOrder.indexOf(draggedFieldName)
    const targetIndex = fieldOrder.indexOf(fieldName)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newOrder = [...fieldOrder]
      newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedFieldName)
      tab.fieldOrder = newOrder
    }

    draggedFieldName = null
  }

  async function deleteTable(target) {
    if (!target.connection || !target.database || !target.table) return

    const confirmed = await api.showConfirm(t('确定要删除表 "{p0}" 吗？此操作不可恢复！', { p0: target.table }))
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `DROP TABLE \`${target.database}\`.\`${target.table}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.loadDatabaseObjects(target.connection.name, target.database, { force: true })
      await api.showMessage(t('表 "{p0}" 已删除', { p0: target.table }), 'success')
    } else {
      await api.showMessage(t('删除表失败: ') + result.error, 'error')
    }
  }

  async function emptyTable(target) {
    if (!target.connection || !target.database || !target.table) return

    const confirmed = await api.showConfirm(
      t('确定要清空表 "{p0}" 的所有数据吗？此操作不可恢复！', { p0: target.table })
    )
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `DELETE FROM \`${target.database}\`.\`${target.table}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.showMessage(t('表 "{p0}" 已清空', { p0: target.table }), 'success')
    } else {
      await api.showMessage(t('清空表失败: ') + result.error, 'error')
    }
  }

  async function truncateTable(target) {
    if (!target.connection || !target.database || !target.table) return

    const confirmed = await api.showConfirm(
      t('确定要截断表 "{p0}" 吗？此操作将删除所有数据并重置自增ID，不可恢复！', { p0: target.table })
    )
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `TRUNCATE TABLE \`${target.database}\`.\`${target.table}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.showMessage(t('表 "{p0}" 已截断', { p0: target.table }), 'success')
    } else {
      await api.showMessage(t('截断表失败: ') + result.error, 'error')
    }
  }

  async function copyTable(target, type) {
    if (!target.connection || !target.database || !target.table) return

    const newTableName = `${target.table}_copy`

    api.selectConnection(target.connection)

    if (type === 'structure') {
      const result = await api.executeSqlDirect(
        `CREATE TABLE \`${target.database}\`.\`${newTableName}\` LIKE \`${target.database}\`.\`${target.table}\`;`,
        target.connection.name
      )

      if (result.success) {
        await api.loadDatabaseObjects(target.connection.name, target.database, { force: true })
        await api.showMessage(t('表结构已复制到 "{p0}"', { p0: newTableName }), 'success')
      } else {
        await api.showMessage(t('复制表结构失败: ') + result.error, 'error')
      }
    } else {
      const createResult = await api.executeSqlDirect(
        `CREATE TABLE \`${target.database}\`.\`${newTableName}\` LIKE \`${target.database}\`.\`${target.table}\`;`,
        target.connection.name
      )

      if (!createResult.success) {
        await api.showMessage(t('复制表结构失败: ') + createResult.error, 'error')
        return
      }

      const insertResult = await api.executeSqlDirect(
        `INSERT INTO \`${target.database}\`.\`${newTableName}\` SELECT * FROM \`${target.database}\`.\`${target.table}\`;`,
        target.connection.name
      )

      if (insertResult.success) {
        await api.loadDatabaseObjects(target.connection.name, target.database, { force: true })
        await api.showMessage(t('表已复制到 "{p0}"（包含数据）', { p0: newTableName }), 'success')
      } else {
        await api.showMessage(t('复制表数据失败: ') + insertResult.error, 'error')
      }
    }
  }

  async function dumpTable(target, type) {
    if (!target.connection || !target.database || !target.table) return

    try {
      api.selectConnection(target.connection)

      if (!target.connection.active) {
        await api.connectToDatabase()
      }

      const header = [
        t('-- 表转储: {p0}', { p0: target.table }),
        t('-- 数据库: {p0}', { p0: target.database }),
        t('-- 生成时间: {p0}', { p0: new Date().toISOString() }),
        t('-- 连接: {p0}:{p1}', { p0: target.connection.host, p1: target.connection.port }),
        '',
        `USE \`${target.database}\`;`,
        ''
      ].join('\n')

      let body = ''
      if (type === 'structure') {
        const meta = await dbGetTableMeta(target.connection.name, target.database, target.table)
        if (!meta.success) {
          await api.showMessage(t('获取表结构失败: ') + meta.error, 'error')
          return
        }
        body = `DROP TABLE IF EXISTS \`${target.table}\`;\n${meta.ddl};\n`
      } else {
        const result = await dbExportTable(target.connection.name, target.database, target.table, {
          format: 'sql',
          includeStructure: true,
          maxRows: 1000000
        })
        if (!result.success) {
          await api.showMessage(t('转储表失败: ') + result.error, 'error')
          return
        }
        body = result.content
        if (result.truncated) {
          body += '\n' + t('-- 提示: 数据量超过导出上限，已截断') + '\n'
        }
      }

      const defaultFileName = `${target.table}_${type}_${Date.now()}.sql`
      const saveResult = await saveSqlFile(defaultFileName)
      if (saveResult.canceled || !saveResult.filePath) return

      const writeResult = await writeFile(saveResult.filePath, `${header}${body}\n`)
      if (writeResult.success) {
        await api.showMessage(t('转储文件已保存到: {p0}', { p0: saveResult.filePath }), 'success')
      } else {
        await api.showMessage(t('保存文件失败: ') + writeResult.error, 'error')
      }
    } catch (error) {
      console.error('转储表失败:', error)
      await api.showMessage(t('转储表失败: ') + error.message, 'error')
    }
  }

  async function renameTable(target) {
    if (!target.connection || !target.database || !target.table) return

    const newTableName = await api.showPrompt('请输入新的表名：', target.table)
    if (!newTableName || newTableName === target.table) return

    const confirmed = await api.showConfirm(
      t('确定要将表 "{p0}" 重命名为 "{p1}" 吗？', { p0: target.table, p1: newTableName })
    )
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `RENAME TABLE \`${target.database}\`.\`${target.table}\` TO \`${target.database}\`.\`${newTableName}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.loadDatabaseObjects(target.connection.name, target.database, { force: true })
      await api.showMessage(t('表已重命名为 "{p0}"', { p0: newTableName }), 'success')
    } else {
      await api.showMessage(t('重命名表失败: ') + result.error, 'error')
    }
  }

  async function refreshTable(target) {
    if (!target.connection || !target.database) return

    api.selectConnection(target.connection)
    await api.loadDatabaseObjects(target.connection.name, target.database, { force: true })
    await api.showMessage(t('表列表已刷新'), 'success')
  }

  async function duplicateRow(tab, row) {
    ensureTableState(tab)
    if (!canEditTable(tab)) {
      api.showMessage(t('视图或没有主键的表不支持直接编辑'), 'warning')
      return
    }
    const [source] = await resolveLazyRowValues(tab, [row])
    const values = {}
    for (const column of tab.columns) {
      if (column.autoIncrement) continue
      values[column.name] = source[column.name] ?? ''
    }
    tab.rowInserts.push({ values })
    api.showMessage(t('已复制为新行，请修改后提交'), 'success')
  }

  function buildInsertSqlForRows(tab, rows) {
    if (!rows?.length) return ''
    const tableRef = `${quoteIdentifier(tab.database)}.${quoteIdentifier(tab.tableName)}`
    const fields = tab.fieldOrder?.length ? tab.fieldOrder : (tab.queryResult?.fields || []).map((field) => field.name)
    if (!fields.length) return ''

    return rows
      .map((row) => {
        const values = fields.map((field) => escapeSqlValue(getCellValue(tab, row, field)))
        return `INSERT INTO ${tableRef} (${fields.map((field) => quoteIdentifier(field)).join(', ')}) VALUES (${values.join(
          ', '
        )});`
      })
      .join('\n')
  }

  async function copyRowsAsInsert(tab) {
    ensureTableState(tab)
    const rows = (tab.queryResult?.rows || []).filter((row) => isRowSelected(tab, row) && !isRowDeleted(tab, row))
    if (!rows.length) {
      await api.showMessage(t('请先勾选要复制的行'), 'warning')
      return
    }
    const sql = buildInsertSqlForRows(tab, await resolveLazyRowValues(tab, rows))
    if (!sql) return
    const copied = await copyToClipboard(sql)
    await api.showMessage(
      copied ? t('已复制 {p0} 行 INSERT 语句', { p0: rows.length }) : t('复制失败'),
      copied ? 'success' : 'error'
    )
  }

  async function copyRowAsInsert(tab, row) {
    const [resolved] = await resolveLazyRowValues(tab, [row])
    const sql = buildInsertSqlForRows(tab, [resolved])
    if (!sql) return
    const copied = await copyToClipboard(sql)
    await api.showMessage(copied ? t('已复制该行 INSERT 语句') : t('复制失败'), copied ? 'success' : 'error')
  }

  return {
    openTable,
    executeTableQuery,
    hasPendingChanges,
    getPendingCounts,
    canEditTable,
    confirmDiscardPending,
    rowKey,
    keysForRow,
    isRowDeleted,
    isRowUpdated,
    isRowSelected,
    getCellValue,
    fetchTableCellValue,
    isLazyCell,
    updateCell,
    toggleRowSelection,
    toggleAllRows,
    isAllSelected,
    deleteSelectedRows,
    deleteRow,
    restoreDeletedRow,
    discardTableChanges,
    addRow,
    setNewRowValue,
    removeNewRow,
    duplicateRow,
    buildInsertSqlForRows,
    copyRowsAsInsert,
    copyRowAsInsert,
    buildPendingSql: buildPendingSqlForTab,
    previewChanges,
    saveTableChanges,
    addTableFilter,
    removeTableFilter,
    applyTableFilters,
    searchTableData,
    resetTableFilters,
    defaultFilterOperator,
    isComparisonColumn,
    setTableSort,
    applyTableSort,
    addTableSort,
    appendTableSort,
    clearTableSort,
    changeTableSortOrder,
    changeTableSortField,
    removeTableSort,
    toggleColumnVisibility,
    setColumnWidth,
    resetColumnWidths,
    showAllColumns,
    setFrozenColumnCount,
    openCellFilterMenu,
    hideCellFilterMenu,
    applyCellFilter,
    setTablePageSize,
    onFieldDragStart,
    onFieldDragOver,
    onFieldDrop,
    deleteTable,
    emptyTable,
    truncateTable,
    copyTable,
    dumpTable,
    renameTable,
    refreshTable
  }
}
