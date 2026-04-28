const api = window.electronAPI || {}

function safeApiCall(fn, fallback) {
  return async (...args) => {
    try {
      if (!fn) return fallback
      const result = await fn(...args)
      return result ?? fallback
    } catch (error) {
      console.error('API call failed:', error)
      return fallback
    }
  }
}

export const getConfig = safeApiCall(api.getConfig, {})
export const getPackageInfo = safeApiCall(api.getPackageInfo, {})
export const saveConfig = safeApiCall(api.saveConfig, false)
export const generateScript = safeApiCall(api.generateScript, { success: false, error: 'API not available' })
export const openFile = safeApiCall(api.openFile, false)
export const openFolder = safeApiCall(api.openFolder, false)
export const selectDirectory = safeApiCall(api.selectDirectory, '')
export const selectFile = safeApiCall(api.selectFile, '')
export const reloadConfig = safeApiCall(api.reloadConfig, {})
export const reloadMenu = safeApiCall(api.reloadMenu, false)
export const setAutoStart = safeApiCall(api.setAutoStart, false)
export const getAutoStart = safeApiCall(api.getAutoStart, false)
export const checkForUpdates = safeApiCall(api.checkForUpdates, { status: 'dev-environment' })
export const openSettings = safeApiCall(api.openSettings, true)
export const closeSettingsWindow = safeApiCall(api.closeSettingsWindow, undefined)
export const readDirectory = safeApiCall(api.readDirectory, { success: false, error: 'API not available' })
export const copyToClipboard = safeApiCall(api.copyToClipboard, false)
export const getItemInfo = safeApiCall(api.getItemInfo, { success: false, error: 'API not available' })
export const chat = safeApiCall(api.chat, { success: false, error: 'API not available' })
export const chatStream = safeApiCall(api.chatStream, { success: false, error: 'API not available' })
export const onChatStreamChunk = (callback) => api.onChatStreamChunk?.(callback) || (() => {})
export const onChatStreamEnd = (callback) => api.onChatStreamEnd?.(callback) || (() => {})
export const validateApiKey = safeApiCall(api.validateApiKey, false)
export const getAiProviders = safeApiCall(api.getAiProviders, [])
export const getProviderModels = safeApiCall(api.getProviderModels, [])

export const dbTestConnection = safeApiCall(api.dbTestConnection, { success: false, error: 'API not available' })
export const dbCreateConnection = safeApiCall(api.dbCreateConnection, { success: false, error: 'API not available' })
export const dbCloseConnection = safeApiCall(api.dbCloseConnection, { success: false, error: 'API not available' })
export const dbCloseAllConnections = safeApiCall(api.dbCloseAllConnections, { success: false, error: 'API not available' })
export const dbExecuteQuery = safeApiCall(api.dbExecuteQuery, { success: false, error: 'API not available' })
export const dbQueryDatabases = safeApiCall(api.dbQueryDatabases, { success: false, error: 'API not available' })
export const dbQueryTables = safeApiCall(api.dbQueryTables, { success: false, error: 'API not available' })
export const dbGetTableStructure = safeApiCall(api.dbGetTableStructure, { success: false, error: 'API not available' })
export const dbGetActiveConnections = safeApiCall(api.dbGetActiveConnections, [])
export const dbIsConnectionActive = safeApiCall(api.dbIsConnectionActive, false)
export const dbBeginTransaction = safeApiCall(api.dbBeginTransaction, { success: false, error: 'API not available' })
export const dbCommitTransaction = safeApiCall(api.dbCommitTransaction, { success: false, error: 'API not available' })
export const dbRollbackTransaction = safeApiCall(api.dbRollbackTransaction, { success: false, error: 'API not available' })

export const selectSqlFile = safeApiCall(api.selectSqlFile, { canceled: true })
export const readFile = safeApiCall(api.readFile, { success: false, error: 'API not available' })
export const saveSqlFile = safeApiCall(api.saveSqlFile, { canceled: true })
export const writeFile = safeApiCall(api.writeFile, { success: false, error: 'API not available' })

export const onNavigateTo = (callback) => api.onNavigateTo?.(callback) || (() => {})
export const onUpdateStatus = (callback) => api.onUpdateStatus?.(callback) || (() => {})
export const onUpdateProgress = (callback) => api.onUpdateProgress?.(callback) || (() => {})
export const onConfigChanged = (callback) => api.onConfigChanged?.(callback) || (() => {})

export default api