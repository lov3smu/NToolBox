import http from 'node:http'
import https from 'node:https'
import { normalizeNetworkConfig, isHttpUrl } from '../../shared/network.js'

const NET_PARTITION = 'ntb-net'
const LOCAL_NO_PROXY = ['localhost', '127.0.0.1', '::1']

let networkConfig = normalizeNetworkConfig()
let proxyEnv = {}
let netSession = null
let electronNet = null
let sessionPromise = null

async function loadNetSession() {
  if (netSession) return netSession
  // vitest / 非 Electron 环境没有 session，走原生 fetch / http(s) 回退
  if (!process.versions.electron) return null
  if (!sessionPromise) {
    sessionPromise = import('electron')
      .then((electron) => {
        netSession = electron.session?.fromPartition(NET_PARTITION) || null
        electronNet = electron.net || null
        return netSession
      })
      .catch(() => null)
  }
  return sessionPromise
}

function buildNoProxy(bypass) {
  const entries = String(bypass || '')
    .split(/[,\s;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  const hasLocal = entries.some((item) => item.toLowerCase() === '<local>')
  const rest = entries.filter((item) => item.toLowerCase() !== '<local>')
  return [...(hasLocal ? LOCAL_NO_PROXY : []), ...rest].join(',')
}

function buildProxyEnv(proxy) {
  // 子进程工具（npx/uvx 等）只认环境变量，且大小写两种拼写都常见
  if (!proxy || proxy.mode === 'system') return {}
  if (proxy.mode === 'direct') {
    return {
      HTTP_PROXY: '',
      HTTPS_PROXY: '',
      ALL_PROXY: '',
      http_proxy: '',
      https_proxy: '',
      all_proxy: ''
    }
  }
  if (!proxy.url) return {}
  const noProxy = buildNoProxy(proxy.bypass)
  return {
    HTTP_PROXY: proxy.url,
    HTTPS_PROXY: proxy.url,
    ALL_PROXY: proxy.url,
    NO_PROXY: noProxy,
    http_proxy: proxy.url,
    https_proxy: proxy.url,
    all_proxy: proxy.url,
    no_proxy: noProxy
  }
}

export async function applyNetworkConfig(config) {
  networkConfig = normalizeNetworkConfig(config?.network)
  proxyEnv = buildProxyEnv(networkConfig.proxy)
  const ses = await loadNetSession()
  if (!ses) return networkConfig
  const proxy = networkConfig.proxy
  if (proxy.mode === 'manual') {
    await ses.setProxy({ mode: 'fixed_servers', proxyRules: proxy.url, proxyBypassRules: proxy.bypass })
  } else {
    await ses.setProxy({ mode: proxy.mode === 'direct' ? 'direct' : 'system' })
  }
  return networkConfig
}

export function getNetworkConfig() {
  return networkConfig
}

export function getNetworkEnv() {
  return { ...proxyEnv }
}

export async function netFetch(url, options = {}) {
  const ses = await loadNetSession()
  if (ses?.fetch) return ses.fetch(url, options)
  return fetch(url, options)
}

function buildRequestUrl(protocol, hostname, port, path) {
  const secure = protocol !== 'http:'
  const defaultPort = secure ? 443 : 80
  const portPart = port && Number(port) !== defaultPort ? `:${port}` : ''
  return `${secure ? 'https' : 'http'}://${hostname}${portPart}${path}`
}

function attachCancel(request) {
  // Electron 的 ClientRequest 正常写完也会走内部 destroy()，不能改写它；
  // 主动中断（停止生成/超时）统一走 cancel() → abort()
  if (request && typeof request.abort === 'function' && typeof request.cancel !== 'function') {
    request.cancel = () => request.abort()
  }
  return request
}

// 兼容 Node http/https 的 request(options, onResponse)；Electron 下走 Chromium 网络栈以复用代理
export function createRequest(protocol, options, onResponse) {
  if (!electronNet) {
    const mod = protocol === 'http:' ? http : https
    return attachCancel(mod.request(options, onResponse))
  }
  const request = electronNet.request({
    method: options.method || 'GET',
    url: buildRequestUrl(protocol, options.hostname, options.port, options.path),
    headers: options.headers || {},
    session: netSession || undefined,
    redirect: 'follow'
  })
  request.on('response', onResponse)
  return attachCancel(request)
}

export async function testNetwork(url, { timeoutMs = 10000 } = {}) {
  const started = Date.now()
  if (typeof url !== 'string' || !isHttpUrl(url.trim())) {
    return { ok: false, status: 0, elapsedMs: 0, error: '请输入有效的 http(s) 地址' }
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await netFetch(url.trim(), {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: '*/*' }
    })
    return { ok: response.ok, status: response.status, elapsedMs: Date.now() - started }
  } catch (error) {
    const aborted = error?.name === 'AbortError' || /ERR_ABORTED/.test(error?.message || '')
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      error: aborted ? `请求超时（${Math.round(timeoutMs / 1000)}s）` : error?.message || '网络请求失败'
    }
  } finally {
    clearTimeout(timer)
  }
}
