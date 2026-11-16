import { describe, it, expect } from 'vitest'
import {
  PROXY_MODES,
  DEFAULT_PROXY_BYPASS,
  DEFAULT_MARKET_SOURCES,
  CLAWHUB_DEFAULT_BASE,
  MCP_REGISTRY_DEFAULT_BASE,
  UPDATE_FEED_DEFAULT_URL,
  isHttpUrl,
  isProxyUrl,
  normalizeNetworkProxy,
  normalizeNetworkConfig,
  normalizeMarketSources,
  getClawhubBase,
  getMcpRegistryBase,
  getUpdateFeedUrl
} from '../src/shared/network.js'

describe('proxy modes', () => {
  it('exposes system/direct/manual in order', () => {
    expect(PROXY_MODES).toEqual(['system', 'direct', 'manual'])
  })
})

describe('url guards', () => {
  it('accepts http(s) urls', () => {
    expect(isHttpUrl('https://clawhub.ai')).toBe(true)
    expect(isHttpUrl('http://localhost:8080/x')).toBe(true)
    expect(isHttpUrl('ftp://a')).toBe(false)
    expect(isHttpUrl('nope')).toBe(false)
  })

  it('accepts http(s) and socks5 proxy urls', () => {
    expect(isProxyUrl('http://127.0.0.1:7890')).toBe(true)
    expect(isProxyUrl('https://proxy.local:443')).toBe(true)
    expect(isProxyUrl('socks5://127.0.0.1:1080')).toBe(true)
    expect(isProxyUrl('socks4://127.0.0.1:1080')).toBe(false)
    expect(isProxyUrl('')).toBe(false)
  })
})

describe('normalizeNetworkProxy', () => {
  it('defaults to following the system proxy', () => {
    expect(normalizeNetworkProxy()).toEqual({ mode: 'system', url: '', bypass: DEFAULT_PROXY_BYPASS })
    expect(normalizeNetworkProxy('x')).toEqual({ mode: 'system', url: '', bypass: DEFAULT_PROXY_BYPASS })
    expect(normalizeNetworkProxy([])).toEqual({ mode: 'system', url: '', bypass: DEFAULT_PROXY_BYPASS })
  })

  it('keeps direct mode', () => {
    expect(normalizeNetworkProxy({ mode: 'direct' }).mode).toBe('direct')
  })

  it('keeps manual mode when a valid proxy url is present', () => {
    const result = normalizeNetworkProxy({ mode: 'manual', url: ' socks5://127.0.0.1:1080 ' })
    expect(result).toEqual({ mode: 'manual', url: 'socks5://127.0.0.1:1080', bypass: DEFAULT_PROXY_BYPASS })
  })

  it('falls back to system when manual mode has no usable url', () => {
    expect(normalizeNetworkProxy({ mode: 'manual' }).mode).toBe('system')
    expect(normalizeNetworkProxy({ mode: 'manual', url: 'ftp://a' }).mode).toBe('system')
  })

  it('drops invalid mode and empty bypass', () => {
    expect(normalizeNetworkProxy({ mode: 'auto' }).mode).toBe('system')
    expect(normalizeNetworkProxy({ mode: 'direct', bypass: '   ' }).bypass).toBe(DEFAULT_PROXY_BYPASS)
  })
})

describe('normalizeNetworkConfig', () => {
  it('wraps proxy config with defaults', () => {
    expect(normalizeNetworkConfig()).toEqual({
      proxy: { mode: 'system', url: '', bypass: DEFAULT_PROXY_BYPASS }
    })
    expect(normalizeNetworkConfig({ proxy: { mode: 'direct' } }).proxy.mode).toBe('direct')
  })
})

describe('normalizeMarketSources', () => {
  it('defaults to official sources', () => {
    expect(normalizeMarketSources()).toEqual(DEFAULT_MARKET_SOURCES)
    expect(normalizeMarketSources([])).toEqual(DEFAULT_MARKET_SOURCES)
  })

  it('keeps valid custom bases and trims trailing slashes', () => {
    expect(
      normalizeMarketSources({ clawhub: ' https://mirror.example.com/ ', mcp_registry: 'http://registry.local/' })
    ).toEqual({ clawhub: 'https://mirror.example.com', mcp_registry: 'http://registry.local', update_feed: '' })
  })

  it('keeps a query string on the update feed', () => {
    const feed = 'https://api.github.com/repos/x/y/releases?per_page=30'
    expect(normalizeMarketSources({ update_feed: feed }).update_feed).toBe(feed)
  })

  it('drops invalid values', () => {
    expect(normalizeMarketSources({ clawhub: 'ftp://a', mcp_registry: 1, update_feed: 'nope' })).toEqual(
      DEFAULT_MARKET_SOURCES
    )
  })
})

describe('source resolvers', () => {
  it('falls back to official defaults when unset', () => {
    expect(getClawhubBase()).toBe(CLAWHUB_DEFAULT_BASE)
    expect(getMcpRegistryBase({})).toBe(MCP_REGISTRY_DEFAULT_BASE)
    expect(getUpdateFeedUrl({ update_feed: '' })).toBe(UPDATE_FEED_DEFAULT_URL)
  })

  it('prefers configured sources', () => {
    const sources = {
      clawhub: 'https://c.example',
      mcp_registry: 'https://m.example',
      update_feed: 'https://f.example'
    }
    expect(getClawhubBase(sources)).toBe('https://c.example')
    expect(getMcpRegistryBase(sources)).toBe('https://m.example')
    expect(getUpdateFeedUrl(sources)).toBe('https://f.example')
  })
})
