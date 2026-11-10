import { dbApplyTableChanges, dbExportTable, dbGetTableData, dbGetTableMeta, saveSqlFile, writeFile } from '@/api'

export function createTableOps(state, api) {
  const { selectedDatabase, sqlPreviewDialog } = state

  function ensureTableState(tab) {
    if (!tab.filters) tab.filters = []
    if (!tab.filterLogic) tab.filterLogic = 'AND'
    if (tab.searchKeyword === undefined) tab.searchKeyword = ''
    if (!tab.pageSize) tab.pageSize = 100
    if (tab.sortField === undefined) tab.sortField = null
    if (tab.sortDirection === undefined) tab.sortDirection = null
    if (!tab.rowEdits) tab.rowEdits = {}
    if (!tab.rowDeletes) tab.rowDeletes = {}
    if (!tab.rowInserts) tab.rowInserts = []
    if (!tab.selectedRows) tab.selectedRows = {}
    if (!tab.columns) tab.columns = []
    if (!tab.primaryKeys) tab.primaryKeys = []
    if (!tab.fieldOrder) tab.fieldOrder = []
    if (tab.isView === undefined) tab.isView = false
  }

  async function openTable(target) {
    if (!target.connection || !target.database || !target.table) return

    api.selectConnection(target.connection)
    selectedDatabase.value = target.database

    if (!target.connection.active) {
      await api.connectToDatabase()
    }

    const tab = api.createTableTab(target.connection.name, target.database, target.table)
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

      const result = await dbGetTableData(tab.connectionName, tab.database, tab.tableName, {
        page: requestedPage,
        pageSize: tab.pageSize,
        filters,
        logic: tab.filterLogic,
        search: tab.searchKeyword,
        sort: tab.sortField ? { field: tab.sortField, order: tab.sortDirection || 'ASC' } : null
      })

      if (!result.success) {
        tab.queryResult = { success: false, error: result.error }
        return
      }

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
    return Boolean(await api.showConfirm('此操作会丢弃未保存的修改，是否继续？'))
  }

  function rowKey(tab, row) {
    const primaryKeys = tab.primaryKeys || []
    if (!primaryKeys.length) return null
    return JSON.stringify(primaryKeys.map((key) => (row[key] === undefined ? null : row[key])))
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

  function coerceValue(column, raw) {
    if (raw === null || raw === undefined || raw === '') return null
    const type = String(column?.dataType || '').toLowerCase()
    if (
      [
        'tinyint',
        'smallint',
        'mediumint',
        'int',
        'integer',
        'bigint',
        'decimal',
        'numeric',
        'float',
        'double',
        'real',
        'year'
      ].includes(type)
    ) {
      const number = Number(raw)
      return Number.isNaN(number) ? raw : number
    }
    return raw
  }

  function isSameValue(left, right) {
    if (left === null || left === undefined) return right === null || right === undefined
    if (right === null || right === undefined) return false
    return String(left) === String(right)
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
      api.showMessage('请先选择要删除的行', 'warning')
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

  function addRow(tab) {
    ensureTableState(tab)
    if (!canEditTable(tab)) {
      api.showMessage('视图或没有主键的表不支持直接编辑', 'warning')
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

  function escapeSqlValue(value) {
    if (value === null || value === undefined) return 'NULL'
    if (typeof value === 'number' || typeof value === 'bigint') return String(value)
    return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
  }

  function quoteIdentifier(name) {
    return `\`${String(name).replace(/`/g, '``')}\``
  }

  function buildPendingSql(tab) {
    ensureTableState(tab)
    const tableRef = `${quoteIdentifier(tab.database)}.${quoteIdentifier(tab.tableName)}`
    const lines = []

    for (const entry of Object.values(tab.rowEdits)) {
      const fields = Object.entries(entry.values)
      if (!fields.length) continue
      const setSql = fields.map(([field, value]) => `${quoteIdentifier(field)} = ${escapeSqlValue(value)}`).join(', ')
      const whereSql = Object.entries(entry.keys)
        .map(([field, value]) => `${quoteIdentifier(field)} <=> ${escapeSqlValue(value)}`)
        .join(' AND ')
      lines.push(`UPDATE ${tableRef} SET ${setSql} WHERE ${whereSql};`)
    }

    for (const keys of Object.values(tab.rowDeletes)) {
      const whereSql = Object.entries(keys)
        .map(([field, value]) => `${quoteIdentifier(field)} <=> ${escapeSqlValue(value)}`)
        .join(' AND ')
      lines.push(`DELETE FROM ${tableRef} WHERE ${whereSql};`)
    }

    for (const draft of tab.rowInserts) {
      const fields = Object.entries(draft.values || {}).filter(([, value]) => value !== '' && value !== undefined)
      if (!fields.length) {
        lines.push(`INSERT INTO ${tableRef} () VALUES ();`)
        continue
      }
      lines.push(
        `INSERT INTO ${tableRef} (${fields.map(([field]) => quoteIdentifier(field)).join(', ')}) VALUES (${fields
          .map(([, value]) => escapeSqlValue(value))
          .join(', ')});`
      )
    }

    return lines.join('\n')
  }

  function previewChanges(tab) {
    const sql = buildPendingSql(tab)
    if (!sql) {
      api.showMessage('没有待保存的修改', 'info')
      return
    }
    sqlPreviewDialog.value = {
      show: true,
      title: '待执行的 SQL',
      sql
    }
  }

  async function saveTableChanges(tab) {
    ensureTableState(tab)
    if (!hasPendingChanges(tab)) {
      api.showMessage('没有待保存的修改', 'info')
      return
    }

    tab.executing = true
    try {
      const updates = Object.values(tab.rowEdits).filter((entry) => Object.keys(entry.values || {}).length > 0)
      const deletes = Object.values(tab.rowDeletes)
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
        await api.showMessage('保存失败: ' + result.error, 'error')
        return
      }

      await api.showMessage(
        `保存成功（更新 ${result.updated || 0}，删除 ${result.deleted || 0}，新增 ${result.inserted || 0}）`,
        'success'
      )
      await executeTableQuery(tab, tab.queryResult?.currentPage || 1)
      await api.loadDatabaseObjects(tab.connectionName, tab.database)
    } catch (error) {
      console.error('保存表数据失败:', error)
      await api.showMessage('保存表数据失败: ' + error.message, 'error')
    } finally {
      tab.executing = false
    }
  }

  function addTableFilter(tab) {
    ensureTableState(tab)
    tab.filters.push({
      field: tab.columns[0]?.name || '',
      operator: 'LIKE',
      value: ''
    })
  }

  function removeTableFilter(tab, index) {
    tab.filters.splice(index, 1)
  }

  async function applyTableFilters(tab) {
    ensureTableState(tab)
    for (const filter of tab.filters) {
      if (!filter.field) {
        await api.showMessage('请选择筛选字段', 'warning')
        return
      }
      if (!['IS NULL', 'IS NOT NULL'].includes(filter.operator) && filter.value === '') {
        await api.showMessage('请填写筛选值', 'warning')
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
    tab.filterLogic = 'AND'
    tab.sortField = null
    tab.sortDirection = null
    await executeTableQuery(tab, 1)
  }

  async function setTableSort(tab, field) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    if (tab.sortField !== field) {
      tab.sortField = field
      tab.sortDirection = 'ASC'
    } else if (tab.sortDirection === 'ASC') {
      tab.sortDirection = 'DESC'
    } else {
      tab.sortField = null
      tab.sortDirection = null
    }
    await executeTableQuery(tab, 1)
  }

  async function setTablePageSize(tab, size) {
    ensureTableState(tab)
    if (!(await confirmDiscardPending(tab))) return
    const value = Math.max(1, Number(size) || 100)
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

    const confirmed = await api.showConfirm(`确定要删除表 "${target.table}" 吗？此操作不可恢复！`)
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `DROP TABLE \`${target.database}\`.\`${target.table}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.loadDatabaseObjects(target.connection.name, target.database)
      await api.showMessage(`表 "${target.table}" 已删除`, 'success')
    } else {
      await api.showMessage('删除表失败: ' + result.error, 'error')
    }
  }

  async function emptyTable(target) {
    if (!target.connection || !target.database || !target.table) return

    const confirmed = await api.showConfirm(`确定要清空表 "${target.table}" 的所有数据吗？此操作不可恢复！`)
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `DELETE FROM \`${target.database}\`.\`${target.table}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.showMessage(`表 "${target.table}" 已清空`, 'success')
    } else {
      await api.showMessage('清空表失败: ' + result.error, 'error')
    }
  }

  async function truncateTable(target) {
    if (!target.connection || !target.database || !target.table) return

    const confirmed = await api.showConfirm(
      `确定要截断表 "${target.table}" 吗？此操作将删除所有数据并重置自增ID，不可恢复！`
    )
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `TRUNCATE TABLE \`${target.database}\`.\`${target.table}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.showMessage(`表 "${target.table}" 已截断`, 'success')
    } else {
      await api.showMessage('截断表失败: ' + result.error, 'error')
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
        await api.loadDatabaseObjects(target.connection.name, target.database)
        await api.showMessage(`表结构已复制到 "${newTableName}"`, 'success')
      } else {
        await api.showMessage('复制表结构失败: ' + result.error, 'error')
      }
    } else {
      const createResult = await api.executeSqlDirect(
        `CREATE TABLE \`${target.database}\`.\`${newTableName}\` LIKE \`${target.database}\`.\`${target.table}\`;`,
        target.connection.name
      )

      if (!createResult.success) {
        await api.showMessage('复制表结构失败: ' + createResult.error, 'error')
        return
      }

      const insertResult = await api.executeSqlDirect(
        `INSERT INTO \`${target.database}\`.\`${newTableName}\` SELECT * FROM \`${target.database}\`.\`${target.table}\`;`,
        target.connection.name
      )

      if (insertResult.success) {
        await api.loadDatabaseObjects(target.connection.name, target.database)
        await api.showMessage(`表已复制到 "${newTableName}"（包含数据）`, 'success')
      } else {
        await api.showMessage('复制表数据失败: ' + insertResult.error, 'error')
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
        `-- 表转储: ${target.table}`,
        `-- 数据库: ${target.database}`,
        `-- 生成时间: ${new Date().toISOString()}`,
        `-- 连接: ${target.connection.host}:${target.connection.port}`,
        '',
        `USE \`${target.database}\`;`,
        ''
      ].join('\n')

      let body = ''
      if (type === 'structure') {
        const meta = await dbGetTableMeta(target.connection.name, target.database, target.table)
        if (!meta.success) {
          await api.showMessage('获取表结构失败: ' + meta.error, 'error')
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
          await api.showMessage('转储表失败: ' + result.error, 'error')
          return
        }
        body = result.content
        if (result.truncated) {
          body += '\n-- 提示: 数据量超过导出上限，已截断\n'
        }
      }

      const defaultFileName = `${target.table}_${type}_${Date.now()}.sql`
      const saveResult = await saveSqlFile(defaultFileName)
      if (saveResult.canceled || !saveResult.filePath) return

      const writeResult = await writeFile(saveResult.filePath, `${header}${body}\n`)
      if (writeResult.success) {
        await api.showMessage(`转储文件已保存到: ${saveResult.filePath}`, 'success')
      } else {
        await api.showMessage('保存文件失败: ' + writeResult.error, 'error')
      }
    } catch (error) {
      console.error('转储表失败:', error)
      await api.showMessage('转储表失败: ' + error.message, 'error')
    }
  }

  async function renameTable(target) {
    if (!target.connection || !target.database || !target.table) return

    const newTableName = await api.showPrompt('请输入新的表名：', target.table)
    if (!newTableName || newTableName === target.table) return

    const confirmed = await api.showConfirm(`确定要将表 "${target.table}" 重命名为 "${newTableName}" 吗？`)
    if (!confirmed) return

    api.selectConnection(target.connection)

    const result = await api.executeSqlDirect(
      `RENAME TABLE \`${target.database}\`.\`${target.table}\` TO \`${target.database}\`.\`${newTableName}\`;`,
      target.connection.name
    )

    if (result.success) {
      await api.loadDatabaseObjects(target.connection.name, target.database)
      await api.showMessage(`表已重命名为 "${newTableName}"`, 'success')
    } else {
      await api.showMessage('重命名表失败: ' + result.error, 'error')
    }
  }

  async function refreshTable(target) {
    if (!target.connection || !target.database) return

    api.selectConnection(target.connection)
    await api.loadDatabaseObjects(target.connection.name, target.database)
    await api.showMessage('表列表已刷新', 'success')
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
    updateCell,
    toggleRowSelection,
    toggleAllRows,
    isAllSelected,
    deleteSelectedRows,
    deleteRow,
    restoreDeletedRow,
    addRow,
    setNewRowValue,
    removeNewRow,
    buildPendingSql,
    previewChanges,
    saveTableChanges,
    addTableFilter,
    removeTableFilter,
    applyTableFilters,
    searchTableData,
    resetTableFilters,
    setTableSort,
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
