import { pickBaseModels } from './base.js'

// Go 网关对 minimax-m3 / qwen3.8-max 提供更大窗口，按官方 models API 单独覆盖
const GO_ONLY_MODELS = [
  { id: 'minimax-m3', name: 'MiniMax M3', contextWindow: 1000000, maxOutput: 131072, inputTypes: ['text', 'image'] },
  { id: 'qwen3.8-max', name: 'Qwen3.8 Max', contextWindow: 1000000, maxOutput: 131072, inputTypes: ['text', 'image'] },
  {
    id: 'kimi-k3.1-pro',
    name: 'Kimi K3.1 Pro',
    contextWindow: 1048576,
    maxOutput: 1048576,
    inputTypes: ['text', 'image']
  },
  {
    id: 'mimo-v2.6-pro',
    name: 'MiMo V2.6 Pro',
    contextWindow: 1048576,
    maxOutput: 131072,
    inputTypes: ['text', 'image']
  },
  {
    id: 'mimo-v2.6-flash',
    name: 'MiMo V2.6 Flash',
    contextWindow: 1048576,
    maxOutput: 131072,
    inputTypes: ['text', 'image']
  },
  { id: 'longcat-2.0', name: 'LongCat 2.0', contextWindow: 1000000, maxOutput: 131072, inputTypes: ['text'] },
  { id: 'hy3', name: 'Hy3', contextWindow: 256000, maxOutput: 128000, inputTypes: ['text'] }
]

export const GO_CATALOG = {
  defaultModel: 'glm-5.3',
  models: [
    ...pickBaseModels([
      'glm-5.3',
      'glm-5.3-flash',
      'glm-5.2',
      'kimi-k3',
      'kimi-k2.7-code',
      'deepseek-v4-pro',
      'deepseek-v4.1-flash',
      'qwen3.8-flash',
      'claude-haiku-5-5',
      'gpt-6-luna',
      'gemini-4-argon',
      'grok-4.7'
    ]),
    ...GO_ONLY_MODELS
  ]
}
