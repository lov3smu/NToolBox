import { Menu, app, dialog } from 'electron'
import path from 'path'
import { log } from '../utils'
import { getConfig } from '../services'
import { destroyTray } from './tray'
import { getProjectRoot } from '../utils/path'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const packageJson = require(path.join(getProjectRoot(), 'package.json'))

const appVersion = packageJson.version || '1.0.0'
const appAuthor = packageJson.author || 'lov3smu'
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const isMac = process.platform === 'darwin'

function showAboutDialog(mainWindow) {
  const appName = 'NToolBox'
  const description = '一款面向开发人员的多端工具集合平台，集成丰富工具 + AI大模型能力，启动快、功能全、更智能。'
  const copyright = `© ${new Date().getFullYear()} ${appAuthor}. All rights reserved.`
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于软件',
    message: `${appName} ${appVersion}`,
    detail: `${description}\n\n作者：${appAuthor}\n\n${copyright}`,
    buttons: ['确定']
  })
}

export function createAppMenu(mainWindow, checkForUpdatesFn, createSettingsWindowFn) {
  const config = getConfig()
  const shortcuts = config.shortcuts || {
    password: 'CmdOrCtrl+P',
    cron: 'CmdOrCtrl+Shift+C',
    unixtimestamp: 'CmdOrCtrl+Shift+T',
    yamlEditor: 'CmdOrCtrl+Shift+Y',
    fileManager: 'CmdOrCtrl+Shift+F',
    jsonParser: 'CmdOrCtrl+J',
    htmlViewer: 'CmdOrCtrl+H',
    chat: 'CmdOrCtrl+L',
    settings: 'CmdOrCtrl+,'
  }

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
        {
          label: '首页',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/')
            }
          }
        },
        {
          label: '文件管理器',
          accelerator: shortcuts.fileManager || 'CmdOrCtrl+Shift+F',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/file-manager')
            }
          }
        },
        { type: 'separator' },
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
      label: '工具',
      submenu: [
        {
          label: 'SQL脚本生成',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/sql-generator')
            }
          }
        },
        {
          label: 'AI聊天助手',
          accelerator: shortcuts.chat || 'CmdOrCtrl+L',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/chat')
            }
          }
        },
        {
          label: '数据库管理',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/database')
            }
          }
        },
        { type: 'separator' },
        {
          label: '密码生成器',
          accelerator: shortcuts.password || 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/password')
            }
          }
        },
        {
          label: 'Cron表达式生成器',
          accelerator: shortcuts.cron || 'CmdOrCtrl+Shift+C',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/cron')
            }
          }
        },
        {
          label: 'Unix时间戳互转',
          accelerator: shortcuts.unixtimestamp || 'CmdOrCtrl+Shift+T',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/unixtimestamp')
            }
          }
        },
        {
          label: 'YAML编辑(验证)器',
          accelerator: shortcuts.yamlEditor || 'CmdOrCtrl+Shift+Y',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/yaml-editor')
            }
          }
        },
        {
          label: 'JSON解析器',
          accelerator: shortcuts.jsonParser || 'CmdOrCtrl+J',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/json-parser')
            }
          }
        },
        {
          label: 'HTML查看器',
          accelerator: shortcuts.htmlViewer || 'CmdOrCtrl+Shift+H',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/html-viewer')
            }
          }
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: shortcuts.settings || 'CmdOrCtrl+,',
          click: () => {
            if (createSettingsWindowFn) {
              createSettingsWindowFn()
            }
          }
        }
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
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.toggleDevTools()
                  }
                }
              }
            ]
          : [])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  log.info('应用菜单已创建')
}
