import { app, nativeTheme } from 'electron'
import { log, initLogger, getIconPath } from './utils'
import { prepareStorageLayout } from './utils/storageLayout'
import { APP_ID } from './constants'
import { loadConfig, startAutoUpdateCheck, promptAutoStartOnFirstLaunch, checkForUpdates } from './services'
import { initClipboardHistory, stopClipboardHistory } from './services/clipboard.js'
import { closeAllSshTunnels } from './services/sshTunnel.js'
import { startBackupScheduler, stopBackupScheduler } from './services/backupScheduler.js'
import { initMcp, stopMcp } from './services/mcp.js'
import { applyNetworkConfig } from './services/network.js'
import { setLocale } from './services/i18n.js'
import { setupIPCHandlers } from './ipc'
import { initWindows, getMainWindow, refreshWindowTheme } from './windows'
import { createTray, destroyTray, createAppMenu } from './ui'

// 配置/数据/缓存/日志按平台规范分目录；目录名固定，不随 app name 变化
const storage = prepareStorageLayout(app)
app.commandLine.appendSwitch('disable-gpu-cache')

if (process.platform === 'linux') {
  app.commandLine.appendSwitch('disable-accelerated-video-decode')
}

process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE') {
    return
  }
  log.error('Uncaught exception:', error)
})

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') {
    return
  }
  log.error('stdout error:', error)
})

process.stderr.on('error', (error) => {
  if (error.code === 'EPIPE') {
    return
  }
  log.error('stderr error:', error)
})

// Windows 任务栏分组/通知需要与安装包一致的 AppUserModelID（开发模式同样生效）
if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

app.on('before-quit', () => {
  app.isQuitting = true
  stopBackupScheduler()
  closeAllSshTunnels()
  stopMcp()
  stopClipboardHistory()
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
  log.info('配置目录:', storage.paths.configDir)
  log.info('数据目录:', storage.paths.dataDir)
  log.info('缓存目录:', storage.paths.cacheDir)
  log.info('日志目录:', storage.paths.logsDir)
  if (storage.actions.length) log.info(`存储布局迁移完成，共 ${storage.actions.length} 项`)
  for (const warning of storage.warnings) log.warn(warning)

  const shouldHide = process.argv.includes('--hidden')
  log.info('启动模式:', shouldHide ? '隐藏' : '正常')

  const loadedConfig = await loadConfig()
  if (!loadedConfig) {
    log.error('配置加载失败')
    return
  }

  setLocale(loadedConfig.appearance?.language)
  nativeTheme.themeSource = loadedConfig.appearance?.theme || 'system'
  nativeTheme.on('updated', refreshWindowTheme)

  try {
    await applyNetworkConfig(loadedConfig)
  } catch (error) {
    log.warn('应用网络配置失败:', error.message)
  }

  // 开发模式下 macOS 的 Dock 图标是 Electron 默认图标，需要手动替换；打包后由 .icns 提供
  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    const devIcon = getIconPath()
    if (devIcon) app.dock.setIcon(devIcon)
  }

  setupIPCHandlers()
  await initClipboardHistory()
  startBackupScheduler()

  initMcp().catch((error) => log.warn('初始化 MCP 服务失败:', error.message))

  const { mainWindow, createSettingsWindow } = initWindows()
  createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
  createTray(mainWindow, checkForUpdates, createSettingsWindow)
  startAutoUpdateCheck(mainWindow)

  setTimeout(() => promptAutoStartOnFirstLaunch(getMainWindow()), 1000)

  log.info('应用启动完成')
})

app.on('window-all-closed', () => {
  if (!app.isQuitting) app.quit()
})

app.on('activate', () => {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.show()
    if (win.isMinimized()) win.restore()
  }
})
