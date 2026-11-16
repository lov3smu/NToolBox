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

  function hideMenus() {
    contextMenu.value.show = false
    tabContextMenu.value.show = false
    fieldSortMenu.value.show = false
    state.cellFilterMenu.value.show = false
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
    await api.applyTableSort(tab, fieldName, 'ASC')
  }

  async function sortFieldDesc() {
    const { tab, fieldName } = fieldSortMenu.value
    hideFieldSortMenu()
    if (!tab || !fieldName) return
    await api.applyTableSort(tab, fieldName, 'DESC')
  }

  async function appendFieldSortAsc() {
    const { tab, fieldName } = fieldSortMenu.value
    hideFieldSortMenu()
    if (!tab || !fieldName) return
    await api.appendTableSort(tab, fieldName, 'ASC')
  }

  async function appendFieldSortDesc() {
    const { tab, fieldName } = fieldSortMenu.value
    hideFieldSortMenu()
    if (!tab || !fieldName) return
    await api.appendTableSort(tab, fieldName, 'DESC')
  }

  async function clearFieldSort() {
    const tab = fieldSortMenu.value.tab
    hideFieldSortMenu()
    if (!tab) return
    await api.clearTableSort(tab)
  }

  async function toggleFieldSort(tab, fieldName, event) {
    await api.setTableSort(tab, fieldName, Boolean(event?.shiftKey))
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
    hideMenus,
    showTabContextMenu,
    hideTabContextMenu,
    showFieldSortMenu,
    hideFieldSortMenu,
    sortFieldAsc,
    sortFieldDesc,
    appendFieldSortAsc,
    appendFieldSortDesc,
    clearFieldSort,
    toggleFieldSort,
    toggleFilterSort,
    refreshTableData,
    importData,
    exportData
  }
}
