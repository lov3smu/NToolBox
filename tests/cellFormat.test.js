import { describe, expect, it } from 'vitest'
import {
  binaryByteLength,
  formatBinaryDump,
  formatBytes,
  formatCellInput,
  formatCellText,
  formatCellViewerText,
  isBinaryColumn,
  isBinaryValue
} from '@/views/database/cellFormat'

describe('isBinaryColumn', () => {
  it('matches blob/binary/bit/geometry types', () => {
    expect(isBinaryColumn('blob')).toBe(true)
    expect(isBinaryColumn('longblob')).toBe(true)
    expect(isBinaryColumn('varbinary(255)')).toBe(true)
    expect(isBinaryColumn('bit(1)')).toBe(true)
    expect(isBinaryColumn('geometry')).toBe(true)
  })

  it('ignores textual types', () => {
    expect(isBinaryColumn('varchar(255)')).toBe(false)
    expect(isBinaryColumn('int')).toBe(false)
    expect(isBinaryColumn('json')).toBe(false)
    expect(isBinaryColumn()).toBe(false)
  })
})

describe('isBinaryValue', () => {
  it('recognises typed arrays and serialized buffers', () => {
    expect(isBinaryValue(new Uint8Array([1, 2, 3]))).toBe(true)
    expect(isBinaryValue({ type: 'Buffer', data: [1, 2, 3] })).toBe(true)
  })

  it('rejects plain values', () => {
    expect(isBinaryValue('abc')).toBe(false)
    expect(isBinaryValue({ a: 1 })).toBe(false)
    expect(isBinaryValue(null)).toBe(false)
    expect(isBinaryValue([1, 2])).toBe(false)
  })
})

describe('formatBytes', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB')
  })
})

describe('formatCellText', () => {
  it('renders null, empty and scalar values', () => {
    expect(formatCellText(null)).toBe('NULL')
    expect(formatCellText(undefined)).toBe('')
    expect(formatCellText(42)).toBe('42')
    expect(formatCellText('hello')).toBe('hello')
  })

  it('renders binary values as a size tag instead of blank', () => {
    expect(formatCellText(new Uint8Array([1, 2, 3, 4]))).toBe('[二进制 4 B]')
    expect(formatCellText({ type: 'Buffer', data: new Array(2048).fill(0) })).toBe('[二进制 2 KB]')
  })

  it('renders json objects as compact text', () => {
    expect(formatCellText({ a: 1, b: [2, 3] })).toBe('{"a":1,"b":[2,3]}')
  })

  it('truncates long json previews', () => {
    const text = formatCellText({ key: 'x'.repeat(300) })
    expect(text.endsWith('…')).toBe(true)
    expect(text.length).toBeLessThanOrEqual(161)
  })

  it('normalises date strings', () => {
    expect(formatCellText('2024-05-06 07:08:09')).toBe('2024-05-06 07:08:09')
  })
})

describe('formatCellInput', () => {
  it('never exposes binary contents to the editor', () => {
    expect(formatCellInput(new Uint8Array([1, 2]))).toBe('')
  })

  it('serialises objects and blanks null', () => {
    expect(formatCellInput(null)).toBe('')
    expect(formatCellInput({ a: 1 })).toBe('{"a":1}')
    expect(formatCellInput(7)).toBe('7')
  })
})

describe('formatBinaryDump', () => {
  it('produces an aligned hex dump', () => {
    const dump = formatBinaryDump(new Uint8Array([0x48, 0x69]))
    expect(dump.split('\n')).toHaveLength(1)
    expect(dump).toBe('00000000  48 69                                            |Hi|')
  })

  it('reports truncation for large payloads', () => {
    const dump = formatBinaryDump(new Uint8Array(64), 32)
    expect(dump).toContain('已截断')
    expect(dump).toContain('64 B')
  })

  it('handles empty payloads', () => {
    expect(formatBinaryDump(new Uint8Array(0))).toBe('(空二进制)')
  })
})

describe('binaryByteLength', () => {
  it('measures both buffer shapes', () => {
    expect(binaryByteLength(new Uint8Array([1, 2, 3]))).toBe(3)
    expect(binaryByteLength({ type: 'Buffer', data: [1, 2] })).toBe(2)
    expect(binaryByteLength('abc')).toBe(0)
  })
})

describe('formatCellViewerText', () => {
  it('pretty prints object values', () => {
    expect(formatCellViewerText({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('pretty prints json strings', () => {
    expect(formatCellViewerText('{"a":1}')).toBe('{\n  "a": 1\n}')
  })

  it('dumps binary payloads', () => {
    expect(formatCellViewerText(new Uint8Array([0x41]))).toContain('|A|')
  })

  it('keeps plain text untouched', () => {
    expect(formatCellViewerText('plain')).toBe('plain')
    expect(formatCellViewerText(null)).toBe('NULL')
  })
})
