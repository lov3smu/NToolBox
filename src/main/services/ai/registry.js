import BailianProvider from './providers/BailianProvider.js'
import MoonshotProvider from './providers/MoonshotProvider.js'
import ZhipuProvider from './providers/ZhipuProvider.js'
import MinimaxProvider from './providers/MinimaxProvider.js'
import VolcengineProvider from './providers/VolcengineProvider.js'
import DeepSeekProvider from './providers/DeepSeekProvider.js'
import MimoProvider from './providers/MimoProvider.js'
import OpencodeProvider from './providers/OpencodeProvider.js'
import OpencodeGoProvider from './providers/OpencodeGoProvider.js'
import OpenAIProvider from './providers/OpenAIProvider.js'
import GoogleProvider from './providers/GoogleProvider.js'
import AnthropicProvider from './providers/AnthropicProvider.js'
import { OllamaProvider, LmStudioProvider } from './providers/LocalProviders.js'

// 新增服务商只需在此登记一条：元数据、能力、自动降级顺序和构造器都在这里
export const PROVIDER_REGISTRY = {
  bailian: {
    name: '百炼',
    description: '阿里云百炼通义千问',
    docsUrl: 'https://bailian.console.aliyun.com/',
    envKey: 'DASHSCOPE_API_KEY',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 1,
    contextWindow: 1000000,
    Provider: BailianProvider
  },
  deepseek: {
    name: 'DeepSeek',
    description: 'DeepSeek 大模型',
    docsUrl: 'https://platform.deepseek.com/api_keys',
    envKey: 'DEEPSEEK_API_KEY',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 2,
    contextWindow: 1000000,
    Provider: DeepSeekProvider
  },
  moonshot: {
    name: 'Kimi',
    description: '月之暗面 Kimi 大模型',
    docsUrl: 'https://platform.kimi.com/',
    envKey: 'MOONSHOT_API_KEY',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 3,
    contextWindow: 1000000,
    Provider: MoonshotProvider
  },
  zhipu: {
    name: '智谱AI',
    description: '智谱 GLM 大模型',
    docsUrl: 'https://docs.bigmodel.cn/',
    envKey: 'ZHIPUAI_API_KEY',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 4,
    contextWindow: 204800,
    Provider: ZhipuProvider
  },
  volcengine: {
    name: '火山方舟',
    description: '火山引擎 Doubao 大模型',
    docsUrl: 'https://console.volcengine.com/ark',
    envKey: 'ARK_API_KEY',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 5,
    contextWindow: 262144,
    Provider: VolcengineProvider
  },
  minimax: {
    name: 'MiniMax',
    description: 'MiniMax 大模型',
    docsUrl: 'https://platform.minimaxi.com/',
    envKey: 'MINIMAX_API_KEY',
    defaultBaseUrl: 'https://api.minimax.cn/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 6,
    contextWindow: 204800,
    Provider: MinimaxProvider
  },
  mimo: {
    name: '小米 MiMo',
    description: '小米 MiMo 大模型',
    docsUrl: 'https://platform.xiaomimimo.com/',
    envKey: 'MIMO_API_KEY',
    defaultBaseUrl: 'https://api.xiaomimimo.com/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 7,
    contextWindow: 1048576,
    Provider: MimoProvider
  },
  openai: {
    name: 'OpenAI',
    description: 'OpenAI GPT 大模型',
    docsUrl: 'https://platform.openai.com/api-keys',
    envKey: 'OPENAI_API_KEY',
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 8,
    contextWindow: 1050000,
    Provider: OpenAIProvider
  },
  google: {
    name: 'Google',
    description: 'Google Gemini 大模型',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    envKey: 'GEMINI_API_KEY',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 9,
    contextWindow: 1000000,
    Provider: GoogleProvider
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Anthropic Claude 大模型',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    envKey: 'ANTHROPIC_API_KEY',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 10,
    contextWindow: 1000000,
    Provider: AnthropicProvider
  },
  opencode: {
    name: 'OpenCode',
    description: 'OpenCode Zen 按量付费模型网关',
    docsUrl: 'https://opencode.ai/docs/console/models',
    envKey: 'OPENCODE_API_KEY',
    defaultBaseUrl: 'https://opencode.ai/inference/openai/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 11,
    Provider: OpencodeProvider
  },
  opencode_go: {
    name: 'OpenCode Go',
    description: 'OpenCode Go 订阅套餐模型',
    docsUrl: 'https://opencode.ai/docs/console/go',
    envKey: 'OPENCODE_GO_API_KEY',
    defaultBaseUrl: 'https://opencode.ai/inference/go/openai/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    autoPriority: 12,
    Provider: OpencodeGoProvider
  },
  ollama: {
    name: 'Ollama（本地）',
    description: '本地运行的 Ollama 模型服务',
    docsUrl: 'https://ollama.com/download',
    envKey: '',
    defaultBaseUrl: 'http://127.0.0.1:11434/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    requiresApiKey: false,
    autoPriority: 13,
    contextWindow: 32768,
    Provider: OllamaProvider
  },
  lmstudio: {
    name: 'LM Studio（本地）',
    description: '本地运行的 LM Studio 模型服务',
    docsUrl: 'https://lmstudio.ai/',
    envKey: '',
    defaultBaseUrl: 'http://127.0.0.1:1234/v1',
    requiresGroupId: false,
    requiresEndpointId: false,
    requiresApiKey: false,
    autoPriority: 14,
    contextWindow: 32768,
    Provider: LmStudioProvider
  }
}

export const PROVIDER_TYPES = Object.freeze(
  Object.fromEntries(Object.keys(PROVIDER_REGISTRY).map((type) => [type.toUpperCase(), type]))
)

export const PROVIDER_INFO = Object.freeze(
  Object.fromEntries(
    Object.entries(PROVIDER_REGISTRY).map(([type, entry]) => [
      type,
      {
        name: entry.name,
        description: entry.description,
        requiresGroupId: entry.requiresGroupId,
        requiresEndpointId: entry.requiresEndpointId,
        requiresApiKey: entry.requiresApiKey !== false,
        docsUrl: entry.docsUrl,
        envKey: entry.envKey,
        defaultBaseUrl: entry.defaultBaseUrl
      }
    ])
  )
)

export const AUTO_PRIORITY = Object.freeze(
  Object.entries(PROVIDER_REGISTRY)
    .sort(([, a], [, b]) => a.autoPriority - b.autoPriority)
    .map(([type]) => type)
)

export const DEFAULT_CONTEXT_WINDOW = 131072

export function getContextWindow(providerType) {
  return PROVIDER_REGISTRY[providerType]?.contextWindow || DEFAULT_CONTEXT_WINDOW
}

export function getProviderEntry(providerType) {
  return PROVIDER_REGISTRY[providerType] || null
}
