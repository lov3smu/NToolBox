import { BrowserWindow, dialog, app } from 'electron'
import path from 'path'
import { log, getIconPath } from '../utils'
import { getConfig } from '../services'

let mainWindow = null
let settingsWindow = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const devServerUrl = 'http://localhost:5173'
const preloadPath = import.meta.env.ELECTRON_PRELOAD_PATH || path.join(__dirname, '../preload/index.js')

function createMainWindow() {
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
      preload: preloadPath
    },
    title: 'SQL Script Generator',
  })

  if (isDev) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
    log.info('主窗口已显示')
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

  return mainWindow
}

export function createSettingsWindow() {
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
      preload: preloadPath
    },
    title: '设置 - SQL Script Generator',
  })

  settingsWindow.setMenu(null)

  if (isDev) {
    settingsWindow.loadURL(devServerUrl + '#/settings')
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
    log.info('设置窗口已关闭')
  })

  log.info('设置窗口已创建')
  return settingsWindow
}

export function getMainWindow() {
  return mainWindow
}

export function getSettingsWindow() {
  return settingsWindow
}

export function initWindows() {
  return {
    mainWindow: createMainWindow(),
    createSettingsWindow,
    getMainWindow,
    getSettingsWindow,
  }
}