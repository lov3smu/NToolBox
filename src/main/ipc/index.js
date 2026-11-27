import { ipcMain } from 'electron'
import { log } from '../utils'
import { registerAppHandlers } from './handlers/app'
import { registerWindowHandlers } from './handlers/window'
import { registerFileHandlers } from './handlers/files'
import { registerClipboardHandlers } from './handlers/clipboard'
import { registerChatHandlers } from './handlers/chat'
import { registerAiHandlers } from './handlers/ai'
import { registerDatabaseHandlers } from './handlers/database'
import { registerDraftHandlers } from './handlers/drafts'
import { registerMarkdownHandlers } from './handlers/markdown'
import { registerImageViewerHandlers } from './handlers/imageViewer'
import { registerImageHostHandlers } from './handlers/imageHost'
import { registerPasswordVaultHandlers } from './handlers/passwordVault'
import { registerProfileHandlers } from './handlers/profiles'
import { registerExtensionHandlers } from './handlers/extensions'
import { registerHttpClientHandlers } from './handlers/httpClient'
import { registerNotificationHandlers } from './handlers/notifications'
import { registerActivityHandlers } from './handlers/activity'
import { registerSystemHandlers } from './handlers/system'
import { registerScheduledTaskHandlers } from './handlers/scheduledTasks'

const registerHandlers = [
  registerAppHandlers,
  registerWindowHandlers,
  registerFileHandlers,
  registerClipboardHandlers,
  registerChatHandlers,
  registerAiHandlers,
  registerDatabaseHandlers,
  registerDraftHandlers,
  registerMarkdownHandlers,
  registerImageViewerHandlers,
  registerImageHostHandlers,
  registerPasswordVaultHandlers,
  registerProfileHandlers,
  registerExtensionHandlers,
  registerHttpClientHandlers,
  registerNotificationHandlers,
  registerActivityHandlers,
  registerSystemHandlers,
  registerScheduledTaskHandlers
]

export function registerIPCHandlers(ipc = ipcMain) {
  const handle = (channel, handler) => {
    ipc.handle(channel, async (event, ...args) => {
      try {
        const data = await handler(event, ...args)
        return { __ipc: true, ok: true, data }
      } catch (error) {
        log.error(`IPC 处理失败 [${channel}]:`, error)
        return { __ipc: true, ok: false, error: error?.message || String(error) }
      }
    })
  }

  for (const register of registerHandlers) {
    register(handle)
  }
}

export function setupIPCHandlers() {
  registerIPCHandlers(ipcMain)
}
