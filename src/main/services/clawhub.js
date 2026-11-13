const CLAWHUB_API_BASE = 'https://clawhub.ai/api/v1'
const CLAWHUB_WEB_BASE = 'https://clawhub.ai'
const REQUEST_TIMEOUT = 10000
const MAX_LIST_LIMIT = 100
const MAX_PROMPT_LENGTH = 200 * 1024

const CATEGORY_KEYWORDS = {
  code: [
    'code',
    'coding',
    'developer',
    'programming',
    'git',
    'github',
    'gitlab',
    'docker',
    'kubernetes',
    'api',
    'deploy',
    'deployment',
    'react',
    'vue',
    'node',
    'python',
    'typescript',
    'javascript'
  ],
  database: ['database', 'sql', 'mysql', 'postgres', 'postgresql', 'sqlite', 'mongodb', 'redis'],
  document: ['document', 'documents', 'pdf', 'docx', 'word', 'excel', 'spreadsheet', 'markdown', 'ocr', 'ebook'],
  security: ['security', 'auth', 'authentication', 'cve', 'vulnerability', 'pentest', 'encryption']
}

export function normalizeSkillName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export function parseSkillFrontmatter(text) {
  const content = String(text || '').replace(/\r\n/g, '\n')
  const match = content.match(/^---\n([\s\S]*?)\n---\s*\n?/)

  if (!match) return { meta: {}, body: content.trim() }

  const meta = {}
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (entry) meta[entry[1]] = entry[2].replace(/^['"]|['"]$/g, '').trim()
  }

  return { meta, body: content.slice(match[0].length).trim() }
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

function guessCategory(topics, slug, summary) {
  const tokens = new Set()
  for (const topic of topics) {
    for (const token of String(topic)
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)) {
      if (token) tokens.add(token)
    }
  }
  for (const token of String(slug || '')
    .toLowerCase()
    .split(/[^a-z0-9+#]+/)) {
    if (token) tokens.add(token)
  }

  const text = String(summary || '').toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => tokens.has(keyword) || text.includes(` ${keyword} `))) return category
  }

  return 'general'
}

async function requestJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'NToolBox' }
    })

    if (!response.ok) throw new Error(`ClawHub 请求失败（HTTP ${response.status}）`)

    return await response.json()
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('连接 ClawHub 超时', { cause: error })
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function normalizeListSkill(item, options = {}) {
  if (!item || !item.slug) return null

  const name = normalizeSkillName(item.slug)
  if (!name) return null

  const topics = Array.isArray(item.topics) ? item.topics.map(String).filter(Boolean) : []
  const slug = String(item.slug)
  const ownerHandle = String(item.ownerHandle || options.ownerHandle || '')
  const summary = trimText(item.summary, 600)
  const sourcePath = options.canonicalUrl || (ownerHandle ? `/${ownerHandle}/skills/${slug}` : '')

  return {
    name,
    slug,
    ownerHandle,
    displayName: String(item.displayName || slug),
    version: sanitizeVersion(options.version ?? item.latestVersion?.version),
    description: summary,
    author: ownerHandle || 'ClawHub',
    category: guessCategory(topics, slug, summary),
    tags: topics.slice(0, 6),
    icon: null,
    featured: Boolean(options.featured),
    downloads: Number(options.downloads ?? item.stats?.downloads) || 0,
    changelog: trimText(item.latestVersion?.changelog, 400),
    license: item.latestVersion?.license || '',
    source: 'clawhub',
    sourceUrl: sourcePath ? `${CLAWHUB_WEB_BASE}${sourcePath}` : '',
    remote: true
  }
}

export async function fetchClawHubMarket({ limit = 60 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 60, 1), MAX_LIST_LIMIT)
  const payload = await requestJson(`${CLAWHUB_API_BASE}/skills?limit=${safeLimit}`)
  const items = Array.isArray(payload?.items) ? payload.items : []
  return items.map((item) => normalizeListSkill(item)).filter(Boolean)
}

export async function searchClawHubSkills(query, { limit = 10 } = {}) {
  const keyword = String(query || '').trim()
  if (!keyword) return []

  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50)
  const payload = await requestJson(`${CLAWHUB_API_BASE}/search?q=${encodeURIComponent(keyword)}&limit=${safeLimit}`)
  const results = Array.isArray(payload?.results) ? payload.results : []

  return results
    .map((result) => {
      const nativeSkill = result?.native?.skill || {}
      return normalizeListSkill(
        {
          slug: result?.slug,
          displayName: result?.displayName,
          summary: result?.summary,
          topics: nativeSkill.topics,
          stats: nativeSkill.stats || { downloads: result?.downloads }
        },
        {
          ownerHandle: result?.ownerHandle,
          downloads: result?.downloads,
          featured: result?.featured,
          canonicalUrl: result?.canonicalUrl
        }
      )
    })
    .filter(Boolean)
}

export async function fetchClawHubSkillDetail({ ownerHandle, slug }) {
  if (!ownerHandle || !slug) throw new Error('在线扩展缺少来源信息')

  const query = new URLSearchParams({ owner: ownerHandle })
  const payload = await requestJson(`${CLAWHUB_API_BASE}/skills/${encodeURIComponent(slug)}?${query.toString()}`)
  const skill = payload?.skill
  if (!skill) throw new Error('ClawHub 未返回技能详情')

  const description = String(skill.description || '')
  const parsed = parseSkillFrontmatter(description)
  const topics = Array.isArray(skill.topics) ? skill.topics.map(String).filter(Boolean) : []
  const summary = trimText(skill.summary || parsed.meta.description, 600)

  return {
    slug: String(skill.slug || slug),
    ownerHandle,
    displayName: String(skill.displayName || parsed.meta.name || slug),
    summary,
    body: trimText(parsed.body, MAX_PROMPT_LENGTH),
    meta: parsed.meta,
    topics,
    downloads: Number(skill.stats?.downloads) || 0,
    version: sanitizeVersion(skill.tags?.latest),
    category: guessCategory(topics, skill.slug || slug, summary),
    sourceUrl: `${CLAWHUB_WEB_BASE}/${ownerHandle}/skills/${slug}`
  }
}
