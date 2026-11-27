import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  executeSkill: vi.fn(async () => ({ success: true, content: 'skill-ok', metadata: { from: 'skill' } })),
  runInlineAi: vi.fn(async () => ({ success: true, content: 'ai-ok', model: 'mock-model' }))
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../src/main/services/extensions/skills.js', () => ({ executeSkill: mocks.executeSkill }))
vi.mock('../src/main/services/ai/inline.js', () => ({ runInlineAi: mocks.runInlineAi }))

const { CLI_COMMANDS, normalizeCliCommand, resolveToolPath, startCliServer, stopCliServer } =
  await import('../src/main/services/cliServer.js')

describe('CLI 命令归一化', () => {
  it('codec 默认编码并可切换解码', () => {
    expect(normalizeCliCommand('codec', { mode: 'base64', text: 'hello' })).toEqual({
      ok: true,
      kind: 'skill',
      skill: 'toolbox',
      params: { action: 'codec', mode: 'base64', direction: 'encode', text: 'hello' }
    })
    const decoded = normalizeCliCommand('codec', { mode: 'base64', direction: 'decode', text: 'aGVsbG8=' })
    expect(decoded.params.direction).toBe('decode')
    expect(normalizeCliCommand('codec', { mode: 'base64', direction: 'flip', text: 'x' }).ok).toBe(false)
    expect(normalizeCliCommand('codec', { mode: 'base64', text: '   ' }).ok).toBe(false)
  })

  it('db 子命令映射到只读技能', () => {
    expect(normalizeCliCommand('db', { action: 'databases', connection: 'local' })).toMatchObject({
      ok: true,
      skill: 'db-query',
      params: { action: 'list_databases', connection_name: 'local' }
    })
    expect(
      normalizeCliCommand('db', { action: 'query', connection: 'local', sql: 'SELECT 1', limit: 10 })
    ).toMatchObject({
      skill: 'db-query',
      params: { action: 'execute', sql: 'SELECT 1', limit: 10 }
    })
    expect(normalizeCliCommand('db', { action: 'schema', connection: 'local', table: 'users' })).toMatchObject({
      ok: true,
      skill: 'db-schema',
      params: { action: 'describe', table_name: 'users' }
    })
    expect(
      normalizeCliCommand('db', { action: 'schema', connection: 'local', table: 'users', schema_action: 'show_create' })
        .params.action
    ).toBe('show_create')
    expect(normalizeCliCommand('db', { action: 'drop', connection: 'local' }).ok).toBe(false)
    expect(normalizeCliCommand('db', { action: 'query', connection: 'local' }).ok).toBe(false)
  })

  it('ai 与 open 的最小校验', () => {
    expect(normalizeCliCommand('ai', { action: 'polish', text: 'hello' })).toEqual({
      ok: true,
      kind: 'ai',
      action: 'polish',
      text: 'hello'
    })
    expect(normalizeCliCommand('open', { target: '数据库客户端' })).toEqual({
      ok: true,
      kind: 'open',
      path: '/database'
    })
    expect(normalizeCliCommand('open', { target: 'chat' })).toMatchObject({ ok: true, path: '/chat' })
    expect(normalizeCliCommand('open', { target: '不存在的工具' }).ok).toBe(false)
    expect(normalizeCliCommand('nope', {}).ok).toBe(false)
  })

  it('resolveToolPath 只返回已知路径', () => {
    expect(resolveToolPath('/chat')).toBe('/chat')
    expect(resolveToolPath('AI助手')).toBe('/chat')
    expect(resolveToolPath('/unknown')).toBe('')
    expect(CLI_COMMANDS).toContain('codec')
  })
})

describe('CLI 伴生服务', () => {
  let serviceDir = ''
  let endpoint = null
  let token = ''

  const rpc = (payload, headers = {}) =>
    fetch(endpoint.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
      body: JSON.stringify(payload)
    })

  beforeAll(async () => {
    serviceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntb-cli-test-'))
    await startCliServer({ serviceDir, version: '9.9.9' })
    const serviceFile = path.join(serviceDir, `ntoolbox-cli-${process.pid}.json`)
    const info = JSON.parse(fs.readFileSync(serviceFile, 'utf8'))
    endpoint = { rpcUrl: info.rpcUrl, pid: info.pid }
    token = info.token
  })

  afterAll(() => {
    stopCliServer()
    fs.rmSync(serviceDir, { recursive: true, force: true })
  })

  it('服务文件包含本机地址与 token，且权限受限', () => {
    const serviceFile = path.join(serviceDir, `ntoolbox-cli-${process.pid}.json`)
    const info = JSON.parse(fs.readFileSync(serviceFile, 'utf8'))
    expect(info.rpcUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/rpc$/)
    expect(info.token).toMatch(/^[0-9a-f]{64}$/)
    expect(info.pid).toBe(process.pid)
    expect(info.version).toBe('9.9.9')
    if (process.platform !== 'win32') {
      expect(fs.statSync(serviceFile).mode & 0o777).toBe(0o600)
    }
  })

  it('status 返回版本、PID 与命令列表', async () => {
    const response = await rpc({ cmd: 'status' })
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.ok).toBe(true)
    expect(data.metadata).toMatchObject({ version: '9.9.9', pid: process.pid })
    expect(data.metadata.commands).toContain('codec')
    expect(data.metadata.aiActions).toContain('polish')
    expect(JSON.stringify(data)).not.toContain(token)
  })

  it('技能命令交给 skills 服务执行', async () => {
    const response = await rpc({ cmd: 'codec', args: { mode: 'base64', text: 'hello' } })
    const data = await response.json()
    expect(data).toEqual({ ok: true, content: 'skill-ok', metadata: { from: 'skill' } })
    expect(mocks.executeSkill).toHaveBeenCalledWith('toolbox', {
      action: 'codec',
      mode: 'base64',
      direction: 'encode',
      text: 'hello'
    })
  })

  it('技能用 content 报告错误时保留原始信息', async () => {
    mocks.executeSkill.mockResolvedValueOnce({
      success: false,
      content: '执行SQL失败：表不存在',
      metadata: { reason: 'query' }
    })
    const response = await rpc({ cmd: 'codec', args: { mode: 'base64', text: 'x' } })
    const data = await response.json()
    expect(data).toEqual({ ok: false, error: '执行SQL失败：表不存在' })
  })

  it('AI 命令走就地 AI 服务', async () => {
    const response = await rpc({ cmd: 'ai', args: { action: 'summarize', text: '很长的内容' } })
    const data = await response.json()
    expect(data).toMatchObject({ ok: true, content: 'ai-ok' })
    expect(mocks.runInlineAi).toHaveBeenCalledWith({ action: 'summarize', text: '很长的内容' })
  })

  it('缺少 token、跨源请求与错误路径都会被拒绝', async () => {
    const unauthorized = await fetch(endpoint.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: 'status' })
    })
    expect(unauthorized.status).toBe(401)

    const crossOrigin = await rpc({ cmd: 'status' }, { Origin: 'http://evil.example' })
    expect(crossOrigin.status).toBe(403)

    const notFound = await fetch(endpoint.rpcUrl.replace('/rpc', '/other'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}'
    })
    expect(notFound.status).toBe(404)

    const wrongType = await rpc({ cmd: 'status' }, { 'Content-Type': 'text/plain' })
    expect(wrongType.status).toBe(415)

    const unknown = await rpc({ cmd: 'stream-config' })
    expect(unknown.status).toBe(400)
    const unknownData = await unknown.json()
    expect(unknownData.ok).toBe(false)
  })

  it('stopCliServer 移除服务文件', () => {
    const serviceFile = path.join(serviceDir, `ntoolbox-cli-${process.pid}.json`)
    expect(fs.existsSync(serviceFile)).toBe(true)
    stopCliServer()
    expect(fs.existsSync(serviceFile)).toBe(false)
  })
})
