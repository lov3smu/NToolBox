import { IPC_CHANNELS } from '../../../shared/ipc.js'
import { sendHttpRequest } from '../../services/httpClient.js'
import { resolveRequestSecrets } from '../../services/profiles.js'

export function registerHttpClientHandlers(handle) {
  handle(IPC_CHANNELS.httpRequest, async (_event, request) => {
    const resolved = await resolveRequestSecrets(request)
    if (!resolved.ok) return { success: false, status: 0, elapsedMs: 0, error: resolved.error }
    return sendHttpRequest(resolved.request)
  })
}
