export const ACTIVITY_KINDS = Object.freeze(['query', 'upload', 'backup', 'ai_run', 'file_change'])

export const ACTIVITY_RANGES = Object.freeze([
  { id: '24h', label: '24 小时', hours: 24 },
  { id: '7d', label: '7 天', hours: 24 * 7 },
  { id: '30d', label: '30 天', hours: 24 * 30 },
  { id: 'all', label: '全部', hours: 0 }
])

export const ACTIVITY_DEFAULT_RANGE = '7d'
export const ACTIVITY_DEFAULT_LIMIT = 50
export const ACTIVITY_MAX_LIMIT = 200

export function normalizeActivityKinds(input) {
  if (!Array.isArray(input)) return [...ACTIVITY_KINDS]
  const picked = new Set(input.filter((kind) => ACTIVITY_KINDS.includes(kind)))
  return picked.size > 0 ? ACTIVITY_KINDS.filter((kind) => picked.has(kind)) : [...ACTIVITY_KINDS]
}

export function normalizeActivityRange(range) {
  const found = ACTIVITY_RANGES.find((item) => item.id === range)
  return found ? found.id : ACTIVITY_DEFAULT_RANGE
}

export function activitySince(range, now = Date.now()) {
  const id = normalizeActivityRange(range)
  const entry = ACTIVITY_RANGES.find((item) => item.id === id)
  if (!entry || !entry.hours) return 0
  return now - entry.hours * 3600 * 1000
}

export function normalizeActivityLimit(limit) {
  const size = Math.floor(Number(limit))
  if (!Number.isFinite(size) || size <= 0) return ACTIVITY_DEFAULT_LIMIT
  return Math.min(size, ACTIVITY_MAX_LIMIT)
}

export function sortActivityItems(items) {
  return [...items].sort((a, b) => {
    const diff = (Number(b?.ts) || 0) - (Number(a?.ts) || 0)
    if (diff !== 0) return diff
    return String(b?.id || '').localeCompare(String(a?.id || ''))
  })
}
