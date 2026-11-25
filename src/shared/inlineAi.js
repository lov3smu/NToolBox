export const INLINE_AI_MAX_CHARS = 12000

export const INLINE_AI_CONTEXTS = Object.freeze(['text', 'code'])

export const INLINE_AI_ACTIONS = Object.freeze([
  { id: 'polish', label: '润色文字', contexts: ['text'] },
  { id: 'summarize', label: '提炼摘要', contexts: ['text'] },
  { id: 'translate_en', label: '译为英文', contexts: ['text'] },
  { id: 'translate_zh', label: '译为中文', contexts: ['text'] },
  { id: 'explain', label: '解释内容', contexts: ['text', 'code'] },
  { id: 'optimize_code', label: '优化代码', contexts: ['code'] },
  { id: 'comment_code', label: '补充注释', contexts: ['code'] },
  { id: 'diagnose_code', label: '排查问题', contexts: ['code'] }
])

const SYSTEM_BASE =
  '你是 NToolBox 的内置文本处理助手。严格只处理用户提供的文本，不添加无关内容；保留原文的 Markdown 结构、代码缩进与命名风格；只输出处理结果，不要使用代码围栏包裹，也不要附加解释（除非任务明确要求解释）。'

const ACTION_PROMPTS = {
  polish: '在不改变原意的前提下润色文字：修正病句、冗余与不通顺的表达，保持原有语气与格式。',
  summarize: '将内容提炼为简洁摘要，保留关键信息与数字；内容较长时使用要点列表。',
  translate_en: '将内容翻译成自然、准确的英文，保留术语、专有名词、代码与 Markdown 标记。',
  translate_zh: '将内容翻译成自然、准确的中文，保留术语、专有名词、代码与 Markdown 标记。',
  explain: '解释该内容的含义、结构或逻辑，使用简洁的中文分点说明。',
  optimize_code: '在保持行为不变的前提下优化代码的可读性、性能与安全性，输出完整代码。',
  comment_code: '为代码补充必要的中文注释与说明，保持代码逻辑不变，输出完整代码。',
  diagnose_code: '排查代码中的错误、风险与边界问题，按严重程度列出问题与修改建议；能直接修正时输出修正后的完整代码。'
}

export function getInlineAiAction(actionId) {
  return INLINE_AI_ACTIONS.find((action) => action.id === actionId) || null
}

export function actionsForContext(context) {
  return INLINE_AI_ACTIONS.filter((action) => action.contexts.includes(context))
}

export function normalizeInlineAiRequest(payload = {}) {
  const action = typeof payload?.action === 'string' ? payload.action.trim() : ''
  if (!getInlineAiAction(action)) {
    return { ok: false, error: '未知的 AI 操作' }
  }
  const text = typeof payload?.text === 'string' ? payload.text.trim() : ''
  if (!text) {
    return { ok: false, error: '请先选中要处理的内容' }
  }
  if (text.length > INLINE_AI_MAX_CHARS) {
    return {
      ok: false,
      error: '选中内容超过 {p0} 字符上限，请缩小范围',
      errorArgs: { p0: INLINE_AI_MAX_CHARS }
    }
  }
  const requestId = typeof payload?.requestId === 'string' ? payload.requestId.trim().slice(0, 64) : ''
  return { ok: true, value: { action, text, requestId } }
}

export function buildInlineAiMessages(actionId, text) {
  const action = getInlineAiAction(actionId)
  const prompt = ACTION_PROMPTS[actionId]
  if (!action || !prompt) return []
  return [
    { role: 'system', content: `${SYSTEM_BASE}\n当前任务：${prompt}` },
    { role: 'user', content: text }
  ]
}
