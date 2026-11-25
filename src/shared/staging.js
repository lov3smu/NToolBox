export const STAGING_LIMITS = Object.freeze({
  max: 30,
  titleLength: 120,
  textLength: 50000,
  totalTextLength: 400000
})

export const STAGING_STORAGE_KEY = 'ntb_staging_items'

export function createStagingItemId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `stage-${Date.now().toString(36)}-${random}`
}

function normalizeText(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r\n/g, '\n').slice(0, STAGING_LIMITS.textLength)
}

function firstLineOf(text) {
  const line = text
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item)
  return (line || '').slice(0, STAGING_LIMITS.titleLength)
}

export function normalizeStagingItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const text = normalizeText(raw.text)
  if (!text.trim()) return null
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, STAGING_LIMITS.titleLength) : ''
  const now = Date.now()
  const createdAt = Number.isFinite(raw.createdAt) && raw.createdAt > 0 ? raw.createdAt : now
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createStagingItemId(),
    title: title || firstLineOf(text),
    text,
    pinned: raw.pinned === true,
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : createdAt
  }
}

export function trimStagingItems(items) {
  const list = Array.isArray(items) ? items.slice(0, STAGING_LIMITS.max) : []
  let total = list.reduce((sum, item) => sum + item.text.length, 0)
  for (let index = list.length - 1; index >= 0 && total > STAGING_LIMITS.totalTextLength; index -= 1) {
    if (list[index].pinned) continue
    total -= list[index].text.length
    list.splice(index, 1)
  }
  return list
}

export function normalizeStagingItems(raw) {
  if (!Array.isArray(raw)) return []
  const items = []
  const seen = new Set()
  for (const entry of raw) {
    if (items.length >= STAGING_LIMITS.max) break
    const item = normalizeStagingItem(entry)
    if (!item || seen.has(item.id)) continue
    seen.add(item.id)
    items.push(item)
  }
  return trimStagingItems(items)
}

export function sortStagingItems(items) {
  if (!Array.isArray(items)) return []
  return items.slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt || 0) - (a.updatedAt || 0))
}

export function upsertStagingItem(items, payload) {
  const list = Array.isArray(items) ? items : []
  const text = normalizeText(payload?.text)
  if (!text.trim()) return { items: list, item: null, created: false, reason: 'empty' }
  const title = typeof payload?.title === 'string' ? payload.title.trim().slice(0, STAGING_LIMITS.titleLength) : ''
  const now = Date.now()
  const existing = list.find((item) => item.text === text)
  if (existing) {
    const item = { ...existing, title: title || existing.title, updatedAt: now }
    return { items: [item, ...list.filter((entry) => entry.id !== existing.id)], item, created: false }
  }
  if (list.length >= STAGING_LIMITS.max) return { items: list, item: null, created: false, reason: 'full' }
  const item = normalizeStagingItem({ id: createStagingItemId(), title, text, createdAt: now, updatedAt: now })
  return { items: trimStagingItems([item, ...list]), item, created: true }
}

export function updateStagingItem(items, id, patch) {
  if (!Array.isArray(items)) return []
  return items.map((item) => {
    if (item.id !== id) return item
    const text = typeof patch?.text === 'string' ? normalizeText(patch.text) : item.text
    if (!text.trim()) return item
    const title = typeof patch?.title === 'string' ? patch.title.trim().slice(0, STAGING_LIMITS.titleLength) : ''
    return { ...item, title: title || firstLineOf(text), text, updatedAt: Date.now() }
  })
}

export function toggleStagingPin(items, id) {
  if (!Array.isArray(items)) return []
  return items.map((item) => (item.id === id ? { ...item, pinned: !item.pinned } : item))
}

export function removeStagingItem(items, id) {
  if (!Array.isArray(items)) return []
  return items.filter((item) => item.id !== id)
}
