import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'

const testUserData = path.join(os.tmpdir(), `ntoolbox-tool-results-${process.pid}`)

vi.mock('electron', () => ({
  app: { getPath: () => testUserData }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const { createToolResultStore, readToolResult } = await import('../src/main/services/toolResults.js')

beforeAll(() => {
  fs.mkdirSync(testUserData, { recursive: true })
})

afterAll(() => {
  fs.rmSync(testUserData, { recursive: true, force: true })
})

describe('工具结果预算', () => {
  it('小结果保持原样进入上下文', async () => {
    const store = createToolResultStore('run-small')
    const result = await store.budget({ success: true, tables: ['users', 'orders'] }, 'call-1')

    expect(result.truncated).toBe(false)
    expect(result.resultId).toBe('')
    expect(JSON.parse(result.content)).toEqual({ success: true, tables: ['users', 'orders'] })
  })

  it('超大结果截断并落盘，可分段读取', async () => {
    const store = createToolResultStore('run-large')
    const rows = Array.from({ length: 4000 }, (_, index) => ({
      id: index,
      name: `row-${index}`,
      payload: 'x'.repeat(20)
    }))
    const budgeted = await store.budget({ success: true, rows }, 'call-big')

    expect(budgeted.truncated).toBe(true)
    expect(budgeted.resultId).toMatch(/^run-large__call-big__\d+$/)
    expect(budgeted.originalChars).toBeGreaterThan(200000)

    const wrapper = JSON.parse(budgeted.content)
    expect(wrapper.success).toBe(true)
    expect(wrapper.truncated).toBe(true)
    expect(wrapper.resultId).toBe(budgeted.resultId)
    expect(wrapper.note).toContain('result-read')
    expect(budgeted.content.length).toBeLessThan(25000)

    const first = await readToolResult(budgeted.resultId, { offset: 0, limit: 4000 })
    expect(first.success).toBe(true)
    expect(first.content).toHaveLength(4000)
    expect(first.has_more).toBe(true)
    expect(first.total_chars).toBe(budgeted.originalChars)

    const second = await readToolResult(budgeted.resultId, { offset: first.next_offset, limit: 4000 })
    expect(second.success).toBe(true)
    expect(second.offset).toBe(4000)
    expect(second.content).toHaveLength(4000)
    expect(second.content).not.toBe(first.content)

    const tail = await readToolResult(budgeted.resultId, { offset: first.total_chars - 10, limit: 4000 })
    expect(tail.content).toHaveLength(10)
    expect(tail.has_more).toBe(false)
    expect(tail.next_offset).toBeNull()
  })

  it('单次运行总预算耗尽后继续截断后续结果', async () => {
    const store = createToolResultStore('run-budget')
    const payload = 'y'.repeat(20000)

    for (let index = 0; index < 7; index += 1) {
      const result = await store.budget({ success: true, payload }, `call-${index}`)
      expect(result.truncated).toBe(false)
    }

    const overflow = await store.budget({ success: true, payload }, 'call-overflow')
    expect(overflow.truncated).toBe(true)
    expect(overflow.resultId).toBeTruthy()
  })

  it('应用自定义预算后更小的结果也会被截断', async () => {
    const store = createToolResultStore('run-custom', { maxResultChars: 1024, maxRunChars: 1500 })

    const small = await store.budget({ success: true, payload: 'z'.repeat(600) }, 'call-small')
    expect(small.truncated).toBe(false)

    const large = await store.budget({ success: true, payload: 'z'.repeat(2000) }, 'call-large')
    expect(large.truncated).toBe(true)
    expect(large.resultId).toMatch(/^run-custom__call-large__\d+$/)
  })

  it('拒绝非法或缺失的 result_id', async () => {
    const invalid = await readToolResult('../etc/passwd')
    expect(invalid.success).toBe(false)
    expect(invalid.error).toContain('格式无效')

    const missing = await readToolResult('run-none__call-none__1')
    expect(missing.success).toBe(false)
    expect(missing.error).toContain('不存在')
  })
})
