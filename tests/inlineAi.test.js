import { describe, it, expect } from 'vitest'
import {
  INLINE_AI_ACTIONS,
  INLINE_AI_MAX_CHARS,
  actionsForContext,
  buildInlineAiMessages,
  getInlineAiAction,
  normalizeInlineAiRequest
} from '../src/shared/inlineAi.js'

describe('inline AI contract', () => {
  it('exposes unique actions covering text and code contexts', () => {
    const ids = INLINE_AI_ACTIONS.map((action) => action.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(actionsForContext('text').length).toBeGreaterThan(0)
    expect(actionsForContext('code').map((action) => action.id)).toContain('optimize_code')
  })

  it('validates action and text', () => {
    expect(normalizeInlineAiRequest({ action: 'nope', text: 'x' })).toEqual({
      ok: false,
      error: '未知的 AI 操作'
    })
    expect(normalizeInlineAiRequest({ action: 'polish', text: '   ' })).toEqual({
      ok: false,
      error: '请先选中要处理的内容'
    })
    const tooLong = 'a'.repeat(INLINE_AI_MAX_CHARS + 1)
    expect(normalizeInlineAiRequest({ action: 'polish', text: tooLong }).ok).toBe(false)
  })

  it('trims text and keeps a bounded request id', () => {
    const result = normalizeInlineAiRequest({
      action: 'summarize',
      text: '  一段文字  ',
      requestId: `  ${'r'.repeat(80)}  `
    })
    expect(result.ok).toBe(true)
    expect(result.value.text).toBe('一段文字')
    expect(result.value.requestId).toHaveLength(64)
  })

  it('builds system and user messages for a known action only', () => {
    const messages = buildInlineAiMessages('translate_en', '你好')
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('翻译成自然、准确的英文')
    expect(messages[1]).toEqual({ role: 'user', content: '你好' })
    expect(buildInlineAiMessages('missing', 'x')).toEqual([])
    expect(getInlineAiAction('optimize_code')?.contexts).toContain('code')
  })
})
