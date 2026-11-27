import { describe, it, expect } from 'vitest'
import {
  ACTIVITY_DEFAULT_LIMIT,
  ACTIVITY_KINDS,
  ACTIVITY_MAX_LIMIT,
  activitySince,
  normalizeActivityKinds,
  normalizeActivityLimit,
  normalizeActivityRange,
  sortActivityItems
} from '../src/shared/activity.js'

describe('activity timeline contract', () => {
  it('normalizes kinds with fallback to all', () => {
    expect(normalizeActivityKinds(['query', 'upload'])).toEqual(['query', 'upload'])
    expect(normalizeActivityKinds(['unknown'])).toEqual([...ACTIVITY_KINDS])
    expect(normalizeActivityKinds('query')).toEqual([...ACTIVITY_KINDS])
    expect(normalizeActivityKinds([])).toEqual([...ACTIVITY_KINDS])
  })

  it('resolves ranges to a cutoff timestamp', () => {
    const now = new Date('2026-11-25T12:00:00Z').getTime()
    expect(normalizeActivityRange('7d')).toBe('7d')
    expect(normalizeActivityRange('bogus')).toBe('7d')
    expect(activitySince('24h', now)).toBe(now - 24 * 3600 * 1000)
    expect(activitySince('all', now)).toBe(0)
  })

  it('clamps limits', () => {
    expect(normalizeActivityLimit(0)).toBe(ACTIVITY_DEFAULT_LIMIT)
    expect(normalizeActivityLimit('30')).toBe(30)
    expect(normalizeActivityLimit(9999)).toBe(ACTIVITY_MAX_LIMIT)
  })

  it('sorts newest first and breaks ties by id', () => {
    const items = [
      { id: 'a', ts: 100 },
      { id: 'c', ts: 300 },
      { id: 'b', ts: 300 }
    ]
    expect(sortActivityItems(items).map((item) => item.id)).toEqual(['c', 'b', 'a'])
  })
})
