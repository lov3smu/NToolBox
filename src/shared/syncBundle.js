export const SYNC_FORMAT = 'ntoolbox-sync'
export const SYNC_VERSION = 1
export const SYNC_FILE_NAME = 'ntoolbox-sync.json'
export const SYNC_MAX_BYTES = 1024 * 1024

export const SYNC_SECTION_IDS = Object.freeze([
  'appearance',
  'shortcuts',
  'notifications',
  'clipboard',
  'network',
  'database',
  'sql_generator',
  'ai',
  'memory'
])

// 每个分区只允许这些键进入同步文件，密钥、连接、凭据与设备路径一律排除
const SECTION_FIELDS = Object.freeze({
  appearance: ['theme', 'theme_style', 'font_size', 'language'],
  network: ['market_sources'],
  database: [
    'safe_mode',
    'page_size',
    'refresh_interval',
    'transfer_batch_size',
    'history_limit',
    'audit',
    'operation_log_enabled',
    'editor'
  ],
  sql_generator: ['developer', 'databases', 'script_types'],
  ai: ['persona', 'temperature', 'timeout', 'context', 'attachments', 'agent', 'tool_result'],
  memory: ['auto_capture']
})

const AI_AGENT_FIELDS = Object.freeze([
  'max_iterations',
  'timeout_min',
  'max_plan_steps',
  'max_parallel_tools',
  'tool_policy'
])

const DEVICE_ID_MAX = 64
const DEVICE_NAME_MAX = 60

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function pickFields(source, fields) {
  if (!isPlainObject(source)) return {}
  const result = {}
  for (const field of fields) {
    if (source[field] === undefined) continue
    result[field] = cloneValue(source[field])
  }
  return result
}

function pickFlat(source) {
  if (!isPlainObject(source)) return {}
  const result = {}
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
    result[key] = value
  }
  return result
}

function readPath(source, pathParts) {
  let current = source
  for (const part of pathParts) {
    if (!isPlainObject(current)) return undefined
    current = current[part]
  }
  return current
}

function extractSectionValues(id, config) {
  switch (id) {
    case 'shortcuts':
      return pickFlat(readPath(config, ['app', 'shortcuts']))
    case 'notifications':
      return pickFlat(config?.notifications)
    case 'clipboard':
      return pickFlat(config?.clipboard_history)
    case 'ai': {
      const ai = isPlainObject(config?.ai) ? config.ai : {}
      const values = pickFields(ai, SECTION_FIELDS.ai)
      if (isPlainObject(ai.agent)) values.agent = pickFields(ai.agent, AI_AGENT_FIELDS)
      return values
    }
    default:
      return pickFields(config?.[id], SECTION_FIELDS[id] || [])
  }
}

export function isSyncSectionId(id) {
  return SYNC_SECTION_IDS.includes(id)
}

export function extractSyncSections(config) {
  const result = {}
  for (const id of SYNC_SECTION_IDS) result[id] = extractSectionValues(id, config)
  return result
}

export function buildSyncPatch(valuesBySection) {
  const patch = {}
  if (!isPlainObject(valuesBySection)) return patch

  for (const id of SYNC_SECTION_IDS) {
    const values = valuesBySection[id]
    if (!isPlainObject(values)) continue
    if (id === 'shortcuts') {
      const shortcuts = pickFlat(values)
      if (Object.keys(shortcuts).length > 0) patch.app = { shortcuts }
      continue
    }
    if (id === 'notifications') {
      const notifications = pickFlat(values)
      if (Object.keys(notifications).length > 0) patch.notifications = notifications
      continue
    }
    if (id === 'clipboard') {
      const history = pickFlat(values)
      if (Object.keys(history).length > 0) patch.clipboard_history = history
      continue
    }
    if (id === 'ai') {
      const ai = pickFields(values, SECTION_FIELDS.ai)
      if (isPlainObject(values.agent)) {
        const agent = pickFields(values.agent, AI_AGENT_FIELDS)
        if (Object.keys(agent).length > 0) ai.agent = agent
      }
      if (Object.keys(ai).length > 0) patch.ai = ai
      continue
    }
    if (id === 'network') {
      const network = pickFields(values, SECTION_FIELDS.network)
      if (Object.keys(network).length > 0) patch.network = network
      continue
    }
    const section = pickFields(values, SECTION_FIELDS[id] || [])
    if (Object.keys(section).length > 0) patch[id] = section
  }

  return patch
}

function normalizeDevice(raw) {
  const id = typeof raw?.id === 'string' ? raw.id.trim().slice(0, DEVICE_ID_MAX) : ''
  const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, DEVICE_NAME_MAX) : ''
  return { id, name }
}

export function normalizeSyncDevice(raw) {
  return normalizeDevice(raw)
}

export function buildSyncSnapshot({ sections, device, updatedAt } = {}) {
  const snapshotSections = {}
  if (isPlainObject(sections)) {
    for (const id of SYNC_SECTION_IDS) {
      const entry = sections[id]
      if (!isPlainObject(entry) || !isPlainObject(entry.values)) continue
      snapshotSections[id] = {
        updated_at: Number.isFinite(entry.updated_at) ? Math.max(0, Math.floor(entry.updated_at)) : 0,
        values: cloneValue(entry.values)
      }
    }
  }
  return {
    type: SYNC_FORMAT,
    version: SYNC_VERSION,
    updated_at: typeof updatedAt === 'string' && updatedAt ? updatedAt : new Date().toISOString(),
    device: normalizeDevice(device),
    sections: snapshotSections
  }
}

export function parseSyncSnapshot(raw) {
  let payload = raw
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw)
    } catch {
      return { ok: false, code: 'format' }
    }
  }
  if (!isPlainObject(payload)) return { ok: false, code: 'format' }
  if (payload.type !== SYNC_FORMAT) return { ok: false, code: 'type' }

  const version = Number(payload.version)
  if (!Number.isInteger(version) || version < 1 || version > SYNC_VERSION) {
    return { ok: false, code: 'version' }
  }
  if (!isPlainObject(payload.sections)) return { ok: false, code: 'sections' }

  const sections = {}
  for (const id of SYNC_SECTION_IDS) {
    const entry = payload.sections[id]
    if (entry === undefined) continue
    if (!isPlainObject(entry) || !isPlainObject(entry.values)) return { ok: false, code: 'sections' }
    if (!Number.isFinite(Number(entry.updated_at))) return { ok: false, code: 'sections' }
    sections[id] = {
      updated_at: Math.max(0, Math.floor(Number(entry.updated_at))),
      values: cloneValue(entry.values)
    }
  }

  return {
    ok: true,
    snapshot: {
      updated_at: typeof payload.updated_at === 'string' ? payload.updated_at : '',
      device: normalizeDevice(payload.device),
      sections
    }
  }
}

function valuesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

const MAX_FUTURE_SKEW_MS = 15 * 60 * 1000

function clampClock(time, now) {
  const value = Number(time) || 0
  return value > now + MAX_FUTURE_SKEW_MS ? now + MAX_FUTURE_SKEW_MS : value
}

export function mergeSyncSections(localSections, remoteSections) {
  const local = isPlainObject(localSections) ? localSections : {}
  const remote = isPlainObject(remoteSections) ? remoteSections : {}
  const sections = {}
  const applied = []
  const pushed = []
  const now = Date.now()

  for (const id of SYNC_SECTION_IDS) {
    const localEntry = isPlainObject(local[id]) ? local[id] : null
    const remoteEntry = isPlainObject(remote[id]) ? remote[id] : null
    if (!localEntry && !remoteEntry) continue
    if (!remoteEntry) {
      sections[id] = localEntry
      pushed.push(id)
      continue
    }
    if (!localEntry) {
      sections[id] = remoteEntry
      applied.push(id)
      continue
    }

    const localTime = clampClock(localEntry.updated_at, now)
    const remoteTime = clampClock(remoteEntry.updated_at, now)
    if (valuesEqual(localEntry.values, remoteEntry.values)) {
      sections[id] = localTime >= remoteTime ? localEntry : remoteEntry
      continue
    }
    if (localTime > remoteTime) {
      sections[id] = localEntry
      pushed.push(id)
    } else if (remoteTime > localTime) {
      sections[id] = remoteEntry
      applied.push(id)
    } else {
      sections[id] = localEntry
      pushed.push(id)
    }
  }

  return { sections, applied, pushed }
}
