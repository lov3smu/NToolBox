export function createMenus(state, api) {
  const { contextMenu, fieldSortMenu, tabContextMenu, tableToolbarState } = state

  async function showContextMenu(e, type, target = null) {
    contextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      type,
      target
    }
  }

  function hideContextMenu() {
    contextMenu.value.show = false
  }

  function showTabContextMenu(e, tab) {
    tabContextMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      tab
    }
  }

  function hideTabContextMenu() {
    tabContextMenu.value.show = false
  }

  function showFieldSortMenu(e, tab, fieldName) {
    fieldSortMenu.value = {
      show: true,
      x: e.clientX,
      y: e.clientY,
      tab,
      fieldName
    }
  }

  function hideFieldSortMenu() {
    fieldSortMenu.value.show = false
  }

  async function sortFieldAsc() {
    const { tab, fieldName } = fieldSortMenu.value
    hideFieldSortMenu()
    if (!tab || !fieldName) return
    if (!(await api.confirmDiscardPending(tab))) return
    tab.sortField = fieldName
    tab.sortDirection = 'ASC'
    await api.executeTableQuery(tab, 1)
  }

  async function sortFieldDesc() {
    const { tab, fieldName } = fieldSortMenu.value
    hideFieldSortMenu()
    if (!tab || !fieldName) return
    if (!(await api.confirmDiscardPending(tab))) return
    tab.sortField = fieldName
    tab.sortDirection = 'DESC'
    await api.executeTableQuery(tab, 1)
  }

  async function clearFieldSort() {
    const tab = fieldSortMenu.value.tab
    hideFieldSortMenu()
    if (!tab) return
    if (!(await api.confirmDiscardPending(tab))) return
    tab.sortField = null
    tab.sortDirection = null
    await api.executeTableQuery(tab, 1)
  }

  async function toggleFieldSort(tab, fieldName) {
    await api.setTableSort(tab, fieldName)
  }

  function toggleFilterSort() {
    tableToolbarState.value.filterSortActive = !tableToolbarState.value.filterSortActive
  }

  async function refreshTableData(tab) {
    if (api.hasPendingChanges?.(tab)) {
      const confirmed = await api.showConfirm('刷新会丢弃未保存的修改，是否继续？')
      if (!confirmed) return
    }
    await api.executeTableQuery(tab, tab.queryResult?.currentPage || 1)
  }

  function importData(tab) {
    api.openImportDialog(tab)
  }

  function exportData(tab) {
    api.openExportDialog(tab)
  }

  return {
    showContextMenu,
    hideContextMenu,
    showTabContextMenu,
    hideTabContextMenu,
    showFieldSortMenu,
    hideFieldSortMenu,
    sortFieldAsc,
    sortFieldDesc,
    clearFieldSort,
    toggleFieldSort,
    toggleFilterSort,
    refreshTableData,
    importData,
    exportData
  }
}
