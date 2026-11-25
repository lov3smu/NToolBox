import { describe, expect, it } from 'vitest'
import {
  createStagingItemId,
  normalizeStagingItem,
  normalizeStagingItems,
  removeStagingItem,
  sortStagingItems,
  STAGING_LIMITS,
  toggleStagingPin,
  trimStagingItems,
  updateStagingItem,
  upsertStagingItem
} from '../src/shared/staging.js'

function makeItem(overrides = {}) {
  return {
    id: createStagingItemId(),
    title: '',
    text: 'hello',
    pinned: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides
  }
}

describe('staging items', () => {
  it('normalizes items and defaults the title to the first non-empty line', () => {
    const item = normalizeStagingItem({ title: '   ', text: '\r\nfirst line\r\nsecond' })
    expect(item.text).toBe('\nfirst line\nsecond')
    expect(item.title).toBe('first line')
    expect(item.pinned).toBe(false)
    expect(item.createdAt).toBe(item.updatedAt)
    expect(normalizeStagingItem({ text: '   ' })).toBe(null)
    expect(normalizeStagingItem(null)).toBe(null)
  })

  it('clamps title and text lengths', () => {
    const item = normalizeStagingItem({ title: 't'.repeat(400), text: 'x'.repeat(STAGING_LIMITS.textLength + 10) })
    expect(item.title.length).toBe(STAGING_LIMITS.titleLength)
    expect(item.text.length).toBe(STAGING_LIMITS.textLength)
  })

  it('deduplicates ids and enforces the item cap', () => {
    const raw = Array.from({ length: STAGING_LIMITS.max + 5 }, (_, index) => ({
      id: `item-${index}`,
      text: `v${index}`
    }))
    raw.push({ id: 'item-0', text: 'duplicate id' })
    const items = normalizeStagingItems(raw)
    expect(items).toHaveLength(STAGING_LIMITS.max)
    expect(new Set(items.map((item) => item.id)).size).toBe(STAGING_LIMITS.max)
    expect(normalizeStagingItems('nope')).toEqual([])
  })

  it('trims unpinned tail items when the total budget is exceeded', () => {
    const half = STAGING_LIMITS.textLength
    const items = [
      makeItem({ id: 'a', text: 'a'.repeat(half), pinned: true }),
      makeItem({ id: 'b', text: 'b'.repeat(half) }),
      makeItem({ id: 'c', text: 'c'.repeat(half) }),
      makeItem({ id: 'd', text: 'd'.repeat(half) }),
      makeItem({ id: 'e', text: 'e'.repeat(half) }),
      makeItem({ id: 'f', text: 'f'.repeat(half) }),
      makeItem({ id: 'g', text: 'g'.repeat(half) }),
      makeItem({ id: 'h', text: 'h'.repeat(half) }),
      makeItem({ id: 'i', text: 'i'.repeat(half) })
    ]
    const trimmed = trimStagingItems(items)
    const total = trimmed.reduce((sum, item) => sum + item.text.length, 0)
    expect(total).toBeLessThanOrEqual(STAGING_LIMITS.totalTextLength + half)
    expect(trimmed.some((item) => item.id === 'a')).toBe(true)
    expect(trimmed.length).toBeLessThan(items.length)
  })
})

describe('staging mutations', () => {
  it('prepends new items and merges duplicates by exact text', () => {
    const first = upsertStagingItem([], { text: 'a' })
    expect(first.created).toBe(true)
    expect(first.items).toHaveLength(1)

    const second = upsertStagingItem(first.items, { title: 'B', text: 'b' })
    expect(second.items.map((item) => item.text)).toEqual(['b', 'a'])

    const merged = upsertStagingItem(second.items, { title: 'B2', text: 'b' })
    expect(merged.created).toBe(false)
    expect(merged.items).toHaveLength(2)
    expect(merged.items[0].title).toBe('B2')
    expect(merged.items[0].updatedAt).toBeGreaterThanOrEqual(second.items[0].updatedAt)
  })

  it('rejects empty payloads and reports when full', () => {
    expect(upsertStagingItem([], { text: '   ' })).toMatchObject({ created: false, reason: 'empty' })
    const full = Array.from({ length: STAGING_LIMITS.max }, (_, index) =>
      makeItem({ id: `i-${index}`, text: `v${index}` })
    )
    expect(upsertStagingItem(full, { text: 'overflow' })).toMatchObject({ created: false, reason: 'full' })
  })

  it('updates, pins and removes items by id', () => {
    const items = [makeItem({ id: 'a', text: 'one', updatedAt: 1 }), makeItem({ id: 'b', text: 'two', updatedAt: 2 })]

    const updated = updateStagingItem(items, 'a', { text: '  \n  new title  \nbody', title: '' })
    expect(updated[0].title).toBe('new title')
    expect(updated[0].text).toBe('  \n  new title  \nbody')
    expect(updateStagingItem(items, 'a', { text: '   ' })[0].text).toBe('one')

    const pinned = toggleStagingPin(items, 'b')
    expect(pinned[1].pinned).toBe(true)
    expect(pinned[0].pinned).toBe(false)
    expect(toggleStagingPin(pinned, 'b')[1].pinned).toBe(false)

    expect(removeStagingItem(items, 'a').map((item) => item.id)).toEqual(['b'])
  })

  it('sorts pinned items first and then by recency', () => {
    const sorted = sortStagingItems([
      makeItem({ id: 'a', updatedAt: 5 }),
      makeItem({ id: 'b', updatedAt: 9, pinned: true }),
      makeItem({ id: 'c', updatedAt: 7 })
    ])
    expect(sorted.map((item) => item.id)).toEqual(['b', 'c', 'a'])
  })
})
