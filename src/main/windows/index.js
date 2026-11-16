import { BrowserWindow, dialog, app, nativeTheme } from 'electron'
import path from 'path'
import fs from 'fs'
import { log, getWindowIcon, getAssetsDir } from '../utils'
import { getConfig, saveConfig } from '../services'
import { IPC_EVENTS } from '../../shared/ipc'

let mainWindow = null
let settingsWindow = null
let splashWindow = null
let splashStartTime = null

const devServerUrl = process.env.ELECTRON_RENDERER_URL
const isDev = Boolean(devServerUrl)
const isMac = process.platform === 'darwin'
const preloadPath = import.meta.env.ELECTRON_PRELOAD_PATH || path.join(__dirname, '../preload/index.js')

const WINDOW_BACKGROUND = { light: '#f4f5f7', dark: '#141519' }

function getResolvedTheme() {
  const theme = getConfig()?.theme || 'system'
  if (theme === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  return theme
}

function getWindowBackground() {
  return WINDOW_BACKGROUND[getResolvedTheme()] || WINDOW_BACKGROUND.light
}

function getTitleBarOptions() {
  if (isMac) return { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } }
  return { titleBarStyle: 'hidden' }
}

// 自绘窗口控制按钮，DevTools 固定底部停靠以保持既有布局
const DEVTOOLS_MODE = 'bottom'

export function toggleDevTools(win) {
  if (!win || win.isDestroyed()) return
  const contents = win.webContents
  if (contents.isDevToolsOpened()) {
    contents.closeDevTools()
    return
  }
  contents.openDevTools({ mode: DEVTOOLS_MODE })
}

export function refreshWindowTheme() {
  for (const win of [mainWindow, settingsWindow]) {
    if (!win || win.isDestroyed()) continue
    win.setBackgroundColor(getWindowBackground())
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    backgroundColor: '#00000000',
    icon: getWindowIcon(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: '启动中...'
  })

  if (isDev) {
    splashWindow.loadURL(devServerUrl + '/splash.html?theme=' + getResolvedTheme())
  } else {
    const splashPath = path.join(__dirname, '../renderer/splash.html')
    splashWindow.loadFile(splashPath, { query: { theme: getResolvedTheme() } })

    const iconDest = path.join(__dirname, '../renderer/assets/icon.png')
    if (!fs.existsSync(iconDest)) {
      const iconSrc = path.join(getAssetsDir(), 'icon.png')
      if (fs.existsSync(iconSrc)) {
        fs.mkdirSync(path.dirname(iconDest), { recursive: true })
        fs.copyFileSync(iconSrc, iconDest)
      }
    }
  }

  splashWindow.center()

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show()
      splashStartTime = Date.now()
      log.info('启动窗口已显示')
    }
  })

  splashWindow.on('closed', () => {
    splashWindow = null
  })

  return splashWindow
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 600,
    show: false,
    backgroundColor: getWindowBackground(),
    icon: getWindowIcon(),
    ...getTitleBarOptions(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    },
    title: 'NToolBox'
  })

  if (isDev) {
    mainWindow.loadURL(devServerUrl)
    mainWindow.webContents.openDevTools({ mode: DEVTOOLS_MODE })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - (splashStartTime || Date.now())
    const minSplashTime = 1500
    const delay = Math.max(0, minSplashTime - elapsed)

    setTimeout(async () => {
      closeSplashWindow()
      mainWindow.show()

      if (process.platform === 'linux') {
        // Wayland 下若在首帧呈现前 maximize，窗口会永久无法 unmaximize（compositor 忽略后续还原），
        // 因此先 show 并等待首帧绘制完成，再最大化
        await Promise.race([
          mainWindow.webContents
            .executeJavaScript(
              'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))',
              true
            )
            .catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 800))
        ])
        await new Promise((resolve) => setTimeout(resolve, 60))
      }

      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.maximize()
      log.info('主窗口已显示')
    }, delay)
  })

  const sendFullscreenState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(IPC_EVENTS.windowFullscreen, mainWindow.isFullScreen())
  }

  mainWindow.on('enter-full-screen', sendFullscreenState)
  mainWindow.on('leave-full-screen', sendFullscreenState)

  const sendMaximizedState = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send(IPC_EVENTS.windowMaximized, mainWindow.isMaximized())
  }

  mainWindow.on('maximize', sendMaximizedState)
  mainWindow.on('unmaximize', sendMaximizedState)

  mainWindow.on('close', async (event) => {
    if (app.isQuitting) return

    const config = getConfig()

    if (config.close_action === 'quit') {
      app.isQuitting = true
      log.info('应用已退出')
      // 不拦截本次关闭，避免 preventDefault 与 app.quit() 相互抵消
      setTimeout(() => app.quit(), 0)
      return
    }

    event.preventDefault()

    if (config.close_action === 'hide') {
      mainWindow.hide()
      log.info('主窗口已隐藏到系统托盘')
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
        checkboxChecked: false
      })

      if (result.checkboxChecked) {
        config.close_action = result.response === 0 ? 'hide' : 'quit'
        await saveConfig(config)
      }

      if (result.response === 0) {
        mainWindow.hide()
        log.info('主窗口已隐藏')
      } else {
        app.isQuitting = true
        log.info('应用已退出')
        app.quit()
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

export function createSettingsWindow(defaultTab = null) {
  if (settingsWindow) {
    if (defaultTab) settingsWindow.webContents.send(IPC_EVENTS.settingsTab, defaultTab)
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 720,
    minHeight: 520,
    resizable: true,
    maximizable: true,
    minimizable: true,
    autoHideMenuBar: true,
    backgroundColor: getWindowBackground(),
    icon: getWindowIcon(),
    ...(isMac ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 14 } } : { titleBarStyle: 'hidden' }),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    },
    title: '设置 - NToolBox'
  })

  settingsWindow.setMenu(null)

  const sendMaximizedState = () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send(IPC_EVENTS.windowMaximized, settingsWindow.isMaximized())
    }
  }
  settingsWindow.on('maximize', sendMaximizedState)
  settingsWindow.on('unmaximize', sendMaximizedState)

  const hash = defaultTab ? `/settings?tab=${defaultTab}` : '/settings'
  if (isDev) {
    settingsWindow.loadURL(devServerUrl + '#' + hash)
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/index.html'), { hash })
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
  createSplashWindow()
  return {
    mainWindow: createMainWindow(),
    createSettingsWindow,
    getMainWindow,
    getSettingsWindow
  }
}
