import { describe, expect, it } from 'vitest'
import {
  HTTP_MAX_BODY_LENGTH,
  HTTP_MAX_HEADERS,
  HTTP_MAX_TIMEOUT_MS,
  parseHeaderLines,
  normalizeHttpRequest
} from '../src/shared/httpClient.js'

describe('httpClient', () => {
  it('parses header lines', () => {
    expect(parseHeaderLines('Accept: */*\n\nContent-Type: application/json')).toEqual({
      ok: true,
      headers: { Accept: '*/*', 'Content-Type': 'application/json' }
    })
    expect(parseHeaderLines('X-Empty:')).toEqual({ ok: true, headers: { 'X-Empty': '' } })
    expect(parseHeaderLines('X-Dup: a\nX-Dup: b')).toEqual({ ok: true, headers: { 'X-Dup': 'b' } })
    expect(parseHeaderLines('no-colon')).toEqual({ ok: false, error: 'invalid-headers', line: 1 })
  })

  it('rejects too many headers', () => {
    const lines = Array.from({ length: HTTP_MAX_HEADERS + 1 }, (_value, index) => `X-${index}: v`).join('\n')
    expect(parseHeaderLines(lines)).toEqual({ ok: false, error: 'headers-too-many' })
  })

  it('normalizes a valid request', () => {
    const result = normalizeHttpRequest({
      method: 'post',
      url: 'https://example.com/api',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
      timeoutMs: 999999
    })
    expect(result.ok).toBe(true)
    expect(result.request).toMatchObject({
      method: 'POST',
      url: 'https://example.com/api',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
      timeoutMs: HTTP_MAX_TIMEOUT_MS
    })
  })

  it('drops bodies for GET and HEAD', () => {
    expect(normalizeHttpRequest({ method: 'GET', url: 'http://localhost/', body: 'ignored' }).request.body).toBe('')
    expect(normalizeHttpRequest({ method: 'HEAD', url: 'http://localhost/', body: 'ignored' }).request.body).toBe('')
  })

  it('rejects invalid input', () => {
    expect(normalizeHttpRequest(null)).toMatchObject({ ok: false, error: 'invalid-url' })
    expect(normalizeHttpRequest({ method: 'TRACE', url: 'https://a.b' })).toMatchObject({
      ok: false,
      error: 'invalid-method'
    })
    expect(normalizeHttpRequest({ url: 'ftp://a.b' })).toMatchObject({ ok: false, error: 'invalid-url' })
    expect(normalizeHttpRequest({ url: 'not a url' })).toMatchObject({ ok: false, error: 'invalid-url' })
    expect(
      normalizeHttpRequest({ method: 'POST', url: 'https://a.b', body: 'x'.repeat(HTTP_MAX_BODY_LENGTH + 1) })
    ).toMatchObject({ ok: false, error: 'body-too-large' })
  })

  it('clamps timeout to defaults for missing or tiny values', () => {
    expect(normalizeHttpRequest({ url: 'https://a.b' }).request.timeoutMs).toBe(30000)
    expect(normalizeHttpRequest({ url: 'https://a.b', timeoutMs: 10 }).request.timeoutMs).toBe(1000)
    expect(normalizeHttpRequest({ url: 'https://a.b', timeoutMs: 'abc' }).request.timeoutMs).toBe(30000)
  })
})
