import BailianProvider from './providers/BailianProvider.js'
import MoonshotProvider from './providers/MoonshotProvider.js'
import ZhipuProvider from './providers/ZhipuProvider.js'
import MinimaxProvider from './providers/MinimaxProvider.js'
import VolcengineProvider from './providers/VolcengineProvider.js'
import DeepSeekProvider from './providers/DeepSeekProvider.js'
import { supportsThinking, getContextWindow } from './capabilities.js'
import { log } from '../../utils'

export const PROVIDER_TYPES = {
  BAILIAN: 'bailian',
  MOONSHOT: 'moonshot',
  ZHIPU: 'zhipu',
  MINIMAX: 'minimax',
  VOLCENGINE: 'volcengine',
  DEEPSEEK: 'deepseek'
}

export const PROVIDER_INFO = {
  [PROVIDER_TYPES.BAILIAN]: {
    name: '百炼',
    description: '阿里云百炼通义千问',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://bailian.console.aliyun.com/'
  },
  [PROVIDER_TYPES.MOONSHOT]: {
    name: 'Kimi',
    description: '月之暗面 Kimi 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.kimi.com/'
  },
  [PROVIDER_TYPES.ZHIPU]: {
    name: '智谱AI',
    description: '智谱 GLM 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://docs.bigmodel.cn/'
  },
  [PROVIDER_TYPES.MINIMAX]: {
    name: 'MiniMax',
    description: 'MiniMax 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.minimaxi.com/'
  },
  [PROVIDER_TYPES.VOLCENGINE]: {
    name: '火山方舟',
    description: '火山引擎 Doubao 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://console.volcengine.com/ark'
  },
  [PROVIDER_TYPES.DEEPSEEK]: {
    name: 'DeepSeek',
    description: 'DeepSeek 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.deepseek.com/api_keys'
  }
}

let currentProvider = null
let currentProviderType = null

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
  log.info(`创建 AI Provider: ${type}`)

  let provider
  switch (type) {
    case PROVIDER_TYPES.BAILIAN:
      provider = new BailianProvider(config.apiKey, config.timeout, config.connectionTimeout)
      break
    case PROVIDER_TYPES.MOONSHOT:
      provider = new MoonshotProvider(config.apiKey, config.timeout, config.connectionTimeout)
      break
    case PROVIDER_TYPES.ZHIPU:
      provider = new ZhipuProvider(config.apiKey, config.timeout, config.connectionTimeout)
      break
    case PROVIDER_TYPES.MINIMAX:
      provider = new MinimaxProvider(config.apiKey, config.groupId, config.timeout, config.connectionTimeout)
      break
    case PROVIDER_TYPES.VOLCENGINE:
      provider = new VolcengineProvider(config.apiKey, config.endpointId, config.timeout, config.connectionTimeout)
      break
    case PROVIDER_TYPES.DEEPSEEK:
      provider = new DeepSeekProvider(config.apiKey, config.timeout, config.connectionTimeout)
      break
    default:
      log.error(`未知的 Provider 类型: ${type}`)
      return null
  }

  return applyModelOverrides(provider, config)
}

export function getProvider(type, config = {}) {
  if (currentProvider && currentProviderType === type) {
    currentProvider.apiKey = config.apiKey
    if (config.groupId !== undefined) currentProvider.groupId = config.groupId
    if (config.endpointId !== undefined) currentProvider.endpointId = config.endpointId
    applyModelOverrides(currentProvider, config)
    return currentProvider
  }

  currentProvider = createProvider(type, config)
  currentProviderType = type

  return currentProvider
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
      return { id, name }
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
    return { success: false, models: [], error: `未知的 AI Provider: ${type}` }
  }
  return provider.listRemoteModels(config.apiKey)
}

export function getCurrentProvider() {
  return currentProvider
}

export function getAvailableProviders(config = null) {
  return Object.entries(PROVIDER_INFO).map(([key, info]) => {
    const models = config ? resolveProviderModels(key, config.ai_models) : getDefaultProviderModels(key)
    return {
      type: key,
      name: info.name,
      description: info.description,
      requiresGroupId: info.requiresGroupId,
      requiresEndpointId: info.requiresEndpointId,
      docsUrl: info.docsUrl,
      models: models.map((model) => ({
        ...model,
        thinking: supportsThinking(key, model.id),
        contextWindow: getContextWindow(key)
      })),
      defaultModel: config ? resolveProviderDefaultModel(key, config.ai_models) : models[0]?.id || '',
      hasApiKey: config ? Boolean((config.ai_api_keys || {})[key]?.trim?.()) : false
    }
  })
}

export { default as BaseProvider } from './providers/BaseProvider.js'
export { getContextWindow } from './capabilities.js'
