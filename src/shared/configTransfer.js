import { IMAGE_HOST_PROVIDERS } from './imageHosts.js'
import { SECRET_MASK } from './secrets.js'

export const CONFIG_EXPORT_TYPE = 'ntoolbox-config'
export const CONFIG_EXPORT_VERSION = 1
export const CONFIG_IMPORT_MAX_BYTES = 2 * 1024 * 1024

export const CONFIG_IMPORT_ERROR_CODES = Object.freeze({
  FORMAT: 'format',
  TYPE: 'type',
  VERSION: 'version',
  CONFIG: 'config',
  SIZE: 'size',
  READ: 'read'
})

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function maskSecretsForExport(config) {
  const keys = config.ai?.keys
  if (isPlainObject(keys)) {
    for (const name of Object.keys(keys)) {
      keys[name] = typeof keys[name] === 'string' && keys[name].trim() ? SECRET_MASK : ''
    }
  }

  if (Array.isArray(config.database?.connections)) {
    for (const connection of config.database.connections) {
      if (isPlainObject(connection)) connection.password = ''
    }
  }

  const providers = config.image_hosting?.providers
  if (isPlainObject(providers)) {
    for (const provider of IMAGE_HOST_PROVIDERS) {
      const values = providers[provider.id]
      if (!isPlainObject(values)) continue
      for (const field of provider.fields) {
        if (field.type !== 'password') continue
        values[field.key] = typeof values[field.key] === 'string' && values[field.key].trim() ? SECRET_MASK : ''
      }
    }
  }
}

export function buildConfigExport(config, { exportedAt } = {}) {
  const source = isPlainObject(config) ? JSON.parse(JSON.stringify(config)) : {}
  maskSecretsForExport(source)
  return {
    type: CONFIG_EXPORT_TYPE,
    version: CONFIG_EXPORT_VERSION,
    exported_at: typeof exportedAt === 'string' && exportedAt ? exportedAt : new Date().toISOString(),
    config: source
  }
}

export function parseConfigExport(raw) {
  let payload = raw
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw)
    } catch {
      return { ok: false, code: CONFIG_IMPORT_ERROR_CODES.FORMAT }
    }
  }
  if (!isPlainObject(payload)) return { ok: false, code: CONFIG_IMPORT_ERROR_CODES.FORMAT }
  if (payload.type !== CONFIG_EXPORT_TYPE) return { ok: false, code: CONFIG_IMPORT_ERROR_CODES.TYPE }

  const version = Number(payload.version)
  if (!Number.isInteger(version) || version < 1 || version > CONFIG_EXPORT_VERSION) {
    return { ok: false, code: CONFIG_IMPORT_ERROR_CODES.VERSION }
  }
  if (!isPlainObject(payload.config)) return { ok: false, code: CONFIG_IMPORT_ERROR_CODES.CONFIG }

  return {
    ok: true,
    config: payload.config,
    exportedAt: typeof payload.exported_at === 'string' ? payload.exported_at : ''
  }
}

export function summarizeConfig(config) {
  const keys = config?.ai?.keys
  const connections = config?.database?.connections
  const mcpServers = config?.extensions?.mcp_servers
  const shortcuts = config?.app?.shortcuts

  return {
    providers: isPlainObject(keys)
      ? Object.values(keys).filter((value) => typeof value === 'string' && value.trim()).length
      : 0,
    connections: Array.isArray(connections) ? connections.length : 0,
    mcpServers: Array.isArray(mcpServers) ? mcpServers.length : 0,
    shortcuts: isPlainObject(shortcuts)
      ? Object.values(shortcuts).filter((value) => typeof value === 'string' && value.trim()).length
      : 0
  }
}
