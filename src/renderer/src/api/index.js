import { IPC_METHODS, IPC_LISTENERS } from '@shared/ipc'

const bridge = window.electronAPI || {}

export const platform = bridge.platform || 'web'

function createInvoker({ name, channel, fallback }) {
  return async (...args) => {
    const fn = bridge[name]
    if (typeof fn !== 'function') return fallback
    try {
      const result = await fn(...args)
      return result ?? fallback
    } catch (error) {
      console.error(`[ipc] ${channel} failed:`, error)
      return fallback
    }
  }
}

function createSubscriber({ name }) {
  return (callback) => bridge[name]?.(callback) || (() => {})
}

const generated = {}

for (const method of IPC_METHODS) {
  generated[method.name] = createInvoker(method)
}

for (const listener of IPC_LISTENERS) {
  generated[listener.name] = createSubscriber(listener)
}

export const {
  getConfig,
  getPackageInfo,
  saveConfig,
  patchConfig,
  generateScript,
  openFile,
  openFolder,
  selectDirectory,
  selectFile,
  reloadConfig,
  reloadMenu,
  menuAction,
  setAutoStart,
  getAutoStart,
  checkForUpdates,
  getUpdateReleases,
  downloadUpdate,
  cancelUpdateDownload,
  installUpdate,
  openSettings,
  closeSettingsWindow,
  returnToApp,
  navigateMainWindow,
  windowMinimize,
  windowToggleMaximize,
  windowIsMaximized,
  windowIsFullscreen,
  windowClose,
  readDirectory,
  searchDirectory,
  copyToClipboard,
  copyRichText,
  clipboardHistory,
  clipboardCopy,
  clipboardRemove,
  clipboardTogglePin,
  clipboardClear,
  clipboardSetPaused,
  getItemInfo,
  chat,
  chatStream,
  cancelChatStream,
  isChatStreamActive,
  respondChatApproval,
  rollbackChatRun,
  listRunTraces,
  readRunTrace,
  exportRunTrace,
  compressChatContext,
  workspaceInfo,
  workspaceOpen,
  memoryOverview,
  memoryAdd,
  memoryUpdate,
  memoryRemove,
  memoryClear,
  memoryKnowledgeAdd,
  memoryKnowledgeRemove,
  memoryKnowledgeToggle,
  memoryKnowledgeSearch,
  memorySelectFiles,
  validateApiKey,
  getAiProviders,
  getProviderModels,
  dbTestConnection,
  dbCreateConnection,
  dbCloseConnection,
  dbCloseAllConnections,
  dbExecuteQuery,
  dbQueryDatabases,
  dbQueryTables,
  dbGetTableStructure,
  dbGetActiveConnections,
  dbIsConnectionActive,
  dbBeginTransaction,
  dbCommitTransaction,
  dbRollbackTransaction,
  dbExecuteScript,
  dbCancelQuery,
  dbGetTableData,
  dbGetTableCellValue,
  dbGetTableMeta,
  dbInsertRows,
  dbApplyTableChanges,
  dbAlterTable,
  dbPreviewAlterTable,
  dbCreateTable,
  dbCompareSchemas,
  dbQueryObjects,
  dbGetObjectDefinition,
  dbQueryUsers,
  dbGetSessionInfo,
  dbKillSession,
  dbGetErData,
  dbExplainQuery,
  dbQueryServerStatus,
  dbQuerySlowQueries,
  dbQueryDatabaseHealth,
  dbGetUserGrants,
  dbCreateUser,
  dbDropUser,
  dbSetUserPassword,
  dbSetUserPrivileges,
  dbExportTable,
  dbGetBackupTasks,
  dbSaveBackupTask,
  dbDeleteBackupTask,
  dbRunBackupTask,
  dbSelectBackupDirectory,
  dbQueryOperationLog,
  dbClearOperationLog,
  dbSelectImportFile,
  dbSaveExportFile,
  dbSelectConnectionFile,
  dbSaveConnectionFile,
  selectSqlFile,
  readFile,
  saveSqlFile,
  writeFile,
  imageOpenDialog,
  imageOpenFolder,
  imageListDir,
  imageRead,
  imageThumbnail,
  imageAcceptDropped,
  imageHostState,
  imageHostSaveSettings,
  imageHostSelectFiles,
  imageHostUpload,
  imageHostUploadClipboard,
  imageHostTest,
  imageHostClearHistory,
  imageHostRemoveHistory,
  skillsInit,
  skillsList,
  skillsGet,
  skillsExecute,
  skillsInstall,
  skillsUninstall,
  skillsGetToolDefinitions,
  skillsExport,
  skillsImport,
  mcpStatus,
  mcpReload,
  mcpTest,
  mcpRegistryServers,
  networkTest,
  extensionsMarket,
  extensionsInstall,
  extensionsInstallFromFolder,
  extensionsInstallSource,
  extensionsOpenDirectory,
  extensionsDirectory,
  pluginsList,
  pluginsInstallFromFolder,
  pluginsInstallSource,
  pluginsUninstall,
  pluginsOpenDirectory,
  openExternal,
  onChatStreamChunk,
  onChatStreamEnd,
  onChatApprovalRequest,
  onNavigateTo,
  onSettingsTab,
  onShowAbout,
  onUpdateState,
  onConfigChanged,
  onWindowMaximized,
  onWindowFullscreen,
  onClipboardChanged
} = generated

export function getPathForFile(file) {
  try {
    return bridge.getPathForFile?.(file) || ''
  } catch {
    return ''
  }
}

export default bridge
