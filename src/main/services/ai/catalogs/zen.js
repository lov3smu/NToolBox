import { pickBaseModels } from './base.js'

// 与 Go 网关窗口不一致的模型在此显式覆盖，避免两份目录各写一套导致漂移
const ZEN_ONLY_MODELS = [
  { id: 'minimax-m3', name: 'MiniMax M3', contextWindow: 512000, maxOutput: 128000, inputTypes: ['text', 'image'] },
  { id: 'qwen3.8-max', name: 'Qwen3.8 Max', contextWindow: 262144, maxOutput: 131072, inputTypes: ['text', 'image'] },
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5',
    contextWindow: 1000000,
    maxOutput: 128000,
    inputTypes: ['text', 'image']
  },
  { id: 'gpt-6.1-sol', name: 'GPT 6.1 Sol', contextWindow: 1050000, maxOutput: 128000, inputTypes: ['text', 'image'] },
  {
    id: 'mistral-large-4',
    name: 'Mistral Large 4',
    contextWindow: 524288,
    maxOutput: 262144,
    inputTypes: ['text', 'image']
  }
]

export const ZEN_CATALOG = {
  defaultModel: 'glm-5.3',
  models: [
    ...pickBaseModels([
      'glm-5.3',
      'glm-5.3-flash',
      'kimi-k3',
      'kimi-k2.7-code',
      'deepseek-v4-pro',
      'deepseek-v4.1-flash',
      'qwen3.8-flash',
      'grok-4.7'
    ]),
    ...ZEN_ONLY_MODELS
  ]
}
