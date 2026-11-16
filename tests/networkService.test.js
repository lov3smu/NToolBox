import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  applyNetworkConfig,
  getNetworkConfig,
  getNetworkEnv,
  netFetch,
  testNetwork
} from '../src/main/services/network.js'

describe('applyNetworkConfig', () => {
  it('defaults to system mode with no proxy env', async () => {
    await applyNetworkConfig(undefined)
    expect(getNetworkConfig().proxy.mode).toBe('system')
    expect(getNetworkEnv()).toEqual({})
  })

  it('exports proxy env for manual mode', async () => {
    await applyNetworkConfig({
      network: { proxy: { mode: 'manual', url: 'http://127.0.0.1:7890', bypass: '<local>' } }
    })
    expect(getNetworkEnv()).toMatchObject({
      HTTP_PROXY: 'http://127.0.0.1:7890',
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      ALL_PROXY: 'http://127.0.0.1:7890',
      http_proxy: 'http://127.0.0.1:7890',
      NO_PROXY: 'localhost,127.0.0.1,::1'
    })
  })

  it('merges extra bypass entries', async () => {
    await applyNetworkConfig({
      network: { proxy: { mode: 'manual', url: 'socks5://127.0.0.1:1080', bypass: '<local> 10.0.0.0/8,*.corp' } }
    })
    expect(getNetworkEnv().NO_PROXY).toBe('localhost,127.0.0.1,::1,10.0.0.0/8,*.corp')
  })

  it('clears inherited proxy env in direct mode', async () => {
    await applyNetworkConfig({ network: { proxy: { mode: 'direct' } } })
    expect(getNetworkConfig().proxy.mode).toBe('direct')
    expect(getNetworkEnv()).toMatchObject({ HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '' })
  })

  it('normalizes invalid manual config back to system', async () => {
    await applyNetworkConfig({ network: { proxy: { mode: 'manual', url: '' } } })
    expect(getNetworkConfig().proxy.mode).toBe('system')
  })
})

describe('netFetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('falls back to global fetch outside Electron', async () => {
    const mock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', mock)
    const response = await netFetch('https://example.com/a', { method: 'GET' })
    expect(response.ok).toBe(true)
    expect(mock).toHaveBeenCalledWith('https://example.com/a', { method: 'GET' })
  })
})

describe('testNetwork', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects non-http addresses', async () => {
    const result = await testNetwork('ftp://example.com')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('http(s)')
  })

  it('reports status on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 204 }))
    )
    const result = await testNetwork('https://example.com')
    expect(result).toMatchObject({ ok: true, status: 204 })
  })

  it('reports error on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error('ECONNREFUSED')))
    )
    const result = await testNetwork('https://example.com')
    expect(result.ok).toBe(false)
    expect(result.error).toBe('ECONNREFUSED')
  })
})
