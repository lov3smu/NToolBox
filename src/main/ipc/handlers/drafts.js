import { importDrafts, listDrafts, removeDraft, saveDraft } from '../../services/sqlite/draftRepository.js'
import { IPC_CHANNELS } from '../../../shared/ipc'

function draftRetention(kind) {
  return kind === 'wechat-draft' ? 30 : 1
}

export function registerDraftHandlers(handle) {
  handle(IPC_CHANNELS.draftList, async (_event, kind, options = {}) => {
    return listDrafts(kind, { limit: options?.limit, offset: options?.offset })
  })

  handle(IPC_CHANNELS.draftSave, async (_event, kind, draft) => {
    return { success: await saveDraft(kind, draft) }
  })

  handle(IPC_CHANNELS.draftRemove, async (_event, kind, id) => {
    return { success: await removeDraft(kind, id) }
  })

  handle(IPC_CHANNELS.draftImport, async (_event, kind, drafts) => {
    const imported = await importDrafts(kind, drafts, draftRetention(kind))
    return { success: true, imported }
  })
}
