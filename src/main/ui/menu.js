import { BrowserWindow, Menu, app } from 'electron'
import { log } from '../utils'
import { getConfig } from '../services'
import { destroyTray } from './tray'
import { toggleDevTools } from '../windows'
import { SETTINGS_PATH, getToolAccelerator, getToolByPath } from '../../shared/tools'
import { IPC_EVENTS } from '../../shared/ipc'

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
    label: tool.name,
    ...(accelerator ? { accelerator } : {}),
    click: () => openTool(mainWindow, tool, createSettingsWindowFn)
  }
}

export function createAppMenu(mainWindow, checkForUpdatesFn, createSettingsWindowFn) {
  const config = getConfig()
  const shortcuts = config.shortcuts || {}
  const settingsTool = getToolByPath(SETTINGS_PATH)

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: `关于 ${app.name}`, click: () => showAboutDialog(mainWindow) },
              { type: 'separator' },
              { label: '服务', role: 'services' },
              { type: 'separator' },
              { label: `隐藏 ${app.name}`, accelerator: 'Command+H', role: 'hide' },
              { label: '隐藏其他', accelerator: 'Command+Alt+H', role: 'hideOthers' },
              { label: '显示全部', role: 'unhide' },
              { type: 'separator' },
              {
                label: '退出',
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
      label: '文件',
      submenu: [
        ...(settingsTool
          ? [buildToolMenuItem(mainWindow, settingsTool, shortcuts, createSettingsWindowFn), { type: 'separator' }]
          : []),
        {
          label: '隐藏窗口',
          click: () => {
            if (mainWindow) mainWindow.hide()
          }
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' },
              {
                label: '退出',
                accelerator: 'Alt+F4',
                click: () => {
                  app.isQuitting = true
                  destroyTray()
                  app.quit()
                }
              }
            ])
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: '全选', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新',
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
                label: '关于软件',
                click: () => showAboutDialog(mainWindow)
              }
            ]),
        ...(isDev
          ? [
              { type: 'separator' },
              {
                label: '开发者工具',
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
