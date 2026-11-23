import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({
  autoCapture: true
}))

const mocks = vi.hoisted(() => ({
  chat: vi.fn(),
  chatStream: vi.fn(),
  addMemory: vi.fn(),
  getMemoryOverview: vi.fn(),
  executeSkill: vi.fn()
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../src/main/services/config.js', () => ({
  getConfig: () => ({
    ai: {
      provider: 'bailian',
      keys: { bailian: 'test-key' },
      models: {},
      fallback: { enabled: false, models: [] },
      persona: '',
      temperature: null,
      timeout: 120,
      connection_timeout: 10,
      base_urls: {},
      context: { compress_threshold: 70, keep_recent: 6 },
      attachments: { max_count: 5, max_image_mb: 10, max_text_kb: 256 },
      agent: {
        max_iterations: 10,
        timeout_min: 5,
        max_plan_steps: 8,
        max_parallel_tools: 2,
        scenario_models: {},
        tool_policy: 'all'
      },
      tool_result: { max_kb: 24, run_kb: 160, retention_days: 7 }
    },
    database: { connections: [] },
    extensions: { mcp_servers: [], disabled_skills: [], skill_overrides: {} },
    sql_generator: { base_path: '', text_edit_app: '' },
    network: { market_sources: {} },
    update: { auto_update: false, check_interval: 24 },
    appearance: { theme: 'system' },
    memory: { auto_capture: state.autoCapture },
    image_hosting: {},
    notifications: {},
    clipboard_history: {}
  })
}))

vi.mock('../src/main/services/ai/index.js', () => ({
  getProvider: () => ({
    name: '测试平台',
    getDefaultModel: () => 'test-model',
    getModels: () => [],
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
  resolveProviderRuntimeConfig: () => ({ apiKey: 'test-key', baseUrl: '', models: [], defaultModel: 'test-model' }),
  getProviderEnvApiKey: () => '',
  getContextWindow: () => 131072,
  PROVIDER_TYPES: {},
  PROVIDER_INFO: {}
}))

vi.mock('../src/main/services/skills.js', () => ({
  initSkills: vi.fn(async () => {}),
  getSkillsManager: () => ({
    getToolDefinitions: () => [
      { type: 'function', function: { name: 'file-ops', description: '文件操作' } },
      { type: 'function', function: { name: 'memory', description: '长期记忆' } }
    ],
    getSkill: () => null,
    executeSkill: mocks.executeSkill
  })
}))

vi.mock('../src/main/services/memory.js', () => ({
  buildMemoryPrompt: vi.fn(async () => ''),
  getMemoryOverview: mocks.getMemoryOverview,
  addMemory: mocks.addMemory
}))

const { chatStream } = await import('../src/main/services/chat.js')

const userMessage = (text) => [{ role: 'user', content: text }]

function isExtractionCall(call) {
  return String(call?.[0]?.[0]?.content || '').includes('长期记忆整理器')
}

describe('自动沉淀记忆', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.autoCapture = true
    mocks.getMemoryOverview.mockResolvedValue({ global: [], project: [] })
    mocks.addMemory.mockImplementation(async (input) => ({
      success: true,
      entry: { id: `id-${mocks.addMemory.mock.calls.length}`, content: input.content }
    }))
    mocks.chatStream.mockResolvedValue({ success: true, content: '好的，已记录。', thinking: '' })
  })

  it('对话结束后提取并保存全局与项目记忆', async () => {
    mocks.chat.mockImplementation(async (messages) => {
      if (String(messages?.[0]?.content || '').includes('长期记忆整理器')) {
        return {
          success: true,
          content: JSON.stringify([
            { scope: 'project', content: '项目统一使用 pnpm 与单引号、无分号', tags: ['代码风格'] },
            { scope: 'global', content: '用户偏好简洁直接的中文回复' }
          ])
        }
      }
      return { success: true, content: '{}' }
    })

    await chatStream(userMessage('记住偏好'), { toolsEnabled: true, workspacePath: '/tmp/ws' }, () => {})

    await vi.waitFor(() => expect(mocks.addMemory).toHaveBeenCalledTimes(2))
    expect(mocks.chat.mock.calls.some(isExtractionCall)).toBe(true)
    expect(mocks.addMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'project',
        workspacePath: '/tmp/ws',
        content: '项目统一使用 pnpm 与单引号、无分号',
        tags: ['代码风格'],
        source: 'ai'
      })
    )
    expect(mocks.addMemory).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'global', content: '用户偏好简洁直接的中文回复', source: 'ai' })
    )
  })

  it('未绑定工作区时跳过项目记忆', async () => {
    mocks.chat.mockImplementation(async (messages) => {
      if (String(messages?.[0]?.content || '').includes('长期记忆整理器')) {
        return {
          success: true,
          content: JSON.stringify([
            { scope: 'project', content: '项目脚手架使用 Vue 3 + Vite' },
            { scope: 'global', content: '用户偏好简洁回复' }
          ])
        }
      }
      return { success: true, content: '{}' }
    })

    await chatStream(userMessage('记住偏好'), { toolsEnabled: true }, () => {})

    await vi.waitFor(() => expect(mocks.addMemory).toHaveBeenCalledTimes(1))
    expect(mocks.addMemory.mock.calls[0][0].scope).toBe('global')
  })

  it('关闭自动记忆后不再提取', async () => {
    state.autoCapture = false

    await chatStream(userMessage('记住偏好'), { toolsEnabled: true, workspacePath: '/tmp/ws' }, () => {})

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(mocks.chat.mock.calls.some(isExtractionCall)).toBe(false)
    expect(mocks.addMemory).not.toHaveBeenCalled()
  })

  it('忽略无效的提取结果与敏感内容长度', async () => {
    mocks.chat.mockImplementation(async (messages) => {
      if (String(messages?.[0]?.content || '').includes('长期记忆整理器')) {
        return {
          success: true,
          content: `说明文字\n${JSON.stringify([
            { scope: 'project', content: '写', tags: [] },
            { scope: 'global', content: 'a'.repeat(501) },
            { scope: 'global', content: '用户偏好使用 pnpm' }
          ])}\n结束`
        }
      }
      return { success: true, content: '{}' }
    })

    await chatStream(userMessage('记住偏好'), { toolsEnabled: true, workspacePath: '/tmp/ws' }, () => {})

    await vi.waitFor(() => expect(mocks.addMemory).toHaveBeenCalledTimes(1))
    expect(mocks.addMemory).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'global', content: '用户偏好使用 pnpm' })
    )
  })
})
