export const CLIPBOARD_HISTORY_VERSION = 1
export const MAX_CLIPBOARD_ENTRIES = 120

function isValidEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (typeof entry.id !== 'string' || !entry.id) return false
  if (typeof entry.fingerprint !== 'string' || !entry.fingerprint) return false
  if (typeof entry.createdAt !== 'number' || typeof entry.updatedAt !== 'number') return false
  if (entry.type === 'text') return typeof entry.text === 'string' && entry.text.length > 0
  if (entry.type === 'image') return typeof entry.image === 'string' && entry.image.startsWith('data:image/')
  return false
}

export function trimHistory(entries, maxEntries = MAX_CLIPBOARD_ENTRIES) {
  if (entries.length <= maxEntries) return entries

  const pinnedCount = entries.filter((entry) => entry.pinned).length
  let remaining = maxEntries - pinnedCount
  if (remaining >= entries.length - pinnedCount) return entries

  const result = []
  for (const entry of entries) {
    if (entry.pinned) {
      result.push(entry)
      continue
    }
    if (remaining > 0) {
      result.push(entry)
      remaining -= 1
    }
  }
  return result
}

export function mergeHistoryEntry(entries, entry, maxEntries = MAX_CLIPBOARD_ENTRIES) {
  const index = entries.findIndex((item) => item.fingerprint === entry.fingerprint)
  if (index === -1) return trimHistory([entry, ...entries], maxEntries)

  const existing = entries[index]
  const next = entries.filter((_item, itemIndex) => itemIndex !== index)
  next.unshift({ ...existing, updatedAt: entry.updatedAt })
  return trimHistory(next, maxEntries)
}

export function normalizeStoredHistory(raw) {
  const source = Array.isArray(raw) ? { entries: raw, paused: false } : raw || {}
  const seen = new Set()
  const entries = []

  for (const entry of Array.isArray(source.entries) ? source.entries : []) {
    if (!isValidEntry(entry)) continue
    if (seen.has(entry.fingerprint)) continue
    seen.add(entry.fingerprint)
    entries.push({
      id: entry.id,
      type: entry.type,
      ...(entry.type === 'text' ? { text: entry.text } : { image: entry.image }),
      fingerprint: entry.fingerprint,
      pinned: entry.pinned === true,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    })
  }

  return {
    entries: trimHistory(
      entries.sort((a, b) => b.updatedAt - a.updatedAt),
      MAX_CLIPBOARD_ENTRIES
    ),
    paused: source.paused === true
  }
}
