import { describe, expect, it } from 'vitest'
import { diffLines, splitDiffLines } from '../src/shared/textDiff.js'

describe('shared textDiff', () => {
  it('splits lines and drops the trailing newline sentinel', () => {
    expect(splitDiffLines('')).toEqual([])
    expect(splitDiffLines('a\nb\n')).toEqual(['a', 'b'])
    expect(splitDiffLines('a\n\n')).toEqual(['a', ''])
    expect(splitDiffLines('a\r\nb')).toEqual(['a', 'b'])
  })

  it('marks additions, removals and equal lines', () => {
    const result = diffLines('a\nb\nc\n', 'a\nc\nd\n')
    expect(result.truncated).toBe(false)
    expect(result.rows.map((row) => row.type)).toEqual(['equal', 'remove', 'equal', 'add'])
    expect(result.rows[0]).toMatchObject({ text: 'a', oldNo: 1, newNo: 1 })
    expect(result.rows[1]).toMatchObject({ text: 'b', oldNo: 2, newNo: null })
    expect(result.rows[3]).toMatchObject({ text: 'd', oldNo: null, newNo: 3 })
    expect(result.stats).toEqual({ added: 1, removed: 1, unchanged: 2 })
  })

  it('supports ignore case and whitespace', () => {
    const caseInsensitive = diffLines('Hello', 'hello', { ignoreCase: true })
    expect(caseInsensitive.stats).toEqual({ added: 0, removed: 0, unchanged: 1 })

    const spaceInsensitive = diffLines('a  b', 'a b', { ignoreWhitespace: true })
    expect(spaceInsensitive.stats).toEqual({ added: 0, removed: 0, unchanged: 1 })
  })

  it('handles empty sides', () => {
    expect(diffLines('', '').rows).toEqual([])
    const added = diffLines('', 'a\nb')
    expect(added.rows.map((row) => row.type)).toEqual(['add', 'add'])
    expect(added.stats).toEqual({ added: 2, removed: 0, unchanged: 0 })
    const removed = diffLines('a', '')
    expect(removed.stats).toEqual({ added: 0, removed: 1, unchanged: 0 })
  })

  it('falls back to a plain replace when inputs exceed the diff budget', () => {
    const oldText = Array.from({ length: 2001 }, (_value, index) => `old-${index}`).join('\n')
    const newText = Array.from({ length: 2001 }, (_value, index) => `new-${index}`).join('\n')
    const result = diffLines(oldText, newText)
    expect(result.truncated).toBe(true)
    expect(result.stats).toEqual({ added: 2001, removed: 2001, unchanged: 0 })
  })
})
