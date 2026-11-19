import path from 'path'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { app } from 'electron'
import { log } from '../utils'
import { encrypt, decrypt } from '../utils/crypto'
import { writeFileAtomic, readJsonWithBackup } from '../utils/atomicFile'
import {
  PASSWORD_MASK,
  PASSWORD_VAULT_ERRORS,
  PASSWORD_VAULT_VERSION,
  MAX_GROUP_NAME_LENGTH,
  MAX_GROUP_NOTES_LENGTH,
  MAX_MASTER_PASSWORD_LENGTH,
  MIN_MASTER_PASSWORD_LENGTH,
  normalizePasswordEntry,
  normalizePasswordGroup,
  normalizePasswordVault
} from '../../shared/passwordVault.js'

const VAULT_FILE = 'password-vault.json'

let writeQueue = Promise.resolve()
let vaultUnlocked = false

function normalizeAuth(raw) {
  if (!raw || typeof raw !== 'object') return null
  const salt = typeof raw.salt === 'string' ? raw.salt : ''
  const hash = typeof raw.hash === 'string' ? raw.hash : ''
  return salt && hash ? { salt, hash } : null
}

function hashMasterPassword(password, saltBase64) {
  return scryptSync(password, Buffer.from(saltBase64, 'base64'), 32).toString('base64')
}

function verifyMasterPassword(password, auth) {
  const expected = Buffer.from(auth.hash, 'base64')
  const actual = Buffer.from(hashMasterPassword(password, auth.salt), 'base64')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function validateNewMasterPassword(password) {
  if (typeof password !== 'string' || !password) return PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_REQUIRED
  if (password.length < MIN_MASTER_PASSWORD_LENGTH) return PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_TOO_SHORT
  if (password.length > MAX_MASTER_PASSWORD_LENGTH) return PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_TOO_LONG
  return null
}

function lockedState(initialized) {
  return { success: true, initialized, locked: true, groups: [], entries: [] }
}

function getVaultPath() {
  return path.join(app.getPath('userData'), VAULT_FILE)
}

function withWriteLock(task) {
  const run = writeQueue.then(task, task)
  writeQueue = run.catch(() => {})
  return run
}

function emptyVault() {
  return { version: PASSWORD_VAULT_VERSION, groups: [], entries: [] }
}

async function loadVaultData() {
  try {
    const { data, recovered } = await readJsonWithBackup(getVaultPath())
    if (recovered) log.warn('密码保险库从备份文件恢复')
    const auth = normalizeAuth(data?.auth)
    if (data && typeof data.cipher === 'string') {
      const plaintext = decrypt(data.cipher)
      if (!plaintext) throw new Error('密码保险库解密失败')
      return { vault: normalizePasswordVault(JSON.parse(plaintext)), auth }
    }
    return { vault: normalizePasswordVault(data), auth }
  } catch (error) {
    if (error.code === 'ENOENT') return { vault: emptyVault(), auth: null }
    log.error('读取密码保险库失败:', error)
    throw error
  }
}

async function persistVault(vault, auth) {
  const envelope = { ...(auth ? { auth } : {}), cipher: encrypt(JSON.stringify(vault)) }
  await writeFileAtomic(getVaultPath(), JSON.stringify(envelope, null, 2))
}

function toPublicState(vault) {
  return {
    groups: vault.groups.map((group) => ({
      id: group.id,
      parentId: group.parentId,
      name: group.name,
      notes: group.notes,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt
    })),
    entries: vault.entries.map((entry) => ({
      id: entry.id,
      groupId: entry.groupId,
      title: entry.title,
      username: entry.username,
      password: entry.password ? PASSWORD_MASK : '',
      hasPassword: Boolean(entry.password),
      url: entry.url,
      tags: [...entry.tags],
      notes: entry.notes,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }))
  }
}

export async function getPasswordVaultState() {
  const { vault, auth } = await loadVaultData()
  if (!auth) return lockedState(false)
  if (!vaultUnlocked) return lockedState(true)
  return { success: true, initialized: true, locked: false, ...toPublicState(vault) }
}

export async function setPasswordVaultMasterPassword(password) {
  return withWriteLock(async () => {
    const invalid = validateNewMasterPassword(password)
    if (invalid) return { success: false, error: invalid }
    const { vault, auth } = await loadVaultData()
    if (auth) return { success: false, error: PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_ALREADY_SET }

    const nextAuth = {
      salt: randomBytes(16).toString('base64'),
      hash: ''
    }
    nextAuth.hash = hashMasterPassword(password, nextAuth.salt)
    await persistVault(vault, nextAuth)
    vaultUnlocked = true
    return { success: true, initialized: true, locked: false, ...toPublicState(vault) }
  })
}

export async function unlockPasswordVault(password) {
  if (typeof password !== 'string' || !password) {
    return { success: false, error: PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_REQUIRED }
  }
  const { vault, auth } = await loadVaultData()
  if (!auth) return { success: false, error: PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_NOT_SET }
  if (!verifyMasterPassword(password, auth)) {
    return { success: false, error: PASSWORD_VAULT_ERRORS.MASTER_PASSWORD_INCORRECT }
  }
  vaultUnlocked = true
  return { success: true, initialized: true, locked: false, ...toPublicState(vault) }
}

export function lockPasswordVault() {
  vaultUnlocked = false
  return { success: true }
}

export async function savePasswordGroup(input = {}) {
  return withWriteLock(async () => {
    if (!vaultUnlocked) return { success: false, error: PASSWORD_VAULT_ERRORS.VAULT_LOCKED }
    const { vault, auth } = await loadVaultData()
    const name = String(input?.name ?? '')
      .trim()
      .slice(0, MAX_GROUP_NAME_LENGTH)
    if (!name) return { success: false, error: PASSWORD_VAULT_ERRORS.GROUP_NAME_REQUIRED }
    const notes = String(input?.notes ?? '')
      .trim()
      .slice(0, MAX_GROUP_NOTES_LENGTH)

    const id = typeof input?.id === 'string' ? input.id.trim() : ''
    const duplicated = vault.groups.some((group) => group.id !== id && group.name.toLowerCase() === name.toLowerCase())
    if (duplicated) return { success: false, error: PASSWORD_VAULT_ERRORS.GROUP_NAME_DUPLICATE }

    let parentId = null
    if (input?.parentId !== undefined) {
      parentId = typeof input.parentId === 'string' && input.parentId.trim() ? input.parentId.trim() : null
      if (parentId) {
        if (!vault.groups.some((group) => group.id === parentId)) {
          return { success: false, error: PASSWORD_VAULT_ERRORS.GROUP_NOT_FOUND }
        }
        if (id) {
          const seen = new Set()
          let cursor = parentId
          while (cursor && !seen.has(cursor)) {
            if (cursor === id) return { success: false, error: PASSWORD_VAULT_ERRORS.GROUP_NOT_FOUND }
            seen.add(cursor)
            cursor = vault.groups.find((group) => group.id === cursor)?.parentId || null
          }
        }
      }
    }

    const now = new Date().toISOString()
    let groupId = id
    if (id) {
      const group = vault.groups.find((item) => item.id === id)
      if (!group) return { success: false, error: PASSWORD_VAULT_ERRORS.GROUP_NOT_FOUND }
      group.name = name
      group.notes = notes
      if (input?.parentId !== undefined) group.parentId = parentId
      group.updatedAt = now
    } else {
      const group = normalizePasswordGroup({ name, notes, parentId, createdAt: now, updatedAt: now })
      groupId = group.id
      vault.groups.push(group)
    }

    await persistVault(vault, auth)
    return { success: true, id: groupId, ...toPublicState(vault) }
  })
}

export async function deletePasswordGroup(id) {
  return withWriteLock(async () => {
    if (!vaultUnlocked) return { success: false, error: PASSWORD_VAULT_ERRORS.VAULT_LOCKED }
    const { vault, auth } = await loadVaultData()
    const index = vault.groups.findIndex((group) => group.id === id)
    if (index === -1) return { success: false, error: PASSWORD_VAULT_ERRORS.GROUP_NOT_FOUND }

    const [removed] = vault.groups.splice(index, 1)
    const now = new Date().toISOString()
    for (const group of vault.groups) {
      if (group.parentId !== removed.id) continue
      group.parentId = removed.parentId || null
      group.updatedAt = now
    }
    for (const entry of vault.entries) {
      if (entry.groupId === removed.id) {
        entry.groupId = null
        entry.updatedAt = now
      }
    }

    await persistVault(vault, auth)
    return { success: true, ...toPublicState(vault) }
  })
}

export async function savePasswordEntry(input = {}) {
  return withWriteLock(async () => {
    if (!vaultUnlocked) return { success: false, error: PASSWORD_VAULT_ERRORS.VAULT_LOCKED }
    const { vault, auth } = await loadVaultData()
    const title = String(input?.title ?? '').trim()
    if (!title) return { success: false, error: PASSWORD_VAULT_ERRORS.ENTRY_TITLE_REQUIRED }

    const requestedGroupId = typeof input?.groupId === 'string' ? input.groupId.trim() : ''
    const groupId =
      requestedGroupId && vault.groups.some((group) => group.id === requestedGroupId) ? requestedGroupId : null
    let id = typeof input?.id === 'string' ? input.id.trim() : ''
    const now = new Date().toISOString()
    const passwordInput = typeof input?.password === 'string' ? input.password : ''

    const draft = {
      ...input,
      groupId,
      title,
      createdAt: now,
      updatedAt: now
    }

    if (id) {
      const entry = vault.entries.find((item) => item.id === id)
      if (!entry) return { success: false, error: PASSWORD_VAULT_ERRORS.ENTRY_NOT_FOUND }
      const normalized = normalizePasswordEntry({ ...draft, id, createdAt: entry.createdAt }, now)
      normalized.password = !passwordInput || passwordInput === PASSWORD_MASK ? entry.password : passwordInput
      Object.assign(entry, normalized)
    } else {
      const normalized = normalizePasswordEntry(draft, now)
      normalized.password = passwordInput
      vault.entries.push(normalized)
      id = normalized.id
    }

    await persistVault(vault, auth)
    return { success: true, id, ...toPublicState(vault) }
  })
}

export async function deletePasswordEntry(id) {
  return withWriteLock(async () => {
    if (!vaultUnlocked) return { success: false, error: PASSWORD_VAULT_ERRORS.VAULT_LOCKED }
    const { vault, auth } = await loadVaultData()
    const index = vault.entries.findIndex((entry) => entry.id === id)
    if (index === -1) return { success: false, error: PASSWORD_VAULT_ERRORS.ENTRY_NOT_FOUND }

    vault.entries.splice(index, 1)
    await persistVault(vault, auth)
    return { success: true, ...toPublicState(vault) }
  })
}

export async function revealPasswordEntry(id) {
  if (!vaultUnlocked) return { success: false, error: PASSWORD_VAULT_ERRORS.VAULT_LOCKED }
  const { vault } = await loadVaultData()
  const entry = vault.entries.find((item) => item.id === id)
  if (!entry) return { success: false, error: PASSWORD_VAULT_ERRORS.ENTRY_NOT_FOUND }
  return { success: true, password: entry.password }
}
