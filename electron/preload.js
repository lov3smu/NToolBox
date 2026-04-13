const { contextBridge, ipcRenderer } = require('electron')

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
  openSettings: () => ipcRenderer.invoke('open-settings'),
  closeSettingsWindow: () => ipcRenderer.invoke('close-settings-window'),
  
  onNavigateTo: (callback) => ipcRenderer.on('navigate-to', (_event, path) => callback(path)),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, status) => callback(status)),
  onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_event, progress) => callback(progress)),
  onConfigChanged: (callback) => ipcRenderer.on('config-changed', () => callback()),
})