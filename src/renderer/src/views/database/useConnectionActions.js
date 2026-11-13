import {
  dbTestConnection,
  dbCreateConnection,
  dbCloseConnection,
  dbCloseAllConnections,
  dbExecuteQuery,
  dbQueryDatabases,
  dbQueryTables,
  getConfig,
  saveConfig
} from '@/api'
export function createConnectionActions(state, api) {
  const {
    connecting,
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
      const dbConnections = config.dbConnections || []

      let name = newConn.name
      let counter = 1
      while (dbConnections.find((c) => c.name === name)) {
        name = conn.name + '_copy' + counter
        counter++
      }
      newConn.name = name

      dbConnections.push(newConn)
      await saveConfig({ ...config, dbConnections })
      await api.loadConnections()
    } catch (error) {
      console.error('复制连接失败:', error)
      await api.showMessage('复制连接失败: ' + error.message, 'error')
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
    }
  }

  async function loadConnectionInfo(connName) {
    try {
      const result = await dbExecuteQuery(
        connName,
        'SELECT VERSION() AS version, @@character_set_server AS charset, @@collation_server AS collation, @@session.auto_increment_increment AS autoIncrementIncrement',
        [],
        { autoLimit: false }
      )
      if (result.success && result.rows && result.rows.length > 0) {
        connectionInfo.value = {
          version: result.rows[0].version,
          charset: result.rows[0].charset,
          collation: result.rows[0].collation,
          autoIncrementIncrement: result.rows[0].autoIncrementIncrement
        }
      }
    } catch (err) {
      console.error('获取连接信息失败:', err)
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
    }
  }

  async function connectToDatabase() {
    if (!selectedConnection.value) return

    connecting.value = true
    try {
      const connConfig = {
        host: selectedConnection.value.host,
        port: selectedConnection.value.port,
        user: selectedConnection.value.user,
        password: selectedConnection.value.password
      }

      if (selectedConnection.value.charset) {
        connConfig.charset = selectedConnection.value.charset
      }

      if (selectedConnection.value.enableKeepAlive) {
        connConfig.keepAliveInterval = selectedConnection.value.keepAliveInterval
      }

      if (selectedConnection.value.enableConnectTimeout) {
        connConfig.connectTimeout = selectedConnection.value.connectTimeout
      }

      if (selectedConnection.value.enableReadTimeout) {
        connConfig.readTimeout = selectedConnection.value.readTimeout
      }

      if (selectedConnection.value.enableWriteTimeout) {
        connConfig.writeTimeout = selectedConnection.value.writeTimeout
      }

      const result = await dbCreateConnection(selectedConnection.value.name, connConfig)

      if (result.success) {
        selectedConnection.value.active = true
        await api.loadConnectionDatabases(selectedConnection.value.name)
        if (!expandedConnections.value.includes(selectedConnection.value.name)) {
          expandedConnections.value.push(selectedConnection.value.name)
        }
        await loadDatabases()
      } else {
        await api.showMessage('连接失败: ' + result.error, 'error')
      }
    } catch (error) {
      console.error('连接失败:', error)
      await api.showMessage('连接失败: ' + error.message, 'error')
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
        await api.showMessage('断开连接失败: ' + result.error, 'error')
      }
    } catch (error) {
      console.error('断开连接失败:', error)
      await api.showMessage('断开连接失败: ' + error.message, 'error')
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
        await api.showMessage('关闭连接失败', 'error')
      }
    } catch (error) {
      console.error('关闭所有连接失败:', error)
      await api.showMessage('关闭所有连接失败: ' + error.message, 'error')
    }
  }

  async function testNewConnection() {
    if (!newConnection.value.host) {
      await api.showMessage('请输入主机地址', 'warning')
      return
    }

    testingNewConn.value = true
    try {
      const connConfig = {
        host: newConnection.value.host,
        port: newConnection.value.port || 3306,
        user: newConnection.value.user || 'root',
        password: newConnection.value.password
      }

      if (newConnection.value.charset) {
        connConfig.charset = newConnection.value.charset
      }

      if (newConnection.value.enableConnectTimeout) {
        connConfig.connectTimeout = newConnection.value.connectTimeout
      }

      const result = await dbTestConnection(connConfig)

      if (result.success) {
        await api.showMessage('连接成功！', 'success')
      } else {
        await api.showMessage('连接失败: ' + result.error, 'error')
      }
    } catch (error) {
      console.error('测试连接失败:', error)
      await api.showMessage('测试连接失败: ' + error.message, 'error')
    } finally {
      testingNewConn.value = false
    }
  }

  async function testEditConnection() {
    if (!editingConnection.value.host) {
      await api.showMessage('请输入主机地址', 'warning')
      return
    }

    testingEditConn.value = true
    try {
      const connConfig = {
        host: editingConnection.value.host,
        port: editingConnection.value.port || 3306,
        user: editingConnection.value.user || 'root',
        password: editingConnection.value.password
      }

      if (editingConnection.value.charset) {
        connConfig.charset = editingConnection.value.charset
      }

      if (editingConnection.value.enableConnectTimeout) {
        connConfig.connectTimeout = editingConnection.value.connectTimeout
      }

      const result = await dbTestConnection(connConfig)

      if (result.success) {
        await api.showMessage('连接成功！', 'success')
      } else {
        await api.showMessage('连接失败: ' + result.error, 'error')
      }
    } catch (error) {
      console.error('测试连接失败:', error)
      await api.showMessage('测试连接失败: ' + error.message, 'error')
    } finally {
      testingEditConn.value = false
    }
  }

  async function deleteConnection() {
    if (!selectedConnection.value) return

    const confirmed = await api.showConfirm(`确定要删除连接 "${selectedConnection.value.name}" 吗？`)
    if (!confirmed) return

    try {
      if (selectedConnection.value.active) {
        await dbCloseConnection(selectedConnection.value.name)
      }

      const config = await getConfig()
      const dbConnections = config.dbConnections || []
      const index = dbConnections.findIndex((c) => c.name === selectedConnection.value.name)

      if (index >= 0) {
        dbConnections.splice(index, 1)
        await saveConfig({ ...config, dbConnections })
      }

      selectedConnection.value = null
      await api.loadConnections()
    } catch (error) {
      console.error('删除连接失败:', error)
      await api.showMessage('删除连接失败: ' + error.message, 'error')
    }
  }

  async function executeSqlDirect(sql, connName) {
    try {
      const result = await dbExecuteQuery(connName, sql, [], { autoLimit: false })
      return result
    } catch (error) {
      console.error('执行SQL失败:', error)
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
        console.error('加载数据库列表失败:', result.error)
      }
    } catch (error) {
      console.error('加载数据库列表失败:', error)
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
        console.error('加载表列表失败:', result.error)
      }
    } catch (error) {
      console.error('加载表列表失败:', error)
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
