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
  downloadUpdate,
  cancelUpdateDownload,
  installUpdate,
  openSettings,
  closeSettingsWindow,
  returnToApp,
  windowMinimize,
  windowToggleMaximize,
  windowIsMaximized,
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
  compressChatContext,
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
  dbGetTableMeta,
  dbInsertRows,
  dbApplyTableChanges,
  dbAlterTable,
  dbQueryObjects,
  dbGetObjectDefinition,
  dbQueryUsers,
  dbGetErData,
  dbExplainQuery,
  dbExportTable,
  dbSelectImportFile,
  dbSaveExportFile,
  dbSelectConnectionFile,
  dbSaveConnectionFile,
  selectSqlFile,
  readFile,
  saveSqlFile,
  writeFile,
  skillsInit,
  skillsList,
  skillsGet,
  skillsExecute,
  skillsInstall,
  skillsUninstall,
  skillsGetToolDefinitions,
  extensionsMarket,
  extensionsInstall,
  extensionsInstallFromFolder,
  extensionsOpenDirectory,
  extensionsDirectory,
  openExternal,
  onChatStreamChunk,
  onChatStreamEnd,
  onNavigateTo,
  onSettingsTab,
  onShowAbout,
  onUpdateState,
  onConfigChanged,
  onWindowMaximized,
  onClipboardChanged
} = generated

export default bridge
