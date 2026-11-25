import { t } from '@/i18n'
import {
  dbTestConnection,
  dbCreateConnection,
  dbCloseConnection,
  dbCloseAllConnections,
  dbExecuteQuery,
  dbGetConnectionInfo,
  dbQueryDatabases,
  dbQueryTables,
  getConfig,
  patchConfig
} from '@/api'
import { normalizeDatabaseEngine } from '@shared/databaseEngines'
import { buildConnectionConfig } from '@shared/databaseConnection'
import { toPlainRecord } from './connectionDefaults'
import { logError } from '@/utils/log'

export function createConnectionActions(state, api) {
  const {
    connecting,
    connectionDatabases,
    connectionInfo,
    connections,
    databaseInfo,
    databases,
    editingConnection,
    expandedConnections,
    newConnection,
    selectedConnection,
    selectedDatabase,
    selectedGroup,
    selectedInfoType,
    selectedObject,
    tableInfo,
    tables,
    testingEditConn,
    testingNewConn
  } = state

  async function duplicateConnection(conn) {
    const newConn = { ...conn, name: conn.name + '_copy' }

    try {
      const config = await getConfig()
      const dbConnections = config.database?.connections || []

      let name = newConn.name
      let counter = 1
      while (dbConnections.find((c) => c.name === name)) {
        name = conn.name + '_copy' + counter
        counter++
      }
      newConn.name = name

      dbConnections.push(toPlainRecord(newConn))
      const saved = await patchConfig({ database: { connections: dbConnections } })
      if (!saved) {
        await api.showMessage(t('复制连接失败'), 'error')
        return
      }
      await api.loadConnections()
    } catch (error) {
      logError('复制连接失败:', error)
      await api.showMessage(t('复制连接失败: ') + error.message, 'error')
    }
  }

  function selectConnection(conn) {
    selectedConnection.value = conn
    databases.value = []
    tables.value = []
    selectedDatabase.value = ''
    api.clearObjectInfo()
    selectedInfoType.value = 'connection'
    selectedGroup.value = null
    connectionInfo.value = null
    databaseInfo.value = null
    tableInfo.value = null
    if (conn.active) {
      loadConnectionInfo(conn.name)
      if (!connectionDatabases.value[conn.name]) {
        api.loadConnectionDatabases(conn.name)
      }
    }
  }

  async function loadConnectionInfo(connName) {
    try {
      const result = await dbGetConnectionInfo(connName)
      if (result.success && result.info) {
        connectionInfo.value = {
          version: result.info.version,
          charset: result.info.charset || result.info.encoding,
          collation: result.info.collation,
          autoIncrementIncrement: result.info.autoIncrementIncrement
        }
      }
    } catch (err) {
      logError('获取连接信息失败:', err)
    }
  }

  function selectGroup(group) {
    selectedGroup.value = group
    selectedInfoType.value = 'group'
    selectedConnection.value = null
    selectedDatabase.value = ''
    selectedObject.value = null
    connectionInfo.value = null
    databaseInfo.value = null
    tableInfo.value = null
  }

  async function handleConnectionDoubleClick(conn) {
    selectConnection(conn)
    if (!conn.active) {
      await connectToDatabase()
      return
    }
    if (!expandedConnections.value.includes(conn.name)) {
      expandedConnections.value.push(conn.name)
    }
    if (!connectionDatabases.value[conn.name]) {
      await api.loadConnectionDatabases(conn.name)
    }
  }

  async function connectToDatabase() {
    if (!selectedConnection.value) return

    connecting.value = true
    try {
      const connConfig = buildConnectionConfig(selectedConnection.value)

      const result = await dbCreateConnection(selectedConnection.value.name, connConfig)

      if (result.success) {
        selectedConnection.value.active = true
        await api.loadConnectionDatabases(selectedConnection.value.name)
        if (!expandedConnections.value.includes(selectedConnection.value.name)) {
          expandedConnections.value.push(selectedConnection.value.name)
        }
        await loadDatabases()
      } else {
        await api.showMessage(t('连接失败: ') + result.error, 'error')
      }
    } catch (error) {
      logError('连接失败:', error)
      await api.showMessage(t('连接失败: ') + error.message, 'error')
    } finally {
      connecting.value = false
    }
  }

  async function disconnectFromDatabase() {
    if (!selectedConnection.value) return

    try {
      const result = await dbCloseConnection(selectedConnection.value.name)

      if (result.success) {
        selectedConnection.value.active = false
        databases.value = []
        tables.value = []
        selectedDatabase.value = ''
      } else {
        await api.showMessage(t('断开连接失败: ') + result.error, 'error')
      }
    } catch (error) {
      logError('断开连接失败:', error)
      await api.showMessage(t('断开连接失败: ') + error.message, 'error')
    }
  }

  async function closeAllConnections() {
    try {
      const result = await dbCloseAllConnections()
      if (result.success) {
        connections.value.forEach((conn) => (conn.active = false))
        if (selectedConnection.value) {
          selectedConnection.value.active = false
        }
        databases.value = []
        tables.value = []
        selectedDatabase.value = ''
      } else {
        await api.showMessage(t('关闭连接失败'), 'error')
      }
    } catch (error) {
      logError('关闭所有连接失败:', error)
      await api.showMessage(t('关闭所有连接失败: ') + error.message, 'error')
    }
  }

  async function validateConnTarget(source) {
    if (normalizeDatabaseEngine(source.engine) === 'sqlite') {
      if (!String(source.filePath || '').trim()) {
        await api.showMessage(t('请选择 SQLite 数据库文件'), 'warning')
        return false
      }
      return true
    }
    if (!source.host) {
      await api.showMessage(t('请输入主机地址'), 'warning')
      return false
    }
    return true
  }

  async function testNewConnection() {
    if (!(await validateConnTarget(newConnection.value))) return

    testingNewConn.value = true
    try {
      const result = await dbTestConnection(buildConnectionConfig(newConnection.value))

      if (result.success) {
        await api.showMessage(t('连接成功！'), 'success')
      } else {
        await api.showMessage(t('连接失败: ') + result.error, 'error')
      }
    } catch (error) {
      logError('测试连接失败:', error)
      await api.showMessage(t('测试连接失败: ') + error.message, 'error')
    } finally {
      testingNewConn.value = false
    }
  }

  async function testEditConnection() {
    if (!(await validateConnTarget(editingConnection.value))) return

    testingEditConn.value = true
    try {
      const result = await dbTestConnection(buildConnectionConfig(editingConnection.value))

      if (result.success) {
        await api.showMessage(t('连接成功！'), 'success')
      } else {
        await api.showMessage(t('连接失败: ') + result.error, 'error')
      }
    } catch (error) {
      logError('测试连接失败:', error)
      await api.showMessage(t('测试连接失败: ') + error.message, 'error')
    } finally {
      testingEditConn.value = false
    }
  }

  async function deleteConnection() {
    if (!selectedConnection.value) return

    const confirmed = await api.showConfirm(t('确定要删除连接 "{p0}" 吗？', { p0: selectedConnection.value.name }))
    if (!confirmed) return

    try {
      if (selectedConnection.value.active) {
        await dbCloseConnection(selectedConnection.value.name)
      }

      const config = await getConfig()
      const dbConnections = config.database?.connections || []
      const index = dbConnections.findIndex((c) => c.name === selectedConnection.value.name)

      if (index >= 0) {
        dbConnections.splice(index, 1)
        await patchConfig({ database: { connections: dbConnections } })
      }

      selectedConnection.value = null
      await api.loadConnections()
    } catch (error) {
      logError('删除连接失败:', error)
      await api.showMessage(t('删除连接失败: ') + error.message, 'error')
    }
  }

  async function executeSqlDirect(sql, connName) {
    try {
      const result = await dbExecuteQuery(connName, sql, [], { autoLimit: false })
      return result
    } catch (error) {
      logError('执行SQL失败:', error)
      return { success: false, error: error.message }
    }
  }

  async function loadDatabases() {
    if (!selectedConnection.value || !selectedConnection.value.active) return

    try {
      const result = await dbQueryDatabases(selectedConnection.value.name)

      if (result.success) {
        databases.value = result.databases
      } else {
        logError('加载数据库列表失败', result.error)
      }
    } catch (error) {
      logError('加载数据库列表失败:', error)
    }
  }

  async function selectDatabase(db) {
    selectedDatabase.value = db
    tables.value = []

    try {
      const result = await dbQueryTables(selectedConnection.value.name, db)

      if (result.success) {
        tables.value = result.tables
      } else {
        logError('加载表列表失败', result.error)
      }
    } catch (error) {
      logError('加载表列表失败:', error)
    }
  }

  return {
    connectToDatabase,
    disconnectFromDatabase,
    closeAllConnections,
    testNewConnection,
    testEditConnection,
    deleteConnection,
    executeSqlDirect,
    loadDatabases,
    selectDatabase,
    selectConnection,
    loadConnectionInfo,
    selectGroup,
    handleConnectionDoubleClick,
    duplicateConnection
  }
}
