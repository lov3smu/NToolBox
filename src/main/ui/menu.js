import { BrowserWindow, Menu, app } from 'electron'
import { log } from '../utils'
import { getConfig } from '../services'
import { destroyTray } from './tray'
import { toggleDevTools } from '../windows'
import { SETTINGS_PATH, getToolAccelerator, getToolByPath } from '../../shared/tools'
import { IPC_EVENTS } from '../../shared/ipc'
import { t } from '../services/i18n.js'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const isMac = process.platform === 'darwin'

function showAboutDialog(mainWindow) {
  const target = BrowserWindow.getFocusedWindow() || mainWindow
  if (!target || target.isDestroyed()) return
  if (!target.isVisible()) target.show()
  target.focus()
  target.webContents.send(IPC_EVENTS.showAbout)
}

export function handleMenuAction(event, action) {
  const win = BrowserWindow.fromWebContents(event.sender)
  switch (action) {
    case 'edit-undo':
      event.sender.undo()
      return true
    case 'edit-redo':
      event.sender.redo()
      return true
    case 'edit-cut':
      event.sender.cut()
      return true
    case 'edit-copy':
      event.sender.copy()
      return true
    case 'edit-paste':
      event.sender.paste()
      return true
    case 'select-all':
      event.sender.selectAll()
      return true
    case 'hide-window':
      if (win && !win.isDestroyed()) win.hide()
      return true
    case 'close-window':
      if (win && !win.isDestroyed()) win.close()
      return true
    case 'reload':
      event.sender.reload()
      return true
    case 'force-reload':
      event.sender.reloadIgnoringCache()
      return true
    case 'reset-zoom':
      event.sender.setZoomLevel(0)
      return true
    case 'zoom-in':
      event.sender.setZoomLevel(Math.min(event.sender.getZoomLevel() + 0.5, 9))
      return true
    case 'zoom-out':
      event.sender.setZoomLevel(Math.max(event.sender.getZoomLevel() - 0.5, -9))
      return true
    case 'toggle-fullscreen':
      if (win && !win.isDestroyed()) win.setFullScreen(!win.isFullScreen())
      return true
    case 'quit':
      app.isQuitting = true
      destroyTray()
      app.quit()
      return true
    case 'about':
      showAboutDialog(win)
      return true
    case 'toggle-devtools':
      toggleDevTools(win)
      return true
    default:
      return false
  }
}

function openTool(mainWindow, tool, createSettingsWindowFn) {
  if (tool.path === SETTINGS_PATH) {
    if (createSettingsWindowFn) createSettingsWindowFn()
    return
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.webContents.send(IPC_EVENTS.navigateTo, tool.path)
  }
}

function buildToolMenuItem(mainWindow, tool, shortcuts, createSettingsWindowFn) {
  const accelerator = getToolAccelerator(tool, shortcuts)
  return {
    label: t(tool.name),
    ...(accelerator ? { accelerator } : {}),
    click: () => openTool(mainWindow, tool, createSettingsWindowFn)
  }
}

export function createAppMenu(mainWindow, checkForUpdatesFn, createSettingsWindowFn) {
  const config = getConfig()
  const shortcuts = config.app.shortcuts || {}
  const settingsTool = getToolByPath(SETTINGS_PATH)

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: t('关于 {name}', { name: app.name }), click: () => showAboutDialog(mainWindow) },
              { type: 'separator' },
              { label: t('服务'), role: 'services' },
              { type: 'separator' },
              { label: t('隐藏 {name}', { name: app.name }), accelerator: 'Command+H', role: 'hide' },
              { label: t('隐藏其他'), accelerator: 'Command+Alt+H', role: 'hideOthers' },
              { label: t('显示全部'), role: 'unhide' },
              { type: 'separator' },
              {
                label: t('退出'),
                accelerator: 'Command+Q',
                click: () => {
                  app.isQuitting = true
                  destroyTray()
                  app.quit()
                }
              }
            ]
          }
        ]
      : []),
    {
      label: t('文件'),
      submenu: [
        ...(settingsTool
          ? [buildToolMenuItem(mainWindow, settingsTool, shortcuts, createSettingsWindowFn), { type: 'separator' }]
          : []),
        {
          label: t('隐藏窗口'),
          click: () => {
            if (mainWindow) mainWindow.hide()
          }
        },
        { type: 'separator' },
        {
          label: t('关闭窗口'),
          accelerator: isMac ? 'Command+W' : 'Alt+F4',
          click: () => {
            const target = BrowserWindow.getFocusedWindow() || mainWindow
            if (target && !target.isDestroyed()) target.close()
          }
        }
      ]
    },
    {
      label: t('编辑'),
      submenu: [
        { label: t('撤销'), accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: t('重做'), accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: t('剪切'), accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: t('复制'), accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: t('粘贴'), accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: t('全选'), accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: t('视图'),
      submenu: [
        { label: t('重新载入'), accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: t('强制重新载入'), accelerator: 'Shift+CmdOrCtrl+R', role: 'forceReload' },
        { type: 'separator' },
        { label: t('实际大小'), accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: t('放大'), accelerator: 'CmdOrCtrl+=', role: 'zoomIn' },
        { label: t('缩小'), accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: t('切换全屏'), accelerator: isMac ? 'Ctrl+Command+F' : 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: t('帮助'),
      submenu: [
        {
          label: t('检查更新'),
          click: () => {
            if (checkForUpdatesFn && mainWindow) {
              checkForUpdatesFn(true, mainWindow)
            }
          }
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' },
              {
                label: t('关于软件'),
                click: () => showAboutDialog(mainWindow)
              }
            ]),
        ...(isDev
          ? [
              { type: 'separator' },
              {
                label: t('开发者工具'),
                accelerator: isMac ? 'Alt+Command+I' : 'F12',
                click: () => {
                  toggleDevTools(mainWindow)
                }
              }
            ]
          : [])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  if (!isMac && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setMenuBarVisibility(false)
  }
  log.info('应用菜单已创建')
}
