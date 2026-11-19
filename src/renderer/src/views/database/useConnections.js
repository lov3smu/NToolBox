import { t } from '@/i18n'
import { dbGetActiveConnections, getConfig, patchConfig } from '@/api'

function normalizeSsh(raw = {}) {
  return {
    enabled: raw.enabled === true,
    host: raw.host || '',
    port: Number(raw.port) || 22,
    user: raw.user || '',
    keyPath: raw.keyPath || ''
  }
}

function normalizeSsl(raw = {}) {
  return {
    enabled: raw.enabled === true,
    verify: raw.verify !== false,
    caPath: raw.caPath || ''
  }
}

export function createConnections(state, api) {
  const {
    connections,
    createDialogTab,
    editDialogTab,
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
        ...conn,
        savePassword: conn.savePassword ?? true,
        charset: conn.charset ?? '',
        enableKeepAlive: conn.enableKeepAlive ?? true,
        keepAliveInterval: conn.keepAliveInterval ?? 240,
        enableConnectTimeout: conn.enableConnectTimeout ?? true,
        connectTimeout: conn.connectTimeout ?? 30,
        enableReadTimeout: conn.enableReadTimeout ?? false,
        readTimeout: conn.readTimeout ?? 30,
        enableWriteTimeout: conn.enableWriteTimeout ?? true,
        writeTimeout: conn.writeTimeout ?? 30,
        autoConnect: conn.autoConnect ?? false,
        readOnly: conn.readOnly === true,
        ssh: normalizeSsh(conn.ssh),
        ssl: normalizeSsl(conn.ssl),
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
      console.error('加载连接配置失败:', error)
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

  async function saveConnection() {
    if (!newConnection.value.name) {
      await api.showMessage(t('请输入连接名称'), 'warning')
      return
    }

    const connection = { ...newConnection.value }

    if (!connection.savePassword) {
      connection.password = ''
    }

    try {
      const config = await getConfig()
      const dbConnections = config.database?.connections || []
      const existingIndex = dbConnections.findIndex((c) => c.name === connection.name)

      if (existingIndex >= 0) {
        await api.showMessage(t('连接名称已存在'), 'error')
        return
      }

      dbConnections.push(connection)
      await patchConfig({ database: { connections: dbConnections } })

      showCreateDialog.value = false
      resetNewConnection()
      await loadConnections()
    } catch (error) {
      console.error('保存连接失败:', error)
      await api.showMessage(t('保存连接失败: ') + error.message, 'error')
    }
  }

  function onHostBlur() {
    if (!newConnection.value.name && newConnection.value.host) {
      newConnection.value.name = newConnection.value.host
    }
  }

  function resetNewConnection() {
    newConnection.value = {
      name: '',
      group: '',
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: '',
      savePassword: true,
      charset: '',
      enableKeepAlive: true,
      keepAliveInterval: 240,
      enableConnectTimeout: true,
      connectTimeout: 30,
      enableReadTimeout: false,
      readTimeout: 30,
      enableWriteTimeout: true,
      writeTimeout: 30,
      autoConnect: false,
      readOnly: false,
      ssh: normalizeSsh({}),
      ssl: normalizeSsl({})
    }
    createDialogTab.value = 'basic'
  }

  function closeCreateDialog() {
    showCreateDialog.value = false
    resetNewConnection()
  }

  function editConnection(conn) {
    editingConnection.value = {
      ...conn,
      savePassword: conn.savePassword ?? true,
      charset: conn.charset ?? '',
      enableKeepAlive: conn.enableKeepAlive ?? true,
      keepAliveInterval: conn.keepAliveInterval ?? 240,
      enableConnectTimeout: conn.enableConnectTimeout ?? true,
      connectTimeout: conn.connectTimeout ?? 30,
      enableReadTimeout: conn.enableReadTimeout ?? false,
      readTimeout: conn.readTimeout ?? 30,
      enableWriteTimeout: conn.enableWriteTimeout ?? true,
      writeTimeout: conn.writeTimeout ?? 30,
      autoConnect: conn.autoConnect ?? false,
      readOnly: conn.readOnly === true,
      ssh: normalizeSsh(conn.ssh),
      ssl: normalizeSsl(conn.ssl)
    }
    editDialogTab.value = 'basic'
    showEditDialog.value = true
  }

  function closeEditDialog() {
    showEditDialog.value = false
    editingConnection.value = null
  }

  async function updateConnection() {
    if (!editingConnection.value.name) {
      await api.showMessage(t('请输入连接名称'), 'warning')
      return
    }

    const oldName = selectedConnection.value?.name
    const connection = { ...editingConnection.value }

    if (!connection.savePassword) {
      connection.password = ''
    }

    try {
      const config = await getConfig()
      const dbConnections = config.database?.connections || []
      const index = dbConnections.findIndex((c) => c.name === oldName)

      if (index >= 0) {
        if (editingConnection.value.name !== oldName) {
          const existing = dbConnections.findIndex((c) => c.name === editingConnection.value.name)
          if (existing >= 0) {
            await api.showMessage(t('连接名称已存在'), 'error')
            return
          }
        }
        dbConnections[index] = connection
        await patchConfig({ database: { connections: dbConnections } })
      }

      showEditDialog.value = false
      editingConnection.value = null
      await loadConnections()

      if (selectedConnection.value?.name === oldName) {
        selectedConnection.value = connections.value.find((c) => c.name === editingConnection.value?.name) || null
      }
    } catch (error) {
      console.error('更新连接失败:', error)
      await api.showMessage(t('更新连接失败: ') + error.message, 'error')
    }
  }

  function showAddConnectionModal() {
    newConnection.value.group = ''
    showCreateDialog.value = true
  }

  return {
    loadConnections,
    toggleGroup,
    saveConnection,
    onHostBlur,
    resetNewConnection,
    closeCreateDialog,
    editConnection,
    closeEditDialog,
    updateConnection,
    showAddConnectionModal
  }
}
