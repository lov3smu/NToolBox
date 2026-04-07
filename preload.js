const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    generateScript: (scriptInfo) => ipcRenderer.invoke('generate-script', scriptInfo),
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
    openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    selectFile: () => ipcRenderer.invoke('select-file'),
    reloadConfig: () => ipcRenderer.invoke('reload-config')
});