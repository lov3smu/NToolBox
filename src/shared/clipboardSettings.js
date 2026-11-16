export const CLIPBOARD_HISTORY_LIMITS = Object.freeze([50, 120, 200, 300])
export const DEFAULT_CLIPBOARD_HISTORY_LIMIT = 120

export function normalizeClipboardHistoryConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const persist = typeof source.persist === 'boolean' ? source.persist : true
  const requested = Number(source.max_entries)
  const maxEntries = CLIPBOARD_HISTORY_LIMITS.includes(requested) ? requested : DEFAULT_CLIPBOARD_HISTORY_LIMIT
  return { persist, max_entries: maxEntries }
}
