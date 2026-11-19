// 两个 OpenAI 兼容网关共享的模型元数据（数值来自 opencode.ai/inference[/go]/v1/models）
export const BASE_MODELS = {
  'glm-5.3': { name: 'GLM 5.3', contextWindow: 1000000, maxOutput: 131072, inputTypes: ['text'] },
  'glm-5.3-flash': {
    name: 'GLM 5.3 Flash',
    contextWindow: 1000000,
    maxOutput: 131072,
    inputTypes: ['text', 'image']
  },
  'glm-5.2': { name: 'GLM 5.2', contextWindow: 1000000, maxOutput: 131072, inputTypes: ['text'] },
  'kimi-k3': { name: 'Kimi K3', contextWindow: 1048576, maxOutput: 1048576, inputTypes: ['text', 'image'] },
  'kimi-k2.7-code': {
    name: 'Kimi K2.7 Code',
    contextWindow: 262144,
    maxOutput: 262144,
    inputTypes: ['text', 'image']
  },
  'deepseek-v4-pro': { name: 'DeepSeek V4 Pro', contextWindow: 1000000, maxOutput: 384000, inputTypes: ['text'] },
  'deepseek-v4.1-flash': {
    name: 'DeepSeek V4.1 Flash',
    contextWindow: 1000000,
    maxOutput: 384000,
    inputTypes: ['text', 'image']
  },
  'qwen3.8-flash': {
    name: 'Qwen3.8 Flash',
    contextWindow: 1000000,
    maxOutput: 131072,
    inputTypes: ['text', 'image']
  },
  'grok-4.7': { name: 'Grok 4.7', contextWindow: 500000, maxOutput: 500000, inputTypes: ['text', 'image'] },
  'claude-haiku-5-5': {
    name: 'Claude Haiku 5.5',
    contextWindow: 1000000,
    maxOutput: 128000,
    inputTypes: ['text', 'image']
  },
  'gpt-6-luna': { name: 'GPT 6 Luna', contextWindow: 1050000, maxOutput: 128000, inputTypes: ['text', 'image'] },
  'gemini-4-argon': {
    name: 'Gemini 4 Argon',
    contextWindow: 1048576,
    maxOutput: 65536,
    inputTypes: ['text', 'image']
  }
}

export function pickBaseModels(ids) {
  return ids.map((id) => {
    const base = BASE_MODELS[id]
    if (!base) throw new Error(`模型目录缺少基础定义: ${id}`)
    return { id, ...base }
  })
}
