import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/main/utils/path', () => ({
  getDataDir: () => globalThis.__sandboxDataDir
}))
vi.mock('../src/main/services/network.js', () => ({
  netFetch: (...args) => globalThis.__sandboxNetFetch(...args)
}))
vi.mock('../src/main/services/i18n.js', () => ({
  t: (key, params = {}) => key.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? '')
}))

const { executeSandboxAction, clearPluginSandboxStorage } =
  await import('../src/main/services/extensions/pluginSandbox.js')
const { normalizeSandbox, normalizeSandboxAction, isSandboxHostAllowed } =
  await import('../src/shared/pluginSandbox.js')

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ntb-sandbox-test-'))
globalThis.__sandboxDataDir = tempRoot

beforeEach(() => {
  globalThis.__sandboxNetFetch = vi.fn()
})

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true })
})

function httpResponse(body, { status = 200, url = 'https://api.example.com/status', headers = {} } = {}) {
  return {
    status,
    statusText: 'OK',
    url,
    headers: { get: (name) => headers[name] ?? null },
    text: async () => body
  }
}

describe('沙箱动作规范化', () => {
  it('工具箱动作强制读取剪贴板并派生权限', () => {
    const action = normalizeSandboxAction({
      id: 'format-json',
      title: '格式化剪贴板 JSON',
      op: 'toolbox',
      params: { action: 'codec', mode: 'json', direction: 'encode' }
    })
    expect(action).toMatchObject({
      input: 'clipboard',
      output: 'clipboard',
      permissions: ['toolbox', 'clipboard.read', 'clipboard.write']
    })
    expect(action.params).toEqual({ action: 'codec', mode: 'json', direction: 'encode' })

    expect(
      normalizeSandboxAction({
        id: 'list-templates',
        title: '列出模板',
        op: 'toolbox',
        params: { action: 'template', query: '周报' }
      })
    ).toMatchObject({ input: 'none', permissions: ['toolbox', 'clipboard.write'] })
  })

  it('拒绝未知工具动作与非法参数', () => {
    expect(normalizeSandboxAction({ id: 'bad', title: 'x', op: 'toolbox', params: { action: 'eval' } })).toBeNull()
    expect(
      normalizeSandboxAction({ id: 'bad', title: 'x', op: 'toolbox', params: { action: 'codec', mode: 'morse' } })
    ).toBeNull()
    expect(
      normalizeSandboxAction({ id: 'bad', title: 'x', op: 'toolbox', params: { action: 'regex', pattern: '' } })
    ).toBeNull()
    expect(normalizeSandboxAction({ id: 'Bad Id', title: 'x', op: 'storage', params: { key: 'k' } })).toBeNull()
    expect(normalizeSandboxAction({ id: 'bad', title: '', op: 'storage', params: { key: 'k' } })).toBeNull()
  })

  it('过滤正则修饰符', () => {
    const action = normalizeSandboxAction({
      id: 'match',
      title: '提取数字',
      op: 'toolbox',
      params: { action: 'regex', pattern: '\\d+', flags: 'giz' }
    })
    expect(action.params).toEqual({ action: 'regex', pattern: '\\d+', flags: 'gi' })
  })

  it('HTTP 动作拒绝内网、凭据与非 HTTP 协议', () => {
    const build = (params) => normalizeSandboxAction({ id: 'fetch', title: '请求', op: 'http', params })
    expect(build({ url: 'http://localhost/status' })).toBeNull()
    expect(build({ url: 'http://127.0.0.1/status' })).toBeNull()
    expect(build({ url: 'http://192.168.1.10/status' })).toBeNull()
    expect(build({ url: 'https://user:pass@example.com/status' })).toBeNull()
    expect(build({ url: 'file:///etc/passwd' })).toBeNull()
    expect(build({ url: 'not-a-url' })).toBeNull()
  })

  it('HTTP 动作保留声明主机并收敛超时', () => {
    const action = normalizeSandboxAction({
      id: 'fetch',
      title: '请求',
      op: 'http',
      output: 'notification',
      params: {
        url: 'https://api.example.com/status',
        method: 'POST',
        body: '{"ping":true}',
        headers: { Accept: 'application/json', authorization: 'secret' },
        timeoutMs: 90000,
        hosts: ['cdn.example.com']
      }
    })
    expect(action.output).toBe('notification')
    expect(action.permissions).toEqual(['network', 'notifications'])
    expect(action.params).toMatchObject({
      method: 'POST',
      body: '{"ping":true}',
      headers: { accept: 'application/json' },
      timeoutMs: 15000,
      hosts: ['api.example.com', 'cdn.example.com']
    })
  })

  it('校验存储键与写入值', () => {
    const build = (params) => normalizeSandboxAction({ id: 'state', title: '计数', op: 'storage', params })
    expect(build({ key: 'count' })).toMatchObject({ params: { key: 'count', mode: 'get' } })
    expect(build({ key: 'count', mode: 'incr' })).toMatchObject({ params: { key: 'count', mode: 'incr', delta: 1 } })
    expect(build({ key: 'count', mode: 'set', value: 3 })).toMatchObject({ params: { value: 3 } })
    expect(build({ key: 'count', mode: 'set' })).toBeNull()
    expect(build({ key: '../escape' })).toBeNull()
  })

  it('整体规范化拒绝重复 ID、超量与空动作', () => {
    const action = { id: 'same', title: 'A', op: 'storage', params: { key: 'k' } }
    expect(normalizeSandbox({ actions: [action, action] }).error).toContain('重复')
    expect(
      normalizeSandbox({ actions: Array.from({ length: 17 }, (_, i) => ({ ...action, id: `a${i}` })) }).error
    ).toContain('不能超过')
    expect(normalizeSandbox({ actions: [] }).error).toContain('至少一个动作')
    expect(normalizeSandbox(undefined).sandbox).toEqual({ actions: [], permissions: [] })
  })

  it('主机白名单支持通配子域', () => {
    expect(isSandboxHostAllowed('api.example.com', ['api.example.com'])).toBe(true)
    expect(isSandboxHostAllowed('cdn.example.com', ['*.example.com'])).toBe(true)
    expect(isSandboxHostAllowed('example.com', ['*.example.com'])).toBe(false)
    expect(isSandboxHostAllowed('api.example.com', ['other.com'])).toBe(false)
  })
})

describe('沙箱动作执行', () => {
  it('工具箱动作消费剪贴板文本', async () => {
    const action = normalizeSandboxAction({
      id: 'b64',
      title: 'Base64 编码',
      op: 'toolbox',
      params: { action: 'codec', mode: 'base64', direction: 'encode' }
    })
    await expect(executeSandboxAction('demo', action, { text: 'hello' })).resolves.toEqual({
      success: true,
      output: 'aGVsbG8='
    })
    await expect(executeSandboxAction('demo', action, { text: '  ' })).resolves.toEqual({
      success: false,
      error: '剪贴板中没有可用的文本'
    })
  })

  it('存储动作按插件隔离并可清除', async () => {
    const incr = normalizeSandboxAction({
      id: 'incr',
      title: '计数',
      op: 'storage',
      params: { key: 'count', mode: 'incr' }
    })
    const get = normalizeSandboxAction({ id: 'get', title: '读取', op: 'storage', params: { key: 'count' } })

    expect(await executeSandboxAction('alpha', incr)).toEqual({ success: true, output: '1' })
    expect(await executeSandboxAction('alpha', incr)).toEqual({ success: true, output: '2' })
    expect(await executeSandboxAction('beta', get)).toEqual({ success: true, output: 'null' })

    await clearPluginSandboxStorage('alpha')
    expect(await executeSandboxAction('alpha', get)).toEqual({ success: true, output: 'null' })
  })

  it('HTTP 动作拦截未授权重定向与超限响应', async () => {
    const action = normalizeSandboxAction({
      id: 'fetch',
      title: '请求',
      op: 'http',
      params: { url: 'https://api.example.com/status' }
    })

    globalThis.__sandboxNetFetch = vi
      .fn()
      .mockResolvedValue(httpResponse('{"ok":true}', { url: 'https://evil.example.net/status' }))
    await expect(executeSandboxAction('demo', action)).resolves.toEqual({
      success: false,
      error: '沙箱请求被重定向到未授权的主机'
    })

    globalThis.__sandboxNetFetch = vi
      .fn()
      .mockResolvedValue(httpResponse('x', { headers: { 'content-length': String(3 * 1024 * 1024) } }))
    await expect(executeSandboxAction('demo', action)).resolves.toEqual({
      success: false,
      error: '沙箱请求的响应超过大小限制'
    })
  })

  it('HTTP 动作返回状态与正文预览', async () => {
    const action = normalizeSandboxAction({
      id: 'fetch',
      title: '请求',
      op: 'http',
      params: { url: 'https://api.example.com/status', headers: { accept: 'text/plain' } }
    })
    globalThis.__sandboxNetFetch = vi.fn().mockResolvedValue(httpResponse('all good'))

    const result = await executeSandboxAction('demo', action)
    expect(result.success).toBe(true)
    expect(result.output).toBe('HTTP 200 OK\n\nall good')
    expect(globalThis.__sandboxNetFetch.mock.calls[0][1].headers).toMatchObject({
      'user-agent': 'NToolBox',
      accept: 'text/plain'
    })
  })
})
