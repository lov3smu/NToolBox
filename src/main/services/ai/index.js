import {
  PROVIDER_REGISTRY,
  PROVIDER_TYPES,
  PROVIDER_INFO,
  AUTO_PRIORITY,
  getProviderEntry,
  getContextWindow
} from './registry.js'
import { supportsThinking } from './thinking.js'
import { t } from '../i18n.js'
import { log } from '../../utils'

export { PROVIDER_TYPES, PROVIDER_INFO, AUTO_PRIORITY, getContextWindow }

function applyModelOverrides(provider, config) {
  if (!provider) return provider
  if (Array.isArray(config.models) && config.models.length > 0) {
    provider.models = config.models
  }
  if (config.defaultModel) {
    provider.defaultModel = config.defaultModel
  }
  return provider
}

export function createProvider(type, config = {}) {
  const entry = getProviderEntry(type)
  if (!entry) {
    log.error(`未知的 Provider 类型: ${type}`)
    return null
  }
  log.info(`创建 AI Provider: ${type}`)

  const provider = new entry.Provider(config)
  if (config.baseUrl) provider.setBaseUrl(config.baseUrl)
  return applyModelOverrides(provider, config)
}

// 每次调用返回独立实例，避免并发会话共享可变配置（apiKey/baseUrl/models）
export function getProvider(type, config = {}) {
  return createProvider(type, config)
}

export function getProviderEnvApiKey(type) {
  const envKey = PROVIDER_INFO[type]?.envKey
  if (!envKey) return ''
  return String(process.env[envKey] || '').trim()
}

export function resolveProviderRuntimeConfig(type, config = {}) {
  const apiKeys = config.ai?.keys || {}
  const baseUrls = config.ai?.base_urls || {}
  const endpointId = type === PROVIDER_TYPES.VOLCENGINE ? apiKeys.volcengine_endpoint_id || '' : ''
  const storedKey = typeof apiKeys[type] === 'string' ? apiKeys[type].trim() : ''
  const runtime = {
    apiKey: storedKey || getProviderEnvApiKey(type),
    baseUrl: typeof baseUrls[type] === 'string' ? baseUrls[type].trim() : '',
    timeout: config.ai?.timeout ? config.ai?.timeout * 1000 : 60000,
    connectionTimeout: config.ai?.connection_timeout ? config.ai?.connection_timeout * 1000 : 10000,
    models: resolveProviderModels(type, config.ai?.models),
    defaultModel: resolveProviderDefaultModel(type, config.ai?.models, endpointId)
  }
  if (type === PROVIDER_TYPES.MINIMAX) runtime.groupId = apiKeys.minimax_group_id || ''
  if (type === PROVIDER_TYPES.VOLCENGINE) runtime.endpointId = endpointId
  return runtime
}

export function getDefaultProviderModels(type) {
  const provider = createProvider(type, { apiKey: '' })
  return provider ? provider.getModels() : []
}

function normalizeModelOptions(models) {
  if (!Array.isArray(models)) return []
  return models
    .map((model) => {
      if (!model || typeof model !== 'object') return null
      const id = typeof model.id === 'string' ? model.id.trim() : ''
      if (!id) return null
      const name = typeof model.name === 'string' && model.name.trim() ? model.name.trim() : id
      const normalized = { id, name }
      const contextWindow = Number(model.contextWindow)
      if (Number.isFinite(contextWindow) && contextWindow > 0) {
        normalized.contextWindow = Math.floor(contextWindow)
      }
      const maxOutput = Number(model.maxOutput)
      if (Number.isFinite(maxOutput) && maxOutput > 0) {
        normalized.maxOutput = Math.floor(maxOutput)
      }
      if (Array.isArray(model.inputTypes)) {
        const inputTypes = [...new Set(model.inputTypes.filter((type) => type === 'text' || type === 'image'))]
        if (inputTypes.length > 0) normalized.inputTypes = inputTypes
      }
      return normalized
    })
    .filter(Boolean)
}

export function resolveProviderModels(type, aiModels = {}) {
  const configured = normalizeModelOptions(aiModels?.[type]?.models)
  if (configured.length > 0) return configured
  return getDefaultProviderModels(type)
}

export function resolveProviderDefaultModel(type, aiModels = {}, fallbackModel = '') {
  const configured = aiModels?.[type]?.default
  if (typeof configured === 'string' && configured.trim()) return configured.trim()
  if (fallbackModel) return fallbackModel
  return resolveProviderModels(type, aiModels)[0]?.id || ''
}

export async function fetchProviderModels(type, config = {}) {
  const provider = createProvider(type, config)
  if (!provider) {
    return { success: false, models: [], error: t('未知的 AI Provider: {p0}', { p0: type }) }
  }
  return provider.listRemoteModels(config.apiKey)
}

export function getAvailableProviders(config = null) {
  const apiKeys = config?.ai?.keys || {}
  const baseUrls = config?.ai?.base_urls || {}
  return Object.entries(PROVIDER_INFO).map(([key, info]) => {
    const models = config ? resolveProviderModels(key, config.ai?.models) : getDefaultProviderModels(key)
    const envKey = info.envKey || ''
    const hasEnvKey = Boolean(envKey && String(process.env[envKey] || '').trim())
    const storedKey = typeof apiKeys[key] === 'string' ? apiKeys[key].trim() : ''
    return {
      type: key,
      name: info.name,
      description: info.description,
      requiresGroupId: info.requiresGroupId,
      requiresEndpointId: info.requiresEndpointId,
      docsUrl: info.docsUrl,
      envKey,
      hasEnvKey,
      baseUrl: typeof baseUrls[key] === 'string' ? baseUrls[key].trim() : '',
      defaultBaseUrl: info.defaultBaseUrl || '',
      models: models.map((model) => ({
        ...model,
        thinking: supportsThinking(key, model.id),
        contextWindow: model.contextWindow || getContextWindow(key)
      })),
      defaultModel: config ? resolveProviderDefaultModel(key, config.ai?.models) : models[0]?.id || '',
      hasApiKey: Boolean(storedKey || hasEnvKey)
    }
  })
}

export { default as BaseProvider } from './providers/BaseProvider.js'
export { PROVIDER_REGISTRY }
