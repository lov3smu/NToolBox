const MESSAGE_OVERHEAD = 4
const IMAGE_TOKEN_COST = 800

const CJK_PATTERN = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/

export function estimateTextTokens(text) {
  if (typeof text !== 'string' || !text) return 0
  let cjk = 0
  for (const char of text) {
    if (CJK_PATTERN.test(char)) cjk += 1
  }
  const other = Math.max(0, text.length - cjk)
  return Math.ceil(cjk + other / 4)
}

export function estimateContentTokens(content) {
  if (typeof content === 'string') return estimateTextTokens(content)
  if (!Array.isArray(content)) return 0
  let total = 0
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    if (part.type === 'text') total += estimateTextTokens(part.text || '')
    else if (part.type === 'image_url') total += IMAGE_TOKEN_COST
    else total += estimateTextTokens(JSON.stringify(part))
  }
  return total
}

export function estimateToolCallsTokens(toolCalls) {
  if (!Array.isArray(toolCalls)) return 0
  let total = 0
  for (const call of toolCalls) {
    const fn = call?.function || call
    total += estimateTextTokens(`${fn?.name || ''}${fn?.arguments || ''}`)
  }
  return total
}

export function estimateToolsTokens(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return 0
  return estimateTextTokens(JSON.stringify(tools))
}

export function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0
  let total = 0
  for (const message of messages) {
    if (!message) continue
    total += MESSAGE_OVERHEAD + estimateContentTokens(message.content)
    if (message.tool_calls) total += estimateToolCallsTokens(message.tool_calls)
  }
  return total
}

export function normalizeUsage(rawUsage) {
  if (!rawUsage || typeof rawUsage !== 'object') return null
  const rawPrompt = Number(rawUsage.prompt_tokens ?? rawUsage.input_tokens)
  const rawCompletion = Number(rawUsage.completion_tokens ?? rawUsage.output_tokens)
  const rawTotal = Number(rawUsage.total_tokens)
  if (!Number.isFinite(rawPrompt) && !Number.isFinite(rawCompletion)) return null
  const prompt = Number.isFinite(rawPrompt) ? rawPrompt : 0
  const completion = Number.isFinite(rawCompletion) ? rawCompletion : 0
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: Number.isFinite(rawTotal) ? rawTotal : prompt + completion
  }
}
