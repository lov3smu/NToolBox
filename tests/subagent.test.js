import { describe, expect, it, vi } from 'vitest'
import handler from '../src/main/skills/builtin/subagent/handler.js'

function tool(name) {
  return { type: 'function', function: { name, description: name, parameters: { type: 'object', properties: {} } } }
}

function createRuntime(overrides = {}) {
  const runChat = vi.fn(async () => ({ success: true, content: '子代理结论：字段为 id、name' }))
  return {
    runChat,
    providerType: 'deepseek',
    model: 'deepseek-chat',
    listToolDefinitions: () => [tool('web-fetch'), tool('db-query'), tool('file-ops'), tool('subagent')],
    ...overrides
  }
}

describe('subagent skill', () => {
  it('delegates with a read-only tool subset and returns the conclusion', async () => {
    const runtime = createRuntime()
    const result = await handler({ task: '查一下 users 表结构', context: '只读调查' }, runtime)

    expect(result.success).toBe(true)
    expect(result.content).toBe('子代理结论：字段为 id、name')
    expect(result.metadata.tools).toEqual(['web-fetch', 'db-query'])

    const [messages, options] = runtime.runChat.mock.calls[0]
    expect(messages[0].content).toContain('查一下 users 表结构')
    expect(messages[0].content).toContain('只读调查')
    expect(options.tools.map((item) => item.function.name)).toEqual(['web-fetch', 'db-query'])
    expect(options.provider).toBe('deepseek')
    expect(options.model).toBe('deepseek-chat')
  })

  it('rejects empty tasks and missing runtime support', async () => {
    expect((await handler({}, createRuntime())).error).toBe('缺少子任务描述')
    expect((await handler({ task: '任务' }, { listToolDefinitions: () => [] })).error).toBe(
      '当前没有可供子代理使用的只读工具'
    )
    expect((await handler({ task: '任务' }, { listToolDefinitions: () => [tool('web-fetch')] })).error).toBe(
      '子代理运行环境不可用'
    )
  })

  it('propagates nested agent failures', async () => {
    const runtime = createRuntime({
      runChat: vi.fn(async () => ({ success: false, error: '模型不可用' }))
    })
    const result = await handler({ task: '任务' }, runtime)
    expect(result).toEqual({ success: false, error: '模型不可用' })
  })
})
