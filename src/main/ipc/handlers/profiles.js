import {
  activateProjectProfile,
  deleteProfileCredential,
  deleteProjectProfile,
  getActiveProfileEnvironment,
  getProfilesState,
  saveProfileCredential,
  saveProjectProfile
} from '../../services/profiles.js'
import { IPC_CHANNELS } from '../../../shared/ipc'

export function registerProfileHandlers(handle) {
  handle(IPC_CHANNELS.profilesList, async () => getProfilesState())

  handle(IPC_CHANNELS.profilesSaveProject, async (_event, input) => saveProjectProfile(input))

  handle(IPC_CHANNELS.profilesDeleteProject, async (_event, id) => deleteProjectProfile(id))

  handle(IPC_CHANNELS.profilesActivateProject, async (_event, id) => activateProjectProfile(id))

  handle(IPC_CHANNELS.profilesActiveEnvironment, async () => getActiveProfileEnvironment())

  handle(IPC_CHANNELS.profilesSaveCredential, async (_event, input) => saveProfileCredential(input))

  handle(IPC_CHANNELS.profilesDeleteCredential, async (_event, alias) => deleteProfileCredential(alias))
}
