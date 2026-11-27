import { describe, expect, it } from 'vitest'
import { CODEC_MAX_CHAIN_STEPS, CODEC_MODES, applyCodecChain, transformCodec } from '../src/shared/codec.js'

function encode(mode, text) {
  return transformCodec(mode, 'encode', text)
}

function decode(mode, text) {
  return transformCodec(mode, 'decode', text)
}

describe('codec', () => {
  it('round-trips utf-8 through base64', () => {
    const encoded = encode('base64', '你好, NToolBox')
    expect(encoded.ok).toBe(true)
    expect(decode('base64', encoded.value)).toEqual({ ok: true, value: '你好, NToolBox' })
  })

  it('rejects invalid base64', () => {
    expect(decode('base64', 'not base64!')).toEqual({ ok: false, error: 'invalid-base64' })
  })

  it('encodes and decodes URLs', () => {
    expect(encode('url', 'a b&c=中')).toEqual({ ok: true, value: 'a%20b%26c%3D%E4%B8%AD' })
    expect(decode('url', 'a%20b')).toEqual({ ok: true, value: 'a b' })
    expect(decode('url', '%E0%A4%A')).toEqual({ ok: false, error: 'invalid-url' })
  })

  it('encodes and decodes HTML entities', () => {
    expect(encode('html', `<a href="x">'&'</a>`)).toEqual({
      ok: true,
      value: '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    })
    expect(decode('html', '&lt;p&gt;&#39;&amp;&#x4e2d;&lt;/p&gt;')).toEqual({ ok: true, value: "<p>'&中</p>" })
    expect(decode('html', '&unknown; &#xZZ;')).toEqual({ ok: true, value: '&unknown; &#xZZ;' })
  })

  it('encodes and decodes unicode escapes', () => {
    const encoded = encode('unicode', 'a中😀')
    expect(encoded).toEqual({ ok: true, value: 'a\\u4e2d\\ud83d\\ude00' })
    expect(decode('unicode', encoded.value)).toEqual({ ok: true, value: 'a中😀' })
    expect(decode('unicode', '\\u{1f600}')).toEqual({ ok: true, value: '😀' })
  })

  it('encodes and decodes hex', () => {
    expect(encode('hex', 'Hello')).toEqual({ ok: true, value: '48656c6c6f' })
    expect(decode('hex', '48 65 6C 6C 6F')).toEqual({ ok: true, value: 'Hello' })
    expect(decode('hex', 'abc')).toEqual({ ok: false, error: 'invalid-hex' })
    expect(decode('hex', 'zz')).toEqual({ ok: false, error: 'invalid-hex' })
  })

  it('escapes and unescapes JSON strings', () => {
    expect(encode('json', 'a"b\nc')).toEqual({ ok: true, value: 'a\\"b\\nc' })
    expect(decode('json', 'a\\"b\\nc')).toEqual({ ok: true, value: 'a"b\nc' })
    expect(decode('json', '"quoted"')).toEqual({ ok: true, value: 'quoted' })
    expect(decode('json', '"unterminated')).toEqual({ ok: false, error: 'invalid-json' })
  })

  it('rejects unknown modes and declares all modes', () => {
    expect(transformCodec('rot13', 'encode', 'x')).toEqual({ ok: false, error: 'unsupported-mode' })
    expect(CODEC_MODES.map((mode) => mode.id)).toEqual(['base64', 'url', 'html', 'unicode', 'hex', 'json'])
  })

  it('applies chained transformations in order', () => {
    const steps = [
      { mode: 'url', direction: 'encode' },
      { mode: 'base64', direction: 'encode' }
    ]
    const encoded = applyCodecChain(steps, 'a b&c')
    expect(encoded).toEqual({ ok: true, value: encode('base64', 'a%20b%26c').value })
    const reversed = [
      { mode: 'base64', direction: 'decode' },
      { mode: 'url', direction: 'decode' }
    ]
    expect(applyCodecChain(reversed, encoded.value)).toEqual({ ok: true, value: 'a b&c' })
  })

  it('reports the failing chain step and tolerates empty chains', () => {
    expect(applyCodecChain([], 'x')).toEqual({ ok: true, value: 'x' })
    expect(applyCodecChain(null, 'x')).toEqual({ ok: true, value: 'x' })
    const failed = applyCodecChain(
      [
        { mode: 'unicode', direction: 'encode' },
        { mode: 'base64', direction: 'decode' }
      ],
      'not base64!'
    )
    expect(failed).toEqual({ ok: false, error: 'invalid-base64', stepIndex: 1 })
    expect(CODEC_MAX_CHAIN_STEPS).toBeGreaterThan(0)
  })
})
