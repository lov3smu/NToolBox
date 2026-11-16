import { describe, it, expect } from 'vitest'
import { imageFilePathsFromText, normalizeClipboardPath } from '../src/main/services/clipboardPaths.js'

describe('normalizeClipboardPath', () => {
  it('trims quotes and whitespace', () => {
    expect(normalizeClipboardPath(' "/tmp/a.png" ')).toBe('/tmp/a.png')
    expect(normalizeClipboardPath("'/tmp/a.png'")).toBe('/tmp/a.png')
  })

  it('converts file URLs to local paths', () => {
    expect(normalizeClipboardPath('file:///tmp/my%20image.png')).toBe('/tmp/my image.png')
  })

  it('returns empty string for invalid input', () => {
    expect(normalizeClipboardPath('')).toBe('')
    expect(normalizeClipboardPath(null)).toBe('')
    expect(normalizeClipboardPath('file://')).toBe('')
  })
})

describe('imageFilePathsFromText', () => {
  it('extracts absolute image paths from copied lines', () => {
    const text = ['/tmp/a.png', '/tmp/b.JPG', '/tmp/c.txt', 'relative/d.png'].join('\n')
    expect(imageFilePathsFromText(text)).toEqual(['/tmp/a.png', '/tmp/b.JPG'])
  })

  it('extracts image paths from file URLs', () => {
    const text = 'file:///tmp/a.png\nfile:///tmp/b.webp'
    expect(imageFilePathsFromText(text)).toEqual(['/tmp/a.png', '/tmp/b.webp'])
  })

  it('deduplicates repeated paths and honours the line limit', () => {
    expect(imageFilePathsFromText('/tmp/a.png\n/tmp/a.png')).toEqual(['/tmp/a.png'])
    expect(imageFilePathsFromText(['/tmp/a.png', '/tmp/b.png', '/tmp/c.png'].join('\n'), 2)).toEqual([
      '/tmp/a.png',
      '/tmp/b.png'
    ])
  })

  it('returns an empty list for non-path text', () => {
    expect(imageFilePathsFromText('SELECT * FROM orders')).toEqual([])
    expect(imageFilePathsFromText('')).toEqual([])
  })
})
