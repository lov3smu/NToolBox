import BailianProvider from './providers/BailianProvider.js'
import MoonshotProvider from './providers/MoonshotProvider.js'
import ZhipuProvider from './providers/ZhipuProvider.js'
import MinimaxProvider from './providers/MinimaxProvider.js'
import VolcengineProvider from './providers/VolcengineProvider.js'
import DeepSeekProvider from './providers/DeepSeekProvider.js'
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
    description: '阿里云百炼大模型平台',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://bailian.console.aliyun.com/'
  },
  [PROVIDER_TYPES.MOONSHOT]: {
    name: 'Moonshot',
    description: '月之暗面 Kimi 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.moonshot.cn/'
  },
  [PROVIDER_TYPES.ZHIPU]: {
    name: '智谱AI',
    description: '智谱 GLM 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://open.bigmodel.cn/'
  },
  [PROVIDER_TYPES.MINIMAX]: {
    name: 'Minimax',
    description: 'Minimax 大模型',
    requiresGroupId: true,
    requiresEndpointId: false,
    docsUrl: 'https://www.minimaxi.com/'
  },
  [PROVIDER_TYPES.VOLCENGINE]: {
    name: '火山方舟',
    description: '火山引擎 Doubao 大模型',
    requiresGroupId: false,
    requiresEndpointId: true,
    docsUrl: 'https://www.volcengine.com/'
  },
  [PROVIDER_TYPES.DEEPSEEK]: {
    name: 'DeepSeek',
    description: 'DeepSeek 大模型',
    requiresGroupId: false,
    requiresEndpointId: false,
    docsUrl: 'https://platform.deepseek.com/'
  }
}

let currentProvider = null
let currentProviderType = null

export function createProvider(type, config) {
  log.info(`创建 AI Provider: ${type}`)
  
  switch (type) {
    case PROVIDER_TYPES.BAILIAN:
      return new BailianProvider(config.apiKey)
    case PROVIDER_TYPES.MOONSHOT:
      return new MoonshotProvider(config.apiKey)
    case PROVIDER_TYPES.ZHIPU:
      return new ZhipuProvider(config.apiKey)
    case PROVIDER_TYPES.MINIMAX:
      return new MinimaxProvider(config.apiKey, config.groupId)
    case PROVIDER_TYPES.VOLCENGINE:
      return new VolcengineProvider(config.apiKey, config.endpointId)
    case PROVIDER_TYPES.DEEPSEEK:
      return new DeepSeekProvider(config.apiKey)
    default:
      log.error(`未知的 Provider 类型: ${type}`)
      return null
  }
}

export function getProvider(type, config) {
  if (currentProvider && currentProviderType === type) {
    currentProvider.apiKey = config.apiKey
    if (config.groupId) currentProvider.groupId = config.groupId
    if (config.endpointId) currentProvider.endpointId = config.endpointId
    return currentProvider
  }
  
  currentProvider = createProvider(type, config)
  currentProviderType = type
  
  return currentProvider
}

export function getProviderModels(type) {
  const config = {
    apiKey: 'test'
  }
  const provider = createProvider(type, config)
  return provider ? provider.getModels() : []
}

export function getCurrentProvider() {
  return currentProvider
}

export function getAvailableProviders() {
  return Object.entries(PROVIDER_INFO).map(([key, info]) => ({
    type: key,
    name: info.name,
    description: info.description,
    requiresGroupId: info.requiresGroupId,
    requiresEndpointId: info.requiresEndpointId,
    docsUrl: info.docsUrl
  }))
}

export { default as BaseProvider } from './providers/BaseProvider.js'