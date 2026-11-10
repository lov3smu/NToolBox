import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
  executeSkill: vi.fn()
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../src/main/services/config.js', () => ({
  getConfig: () => ({
    ai_provider: 'bailian',
    ai_api_keys: { bailian: 'test-key' },
    ai_models: {}
  })
}))

vi.mock('../src/main/services/ai/index.js', () => ({
  getProvider: () => ({
    name: '测试平台',
    getDefaultModel: () => 'test-model',
    validateConfig: () => ({ valid: true }),
    chat: mocks.chat,
    chatStream: mocks.chatStream
  }),
  createProvider: vi.fn(),
  getAvailableProviders: vi.fn(),
  fetchProviderModels: vi.fn(),
  getDefaultProviderModels: vi.fn(),
  resolveProviderModels: () => [],
  resolveProviderDefaultModel: () => 'test-model',
  getContextWindow: () => 131072,
  PROVIDER_TYPES: {},
  PROVIDER_INFO: {}
}))

vi.mock('../src/main/services/skills.js', () => ({
  initSkills: vi.fn(async () => {}),
  getSkillsManager: () => ({
    getToolDefinitions: () => [
      {
        type: 'function',
        function: { name: 'db-query', description: '查询数据库' }
      }
    ],
    getSkill: () => ({ name: 'db-query' }),
    executeSkill: mocks.executeSkill
  })
}))

const { chatStream, compressChatContext } = await import('../src/main/services/chat.js')

function planResult(plan) {
  return { success: true, content: JSON.stringify(plan) }
}

function toolCallResult(name, args) {
  return {
    success: true,
    content: '',
    thinking: '',
    tool_calls: [
      {
        id: `call-${Math.random().toString(36).slice(2, 8)}`,
        type: 'function',
        function: { name, arguments: args }
      }
    ]
  }
}

function userMessage(text) {
  return [{ role: 'user', content: text }]
}

describe('单 Agent 闭环', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('生成计划并在工具返回空结果时输出反思与执行摘要', async () => {
    mocks.chat.mockResolvedValueOnce(
      planResult({
        complexity: 'complex',
        goal: '查询 order_db 的表列表',
        steps: ['连接 mysql57', '查询 order_db 表列表']
      })
    )
    mocks.chatStream
      .mockResolvedValueOnce(toolCallResult('db-query', '{"action":"list_tables"}'))
      .mockResolvedValueOnce({ success: true, content: '查询完成，结果为空。', thinking: '' })
    mocks.executeSkill.mockResolvedValue({ success: true, tables: [] })

    const events = []
    const result = await chatStream(
      userMessage('连接到 mysql57 查询 order_db 有哪些表'),
      { toolsEnabled: true },
      (event) => events.push(event)
    )

    expect(result.success).toBe(true)
    expect(result.termination).toBe('goal_reached')

    const planEvent = events.find((event) => event.kind === 'plan')
    expect(planEvent.plan.goal).toBe('查询 order_db 的表列表')
    expect(planEvent.plan.steps).toHaveLength(2)

    const reflection = events.find((event) => event.kind === 'reflection')
    expect(reflection).toMatchObject({ status: 'warning', name: 'db-query' })

    const summaryEvent = events.find((event) => event.kind === 'summary')
    expect(summaryEvent.summary).toMatchObject({
      termination: 'goal_reached',
      terminationText: '目标完成',
      toolCalls: 1,
      toolSuccess: 1,
      toolFailed: 0,
      iterations: 2,
      tools: ['db-query']
    })
    expect(summaryEvent.summary.limitations.join('\n')).toContain('空结果')

    const secondCallMessages = mocks.chatStream.mock.calls[1][0]
    const toolMessage = secondCallMessages.find((message) => message.role === 'tool')
    expect(toolMessage.content).toContain('[系统反思]')
  })

  it('工具失败时记录反思并把诊断反馈给模型', async () => {
    mocks.chat.mockResolvedValueOnce(
      planResult({ complexity: 'complex', goal: '查看表结构', steps: ['查询表结构', '输出结论'] })
    )
    mocks.chatStream
      .mockResolvedValueOnce(toolCallResult('db-schema', '{"table_name":"users"}'))
      .mockResolvedValueOnce({ success: true, content: '表不存在，请检查表名。', thinking: '' })
    mocks.executeSkill.mockResolvedValue({ success: false, error: '表 users 不存在' })

    const events = []
    const result = await chatStream(userMessage('查看 user_db 的 users 表结构'), { toolsEnabled: true }, (event) =>
      events.push(event)
    )

    expect(result.termination).toBe('goal_reached')
    const reflection = events.find((event) => event.kind === 'reflection')
    expect(reflection).toMatchObject({ status: 'error' })
    expect(reflection.text).toContain('表 users 不存在')

    const summary = events.find((event) => event.kind === 'summary').summary
    expect(summary.toolFailed).toBe(1)
    expect(summary.limitations.join('\n')).toContain('失败')

    const toolMessage = mocks.chatStream.mock.calls[1][0].find((message) => message.role === 'tool')
    expect(toolMessage.content).toContain('表 users 不存在')
    expect(toolMessage.content).toContain('[系统反思]')
  })

  it('达到最大轮次时终止并给出原因', async () => {
    mocks.chat.mockResolvedValueOnce(planResult(null))
    mocks.chatStream.mockResolvedValue(toolCallResult('db-query', '{"action":"list_databases"}'))
    mocks.executeSkill.mockResolvedValue({ success: true, databases: ['order_db'] })

    const events = []
    const result = await chatStream(userMessage('反复查询数据库列表直到完成'), { toolsEnabled: true }, (event) =>
      events.push(event)
    )

    expect(result.success).toBe(false)
    expect(result.termination).toBe('max_steps')
    expect(mocks.chatStream).toHaveBeenCalledTimes(10)

    const summary = events.find((event) => event.kind === 'summary').summary
    expect(summary.termination).toBe('max_steps')
    expect(summary.terminationText).toBe('达到最大轮次')
    expect(summary.limitations.join('\n')).toContain('最大轮次')
  })
})

describe('Token 用量统计', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('聚合规划与对话的用量并上报上下文窗口', async () => {
    mocks.chat.mockResolvedValueOnce({
      success: true,
      content: JSON.stringify({ complexity: 'simple', goal: '', steps: [] }),
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 }
    })
    mocks.chatStream.mockResolvedValueOnce({
      success: true,
      content: '你好',
      thinking: '',
      usage: { prompt_tokens: 500, completion_tokens: 80, total_tokens: 580 }
    })

    const events = []
    const result = await chatStream(userMessage('你好，请介绍一下你自己'), { toolsEnabled: true }, (event) =>
      events.push(event)
    )

    expect(result.usage).toMatchObject({
      prompt_tokens: 600,
      completion_tokens: 100,
      total_tokens: 700,
      calls: 2,
      contextTokens: 500,
      estimated: false
    })
    expect(result.contextWindow).toBe(131072)

    const usageEvents = events.filter((event) => event.kind === 'usage')
    expect(usageEvents).toHaveLength(2)
    expect(usageEvents[1].usage.total_tokens).toBe(700)
  })

  it('提供方未返回用量时改用本地估算并标记', async () => {
    mocks.chatStream.mockResolvedValueOnce({ success: true, content: '中文回答内容', thinking: '' })

    const result = await chatStream(userMessage('介绍一下你自己'), { toolsEnabled: false })

    expect(result.usage.estimated).toBe(true)
    expect(result.usage.total_tokens).toBeGreaterThan(0)
    expect(result.usage.contextTokens).toBeGreaterThan(0)
  })

  it('把压缩摘要注入系统提示词', async () => {
    mocks.chatStream.mockResolvedValueOnce({ success: true, content: '好的', thinking: '' })

    await chatStream(userMessage('继续刚才的任务'), {
      toolsEnabled: false,
      contextSummary: '- 已连接 mysql57\n- 查询 order_db 完成'
    })

    const sent = mocks.chatStream.mock.calls[0][0]
    expect(sent[0].role).toBe('system')
    expect(sent[0].content).toContain('历史对话摘要')
    expect(sent[0].content).toContain('已连接 mysql57')
  })
})

describe('上下文压缩', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('压缩较早消息、保留最近消息并合并已有摘要', async () => {
    mocks.chat.mockResolvedValueOnce({
      success: true,
      content: '- 用户查询了用户表\n- 结论：共 3 条',
      usage: { prompt_tokens: 300, completion_tokens: 40, total_tokens: 340 }
    })
    const history = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `消息 ${index}`
    }))

    const result = await compressChatContext(history, { keepRecent: 4, contextSummary: '- 旧摘要' })

    expect(result.success).toBe(true)
    expect(result.compressedCount).toBe(6)
    expect(result.keptCount).toBe(4)
    expect(result.summary).toContain('用户查询了用户表')
    expect(result.usage.total_tokens).toBe(340)
    expect(result.beforeTokens).toBeGreaterThan(0)
    expect(result.afterTokens).toBeGreaterThan(0)

    const sent = mocks.chat.mock.calls[0][0]
    expect(sent[0].content).toContain('上下文压缩器')
    expect(sent[1].content).toContain('旧摘要')
    expect(sent[1].content).toContain('消息 0')
    expect(sent[1].content).toContain('消息 5')
    expect(sent[1].content).not.toContain('消息 6')
  })

  it('历史消息不足时拒绝压缩', async () => {
    const result = await compressChatContext([{ role: 'user', content: '你好' }], { keepRecent: 4 })

    expect(result.success).toBe(false)
    expect(result.error).toContain('无需压缩')
    expect(mocks.chat).not.toHaveBeenCalled()
  })
})
