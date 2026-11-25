export const MARKDOWN_DOCUMENT_LIMITS = Object.freeze({
  recentLimit: 12,
  maxBytes: 10 * 1024 * 1024,
  maxOutlineEntries: 300
})

function basenameOf(filePath) {
  const parts = String(filePath || '').split(/[\\/]/)
  return parts[parts.length - 1] || ''
}

export function normalizeRecentDocuments(input) {
  const list = Array.isArray(input) ? input : []
  const seen = new Set()
  const result = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const path = typeof item.path === 'string' ? item.path.trim() : ''
    if (!path || seen.has(path)) continue
    seen.add(path)
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : basenameOf(path)
    result.push({
      path,
      name,
      openedAt: Number.isFinite(item.openedAt) ? item.openedAt : 0
    })
    if (result.length >= MARKDOWN_DOCUMENT_LIMITS.recentLimit) break
  }
  return result
}

export function splitFrontmatter(source) {
  const text = String(source ?? '')
  const open = text.match(/^\uFEFF?---[ \t]*\r?\n/)
  if (!open) return { frontmatter: [], body: text }

  const rest = text.slice(open[0].length)
  const close = rest.match(/^(?:---|\.\.\.)[ \t]*\r?$/m)
  if (!close) return { frontmatter: [], body: text }

  const block = rest.slice(0, close.index)
  const bodyStart = rest.indexOf('\n', close.index)
  const body = bodyStart >= 0 ? rest.slice(bodyStart + 1) : ''
  const frontmatter = []
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_.-]+)\s*:\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (value.length >= 2) {
      const first = value[0]
      const last = value[value.length - 1]
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) value = value.slice(1, -1)
    }
    frontmatter.push({ key: match[1], value })
  }
  return { frontmatter, body }
}

function stripInlineMarkup(text) {
  return String(text || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(^|[^\w*])\*([^*]+)\*/g, (_, prefix, content) => `${prefix}${content}`)
    .replace(/(^|[^\w_])_([^_]+)_/g, (_, prefix, content) => `${prefix}${content}`)
    .trim()
}

function frontmatterLineOffset(source, body) {
  if (!body || body.length >= source.length) return 0
  const prefix = source.slice(0, source.length - body.length)
  return prefix.split('\n').length - 1
}

export function extractMarkdownOutline(source) {
  const text = String(source ?? '')
  const { body } = splitFrontmatter(text)
  const offset = frontmatterLineOffset(text, body)
  const lines = body.split(/\r?\n/)
  const outline = []
  let fence = ''

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fence) {
        fence = marker
      } else if (marker[0] === fence[0] && marker.length >= fence.length) {
        fence = ''
      }
      continue
    }
    if (fence) continue

    const heading = line.match(/^ {0,3}(#{1,6})\s+(.*)$/)
    if (!heading) continue
    const textContent = stripInlineMarkup(heading[2].replace(/\s+#+\s*$/, '').trim())
    if (!textContent) continue
    outline.push({ level: heading[1].length, text: textContent, line: offset + index + 1 })
    if (outline.length >= MARKDOWN_DOCUMENT_LIMITS.maxOutlineEntries) break
  }
  return outline
}
