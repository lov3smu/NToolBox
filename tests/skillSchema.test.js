import { describe, it, expect } from 'vitest'
import { normalizeSkillParams, renderPromptTemplate } from '../src/main/services/extensions/skillSchema.js'

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    count: { type: 'integer', minimum: 1, maximum: 10, default: 3 },
    enabled: { type: 'boolean', default: true },
    mode: { type: 'string', enum: ['fast', 'safe'] }
  },
  required: ['name']
}

describe('normalizeSkillParams', () => {
  it('applies defaults and keeps false/0 values', () => {
    const result = normalizeSkillParams(schema, { name: 'demo', enabled: false })
    expect(result.error).toBeUndefined()
    expect(result.params).toEqual({ name: 'demo', enabled: false, count: 3 })
  })

  it('rejects missing required parameters', () => {
    const result = normalizeSkillParams(schema, { count: 2 })
    expect(result.error).toContain('缺少必填参数：name')
  })

  it('treats empty string as missing', () => {
    const result = normalizeSkillParams(schema, { name: '' })
    expect(result.error).toContain('缺少必填参数：name')
  })

  it('validates types, enums and numeric bounds', () => {
    expect(normalizeSkillParams(schema, { name: 'a', count: '3' }).error).toContain('应为 integer')
    expect(normalizeSkillParams(schema, { name: 'a', mode: 'turbo' }).error).toContain('取值无效')
    expect(normalizeSkillParams(schema, { name: 'a', count: 0 }).error).toContain('不能小于 1')
    expect(normalizeSkillParams(schema, { name: 'a', count: 11 }).error).toContain('不能大于 10')
  })

  it('strips unknown parameters', () => {
    const result = normalizeSkillParams(schema, { name: 'demo', unexpected: 'x' })
    expect(result.params).toEqual({ name: 'demo', count: 3, enabled: true })
  })

  it('rejects non-object parameters', () => {
    const result = normalizeSkillParams(schema, ['demo'])
    expect(result.error).toContain('JSON 对象')
  })
})

describe('renderPromptTemplate', () => {
  it('replaces placeholders without interpreting replacement patterns', () => {
    const result = renderPromptTemplate('代码：{{code}}', { code: "price $& $` $'" })
    expect(result.content).toBe("代码：price $& $` $'")
  })

  it('renders false and 0 instead of dropping them', () => {
    const result = renderPromptTemplate('{{flag}}/{{count}}', { flag: false, count: 0 })
    expect(result.content).toBe('false/0')
  })

  it('reports missing placeholders', () => {
    const result = renderPromptTemplate('{{code}} {{focus}}', { code: 'a' })
    expect(result.error).toContain('focus')
  })

  it('serializes object parameters as JSON', () => {
    const result = renderPromptTemplate('{{payload}}', { payload: { a: 1 } })
    expect(result.content).toBe('{"a":1}')
  })
})
