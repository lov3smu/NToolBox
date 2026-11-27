import { clearAll, listNotificationCenter, markRead, unreadCount } from '../../services/notifications.js'
import { IPC_CHANNELS } from '../../../shared/ipc'

export function registerNotificationHandlers(handle) {
  handle(IPC_CHANNELS.notificationsList, async (_event, options) => {
    const limit = Number(options?.limit) || 30
    const offset = Number(options?.offset) || 0
    return listNotificationCenter({ limit, offset })
  })

  handle(IPC_CHANNELS.notificationsUnread, async () => unreadCount())

  handle(IPC_CHANNELS.notificationsMarkRead, async (_event, ids) => {
    if (ids !== undefined && !Array.isArray(ids)) return false
    return markRead(ids)
  })

  handle(IPC_CHANNELS.notificationsClear, async () => clearAll())
}
