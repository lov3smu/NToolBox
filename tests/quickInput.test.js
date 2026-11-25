import { describe, expect, it } from 'vitest'
import { QUICK_INPUT_KINDS, QUICK_INPUT_MAX_CHARS, detectQuickInput } from '../src/shared/quickInput.js'

const NOW = Date.UTC(2026, 0, 1, 0, 0, 0)

function segment(value) {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function jwt(header, payload) {
  return `${segment(header)}.${segment(payload)}.signature`
}

describe('quickInput', () => {
  it('detects valid and invalid JSON objects', () => {
    const valid = detectQuickInput('{"name":"ntb","count":2}')
    expect(valid.kind).toBe(QUICK_INPUT_KINDS.JSON)
    expect(valid.payload).toEqual({ valid: true, type: 'object', count: 2 })
    expect(valid.send.path).toBe('/json-parser')
    expect(JSON.parse(valid.send.text)).toEqual({ name: 'ntb', count: 2 })

    const array = detectQuickInput('[1, 2, 3]')
    expect(array.payload).toEqual({ valid: true, type: 'array', count: 3 })

    const broken = detectQuickInput('{"name": }')
    expect(broken.kind).toBe(QUICK_INPUT_KINDS.JSON)
    expect(broken.payload.valid).toBe(false)
  })

  it('detects SQL statements and ignores stray keywords', () => {
    const found = detectQuickInput('SELECT id, name\nFROM users\nWHERE id = 1;')
    expect(found.kind).toBe(QUICK_INPUT_KINDS.SQL)
    expect(found.payload).toMatchObject({ statement: 'SELECT', lines: 3 })
    expect(found.send).toBeNull()

    expect(detectQuickInput('select')).toBeNull()
    expect(detectQuickInput('SELECT * FROM users')).not.toBeNull()
  })

  it('decodes JWT payloads and expiration', () => {
    const expired = detectQuickInput(
      jwt({ alg: 'HS256', typ: 'JWT' }, { sub: '1', exp: Math.floor(NOW / 1000) - 60 }),
      NOW
    )
    expect(expired.kind).toBe(QUICK_INPUT_KINDS.JWT)
    expect(expired.payload).toMatchObject({ algorithm: 'HS256', type: 'JWT', expired: true, claimCount: 2 })
    expect(JSON.parse(expired.send.text)).toMatchObject({ sub: '1' })
    expect(expired.send.path).toBe('/json-parser')

    const active = detectQuickInput(jwt({ alg: 'RS256' }, { sub: '2', exp: Math.floor(NOW / 1000) + 60 }), NOW)
    expect(active.payload.expired).toBe(false)

    const unknown = detectQuickInput(jwt({ alg: 'HS256' }, { sub: '3' }), NOW)
    expect(unknown.payload.expired).toBeNull()

    expect(detectQuickInput('aaa.bbb.ccc')).toBeNull()
  })

  it('parses http URLs', () => {
    const found = detectQuickInput('https://example.com/api/users?page=2&size=10#list')
    expect(found.kind).toBe(QUICK_INPUT_KINDS.URL)
    expect(found.payload).toMatchObject({ protocol: 'https', host: 'example.com', params: 2, hash: 'list' })
    expect(found.send).toMatchObject({
      path: '/http-client',
      text: 'https://example.com/api/users?page=2&size=10#list'
    })

    expect(detectQuickInput('ftp://example.com/file')).toBeNull()
    expect(detectQuickInput('example.com')).toBeNull()
  })

  it('converts second and millisecond timestamps', () => {
    const seconds = detectQuickInput('1700000000', NOW)
    expect(seconds.kind).toBe(QUICK_INPUT_KINDS.TIMESTAMP)
    expect(seconds.payload.unit).toBe('seconds')
    expect(seconds.payload.iso).toBe(new Date(1700000000000).toISOString())
    expect(seconds.send.path).toBe('/unixtimestamp')

    const millis = detectQuickInput('1700000000000', NOW)
    expect(millis.payload.unit).toBe('milliseconds')
    expect(millis.payload.epochMs).toBe(1700000000000)

    expect(detectQuickInput('946684799', NOW)).toBeNull()
    expect(detectQuickInput('9999999999', NOW)).toBeNull()
  })

  it('normalizes hex, rgb and hsl colors', () => {
    const short = detectQuickInput('#0f0')
    expect(short.kind).toBe(QUICK_INPUT_KINDS.COLOR)
    expect(short.payload).toEqual({ hex: '#00ff00', rgb: 'rgb(0, 255, 0)', hsl: 'hsl(120, 100%, 50%)', alpha: 1 })

    const rgba = detectQuickInput('rgba(255, 0, 0, 0.5)')
    expect(rgba.payload.hex).toBe('#ff000080')
    expect(rgba.payload.rgb).toBe('rgba(255, 0, 0, 0.5)')

    const hsl = detectQuickInput('hsl(120, 100%, 50%)')
    expect(hsl.payload.hex).toBe('#00ff00')

    expect(detectQuickInput('rgb(300, 0, 0)')).toBeNull()
    expect(detectQuickInput('#12')).toBeNull()
  })

  it('detects base64 text and exposes the decoded value', () => {
    const json = detectQuickInput('eyJhIjoxfQ==')
    expect(json.kind).toBe(QUICK_INPUT_KINDS.BASE64)
    expect(json.copyText).toBe('{"a":1}')
    expect(json.send.path).toBe('/json-parser')

    const plain = detectQuickInput('aGVsbG8gd29ybGQ=')
    expect(plain.kind).toBe(QUICK_INPUT_KINDS.BASE64)
    expect(plain.copyText).toBe('hello world')
    expect(plain.send).toBeNull()

    expect(detectQuickInput('abcd')).toBeNull()
    expect(detectQuickInput('abcdefgh')).toBeNull()
  })

  it('detects url-encoded text', () => {
    const text = detectQuickInput('a%20b%26c')
    expect(text.kind).toBe(QUICK_INPUT_KINDS.URL_ENCODED)
    expect(text.copyText).toBe('a b&c')
    expect(text.send).toBeNull()

    const json = detectQuickInput('%7B%22a%22%3A1%7D')
    expect(json.kind).toBe(QUICK_INPUT_KINDS.URL_ENCODED)
    expect(json.send.path).toBe('/json-parser')

    expect(detectQuickInput('100% sure')).toBeNull()
  })

  it('detects nothing for plain text or oversized input', () => {
    expect(detectQuickInput('hello world')).toBeNull()
    expect(detectQuickInput('')).toBeNull()
    expect(detectQuickInput(null)).toBeNull()
    expect(detectQuickInput('{'.repeat(QUICK_INPUT_MAX_CHARS + 1))).toBeNull()
  })
})
