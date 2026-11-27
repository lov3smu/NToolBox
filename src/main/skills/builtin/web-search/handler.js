import { netFetch } from '../../../services/network.js'

const REQUEST_TIMEOUT = 15000
const MAX_BYTES = 2 * 1024 * 1024
const MAX_RESULTS = 10
const MAX_QUERY_LENGTH = 300
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 NToolBox'

const ENGINES = {
  bing: {
    label: 'Bing',
    buildUrl: (query) => `https://cn.bing.com/search?q=${encodeURIComponent(query)}&setlang=zh-CN&count=${MAX_RESULTS}`
  },
  duckduckgo: {
    label: 'DuckDuckGo',
    buildUrl: (query) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  }
}

function decodeEntities(text) {
  return String(text || '')
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

function stripTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeBingRedirect(url) {
  try {
    const parsed = new URL(url, 'https://cn.bing.com')
    if (!parsed.hostname.endsWith('bing.com') || !parsed.pathname.startsWith('/ck/a')) return parsed.toString()
    const encoded = parsed.searchParams.get('u') || ''
    if (!encoded.startsWith('a1')) return parsed.toString()
    const base64 = encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return Buffer.from(padded, 'base64').toString('utf8')
  } catch {
    return url
  }
}

function normalizeResultUrl(raw) {
  const decoded = decodeEntities(raw)
  try {
    const parsed = new URL(decoded, 'https://duckduckgo.com')
    if (parsed.hostname.endsWith('duckduckgo.com') && parsed.pathname === '/l/') {
      const target = parsed.searchParams.get('uddg')
      if (target) return target
    }
    return decodeBingRedirect(parsed.toString())
  } catch {
    return decoded
  }
}

function parseBing(html) {
  const results = []
  for (const block of html.split(/<li class="b_algo"/).slice(1)) {
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!titleMatch) continue
    const snippetMatch =
      block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i) ||
      block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    results.push({
      title: stripTags(titleMatch[2]),
      url: normalizeResultUrl(titleMatch[1]),
      snippet: stripTags(snippetMatch?.[1] || '')
    })
  }
  return results
}

function parseDuckDuckGo(html) {
  const results = []
  for (const block of html.split(/class="result results_links/).slice(1)) {
    const titleMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!titleMatch) continue
    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
    results.push({
      title: stripTags(titleMatch[2]),
      url: normalizeResultUrl(titleMatch[1]),
      snippet: stripTags(snippetMatch?.[1] || '')
    })
  }
  return results
}

async function readBody(response) {
  const contentLength = Number(response.headers.get('content-length')) || 0
  if (contentLength > MAX_BYTES) throw new Error('搜索结果页面体积过大')
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) {
      chunks.push(value.subarray(0, Math.max(0, MAX_BYTES - (total - value.byteLength))))
      await reader.cancel().catch(() => {})
      break
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8')
}

async function searchWith(engineKey, query) {
  const engine = ENGINES[engineKey]
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await netFetch(engine.buildUrl(query), {
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    })
    if (!response.ok) throw new Error(`${engine.label} 返回 HTTP ${response.status}`)
    const html = await readBody(response)
    const parsed = engineKey === 'bing' ? parseBing(html) : parseDuckDuckGo(html)
    return { engine: engine.label, results: parsed }
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(`${engine.label} 请求超时`, { cause: error })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function dedupeResults(results) {
  const seen = new Set()
  const output = []
  for (const item of results) {
    if (!item.title || !/^https?:\/\//i.test(item.url)) continue
    const key = item.url.replace(/\/$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(item)
  }
  return output
}

export default async function handler(params, context) {
  const query = String(params?.query || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
  if (!query) return { success: false, error: '请提供搜索关键词' }

  const count = Math.min(MAX_RESULTS, Math.max(1, Number(params.count) || 5))
  const engineKey = ENGINES[params.engine] ? params.engine : 'bing'
  const fallbackKey = engineKey === 'bing' ? 'duckduckgo' : 'bing'

  try {
    let outcome
    let lastError
    for (const key of [engineKey, fallbackKey]) {
      try {
        outcome = await searchWith(key, query)
        if (outcome.results.length > 0) break
      } catch (error) {
        lastError = error
      }
    }
    if (!outcome || outcome.results.length === 0) {
      return {
        success: false,
        error: lastError ? `搜索失败：${lastError.message}` : '没有找到相关结果',
        metadata: { action: 'web-search', query, results: [] }
      }
    }

    const results = dedupeResults(outcome.results).slice(0, count)
    if (results.length === 0) {
      return { success: false, error: '没有找到可用结果', metadata: { action: 'web-search', query, results: [] } }
    }

    context?.log?.debug?.(`web-search 已检索：${query}（${outcome.engine}）`)
    const lines = [`搜索：${query}（${outcome.engine}，${results.length} 条）`]
    results.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`)
      lines.push(`   链接：${item.url}`)
      if (item.snippet) lines.push(`   摘要：${item.snippet}`)
    })
    lines.push('如需正文，请对具体链接调用 web-fetch。')

    return {
      success: true,
      content: lines.join('\n'),
      metadata: {
        action: 'web-search',
        query,
        engine: outcome.engine,
        count: results.length,
        results
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `搜索失败：${error.message}`,
      metadata: { action: 'web-search', query, results: [] }
    }
  }
}
