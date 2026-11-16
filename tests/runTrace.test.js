import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'

const testUserData = path.join(os.tmpdir(), `ntoolbox-run-trace-${process.pid}`)

vi.mock('electron', () => ({
  app: { getPath: () => testUserData }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const { createRunTrace, listRunTraces, readRunTrace, writeRunTraceFile } =
  await import('../src/main/services/runTrace.js')

beforeAll(() => {
  fs.mkdirSync(testUserData, { recursive: true })
})

afterAll(() => {
  fs.rmSync(testUserData, { recursive: true, force: true })
})

describe('运行轨迹', () => {
  it('落盘计划、步骤、反思、用量与终止原因', async () => {
    const trace = createRunTrace('run-audit', {
      provider: 'bailian',
      model: 'qwen-max',
      approvalPolicy: 'ask',
      toolsEnabled: true
    })

    trace.setPlan({ goal: '查询订单表', steps: ['连接数据库', '查询表'] })
    trace.addStep({
      type: 'tool',
      tool: 'db-query',
      arguments: 'query · order_db',
      risk: 'read',
      approval: 'allowed',
      approvalMs: 0,
      success: true,
      denied: false,
      duration: 120,
      truncated: true,
      resultId: 'run-audit__call-1__1',
      result: '{"rows":[]}'
    })
    trace.addReflection({ name: 'db-query', status: 'warning', text: 'db-query 返回空结果' })
    await trace.finish({
      status: 'goal_reached',
      termination: 'goal_reached',
      summary: { termination: 'goal_reached', limitations: ['结果为空'] },
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      content: '查询完成'
    })

    const detail = await readRunTrace('run-audit')
    expect(detail.success).toBe(true)
    expect(detail.trace.meta.provider).toBe('bailian')
    expect(detail.trace.plan.goal).toBe('查询订单表')
    expect(detail.trace.steps).toHaveLength(1)
    expect(detail.trace.steps[0]).toMatchObject({
      tool: 'db-query',
      truncated: true,
      resultId: 'run-audit__call-1__1'
    })
    expect(detail.trace.reflections[0].status).toBe('warning')
    expect(detail.trace.termination).toBe('goal_reached')
    expect(detail.trace.usage.total_tokens).toBe(15)
    expect(detail.trace.durationMs).toBeGreaterThanOrEqual(0)

    const list = await listRunTraces(10)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      id: 'run-audit',
      status: 'goal_reached',
      goal: '查询订单表',
      provider: 'bailian',
      toolCalls: 1
    })
  })

  it('完成后不再追加步骤，重复结束不覆盖结果', async () => {
    const trace = createRunTrace('run-frozen')
    await trace.finish({ status: 'cancelled', termination: 'cancelled' })
    trace.addStep({ type: 'tool', tool: 'db-query' })
    await trace.finish({ status: 'error', error: '执行中断' })

    const detail = await readRunTrace('run-frozen')
    expect(detail.trace.steps).toHaveLength(0)
    expect(detail.trace.status).toBe('cancelled')
    expect(detail.trace.error).toBeNull()
  })

  it('支持导出并拒绝无效标识', async () => {
    const target = path.join(testUserData, 'exported.json')
    const written = await writeRunTraceFile('run-audit', target)
    expect(written.success).toBe(true)
    const exported = JSON.parse(fs.readFileSync(target, 'utf8'))
    expect(exported.id).toBe('run-audit')

    const missing = await readRunTrace('run-missing')
    expect(missing.success).toBe(false)
    expect(missing.error).toContain('不存在')

    const invalid = await readRunTrace('../escape')
    expect(invalid.success).toBe(false)
  })
})
