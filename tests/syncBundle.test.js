import { describe, expect, it } from 'vitest'
import {
  SYNC_FILE_NAME,
  SYNC_FORMAT,
  SYNC_VERSION,
  buildSyncPatch,
  buildSyncSnapshot,
  extractSyncSections,
  mergeSyncSections,
  parseSyncSnapshot
} from '../src/shared/syncBundle.js'

function createConfig() {
  return {
    app: { shortcuts: { settings: 'CmdOrCtrl+,', global_search: 'CmdOrCtrl+K' } },
    appearance: { theme: 'system', theme_style: 'sapphire', font_size: 'medium', language: 'zh-CN' },
    notifications: { upload_done: 'system', backup_done: 'panel', update_found: 'off', agent_done: 'system' },
    clipboard_history: { persist: true, max_entries: 120 },
    network: {
      proxy: { mode: 'manual', url: 'http://user:pass@127.0.0.1:7890', bypass: '' },
      market_sources: { clawhub: 'https://clawhub.example.com' }
    },
    database: {
      safe_mode: true,
      page_size: 100,
      audit: { enabled: true, strict: false, rules: { drop: true } },
      editor: { theme: 'dark', tab_size: 2 },
      connections: [{ name: 'prod', host: '10.0.0.1', password: 'db-secret' }],
      backup_tasks: [{ id: 'b1' }]
    },
    sql_generator: {
      base_path: '/home/user/scripts',
      text_edit_app: '/usr/bin/code',
      developer: { ch_name: '张三', en_name: 'zhangsan' },
      databases: ['demo'],
      script_types: [{ name: 'DDL', description: '' }]
    },
    ai: {
      provider: 'openai',
      keys: { openai: 'sk-secret' },
      base_urls: { openai: 'https://api.example.com/v1' },
      models: { openai: { default: 'gpt', models: [{ id: 'gpt' }] } },
      persona: '简洁',
      temperature: 0.3,
      agent: {
        max_iterations: 10,
        timeout_min: 5,
        max_plan_steps: 8,
        max_parallel_tools: 4,
        tool_policy: 'high-risk',
        scenario_models: { planner: 'openai:gpt' }
      }
    },
    memory: { auto_capture: true },
    extensions: { mcp_servers: [{ name: 'gh', command: 'npx', token: 'mcp-secret' }] }
  }
}

function section(id, values, updatedAt = 1000) {
  return { [id]: { updated_at: updatedAt, values } }
}

describe('跨设备同步契约', () => {
  it('只提取白名单字段，保留的设备路径与凭据不进入同步数据', () => {
    const sections = extractSyncSections(createConfig())

    expect(sections.appearance.theme).toBe('system')
    expect(sections.shortcuts.settings).toBe('CmdOrCtrl+,')
    expect(sections.network.market_sources.clawhub).toBe('https://clawhub.example.com')
    expect(sections.network.proxy).toBeUndefined()
    expect(sections.database.connections).toBeUndefined()
    expect(sections.database.backup_tasks).toBeUndefined()
    expect(sections.database.safe_mode).toBe(true)
    expect(sections.sql_generator.base_path).toBeUndefined()
    expect(sections.sql_generator.text_edit_app).toBeUndefined()
    expect(sections.ai.keys).toBeUndefined()
    expect(sections.ai.base_urls).toBeUndefined()
    expect(sections.ai.agent.scenario_models).toBeUndefined()
    expect(sections.ai.agent.tool_policy).toBe('high-risk')
    expect(sections.memory.auto_capture).toBe(true)
  })

  it('构造保存补丁时只保留已知字段，忽略注入的连接与未知键', () => {
    const patch = buildSyncPatch({
      appearance: { theme: 'dark', sneaky: 'ignored' },
      database: { safe_mode: false, connections: [{ password: 'evil' }] },
      ai: { persona: 'hacker', agent: { tool_policy: 'auto', scenario_models: { x: 'y' } } },
      network: { market_sources: { clawhub: 'https://a.example.com' } },
      unknown_section: { whatever: true }
    })

    expect(patch.appearance).toEqual({ theme: 'dark' })
    expect(patch.database).toEqual({ safe_mode: false })
    expect(patch.ai).toEqual({ persona: 'hacker', agent: { tool_policy: 'auto' } })
    expect(patch.network).toEqual({ market_sources: { clawhub: 'https://a.example.com' } })
    expect(patch.unknown_section).toBeUndefined()
    expect(patch.connections).toBeUndefined()
  })

  it('快照可往返解析，并忽略未知分区', () => {
    const snapshot = buildSyncSnapshot({
      sections: {
        ...section('appearance', { theme: 'dark' }, 10),
        ...section('memory', { auto_capture: false }, 20),
        ghost: { updated_at: 1, values: { a: 1 } }
      },
      device: { id: 'dev-1', name: '办公机' },
      updatedAt: '2026-11-27T00:00:00.000Z'
    })

    expect(snapshot.type).toBe(SYNC_FORMAT)
    expect(snapshot.version).toBe(SYNC_VERSION)
    expect(snapshot.sections.ghost).toBeUndefined()

    const parsed = parseSyncSnapshot(JSON.stringify(snapshot))
    expect(parsed.ok).toBe(true)
    expect(parsed.snapshot.device).toEqual({ id: 'dev-1', name: '办公机' })
    expect(parsed.snapshot.sections.appearance.updated_at).toBe(10)
    expect(parsed.snapshot.sections.memory.values.auto_capture).toBe(false)
    expect(SYNC_FILE_NAME).toBe('ntoolbox-sync.json')
  })

  it('拒绝格式、类型、版本与分区结构非法的快照', () => {
    expect(parseSyncSnapshot('{').code).toBe('format')
    expect(parseSyncSnapshot({ type: 'other' }).code).toBe('type')
    expect(parseSyncSnapshot({ type: SYNC_FORMAT, version: 99, sections: {} }).code).toBe('version')
    expect(parseSyncSnapshot({ type: SYNC_FORMAT, version: 1, sections: [] }).code).toBe('sections')
    expect(parseSyncSnapshot({ type: SYNC_FORMAT, version: 1, sections: { appearance: { values: {} } } }).code).toBe(
      'sections'
    )
  })

  it('按分区时间戳合并：新者生效，本地独有推送、远端独有应用', () => {
    const merged = mergeSyncSections(
      {
        appearance: { updated_at: 200, values: { theme: 'dark' } },
        shortcuts: { updated_at: 100, values: { settings: 'Ctrl+,' } },
        memory: { updated_at: 50, values: { auto_capture: true } }
      },
      {
        appearance: { updated_at: 100, values: { theme: 'light' } },
        shortcuts: { updated_at: 300, values: { settings: 'Cmd+,' } },
        clipboard: { updated_at: 10, values: { persist: true } }
      }
    )

    expect(merged.sections.appearance.values.theme).toBe('dark')
    expect(merged.sections.shortcuts.values.settings).toBe('Cmd+,')
    expect(merged.sections.memory.values.auto_capture).toBe(true)
    expect(merged.sections.clipboard.values.persist).toBe(true)
    expect(merged.pushed).toEqual(['appearance', 'memory'])
    expect(merged.applied).toEqual(['shortcuts', 'clipboard'])
  })

  it('时间戳相同且内容不同时本地优先并上报推送', () => {
    const merged = mergeSyncSections(
      { appearance: { updated_at: 100, values: { theme: 'dark' } } },
      { appearance: { updated_at: 100, values: { theme: 'light' } } }
    )
    expect(merged.sections.appearance.values.theme).toBe('dark')
    expect(merged.pushed).toEqual(['appearance'])
    expect(merged.applied).toEqual([])
  })

  it('内容相同则不产生应用或推送', () => {
    const merged = mergeSyncSections(
      { appearance: { updated_at: 100, values: { theme: 'dark' } } },
      { appearance: { updated_at: 200, values: { theme: 'dark' } } }
    )
    expect(merged.applied).toEqual([])
    expect(merged.pushed).toEqual([])
  })

  it('时间戳超前过多时按当前时间封顶，不会永久压制本机修改', () => {
    const now = Date.now()
    const merged = mergeSyncSections(
      { appearance: { updated_at: now + 20 * 60 * 1000, values: { theme: 'dark' } } },
      { appearance: { updated_at: now + 60 * 60 * 1000, values: { theme: 'light' } } }
    )
    expect(merged.sections.appearance.values.theme).toBe('dark')
    expect(merged.pushed).toEqual(['appearance'])
    expect(merged.applied).toEqual([])
  })
})
