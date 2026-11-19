import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const state = vi.hoisted(() => ({ userDataDir: '' }))

vi.mock('electron', () => ({
  app: {
    getPath: () => state.userDataDir
  }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

vi.mock('../src/main/utils/crypto.js', () => ({
  encrypt: (value) => (value ? `enc:${Buffer.from(value, 'utf8').toString('base64')}` : ''),
  decrypt: (value) =>
    typeof value === 'string' && value.startsWith('enc:') ? Buffer.from(value.slice(4), 'base64').toString('utf8') : ''
}))

import {
  deletePasswordEntry,
  deletePasswordGroup,
  getPasswordVaultState,
  lockPasswordVault,
  revealPasswordEntry,
  savePasswordEntry,
  savePasswordGroup,
  setPasswordVaultMasterPassword,
  unlockPasswordVault
} from '../src/main/services/passwordVault.js'

const MASTER_PASSWORD = 'vault-master-123'

describe('password vault service', () => {
  beforeEach(async () => {
    state.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-vault-'))
    await setPasswordVaultMasterPassword(MASTER_PASSWORD)
  })

  afterEach(() => {
    fs.rmSync(state.userDataDir, { recursive: true, force: true })
  })

  it('starts empty and encrypts the whole vault file', async () => {
    const initial = await getPasswordVaultState()
    expect(initial).toMatchObject({ success: true, initialized: true, locked: false, groups: [], entries: [] })

    const groupResult = await savePasswordGroup({ name: '工作' })
    expect(groupResult.success).toBe(true)
    expect(groupResult.id).toMatch(/^grp-/)

    const entryResult = await savePasswordEntry({
      groupId: groupResult.id,
      title: 'GitHub',
      username: 'octocat',
      password: 'secret-token',
      url: 'https://github.com',
      tags: ['dev', 'git'],
      notes: 'note'
    })
    expect(entryResult.success).toBe(true)

    const entry = entryResult.entries.find((item) => item.id === entryResult.id)
    expect(entry).toMatchObject({
      groupId: groupResult.id,
      title: 'GitHub',
      username: 'octocat',
      password: '••••••••',
      hasPassword: true,
      url: 'https://github.com',
      tags: ['dev', 'git'],
      notes: 'note'
    })

    const file = fs.readFileSync(path.join(state.userDataDir, 'password-vault.json'), 'utf8')
    expect(file).toContain('"cipher"')
    expect(file).toContain('"auth"')
    expect(file).not.toContain(MASTER_PASSWORD)
    expect(file).not.toContain('secret-token')
    expect(file).not.toContain('GitHub')

    const revealed = await revealPasswordEntry(entry.id)
    expect(revealed).toEqual({ success: true, password: 'secret-token' })
  })

  it('updates entries, keeps the password when left blank and preserves createdAt', async () => {
    const entryResult = await savePasswordEntry({ title: 'Mail', password: 'old-password' })
    const created = entryResult.entries[0]
    expect(created.groupId).toBeNull()

    const updatedResult = await savePasswordEntry({
      id: created.id,
      title: 'Mail 2',
      username: 'me@example.com',
      password: '',
      tags: 'personal, mail'
    })
    const updated = updatedResult.entries.find((item) => item.id === created.id)
    expect(updated.title).toBe('Mail 2')
    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt >= created.updatedAt).toBe(true)
    expect(updated.tags).toEqual(['personal', 'mail'])

    const revealed = await revealPasswordEntry(created.id)
    expect(revealed.password).toBe('old-password')
  })

  it('saves group notes and keeps createdAt when the group is updated', async () => {
    const created = await savePasswordGroup({ name: 'Team', notes: 'shared logins' })
    const group = created.groups.find((item) => item.id === created.id)
    expect(group).toMatchObject({ name: 'Team', notes: 'shared logins' })

    const updated = await savePasswordGroup({ id: created.id, name: 'Team 2', notes: '  updated notes  ' })
    const updatedGroup = updated.groups.find((item) => item.id === created.id)
    expect(updatedGroup.name).toBe('Team 2')
    expect(updatedGroup.notes).toBe('updated notes')
    expect(updatedGroup.createdAt).toBe(group.createdAt)
    expect(updatedGroup.updatedAt >= group.updatedAt).toBe(true)
  })

  it('moves entries to the root group when their group is deleted', async () => {
    const group = await savePasswordGroup({ name: 'Temp' })
    const saved = await savePasswordEntry({ groupId: group.id, title: 'Entry', password: 'p' })

    const deleted = await deletePasswordGroup(group.id)
    expect(deleted.success).toBe(true)
    const entry = deleted.entries.find((item) => item.id === saved.id)
    expect(entry.groupId).toBeNull()
  })

  it('creates nested groups and reparents children to the grandparent on delete', async () => {
    const parent = await savePasswordGroup({ name: 'Parent' })
    const child = await savePasswordGroup({ name: 'Child', parentId: parent.id })
    const grandchild = await savePasswordGroup({ name: 'Grandchild', parentId: child.id })

    expect(child.groups.find((item) => item.id === child.id).parentId).toBe(parent.id)

    const deleted = await deletePasswordGroup(parent.id)
    expect(deleted.success).toBe(true)
    expect(deleted.groups.find((item) => item.id === child.id).parentId).toBeNull()
    expect(deleted.groups.find((item) => item.id === grandchild.id).parentId).toBe(child.id)
  })

  it('rejects a missing parent and cyclic parent moves', async () => {
    const top = await savePasswordGroup({ name: 'Top' })
    const sub = await savePasswordGroup({ name: 'Sub', parentId: top.id })

    const missingParent = await savePasswordGroup({ name: 'Lost', parentId: 'grp-missing' })
    expect(missingParent).toEqual({ success: false, error: 'GROUP_NOT_FOUND' })

    const cyclic = await savePasswordGroup({ id: top.id, name: 'Top', parentId: sub.id })
    expect(cyclic).toEqual({ success: false, error: 'GROUP_NOT_FOUND' })

    const selfParent = await savePasswordGroup({ id: top.id, name: 'Top', parentId: top.id })
    expect(selfParent).toEqual({ success: false, error: 'GROUP_NOT_FOUND' })
  })

  it('rejects duplicate group names and missing entries', async () => {
    await savePasswordGroup({ name: 'Work' })
    const duplicate = await savePasswordGroup({ name: ' work ' })
    expect(duplicate).toEqual({ success: false, error: 'GROUP_NAME_DUPLICATE' })

    const missing = await deletePasswordEntry('pwd-missing')
    expect(missing).toEqual({ success: false, error: 'ENTRY_NOT_FOUND' })

    const emptyTitle = await savePasswordEntry({ title: '   ' })
    expect(emptyTitle).toEqual({ success: false, error: 'ENTRY_TITLE_REQUIRED' })
  })

  it('deletes entries and returns the remaining state', async () => {
    const saved = await savePasswordEntry({ title: 'Disposable', password: 'x' })
    const deleted = await deletePasswordEntry(saved.id)
    expect(deleted.success).toBe(true)
    expect(deleted.entries).toHaveLength(0)
    expect(await revealPasswordEntry(saved.id)).toEqual({ success: false, error: 'ENTRY_NOT_FOUND' })
  })

  it('requires a valid master password to set up and unlock the vault', async () => {
    fs.rmSync(path.join(state.userDataDir, 'password-vault.json'))
    lockPasswordVault()

    const fresh = await getPasswordVaultState()
    expect(fresh).toMatchObject({ success: true, initialized: false, locked: true, groups: [], entries: [] })

    const tooShort = await setPasswordVaultMasterPassword('short')
    expect(tooShort).toEqual({ success: false, error: 'MASTER_PASSWORD_TOO_SHORT' })

    const missing = await setPasswordVaultMasterPassword('')
    expect(missing).toEqual({ success: false, error: 'MASTER_PASSWORD_REQUIRED' })

    const created = await setPasswordVaultMasterPassword(MASTER_PASSWORD)
    expect(created).toMatchObject({ success: true, initialized: true, locked: false })

    const again = await setPasswordVaultMasterPassword(MASTER_PASSWORD)
    expect(again).toEqual({ success: false, error: 'MASTER_PASSWORD_ALREADY_SET' })

    lockPasswordVault()
    expect(await getPasswordVaultState()).toMatchObject({ initialized: true, locked: true, groups: [] })

    const wrong = await unlockPasswordVault('wrong-password')
    expect(wrong).toEqual({ success: false, error: 'MASTER_PASSWORD_INCORRECT' })

    const unlocked = await unlockPasswordVault(MASTER_PASSWORD)
    expect(unlocked).toMatchObject({ success: true, locked: false })
  })

  it('rejects vault operations while locked', async () => {
    lockPasswordVault()

    const saved = await savePasswordEntry({ title: 'Blocked', password: 'x' })
    expect(saved).toEqual({ success: false, error: 'VAULT_LOCKED' })

    const group = await savePasswordGroup({ name: 'Blocked' })
    expect(group).toEqual({ success: false, error: 'VAULT_LOCKED' })

    expect(await revealPasswordEntry('pwd-any')).toEqual({ success: false, error: 'VAULT_LOCKED' })
    expect(await deletePasswordEntry('pwd-any')).toEqual({ success: false, error: 'VAULT_LOCKED' })
  })

  it('keeps existing vault data when a master password is set for a legacy file', async () => {
    const file = path.join(state.userDataDir, 'password-vault.json')
    const legacyVault = {
      version: 1,
      groups: [
        {
          id: 'grp-legacy',
          parentId: null,
          name: '旧分组',
          notes: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ],
      entries: [
        {
          id: 'pwd-legacy',
          groupId: 'grp-legacy',
          title: 'Legacy',
          username: 'user',
          password: 'legacy-secret',
          url: '',
          tags: [],
          notes: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }
      ]
    }
    fs.writeFileSync(
      file,
      JSON.stringify({ cipher: `enc:${Buffer.from(JSON.stringify(legacyVault)).toString('base64')}` })
    )
    lockPasswordVault()

    const locked = await getPasswordVaultState()
    expect(locked).toMatchObject({ initialized: false, locked: true, groups: [], entries: [] })

    const setup = await setPasswordVaultMasterPassword(MASTER_PASSWORD)
    expect(setup.success).toBe(true)
    expect(setup.entries).toHaveLength(1)

    const revealed = await revealPasswordEntry('pwd-legacy')
    expect(revealed).toEqual({ success: true, password: 'legacy-secret' })
  })
})
