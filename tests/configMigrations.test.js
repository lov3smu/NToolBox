import { describe, expect, it } from 'vitest'
import { CONFIG_VERSION, migrateConfig, mergeConfig } from '../src/main/services/configMigrations.js'

describe('migrateConfig', () => {
  it('treats configs without a valid version as v1', () => {
    expect(migrateConfig(null)).toEqual({ config: {}, migrated: false })
    expect(migrateConfig([])).toEqual({ config: {}, migrated: false })
    const { config, migrated } = migrateConfig({ theme: 'dark' })
    expect(migrated).toBe(true)
    expect(config.config_version).toBe(CONFIG_VERSION)
    expect(config.appearance.theme).toBe('dark')
  })

  it('leaves current-version configs untouched', () => {
    const raw = { config_version: 2, appearance: { theme: 'dark' } }
    expect(migrateConfig(raw)).toEqual({ config: raw, migrated: false })
  })

  it('maps flat v1 keys into v2 groups', () => {
    const { config } = migrateConfig({
      base_path: '/tmp/scripts',
      developer_ch_name: '张三',
      developer_en_name: 'zhangsan',
      text_edit_app: 'code',
      auto_start: false,
      close_action: 'hide',
      recent_tools_limit: 6,
      shortcuts: { settings: 'Alt+S' },
      theme: 'light',
      theme_style: 'forest',
      font_size: 'large',
      auto_update: false,
      update_check_interval: 24,
      network: { proxy: { mode: 'direct' } },
      market_sources: { clawhub: 'https://mirror.example.com' },
      database_safe_mode: false,
      database_page_size: 500,
      database_refresh_interval: 10,
      database_transfer_batch_size: 2000,
      database_history_limit: 500,
      database_audit_enabled: true,
      database_audit_strict: true,
      database_audit_rules: { full_scan: true },
      database_operation_log_enabled: false,
      database_editor: { theme: 'one-dark' },
      databases: ['main_db'],
      script_types: [{ name: 'DDL' }],
      ai_provider: 'deepseek',
      ai_api_keys: { deepseek: 'sk-test' },
      ai_base_urls: { deepseek: 'https://api.deepseek.com/v1' },
      ai_models: { deepseek: { default: 'deepseek-v4-pro', models: [{ id: 'deepseek-v4-pro' }] } },
      ai_fallback_enabled: false,
      ai_fallback_models: ['zhipu:glm-5.3'],
      ai_persona: '运维专家',
      ai_temperature: 0.3,
      ai_timeout: 120,
      ai_connection_timeout: 20,
      ai_compress_threshold: 80,
      ai_compress_keep_recent: 10,
      ai_max_attachments: 12,
      ai_max_image_mb: 20,
      ai_max_text_kb: 512,
      ai_agent_max_iterations: 12,
      ai_agent_timeout_min: 10,
      ai_agent_plan_steps: 8,
      ai_agent_parallel_tools: 4,
      ai_scenario_models: { planner: 'bailian:qwen3.8-flash' },
      ai_tool_policy: 'high-risk',
      ai_tool_result_max_kb: 32,
      ai_tool_result_run_kb: 200,
      ai_tool_result_retention_days: 14,
      memory_auto_capture: false,
      image_hosting: { active: 'github' },
      mcp_servers: [{ name: 'filesystem', command: 'npx' }],
      disabled_skills: ['sql-helper'],
      skill_overrides: { 'sql-helper': { description: 'new' } },
      notifications: { upload_done: false },
      clipboard_history: { persist: false }
    })

    expect(config).toMatchObject({
      config_version: 2,
      app: {
        base_path: '/tmp/scripts',
        developer: { ch_name: '张三', en_name: 'zhangsan' },
        text_edit_app: 'code',
        auto_start: false,
        close_action: 'hide',
        recent_tools_limit: 6,
        shortcuts: { settings: 'Alt+S' }
      },
      appearance: { theme: 'light', theme_style: 'forest', font_size: 'large' },
      update: { auto_update: false, check_interval: 24 },
      network: { proxy: { mode: 'direct' }, market_sources: { clawhub: 'https://mirror.example.com' } },
      database: {
        safe_mode: false,
        page_size: 500,
        refresh_interval: 10,
        transfer_batch_size: 2000,
        history_limit: 500,
        audit: { enabled: true, strict: true, rules: { full_scan: true } },
        operation_log_enabled: false,
        editor: { theme: 'one-dark' }
      },
      sql_generator: { databases: ['main_db'], script_types: [{ name: 'DDL' }] },
      ai: {
        provider: 'deepseek',
        keys: { deepseek: 'sk-test' },
        base_urls: { deepseek: 'https://api.deepseek.com/v1' },
        models: { deepseek: { default: 'deepseek-v4-pro', models: [{ id: 'deepseek-v4-pro' }] } },
        fallback: { enabled: false, models: ['zhipu:glm-5.3'] },
        persona: '运维专家',
        temperature: 0.3,
        timeout: 120,
        connection_timeout: 20,
        context: { compress_threshold: 80, keep_recent: 10 },
        attachments: { max_count: 12, max_image_mb: 20, max_text_kb: 512 },
        agent: {
          max_iterations: 12,
          timeout_min: 10,
          max_plan_steps: 8,
          max_parallel_tools: 4,
          scenario_models: { planner: 'bailian:qwen3.8-flash' },
          tool_policy: 'high-risk'
        },
        tool_result: { max_kb: 32, run_kb: 200, retention_days: 14 }
      },
      memory: { auto_capture: false },
      image_hosting: { active: 'github' },
      extensions: {
        mcp_servers: [{ name: 'filesystem', command: 'npx' }],
        disabled_skills: ['sql-helper'],
        skill_overrides: { 'sql-helper': { description: 'new' } }
      },
      notifications: { upload_done: false },
      clipboard_history: { persist: false }
    })
  })

  it('moves db connections, groups and transfer tasks', () => {
    const { config } = migrateConfig({
      dbConnections: [{ name: 'prod' }],
      dbConnectionGroups: ['生产'],
      db_backup_tasks: [{ id: 'b1', name: '每日备份' }],
      dbTransferTasks: [{ id: 't1' }]
    })
    expect(config.database.connections).toEqual([{ name: 'prod' }])
    expect(config.database.connection_groups).toEqual(['生产'])
    expect(config.database.backup_tasks).toEqual([{ id: 'b1', name: '每日备份' }])
    expect(config.database.transfer_tasks).toEqual([{ id: 't1' }])
  })

  it('absorbs the legacy bailian_api_key without overriding ai_api_keys', () => {
    expect(migrateConfig({ bailian_api_key: 'sk-legacy' }).config.ai.keys).toEqual({ bailian: 'sk-legacy' })
    expect(
      migrateConfig({ ai_api_keys: { bailian: 'sk-new' }, bailian_api_key: 'sk-legacy' }).config.ai.keys
    ).toEqual({ bailian: 'sk-new' })
    expect(migrateConfig({ bailian_api_key: '   ' }).config.ai).toBeUndefined()
  })

  it('raises the old default of 10 iterations to 20 exactly once', () => {
    expect(migrateConfig({ ai_agent_max_iterations: 10 }).config.ai.agent.max_iterations).toBe(20)
    expect(
      migrateConfig({ ai_agent_max_iterations: 10, ai_agent_iterations_upgraded: true }).config.ai.agent.max_iterations
    ).toBe(10)
    expect(migrateConfig({ ai_agent_max_iterations: 12 }).config.ai.agent.max_iterations).toBe(12)
  })

  it('drops undefined values from migrated groups', () => {
    const { config } = migrateConfig({ theme: 'dark' })
    expect(config.app).toBeUndefined()
    expect(config.ai).toBeUndefined()
    expect(config.database).toBeUndefined()
  })
})

describe('mergeConfig', () => {
  it('deep merges nested objects without mutating inputs', () => {
    const base = { ai: { provider: 'bailian', agent: { max_iterations: 20 } }, theme: 'dark' }
    const patch = { ai: { agent: { tool_policy: 'auto' } }, theme: 'light' }
    const merged = mergeConfig(base, patch)

    expect(merged).toEqual({
      ai: { provider: 'bailian', agent: { max_iterations: 20, tool_policy: 'auto' } },
      theme: 'light'
    })
    expect(base.ai.agent).toEqual({ max_iterations: 20 })
  })

  it('replaces arrays and ignores undefined values', () => {
    const merged = mergeConfig({ ai: { fallback: { models: ['a:b'] } } }, { ai: { fallback: { models: ['c:d'] } } })
    expect(merged.ai.fallback.models).toEqual(['c:d'])
    expect(mergeConfig({ theme: 'dark' }, { theme: undefined })).toEqual({ theme: 'dark' })
  })

  it('falls back to an empty object for invalid input', () => {
    expect(mergeConfig(null, { theme: 'dark' })).toEqual({ theme: 'dark' })
    expect(mergeConfig({ theme: 'dark' }, null)).toEqual({ theme: 'dark' })
    expect(mergeConfig('bad', { theme: 'dark' })).toEqual({ theme: 'dark' })
  })
})
