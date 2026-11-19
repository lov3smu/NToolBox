import { describe, it, expect, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { DEFAULT_LOCALE, LOCALE_VALUES, LOCALE_OPTIONS, normalizeLocale, interpolate } from '../src/shared/i18n.js'
import enUS from '../src/shared/locales/en-US/index.js'
import { t as mainT, getLocale, setLocale } from '../src/main/services/i18n.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIRS = ['src/renderer/src', 'src/main']
const TEXT_FILE = /\.(vue|js)$/

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, out)
    } else if (TEXT_FILE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function collectTKeys() {
  const keys = new Map()
  const pattern = /\bt\(\s*'((?:[^'\\]|\\.)*)'/g
  for (const dir of SCAN_DIRS) {
    for (const file of collectFiles(path.join(root, dir))) {
      const source = fs.readFileSync(file, 'utf8')
      for (const match of source.matchAll(pattern)) {
        const key = match[1].replace(/\\(['"\\nrt])/g, (m, c) => {
          return { "'": "'", '"': '"', '\\': '\\', n: '\n', r: '\r', t: '\t' }[c]
        })
        if (!keys.has(key)) keys.set(key, path.relative(root, file))
      }
    }
  }
  return keys
}

describe('shared i18n helpers', () => {
  it('exposes the supported locales with zh-CN as default', () => {
    expect(LOCALE_VALUES).toEqual(['zh-CN', 'en-US'])
    expect(DEFAULT_LOCALE).toBe('zh-CN')
    expect(LOCALE_OPTIONS.map((item) => item.value)).toEqual(LOCALE_VALUES)
  })

  it('normalizes unknown locales to the fallback', () => {
    expect(normalizeLocale('en-US')).toBe('en-US')
    expect(normalizeLocale('zh-CN')).toBe('zh-CN')
    expect(normalizeLocale('fr-FR')).toBe('zh-CN')
    expect(normalizeLocale(undefined)).toBe('zh-CN')
    expect(normalizeLocale('', 'en-US')).toBe('en-US')
  })

  it('interpolates named placeholders and keeps unknown ones', () => {
    expect(interpolate('{count} 个工具', { count: 18 })).toBe('18 个工具')
    expect(interpolate('{a}-{b}', { a: 'x' })).toBe('x-{b}')
    expect(interpolate('plain')).toBe('plain')
  })
})

describe('English catalog', () => {
  it('contains only non-empty string translations', () => {
    for (const [key, value] of Object.entries(enUS)) {
      expect(key.length, key).toBeGreaterThan(0)
      expect(typeof value, key).toBe('string')
      expect(value.trim().length, key).toBeGreaterThan(0)
    }
  })

  it('uses the same named placeholders as the Chinese key', () => {
    for (const [key, value] of Object.entries(enUS)) {
      const expected = [...key.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
      const actual = [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
      expect(actual, key).toEqual(expected)
    }
  })
})

describe('main process translator', () => {
  afterEach(() => setLocale('zh-CN'))

  it('returns the key unchanged for zh-CN', () => {
    setLocale('zh-CN')
    expect(getLocale()).toBe('zh-CN')
    expect(mainT('保存成功')).toBe('保存成功')
  })

  it('translates and interpolates for en-US', () => {
    setLocale('en-US')
    expect(getLocale()).toBe('en-US')
    expect(mainT('备份失败')).toBe('Backup failed')
    expect(mainT('{name} 已备份到 {file}', { name: 'shop', file: '/tmp/a.sql' })).toBe('"shop" backed up to /tmp/a.sql')
  })

  it('falls back to the key when English has no entry', () => {
    setLocale('en-US')
    expect(mainT('不存在的词条')).toBe('不存在的词条')
  })

  it('returns the locale change flag', () => {
    expect(setLocale('en-US')).toBe(true)
    expect(setLocale('en-US')).toBe(false)
    expect(setLocale('fr-FR')).toBe(true)
  })
})

describe('translation coverage', () => {
  it('has an English entry for every literal t() key in renderer and main', () => {
    const missing = []
    for (const [key, file] of collectTKeys()) {
      if (!Object.hasOwn(enUS, key)) missing.push(`${key} (${file})`)
    }
    expect(missing).toEqual([])
  })
})
