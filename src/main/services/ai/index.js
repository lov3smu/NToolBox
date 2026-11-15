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
    docsUrl: 'https://bailian.console.aliyun.com/',
    envKey: 'DASHSCOPE_API_KEY',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  [PROVIDER_TYPES.MOONSHOT]: {
    name: 'Kimi',
    description: '月之暗面 Kimi 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.kimi.com/',
    envKey: 'MOONSHOT_API_KEY',
    defaultBaseUrl: 'https://api.moonshot.cn/v1'
  },
  [PROVIDER_TYPES.ZHIPU]: {
    name: '智谱AI',
    description: '智谱 GLM 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://docs.bigmodel.cn/',
    envKey: 'ZHIPUAI_API_KEY',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  [PROVIDER_TYPES.MINIMAX]: {
    name: 'MiniMax',
    description: 'MiniMax 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.minimaxi.com/',
    envKey: 'MINIMAX_API_KEY',
    defaultBaseUrl: 'https://api.minimax.cn/v1'
  },
  [PROVIDER_TYPES.VOLCENGINE]: {
    name: '火山方舟',
    description: '火山引擎 Doubao 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://console.volcengine.com/ark',
    envKey: 'ARK_API_KEY',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
  },
  [PROVIDER_TYPES.DEEPSEEK]: {
    name: 'DeepSeek',
    description: 'DeepSeek 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.deepseek.com/api_keys',
    envKey: 'DEEPSEEK_API_KEY',
    defaultBaseUrl: 'https://api.deepseek.com/v1'
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

  if (!provider) return null
  if (config.baseUrl) provider.setBaseUrl(config.baseUrl)
  return applyModelOverrides(provider, config)
}

export function getProvider(type, config = {}) {
  if (currentProvider && currentProviderType === type) {
    currentProvider.apiKey = config.apiKey
    if (config.groupId !== undefined) currentProvider.groupId = config.groupId
    if (config.endpointId !== undefined) currentProvider.endpointId = config.endpointId
    currentProvider.setBaseUrl(config.baseUrl)
    applyModelOverrides(currentProvider, config)
    return currentProvider
  }

  currentProvider = createProvider(type, config)
  currentProviderType = type

  return currentProvider
}

export function getProviderEnvApiKey(type) {
  const envKey = PROVIDER_INFO[type]?.envKey
  if (!envKey) return ''
  return String(process.env[envKey] || '').trim()
}

export function resolveProviderRuntimeConfig(type, config = {}) {
  const apiKeys = config.ai_api_keys || {}
  const baseUrls = config.ai_base_urls || {}
  const endpointId = type === PROVIDER_TYPES.VOLCENGINE ? apiKeys.volcengine_endpoint_id || '' : ''
  const storedKey = typeof apiKeys[type] === 'string' ? apiKeys[type].trim() : ''
  const runtime = {
    apiKey: storedKey || getProviderEnvApiKey(type),
    baseUrl: typeof baseUrls[type] === 'string' ? baseUrls[type].trim() : '',
    timeout: config.ai_timeout ? config.ai_timeout * 1000 : 60000,
    connectionTimeout: config.ai_connection_timeout ? config.ai_connection_timeout * 1000 : 10000,
    models: resolveProviderModels(type, config.ai_models),
    defaultModel: resolveProviderDefaultModel(type, config.ai_models, endpointId)
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
    return { success: false, models: [], error: `未知的 AI Provider: ${type}` }
  }
  return provider.listRemoteModels(config.apiKey)
}

export function getCurrentProvider() {
  return currentProvider
}

export function getAvailableProviders(config = null) {
  const apiKeys = config?.ai_api_keys || {}
  const baseUrls = config?.ai_base_urls || {}
  return Object.entries(PROVIDER_INFO).map(([key, info]) => {
    const models = config ? resolveProviderModels(key, config.ai_models) : getDefaultProviderModels(key)
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
      defaultModel: config ? resolveProviderDefaultModel(key, config.ai_models) : models[0]?.id || '',
      hasApiKey: Boolean(storedKey || hasEnvKey)
    }
  })
}

export { default as BaseProvider } from './providers/BaseProvider.js'
export { getContextWindow } from './capabilities.js'
