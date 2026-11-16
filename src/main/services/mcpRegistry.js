import { getMcpRegistryBase } from '../../shared/network.js'
import { netFetch } from './network.js'

const REQUEST_TIMEOUT = 10000
const MAX_LIST_LIMIT = 100
const DEFAULT_MAX_PAGES = 3

const CATEGORY_KEYWORDS = {
  file: ['file', 'filesystem', 'folder', 'drive', 'storage'],
  knowledge: ['memory', 'knowledge', 'note', 'obsidian', 'wiki', 'graph', 'rag'],
  web: ['web', 'fetch', 'http', 'search', 'browser', 'scrape', 'crawl', 'url'],
  dev: ['git', 'github', 'gitlab', 'code', 'repo', 'package', 'build'],
  data: ['database', 'db', 'sql', 'postgres', 'mysql', 'mongo', 'redis', 'sqlite', 'supabase']
}

function trimText(value, maxLength) {
  const text = String(value || '').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

function sanitizeVersion(value) {
  const version = String(value || '')
    .trim()
    .replace(/^v/i, '')
  return /^\d+(\.\d+){0,3}([-+][0-9A-Za-z.-]+)?$/.test(version) ? version : ''
}

function guessCategory(name, description) {
  const text = `${name} ${description}`.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword))) return category
  }
  return 'tool'
}

function toCommand(registryType, identifier) {
  if (registryType === 'npm') return { command: `npx -y ${identifier}`, runtime: 'npx · Node' }
  if (registryType === 'pypi') return { command: `uvx ${identifier}`, runtime: 'uvx · Python' }
  return null
}

function pickPackage(server) {
  const packages = Array.isArray(server.packages) ? server.packages : []
  for (const pkg of packages) {
    const type = String(pkg?.registryType || '').toLowerCase()
    const identifier = String(pkg?.identifier || '').trim()
    if (!identifier) continue
    if (type !== 'npm' && type !== 'pypi') continue
    const transport = pkg?.transport?.type
    if (transport && transport !== 'stdio') continue
    const command = toCommand(type, identifier)
    if (command) return { registryType: type, identifier, ...command }
  }
  return null
}

export function normalizeRegistryServer(item) {
  const server = item?.server
  if (!server?.name) return null

  const pkg = pickPackage(server)
  if (!pkg) return null

  const name = String(server.name)
  const title = String(server.title || '').trim()
  const description = trimText(server.description, 240)
  const category = guessCategory(name, description)
  const sourceUrl = String(server.repository?.url || server.websiteUrl || '')

  return {
    key: name,
    name: title || name.split('/').pop() || name,
    version: sanitizeVersion(server.version),
    description,
    command: pkg.command,
    runtime: pkg.runtime,
    packageName: pkg.identifier,
    packageType: pkg.registryType,
    category,
    tags: [pkg.registryType === 'npm' ? 'npm' : 'PyPI'],
    sourceUrl,
    sourceLabel: '注册表',
    source: 'mcp-registry',
    remote: true
  }
}

async function requestPage(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await netFetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'NToolBox' }
    })

    if (!response.ok) throw new Error(`MCP 注册表请求失败（HTTP ${response.status}）`)

    return await response.json()
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('连接 MCP 官方注册表超时', { cause: error })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchMcpRegistryServers({ search = '', maxPages = DEFAULT_MAX_PAGES, base } = {}) {
  const pages = Math.min(Math.max(Number(maxPages) || DEFAULT_MAX_PAGES, 1), 10)
  const root = (String(base || '').trim() || getMcpRegistryBase()).replace(/\/+$/, '')
  const servers = []
  const seen = new Set()
  let cursor = ''

  try {
    for (let page = 0; page < pages; page += 1) {
      const query = new URLSearchParams({ version: 'latest', limit: String(MAX_LIST_LIMIT) })
      if (search.trim()) query.set('search', search.trim())
      if (cursor) query.set('cursor', cursor)

      const payload = await requestPage(`${root}/servers?${query.toString()}`)
      const items = Array.isArray(payload?.servers) ? payload.servers : []

      for (const item of items) {
        const normalized = normalizeRegistryServer(item)
        if (!normalized || seen.has(normalized.key)) continue
        seen.add(normalized.key)
        servers.push(normalized)
      }

      cursor = String(payload?.metadata?.nextCursor || '')
      if (!cursor || !items.length) break
    }

    return { servers, remote: { ok: true } }
  } catch (error) {
    return { servers: [], remote: { ok: false, error: error?.message || '网络错误' } }
  }
}
