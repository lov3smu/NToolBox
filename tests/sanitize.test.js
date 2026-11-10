import fs from 'fs'
import os from 'os'
import path from 'path'
import { describe, it, expect, afterAll } from 'vitest'
import {
  escapeSql,
  isValidIdentifier,
  escapeIdentifier,
  sanitizePathSegment,
  isPathWithinBase,
  sanitizeInput,
  normalizeDirNameWithDate
} from '../src/main/utils/sanitize.js'

const tempDirs = []

function makeTempDir() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-path-')))
  tempDirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('escapeSql', () => {
  it('escapes quotes, backslashes and control characters', () => {
    expect(escapeSql("O'Brien")).toBe("O''Brien")
    expect(escapeSql('C:\\temp')).toBe('C:\\\\temp')
    expect(escapeSql('a\nb\rc')).toBe('a\\nb\\rc')
    expect(escapeSql('a\x00b\x1ac')).toBe('abc')
  })

  it('returns empty string for empty input', () => {
    expect(escapeSql('')).toBe('')
    expect(escapeSql(null)).toBe('')
  })
})

describe('isValidIdentifier', () => {
  it('accepts snake_case identifiers', () => {
    expect(isValidIdentifier('user_table')).toBe(true)
    expect(isValidIdentifier('_tmp1')).toBe(true)
  })

  it('rejects invalid identifiers', () => {
    expect(isValidIdentifier('1table')).toBe(false)
    expect(isValidIdentifier('bad-name')).toBe(false)
    expect(isValidIdentifier('')).toBe(false)
    expect(isValidIdentifier('a'.repeat(65))).toBe(false)
  })
})

describe('escapeIdentifier', () => {
  it('wraps valid identifiers in backticks', () => {
    expect(escapeIdentifier('user')).toBe('`user`')
  })

  it('normalizes invalid characters', () => {
    expect(escapeIdentifier('bad-name')).toBe('`bad_name`')
    expect(escapeIdentifier('a`b')).toBe('`a_b`')
  })
})

describe('sanitizePathSegment', () => {
  it('strips traversal and reserved characters', () => {
    expect(sanitizePathSegment('../etc/passwd')).toBe('_etc_passwd')
    expect(sanitizePathSegment('a/b:c*d')).toBe('a_b_c_d')
    expect(sanitizePathSegment('')).toBe('')
  })
})

describe('isPathWithinBase', () => {
  it('accepts the base directory and its descendants', () => {
    const base = makeTempDir()
    const child = path.join(base, 'year', '1105-demo')
    fs.mkdirSync(child, { recursive: true })

    expect(isPathWithinBase(base, base)).toBe(true)
    expect(isPathWithinBase(child, base)).toBe(true)
  })

  it('accepts descendants that do not exist yet', () => {
    const base = makeTempDir()
    expect(isPathWithinBase(path.join(base, '2026', '1105-demo', 'DDL'), base)).toBe(true)
  })

  it('rejects siblings and traversal outside the base', () => {
    const base = makeTempDir()
    const sibling = `${base}-sibling`

    expect(isPathWithinBase(sibling, base)).toBe(false)
    expect(isPathWithinBase(path.join(base, '..', 'outside'), base)).toBe(false)
  })

  it('rejects paths that escape through a symlinked directory', () => {
    if (process.platform === 'win32') return

    const base = makeTempDir()
    const outside = makeTempDir()
    fs.symlinkSync(outside, path.join(base, 'link'))

    expect(isPathWithinBase(path.join(base, 'link', 'pwn.sql'), base)).toBe(false)
  })

  it('rejects empty or non-string input', () => {
    expect(isPathWithinBase('', '/tmp')).toBe(false)
    expect(isPathWithinBase(null, '/tmp')).toBe(false)
    expect(isPathWithinBase('/tmp', undefined)).toBe(false)
  })
})

describe('sanitizeInput', () => {
  it('truncates and trims', () => {
    expect(sanitizeInput('abcdef  ', 3)).toBe('abc')
    expect(sanitizeInput('  abc  ')).toBe('abc')
    expect(sanitizeInput(null)).toBe('')
  })
})

describe('normalizeDirNameWithDate', () => {
  const date = new Date(2026, 1, 5)

  it('prefixes missing dates', () => {
    expect(normalizeDirNameWithDate('user-dict', date)).toBe('0205-user-dict')
  })

  it('keeps valid date prefixes', () => {
    expect(normalizeDirNameWithDate('0204-user-dict', date)).toBe('0204-user-dict')
  })

  it('replaces invalid date prefixes', () => {
    expect(normalizeDirNameWithDate('1301-user-dict', date)).toBe('0205-1301-user-dict')
  })
})
