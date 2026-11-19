export const PASSWORD_VAULT_VERSION = 1

export const PASSWORD_MASK = '••••••••'

export const MAX_GROUP_NAME_LENGTH = 60
export const MAX_GROUP_NOTES_LENGTH = 4000
export const MAX_ENTRY_TITLE_LENGTH = 120
export const MAX_ENTRY_USERNAME_LENGTH = 200
export const MAX_ENTRY_PASSWORD_LENGTH = 512
export const MAX_ENTRY_URL_LENGTH = 1024
export const MAX_ENTRY_NOTES_LENGTH = 4000
export const MAX_ENTRY_TAGS = 12
export const MAX_TAG_LENGTH = 24

export const MIN_MASTER_PASSWORD_LENGTH = 8
export const MAX_MASTER_PASSWORD_LENGTH = 128

export const PASSWORD_VAULT_ERRORS = Object.freeze({
  GROUP_NAME_REQUIRED: 'GROUP_NAME_REQUIRED',
  GROUP_NAME_DUPLICATE: 'GROUP_NAME_DUPLICATE',
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  ENTRY_TITLE_REQUIRED: 'ENTRY_TITLE_REQUIRED',
  ENTRY_NOT_FOUND: 'ENTRY_NOT_FOUND',
  VAULT_UNAVAILABLE: 'VAULT_UNAVAILABLE',
  VAULT_LOCKED: 'VAULT_LOCKED',
  MASTER_PASSWORD_REQUIRED: 'MASTER_PASSWORD_REQUIRED',
  MASTER_PASSWORD_TOO_SHORT: 'MASTER_PASSWORD_TOO_SHORT',
  MASTER_PASSWORD_TOO_LONG: 'MASTER_PASSWORD_TOO_LONG',
  MASTER_PASSWORD_INCORRECT: 'MASTER_PASSWORD_INCORRECT',
  MASTER_PASSWORD_ALREADY_SET: 'MASTER_PASSWORD_ALREADY_SET',
  MASTER_PASSWORD_NOT_SET: 'MASTER_PASSWORD_NOT_SET'
})

function randomSuffix() {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '').slice(0, 16)
  }
  const random = Math.random().toString(36).slice(2, 10)
  return `${Date.now().toString(36)}${random}`.slice(0, 16)
}

export function createPasswordId(prefix = 'item') {
  return `${prefix}-${randomSuffix()}`
}

function normalizeText(value, maxLength) {
  return String(value ?? '')
    .trim()
    .slice(0, maxLength)
}

function normalizeTimestamp(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    const time = Date.parse(value)
    if (Number.isFinite(time)) return new Date(time).toISOString()
  }
  return fallback
}

export function normalizeTags(value) {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，、;；\n\r]+/) : []
  const seen = new Set()
  const tags = []
  for (const raw of list) {
    const tag = normalizeText(raw, MAX_TAG_LENGTH)
    const key = tag.toLowerCase()
    if (!tag || seen.has(key)) continue
    seen.add(key)
    tags.push(tag)
    if (tags.length >= MAX_ENTRY_TAGS) break
  }
  return tags
}

export function normalizePasswordGroup(input = {}, now = new Date().toISOString()) {
  const source = input && typeof input === 'object' ? input : {}
  const createdAt = normalizeTimestamp(source.createdAt, now)
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : createPasswordId('grp')
  const parentId = typeof source.parentId === 'string' && source.parentId.trim() ? source.parentId.trim() : null
  return {
    id,
    parentId,
    name: normalizeText(source.name, MAX_GROUP_NAME_LENGTH),
    notes: normalizeText(source.notes, MAX_GROUP_NOTES_LENGTH),
    createdAt,
    updatedAt: normalizeTimestamp(source.updatedAt, createdAt)
  }
}

export function normalizePasswordEntry(input = {}, now = new Date().toISOString()) {
  const source = input && typeof input === 'object' ? input : {}
  const createdAt = normalizeTimestamp(source.createdAt, now)
  const id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : createPasswordId('pwd')
  const groupId = typeof source.groupId === 'string' && source.groupId.trim() ? source.groupId.trim() : null
  return {
    id,
    groupId,
    title: normalizeText(source.title, MAX_ENTRY_TITLE_LENGTH),
    username: normalizeText(source.username, MAX_ENTRY_USERNAME_LENGTH),
    password: typeof source.password === 'string' ? source.password.slice(0, MAX_ENTRY_PASSWORD_LENGTH) : '',
    url: normalizeText(source.url, MAX_ENTRY_URL_LENGTH),
    tags: normalizeTags(source.tags),
    notes: normalizeText(source.notes, MAX_ENTRY_NOTES_LENGTH),
    createdAt,
    updatedAt: normalizeTimestamp(source.updatedAt, createdAt)
  }
}

export function normalizePasswordVault(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const now = new Date().toISOString()
  const groups = []
  const groupIds = new Set()
  for (const item of Array.isArray(source.groups) ? source.groups : []) {
    const group = normalizePasswordGroup(item, now)
    if (!group.name || groupIds.has(group.id)) continue
    groupIds.add(group.id)
    groups.push(group)
  }

  const groupById = new Map(groups.map((group) => [group.id, group]))
  for (const group of groups) {
    if (!group.parentId) continue
    if (group.parentId === group.id || !groupById.has(group.parentId)) {
      group.parentId = null
      continue
    }
    const seen = new Set([group.id])
    let cursor = group.parentId
    while (cursor) {
      if (seen.has(cursor)) {
        group.parentId = null
        break
      }
      seen.add(cursor)
      cursor = groupById.get(cursor)?.parentId || null
    }
  }

  const entries = []
  const entryIds = new Set()
  for (const item of Array.isArray(source.entries) ? source.entries : []) {
    const entry = normalizePasswordEntry(item, now)
    if (entryIds.has(entry.id)) continue
    entryIds.add(entry.id)
    if (entry.groupId && !groupIds.has(entry.groupId)) entry.groupId = null
    entries.push(entry)
  }

  return {
    version: PASSWORD_VAULT_VERSION,
    groups,
    entries
  }
}
