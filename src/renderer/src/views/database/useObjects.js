import { dbExecuteQuery, dbGetTableStructure, dbGetObjectDefinition } from '@/api'
export function createObjects(state) {
  const {
    activeTabId,
    databaseInfo,
    functionDefinition,
    objectDefinition,
    objectSearchKeyword,
    objectTableDetails,
    selectedConnection,
    selectedDatabase,
    selectedInfoType,
    selectedObject,
    tableDDL,
    tableInfo,
    tableInfoMode,
    tableStructure,
    viewDefinition
  } = state

  async function loadTableDetails(connName, dbName) {
    objectTableDetails.value = []
    if (!connName || !dbName) return

    try {
      const result = await dbExecuteQuery(
        connName,
        `SELECT 
        TABLE_NAME as name,
        TABLE_ROWS as rows,
        DATA_LENGTH + INDEX_LENGTH as dataSize,
        ENGINE as engine,
        UPDATE_TIME as modified,
        TABLE_COMMENT as comment
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = '${dbName}'
      ORDER BY TABLE_NAME`,
        [],
        { autoLimit: false }
      )

      if (result.success && result.rows) {
        objectTableDetails.value = result.rows.map((row) => ({
          name: row.name,
          rows: row.rows || 0,
          dataSize: row.dataSize || 0,
          engine: row.engine || '-',
          modified: row.modified || '-',
          comment: row.comment || ''
        }))
      }
    } catch (error) {
      console.error('加载表详情失败:', error)
    }
  }

  async function loadTableStructureForObject(connName, dbName, tableName) {
    tableStructure.value = []
    tableDDL.value = ''
    if (!connName || !dbName || !tableName) return

    try {
      const result = await dbGetTableStructure(connName, dbName, tableName)
      if (result.success) {
        tableStructure.value = result.fields || []
      }

      const ddlResult = await dbExecuteQuery(connName, `SHOW CREATE TABLE \`${dbName}\`.\`${tableName}\``, [], {
        autoLimit: false
      })
      if (ddlResult.success && ddlResult.rows && ddlResult.rows.length > 0) {
        tableDDL.value = ddlResult.rows[0]['Create Table'] || '无法获取DDL'
      }
    } catch (error) {
      console.error('加载表结构失败:', error)
    }
  }

  async function loadViewDefinitionForObject(connName, dbName, viewName) {
    viewDefinition.value = ''
    if (!connName || !dbName || !viewName) return

    try {
      const result = await dbExecuteQuery(
        connName,
        `SELECT VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${viewName}'`,
        [],
        { autoLimit: false }
      )

      if (result.success && result.rows && result.rows.length > 0) {
        viewDefinition.value = result.rows[0].VIEW_DEFINITION || '无法获取视图定义'
      }
    } catch (error) {
      console.error('加载视图定义失败:', error)
      viewDefinition.value = '加载失败'
    }
  }

  async function loadFunctionDefinitionForObject(connName, dbName, funcName) {
    functionDefinition.value = ''
    if (!connName || !dbName || !funcName) return

    try {
      const result = await dbExecuteQuery(
        connName,
        `SELECT ROUTINE_DEFINITION FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '${dbName}' AND ROUTINE_NAME = '${funcName}' AND ROUTINE_TYPE = 'FUNCTION'`,
        [],
        { autoLimit: false }
      )

      if (result.success && result.rows && result.rows.length > 0) {
        functionDefinition.value = result.rows[0].ROUTINE_DEFINITION || '无法获取函数定义'
      }
    } catch (error) {
      console.error('加载函数定义失败:', error)
      functionDefinition.value = '加载失败'
    }
  }

  function selectDatabaseObject(dbName) {
    selectedObject.value = {
      type: 'database',
      name: dbName,
      connectionName: selectedConnection.value?.name
    }
    selectedInfoType.value = 'database'
    objectSearchKeyword.value = ''
    objectTableDetails.value = []
    tableStructure.value = []
    viewDefinition.value = ''
    functionDefinition.value = ''
    databaseInfo.value = null
    tableInfo.value = null
    if (selectedConnection.value?.active) {
      loadTableDetails(selectedConnection.value.name, dbName)
      loadDatabaseInfo(selectedConnection.value.name, dbName)
    }
  }

  async function loadDatabaseInfo(connName, dbName) {
    try {
      const result = await dbExecuteQuery(
        connName,
        `SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${dbName}'`,
        [],
        { autoLimit: false }
      )
      if (result.success && result.rows && result.rows.length > 0) {
        databaseInfo.value = {
          name: result.rows[0].SCHEMA_NAME,
          charset: result.rows[0].DEFAULT_CHARACTER_SET_NAME,
          collation: result.rows[0].DEFAULT_COLLATION_NAME
        }
      }
    } catch (err) {
      console.error('获取数据库信息失败:', err)
    }
  }

  function selectTableObject(tableName) {
    selectedObject.value = {
      type: 'table',
      name: tableName,
      connectionName: selectedConnection.value?.name,
      database: selectedDatabase.value
    }
    selectedInfoType.value = 'table'
    tableInfoMode.value = 'info'
    objectSearchKeyword.value = ''
    tableStructure.value = []
    tableInfo.value = null
    tableDDL.value = ''
    if (selectedConnection.value?.active && selectedDatabase.value) {
      loadTableStructureForObject(selectedConnection.value.name, selectedDatabase.value, tableName)
      loadTableInfo(selectedConnection.value.name, selectedDatabase.value, tableName)
    }
  }

  async function loadTableInfo(connName, dbName, tableName) {
    try {
      const result = await dbExecuteQuery(
        connName,
        `SELECT TABLE_NAME, TABLE_ROWS, ENGINE, AUTO_INCREMENT, ROW_FORMAT, TABLE_COLLATION, CREATE_TIME, UPDATE_TIME, CHECK_TIME, INDEX_LENGTH, DATA_LENGTH, MAX_DATA_LENGTH, DATA_FREE, CREATE_OPTIONS, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${tableName}'`,
        [],
        { autoLimit: false }
      )
      if (result.success && result.rows && result.rows.length > 0) {
        tableInfo.value = result.rows[0]
      }
    } catch (err) {
      console.error('获取表信息失败:', err)
    }
  }

  async function loadObjectDefinitionForObject(type, objectName) {
    objectDefinition.value = ''
    const connName = selectedConnection.value?.name
    const dbName = selectedDatabase.value
    if (!connName || !dbName || !objectName) return

    try {
      const result = await dbGetObjectDefinition(connName, dbName, type, objectName)
      objectDefinition.value = result.success ? result.ddl || '无法获取对象定义' : result.error || '加载对象定义失败'
    } catch (error) {
      console.error('加载对象定义失败:', error)
      objectDefinition.value = '加载失败'
    }
  }

  function selectProcedureObject(procName) {
    selectedObject.value = {
      type: 'procedure',
      name: procName,
      connectionName: selectedConnection.value?.name,
      database: selectedDatabase.value
    }
    selectedInfoType.value = 'object'
    objectSearchKeyword.value = ''
    activeTabId.value = 'object'
    if (selectedConnection.value?.active && selectedDatabase.value) {
      loadObjectDefinitionForObject('procedure', procName)
    }
  }

  function selectTriggerObject(triggerName) {
    selectedObject.value = {
      type: 'trigger',
      name: triggerName,
      connectionName: selectedConnection.value?.name,
      database: selectedDatabase.value
    }
    selectedInfoType.value = 'object'
    objectSearchKeyword.value = ''
    activeTabId.value = 'object'
    if (selectedConnection.value?.active && selectedDatabase.value) {
      loadObjectDefinitionForObject('trigger', triggerName)
    }
  }

  function selectEventObject(eventName) {
    selectedObject.value = {
      type: 'event',
      name: eventName,
      connectionName: selectedConnection.value?.name,
      database: selectedDatabase.value
    }
    selectedInfoType.value = 'object'
    objectSearchKeyword.value = ''
    activeTabId.value = 'object'
    if (selectedConnection.value?.active && selectedDatabase.value) {
      loadObjectDefinitionForObject('event', eventName)
    }
  }

  function selectViewObject(viewName) {
    selectedObject.value = {
      type: 'view',
      name: viewName,
      connectionName: selectedConnection.value?.name,
      database: selectedDatabase.value
    }
    selectedInfoType.value = 'object'
    objectSearchKeyword.value = ''
    viewDefinition.value = ''
    activeTabId.value = 'object'
    if (selectedConnection.value?.active && selectedDatabase.value) {
      loadViewDefinitionForObject(selectedConnection.value.name, selectedDatabase.value, viewName)
    }
  }

  function selectFunctionObject(funcName) {
    selectedObject.value = {
      type: 'function',
      name: funcName,
      connectionName: selectedConnection.value?.name,
      database: selectedDatabase.value
    }
    selectedInfoType.value = 'object'
    objectSearchKeyword.value = ''
    functionDefinition.value = ''
    activeTabId.value = 'object'
    if (selectedConnection.value?.active && selectedDatabase.value) {
      loadFunctionDefinitionForObject(selectedConnection.value.name, selectedDatabase.value, funcName)
    }
  }

  function clearObjectInfo() {
    selectedObject.value = null
    objectSearchKeyword.value = ''
    objectTableDetails.value = []
    tableStructure.value = []
    viewDefinition.value = ''
    functionDefinition.value = ''
    objectDefinition.value = ''
  }

  return {
    loadTableDetails,
    loadTableStructureForObject,
    loadViewDefinitionForObject,
    loadFunctionDefinitionForObject,
    loadObjectDefinitionForObject,
    selectDatabaseObject,
    loadDatabaseInfo,
    selectTableObject,
    loadTableInfo,
    selectViewObject,
    selectFunctionObject,
    selectProcedureObject,
    selectTriggerObject,
    selectEventObject,
    clearObjectInfo
  }
}
