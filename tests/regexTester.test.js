import { describe, expect, it } from 'vitest'
import { REGEX_MAX_MATCHES, REGEX_MAX_TEXT_LENGTH, runRegex } from '../src/shared/regexTester.js'

describe('regexTester', () => {
  it('rejects empty, invalid patterns and unknown flags', () => {
    expect(runRegex('', 'g', 'text')).toMatchObject({ ok: false, error: 'empty-pattern' })
    expect(runRegex('(', 'g', 'text')).toMatchObject({ ok: false, error: 'invalid-pattern' })
    expect(runRegex('a', 'gz', 'text')).toMatchObject({ ok: false, error: 'invalid-flags' })
  })

  it('returns matches with groups and named groups', () => {
    const result = runRegex('(?<word>\\w+)=(\\d+)', 'i', 'a=1 B=22')
    expect(result.ok).toBe(true)
    expect(result.flags).toContain('g')
    expect(result.flags).toContain('d')
    expect(result.matches).toHaveLength(2)
    expect(result.matches[0]).toMatchObject({ index: 0, end: 3, value: 'a=1', groups: ['a', '1'] })
    expect(result.matches[0].named.word).toEqual({ value: 'a', index: 0 })
    expect(result.matches[1]).toMatchObject({ index: 4, end: 8, value: 'B=22' })
  })

  it('merges duplicate flags', () => {
    const result = runRegex('a', 'ggii', 'aA')
    expect(result.flags).toBe('gid')
    expect(result.matches).toHaveLength(2)
  })

  it('terminates on zero-length matches', () => {
    const result = runRegex('x*', 'g', 'ab')
    expect(result.ok).toBe(true)
    expect(result.matches.map((match) => match.index)).toEqual([0, 1, 2])
    expect(result.matches.every((match) => match.value === '')).toBe(true)
  })

  it('caps the number of matches', () => {
    const result = runRegex('a', 'g', 'a'.repeat(REGEX_MAX_MATCHES + 20))
    expect(result.matches).toHaveLength(REGEX_MAX_MATCHES)
    expect(result.truncated).toBe(true)
  })

  it('limits scanned text length', () => {
    const text = `${'b'.repeat(REGEX_MAX_TEXT_LENGTH)}a`
    const result = runRegex('a', 'g', text)
    expect(result.textLength).toBe(REGEX_MAX_TEXT_LENGTH)
    expect(result.matches).toHaveLength(0)
  })
})
