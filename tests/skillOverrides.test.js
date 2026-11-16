import { describe, it, expect } from 'vitest'
import {
  getSkillOverride,
  isValidSkillName,
  normalizeDisabledSkills,
  normalizeSkillOverrides
} from '../src/shared/skillOverrides.js'

describe('isValidSkillName', () => {
  it('accepts lowercase names with digits and hyphens', () => {
    expect(isValidSkillName('sql-helper')).toBe(true)
    expect(isValidSkillName('tool2')).toBe(true)
  })

  it('rejects invalid names', () => {
    expect(isValidSkillName('')).toBe(false)
    expect(isValidSkillName('-leading')).toBe(false)
    expect(isValidSkillName('Upper')).toBe(false)
    expect(isValidSkillName('has space')).toBe(false)
    expect(isValidSkillName(`a${'b'.repeat(64)}`)).toBe(false)
    expect(isValidSkillName(42)).toBe(false)
  })
})

describe('normalizeDisabledSkills', () => {
  it('drops invalid entries, dedupes and caps the list', () => {
    expect(normalizeDisabledSkills(['a', 'a', 'B', 'ok-1', 'ok-1'])).toEqual(['a', 'ok-1'])
    expect(normalizeDisabledSkills('a')).toEqual([])
    expect(normalizeDisabledSkills(null)).toEqual([])
    const many = Array.from({ length: 260 }, (_, index) => `skill-${index}`)
    expect(normalizeDisabledSkills(many)).toHaveLength(200)
  })
})

describe('normalizeSkillOverrides', () => {
  it('keeps trimmed descriptions and drops invalid entries', () => {
    expect(
      normalizeSkillOverrides({
        'skill-a': { description: '  新描述  ' },
        'skill-b': { description: '   ' },
        BadName: { description: 'x' },
        'skill-c': 'not-an-object'
      })
    ).toEqual({ 'skill-a': { description: '新描述' } })
  })

  it('caps description length and entry count', () => {
    const long = 'x'.repeat(600)
    expect(normalizeSkillOverrides({ 'skill-a': { description: long } })['skill-a'].description).toHaveLength(500)
    const many = {}
    for (let index = 0; index < 260; index += 1) many[`skill-${index}`] = { description: 'd' }
    expect(Object.keys(normalizeSkillOverrides(many))).toHaveLength(200)
  })

  it('returns an empty object for invalid input', () => {
    expect(normalizeSkillOverrides(null)).toEqual({})
    expect(normalizeSkillOverrides([])).toEqual({})
  })
})

describe('getSkillOverride', () => {
  it('returns the normalized override for a skill', () => {
    const overrides = normalizeSkillOverrides({ 'skill-a': { description: 'override' } })
    expect(getSkillOverride(overrides, 'skill-a')).toEqual({ description: 'override' })
    expect(getSkillOverride(overrides, 'skill-b')).toBeNull()
    expect(getSkillOverride(null, 'skill-a')).toBeNull()
  })
})
