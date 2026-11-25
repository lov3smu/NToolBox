export const CLIPBOARD_SNIPPET_LIMITS = Object.freeze({
  max: 50,
  nameLength: 60,
  textLength: 20000
})

export function createClipboardSnippetId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `snip-${Date.now().toString(36)}-${random}`
}

function normalizeSnippetText(value) {
  if (typeof value !== 'string') return ''
  return value.slice(0, CLIPBOARD_SNIPPET_LIMITS.textLength).replace(/\r\n/g, '\n')
}

export function normalizeClipboardSnippet(raw) {
  if (!raw || typeof raw !== 'object') return null
  const text = normalizeSnippetText(raw.text)
  if (!text.trim()) return null
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, CLIPBOARD_SNIPPET_LIMITS.nameLength) : ''
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createClipboardSnippetId(),
    name: name || text.trim().split('\n')[0].slice(0, CLIPBOARD_SNIPPET_LIMITS.nameLength),
    text,
    updatedAt: Number.isFinite(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : Date.now()
  }
}

export function normalizeClipboardSnippets(raw) {
  if (!Array.isArray(raw)) return []
  const snippets = []
  for (const item of raw) {
    if (snippets.length >= CLIPBOARD_SNIPPET_LIMITS.max) break
    const snippet = normalizeClipboardSnippet(item)
    if (snippet) snippets.push(snippet)
  }
  return snippets
}

export function sortClipboardSnippets(snippets) {
  if (!Array.isArray(snippets)) return []
  return snippets.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}
