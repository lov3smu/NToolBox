import { app } from 'electron'
import { log, initLogger } from './utils'
import { loadConfig, startAutoUpdateCheck, promptAutoStartOnFirstLaunch, checkForUpdates } from './services'
import { setupIPCHandlers } from './ipc'
import { initWindows, getMainWindow } from './windows'
import { createTray, destroyTray, createAppMenu } from './ui'

app.on('before-quit', () => {
  app.isQuitting = true
  destroyTray()
})

app.whenReady().then(async () => {
  try {
    await initLogger()
  } catch (e) {
    console.error('初始化日志失败:', e)
  }
  
  log.info('========================================')
  log.info('应用启动')
  log.info('========================================')

  const shouldHide = process.argv.includes('--hidden')
  log.info('启动模式:', shouldHide ? '隐藏' : '正常')

  const loadedConfig = await loadConfig()
  if (!loadedConfig) {
    log.error('配置加载失败')
    return
  }

  setupIPCHandlers()
  
  const { mainWindow, createSettingsWindow } = initWindows()
  createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
  createTray(mainWindow, checkForUpdates, createSettingsWindow)
  startAutoUpdateCheck(mainWindow)

  setTimeout(() => promptAutoStartOnFirstLaunch(getMainWindow()), 1000)

  log.info('应用启动完成')
})

app.on('window-all-closed', () => {
})