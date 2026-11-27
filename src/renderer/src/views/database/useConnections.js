import { t } from '@/i18n'
import { dbGetActiveConnections, getConfig, patchConfig } from '@/api'
import {
  createDefaultConnection,
  generateConnectionName,
  normalizeConnectionRecord,
  toPlainRecord
} from './connectionDefaults'
import { logError } from '@/utils/log'

export function createConnections(state, api) {
  const {
    connections,
    createDialogStep,
    editDialogStep,
    editingConnection,
    expandedGroups,
    groups,
    newConnection,
    selectedConnection,
    showCreateDialog,
    showEditDialog
  } = state

  async function loadConnections() {
    try {
      const config = await getConfig()
      const savedConnections = config.database?.connections || []
      const savedGroups = config.database?.connection_groups || []
      const activeConnections = await dbGetActiveConnections()

      connections.value = savedConnections.map((conn) => ({
        ...normalizeConnectionRecord(conn),
        active: activeConnections.includes(conn.name)
      }))
      groups.value = savedGroups

      if (expandedGroups.value.length === 0 && savedGroups.length > 0) {
        expandedGroups.value = [...savedGroups]
      }

      for (const conn of connections.value) {
        if (conn.autoConnect && !conn.active) {
          selectedConnection.value = conn
          await api.connectToDatabase()
        }
      }
    } catch (error) {
      logError('加载连接配置失败:', error)
    }
  }

  function toggleGroup(name) {
    const index = expandedGroups.value.indexOf(name)
    if (index >= 0) {
      expandedGroups.value.splice(index, 1)
    } else {
      expandedGroups.value.push(name)
    }
  }

  async function saveConnection(connectAfterSave = false) {
    const connection = toPlainRecord(newConnection.value)

    if (!connection.savePassword) {
      connection.password = ''
    }
    if (connection.engine !== 'mysql') {
      connection.charset = ''
    }

    try {
      const config = await getConfig()
      const dbConnections = config.database?.connections || []

      if (!String(connection.name || '').trim()) {
        connection.name = generateConnectionName(
          connection,
          dbConnections.map((c) => c.name)
        )
      } else {
        connection.name = connection.name.trim()
        if (dbConnections.some((c) => c.name === connection.name)) {
          await api.showMessage(t('连接名称已存在'), 'error')
          return
        }
      }

      dbConnections.push(connection)
      const persisted = await patchConfig({ database: { connections: dbConnections } })
      if (!persisted) {
        await api.showMessage(t('保存连接失败'), 'error')
        return
      }

      showCreateDialog.value = false
      resetNewConnection()
      await loadConnections()

      if (!connectAfterSave) return
      const saved = connections.value.find((c) => c.name === connection.name)
      if (!saved) return
      selectedConnection.value = saved
      await api.connectToDatabase()
      if (saved.active) await api.showMessage(t('连接成功！'), 'success')
    } catch (error) {
      logError('保存连接失败:', error)
      await api.showMessage(t('保存连接失败: ') + error.message, 'error')
    }
  }

  function resetNewConnection() {
    newConnection.value = createDefaultConnection()
    createDialogStep.value = 'type'
    createDialogBaseline = ''
  }

  let createDialogBaseline = ''
  let editDialogBaseline = ''
  let editingOriginalName = ''
  let closingConnectionDialog = false

  async function confirmDiscard(baseline, current) {
    if (!baseline || JSON.stringify(current) === baseline) return true
    if (closingConnectionDialog) return false
    closingConnectionDialog = true
    const confirmed = await api.showConfirm(t('此操作会丢弃未保存的修改，是否继续？'))
    closingConnectionDialog = false
    return confirmed
  }

  async function closeCreateDialog() {
    if (!(await confirmDiscard(createDialogBaseline, newConnection.value))) return
    showCreateDialog.value = false
    resetNewConnection()
  }

  function editConnection(conn) {
    editingConnection.value = normalizeConnectionRecord(conn)
    editingOriginalName = conn.name
    editDialogStep.value = 'form'
    editDialogBaseline = JSON.stringify(editingConnection.value)
    showEditDialog.value = true
  }

  async function closeEditDialog() {
    if (!(await confirmDiscard(editDialogBaseline, editingConnection.value))) return
    showEditDialog.value = false
    editingConnection.value = null
    editDialogBaseline = ''
    editingOriginalName = ''
  }

  async function updateConnection() {
    const name = String(editingConnection.value?.name || '').trim()
    if (!name) {
      await api.showMessage(t('请输入连接名称'), 'warning')
      return
    }

    const oldName = editingOriginalName
    const connection = toPlainRecord(editingConnection.value)
    connection.name = name

    if (!connection.savePassword) {
      connection.password = ''
    }
    if (connection.engine !== 'mysql') {
      connection.charset = ''
    }

    try {
      const config = await getConfig()
      const dbConnections = config.database?.connections || []
      const index = dbConnections.findIndex((c) => c.name === oldName)
      if (index < 0) {
        await api.showMessage(t('保存连接失败'), 'error')
        return
      }

      if (dbConnections.some((c, i) => i !== index && c.name === name)) {
        await api.showMessage(t('连接名称已存在'), 'error')
        return
      }
      dbConnections[index] = connection
      const persisted = await patchConfig({ database: { connections: dbConnections } })
      if (!persisted) {
        await api.showMessage(t('保存连接失败'), 'error')
        return
      }

      showEditDialog.value = false
      editingConnection.value = null
      editDialogBaseline = ''
      editingOriginalName = ''
      await loadConnections()

      if (selectedConnection.value?.name === oldName) {
        selectedConnection.value = connections.value.find((c) => c.name === name) || null
      }
    } catch (error) {
      logError('更新连接失败:', error)
      await api.showMessage(t('更新连接失败: ') + error.message, 'error')
    }
  }

  function openCreateDialog(group = '') {
    resetNewConnection()
    newConnection.value.group = group
    createDialogBaseline = JSON.stringify(newConnection.value)
    showCreateDialog.value = true
  }

  function showAddConnectionModal() {
    openCreateDialog()
  }

  return {
    loadConnections,
    toggleGroup,
    saveConnection,
    resetNewConnection,
    openCreateDialog,
    closeCreateDialog,
    editConnection,
    closeEditDialog,
    updateConnection,
    showAddConnectionModal
  }
}
