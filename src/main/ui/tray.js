import { app, Menu, Tray, nativeImage } from 'electron'
import fs from 'fs'
import { log, getIconPath } from '../utils'
import { SETTINGS_PATH, getToolByPath } from '../../shared/tools'
import { IPC_EVENTS } from '../../shared/ipc'

let tray = null
let mainWindow = null

const defaultTrayIcon = () =>
  nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADSSURBVDiNpZMxSgNBFIafNwsJFhZqY6WVWAgWXiCtF2gTb2AnHkGwtBEtBAsL8QpWsRFUkNRCYwjMzm4KhyCbKDObeTL8/3zzzftn4H+zTGn2V1OrB2CSUgqPLZtFQnSj1Pz5tSIlgPco0n1dUj9kzT1EW1IqyUYZ0K1AN+Ms0s1zIcR99mZ3AH5n4DqbzDMIE6CvjR7gBqgUYhfnAAdoCmB2JxVrKwf0QwhhpVgLfRDCE9C/HgT4HntSygXKskzlnH+A5c2Oruu+mqaRZVm+r+u6/iCE8F7f3F0AbRfnMiBN7nQAAAAASUVORK5CYII='
  )

// Windows 托盘使用 .ico 自带尺寸，macOS 菜单栏 18px，Linux 托盘 22px
const TRAY_ICON_SIZE = { darwin: 18, linux: 22 }

function getTrayIcon() {
  const iconPath = getIconPath()
  if (!iconPath || !fs.existsSync(iconPath)) return defaultTrayIcon()

  let icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) return defaultTrayIcon()

  const size = TRAY_ICON_SIZE[process.platform]
  if (size) icon = icon.resize({ width: size, height: size, quality: 'best' })
  return icon
}

function openTool(tool, createSettingsWindowFn) {
  if (tool.path === SETTINGS_PATH) {
    if (createSettingsWindowFn) createSettingsWindowFn()
    return
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.webContents.send(IPC_EVENTS.navigateTo, tool.path)
  }
}

function buildTrayToolItem(tool, createSettingsWindowFn) {
  return {
    label: tool.name,
    click: () => openTool(tool, createSettingsWindowFn)
  }
}

export function createTray(window, checkForUpdatesFn, createSettingsWindowFn) {
  mainWindow = window

  if (tray) {
    tray.destroy()
    tray = null
  }

  tray = new Tray(getTrayIcon())

  const settingsTool = getToolByPath(SETTINGS_PATH)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    ...(settingsTool ? [buildTrayToolItem(settingsTool, createSettingsWindowFn), { type: 'separator' }] : []),
    {
      label: '检查更新',
      click: () => checkForUpdatesFn(true, mainWindow)
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        destroyTray()
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('NToolBox')

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
