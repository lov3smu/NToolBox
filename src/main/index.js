import { app, nativeTheme } from 'electron'
import path from 'path'
import fs from 'fs'
import { log, initLogger, getIconPath } from './utils'
import { APP_ID } from './constants'
import { loadConfig, startAutoUpdateCheck, promptAutoStartOnFirstLaunch, checkForUpdates } from './services'
import { initClipboardHistory, stopClipboardHistory } from './services/clipboard.js'
import { setupIPCHandlers } from './ipc'
import { initWindows, getMainWindow, refreshWindowTheme } from './windows'
import { createTray, destroyTray, createAppMenu } from './ui'

// 应用名改为 NToolBox 后 userData 目录会跟着变化；
// 开发模式下固定回原路径，避免已有的数据库加密密钥失效
if (!app.isPackaged) {
  const devUserData = path.join(app.getPath('appData'), 'ntoolbox')
  fs.mkdirSync(devUserData, { recursive: true })
  app.setPath('userData', devUserData)
}

const cacheDir = path.join(app.getPath('userData'), 'cache')
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true })
}
app.commandLine.appendSwitch('disk-cache-dir', cacheDir)
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

  const shouldHide = process.argv.includes('--hidden')
  log.info('启动模式:', shouldHide ? '隐藏' : '正常')

  const loadedConfig = await loadConfig()
  if (!loadedConfig) {
    log.error('配置加载失败')
    return
  }

  nativeTheme.themeSource = loadedConfig.theme || 'system'
  nativeTheme.on('updated', refreshWindowTheme)

  // 开发模式下 macOS 的 Dock 图标是 Electron 默认图标，需要手动替换；打包后由 .icns 提供
  if (process.platform === 'darwin' && !app.isPackaged && app.dock) {
    const devIcon = getIconPath()
    if (devIcon) app.dock.setIcon(devIcon)
  }

  setupIPCHandlers()
  await initClipboardHistory()

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
