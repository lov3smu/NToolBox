import dns from 'node:dns/promises'
import net from 'node:net'
import { netFetch } from '../../../services/network.js'

const FETCH_TIMEOUT = 15000
const MAX_REDIRECTS = 4
const MAX_BYTES = 2 * 1024 * 1024
const MIN_CHARS = 500
const MAX_CHARS = 20000
const DEFAULT_CHARS = 8000
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 NToolBox'

function ipv4ToInt(address) {
  return address.split('.').reduce((value, part) => (value << 8) + (Number(part) || 0), 0) >>> 0
}

function isPrivateIpv4(address) {
  const value = ipv4ToInt(address)
  const inRange = (base, bits) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) === (ipv4ToInt(base) & mask)
  }
  return (
    inRange('0.0.0.0', 8) ||
    inRange('10.0.0.0', 8) ||
    inRange('100.64.0.0', 10) ||
    inRange('127.0.0.0', 8) ||
    inRange('169.254.0.0', 16) ||
    inRange('172.16.0.0', 12) ||
    inRange('192.0.0.0', 24) ||
    inRange('192.168.0.0', 16) ||
    inRange('198.18.0.0', 15) ||
    inRange('224.0.0.0', 4)
  )
}

function isPrivateAddress(address) {
  const value = String(address || '')
    .trim()
    .toLowerCase()
  if (net.isIPv4(value)) return isPrivateIpv4(value)
  if (!net.isIPv6(value)) return true

  const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])
  if (value === '::' || value === '::1') return true
  if (/^f[cd]/.test(value)) return true
  if (/^fe[89ab]/.test(value)) return true
  if (value.startsWith('ff')) return true
  if (value.startsWith('2001:db8')) return true
  return false
}

async function assertPublicHost(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
  if (!host) throw new Error('地址缺少主机名')

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa') ||
    host === 'metadata.google.internal'
  ) {
    throw new Error('不允许访问本地或内网地址')
  }

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error('不允许访问本地或内网地址')
    return
  }

  let records
  try {
    records = await dns.lookup(host, { all: true, verbatim: true })
  } catch {
    throw new Error(`无法解析域名：${host}`)
  }
  if (!records.length) throw new Error(`无法解析域名：${host}`)
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error('该域名解析到本地或内网地址，已拒绝访问')
  }
}

function parseTargetUrl(input) {
  let parsed
  try {
    parsed = new URL(String(input || '').trim())
  } catch {
    throw new Error('URL 格式无效，请提供完整的 http/https 地址')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('仅支持 http/https 地址')
  }
  return parsed
}

async function readBody(response, maxBytes = MAX_BYTES) {
  const contentLength = Number(response.headers.get('content-length')) || 0
  if (contentLength > maxBytes) {
    throw new Error(`页面体积超过限制（${Math.round(contentLength / 1024)} KB）`)
  }
  if (!response.body) return { buffer: Buffer.alloc(0), truncated: false }

  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  let truncated = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      chunks.push(value.subarray(0, Math.max(0, maxBytes - (total - value.byteLength))))
      truncated = true
      await reader.cancel().catch(() => {})
      break
    }
    chunks.push(value)
  }

  return { buffer: Buffer.concat(chunks), truncated }
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
}

function extractHtml(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : ''
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6]|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim()
  return { title, text: decodeEntities(text) }
}

async function fetchPage(startUrl, maxChars) {
  let current = parseTargetUrl(startUrl)
  let response
  let redirects = 0

  while (true) {
    await assertPublicHost(current.hostname)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    try {
      response = await netFetch(current.toString(), {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('请求超时，请稍后重试', { cause: error })
      }
      throw new Error(`请求失败：${error.message}`, { cause: error })
    } finally {
      clearTimeout(timer)
    }

    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects >= MAX_REDIRECTS) throw new Error('重定向次数过多')
      redirects += 1
      current = parseTargetUrl(new URL(location, current).toString())
      continue
    }
    break
  }

  const finalUrl = current.toString()
  if (!response.ok) {
    throw new Error(`页面返回 HTTP ${response.status}`)
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase()
  if (contentType && !/text\/|json|xml|javascript|ecmascript/.test(contentType)) {
    throw new Error(`不支持的内容类型：${contentType.split(';')[0]}`)
  }

  const { buffer, truncated } = await readBody(response)
  const raw = buffer.toString('utf8')
  const isHtml = contentType.includes('html') || /^\s*<!doctype html/i.test(raw) || /<html[\s>]/i.test(raw)
  const extracted = isHtml ? extractHtml(raw) : { title: '', text: raw.replace(/\r\n/g, '\n').trim() }
  const body = extracted.text.length > maxChars ? `${extracted.text.slice(0, maxChars)}\n…（已截断）` : extracted.text

  return {
    url: parseTargetUrl(startUrl).toString(),
    finalUrl,
    title: extracted.title,
    status: response.status,
    contentType: contentType.split(';')[0] || 'unknown',
    bytes: buffer.byteLength,
    truncated: truncated || extracted.text.length > maxChars,
    content: body
  }
}

export default async function handler(params, context) {
  const maxChars = Math.min(MAX_CHARS, Math.max(MIN_CHARS, Number(params.max_chars) || DEFAULT_CHARS))
  const log = context?.log

  try {
    const page = await fetchPage(params.url, maxChars)
    log?.debug?.(`web-fetch 已读取：${page.finalUrl}`)

    const header = [
      page.title ? `标题：${page.title}` : '',
      `地址：${page.finalUrl}`,
      `状态：HTTP ${page.status} · ${page.contentType}`
    ]
      .filter(Boolean)
      .join('\n')

    return {
      success: true,
      content: `${header}\n\n${page.content || '（页面没有可读取的文本内容）'}`,
      metadata: {
        action: 'web-fetch',
        url: page.url,
        finalUrl: page.finalUrl,
        title: page.title,
        status: page.status,
        contentType: page.contentType,
        bytes: page.bytes,
        truncated: page.truncated
      }
    }
  } catch (error) {
    return { success: false, error: error.message, metadata: { action: 'web-fetch', url: params.url || '' } }
  }
}
