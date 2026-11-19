import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => path.join(process.cwd(), '.tmp-mcp-test') }
}))

vi.mock('../src/main/services/config.js', () => ({
  getConfig: () => ({ extensions: { mcp_servers: [] } })
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  callMcpTool,
  getMcpStatus,
  getMcpToolDefinitions,
  initMcp,
  isMcpToolName,
  stopMcp
} from '../src/main/services/mcp.js'
import { buildMcpToolName, normalizeMcpServers, parseMcpToolName } from '../src/shared/mcp.js'

const fixtureServer = path.join(__dirname, 'fixtures', 'mcpEchoServer.cjs')

function fixtureConfig(overrides = {}) {
  return {
    name: 'fixture',
    command: process.execPath,
    args: [fixtureServer],
    enabled: true,
    ...overrides
  }
}

afterEach(() => {
  stopMcp()
})

describe('MCP 服务', () => {
  it('连接 stdio 服务并注册工具、执行工具调用', async () => {
    const status = await initMcp([fixtureConfig()])
    expect(status).toEqual([expect.objectContaining({ name: 'fixture', status: 'ready', toolCount: 2 })])

    const definitions = getMcpToolDefinitions()
    const echo = definitions.find((item) => item.function.name === 'mcp__fixture__echo')
    expect(echo?.function.parameters).toEqual(expect.objectContaining({ type: 'object', required: ['text'] }))

    const result = await callMcpTool('mcp__fixture__echo', { text: '你好' })
    expect(result).toEqual(expect.objectContaining({ success: true, content: 'echo:你好' }))

    const failed = await callMcpTool('mcp__fixture__fail', {})
    expect(failed.success).toBe(false)
    expect(failed.error).toBe('boom')

    const unknown = await callMcpTool('mcp__fixture__missing', {})
    expect(unknown.success).toBe(false)
  })

  it('单个服务启动失败不影响其他服务', async () => {
    const status = await initMcp([
      fixtureConfig(),
      { name: 'broken', command: path.join(__dirname, 'fixtures', 'missing-command'), args: [] }
    ])

    expect(status.find((item) => item.name === 'fixture')).toEqual(
      expect.objectContaining({ status: 'ready', toolCount: 2 })
    )
    expect(status.find((item) => item.name === 'broken')).toEqual(expect.objectContaining({ status: 'error' }))
    expect(getMcpStatus()).toHaveLength(2)
  })

  it('禁用服务只出现在状态列表，不注册工具', async () => {
    const status = await initMcp([fixtureConfig({ enabled: false })])
    expect(status[0]).toEqual(expect.objectContaining({ status: 'disabled', toolCount: 0 }))
    expect(getMcpToolDefinitions()).toEqual([])
  })

  it('停止后清空状态与工具', async () => {
    await initMcp([fixtureConfig()])
    expect(getMcpToolDefinitions().length).toBe(2)
    stopMcp()
    expect(getMcpStatus()).toEqual([])
    expect(getMcpToolDefinitions()).toEqual([])
  })
})

describe('MCP 名称与配置规范化', () => {
  it('生成与解析工具名', () => {
    const name = buildMcpToolName('filesystem', 'read.file')
    expect(name).toBe('mcp__filesystem__read_file')
    expect(parseMcpToolName(name)).toEqual({ server: 'filesystem', tool: 'read_file' })
    expect(parseMcpToolName('file-ops')).toBeNull()
    expect(isMcpToolName(name)).toBe(true)
  })

  it('过滤非法与重复服务配置', () => {
    const servers = normalizeMcpServers([
      { name: 'Filesystem', command: ' npx ', args: [' -y ', '', 3], env: { TOKEN: 123, bad: null }, enabled: true },
      { name: 'filesystem', command: 'other' },
      { name: 'bad name', command: 'x' },
      { name: 'no-command' },
      { name: 'with__underscore', command: 'x' }
    ])

    expect(servers).toHaveLength(1)
    expect(servers[0]).toEqual({
      name: 'filesystem',
      command: 'npx',
      args: ['-y'],
      env: { TOKEN: '123' },
      enabled: true
    })
  })
})
