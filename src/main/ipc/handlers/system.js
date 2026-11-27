import { IPC_CHANNELS } from '../../../shared/ipc.js'
import { checkCertificate, listListeningPorts } from '../../services/systemTools.js'

export function registerSystemHandlers(handle) {
  handle(IPC_CHANNELS.systemPorts, async () => await listListeningPorts())
  handle(IPC_CHANNELS.systemSslCheck, async (_event, target) => await checkCertificate(target))
}
