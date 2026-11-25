import { describe, expect, it } from 'vitest'
import {
  basenameOf,
  buildRowsText,
  canSendResourceTo,
  dirnameOf,
  encodeSendResource,
  getSendTargets,
  isImagePath,
  isTextDocumentPath,
  normalizeSendResource,
  parseSendResource,
  sendKindForPath,
  SEND_KINDS
} from '../src/shared/sendTo'

describe('sendTo paths', () => {
  it('splits basenames and directories on both separators', () => {
    expect(basenameOf('/tmp/a/b.png')).toBe('b.png')
    expect(basenameOf('C:\\tmp\\b.png')).toBe('b.png')
    expect(basenameOf('plain.txt')).toBe('plain.txt')
    expect(dirnameOf('/tmp/a/b.png')).toBe('/tmp/a')
    expect(dirnameOf('C:\\tmp\\b.png')).toBe('C:\\tmp')
    expect(dirnameOf('/tmp')).toBe('')
  })

  it('detects image and text document extensions', () => {
    expect(isImagePath('/a/B.PNG')).toBe(true)
    expect(isImagePath('/a/b.svg')).toBe(true)
    expect(isImagePath('/a/b.txt')).toBe(false)
    expect(isTextDocumentPath('/a/b.md')).toBe(true)
    expect(isTextDocumentPath('/a/b.YML')).toBe(true)
    expect(isTextDocumentPath('/a/b.png')).toBe(false)
    expect(sendKindForPath('/a/b.png')).toBe(SEND_KINDS.IMAGE)
    expect(sendKindForPath('/a/b.json')).toBe(SEND_KINDS.TEXT)
    expect(sendKindForPath('/a/b.exe')).toBe(null)
  })
})

describe('sendTo resources', () => {
  it('normalizes image resources by path', () => {
    expect(normalizeSendResource({ kind: 'image', path: '/a/b.png' })).toEqual({
      kind: 'image',
      title: 'b.png',
      path: '/a/b.png'
    })
    expect(normalizeSendResource({ kind: 'image', path: '/a/b.txt' })).toBe(null)
    expect(normalizeSendResource({ kind: 'image', path: '' })).toBe(null)
  })

  it('requires non-blank text and truncates long payloads', () => {
    expect(normalizeSendResource({ kind: 'text', text: '   ' })).toBe(null)
    const long = 'x'.repeat(1024 * 1024 + 10)
    const normalized = normalizeSendResource({ kind: 'text', title: 'a'.repeat(300), text: long })
    expect(normalized.text.length).toBe(1024 * 1024)
    expect(normalized.title.length).toBe(200)
  })

  it('round-trips through transfer encoding', () => {
    const encoded = encodeSendResource({ kind: 'text', title: 't', text: 'hello' })
    expect(parseSendResource(encoded)).toEqual({ kind: 'text', title: 't', text: 'hello' })
    expect(parseSendResource('plain path')).toBe(null)
    expect(parseSendResource(JSON.stringify({ kind: 'text', text: 'x' }))).toBe(null)
    expect(encodeSendResource({ kind: 'text', text: '' })).toBe('')
  })

  it('filters targets by kind', () => {
    expect(canSendResourceTo('/json-parser', 'text')).toBe(true)
    expect(canSendResourceTo('/json-parser', 'image')).toBe(false)
    expect(canSendResourceTo('/image-viewer', 'image')).toBe(true)
    expect(canSendResourceTo('/clipboard', 'text')).toBe(false)
    expect(getSendTargets('text', '/markdown-editor').map((target) => target.path)).not.toContain('/markdown-editor')
    expect(getSendTargets('image').map((target) => target.path)).toEqual(['/image-viewer'])
  })
})

describe('buildRowsText', () => {
  it('builds tab separated text from fields and rows', () => {
    const fields = [{ name: 'id' }, { name: 'name' }]
    const rows = [
      { id: 1, name: 'a' },
      { id: 2, name: null }
    ]
    expect(buildRowsText(fields, rows)).toBe('id\tname\n1\ta\n2\t')
  })

  it('flattens nested values and tabs', () => {
    const rows = [{ v: { a: 1 }, w: 'x\ty\nz' }]
    expect(buildRowsText([{ name: 'v' }, { name: 'w' }], rows)).toBe('v\tw\n{"a":1}\tx y z')
  })

  it('returns empty text without fields or rows', () => {
    expect(buildRowsText([], [])).toBe('')
    expect(buildRowsText([{ name: 'a' }], [])).toBe('')
    expect(buildRowsText(['a'], null)).toBe('')
  })
})
