import { describe, it, expect } from 'vitest'
import {
  CLIPBOARD_HISTORY_VERSION,
  MAX_CLIPBOARD_ENTRIES,
  mergeHistoryEntry,
  normalizeStoredHistory,
  trimHistory
} from '../src/main/services/clipboardHistory.js'

function makeEntry(id, overrides = {}) {
  return {
    id,
    type: 'text',
    text: `内容 ${id}`,
    fingerprint: `fp-${id}`,
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides
  }
}

describe('trimHistory', () => {
  it('keeps the newest unpinned entries and never drops pinned ones', () => {
    const entries = [makeEntry('a', { pinned: true }), makeEntry('b'), makeEntry('c'), makeEntry('d'), makeEntry('e')]

    expect(trimHistory(entries, 3).map((entry) => entry.id)).toEqual(['a', 'b', 'c'])
  })

  it('retains all pinned entries even when they exceed the limit', () => {
    const entries = [makeEntry('a', { pinned: true }), makeEntry('b', { pinned: true }), makeEntry('c')]
    expect(trimHistory(entries, 1).map((entry) => entry.id)).toEqual(['a', 'b'])
  })

  it('returns the same list when it fits', () => {
    const entries = [makeEntry('a'), makeEntry('b')]
    expect(trimHistory(entries, MAX_CLIPBOARD_ENTRIES)).toBe(entries)
  })
})

describe('mergeHistoryEntry', () => {
  it('moves an existing fingerprint to the front and updates its timestamp', () => {
    const entries = [makeEntry('a'), makeEntry('b')]
    const merged = mergeHistoryEntry(entries, makeEntry('b', { updatedAt: 2000 }), 10)

    expect(merged.map((entry) => entry.id)).toEqual(['b', 'a'])
    expect(merged[0].createdAt).toBe(1000)
    expect(merged[0].updatedAt).toBe(2000)
  })

  it('adds new entries at the front without duplicating fingerprints', () => {
    const merged = mergeHistoryEntry([makeEntry('a')], makeEntry('b'), 2)
    expect(merged.map((entry) => entry.id)).toEqual(['b', 'a'])

    const again = mergeHistoryEntry(merged, makeEntry('b', { updatedAt: 3000 }), 2)
    expect(again.map((entry) => entry.id)).toEqual(['b', 'a'])
    expect(again).toHaveLength(2)
  })
})

describe('normalizeStoredHistory', () => {
  it('drops malformed entries and duplicate fingerprints', () => {
    const stored = normalizeStoredHistory({
      version: CLIPBOARD_HISTORY_VERSION,
      paused: true,
      entries: [
        makeEntry('a', { updatedAt: 1000 }),
        makeEntry('a-duplicate', { fingerprint: 'fp-a', updatedAt: 2000 }),
        { id: 'broken' },
        makeEntry('image', { type: 'image', text: undefined, image: 'data:image/png;base64,AAAA' })
      ]
    })

    expect(stored.paused).toBe(true)
    expect(stored.entries.map((entry) => entry.id)).toEqual(['a', 'image'])
    expect(stored.entries[1].image).toBe('data:image/png;base64,AAAA')
    expect(stored.entries[1].text).toBeUndefined()
  })

  it('sorts by updatedAt and supports the legacy array format', () => {
    const stored = normalizeStoredHistory([
      makeEntry('old', { updatedAt: 1000 }),
      makeEntry('new', { updatedAt: 2000 })
    ])
    expect(stored.paused).toBe(false)
    expect(stored.entries.map((entry) => entry.id)).toEqual(['new', 'old'])
  })

  it('returns an empty state for invalid input', () => {
    expect(normalizeStoredHistory(null)).toEqual({ entries: [], paused: false })
    expect(normalizeStoredHistory({ entries: 'nope' })).toEqual({ entries: [], paused: false })
  })
})
