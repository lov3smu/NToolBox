export const PROXY_MODE_OPTIONS = Object.freeze([
  { value: 'system', label: '跟随系统', hint: '使用操作系统的代理设置' },
  { value: 'direct', label: '直连', hint: '忽略系统代理，直接连接' },
  { value: 'manual', label: '手动', hint: '指定 HTTP 或 SOCKS5 代理地址' }
])

export const PROXY_MODES = PROXY_MODE_OPTIONS.map((option) => option.value)

export const DEFAULT_PROXY_BYPASS = '<local>'

export const DEFAULT_MARKET_SOURCES = Object.freeze({
  clawhub: '',
  mcp_registry: '',
  update_feed: ''
})

export const CLAWHUB_DEFAULT_BASE = 'https://clawhub.ai'
export const MCP_REGISTRY_DEFAULT_BASE = 'https://registry.modelcontextprotocol.io/v0'
export const UPDATE_FEED_DEFAULT_URL = 'https://api.github.com/repos/lov3smu/NToolBox/releases?per_page=30'

export function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

export function isProxyUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'socks5:'
  } catch {
    return false
  }
}

export function normalizeNetworkProxy(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const proxy = { mode: 'system', url: '', bypass: DEFAULT_PROXY_BYPASS }
  if (PROXY_MODES.includes(source.mode)) proxy.mode = source.mode
  if (typeof source.url === 'string') {
    const url = source.url.trim()
    if (url && isProxyUrl(url)) proxy.url = url
  }
  if (typeof source.bypass === 'string') {
    proxy.bypass = source.bypass.trim() || DEFAULT_PROXY_BYPASS
  }
  if (proxy.mode === 'manual' && !proxy.url) proxy.mode = 'system'
  return proxy
}

export function normalizeNetworkConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return { proxy: normalizeNetworkProxy(source.proxy) }
}

export function normalizeMarketSources(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const result = { ...DEFAULT_MARKET_SOURCES }
  for (const key of ['clawhub', 'mcp_registry']) {
    const value = source[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim().replace(/\/+$/, '')
    if (!trimmed || !isHttpUrl(trimmed)) continue
    result[key] = trimmed
  }
  if (typeof source.update_feed === 'string') {
    // update_feed 允许带查询串，不做末尾斜杠裁剪
    const trimmed = source.update_feed.trim()
    if (trimmed && isHttpUrl(trimmed)) result.update_feed = trimmed
  }
  return result
}

export function getClawhubBase(marketSources) {
  return marketSources?.clawhub || CLAWHUB_DEFAULT_BASE
}

export function getMcpRegistryBase(marketSources) {
  return marketSources?.mcp_registry || MCP_REGISTRY_DEFAULT_BASE
}

export function getUpdateFeedUrl(marketSources) {
  return marketSources?.update_feed || UPDATE_FEED_DEFAULT_URL
}
