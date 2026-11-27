import { shell } from 'electron'
import { log } from '../../utils'
import { checkForUpdates } from '../../services/updater.js'
import { getMainWindow, createSettingsWindow } from '../../windows'
import { createAppMenu, handleMenuAction } from '../../ui'
import { IPC_CHANNELS } from '../../../shared/ipc'
import { getSenderWindow } from './common'

export function registerWindowHandlers(handle) {
  handle(IPC_CHANNELS.windowMinimize, async (event) => {
    const win = getSenderWindow(event)
    if (!win) return false
    win.minimize()
    return true
  })

  handle(IPC_CHANNELS.windowToggleMaximize, async (event) => {
    const win = getSenderWindow(event)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  handle(IPC_CHANNELS.windowIsMaximized, async (event) => Boolean(getSenderWindow(event)?.isMaximized()))

  handle(IPC_CHANNELS.windowIsFullscreen, async (event) => Boolean(getSenderWindow(event)?.isFullScreen()))

  handle(IPC_CHANNELS.windowClose, async (event) => {
    const win = getSenderWindow(event)
    if (!win) return false
    win.close()
    return true
  })

  handle(IPC_CHANNELS.openExternal, async (_event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      log.warn('拒绝打开非 HTTP(S) 链接:', url)
      return false
    }
    await shell.openExternal(url)
    return true
  })

  handle(IPC_CHANNELS.reloadMenu, async () => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
      return true
    }
    return false
  })

  handle(IPC_CHANNELS.menuAction, async (event, action) => handleMenuAction(event, action))
}
