import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getPackageInfo: () => ipcRenderer.invoke('get-package-info'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  generateScript: (scriptInfo) => ipcRenderer.invoke('generate-script', scriptInfo),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  selectFile: () => ipcRenderer.invoke('select-file'),
  reloadConfig: () => ipcRenderer.invoke('reload-config'),
  reloadMenu: () => ipcRenderer.invoke('reload-menu'),
  setAutoStart: (enable) => ipcRenderer.invoke('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  checkForUpdates: (manual) => ipcRenderer.invoke('check-for-updates', manual),
  openSettings: (tab) => ipcRenderer.invoke('open-settings', tab),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),
  readDirectory: (dirPath) => ipcRenderer.invoke('read-directory', dirPath),
  copyToClipboard: (itemPath, recursive) => ipcRenderer.invoke('copy-to-clipboard', itemPath, recursive),
  getItemInfo: (itemPath) => ipcRenderer.invoke('get-item-info', itemPath),
  chat: (messages, options) => ipcRenderer.invoke('chat', messages, options),
  chatStream: (messages, options) => ipcRenderer.invoke('chat-stream', messages, options),
  onChatStreamChunk: (callback) => {
    const listener = (_event, chunk) => callback(chunk)
    ipcRenderer.on('chat-stream-chunk', listener)
    return () => ipcRenderer.removeListener('chat-stream-chunk', listener)
  },
  onChatStreamEnd: (callback) => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('chat-stream-end', listener)
    return () => ipcRenderer.removeListener('chat-stream-end', listener)
  },
  validateApiKey: (providerType, apiKey, extraConfig) => ipcRenderer.invoke('validate-api-key', providerType, apiKey, extraConfig),
  getAiProviders: () => ipcRenderer.invoke('get-ai-providers'),
  getProviderModels: (providerType) => ipcRenderer.invoke('get-provider-models', providerType),
  
  // Database connection APIs
  dbTestConnection: (config) => ipcRenderer.invoke('db-test-connection', config),
  dbCreateConnection: (name, config) => ipcRenderer.invoke('db-create-connection', name, config),
  dbCloseConnection: (name) => ipcRenderer.invoke('db-close-connection', name),
  dbCloseAllConnections: () => ipcRenderer.invoke('db-close-all-connections'),
  dbExecuteQuery: (name, sql, params, options) => ipcRenderer.invoke('db-execute-query', name, sql, params, options),
  dbQueryDatabases: (name) => ipcRenderer.invoke('db-query-databases', name),
  dbQueryTables: (name, database) => ipcRenderer.invoke('db-query-tables', name, database),
  dbGetTableStructure: (name, database, tableName) => ipcRenderer.invoke('db-get-table-structure', name, database, tableName),
  dbGetActiveConnections: () => ipcRenderer.invoke('db-get-active-connections'),
  dbIsConnectionActive: (name) => ipcRenderer.invoke('db-is-connection-active', name),
  dbBeginTransaction: (name) => ipcRenderer.invoke('db-begin-transaction', name),
  dbCommitTransaction: (name) => ipcRenderer.invoke('db-commit-transaction', name),
  dbRollbackTransaction: (name) => ipcRenderer.invoke('db-rollback-transaction', name),
  
  selectSqlFile: () => ipcRenderer.invoke('select-sql-file'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  saveSqlFile: (defaultPath) => ipcRenderer.invoke('save-sql-file', defaultPath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  
  // Skills APIs
  skillsInit: () => ipcRenderer.invoke('skills-init'),
  skillsList: () => ipcRenderer.invoke('skills-list'),
  skillsGet: (name) => ipcRenderer.invoke('skills-get', name),
  skillsExecute: (name, params) => ipcRenderer.invoke('skills-execute', name, params),
  skillsInstall: (skillPath) => ipcRenderer.invoke('skills-install', skillPath),
  skillsUninstall: (name) => ipcRenderer.invoke('skills-uninstall', name),
  skillsGetToolDefinitions: () => ipcRenderer.invoke('skills-get-tool-definitions'),
  
  onNavigateTo: (callback) => {
    const listener = (_event, path) => callback(path)
    ipcRenderer.on('navigate-to', listener)
    return () => ipcRenderer.removeListener('navigate-to', listener)
  },
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },
  onUpdateProgress: (callback) => {
    const listener = (_event, progress) => callback(progress)
    ipcRenderer.on('update-progress', listener)
    return () => ipcRenderer.removeListener('update-progress', listener)
  },
  onConfigChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('config-changed', listener)
    return () => ipcRenderer.removeListener('config-changed', listener)
  }
})