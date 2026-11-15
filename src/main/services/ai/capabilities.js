const THINKING_RULES = {
  bailian: { style: 'enable_thinking', pattern: /qwen3/i },
  moonshot: { style: 'moonshot', pattern: /kimi-k3/i },
  zhipu: { style: 'zhipu', pattern: /^glm-(5|4\.7)/i },
  minimax: { style: 'minimax', pattern: /^MiniMax-M3/i },
  volcengine: { style: 'thinking', pattern: /doubao-seed/i },
  deepseek: { style: 'thinking', pattern: /deepseek-(v4|reasoner|flash)/i }
}

export function getThinkingStyle(providerType) {
  return THINKING_RULES[providerType]?.style || ''
}

export function supportsThinking(providerType, modelId) {
  const rule = THINKING_RULES[providerType]
  if (!rule || !modelId) return false
  return rule.pattern.test(String(modelId))
}

const CONTEXT_WINDOWS = {
  bailian: 1000000,
  moonshot: 1000000,
  zhipu: 204800,
  minimax: 204800,
  volcengine: 262144,
  deepseek: 1000000
}

const DEFAULT_CONTEXT_WINDOW = 131072

export function getContextWindow(providerType) {
  return CONTEXT_WINDOWS[providerType] || DEFAULT_CONTEXT_WINDOW
}
