import { IPC_CHANNELS } from '../../../shared/ipc'
import {
  listMarkdownRecents,
  openMarkdownDocument,
  readMarkdownDocument,
  saveMarkdownDocument,
  saveMarkdownDocumentAs
} from '../../services/markdownDocuments.js'
import { getDialogParentWindow } from './common'

export function registerMarkdownHandlers(handle) {
  handle(IPC_CHANNELS.mdOpenDocument, async () => openMarkdownDocument(getDialogParentWindow()))

  handle(IPC_CHANNELS.mdListRecents, async () => listMarkdownRecents())

  handle(IPC_CHANNELS.mdReadDocument, async (_event, filePath) => readMarkdownDocument(filePath))

  handle(IPC_CHANNELS.mdSaveDocument, async (_event, payload) => saveMarkdownDocument(payload))

  handle(IPC_CHANNELS.mdSaveDocumentAs, async (_event, payload) =>
    saveMarkdownDocumentAs({ ...payload, parentWindow: getDialogParentWindow() })
  )
}
