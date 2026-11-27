import { listActivityTimeline } from '../../services/activity.js'
import { IPC_CHANNELS } from '../../../shared/ipc'

export function registerActivityHandlers(handle) {
  handle(IPC_CHANNELS.activityTimeline, async (_event, options) => {
    return await listActivityTimeline(options)
  })
}
