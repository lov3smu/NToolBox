import {
  getPasswordVaultState,
  setPasswordVaultMasterPassword,
  unlockPasswordVault,
  lockPasswordVault,
  savePasswordGroup,
  deletePasswordGroup,
  savePasswordEntry,
  deletePasswordEntry,
  revealPasswordEntry
} from '../../services/passwordVault.js'
import { IPC_CHANNELS } from '../../../shared/ipc'

export function registerPasswordVaultHandlers(handle) {
  handle(IPC_CHANNELS.passwordVaultState, async () => getPasswordVaultState())

  handle(IPC_CHANNELS.passwordVaultSetMasterPassword, async (_event, password) =>
    setPasswordVaultMasterPassword(password)
  )

  handle(IPC_CHANNELS.passwordVaultUnlock, async (_event, password) => unlockPasswordVault(password))

  handle(IPC_CHANNELS.passwordVaultLock, async () => lockPasswordVault())

  handle(IPC_CHANNELS.passwordGroupSave, async (_event, input) => savePasswordGroup(input))

  handle(IPC_CHANNELS.passwordGroupDelete, async (_event, id) => deletePasswordGroup(id))

  handle(IPC_CHANNELS.passwordEntrySave, async (_event, input) => savePasswordEntry(input))

  handle(IPC_CHANNELS.passwordEntryDelete, async (_event, id) => deletePasswordEntry(id))

  handle(IPC_CHANNELS.passwordEntryReveal, async (_event, id) => revealPasswordEntry(id))
}
