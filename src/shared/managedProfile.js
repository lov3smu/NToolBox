export const MANAGED_PROFILE_TYPE = 'ntoolbox-managed-profile'
export const MANAGED_PROFILE_VERSION = 1
export const MANAGED_PROFILE_MAX_BYTES = 2 * 1024 * 1024

export const MANAGED_PROFILE_PATHS = Object.freeze([
  { path: 'ai.provider', label: '默认模型服务', group: 'AI 助手' },
  { path: 'ai.models', label: '模型清单', group: 'AI 助手' },
  { path: 'ai.base_urls', label: '服务地址', group: 'AI 助手' },
  { path: 'ai.fallback', label: '备用模型', group: 'AI 助手' },
  { path: 'ai.agent', label: '运行与工具策略', group: 'AI 助手' },
  { path: 'ai.context', label: '上下文压缩', group: 'AI 助手' },
  { path: 'ai.tool_result', label: '工具结果保留', group: 'AI 助手' },
  { path: 'database.safe_mode', label: '数据库安全模式', group: '数据库' },
  { path: 'database.audit', label: 'SQL 审计', group: '数据库' },
  { path: 'database.operation_log_enabled', label: '操作日志', group: '数据库' },
  { path: 'network.market_sources', label: '扩展与更新源', group: '网络' },
  { path: 'extensions.disabled_skills', label: '禁用的技能', group: '扩展' },
  { path: 'extensions.skill_overrides', label: '技能覆盖', group: '扩展' }
])

export const MANAGED_PROFILE_ERROR_CODES = Object.freeze({
  FORMAT: 'format',
  TYPE: 'type',
  VERSION: 'version',
  SETTINGS: 'settings',
  EMPTY: 'empty',
  SIZE: 'size'
})

const MAX_NAME_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 500
const MAX_TIMESTAMP_LENGTH = 64

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeText(value, maxLength) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLength)
}

function cloneValue(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

export function getValueAtPath(source, dottedPath) {
  if (!isPlainObject(source) || typeof dottedPath !== 'string') return undefined
  let current = source
  for (const key of dottedPath.split('.')) {
    if (!current || typeof current !== 'object') return undefined
    current = current[key]
  }
  return current
}

export function setValueAtPath(target, dottedPath, value) {
  if (!isPlainObject(target) || typeof dottedPath !== 'string') return target
  const keys = dottedPath.split('.')
  let current = target
  for (let index = 0; index < keys.length - 1; index += 1) {
    if (!isPlainObject(current[keys[index]])) current[keys[index]] = {}
    current = current[keys[index]]
  }
  current[keys[keys.length - 1]] = cloneValue(value)
  return target
}

export function deleteValueAtPath(target, dottedPath) {
  if (!isPlainObject(target) || typeof dottedPath !== 'string') return target
  const keys = dottedPath.split('.')
  const chain = [target]
  let current = target
  for (let index = 0; index < keys.length - 1; index += 1) {
    if (!isPlainObject(current[keys[index]])) return target
    current = current[keys[index]]
    chain.push(current)
  }
  delete current[keys[keys.length - 1]]
  for (let depth = chain.length - 1; depth >= 1; depth -= 1) {
    if (Object.keys(chain[depth]).length > 0) break
    delete chain[depth - 1][keys[depth - 1]]
  }
  return target
}

export function extractManagedSettings(settings) {
  const extracted = {}
  const paths = []
  if (!isPlainObject(settings)) return { settings: extracted, paths }
  for (const info of MANAGED_PROFILE_PATHS) {
    const value = getValueAtPath(settings, info.path)
    if (value === undefined || value === null) continue
    setValueAtPath(extracted, info.path, value)
    paths.push(info.path)
  }
  return { settings: extracted, paths }
}

export function listManagedProfilePaths(settings) {
  const { paths } = extractManagedSettings(settings)
  return MANAGED_PROFILE_PATHS.filter((info) => paths.includes(info.path))
}

export function applyManagedSettings(target, settings) {
  if (!isPlainObject(target) || !isPlainObject(settings)) return target
  for (const info of MANAGED_PROFILE_PATHS) {
    const value = getValueAtPath(settings, info.path)
    if (value === undefined) continue
    setValueAtPath(target, info.path, value)
  }
  return target
}

export function parseManagedProfile(raw) {
  let payload = raw
  if (typeof raw === 'string') {
    if (raw.length > MANAGED_PROFILE_MAX_BYTES) {
      return { ok: false, code: MANAGED_PROFILE_ERROR_CODES.SIZE }
    }
    try {
      payload = JSON.parse(raw)
    } catch {
      return { ok: false, code: MANAGED_PROFILE_ERROR_CODES.FORMAT }
    }
  }
  if (!isPlainObject(payload)) return { ok: false, code: MANAGED_PROFILE_ERROR_CODES.FORMAT }
  if (payload.type !== MANAGED_PROFILE_TYPE) return { ok: false, code: MANAGED_PROFILE_ERROR_CODES.TYPE }

  const version = Number(payload.version)
  if (!Number.isInteger(version) || version < 1 || version > MANAGED_PROFILE_VERSION) {
    return { ok: false, code: MANAGED_PROFILE_ERROR_CODES.VERSION }
  }
  if (!isPlainObject(payload.settings)) {
    return { ok: false, code: MANAGED_PROFILE_ERROR_CODES.SETTINGS }
  }

  const { settings, paths } = extractManagedSettings(payload.settings)
  if (paths.length === 0) return { ok: false, code: MANAGED_PROFILE_ERROR_CODES.EMPTY }

  return {
    ok: true,
    profile: {
      name: normalizeText(payload.name, MAX_NAME_LENGTH) || '团队托管配置',
      owner: normalizeText(payload.owner, MAX_NAME_LENGTH),
      description: normalizeText(payload.description, MAX_DESCRIPTION_LENGTH),
      updatedAt: normalizeText(payload.updated_at, MAX_TIMESTAMP_LENGTH),
      settings,
      paths
    }
  }
}
