import { watch } from 'vue'

export function createLayout(state) {
  const { infoPanelWidth, layoutMode, isResizingInfoPanel, isResizingSidebar, limitSettingsDialog, sidebarWidth } =
    state

  function toggleLimitSettingsDialog(tab) {
    if (limitSettingsDialog.value.show && limitSettingsDialog.value.tabId === tab.id) {
      limitSettingsDialog.value.show = false
      limitSettingsDialog.value.tabId = null
    } else {
      limitSettingsDialog.value.show = true
      limitSettingsDialog.value.tabId = tab.id
    }
  }

  function getMainContentRect() {
    return document.querySelector('.main-content')?.getBoundingClientRect()
  }

  function startSidebarResize() {
    isResizingSidebar.value = true
    document.addEventListener('mousemove', handleSidebarResize)
    document.addEventListener('mouseup', stopSidebarResize)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  function handleSidebarResize(e) {
    if (!isResizingSidebar.value) return
    const rect = getMainContentRect()
    if (!rect) return
    const maxWidth = Math.min(520, Math.max(180, rect.width - 420))
    const newWidth = Math.min(Math.max(180, e.clientX - rect.left), maxWidth)
    sidebarWidth.value = Math.round(newWidth)
    localStorage.setItem('databaseSidebarWidth', sidebarWidth.value.toString())
  }

  function stopSidebarResize() {
    isResizingSidebar.value = false
    document.removeEventListener('mousemove', handleSidebarResize)
    document.removeEventListener('mouseup', stopSidebarResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  function startInfoPanelResize() {
    isResizingInfoPanel.value = true
    document.addEventListener('mousemove', handleInfoPanelResize)
    document.addEventListener('mouseup', stopInfoPanelResize)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  function handleInfoPanelResize(e) {
    if (!isResizingInfoPanel.value) return
    const rect = getMainContentRect()
    if (!rect) return
    const maxWidth = Math.min(600, Math.max(200, rect.width - sidebarWidth.value - 420))
    const newWidth = Math.min(Math.max(200, rect.right - e.clientX), maxWidth)
    infoPanelWidth.value = Math.round(newWidth)
    localStorage.setItem('databaseInfoPanelWidth', infoPanelWidth.value.toString())
  }

  function stopInfoPanelResize() {
    isResizingInfoPanel.value = false
    document.removeEventListener('mousemove', handleInfoPanelResize)
    document.removeEventListener('mouseup', stopInfoPanelResize)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }

  watch(layoutMode, (newMode) => {
    localStorage.setItem('databaseLayoutMode', newMode)
  })

  return {
    startSidebarResize,
    handleSidebarResize,
    stopSidebarResize,
    startInfoPanelResize,
    handleInfoPanelResize,
    stopInfoPanelResize,
    toggleLimitSettingsDialog
  }
}
