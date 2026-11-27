import { describe, it, expect } from 'vitest'
import {
  MARKDOWN_DOCUMENT_LIMITS,
  normalizeRecentDocuments,
  splitFrontmatter,
  extractMarkdownOutline
} from '../src/shared/markdownDocument.js'

describe('markdown document helpers', () => {
  it('normalizes recent documents with dedupe, fallback names and cap', () => {
    const list = [
      { path: ' /tmp/a.md ', name: 'A', openedAt: 3 },
      { path: '/tmp/a.md', name: 'dup' },
      { path: '/tmp/b.md' },
      null,
      { name: 'no path' }
    ]
    const result = normalizeRecentDocuments(list)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ path: '/tmp/a.md', name: 'A', openedAt: 3 })
    expect(result[1].name).toBe('b.md')
    expect(result[1].openedAt).toBe(0)

    const many = Array.from({ length: 20 }, (_, index) => ({ path: `/tmp/${index}.md` }))
    expect(normalizeRecentDocuments(many)).toHaveLength(MARKDOWN_DOCUMENT_LIMITS.recentLimit)
    expect(normalizeRecentDocuments('nope')).toEqual([])
  })

  it('splits YAML frontmatter from the body', () => {
    const source = [
      '---',
      'title: "Hello"',
      'tags: a, b',
      '',
      'bad line',
      "author: 'me'",
      '---',
      '# Body',
      'text'
    ].join('\n')
    const result = splitFrontmatter(source)
    expect(result.frontmatter).toEqual([
      { key: 'title', value: 'Hello' },
      { key: 'tags', value: 'a, b' },
      { key: 'author', value: 'me' }
    ])
    expect(result.body).toBe('# Body\ntext')
  })

  it('keeps the source when frontmatter is missing or unclosed', () => {
    expect(splitFrontmatter('# Title')).toEqual({ frontmatter: [], body: '# Title' })
    const unclosed = '---\ntitle: x\n# Title'
    expect(splitFrontmatter(unclosed)).toEqual({ frontmatter: [], body: unclosed })
    const dots = '---\ntitle: x\n...\nbody'
    expect(splitFrontmatter(dots)).toEqual({ frontmatter: [{ key: 'title', value: 'x' }], body: 'body' })
  })

  it('extracts heading outline with line numbers and inline markup stripped', () => {
    const source = [
      '---',
      'title: Doc',
      '---',
      '# **Main** Title',
      '',
      '```md',
      '# not a heading',
      '```',
      '## Link [docs](https://example.com)',
      '   ### Deep `code`',
      '####### too deep',
      '## Trailing ##'
    ].join('\n')
    expect(extractMarkdownOutline(source)).toEqual([
      { level: 1, text: 'Main Title', line: 4 },
      { level: 2, text: 'Link docs', line: 9 },
      { level: 3, text: 'Deep code', line: 10 },
      { level: 2, text: 'Trailing', line: 12 }
    ])
  })

  it('ignores headings inside fences and caps the outline length', () => {
    const fenced = ['~~~', '# hidden', '~~~', '# visible'].join('\n')
    expect(extractMarkdownOutline(fenced)).toEqual([{ level: 1, text: 'visible', line: 4 }])

    const many = Array.from({ length: 400 }, (_, index) => `# h${index}`).join('\n')
    expect(extractMarkdownOutline(many)).toHaveLength(MARKDOWN_DOCUMENT_LIMITS.maxOutlineEntries)
  })
})
