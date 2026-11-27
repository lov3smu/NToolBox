import { t } from '@/i18n'
import { dbGetDatabaseInfo, dbGetObjectDefinition, dbGetTableDetails, dbGetTableInfo, dbGetTableStructure } from '@/api'
import { logError } from '@/utils/log'
export function createObjects(state, api) {
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
      const result = await dbGetTableDetails(connName, dbName)
      if (result.success && result.details) {
        objectTableDetails.value = result.details.map((row) => ({
          name: row.name,
          rows: row.rows || 0,
          dataSize: row.dataSize || 0,
          engine: row.engine || '-',
          modified: row.modified || '-',
          comment: row.comment || ''
        }))
      }
    } catch (error) {
      logError('加载表详情失败:', error)
    }
  }

  async function loadTableStructureForObject(connName, dbName, tableName) {
    tableStructure.value = []
    tableDDL.value = ''
    if (!connName || !dbName || !tableName) return

    try {
      const [structureResult, ddlResult] = await Promise.all([
        dbGetTableStructure(connName, dbName, tableName),
        dbGetObjectDefinition(connName, dbName, 'table', tableName)
      ])
      if (structureResult.success) {
        tableStructure.value = structureResult.fields || []
      }
      tableDDL.value = (ddlResult.success && ddlResult.ddl) || t('无法获取DDL')
    } catch (error) {
      logError('加载表结构失败:', error)
    }
  }

  async function loadViewDefinitionForObject(connName, dbName, viewName) {
    viewDefinition.value = ''
    if (!connName || !dbName || !viewName) return

    try {
      const result = await dbGetObjectDefinition(connName, dbName, 'view', viewName)
      viewDefinition.value = (result.success && result.ddl) || t('无法获取视图定义')
    } catch (error) {
      logError('加载视图定义失败:', error)
      viewDefinition.value = t('加载失败')
    }
  }

  async function loadFunctionDefinitionForObject(connName, dbName, funcName) {
    functionDefinition.value = ''
    if (!connName || !dbName || !funcName) return

    try {
      const result = await dbGetObjectDefinition(connName, dbName, 'function', funcName)
      functionDefinition.value = result.success
        ? result.ddl || t('无法获取函数定义')
        : result.error || t('加载函数定义失败')
    } catch (error) {
      logError('加载函数定义失败:', error)
      functionDefinition.value = t('加载失败')
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
      const result = await dbGetDatabaseInfo(connName, dbName)
      if (result.success && result.info) {
        databaseInfo.value = {
          name: result.info.name,
          charset: result.info.charset,
          collation: result.info.collation
        }
      }
    } catch (err) {
      logError('获取数据库信息失败:', err)
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
      const result = await dbGetTableInfo(connName, dbName, tableName)
      if (result.success && result.info) {
        tableInfo.value = result.info
      }
    } catch (err) {
      logError('获取表信息失败:', err)
    }
  }

  async function loadObjectDefinitionForObject(type, objectName) {
    objectDefinition.value = ''
    const connName = selectedConnection.value?.name
    const dbName = selectedDatabase.value
    if (!connName || !dbName || !objectName) return

    try {
      const result = await dbGetObjectDefinition(connName, dbName, type, objectName)
      objectDefinition.value = result.success
        ? result.ddl || t('无法获取对象定义')
        : result.error || t('加载对象定义失败')
    } catch (error) {
      logError('加载对象定义失败:', error)
      objectDefinition.value = t('加载失败')
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

  async function previewProcedureInQuery(target) {
    if (!target?.connection || !target?.database || !target?.procedure) return

    api.selectConnection(target.connection)
    selectedDatabase.value = target.database

    if (!target.connection.active) {
      await api.connectToDatabase()
    }

    const result = await dbGetObjectDefinition(target.connection.name, target.database, 'procedure', target.procedure)
    if (!result.success) {
      api.showMessage(result.error || t('读取存储过程定义失败'), 'error')
      return
    }

    api.createQueryTab(target.connection.name, target.database, {
      name: t('{p0}（存储过程）', { p0: target.procedure }),
      sqlQuery: result.ddl || '',
      previewKey: `procedure:${target.connection.name}:${target.database}:${target.procedure}`
    })
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
    previewProcedureInQuery,
    clearObjectInfo
  }
}
