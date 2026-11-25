import { HTTP_COLLECTION_LIMITS, normalizeHttpEnvironment } from './httpCollections.js'

export const PROFILE_LIMITS = Object.freeze({
  projects: 20,
  environmentsPerProject: 10,
  nameLength: 60,
  descriptionLength: 200,
  credentials: 50,
  aliasLength: 40,
  hintLength: 120
})

export const SECRET_ALIAS_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/
export const SECRET_MARKER_PATTERN = /\{\{\s*secret:([^{}\n]+?)\s*\}\}/g
export const SECRET_VARIABLE_PREFIX = 'secret:'

export function createProfileId(prefix = 'proj') {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

export function isSecretVariableName(name) {
  return typeof name === 'string' && name.trim().toLowerCase().startsWith(SECRET_VARIABLE_PREFIX)
}

export function normalizeSecretAlias(raw) {
  const alias = String(raw ?? '')
    .trim()
    .slice(0, PROFILE_LIMITS.aliasLength)
  return SECRET_ALIAS_PATTERN.test(alias) ? alias : ''
}

export function extractSecretAliases(text) {
  if (typeof text !== 'string' || !text.includes(SECRET_VARIABLE_PREFIX)) return []
  const aliases = new Set()
  for (const match of text.matchAll(SECRET_MARKER_PATTERN)) {
    const alias = String(match[1]).trim()
    if (alias) aliases.add(alias)
  }
  return [...aliases]
}

export function replaceSecretMarkers(text, resolve) {
  const source = typeof text === 'string' ? text : ''
  if (!source.includes(SECRET_VARIABLE_PREFIX)) return { value: source, missing: [] }
  const missing = new Set()
  const value = source.replace(SECRET_MARKER_PATTERN, (raw, rawAlias) => {
    const alias = String(rawAlias).trim()
    const resolved = typeof resolve === 'function' ? resolve(alias) : null
    if (typeof resolved !== 'string') {
      missing.add(alias)
      return raw
    }
    return resolved
  })
  return { value, missing: [...missing] }
}

export function normalizeProfile(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name ?? '')
    .trim()
    .slice(0, PROFILE_LIMITS.nameLength)
  if (!name) return null
  const environments = []
  if (Array.isArray(raw.environments)) {
    for (const item of raw.environments) {
      if (environments.length >= PROFILE_LIMITS.environmentsPerProject) break
      const environment = normalizeHttpEnvironment(item)
      if (environment) environments.push(environment)
    }
  }
  const activeEnvironmentId = environments.some((item) => item.id === raw.activeEnvironmentId)
    ? raw.activeEnvironmentId
    : environments[0]?.id || ''
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createProfileId(),
    name,
    description: String(raw.description ?? '')
      .trim()
      .slice(0, PROFILE_LIMITS.descriptionLength),
    environments,
    activeEnvironmentId,
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || 0
  }
}

export function normalizeProfiles(raw) {
  if (!Array.isArray(raw)) return []
  const projects = []
  const seen = new Set()
  for (const entry of raw) {
    if (projects.length >= PROFILE_LIMITS.projects) break
    const project = normalizeProfile(entry)
    if (!project || seen.has(project.id)) continue
    seen.add(project.id)
    projects.push(project)
  }
  return projects
}

export function findProfile(projects, id) {
  if (!Array.isArray(projects)) return null
  return projects.find((project) => project.id === id) || null
}

export function findProfileEnvironment(project, id) {
  if (!project || !Array.isArray(project.environments)) return null
  return project.environments.find((environment) => environment.id === id) || null
}

export function resolveActiveEnvironment(projects, activeProjectId) {
  const project = findProfile(projects, activeProjectId)
  if (!project) return null
  const environment = findProfileEnvironment(project, project.activeEnvironmentId) || project.environments[0] || null
  if (!environment) return { project, environment: null }
  return { project, environment }
}

export function normalizeCredential(raw) {
  if (!raw || typeof raw !== 'object') return null
  const alias = normalizeSecretAlias(raw.alias)
  const entryId = typeof raw.entryId === 'string' ? raw.entryId.trim() : ''
  if (!alias || !entryId) return null
  return {
    alias,
    entryId,
    hint: String(raw.hint ?? '')
      .trim()
      .slice(0, PROFILE_LIMITS.hintLength),
    createdAt: Number(raw.createdAt) || 0
  }
}

export function normalizeCredentials(raw) {
  if (!Array.isArray(raw)) return []
  const credentials = []
  const seen = new Set()
  for (const entry of raw) {
    if (credentials.length >= PROFILE_LIMITS.credentials) break
    const credential = normalizeCredential(entry)
    if (!credential) continue
    const key = credential.alias.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    credentials.push(credential)
  }
  return credentials
}

export function findCredential(credentials, alias) {
  if (!Array.isArray(credentials) || typeof alias !== 'string') return null
  const key = alias.trim().toLowerCase()
  if (!key) return null
  return credentials.find((credential) => credential.alias.toLowerCase() === key) || null
}

export const PROFILE_VARIABLE_LIMITS = Object.freeze({
  variablesPerEnvironment: HTTP_COLLECTION_LIMITS.variablesPerEnvironment
})
