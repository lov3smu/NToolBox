import { IPC_CHANNELS } from '../../../shared/ipc.js'
import {
  deleteScheduledTask,
  listScheduledTasks,
  runScheduledTaskNow,
  saveScheduledTask
} from '../../services/scheduledTasks.js'

export function registerScheduledTaskHandlers(handle) {
  handle(IPC_CHANNELS.scheduledTasksList, async () => listScheduledTasks())

  handle(IPC_CHANNELS.scheduledTasksSave, async (_event, task) => saveScheduledTask(task))

  handle(IPC_CHANNELS.scheduledTasksDelete, async (_event, id) => {
    if (typeof id !== 'string') return { success: false, error: 'missing id' }
    return deleteScheduledTask(id)
  })

  handle(IPC_CHANNELS.scheduledTasksRun, async (_event, id) => {
    if (typeof id !== 'string') return { success: false, error: 'missing id' }
    return runScheduledTaskNow(id)
  })
}
