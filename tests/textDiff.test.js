import { describe, it, expect } from 'vitest'
import { computeLineDiff } from '../src/main/utils/textDiff.js'

function types(result) {
  return result.lines.map((line) => line.type)
}

describe('computeLineDiff', () => {
  it('detects added and removed lines', () => {
    const result = computeLineDiff('a\nb\nc', 'a\nB\nc\nd')
    expect(result.added).toBe(2)
    expect(result.removed).toBe(1)
    expect(result.truncated).toBe(false)
    expect(types(result)).toContain('del')
    expect(types(result)).toContain('add')
  })

  it('returns no changes for identical text', () => {
    const result = computeLineDiff('one\ntwo', 'one\ntwo')
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
    expect(result.lines.every((line) => line.type === 'equal')).toBe(true)
  })

  it('handles empty and undefined input', () => {
    expect(computeLineDiff('', 'x').added).toBe(1)
    expect(computeLineDiff(undefined, '').removed).toBe(0)
  })

  it('normalizes windows line endings', () => {
    const result = computeLineDiff('a\r\nb', 'a\nb')
    expect(result.added).toBe(0)
    expect(result.removed).toBe(0)
  })

  it('caps preview lines and marks truncation', () => {
    const oldText = Array.from({ length: 30 }, (_, index) => `old-${index}`).join('\n')
    const newText = Array.from({ length: 30 }, (_, index) => `new-${index}`).join('\n')
    const result = computeLineDiff(oldText, newText, { maxLines: 10 })
    expect(result.lines).toHaveLength(10)
    expect(result.truncated).toBe(true)
    expect(result.added).toBe(30)
    expect(result.removed).toBe(30)
  })

  it('falls back to approximate stats for very large inputs', () => {
    const oldText = Array.from({ length: 2500 }, (_, index) => `a-${index}`).join('\n')
    const newText = Array.from({ length: 2600 }, (_, index) => `b-${index}`).join('\n')
    const result = computeLineDiff(oldText, newText)
    expect(result.approximate).toBe(true)
    expect(result.lines).toHaveLength(0)
    expect(result.truncated).toBe(true)
  })
})
