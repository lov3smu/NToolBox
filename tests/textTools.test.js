import { describe, expect, it } from 'vitest'
import { TEXT_OPERATIONS, textStats, transformText } from '../src/shared/textTools.js'

describe('textTools', () => {
  it('exposes unique operation ids', () => {
    const ids = TEXT_OPERATIONS.map((operation) => operation.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('converts case', () => {
    expect(transformText('upper', 'aBc')).toBe('ABC')
    expect(transformText('lower', 'aBc')).toBe('abc')
    expect(transformText('title', 'hello world-foo_bar/BAZ')).toBe('Hello World-Foo_Bar/Baz')
    expect(transformText('sentence', 'hello WORLD. next LINE!\nthird')).toBe('Hello world. Next line!\nThird')
  })

  it('transforms lines', () => {
    expect(transformText('trim-lines', ' a \n b ')).toBe('a\nb')
    expect(transformText('remove-empty-lines', 'a\n\n  \nb')).toBe('a\nb')
    expect(transformText('dedupe-lines', 'b\na\nb')).toBe('b\na')
    expect(transformText('sort-lines', 'c\na\nb')).toBe('a\nb\nc')
    expect(transformText('sort-lines-desc', 'c\na\nb')).toBe('c\nb\na')
    expect(transformText('reverse-lines', 'a\nb\nc')).toBe('c\nb\na')
    expect(transformText('number-lines', 'a\nb')).toBe('1. a\n2. b')
  })

  it('handles CRLF input for line operations', () => {
    expect(transformText('reverse-lines', 'a\r\nb')).toBe('b\na')
  })

  it('handles whitespace operations', () => {
    expect(transformText('collapse-spaces', 'a   b\t\tc \n d')).toBe('a b c\nd')
    expect(transformText('remove-whitespace', ' a b\nc ')).toBe('abc')
  })

  it('returns input unchanged for unknown operations', () => {
    expect(transformText('missing', 'keep')).toBe('keep')
  })

  it('counts stats', () => {
    expect(textStats('')).toEqual({ chars: 0, charsNoSpace: 0, words: 0, lines: 0, bytes: 0 })
    expect(textStats('hello world\n第二行')).toMatchObject({
      chars: 15,
      charsNoSpace: 13,
      words: 3,
      lines: 2,
      bytes: 21
    })
  })
})
