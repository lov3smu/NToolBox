const THINKING_RULES = {
  bailian: { style: 'enable_thinking', pattern: /qwen3/i },
  zhipu: { style: 'thinking', pattern: /^glm-(5|4\.7)/i },
  volcengine: { style: 'thinking', pattern: /doubao-seed/i },
  deepseek: { style: 'thinking', pattern: /deepseek-(v4|reasoner)/i }
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
  bailian: 131072,
  moonshot: 262144,
  zhipu: 131072,
  minimax: 204800,
  volcengine: 262144,
  deepseek: 131072
}

const DEFAULT_CONTEXT_WINDOW = 131072

export function getContextWindow(providerType) {
  return CONTEXT_WINDOWS[providerType] || DEFAULT_CONTEXT_WINDOW
}
