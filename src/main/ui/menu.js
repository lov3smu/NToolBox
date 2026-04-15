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

function showAboutDialog(mainWindow) {
  const appName = 'SQL Script Generator'
  const description = 'SQL脚本生成工具，用于快速生成符合规范的SQL脚本文件。'
  const copyright = `© ${new Date().getFullYear()} ${appAuthor}. All rights reserved.`
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于软件',
    message: `${appName} ${appVersion}`,
    detail: `${description}\n\n作者：${appAuthor}\n\n${copyright}`,
    buttons: ['确定'],
  })
}

export function createAppMenu(mainWindow, checkForUpdatesFn, createSettingsWindowFn) {
  const config = getConfig()
  const shortcuts = config.shortcuts || {
    home: 'CmdOrCtrl+H',
    password: 'CmdOrCtrl+P',
    cron: 'CmdOrCtrl+Shift+C',
    unixtimestamp: 'CmdOrCtrl+Shift+T',
    yamlEditor: 'CmdOrCtrl+Shift+Y',
    fileManager: 'CmdOrCtrl+Shift+F',
    settings: 'CmdOrCtrl+,'
  }

  const template = [
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
          },
        },
        {
          label: '文件管理器',
          accelerator: shortcuts.fileManager || 'CmdOrCtrl+Shift+F',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/file-manager')
            }
          },
        },
        { type: 'separator' },
        {
          label: '隐藏窗口',
          click: () => { if (mainWindow) mainWindow.hide() },
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            app.isQuitting = true
            destroyTray()
            app.quit()
          },
        },
      ],
    },
    {
      label: '工具',
      submenu: [
        {
          label: '密码生成器',
          accelerator: shortcuts.password || 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/password')
            }
          },
        },
        {
          label: 'Cron表达式生成器',
          accelerator: shortcuts.cron || 'CmdOrCtrl+Shift+C',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/cron')
            }
          },
        },
        {
          label: 'Unix时间戳互转',
          accelerator: shortcuts.unixtimestamp || 'CmdOrCtrl+Shift+T',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/unixtimestamp')
            }
          },
        },
        {
          label: 'YAML编辑(验证)器',
          accelerator: shortcuts.yamlEditor || 'CmdOrCtrl+Shift+Y',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/yaml-editor')
            }
          },
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: shortcuts.settings || 'CmdOrCtrl+,',
          click: () => {
            if (createSettingsWindowFn) {
              createSettingsWindowFn()
            }
          },
        },
],
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
          },
        },
        { type: 'separator' },
        ...(isDev ? [{
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools()
            }
          },
        }, { type: 'separator' }] : []),
        {
          label: '关于软件',
          click: () => showAboutDialog(mainWindow),
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
  log.info('应用菜单已创建')
}