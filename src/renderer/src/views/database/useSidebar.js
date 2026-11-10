import { dbExecuteQuery, dbQueryDatabases, dbQueryTables } from '@/api'
export function createSidebar(state, api) {
  const {
    connectionDatabases,
    connections,
    contextMenu,
    databaseObjectsMap,
    dragOverGroup,
    draggingConnection,
    expandedConnections,
    expandedDatabases,
    expandedObjectCategories,
    newConnection,
    openedDatabases,
    selectedCategory,
    selectedConnection,
    selectedDatabase,
    selectedInfoType,
    selectedObject,
    showCreateDialog
  } = state

  function onDragStartConnection(conn) {
    draggingConnection.value = conn.name
  }

  function onDragEndConnection() {
    draggingConnection.value = null
    dragOverGroup.value = null
  }

  function onDragOverGroup(groupName) {
    if (draggingConnection.value) {
      dragOverGroup.value = groupName
    }
  }

  function onDragLeaveGroup() {
    dragOverGroup.value = null
  }

  async function onDropToGroup(groupName) {
    if (!draggingConnection.value) return

    const conn = connections.value.find((c) => c.name === draggingConnection.value)
    if (!conn) return

    if (conn.group === groupName) {
      dragOverGroup.value = null
      draggingConnection.value = null
      return
    }

    await api.moveToGroup(conn, groupName)
    dragOverGroup.value = null
    draggingConnection.value = null
  }

  function onDragOverHeader(e) {
    if (draggingConnection.value) {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  async function onDropToHeader() {
    if (!draggingConnection.value) return

    const conn = connections.value.find((c) => c.name === draggingConnection.value)
    if (!conn || !conn.group) {
      draggingConnection.value = null
      return
    }

    await api.removeFromGroup(conn)
    draggingConnection.value = null
  }

  function toggleConnectionDatabases(connName) {
    const index = expandedConnections.value.indexOf(connName)
    if (index >= 0) {
      expandedConnections.value.splice(index, 1)
    } else {
      expandedConnections.value.push(connName)
      if (!connectionDatabases.value[connName]) {
        loadConnectionDatabases(connName)
      }
    }
  }

  async function loadConnectionDatabases(connName) {
    const conn = connections.value.find((c) => c.name === connName)
    if (!conn || !conn.active) return

    try {
      const result = await dbQueryDatabases(connName)
      if (result.success) {
        connectionDatabases.value[connName] = result.databases
      }
    } catch (error) {
      console.error('加载数据库列表失败:', error)
    }
  }

  function toggleDatabaseObjects(connName, dbName) {
    const key = `${connName}_${dbName}`
    const index = expandedDatabases.value.indexOf(key)
    if (index >= 0) {
      expandedDatabases.value.splice(index, 1)
    } else {
      expandedDatabases.value.push(key)
      loadDatabaseObjects(connName, dbName)
    }
  }

  function toggleObjectCategory(category) {
    const index = expandedObjectCategories.value.indexOf(category)
    if (index >= 0) {
      expandedObjectCategories.value.splice(index, 1)
    } else {
      expandedObjectCategories.value.push(category)
    }
  }

  function selectCategory(connection, database, categoryType) {
    api.selectConnection(connection)
    api.selectDatabase(database)
    selectedCategory.value = {
      connectionName: connection.name,
      database: database,
      type: categoryType
    }
    selectedInfoType.value = 'category'
    selectedObject.value = null
    const key = `${connection.name}_${database}`
    if (!expandedObjectCategories.value.includes(`${key}_${categoryType}`)) {
      expandedObjectCategories.value.push(`${key}_${categoryType}`)
    }
  }

  function handleHeaderStatClick(categoryType) {
    const connection = selectedConnection.value
    const database = selectedDatabase.value
    if (!connection) {
      api.showMessage('请先在左侧选择连接', 'warning')
      return
    }

    if (!connection.active) {
      api.showMessage('请先连接数据库', 'warning')
      return
    }

    if (!database) {
      api.showMessage('请先在左侧选择数据库', 'warning')
      return
    }

    if (!expandedConnections.value.includes(connection.name)) {
      expandedConnections.value.push(connection.name)
      if (!connectionDatabases.value[connection.name]) {
        loadConnectionDatabases(connection.name)
      }
    }

    const key = `${connection.name}_${database}`
    if (!expandedDatabases.value.includes(key)) {
      expandedDatabases.value.push(key)
    }
    if (!databaseObjectsMap.value[key]) {
      loadDatabaseObjects(connection.name, database)
    }

    selectCategory(connection, database, categoryType)
  }

  async function openDatabaseFromSidebar(conn, dbName) {
    api.selectConnection(conn)
    api.selectDatabase(dbName)
    api.selectDatabaseObject(dbName)
    const key = `${conn.name}_${dbName}`
    if (!openedDatabases.value.includes(key)) {
      openedDatabases.value.push(key)
    }
    if (!expandedDatabases.value.includes(key)) {
      expandedDatabases.value.push(key)
      await loadDatabaseObjects(conn.name, dbName)
    }
  }

  async function loadDatabaseObjects(connName, dbName) {
    const key = `${connName}_${dbName}`
    try {
      const tablesResult = await dbQueryTables(connName, dbName)
      const viewsResult = await dbExecuteQuery(
        connName,
        `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '${dbName}'`,
        [],
        { autoLimit: false }
      )
      const functionsResult = await dbExecuteQuery(
        connName,
        `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION'`,
        [dbName],
        { autoLimit: false }
      )
      const proceduresResult = await dbExecuteQuery(
        connName,
        `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`,
        [dbName],
        { autoLimit: false }
      )
      const triggersResult = await dbExecuteQuery(
        connName,
        `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`,
        [dbName],
        { autoLimit: false }
      )
      const eventsResult = await dbExecuteQuery(
        connName,
        `SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?`,
        [dbName],
        { autoLimit: false }
      )

      databaseObjectsMap.value[key] = {
        tables: tablesResult.success ? tablesResult.tables : [],
        views: viewsResult.success && viewsResult.rows ? viewsResult.rows.map((r) => r.TABLE_NAME) : [],
        functions:
          functionsResult.success && functionsResult.rows ? functionsResult.rows.map((r) => r.ROUTINE_NAME) : [],
        procedures:
          proceduresResult.success && proceduresResult.rows ? proceduresResult.rows.map((r) => r.ROUTINE_NAME) : [],
        triggers: triggersResult.success && triggersResult.rows ? triggersResult.rows.map((r) => r.TRIGGER_NAME) : [],
        events: eventsResult.success && eventsResult.rows ? eventsResult.rows.map((r) => r.EVENT_NAME) : []
      }
    } catch (error) {
      console.error('加载数据库对象失败:', error)
      databaseObjectsMap.value[key] = {
        tables: [],
        views: [],
        functions: [],
        procedures: [],
        triggers: [],
        events: []
      }
    }
  }

  function handleSelectConnectionDatabase(conn, db) {
    api.selectConnection(conn)
    api.selectDatabase(db)
    api.selectDatabaseObject(db)
  }

  function handleSelectConnectionDatabaseTable(conn, db, table) {
    api.selectConnection(conn)
    api.selectDatabase(db)
    api.selectTableObject(table)
  }

  function handleSelectConnectionDatabaseView(conn, db, view) {
    api.selectConnection(conn)
    api.selectDatabase(db)
    api.selectViewObject(view)
  }

  function handleSelectConnectionDatabaseFunction(conn, db, func) {
    api.selectConnection(conn)
    api.selectDatabase(db)
    api.selectFunctionObject(func)
  }

  function handleSelectConnectionDatabaseProcedure(conn, db, proc) {
    api.selectConnection(conn)
    api.selectDatabase(db)
    api.selectProcedureObject(proc)
  }

  function handleSelectConnectionDatabaseTrigger(conn, db, trigger) {
    api.selectConnection(conn)
    api.selectDatabase(db)
    api.selectTriggerObject(trigger)
  }

  function handleSelectConnectionDatabaseEvent(conn, db, event) {
    api.selectConnection(conn)
    api.selectDatabase(db)
    api.selectEventObject(event)
  }

  function handleOpenNewGroupAndHide() {
    api.openNewGroupDialog()
    api.hideContextMenu()
  }

  function handleRemoveFromGroupAndHide() {
    if (contextMenu.value.target.group) {
      api.removeFromGroup(contextMenu.value.target)
    }
    api.hideContextMenu()
  }

  function handleMoveToGroupAndHide(g) {
    if (g !== contextMenu.value.target.group) {
      api.moveToGroup(contextMenu.value.target, g)
    }
    api.hideContextMenu()
  }

  function handleDumpDatabaseStructureAndHide() {
    api.dumpDatabase(contextMenu.value.target, 'structure')
    api.hideContextMenu()
  }

  function handleDumpDatabaseDataAndHide() {
    api.dumpDatabase(contextMenu.value.target, 'data')
    api.hideContextMenu()
  }

  function handleCopyTableStructureDataAndHide() {
    api.copyTable(contextMenu.value.target, 'structure_data')
    api.hideContextMenu()
  }

  function handleCopyTableStructureAndHide() {
    api.copyTable(contextMenu.value.target, 'structure')
    api.hideContextMenu()
  }

  function handleDumpTableStructureDataAndHide() {
    api.dumpTable(contextMenu.value.target, 'structure_data')
    api.hideContextMenu()
  }

  function handleDumpTableStructureAndHide() {
    api.dumpTable(contextMenu.value.target, 'structure')
    api.hideContextMenu()
  }

  function handleNewConnectionAndHide() {
    newConnection.value.group = ''
    showCreateDialog.value = true
    api.hideContextMenu()
  }

  function handleOpenManageAndHide() {
    api.openManageDialog()
    api.hideContextMenu()
  }

  function handleCloseAllConnectionsAndHide() {
    api.closeAllConnections()
    api.hideContextMenu()
  }

  function handleLoadConnectionsAndHide() {
    api.loadConnections()
    api.hideContextMenu()
  }

  function handleConnectAndHide() {
    api.selectConnection(contextMenu.value.target)
    api.connectToDatabase()
    api.hideContextMenu()
  }

  function handleDisconnectAndHide() {
    api.selectConnection(contextMenu.value.target)
    api.disconnectFromDatabase()
    api.hideContextMenu()
  }

  function handleNewConnectionInGroupAndHide() {
    newConnection.value.group = contextMenu.value.target.group || ''
    showCreateDialog.value = true
    api.hideContextMenu()
  }

  function handleOpenNewQueryAndHide() {
    api.openNewQuery(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleEditConnectionAndHide() {
    api.editConnection(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleDuplicateConnectionAndHide() {
    api.duplicateConnection(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleDeleteConnectionAndHide() {
    api.selectConnection(contextMenu.value.target)
    api.deleteConnection()
    api.hideContextMenu()
  }

  function handleNewConnectionInNamedGroupAndHide() {
    newConnection.value.group = contextMenu.value.target.name
    showCreateDialog.value = true
    api.hideContextMenu()
  }

  function handleEditGroupAndHide() {
    api.editGroup(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleDeleteGroupAndHide() {
    api.deleteGroup(contextMenu.value.target.name)
    api.hideContextMenu()
  }

  function handleOpenDatabaseAndHide() {
    api.openDatabase(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleCloseDatabaseAndHide() {
    api.closeDatabase(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleEditDatabaseAndHide() {
    api.editDatabase(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleDeleteDatabaseAndHide() {
    api.deleteDatabase(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleNewQueryForDatabaseAndHide() {
    api.newQueryForDatabase(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleRunSqlFileAndHide() {
    api.runSqlFile(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleRefreshDatabaseAndHide() {
    api.refreshDatabase(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleRefreshCategoryAndHide() {
    api.refreshCategory(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleOpenTableAndHide() {
    api.openTable(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleDeleteTableAndHide() {
    api.deleteTable(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleEmptyTableAndHide() {
    api.emptyTable(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleTruncateTableAndHide() {
    api.truncateTable(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleRenameTableAndHide() {
    api.renameTable(contextMenu.value.target)
    api.hideContextMenu()
  }

  function handleRefreshTableAndHide() {
    api.refreshTable(contextMenu.value.target)
    api.hideContextMenu()
  }

  return {
    onDragStartConnection,
    onDragEndConnection,
    onDragOverGroup,
    onDragLeaveGroup,
    onDropToGroup,
    onDragOverHeader,
    onDropToHeader,
    toggleConnectionDatabases,
    loadConnectionDatabases,
    toggleDatabaseObjects,
    toggleObjectCategory,
    selectCategory,
    handleHeaderStatClick,
    openDatabaseFromSidebar,
    loadDatabaseObjects,
    handleSelectConnectionDatabase,
    handleSelectConnectionDatabaseTable,
    handleSelectConnectionDatabaseView,
    handleSelectConnectionDatabaseFunction,
    handleSelectConnectionDatabaseProcedure,
    handleSelectConnectionDatabaseTrigger,
    handleSelectConnectionDatabaseEvent,
    handleOpenNewGroupAndHide,
    handleRemoveFromGroupAndHide,
    handleMoveToGroupAndHide,
    handleDumpDatabaseStructureAndHide,
    handleDumpDatabaseDataAndHide,
    handleCopyTableStructureDataAndHide,
    handleCopyTableStructureAndHide,
    handleDumpTableStructureDataAndHide,
    handleDumpTableStructureAndHide,
    handleNewConnectionAndHide,
    handleOpenManageAndHide,
    handleCloseAllConnectionsAndHide,
    handleLoadConnectionsAndHide,
    handleConnectAndHide,
    handleDisconnectAndHide,
    handleNewConnectionInGroupAndHide,
    handleOpenNewQueryAndHide,
    handleEditConnectionAndHide,
    handleDuplicateConnectionAndHide,
    handleDeleteConnectionAndHide,
    handleNewConnectionInNamedGroupAndHide,
    handleEditGroupAndHide,
    handleDeleteGroupAndHide,
    handleOpenDatabaseAndHide,
    handleCloseDatabaseAndHide,
    handleEditDatabaseAndHide,
    handleDeleteDatabaseAndHide,
    handleNewQueryForDatabaseAndHide,
    handleRunSqlFileAndHide,
    handleRefreshDatabaseAndHide,
    handleRefreshCategoryAndHide,
    handleOpenTableAndHide,
    handleDeleteTableAndHide,
    handleEmptyTableAndHide,
    handleTruncateTableAndHide,
    handleRenameTableAndHide,
    handleRefreshTableAndHide
  }
}
