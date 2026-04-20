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
  validateApiKey: (providerType, apiKey, extraConfig) => ipcRenderer.invoke('validate-api-key', providerType, apiKey, extraConfig),
  getAiProviders: () => ipcRenderer.invoke('get-ai-providers'),
  getProviderModels: (providerType) => ipcRenderer.invoke('get-provider-models', providerType),
  
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
  },
})