export const HTTP_COLLECTION_LIMITS = Object.freeze({
  collections: 20,
  requestsPerCollection: 50,
  environments: 10,
  variablesPerEnvironment: 40,
  nameLength: 60,
  urlLength: 2048,
  headersLength: 8000,
  bodyLength: 100000,
  variableKeyLength: 60,
  variableValueLength: 2000
})

export const HTTP_VARIABLE_PATTERN = /\{\{\s*([^{}\n]+?)\s*\}\}/g

const SECRET_VARIABLE_PREFIX = 'secret:'

function isDeferredSecretVariable(name) {
  return name.toLowerCase().startsWith(SECRET_VARIABLE_PREFIX)
}

const DEFAULT_TIMEOUT_SECONDS = 30

function clampText(value, max) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function normalizeTimeoutSeconds(value) {
  const number = Math.round(Number(value))
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_TIMEOUT_SECONDS
  return Math.min(120, Math.max(1, number))
}

export function createHttpItemId(prefix = 'h') {
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

export function normalizeHttpVariableKey(raw) {
  const key = clampText(raw, HTTP_COLLECTION_LIMITS.variableKeyLength).trim()
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ? key : ''
}

export function parseHttpEnvironmentLines(text) {
  const source = typeof text === 'string' ? text : ''
  const variables = {}
  const errors = []
  let count = 0
  const lines = source.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) {
      errors.push(index + 1)
      continue
    }
    const key = normalizeHttpVariableKey(line.slice(0, separator))
    if (!key) {
      errors.push(index + 1)
      continue
    }
    count += 1
    if (count > HTTP_COLLECTION_LIMITS.variablesPerEnvironment) {
      errors.push(index + 1)
      continue
    }
    variables[key] = clampText(line.slice(separator + 1), HTTP_COLLECTION_LIMITS.variableValueLength).trim()
  }
  return { ok: errors.length === 0, variables, errors }
}

export function formatHttpEnvironmentLines(variables) {
  if (!variables || typeof variables !== 'object') return ''
  return Object.entries(variables)
    .map(([key, value]) => `${key}=${value ?? ''}`)
    .join('\n')
}

export function extractHttpVariableNames(text) {
  const source = typeof text === 'string' ? text : ''
  const names = new Set()
  for (const match of source.matchAll(HTTP_VARIABLE_PATTERN)) {
    const name = match[1].trim()
    if (name) names.add(name)
  }
  return [...names]
}

export function substituteHttpVariables(text, variables) {
  const source = typeof text === 'string' ? text : ''
  const map = variables && typeof variables === 'object' ? variables : {}
  const missing = new Set()
  const value = source.replace(HTTP_VARIABLE_PATTERN, (raw, rawName) => {
    const name = String(rawName).trim()
    if (isDeferredSecretVariable(name)) return raw
    if (!Object.prototype.hasOwnProperty.call(map, name)) {
      missing.add(name)
      return raw
    }
    return String(map[name] ?? '')
  })
  return { ok: missing.size === 0, value, missing: [...missing] }
}

export function normalizeHttpEnvironment(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = clampText(raw.name, HTTP_COLLECTION_LIMITS.nameLength).trim()
  if (!name) return null
  const variables = {}
  if (raw.variables && typeof raw.variables === 'object') {
    for (const [rawKey, rawValue] of Object.entries(raw.variables)) {
      if (Object.keys(variables).length >= HTTP_COLLECTION_LIMITS.variablesPerEnvironment) break
      const key = normalizeHttpVariableKey(rawKey)
      if (!key) continue
      variables[key] = clampText(rawValue, HTTP_COLLECTION_LIMITS.variableValueLength).trim()
    }
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createHttpItemId('env'),
    name,
    variables
  }
}

export function normalizeHttpRequest(raw) {
  if (!raw || typeof raw !== 'object') return null
  const url = clampText(raw.url, HTTP_COLLECTION_LIMITS.urlLength).trim()
  const name = clampText(raw.name, HTTP_COLLECTION_LIMITS.nameLength).trim() || url
  if (!url) return null
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createHttpItemId('req'),
    name,
    method: typeof raw.method === 'string' && raw.method.trim() ? raw.method.trim().toUpperCase() : 'GET',
    url,
    headersText: clampText(raw.headersText, HTTP_COLLECTION_LIMITS.headersLength),
    body: clampText(raw.body, HTTP_COLLECTION_LIMITS.bodyLength),
    timeoutSeconds: normalizeTimeoutSeconds(raw.timeoutSeconds)
  }
}

export function normalizeHttpCollection(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = clampText(raw.name, HTTP_COLLECTION_LIMITS.nameLength).trim()
  if (!name) return null
  const requests = []
  if (Array.isArray(raw.requests)) {
    for (const item of raw.requests) {
      if (requests.length >= HTTP_COLLECTION_LIMITS.requestsPerCollection) break
      const request = normalizeHttpRequest(item)
      if (request) requests.push(request)
    }
  }
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createHttpItemId('col'),
    name,
    requests
  }
}

export function normalizeHttpClientState(raw) {
  const state = { collections: [], environments: [], activeEnvironmentId: '' }
  if (!raw || typeof raw !== 'object') return state

  if (Array.isArray(raw.environments)) {
    for (const item of raw.environments) {
      if (state.environments.length >= HTTP_COLLECTION_LIMITS.environments) break
      const environment = normalizeHttpEnvironment(item)
      if (environment) state.environments.push(environment)
    }
  }

  if (Array.isArray(raw.collections)) {
    for (const item of raw.collections) {
      if (state.collections.length >= HTTP_COLLECTION_LIMITS.collections) break
      const collection = normalizeHttpCollection(item)
      if (collection) state.collections.push(collection)
    }
  }

  if (typeof raw.activeEnvironmentId === 'string') {
    const active = state.environments.find((item) => item.id === raw.activeEnvironmentId)
    state.activeEnvironmentId = active ? active.id : ''
  }
  return state
}

export function findHttpEnvironment(state, id) {
  if (!state || !Array.isArray(state.environments)) return null
  return state.environments.find((item) => item.id === id) || null
}
