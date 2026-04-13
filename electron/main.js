const { app, BrowserWindow, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const log = require('electron-log')

const { loadConfig, getConfig } = require('./config')
const { setupIPCHandlers } = require('./ipc')
const { createTray, destroyTray, getIconPath } = require('./tray')
const { checkForUpdates, startAutoUpdateCheck } = require('./updater')
const { promptAutoStartOnFirstLaunch } = require('./autostart')
const { createAppMenu } = require('./menu')

const logDir = path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd(), 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}
log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log')
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

log.info('========================================')
log.info('应用启动')
log.info('========================================')

let mainWindow = null
let settingsWindow = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  const iconPath = getIconPath()
  
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    backgroundColor: '#667eea',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'SQL Script Generator',
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    log.info('主窗口已显示')
    
    setTimeout(() => promptAutoStartOnFirstLaunch(mainWindow), 1000)
  })

  mainWindow.on('close', async (event) => {
    if (app.isQuitting) return
    event.preventDefault()

    const config = getConfig()

    if (config.close_action === 'hide') {
      mainWindow.hide()
      log.info('主窗口已隐藏到系统托盘')
    } else if (config.close_action === 'quit') {
      app.isQuitting = true
      app.quit()
      log.info('应用已退出')
    } else {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: '关闭确认',
        message: '是否隐藏到系统托盘？',
        detail: '选择"隐藏"后，应用将在后台运行。\n选择"退出"将完全关闭应用。',
        buttons: ['隐藏', '退出'],
        defaultId: 0,
        cancelId: 1,
        checkboxLabel: '记住我的选择',
        checkboxChecked: false,
      })

      if (result.response === 0) {
        mainWindow.hide()
        log.info('主窗口已隐藏')
      } else {
        app.isQuitting = true
        app.quit()
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return settingsWindow
  }

  const iconPath = getIconPath()
  
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: false,
    maximizable: false,
    minimizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#667eea',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '设置 - SQL Script Generator',
  })

  settingsWindow.setMenu(null)

  if (VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(VITE_DEV_SERVER_URL + '#/settings')
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
    log.info('设置窗口已关闭')
  })

  log.info('设置窗口已创建')
  return settingsWindow
}

function getMainWindow() {
  return mainWindow
}

function getSettingsWindow() {
  return settingsWindow
}

app.on('before-quit', () => {
  app.isQuitting = true
  destroyTray()
})

app.whenReady().then(async () => {
  const shouldHide = process.argv.includes('--hidden')
  log.info('启动模式:', shouldHide ? '隐藏' : '正常')

  const loadedConfig = await loadConfig()
  if (!loadedConfig) {
    log.error('配置加载失败')
    return
  }

  setupIPCHandlers(getMainWindow, checkForUpdates, createSettingsWindow, getSettingsWindow, createAppMenu)
  
  createWindow()
  createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
  createTray(mainWindow, checkForUpdates, createSettingsWindow)
  startAutoUpdateCheck(mainWindow)

  log.info('应用启动完成')
})

app.on('window-all-closed', () => {
})