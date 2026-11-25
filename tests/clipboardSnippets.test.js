import { describe, expect, it } from 'vitest'
import {
  CLIPBOARD_SNIPPET_LIMITS,
  normalizeClipboardSnippet,
  normalizeClipboardSnippets,
  sortClipboardSnippets
} from '../src/shared/clipboardSnippets.js'

describe('clipboardSnippets', () => {
  it('normalizes a snippet and falls back to the first line as the name', () => {
    const snippet = normalizeClipboardSnippet({ text: 'git status\r\ngit diff', updatedAt: 10 })
    expect(snippet.name).toBe('git status')
    expect(snippet.text).toBe('git status\ngit diff')
    expect(snippet.updatedAt).toBe(10)
    expect(snippet.id).toMatch(/^snip-/)
  })

  it('rejects empty snippets and keeps explicit names', () => {
    expect(normalizeClipboardSnippet({ text: '   ' })).toBeNull()
    expect(normalizeClipboardSnippet(null)).toBeNull()
    expect(normalizeClipboardSnippet({ name: ' 常用 ', text: 'hello' }).name).toBe('常用')
  })

  it('caps name and text lengths', () => {
    const snippet = normalizeClipboardSnippet({ name: 'x'.repeat(200), text: 'y'.repeat(30000) })
    expect(snippet.name).toHaveLength(CLIPBOARD_SNIPPET_LIMITS.nameLength)
    expect(snippet.text).toHaveLength(CLIPBOARD_SNIPPET_LIMITS.textLength)
  })

  it('caps the list size and drops invalid entries', () => {
    const raw = [{ text: '' }, ...Array.from({ length: 60 }, (_, index) => ({ text: `snippet ${index}` }))]
    expect(normalizeClipboardSnippets(raw)).toHaveLength(CLIPBOARD_SNIPPET_LIMITS.max)
    expect(normalizeClipboardSnippets('nope')).toEqual([])
  })

  it('sorts newest first without mutating the input', () => {
    const input = [
      { text: 'a', updatedAt: 1 },
      { text: 'b', updatedAt: 3 },
      { text: 'c', updatedAt: 2 }
    ]
    expect(sortClipboardSnippets(input).map((item) => item.text)).toEqual(['b', 'c', 'a'])
    expect(input.map((item) => item.text)).toEqual(['a', 'b', 'c'])
  })
})
