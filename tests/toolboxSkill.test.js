import { describe, expect, it } from 'vitest'
import toolbox from '../src/main/skills/builtin/toolbox/handler.js'

describe('toolbox skill', () => {
  it('encodes and decodes text with codec modes', () => {
    const encoded = toolbox({ action: 'codec', mode: 'base64', text: '你好' })
    expect(encoded.success).toBe(true)
    expect(encoded.content).toBe('5L2g5aW9')
    expect(toolbox({ action: 'codec', mode: 'base64', direction: 'decode', text: encoded.content })).toMatchObject({
      success: true,
      content: '你好'
    })
  })

  it('rejects unknown codec modes and oversize input', () => {
    expect(toolbox({ action: 'codec', mode: 'rot13', text: 'x' }).success).toBe(false)
    expect(toolbox({ action: 'codec', mode: 'base64', text: 'x'.repeat(200001) }).success).toBe(false)
  })

  it('applies text transformations', () => {
    const result = toolbox({ action: 'text', operation: 'sort-lines', text: 'b\na\nb' })
    expect(result.success).toBe(true)
    expect(result.content).toBe('a\nb\nb')
    expect(toolbox({ action: 'text', operation: 'unknown', text: 'x' }).success).toBe(false)
  })

  it('tests regular expressions and reports matches', () => {
    const result = toolbox({ action: 'regex', pattern: '\\d+', text: '订单 42 与 7' })
    expect(result.success).toBe(true)
    expect(result.content).toContain('命中 2 处')
    expect(result.content).toContain('"42"')
    expect(toolbox({ action: 'regex', pattern: '(', text: 'x' }).success).toBe(false)
  })

  it('diffs two texts with stats and prefixes', () => {
    const result = toolbox({ action: 'diff', left: 'a\nb', right: 'a\nc' })
    expect(result.success).toBe(true)
    expect(result.content).toContain('新增 1 行，删除 1 行')
    expect(result.content).toContain('- b')
    expect(result.content).toContain('+ c')
  })

  it('lists and reads builtin templates', () => {
    const list = toolbox({ action: 'template', query: '周报' })
    expect(list.success).toBe(true)
    expect(list.content).toContain('weekly-report')
    const detail = toolbox({ action: 'template', template_id: 'weekly-report' })
    expect(detail.success).toBe(true)
    expect(detail.content).toContain('本周工作')
    expect(toolbox({ action: 'template', template_id: 'missing' }).success).toBe(false)
  })

  it('rejects unsupported actions', () => {
    expect(toolbox({ action: 'shell' }).success).toBe(false)
  })
})
