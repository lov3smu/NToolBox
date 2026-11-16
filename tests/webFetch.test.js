import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:dns/promises', () => ({
  default: { lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]) }
}))

const { default: handler } = await import('../src/main/skills/builtin/web-fetch/handler.js')

describe('web-fetch skill', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('rejects unsupported schemes and malformed urls', async () => {
    for (const url of ['ftp://example.com/file', 'not-a-url', '']) {
      const result = await handler({ url })
      expect(result.success).toBe(false)
      expect(result.metadata).toEqual({ action: 'web-fetch', url })
    }
  })

  it.each([
    'http://localhost:3000/',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://192.168.1.10/',
    'http://169.254.169.254/latest/meta-data',
    'http://10.0.0.8/'
  ])('blocks local and private targets: %s', async (url) => {
    const result = await handler({ url })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/本地或内网/)
  })

  it('extracts readable text and metadata from html', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          '<!doctype html><html><head><title>Hello &amp; World</title><style>.x{}</style></head><body><script>evil()</script><h1>Title</h1><p>Body&nbsp;text</p></body></html>',
          { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }
        )
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await handler({ url: 'https://example.com/doc?a=1', max_chars: 500 })
    expect(result.success).toBe(true)
    expect(result.metadata).toMatchObject({
      action: 'web-fetch',
      url: 'https://example.com/doc?a=1',
      finalUrl: 'https://example.com/doc?a=1',
      title: 'Hello & World',
      status: 200,
      contentType: 'text/html'
    })
    expect(result.content).toContain('Body text')
    expect(result.content).not.toContain('evil()')
    expect(result.content).not.toContain('.x{}')
  })

  it('re-validates redirect targets before following', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('', {
          status: 302,
          headers: { location: 'http://127.0.0.1/internal' }
        })
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await handler({ url: 'https://example.com/redirect' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/本地或内网/)
  })
})
