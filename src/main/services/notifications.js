import { log } from '../utils'
import { getConfig } from './config'
import { getNotificationLevel, normalizeNotificationConfig } from '../../shared/notifications.js'
import { IPC_EVENTS } from '../../shared/ipc.js'
import {
  addNotification,
  clearNotifications,
  listNotifications,
  markNotificationsRead,
  unreadNotificationCount
} from './sqlite/notificationRepository.js'

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

export function getNotificationChannel(key) {
  return normalizeNotificationConfig(getConfig()?.notifications)[key] || 'system'
}

function focusMainWindow(BrowserWindow) {
  if (typeof BrowserWindow?.getAllWindows !== 'function') return
  const win = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed())
  if (!win) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

function broadcast(record, unread) {
  const BrowserWindow = electronModule?.BrowserWindow
  if (typeof BrowserWindow?.getAllWindows !== 'function') return
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC_EVENTS.notificationCreated, { notification: record, unread })
  }
}

async function showSystemNotification(electron, { title, body, silent }) {
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

export async function notify(key, { title, body, silent = false, level } = {}) {
  const channel = getNotificationChannel(key)
  if (channel === 'off') return false

  const electron = await loadElectron()
  let record = null
  try {
    record = await addNotification({ kind: key, level: level || getNotificationLevel(key), title, body })
  } catch (error) {
    log.warn('写入通知中心失败:', error.message)
  }

  if (record) {
    try {
      broadcast(record, await unreadNotificationCount())
    } catch (error) {
      log.warn('广播通知失败:', error.message)
    }
  }

  if (channel !== 'system') return true
  return showSystemNotification(electron, { title, body, silent })
}

export async function listNotificationCenter(options) {
  return listNotifications(options)
}

export function unreadCount() {
  return unreadNotificationCount()
}

export function markRead(ids) {
  return markNotificationsRead(ids)
}

export function clearAll() {
  return clearNotifications()
}
