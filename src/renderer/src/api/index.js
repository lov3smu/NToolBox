const api = window.electronAPI || {}

export const getConfig = () => api.getConfig?.() || Promise.resolve({})
export const getPackageInfo = () => api.getPackageInfo?.() || Promise.resolve({})
export const saveConfig = (config) => api.saveConfig?.(config) || Promise.resolve(false)
export const generateScript = (scriptInfo) => api.generateScript?.(scriptInfo) || Promise.resolve({ success: false, error: 'API not available' })
export const openFile = (filePath) => api.openFile?.(filePath) || Promise.resolve(false)
export const openFolder = (folderPath) => api.openFolder?.(folderPath) || Promise.resolve(false)
export const selectDirectory = () => api.selectDirectory?.() || Promise.resolve('')
export const selectFile = () => api.selectFile?.() || Promise.resolve('')
export const reloadConfig = () => api.reloadConfig?.() || Promise.resolve({})
export const reloadMenu = () => api.reloadMenu?.() || Promise.resolve(false)
export const setAutoStart = (enable) => api.setAutoStart?.(enable) || Promise.resolve(false)
export const getAutoStart = () => api.getAutoStart?.() || Promise.resolve(false)
export const checkForUpdates = (manual) => api.checkForUpdates?.(manual) || Promise.resolve({ status: 'dev-environment' })
export const openSettings = () => api.openSettings?.() || Promise.resolve(true)
export const closeSettingsWindow = () => api.closeSettingsWindow?.() || Promise.resolve()

export const onNavigateTo = (callback) => api.onNavigateTo?.(callback)
export const onUpdateStatus = (callback) => api.onUpdateStatus?.(callback)
export const onUpdateProgress = (callback) => api.onUpdateProgress?.(callback)
export const onConfigChanged = (callback) => api.onConfigChanged?.(callback)

export default api