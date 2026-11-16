// 思考参数规则的唯一来源：style 决定请求体字段，pattern 决定模型是否支持
const THINKING_RULES = {
  bailian: { style: 'enable_thinking', pattern: /qwen3/i },
  moonshot: { style: 'moonshot', pattern: /kimi-k3/i },
  zhipu: { style: 'zhipu', pattern: /^glm-(5|4\.7)/i },
  minimax: { style: 'minimax', pattern: /^MiniMax-M3/i },
  volcengine: { style: 'thinking', pattern: /doubao-seed/i },
  deepseek: { style: 'thinking', pattern: /deepseek-(v4|reasoner|flash)/i },
  mimo: { style: 'thinking', pattern: /mimo-v2\.6/i }
}

export function getThinkingStyle(providerType) {
  return THINKING_RULES[providerType]?.style || ''
}

export function supportsThinking(providerType, modelId) {
  const rule = THINKING_RULES[providerType]
  if (!rule || !modelId) return false
  return rule.pattern.test(String(modelId))
}

export { THINKING_RULES }
