const { ipcMain, dialog } = require('electron')
const log = require('electron-log')
const { getConfig, saveConfig, loadConfig } = require('./config')
const { generateSQLFile, openFile, openFolder } = require('./generator')
const { setAutoStart, getAutoStart } = require('./autostart')
const { isPathWithinBase } = require('./common/sanitize')

const packageJson = require('../package.json')

function setupIPCHandlers(getMainWindow, checkForUpdatesFn, createSettingsWindowFn, getSettingsWindowFn, createAppMenuFn) {
  ipcMain.handle('get-config', async () => getConfig())

  ipcMain.handle('get-package-info', async () => ({
    version: packageJson.version,
    author: packageJson.author,
    name: packageJson.name,
    description: packageJson.description,
  }))

  ipcMain.handle('save-config', async (_event, newConfig) => await saveConfig(newConfig))

  ipcMain.handle('generate-script', async (_event, scriptInfo) => await generateSQLFile(scriptInfo))

  ipcMain.handle('open-file', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return false
    const config = getConfig()
    if (config.base_path && !isPathWithinBase(filePath, config.base_path)) {
      log.warn('拒绝打开 base_path 外的文件:', filePath)
      return false
    }
    return await openFile(filePath, config.text_edit_app)
  })

  ipcMain.handle('open-folder', async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') return false
    const config = getConfig()
    if (config.base_path && !isPathWithinBase(folderPath, config.base_path)) {
      log.warn('拒绝打开 base_path 外的文件夹:', folderPath)
      return false
    }
    return await openFolder(folderPath)
  })

  ipcMain.handle('select-directory', async () => {
    const mainWindow = getMainWindow()
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    return result.filePaths[0] || ''
  })

  ipcMain.handle('select-file', async () => {
    const mainWindow = getMainWindow()
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '可执行文件', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    return result.filePaths[0] || ''
  })

  ipcMain.handle('reload-config', async () => await loadConfig())

  ipcMain.handle('set-auto-start', async (_event, enable) => await setAutoStart(enable))
  ipcMain.handle('get-auto-start', async () => await getAutoStart())

  ipcMain.handle('check-for-updates', async (_event, manual) => {
    const mainWindow = getMainWindow()
    return await checkForUpdatesFn(manual, mainWindow)
  })

  ipcMain.handle('open-settings', async () => {
    createSettingsWindowFn()
    return true
  })

  ipcMain.handle('close-settings-window', async () => {
    const win = getSettingsWindowFn()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  ipcMain.handle('reload-menu', async () => {
    const mainWindow = getMainWindow()
    if (mainWindow && createAppMenuFn) {
      createAppMenuFn(mainWindow, checkForUpdatesFn, createSettingsWindowFn)
      return true
    }
    return false
  })
}

module.exports = { setupIPCHandlers }