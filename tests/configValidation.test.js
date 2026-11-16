import { describe, it, expect } from 'vitest'
import { validateConfig, normalizeShortcuts, VALID_SHORTCUT_KEYS } from '../src/main/services/configValidation.js'
import { tools } from '../src/shared/tools.js'

function createConfig(overrides = {}) {
  return {
    base_path: '/tmp/scripts',
    developer_ch_name: '张三',
    developer_en_name: 'zhangsan',
    text_edit_app: '',
    auto_update: true,
    auto_start: true,
    close_action: 'ask',
    ai_provider: 'bailian',
    ai_api_keys: {},
    databases: ['main_db'],
    script_types: [{ name: 'DDL' }],
    shortcuts: { settings: 'CmdOrCtrl+,' },
    ...overrides
  }
}

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    expect(validateConfig(createConfig())).toBeNull()
  })

  it('rejects non-object input', () => {
    expect(validateConfig(null)).toBe('配置不是有效对象')
    expect(validateConfig([])).toBe('配置不是有效对象')
  })

  it('validates required fields', () => {
    expect(validateConfig(createConfig({ base_path: 1 }))).toBe('base_path 必须是字符串')
    expect(validateConfig(createConfig({ auto_update: 'yes' }))).toBe('auto_update 必须是布尔值')
    expect(validateConfig(createConfig({ databases: 'main_db' }))).toBe('databases 必须是数组')
    expect(validateConfig(createConfig({ databases: [1] }))).toBe('databases 中的每项必须是字符串')
    expect(validateConfig(createConfig({ script_types: [{ name: 1 }] }))).toBe('script_types.name 必须是字符串')
  })

  it('validates close_action against the allowed values', () => {
    expect(validateConfig(createConfig({ close_action: 'hide' }))).toBeNull()
    expect(validateConfig(createConfig({ close_action: 'explode' }))).toBe('close_action 值不合法')
  })

  it('validates theme against the allowed values', () => {
    expect(validateConfig(createConfig({ theme: 'system' }))).toBeNull()
    expect(validateConfig(createConfig({ theme: 'dark' }))).toBeNull()
    expect(validateConfig(createConfig({ theme: 'sepia' }))).toBe('theme 值不合法')
  })

  it('validates theme_style against the allowed values', () => {
    expect(validateConfig(createConfig({ theme_style: 'sapphire' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'forest' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'mint' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'bee' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'parchment' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'default' }))).toBe('theme_style 值不合法')
    expect(validateConfig(createConfig({ theme_style: 'neon' }))).toBe('theme_style 值不合法')
  })

  it('validates font_size against the allowed values', () => {
    expect(validateConfig(createConfig({ font_size: 'small' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'medium' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'large' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'xlarge' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'huge' }))).toBe('font_size 值不合法')
  })

  it('validates shortcut keys and values', () => {
    expect(validateConfig(createConfig({ shortcuts: { unknown: 'CmdOrCtrl+X' } }))).toBe(
      'shortcuts.unknown 不是有效的快捷键配置项'
    )
    expect(validateConfig(createConfig({ shortcuts: { chat: 'CmdOrCtrl+L' } }))).toBe(
      'shortcuts.chat 不是有效的快捷键配置项'
    )
    expect(validateConfig(createConfig({ shortcuts: { settings: 1 } }))).toBe('shortcuts.settings 必须是字符串')
  })

  it('validates ai_models shape', () => {
    expect(validateConfig(createConfig({ ai_models: {} }))).toBeNull()
    expect(
      validateConfig(
        createConfig({
          ai_models: { deepseek: { default: 'deepseek-v4-pro', models: [{ id: 'deepseek-v4-pro', name: 'V4 Pro' }] } }
        })
      )
    ).toBeNull()
    expect(validateConfig(createConfig({ ai_models: [] }))).toBe('ai_models 必须是对象')
    expect(validateConfig(createConfig({ ai_models: { zhipu: { default: 1 } } }))).toBe(
      'ai_models.zhipu.default 必须是字符串'
    )
    expect(validateConfig(createConfig({ ai_models: { zhipu: { models: {} } } }))).toBe(
      'ai_models.zhipu.models 必须是数组'
    )
    expect(validateConfig(createConfig({ ai_models: { zhipu: { models: [{ id: ' ' }] } } }))).toBe(
      'ai_models.zhipu.models.id 必须是非空字符串'
    )
  })

  it('validates per-model metadata', () => {
    expect(
      validateConfig(
        createConfig({
          ai_models: {
            deepseek: {
              models: [
                {
                  id: 'deepseek-v4-pro',
                  contextWindow: 131072,
                  maxOutput: 8192,
                  inputTypes: ['text', 'image']
                }
              ]
            }
          }
        })
      )
    ).toBeNull()
    expect(
      validateConfig(createConfig({ ai_models: { deepseek: { models: [{ id: 'x', contextWindow: 'big' }] } } }))
    ).toBe('ai_models.deepseek.models.contextWindow 必须是正数')
    expect(validateConfig(createConfig({ ai_models: { deepseek: { models: [{ id: 'x', maxOutput: 0 }] } } }))).toBe(
      'ai_models.deepseek.models.maxOutput 必须是正数'
    )
    expect(
      validateConfig(createConfig({ ai_models: { deepseek: { models: [{ id: 'x', inputTypes: 'text' }] } } }))
    ).toBe('ai_models.deepseek.models.inputTypes 必须是数组')
    expect(
      validateConfig(createConfig({ ai_models: { deepseek: { models: [{ id: 'x', inputTypes: ['audio'] }] } } }))
    ).toBe('ai_models.deepseek.models.inputTypes 值不合法')
  })

  it('validates ai_base_urls shape', () => {
    expect(validateConfig(createConfig({ ai_base_urls: { deepseek: 'https://api.deepseek.com/v1' } }))).toBeNull()
    expect(validateConfig(createConfig({ ai_base_urls: { deepseek: 'http://10.0.0.2:8080/v1' } }))).toBeNull()
    expect(validateConfig(createConfig({ ai_base_urls: { deepseek: '' } }))).toBeNull()
    expect(validateConfig(createConfig({ ai_base_urls: [] }))).toBe('ai_base_urls 必须是对象')
    expect(validateConfig(createConfig({ ai_base_urls: { deepseek: 1 } }))).toBe('ai_base_urls.deepseek 必须是字符串')
    expect(validateConfig(createConfig({ ai_base_urls: { deepseek: 'api.deepseek.com' } }))).toBe(
      'ai_base_urls.deepseek 必须是有效的 http(s) 地址'
    )
    expect(validateConfig(createConfig({ ai_base_urls: { deepseek: 'ftp://api.deepseek.com' } }))).toBe(
      'ai_base_urls.deepseek 必须是有效的 http(s) 地址'
    )
  })

  it('validates fallback model settings', () => {
    expect(validateConfig(createConfig({ ai_fallback_enabled: true }))).toBeNull()
    expect(validateConfig(createConfig({ ai_fallback_models: ['deepseek:deepseek-chat'] }))).toBeNull()
    expect(validateConfig(createConfig({ ai_fallback_enabled: 'yes' }))).toBe('ai_fallback_enabled 必须是布尔值')
    expect(validateConfig(createConfig({ ai_fallback_models: 'deepseek:deepseek-chat' }))).toBe(
      'ai_fallback_models 必须是数组'
    )
    expect(validateConfig(createConfig({ ai_fallback_models: [''] }))).toBe('ai_fallback_models 每项必须是非空字符串')
    expect(validateConfig(createConfig({ ai_fallback_models: ['deepseek'] }))).toBe(
      'ai_fallback_models 每项格式应为 provider:model'
    )
    expect(validateConfig(createConfig({ ai_fallback_models: ['deepseek:'] }))).toBe(
      'ai_fallback_models 每项格式应为 provider:model'
    )
  })

  it('validates AI behavior settings', () => {
    expect(validateConfig(createConfig({ ai_persona: '你是后端专家' }))).toBeNull()
    expect(validateConfig(createConfig({ ai_persona: 1 }))).toBe('ai_persona 必须是字符串')
    expect(validateConfig(createConfig({ ai_temperature: null }))).toBeNull()
    expect(validateConfig(createConfig({ ai_temperature: 0.7 }))).toBeNull()
    expect(validateConfig(createConfig({ ai_temperature: '0.7' }))).toBe('ai_temperature 必须是数字或 null')
    expect(validateConfig(createConfig({ ai_temperature: 3 }))).toBe('ai_temperature 必须在 0 到 2 之间')
    expect(validateConfig(createConfig({ ai_temperature: -1 }))).toBe('ai_temperature 必须在 0 到 2 之间')
    expect(validateConfig(createConfig({ ai_scenario_models: { planner: 'bailian:qwen3.8-flash' } }))).toBeNull()
    expect(validateConfig(createConfig({ ai_scenario_models: { planner: '', compression: '' } }))).toBeNull()
    expect(validateConfig(createConfig({ ai_scenario_models: [] }))).toBe('ai_scenario_models 必须是对象')
    expect(validateConfig(createConfig({ ai_scenario_models: { planner: 1 } }))).toBe(
      'ai_scenario_models.planner 必须是字符串'
    )
    expect(validateConfig(createConfig({ ai_scenario_models: { planner: 'bailian' } }))).toBe(
      'ai_scenario_models.planner 格式应为 provider:model'
    )
    expect(validateConfig(createConfig({ ai_tool_policy: 'all' }))).toBeNull()
    expect(validateConfig(createConfig({ ai_tool_policy: 'high-risk' }))).toBeNull()
    expect(validateConfig(createConfig({ ai_tool_policy: 'auto' }))).toBeNull()
    expect(validateConfig(createConfig({ ai_tool_policy: 'chat' }))).toBe('ai_tool_policy 值不合法')
  })

  it('validates notification and clipboard history settings', () => {
    expect(
      validateConfig(
        createConfig({
          notifications: { upload_done: true, backup_done: false, update_found: true, agent_done: false }
        })
      )
    ).toBeNull()
    expect(validateConfig(createConfig({ notifications: [] }))).toBe('notifications 必须是对象')
    expect(validateConfig(createConfig({ notifications: { unknown: true } }))).toBe(
      'notifications.unknown 不是有效的通知项'
    )
    expect(validateConfig(createConfig({ notifications: { upload_done: 'yes' } }))).toBe(
      'notifications.upload_done 必须是布尔值'
    )
    expect(validateConfig(createConfig({ clipboard_history: { persist: false, max_entries: 50 } }))).toBeNull()
    expect(validateConfig(createConfig({ clipboard_history: { persist: false, max_entries: 200 } }))).toBeNull()
    expect(validateConfig(createConfig({ clipboard_history: 'nope' }))).toBe('clipboard_history 必须是对象')
    expect(validateConfig(createConfig({ clipboard_history: { persist: 'yes' } }))).toBe(
      'clipboard_history.persist 必须是布尔值'
    )
    expect(validateConfig(createConfig({ clipboard_history: { max_entries: 77 } }))).toBe(
      'clipboard_history.max_entries 值不合法'
    )
  })

  it('keeps every valid shortcut key aligned with the shared tool registry', () => {
    const configurableKeys = tools.filter((tool) => tool.shortcutKey).map((tool) => tool.shortcutKey)
    expect(VALID_SHORTCUT_KEYS).toEqual(configurableKeys)
  })

  it('validates MCP server settings', () => {
    const server = { name: 'filesystem', command: 'npx', args: ['-y'] }
    expect(validateConfig(createConfig({ mcp_servers: [] }))).toBeNull()
    expect(validateConfig(createConfig({ mcp_servers: [server] }))).toBeNull()
    expect(validateConfig(createConfig({ mcp_servers: 'filesystem' }))).toBe('mcp_servers 必须是数组')
    expect(validateConfig(createConfig({ mcp_servers: [{ name: 'Bad Name', command: 'x' }] }))).toContain(
      'mcp_servers 中存在无效配置'
    )
    expect(validateConfig(createConfig({ mcp_servers: [{ name: 'empty' }] }))).toContain('mcp_servers 中存在无效配置')
    expect(validateConfig(createConfig({ mcp_servers: [server, server] }))).toBe('mcp_servers 服务名重复：filesystem')
  })

  it('validates disabled skills and description overrides', () => {
    expect(validateConfig(createConfig({ disabled_skills: ['sql-helper'] }))).toBeNull()
    expect(validateConfig(createConfig({ disabled_skills: 'sql-helper' }))).toBe('disabled_skills 必须是数组')
    expect(validateConfig(createConfig({ disabled_skills: ['Bad Name'] }))).toContain(
      'disabled_skills 中存在无效技能名'
    )
    expect(validateConfig(createConfig({ disabled_skills: ['sql-helper', 'sql-helper'] }))).toContain(
      'disabled_skills 中存在重复或无效的技能名'
    )

    expect(validateConfig(createConfig({ skill_overrides: { 'sql-helper': { description: 'new' } } }))).toBeNull()
    expect(validateConfig(createConfig({ skill_overrides: {} }))).toBeNull()
    expect(validateConfig(createConfig({ skill_overrides: [] }))).toBe('skill_overrides 必须是对象')
    expect(validateConfig(createConfig({ skill_overrides: { 'sql-helper': { description: 1 } } }))).toBe(
      'skill_overrides.sql-helper.description 必须是字符串'
    )
    expect(validateConfig(createConfig({ skill_overrides: { 'sql-helper': { description: '   ' } } }))).toBe(
      'skill_overrides 中没有有效的描述覆盖'
    )
  })

  it('validates network proxy settings', () => {
    expect(validateConfig(createConfig())).toBeNull()
    expect(validateConfig(createConfig({ network: { proxy: { mode: 'system' } } }))).toBeNull()
    expect(validateConfig(createConfig({ network: { proxy: { mode: 'direct' } } }))).toBeNull()
    expect(
      validateConfig(createConfig({ network: { proxy: { mode: 'manual', url: 'http://127.0.0.1:7890' } } }))
    ).toBeNull()
    expect(
      validateConfig(createConfig({ network: { proxy: { mode: 'manual', url: 'socks5://127.0.0.1:1080' } } }))
    ).toBeNull()
    expect(validateConfig(createConfig({ network: [] }))).toBe('network 必须是对象')
    expect(validateConfig(createConfig({ network: { proxy: [] } }))).toBe('network.proxy 必须是对象')
    expect(validateConfig(createConfig({ network: { proxy: { mode: 'auto' } } }))).toBe('network.proxy.mode 值不合法')
    expect(validateConfig(createConfig({ network: { proxy: { mode: 'manual', url: '' } } }))).toBe(
      'network.proxy.mode 为手动时必须填写代理地址'
    )
    expect(validateConfig(createConfig({ network: { proxy: { mode: 'manual', url: 'ftp://a' } } }))).toBe(
      'network.proxy.url 必须是有效的 http(s) 或 socks5 地址'
    )
    expect(validateConfig(createConfig({ network: { proxy: { mode: 'system', bypass: 1 } } }))).toBe(
      'network.proxy.bypass 必须是字符串'
    )
  })

  it('validates market sources', () => {
    expect(validateConfig(createConfig({ market_sources: { clawhub: 'https://mirror.example.com' } }))).toBeNull()
    expect(validateConfig(createConfig({ market_sources: {} }))).toBeNull()
    expect(validateConfig(createConfig({ market_sources: [] }))).toBe('market_sources 必须是对象')
    expect(validateConfig(createConfig({ market_sources: { unknown: '' } }))).toBe(
      'market_sources.unknown 不是有效的配置项'
    )
    expect(validateConfig(createConfig({ market_sources: { clawhub: 1 } }))).toBe('market_sources.clawhub 必须是字符串')
    expect(validateConfig(createConfig({ market_sources: { mcp_registry: 'not-a-url' } }))).toBe(
      'market_sources.mcp_registry 必须是有效的 http(s) 地址'
    )
  })

  it('validates database transfer batch size and history limit', () => {
    expect(validateConfig(createConfig({ database_transfer_batch_size: 2000, database_history_limit: 500 }))).toBeNull()
    expect(validateConfig(createConfig({ database_transfer_batch_size: 1 }))).toBe(
      'database_transfer_batch_size 值不合法'
    )
    expect(validateConfig(createConfig({ database_history_limit: 201 }))).toBe('database_history_limit 值不合法')
  })
})

describe('validateConfig agent runtime limits', () => {
  it('accepts in-range agent settings', () => {
    expect(
      validateConfig(
        createConfig({
          ai_agent_max_iterations: 12,
          ai_agent_timeout_min: 10,
          ai_agent_plan_steps: 8,
          ai_agent_parallel_tools: 4,
          ai_tool_result_max_kb: 24,
          ai_tool_result_run_kb: 160,
          ai_tool_result_retention_days: 7
        })
      )
    ).toBeNull()
  })

  it('rejects out-of-range agent settings', () => {
    expect(validateConfig(createConfig({ ai_agent_max_iterations: 2 }))).toBe(
      'ai_agent_max_iterations 必须是 3 到 30 之间的整数（Agent 最大执行轮次）'
    )
    expect(validateConfig(createConfig({ ai_agent_timeout_min: 0 }))).toBe(
      'ai_agent_timeout_min 必须是 1 到 30 之间的整数（Agent 单任务时长上限（分钟））'
    )
    expect(validateConfig(createConfig({ ai_agent_plan_steps: 99 }))).toBe(
      'ai_agent_plan_steps 必须是 3 到 12 之间的整数（计划步骤上限）'
    )
    expect(validateConfig(createConfig({ ai_agent_parallel_tools: 9 }))).toBe(
      'ai_agent_parallel_tools 必须是 1 到 8 之间的整数（并行工具调用数）'
    )
    expect(validateConfig(createConfig({ ai_tool_result_max_kb: 1 }))).toBe(
      'ai_tool_result_max_kb 必须是 4 到 64 之间的整数（单个工具结果预算（KB））'
    )
    expect(validateConfig(createConfig({ ai_tool_result_run_kb: 9999 }))).toBe(
      'ai_tool_result_run_kb 必须是 32 到 512 之间的整数（单次运行工具结果预算（KB））'
    )
    expect(validateConfig(createConfig({ ai_tool_result_retention_days: 0 }))).toBe(
      'ai_tool_result_retention_days 必须是 1 到 30 之间的整数（工具结果保留天数）'
    )
  })
})

describe('normalizeShortcuts', () => {
  const defaults = { settings: 'CmdOrCtrl+,' }

  it('drops obsolete shortcut keys from older configs', () => {
    expect(normalizeShortcuts({ chat: 'CmdOrCtrl+L', password: 'CmdOrCtrl+P' }, defaults)).toEqual(defaults)
  })

  it('keeps valid overrides and fills missing defaults', () => {
    expect(normalizeShortcuts({ settings: '' }, defaults)).toEqual({ settings: '' })
    expect(normalizeShortcuts({ settings: 'Alt+S' }, defaults)).toEqual({ settings: 'Alt+S' })
  })

  it('falls back to defaults for invalid input', () => {
    expect(normalizeShortcuts(null, defaults)).toEqual(defaults)
    expect(normalizeShortcuts([], defaults)).toEqual(defaults)
  })
})
