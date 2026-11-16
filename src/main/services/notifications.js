import { log } from '../utils'
import { getConfig } from './config'
import { normalizeNotificationConfig } from '../../shared/notifications.js'

let electronModule

async function loadElectron() {
  if (electronModule !== undefined) return electronModule
  try {
    electronModule = await import('electron')
  } catch {
    electronModule = null
  }
  return electronModule
}

export function isNotificationEnabled(key) {
  return normalizeNotificationConfig(getConfig()?.notifications)[key] === true
}

function focusMainWindow(BrowserWindow) {
  if (typeof BrowserWindow?.getAllWindows !== 'function') return
  const win = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed())
  if (!win) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

export async function notify(key, { title, body, silent = false } = {}) {
  if (!isNotificationEnabled(key)) return false

  const electron = await loadElectron()
  const Notification = electron?.Notification
  if (typeof Notification !== 'function' || Notification.isSupported?.() === false) return false

  try {
    const notification = new Notification({ title, body, ...(silent ? { silent: true } : {}) })
    notification.on?.('click', () => focusMainWindow(electron.BrowserWindow))
    notification.show()
    return true
  } catch (error) {
    log.warn('发送系统通知失败:', error.message)
    return false
  }
}
