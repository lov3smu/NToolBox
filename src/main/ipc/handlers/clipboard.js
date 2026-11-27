import {
  getClipboardState,
  copyClipboardEntry,
  removeClipboardEntry,
  toggleClipboardPin,
  clearClipboardHistory,
  setClipboardPaused
} from '../../services/clipboard.js'
import { IPC_CHANNELS } from '../../../shared/ipc'

export function registerClipboardHandlers(handle) {
  handle(IPC_CHANNELS.clipboardHistory, async () => getClipboardState())

  handle(IPC_CHANNELS.clipboardCopy, async (_event, id) => {
    if (typeof id !== 'string') return false
    return copyClipboardEntry(id)
  })

  handle(IPC_CHANNELS.clipboardRemove, async (_event, id) => {
    if (typeof id !== 'string') return false
    return removeClipboardEntry(id)
  })

  handle(IPC_CHANNELS.clipboardTogglePin, async (_event, id) => {
    if (typeof id !== 'string') return false
    return toggleClipboardPin(id)
  })

  handle(IPC_CHANNELS.clipboardClear, async () => clearClipboardHistory())

  handle(IPC_CHANNELS.clipboardSetPaused, async (_event, value) => setClipboardPaused(value === true))
}
