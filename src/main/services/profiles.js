import fs from 'fs'
import path from 'path'
import { log } from '../utils'
import { getDataDir } from '../utils/path'
import { writeFileAtomic } from '../utils/atomicFile'
import {
  PROFILE_LIMITS,
  SECRET_VARIABLE_PREFIX,
  extractSecretAliases,
  findCredential,
  normalizeCredentials,
  normalizeProfile,
  normalizeProfiles,
  normalizeSecretAlias,
  replaceSecretMarkers,
  resolveActiveEnvironment
} from '../../shared/profiles.js'
import { getPasswordVaultEntryIndex, getPasswordVaultEntrySecret, isPasswordVaultUnlocked } from './passwordVault.js'
import { t } from './i18n.js'

const FILE_NAME = 'profiles.json'

let state = null
let loading = null
let writeQueue = Promise.resolve()

function profilesPath() {
  return path.join(getDataDir(), FILE_NAME)
}

function emptyState() {
  return { projects: [], activeProjectId: '', credentials: [] }
}

async function loadState() {
  if (state) return state
  if (!loading) {
    loading = (async () => {
      try {
        const raw = JSON.parse(await fs.promises.readFile(profilesPath(), 'utf8'))
        const projects = normalizeProfiles(raw?.projects)
        const activeProjectId = projects.some((project) => project.id === raw?.activeProjectId)
          ? raw.activeProjectId
          : projects[0]?.id || ''
        state = { projects, activeProjectId, credentials: normalizeCredentials(raw?.credentials) }
      } catch (error) {
        if (error.code !== 'ENOENT') log.error('读取项目环境配置失败:', error)
        state = emptyState()
      }
      return state
    })()
  }
  return loading
}

function withWriteLock(task) {
  const run = writeQueue.then(task, task)
  writeQueue = run.catch(() => {})
  return run
}

async function persistState() {
  const current = await loadState()
  await fs.promises.mkdir(getDataDir(), { recursive: true })
  await writeFileAtomic(profilesPath(), JSON.stringify(current, null, 2), 'utf8')
}

function publicState(vaultEntries) {
  const index = new Map((vaultEntries || []).map((entry) => [entry.id, entry]))
  return {
    projects: state.projects,
    activeProjectId: state.activeProjectId,
    credentials: state.credentials.map((credential) => ({
      ...credential,
      entryTitle: index.get(credential.entryId)?.title || ''
    }))
  }
}

export async function getProfilesState() {
  await loadState()
  const vaultEntries = await getPasswordVaultEntryIndex()
  return { success: true, vaultLocked: !isPasswordVaultUnlocked(), ...publicState(vaultEntries) }
}

export async function saveProjectProfile(input = {}) {
  return withWriteLock(async () => {
    await loadState()
    const name = String(input?.name ?? '')
      .trim()
      .slice(0, PROFILE_LIMITS.nameLength)
    if (!name) return { success: false, error: t('请填写项目名称') }

    const id = typeof input?.id === 'string' ? input.id.trim() : ''
    const duplicated = state.projects.some(
      (project) => project.id !== id && project.name.toLowerCase() === name.toLowerCase()
    )
    if (duplicated) return { success: false, error: t('项目名称已存在') }

    const now = Date.now()
    const environments = Array.isArray(input?.environments) ? input.environments : []
    const normalized = normalizeProfile({
      id: id || undefined,
      name,
      description: input?.description,
      environments,
      activeEnvironmentId: input?.activeEnvironmentId,
      createdAt: id ? undefined : now,
      updatedAt: now
    })
    if (!normalized) return { success: false, error: t('请填写项目名称') }

    if (id) {
      const index = state.projects.findIndex((project) => project.id === id)
      if (index === -1) return { success: false, error: t('项目不存在') }
      normalized.createdAt = state.projects[index].createdAt || now
      state.projects[index] = normalized
    } else {
      if (state.projects.length >= PROFILE_LIMITS.projects) {
        return { success: false, error: t('最多创建 {p0} 个项目', { p0: PROFILE_LIMITS.projects }) }
      }
      state.projects.push(normalized)
      if (!state.activeProjectId) state.activeProjectId = normalized.id
    }

    await persistState()
    const vaultEntries = await getPasswordVaultEntryIndex()
    return { success: true, id: normalized.id, ...publicState(vaultEntries) }
  })
}

export async function deleteProjectProfile(id) {
  return withWriteLock(async () => {
    await loadState()
    const index = state.projects.findIndex((project) => project.id === id)
    if (index === -1) return { success: false, error: t('项目不存在') }
    state.projects.splice(index, 1)
    if (state.activeProjectId === id) state.activeProjectId = state.projects[0]?.id || ''
    await persistState()
    const vaultEntries = await getPasswordVaultEntryIndex()
    return { success: true, ...publicState(vaultEntries) }
  })
}

export async function activateProjectProfile(id) {
  return withWriteLock(async () => {
    await loadState()
    if (id && !state.projects.some((project) => project.id === id)) {
      return { success: false, error: t('项目不存在') }
    }
    state.activeProjectId = id || ''
    await persistState()
    const vaultEntries = await getPasswordVaultEntryIndex()
    return { success: true, ...publicState(vaultEntries) }
  })
}

export async function getActiveProfileEnvironment() {
  await loadState()
  const active = resolveActiveEnvironment(state.projects, state.activeProjectId)
  if (!active) return { success: true, projectId: '', project: null, environment: null }
  const { project, environment } = active
  return {
    success: true,
    projectId: project.id,
    project: { id: project.id, name: project.name, description: project.description },
    environment: environment ? { id: environment.id, name: environment.name, variables: environment.variables } : null
  }
}

export async function saveProfileCredential(input = {}) {
  return withWriteLock(async () => {
    await loadState()
    if (!isPasswordVaultUnlocked()) return { success: false, error: t('请先在密码管理器中解锁凭据库') }
    const alias = normalizeSecretAlias(input?.alias)
    if (!alias) {
      return { success: false, error: t('别名只能包含字母、数字、下划线、点和短横线') }
    }
    const entryId = typeof input?.entryId === 'string' ? input.entryId.trim() : ''
    if (!entryId) return { success: false, error: t('请选择要关联的密码条目') }
    const vaultEntries = await getPasswordVaultEntryIndex()
    if (!vaultEntries.some((entry) => entry.id === entryId)) {
      return { success: false, error: t('密码条目不存在') }
    }

    const existing = findCredential(state.credentials, alias)
    if (!existing && state.credentials.length >= PROFILE_LIMITS.credentials) {
      return { success: false, error: t('最多创建 {p0} 个凭据别名', { p0: PROFILE_LIMITS.credentials }) }
    }
    const next = {
      alias,
      entryId,
      hint: String(input?.hint ?? '')
        .trim()
        .slice(0, PROFILE_LIMITS.hintLength),
      createdAt: existing?.createdAt || Date.now()
    }
    if (existing) {
      const index = state.credentials.indexOf(existing)
      state.credentials[index] = next
    } else {
      state.credentials.push(next)
    }
    await persistState()
    return { success: true, alias: next.alias, ...publicState(vaultEntries) }
  })
}

export async function deleteProfileCredential(alias) {
  return withWriteLock(async () => {
    await loadState()
    const existing = findCredential(state.credentials, alias)
    if (!existing) return { success: false, error: t('凭据别名不存在') }
    state.credentials = state.credentials.filter((credential) => credential !== existing)
    await persistState()
    const vaultEntries = await getPasswordVaultEntryIndex()
    return { success: true, ...publicState(vaultEntries) }
  })
}

async function collectSecretValues(aliases) {
  const values = new Map()
  if (!aliases.length) return values
  for (const alias of aliases) {
    const credential = findCredential(state.credentials, alias)
    if (!credential) continue
    const secret = await getPasswordVaultEntrySecret(credential.entryId)
    if (typeof secret === 'string') values.set(alias, secret)
  }
  return values
}

function collectRequestTexts(request) {
  const texts = [request.url, request.body]
  if (request.headers && typeof request.headers === 'object') {
    for (const value of Object.values(request.headers)) {
      if (typeof value === 'string') texts.push(value)
    }
  }
  return texts.filter((text) => typeof text === 'string' && text.includes(SECRET_VARIABLE_PREFIX))
}

export async function resolveRequestSecrets(request) {
  if (!request || typeof request !== 'object') return { ok: true, request }
  await loadState()
  const texts = collectRequestTexts(request)
  if (!texts.length) return { ok: true, request }
  const aliases = [...new Set(texts.flatMap((text) => extractSecretAliases(text)))]
  if (!aliases.length) return { ok: true, request }
  if (!isPasswordVaultUnlocked()) {
    return { ok: false, error: t('请求引用了密钥占位符，请先在密码管理器中解锁凭据库') }
  }

  const values = await collectSecretValues(aliases)
  const missing = aliases.filter((alias) => !values.has(alias))
  if (missing.length) {
    return { ok: false, error: t('凭据别名不可用：{p0}', { p0: missing.join('、') }) }
  }

  const replace = (text) => replaceSecretMarkers(text, (alias) => values.get(alias) ?? null)
  const resolved = { ...request }
  if (typeof resolved.url === 'string') resolved.url = replace(resolved.url).value
  if (typeof resolved.body === 'string') resolved.body = replace(resolved.body).value
  if (resolved.headers && typeof resolved.headers === 'object') {
    const headers = {}
    for (const [key, value] of Object.entries(resolved.headers)) {
      headers[key] = typeof value === 'string' ? replace(value).value : value
    }
    resolved.headers = headers
  }
  return { ok: true, request: resolved }
}
