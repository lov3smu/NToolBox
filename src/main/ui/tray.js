import { app, Menu, Tray, nativeImage } from 'electron'
import fs from 'fs'
import { log, getIconPath } from '../utils'

let tray = null
let mainWindow = null

export function createTray(window, checkForUpdatesFn, createSettingsWindowFn) {
  mainWindow = window
  
  if (tray) {
    tray.destroy()
    tray = null
  }

  let iconPath = getIconPath()
  
  if (!iconPath || !fs.existsSync(iconPath)) {
    const defaultIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADSSURBVDiNpZMxSgNBFIafNwsJFhZqY6WVWAgWXiCtF2gTb2AnHkGwtBEtBAsL8QpWsRFUkNRCYwjMzm4KhyCbKDObeTL8/3zzzftn4H+zTGn2V1OrB2CSUgqPLZtFQnSj1Pz5tSIlgPco0n1dUj9kzT1EW1IqyUYZ0K1AN+Ms0s1zIcR99mZ3AH5n4DqbzDMIE6CvjR7gBqgUYhfnAAdoCmB2JxVrKwf0QwhhpVgLfRDCE9C/HgT4HntSygXKskzlnH+A5c2Oruu+mqaRZVm+r+u6/iCE8F7f3F0AbRfnMiBN7nQAAAAASUVORK5CYII='
    )
    tray = new Tray(defaultIcon)
  } else {
    tray = new Tray(iconPath)
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '密码生成器',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.webContents.send('navigate-to', '/password')
        }
      },
    },
    {
      label: 'Cron表达式生成器',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.webContents.send('navigate-to', '/cron')
        }
      },
    },
    {
      label: 'Unix时间戳互转',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.webContents.send('navigate-to', '/unixtimestamp')
        }
      },
    },
    {
      label: 'YAML编辑(验证)器',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.webContents.send('navigate-to', '/yaml-editor')
        }
      },
    },
    {
      label: '设置',
      click: () => {
        createSettingsWindowFn()
      },
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => checkForUpdatesFn(true, mainWindow),
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
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('SQL Script Generator')

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    }
  })

  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  log.info('系统托盘已创建')
}

export function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}