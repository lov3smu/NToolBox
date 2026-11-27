import { BrowserWindow } from 'electron'
import { getMainWindow, getSettingsWindow } from '../../windows'

export function getDialogParentWindow() {
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  const settingsWindow = getSettingsWindow()
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined
}

export function getSenderWindow(event) {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win && !win.isDestroyed() ? win : null
}
