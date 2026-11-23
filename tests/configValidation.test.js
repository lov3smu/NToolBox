import { describe, it, expect } from 'vitest'
import { validateConfig, normalizeShortcuts, VALID_SHORTCUT_KEYS } from '../src/main/services/configValidation.js'
import { tools } from '../src/shared/tools.js'
import { SHORTCUT_ACTION_KEYS } from '../src/shared/shortcutActions.js'

function createConfig(overrides = {}) {
  return {
    config_version: 3,
    app: {
      auto_start: true,
      close_action: 'ask',
      shortcuts: { settings: 'CmdOrCtrl+,' }
    },
    appearance: { theme: 'system', theme_style: 'sapphire', font_size: 'medium' },
    update: { auto_update: true },
    network: {},
    database: {},
    sql_generator: {
      base_path: '/tmp/scripts',
      developer: { ch_name: '张三', en_name: 'zhangsan' },
      text_edit_app: '',
      databases: ['main_db'],
      script_types: [{ name: 'DDL' }]
    },
    ai: { provider: 'bailian', keys: {} },
    extensions: {},
    notifications: {},
    clipboard_history: {},
    ...overrides
  }
}

function withApp(overrides = {}) {
  return { app: { ...createConfig().app, ...overrides } }
}

function withSqlGenerator(overrides = {}) {
  return { sql_generator: { ...createConfig().sql_generator, ...overrides } }
}

function withAi(overrides = {}) {
  return { ai: { ...createConfig().ai, ...overrides } }
}

function withDatabase(overrides = {}) {
  return { database: overrides }
}

function withExtensions(overrides = {}) {
  return { extensions: overrides }
}

function withShortcuts(shortcuts) {
  return { app: { ...createConfig().app, shortcuts } }
}

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    expect(validateConfig(createConfig())).toBeNull()
  })

  it('rejects non-object input and invalid config_version', () => {
    expect(validateConfig(null)).toBe('配置不是有效对象')
    expect(validateConfig([])).toBe('配置不是有效对象')
    expect(validateConfig(createConfig({ config_version: '2' }))).toBe('config_version 必须是正整数')
    expect(validateConfig(createConfig({ config_version: 0 }))).toBe('config_version 必须是正整数')
  })

  it('requires every config group', () => {
    const required = {
      app: 'app 必须是对象',
      appearance: 'appearance 必须是对象',
      update: 'update 必须是对象',
      network: 'network 必须是对象',
      database: 'database 必须是对象',
      sql_generator: 'sql_generator 必须是对象',
      ai: 'ai 必须是对象',
      extensions: 'extensions 必须是对象',
      notifications: 'notifications 必须是对象',
      clipboard_history: 'clipboard_history 必须是对象'
    }
    for (const [group, message] of Object.entries(required)) {
      expect(validateConfig(createConfig({ [group]: undefined }))).toBe(message)
    }
  })

  it('validates required app fields', () => {
    expect(validateConfig(createConfig(withApp({ auto_start: 'yes' })))).toBe('app.auto_start 必须是布尔值')
    expect(validateConfig(createConfig(withApp({ recent_tools_limit: 999 })))).toBe('app.recent_tools_limit 值不合法')
  })

  it('validates required sql_generator fields', () => {
    expect(validateConfig(createConfig(withSqlGenerator({ base_path: 1 })))).toBe(
      'sql_generator.base_path 必须是字符串'
    )
    expect(validateConfig(createConfig(withSqlGenerator({ developer: {} })))).toBe(
      'sql_generator.developer.ch_name 必须是字符串'
    )
    expect(validateConfig(createConfig(withSqlGenerator({ text_edit_app: 1 })))).toBe(
      'sql_generator.text_edit_app 必须是字符串'
    )
    expect(validateConfig(createConfig(withSqlGenerator({ databases: 'main_db' })))).toBe(
      'sql_generator.databases 必须是数组'
    )
    expect(validateConfig(createConfig(withSqlGenerator({ databases: [1] })))).toBe(
      'sql_generator.databases 中的每项必须是字符串'
    )
    expect(validateConfig(createConfig(withSqlGenerator({ script_types: [{ name: 1 }] })))).toBe(
      'sql_generator.script_types.name 必须是字符串'
    )
  })

  it('validates update settings', () => {
    expect(validateConfig(createConfig({ update: { auto_update: true, check_interval: 6 } }))).toBeNull()
    expect(validateConfig(createConfig({ update: { auto_update: 'yes' } }))).toBe('update.auto_update 必须是布尔值')
    expect(validateConfig(createConfig({ update: { auto_update: true, check_interval: 7 } }))).toBe(
      'update.check_interval 值不合法'
    )
  })

  it('validates close_action against the allowed values', () => {
    expect(validateConfig(createConfig(withApp({ close_action: 'hide' })))).toBeNull()
    expect(validateConfig(createConfig(withApp({ close_action: 'explode' })))).toBe('app.close_action 值不合法')
  })

  it('validates theme against the allowed values', () => {
    expect(validateConfig(createConfig({ appearance: { theme: 'system' } }))).toBeNull()
    expect(validateConfig(createConfig({ appearance: { theme: 'dark' } }))).toBeNull()
    expect(validateConfig(createConfig({ appearance: { theme: 'sepia' } }))).toBe('appearance.theme 值不合法')
  })

  it('validates theme_style against the allowed values', () => {
    for (const style of ['sapphire', 'forest', 'mint', 'bee', 'parchment']) {
      expect(validateConfig(createConfig({ appearance: { theme_style: style } }))).toBeNull()
    }
    expect(validateConfig(createConfig({ appearance: { theme_style: 'default' } }))).toBe(
      'appearance.theme_style 值不合法'
    )
    expect(validateConfig(createConfig({ appearance: { theme_style: 'neon' } }))).toBe(
      'appearance.theme_style 值不合法'
    )
  })

  it('validates font_size against the allowed values', () => {
    for (const size of ['small', 'medium', 'large', 'xlarge']) {
      expect(validateConfig(createConfig({ appearance: { font_size: size } }))).toBeNull()
    }
    expect(validateConfig(createConfig({ appearance: { font_size: 'huge' } }))).toBe('appearance.font_size 值不合法')
  })

  it('validates shortcut keys and values', () => {
    expect(validateConfig(createConfig(withShortcuts({ unknown: 'CmdOrCtrl+X' })))).toBe(
      'app.shortcuts.unknown 不是有效的快捷键配置项'
    )
    expect(validateConfig(createConfig(withShortcuts({ chat: 'CmdOrCtrl+L' })))).toBe(
      'app.shortcuts.chat 不是有效的快捷键配置项'
    )
    expect(validateConfig(createConfig(withShortcuts({ settings: 1 })))).toBe('app.shortcuts.settings 必须是字符串')
    expect(validateConfig(createConfig(withShortcuts([])))).toBe('app.shortcuts 必须是对象')
  })

  it('accepts generic shortcut actions', () => {
    expect(VALID_SHORTCUT_KEYS).toEqual(
      expect.arrayContaining(['settings', 'chat_send', 'database_run', 'global_search'])
    )
    expect(
      validateConfig(createConfig(withShortcuts({ chat_send: 'Enter', database_run: '', global_search: 'F2' })))
    ).toBeNull()
    expect(normalizeShortcuts({ chat_send: 'Ctrl+Enter', unknown: 'F2' }, { chat_send: 'Enter' })).toEqual({
      chat_send: 'Ctrl+Enter'
    })
  })

  it('validates ai.models shape', () => {
    expect(validateConfig(createConfig({ ai: { provider: 'bailian', keys: {}, models: {} } }))).toBeNull()
    expect(
      validateConfig(
        createConfig(
          withAi({
            models: { deepseek: { default: 'deepseek-v4-pro', models: [{ id: 'deepseek-v4-pro', name: 'V4 Pro' }] } }
          })
        )
      )
    ).toBeNull()
    expect(validateConfig(createConfig(withAi({ models: [] })))).toBe('ai.models 必须是对象')
    expect(validateConfig(createConfig(withAi({ models: { zhipu: { default: 1 } } })))).toBe(
      'ai.models.zhipu.default 必须是字符串'
    )
    expect(validateConfig(createConfig(withAi({ models: { zhipu: { models: {} } } })))).toBe(
      'ai.models.zhipu.models 必须是数组'
    )
    expect(validateConfig(createConfig(withAi({ models: { zhipu: { models: [{ id: ' ' }] } } })))).toBe(
      'ai.models.zhipu.models.id 必须是非空字符串'
    )
  })

  it('validates per-model metadata', () => {
    expect(
      validateConfig(
        createConfig(
          withAi({
            models: {
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
      )
    ).toBeNull()
    expect(
      validateConfig(createConfig(withAi({ models: { deepseek: { models: [{ id: 'x', contextWindow: 'big' }] } } })))
    ).toBe('ai.models.deepseek.models.contextWindow 必须是正数')
    expect(
      validateConfig(createConfig(withAi({ models: { deepseek: { models: [{ id: 'x', maxOutput: 0 }] } } })))
    ).toBe('ai.models.deepseek.models.maxOutput 必须是正数')
    expect(
      validateConfig(createConfig(withAi({ models: { deepseek: { models: [{ id: 'x', inputTypes: 'text' }] } } })))
    ).toBe('ai.models.deepseek.models.inputTypes 必须是数组')
    expect(
      validateConfig(createConfig(withAi({ models: { deepseek: { models: [{ id: 'x', inputTypes: ['audio'] }] } } })))
    ).toBe('ai.models.deepseek.models.inputTypes 值不合法')
  })

  it('validates ai.base_urls shape', () => {
    expect(validateConfig(createConfig(withAi({ base_urls: { deepseek: 'https://api.deepseek.com/v1' } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ base_urls: { deepseek: 'http://10.0.0.2:8080/v1' } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ base_urls: { deepseek: '' } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ base_urls: [] })))).toBe('ai.base_urls 必须是对象')
    expect(validateConfig(createConfig(withAi({ base_urls: { deepseek: 1 } })))).toBe(
      'ai.base_urls.deepseek 必须是字符串'
    )
    expect(validateConfig(createConfig(withAi({ base_urls: { deepseek: 'api.deepseek.com' } })))).toBe(
      'ai.base_urls.deepseek 必须是有效的 http(s) 地址'
    )
    expect(validateConfig(createConfig(withAi({ base_urls: { deepseek: 'ftp://api.deepseek.com' } })))).toBe(
      'ai.base_urls.deepseek 必须是有效的 http(s) 地址'
    )
  })

  it('validates fallback model settings', () => {
    expect(validateConfig(createConfig(withAi({ fallback: { enabled: true } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ fallback: { models: ['deepseek:deepseek-chat'] } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ fallback: { enabled: 'yes' } })))).toBe(
      'ai.fallback.enabled 必须是布尔值'
    )
    expect(validateConfig(createConfig(withAi({ fallback: 'deepseek:deepseek-chat' })))).toBe('ai.fallback 必须是对象')
    expect(validateConfig(createConfig(withAi({ fallback: { models: 'deepseek:deepseek-chat' } })))).toBe(
      'ai.fallback.models 必须是数组'
    )
    expect(validateConfig(createConfig(withAi({ fallback: { models: [''] } })))).toBe(
      'ai.fallback.models 每项必须是非空字符串'
    )
    expect(validateConfig(createConfig(withAi({ fallback: { models: ['deepseek'] } })))).toBe(
      'ai.fallback.models 每项格式应为 provider:model'
    )
    expect(validateConfig(createConfig(withAi({ fallback: { models: ['deepseek:'] } })))).toBe(
      'ai.fallback.models 每项格式应为 provider:model'
    )
  })

  it('validates AI behavior settings', () => {
    expect(validateConfig(createConfig(withAi({ persona: '你是后端专家' })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ persona: 1 })))).toBe('ai.persona 必须是字符串')
    expect(validateConfig(createConfig(withAi({ temperature: null })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ temperature: 0.7 })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ temperature: '0.7' })))).toBe('ai.temperature 必须是数字或 null')
    expect(validateConfig(createConfig(withAi({ temperature: 3 })))).toBe('ai.temperature 必须在 0 到 2 之间')
    expect(validateConfig(createConfig(withAi({ temperature: -1 })))).toBe('ai.temperature 必须在 0 到 2 之间')
    expect(
      validateConfig(createConfig(withAi({ agent: { scenario_models: { planner: 'bailian:qwen3.8-flash' } } })))
    ).toBeNull()
    expect(
      validateConfig(createConfig(withAi({ agent: { scenario_models: { planner: '', compression: '' } } })))
    ).toBeNull()
    expect(validateConfig(createConfig(withAi({ agent: { scenario_models: [] } })))).toBe(
      'ai.agent.scenario_models 必须是对象'
    )
    expect(validateConfig(createConfig(withAi({ agent: { scenario_models: { planner: 1 } } })))).toBe(
      'ai.agent.scenario_models.planner 必须是字符串'
    )
    expect(validateConfig(createConfig(withAi({ agent: { scenario_models: { planner: 'bailian' } } })))).toBe(
      'ai.agent.scenario_models.planner 格式应为 provider:model'
    )
    expect(validateConfig(createConfig(withAi({ agent: { tool_policy: 'all' } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ agent: { tool_policy: 'high-risk' } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ agent: { tool_policy: 'auto' } })))).toBeNull()
    expect(validateConfig(createConfig(withAi({ agent: { tool_policy: 'chat' } })))).toBe(
      'ai.agent.tool_policy 值不合法'
    )
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

  it('validates memory settings', () => {
    expect(validateConfig(createConfig({ memory: { auto_capture: false } }))).toBeNull()
    expect(validateConfig(createConfig({ memory: [] }))).toBe('memory 必须是对象')
    expect(validateConfig(createConfig({ memory: { auto_capture: 'yes' } }))).toBe('memory.auto_capture 必须是布尔值')
  })

  it('keeps every valid shortcut key aligned with the shared contracts', () => {
    const configurableKeys = tools.filter((tool) => tool.shortcutKey).map((tool) => tool.shortcutKey)
    expect(VALID_SHORTCUT_KEYS).toEqual([...configurableKeys, ...SHORTCUT_ACTION_KEYS])
  })

  it('validates MCP server settings', () => {
    const server = { name: 'filesystem', command: 'npx', args: ['-y'] }
    expect(validateConfig(createConfig(withExtensions({ mcp_servers: [] })))).toBeNull()
    expect(validateConfig(createConfig(withExtensions({ mcp_servers: [server] })))).toBeNull()
    expect(validateConfig(createConfig(withExtensions({ mcp_servers: 'filesystem' })))).toBe(
      'extensions.mcp_servers 必须是数组'
    )
    expect(validateConfig(createConfig(withExtensions({ mcp_servers: [{ name: 'Bad Name', command: 'x' }] })))).toBe(
      'extensions.mcp_servers 中存在无效配置（服务名仅允许小写字母、数字和连字符，command 不能为空）'
    )
    expect(validateConfig(createConfig(withExtensions({ mcp_servers: [{ name: 'empty' }] })))).toBe(
      'extensions.mcp_servers 中存在无效配置（服务名仅允许小写字母、数字和连字符，command 不能为空）'
    )
    expect(validateConfig(createConfig(withExtensions({ mcp_servers: [server, server] })))).toBe(
      'extensions.mcp_servers 服务名重复：filesystem'
    )
  })

  it('validates disabled skills and description overrides', () => {
    expect(validateConfig(createConfig(withExtensions({ disabled_skills: ['sql-helper'] })))).toBeNull()
    expect(validateConfig(createConfig(withExtensions({ disabled_skills: 'sql-helper' })))).toBe(
      'extensions.disabled_skills 必须是数组'
    )
    expect(validateConfig(createConfig(withExtensions({ disabled_skills: ['Bad Name'] })))).toBe(
      'extensions.disabled_skills 中存在无效技能名：Bad Name'
    )
    expect(validateConfig(createConfig(withExtensions({ disabled_skills: ['sql-helper', 'sql-helper'] })))).toBe(
      'extensions.disabled_skills 中存在重复或无效的技能名'
    )

    expect(
      validateConfig(createConfig(withExtensions({ skill_overrides: { 'sql-helper': { description: 'new' } } })))
    ).toBeNull()
    expect(validateConfig(createConfig(withExtensions({ skill_overrides: {} })))).toBeNull()
    expect(validateConfig(createConfig(withExtensions({ skill_overrides: [] })))).toBe(
      'extensions.skill_overrides 必须是对象'
    )
    expect(
      validateConfig(createConfig(withExtensions({ skill_overrides: { 'sql-helper': { description: 1 } } })))
    ).toBe('extensions.skill_overrides.sql-helper.description 必须是字符串')
    expect(
      validateConfig(createConfig(withExtensions({ skill_overrides: { 'sql-helper': { description: '   ' } } })))
    ).toBe('extensions.skill_overrides 中没有有效的描述覆盖')
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
    expect(
      validateConfig(createConfig({ network: { market_sources: { clawhub: 'https://mirror.example.com' } } }))
    ).toBeNull()
    expect(validateConfig(createConfig({ network: { market_sources: {} } }))).toBeNull()
    expect(validateConfig(createConfig({ network: { market_sources: [] } }))).toBe('network.market_sources 必须是对象')
    expect(validateConfig(createConfig({ network: { market_sources: { unknown: '' } } }))).toBe(
      'network.market_sources.unknown 不是有效的配置项'
    )
    expect(validateConfig(createConfig({ network: { market_sources: { clawhub: 1 } } }))).toBe(
      'network.market_sources.clawhub 必须是字符串'
    )
    expect(validateConfig(createConfig({ network: { market_sources: { mcp_registry: 'not-a-url' } } }))).toBe(
      'network.market_sources.mcp_registry 必须是有效的 http(s) 地址'
    )
  })

  it('validates database transfer batch size and history limit', () => {
    expect(validateConfig(createConfig(withDatabase({ transfer_batch_size: 2000, history_limit: 500 })))).toBeNull()
    expect(validateConfig(createConfig(withDatabase({ transfer_batch_size: 1 })))).toBe(
      'database.transfer_batch_size 值不合法'
    )
    expect(validateConfig(createConfig(withDatabase({ history_limit: 201 })))).toBe('database.history_limit 值不合法')
    expect(validateConfig(createConfig(withDatabase({ transfer_tasks: 'nope' })))).toBe(
      'database.transfer_tasks 必须是数组'
    )
  })

  it('validates database connections, groups and audit settings', () => {
    expect(
      validateConfig(createConfig(withDatabase({ connections: [{ name: 'main' }], connection_groups: ['生产'] })))
    ).toBeNull()
    expect(validateConfig(createConfig(withDatabase({ connections: {} })))).toBe('database.connections 必须是数组')
    expect(validateConfig(createConfig(withDatabase({ connections: [{}] })))).toBe(
      'database.connections 中的连接缺少名称'
    )
    expect(validateConfig(createConfig(withDatabase({ connection_groups: ['生产', '生产'] })))).toBe(
      'database.connection_groups 分组名重复：生产'
    )
    expect(validateConfig(createConfig(withDatabase({ audit: { rules: { bogus: true } } })))).toBe(
      'database.audit.rules.bogus 不是有效的审核规则'
    )
    expect(validateConfig(createConfig(withDatabase({ safe_mode: 'yes' })))).toBe('database.safe_mode 必须是布尔值')
  })
})

describe('validateConfig agent runtime limits', () => {
  it('accepts in-range agent settings', () => {
    expect(
      validateConfig(
        createConfig(
          withAi({
            agent: {
              max_iterations: 12,
              timeout_min: 10,
              max_plan_steps: 8,
              max_parallel_tools: 4
            },
            tool_result: { max_kb: 24, run_kb: 160, retention_days: 7 }
          })
        )
      )
    ).toBeNull()
  })

  it('rejects out-of-range agent settings', () => {
    expect(validateConfig(createConfig(withAi({ agent: { max_iterations: 2 } })))).toBe(
      'ai.agent.max_iterations 必须是 3 到 30 之间的整数（Agent 最大执行轮次）'
    )
    expect(validateConfig(createConfig(withAi({ agent: { timeout_min: 0 } })))).toBe(
      'ai.agent.timeout_min 必须是 1 到 30 之间的整数（Agent 单任务时长上限（分钟））'
    )
    expect(validateConfig(createConfig(withAi({ agent: { max_plan_steps: 99 } })))).toBe(
      'ai.agent.max_plan_steps 必须是 3 到 12 之间的整数（计划步骤上限）'
    )
    expect(validateConfig(createConfig(withAi({ agent: { max_parallel_tools: 9 } })))).toBe(
      'ai.agent.max_parallel_tools 必须是 1 到 8 之间的整数（并行工具调用数）'
    )
    expect(validateConfig(createConfig(withAi({ tool_result: { max_kb: 1 } })))).toBe(
      'ai.tool_result.max_kb 必须是 4 到 64 之间的整数（单个工具结果预算（KB））'
    )
    expect(validateConfig(createConfig(withAi({ tool_result: { run_kb: 9999 } })))).toBe(
      'ai.tool_result.run_kb 必须是 32 到 512 之间的整数（单次运行工具结果预算（KB））'
    )
    expect(validateConfig(createConfig(withAi({ tool_result: { retention_days: 0 } })))).toBe(
      'ai.tool_result.retention_days 必须是 1 到 30 之间的整数（工具结果保留天数）'
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
