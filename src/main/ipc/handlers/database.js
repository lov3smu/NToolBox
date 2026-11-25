import { dialog } from 'electron'
import fs from 'fs'
import { t } from '../../services/i18n.js'
import { getConfig } from '../../services/config.js'
import {
  testConnection,
  createConnection,
  closeConnection,
  closeAllConnections,
  executeQuery,
  queryDatabases,
  queryTables,
  getTableStructure,
  getConnectionInfo,
  getDatabaseInfo,
  getTableDetails,
  getTableInfo,
  getActiveConnections,
  isConnectionActive,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  executeScript,
  cancelQuery,
  getTableData,
  getTableCellValue,
  getTableMeta,
  insertRows,
  applyTableChanges,
  alterTable,
  previewAlterTable,
  createTable,
  compareSchemas,
  queryObjects,
  getObjectDefinition,
  queryUsers,
  getSessionInfo,
  killSession,
  getErData,
  explainQuery,
  queryServerStatus,
  querySlowQueries,
  queryDatabaseHealth,
  getUserGrants,
  createDatabaseUser,
  dropDatabaseUser,
  setDatabaseUserPassword,
  setDatabaseUserPrivileges,
  exportTableData
} from '../../services/database/index.js'
import {
  getBackupTasks,
  saveBackupTask,
  deleteBackupTask,
  runBackupTaskNow
} from '../../services/database/backupScheduler.js'
import { queryDbOperationLog, clearDbOperationLog } from '../../services/database/dbAuditLog.js'
import {
  addDbQueryHistory,
  addDbSnippetFolder,
  clearDbQueryHistory,
  importDbQueryHistory,
  importDbSnippetFolders,
  importDbSnippets,
  listDbQueryHistory,
  listDbSnippetFolders,
  listDbSnippets,
  pruneDbQueryHistory,
  removeDbQueryHistory,
  removeDbSnippet,
  saveDbSnippet
} from '../../services/sqlite/dbToolsRepository.js'
import { IPC_CHANNELS } from '../../../shared/ipc'
import { getDialogParentWindow } from './common'

const MAX_IMPORT_SIZE = 50 * 1024 * 1024

export function registerDatabaseHandlers(handle) {
  handle(IPC_CHANNELS.dbTestConnection, async (_event, config) => {
    return await testConnection(config)
  })

  handle(IPC_CHANNELS.dbCreateConnection, async (_event, name, config) => {
    return await createConnection(name, config)
  })

  handle(IPC_CHANNELS.dbCloseConnection, async (_event, name) => {
    return await closeConnection(name)
  })

  handle(IPC_CHANNELS.dbCloseAllConnections, async () => {
    return await closeAllConnections()
  })

  handle(IPC_CHANNELS.dbExecuteQuery, async (_event, name, sql, params, options) => {
    return await executeQuery(name, sql, params, options)
  })

  handle(IPC_CHANNELS.dbQueryDatabases, async (_event, name) => {
    return await queryDatabases(name)
  })

  handle(IPC_CHANNELS.dbQueryTables, async (_event, name, database) => {
    return await queryTables(name, database)
  })

  handle(IPC_CHANNELS.dbGetTableStructure, async (_event, name, database, tableName) => {
    return await getTableStructure(name, database, tableName)
  })

  handle(IPC_CHANNELS.dbGetConnectionInfo, async (_event, name) => {
    return await getConnectionInfo(name)
  })

  handle(IPC_CHANNELS.dbGetDatabaseInfo, async (_event, name, database) => {
    return await getDatabaseInfo(name, database)
  })

  handle(IPC_CHANNELS.dbGetTableDetails, async (_event, name, database) => {
    return await getTableDetails(name, database)
  })

  handle(IPC_CHANNELS.dbGetTableInfo, async (_event, name, database, tableName) => {
    return await getTableInfo(name, database, tableName)
  })

  handle(IPC_CHANNELS.dbGetActiveConnections, async () => {
    return getActiveConnections()
  })

  handle(IPC_CHANNELS.dbIsConnectionActive, async (_event, name) => {
    return isConnectionActive(name)
  })

  handle(IPC_CHANNELS.dbBeginTransaction, async (_event, name, database) => {
    return await beginTransaction(name, database)
  })

  handle(IPC_CHANNELS.dbCommitTransaction, async (_event, name) => {
    return await commitTransaction(name)
  })

  handle(IPC_CHANNELS.dbRollbackTransaction, async (_event, name) => {
    return await rollbackTransaction(name)
  })

  handle(IPC_CHANNELS.dbExecuteScript, async (_event, name, sql, options) => {
    return await executeScript(name, sql, options)
  })

  handle(IPC_CHANNELS.dbCancelQuery, async (_event, name, requestId) => {
    return await cancelQuery(name, requestId)
  })

  handle(IPC_CHANNELS.dbGetTableData, async (_event, name, database, tableName, options) => {
    return await getTableData(name, database, tableName, options)
  })

  handle(IPC_CHANNELS.dbGetTableCellValue, async (_event, name, database, tableName, columnName, keys, options) => {
    return await getTableCellValue(name, database, tableName, columnName, keys, options)
  })

  handle(IPC_CHANNELS.dbGetTableMeta, async (_event, name, database, tableName) => {
    return await getTableMeta(name, database, tableName)
  })

  handle(IPC_CHANNELS.dbInsertRows, async (_event, name, database, tableName, rows, options) => {
    return await insertRows(name, database, tableName, rows, options)
  })

  handle(IPC_CHANNELS.dbApplyTableChanges, async (_event, name, database, tableName, changes) => {
    return await applyTableChanges(name, database, tableName, changes)
  })

  handle(IPC_CHANNELS.dbAlterTable, async (_event, name, database, tableName, operations) => {
    return await alterTable(name, database, tableName, operations)
  })

  handle(IPC_CHANNELS.dbPreviewAlterTable, async (_event, name, database, tableName, operations) => {
    return await previewAlterTable(name, database, tableName, operations)
  })

  handle(IPC_CHANNELS.dbCreateTable, async (_event, name, database, tableName, options) => {
    return await createTable(name, database, tableName, options)
  })

  handle(IPC_CHANNELS.dbCompareSchemas, async (_event, name, baseDatabase, targetName, targetDatabase) => {
    return await compareSchemas(name, baseDatabase, targetName, targetDatabase)
  })

  handle(IPC_CHANNELS.dbQueryObjects, async (_event, name, database, keyword) => {
    return await queryObjects(name, database, keyword)
  })

  handle(IPC_CHANNELS.dbGetObjectDefinition, async (_event, name, database, type, objectName) => {
    return await getObjectDefinition(name, database, type, objectName)
  })

  handle(IPC_CHANNELS.dbQueryUsers, async (_event, name) => {
    return await queryUsers(name)
  })

  handle(IPC_CHANNELS.dbGetSessionInfo, async (_event, name) => {
    return await getSessionInfo(name)
  })

  handle(IPC_CHANNELS.dbKillSession, async (_event, name, threadId, mode) => {
    return await killSession(name, threadId, mode)
  })

  handle(IPC_CHANNELS.dbGetErData, async (_event, name, database, limit) => {
    return await getErData(name, database, limit)
  })

  handle(IPC_CHANNELS.dbExplainQuery, async (_event, name, database, sql) => {
    return await explainQuery(name, database, sql)
  })

  handle(IPC_CHANNELS.dbQueryServerStatus, async (_event, name) => {
    return await queryServerStatus(name)
  })

  handle(IPC_CHANNELS.dbQuerySlowQueries, async (_event, name, database, limit) => {
    return await querySlowQueries(name, database, limit)
  })

  handle(IPC_CHANNELS.dbQueryDatabaseHealth, async (_event, name, database) => {
    return await queryDatabaseHealth(name, database)
  })

  handle(IPC_CHANNELS.dbGetUserGrants, async (_event, name, user, host) => {
    return await getUserGrants(name, user, host)
  })

  handle(IPC_CHANNELS.dbCreateUser, async (_event, name, user, host, password) => {
    return await createDatabaseUser(name, user, host, password)
  })

  handle(IPC_CHANNELS.dbDropUser, async (_event, name, user, host) => {
    return await dropDatabaseUser(name, user, host)
  })

  handle(IPC_CHANNELS.dbSetUserPassword, async (_event, name, user, host, password) => {
    return await setDatabaseUserPassword(name, user, host, password)
  })

  handle(IPC_CHANNELS.dbSetUserPrivileges, async (_event, name, action, user, host, privileges, database, table) => {
    return await setDatabaseUserPrivileges(name, action, user, host, privileges, database, table)
  })

  handle(IPC_CHANNELS.dbExportTable, async (_event, name, database, tableName, options) => {
    return await exportTableData(name, database, tableName, options)
  })

  handle(IPC_CHANNELS.dbGetBackupTasks, async () => {
    return getBackupTasks()
  })

  handle(IPC_CHANNELS.dbSaveBackupTask, async (_event, task) => {
    return await saveBackupTask(task)
  })

  handle(IPC_CHANNELS.dbDeleteBackupTask, async (_event, id) => {
    return await deleteBackupTask(id)
  })

  handle(IPC_CHANNELS.dbRunBackupTask, async (_event, id) => {
    return await runBackupTaskNow(id)
  })

  handle(IPC_CHANNELS.dbSelectBackupDirectory, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('选择备份目录'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }
    return { canceled: false, directory: result.filePaths[0] }
  })

  handle(IPC_CHANNELS.dbQueryOperationLog, async (_event, options) => {
    return await queryDbOperationLog(options)
  })

  handle(IPC_CHANNELS.dbClearOperationLog, async () => {
    return await clearDbOperationLog()
  })

  handle(IPC_CHANNELS.dbSelectImportFile, async (_event, format) => {
    const parentWindow = getDialogParentWindow()
    const filters =
      format === 'json'
        ? [{ name: t('JSON 文件'), extensions: ['json'] }]
        : [{ name: t('CSV 文件'), extensions: ['csv'] }]
    filters.push({ name: t('所有文件'), extensions: ['*'] })

    const result = await dialog.showOpenDialog(parentWindow, {
      title: t('选择导入文件'),
      filters,
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const stat = await fs.promises.stat(filePath)
    if (stat.size > MAX_IMPORT_SIZE) {
      return { canceled: false, error: '文件超过 50MB，请拆分后再导入' }
    }

    const content = await fs.promises.readFile(filePath, 'utf-8')
    return { canceled: false, filePath, content, size: stat.size }
  })

  handle(IPC_CHANNELS.dbSelectSqliteFile, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('选择 SQLite 数据库文件'),
      filters: [
        { name: t('SQLite 数据库'), extensions: ['sqlite', 'sqlite3', 'db', 'db3'] },
        { name: t('所有文件'), extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }
    return { canceled: false, filePath: result.filePaths[0] }
  })

  handle(IPC_CHANNELS.dbSaveExportFile, async (_event, defaultName, content, format) => {
    const parentWindow = getDialogParentWindow()
    const extensionMap = { csv: 'csv', json: 'json', sql: 'sql', markdown: 'md', md: 'md' }
    const extension = extensionMap[format] || 'txt'
    const filters = [
      { name: t('{ext} 文件', { ext: extension.toUpperCase() }), extensions: [extension] },
      { name: t('所有文件'), extensions: ['*'] }
    ]

    const result = await dialog.showSaveDialog(parentWindow, {
      title: t('导出数据'),
      defaultPath: defaultName || `export.${extension}`,
      filters
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await fs.promises.writeFile(result.filePath, String(content ?? ''), 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  handle(IPC_CHANNELS.dbSelectConnectionFile, async () => {
    const parentWindow = getDialogParentWindow()
    const result = await dialog.showOpenDialog(parentWindow, {
      title: t('导入连接配置'),
      filters: [
        { name: t('JSON 文件'), extensions: ['json'] },
        { name: t('所有文件'), extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const content = await fs.promises.readFile(result.filePaths[0], 'utf-8')
    return { canceled: false, filePath: result.filePaths[0], content }
  })

  handle(IPC_CHANNELS.dbSaveConnectionFile, async (_event, defaultName, content) => {
    const parentWindow = getDialogParentWindow()
    const result = await dialog.showSaveDialog(parentWindow, {
      title: t('导出连接配置'),
      defaultPath: defaultName || 'connections.json',
      filters: [
        { name: t('JSON 文件'), extensions: ['json'] },
        { name: t('所有文件'), extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await fs.promises.writeFile(result.filePath, String(content ?? ''), 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  function dbHistoryLimit(options = {}) {
    const configured = Number(getConfig().database?.history_limit)
    const value = Number(options.historyLimit) || configured || 200
    return Math.min(200, Math.max(1, Math.floor(value)))
  }

  handle(IPC_CHANNELS.dbToolsState, async (_event, options = {}) => {
    const limit = dbHistoryLimit(options)
    const legacy = options.legacy || {}
    if (Array.isArray(legacy.history) && legacy.history.length) {
      await importDbQueryHistory(legacy.history.slice(0, limit), limit)
    }
    if (Array.isArray(legacy.snippets) && legacy.snippets.length) {
      await importDbSnippets(legacy.snippets)
    }
    if (Array.isArray(legacy.folders) && legacy.folders.length) {
      await importDbSnippetFolders(legacy.folders)
    }
    await pruneDbQueryHistory(limit)
    const [history, snippets, folders] = await Promise.all([
      listDbQueryHistory({ limit: 50, offset: options.offset }),
      listDbSnippets(),
      listDbSnippetFolders()
    ])
    return { history, snippets, folders }
  })

  handle(IPC_CHANNELS.dbHistoryAdd, async (_event, entry, options = {}) => {
    const saved = await addDbQueryHistory(entry, dbHistoryLimit(options))
    return { success: saved }
  })

  handle(IPC_CHANNELS.dbHistoryRemove, async (_event, id) => {
    return { success: await removeDbQueryHistory(id) }
  })

  handle(IPC_CHANNELS.dbHistoryClear, async () => {
    return { success: await clearDbQueryHistory() }
  })

  handle(IPC_CHANNELS.dbHistoryImport, async (_event, records, options = {}) => {
    const imported = await importDbQueryHistory(records, dbHistoryLimit(options))
    return { success: true, imported }
  })

  handle(IPC_CHANNELS.dbSnippetSave, async (_event, snippet) => {
    return { success: await saveDbSnippet(snippet) }
  })

  handle(IPC_CHANNELS.dbSnippetRemove, async (_event, id) => {
    return { success: await removeDbSnippet(id) }
  })

  handle(IPC_CHANNELS.dbSnippetFolderAdd, async (_event, name) => {
    return { success: await addDbSnippetFolder(name) }
  })
}
