const { Menu, app, dialog } = require('electron')
const log = require('electron-log')
const { getConfig } = require('./config')
const { destroyTray } = require('./tray')

const packageJson = require('../package.json')
const appVersion = packageJson.version || '1.0.0'
const appAuthor = packageJson.author || 'lov3smu'

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

function createAppMenu(mainWindow, checkForUpdatesFn, createSettingsWindowFn) {
  const config = getConfig()
  const shortcuts = config.shortcuts || {
    home: 'CmdOrCtrl+H',
    password: 'CmdOrCtrl+P',
    cron: 'CmdOrCtrl+Shift+C',
    template: 'CmdOrCtrl+T',
    settings: 'CmdOrCtrl+,'
  }

  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '首页',
          accelerator: shortcuts.home || 'CmdOrCtrl+H',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/')
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
          label: 'SQL模版生成器',
          accelerator: shortcuts.template || 'CmdOrCtrl+T',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/template')
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

module.exports = {
  createAppMenu,
}