import { describe, it, expect } from 'vitest'
import { highlightSqlToHtml } from '../src/renderer/src/utils/sqlHighlight.js'

describe('highlightSqlToHtml', () => {
  it('highlights DDL keywords, types and identifiers', () => {
    const html = highlightSqlToHtml('CREATE TABLE `t_users` (id BIGINT);')
    expect(html).toContain('<span class="tok-keyword">CREATE</span>')
    expect(html).toContain('<span class="tok-keyword">TABLE</span>')
    expect(html).toContain('<span class="tok-identifier">`t_users`</span>')
    expect(html).toContain('<span class="tok-type">BIGINT</span>')
  })

  it('escapes markup coming from database definitions', () => {
    const html = highlightSqlToHtml("COMMENT '<script>alert(1)</script>&'")
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
  })

  it('returns an empty string for empty input', () => {
    expect(highlightSqlToHtml('')).toBe('')
    expect(highlightSqlToHtml(undefined)).toBe('')
  })
})
