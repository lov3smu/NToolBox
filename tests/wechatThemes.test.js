import { describe, it, expect } from 'vitest'
import {
  CODE_THEMES,
  DEFAULT_WECHAT_PREFS,
  WECHAT_FONTS,
  WECHAT_FONT_SIZES,
  WECHAT_LINE_HEIGHTS,
  WECHAT_THEMES,
  getCodeTheme,
  getWechatFont,
  isDarkWechatTheme,
  normalizeWechatPrefs,
  resolveLinkColor,
  resolveWechatTheme
} from '../src/renderer/src/utils/wechatThemes.js'

const HEX_PATTERN = /^#[0-9a-f]{6}$/i
const COLOR_KEYS = [
  'accent',
  'pageBg',
  'text',
  'heading',
  'muted',
  'link',
  'quoteBg',
  'quoteBorder',
  'quoteText',
  'codeBg',
  'codeText',
  'codeHeaderBg',
  'inlineBg',
  'inlineText',
  'tableHeadBg',
  'tableBorder',
  'rowBg',
  'hr'
]

describe('wechat themes', () => {
  it('declares unique ids and names', () => {
    expect(WECHAT_THEMES.length).toBeGreaterThanOrEqual(6)
    expect(new Set(WECHAT_THEMES.map((theme) => theme.id)).size).toBe(WECHAT_THEMES.length)
    expect(new Set(WECHAT_THEMES.map((theme) => theme.name)).size).toBe(WECHAT_THEMES.length)
  })

  it('uses valid colors for every palette entry', () => {
    for (const theme of WECHAT_THEMES) {
      for (const key of COLOR_KEYS) {
        expect(theme[key], `${theme.id}.${key}`).toMatch(HEX_PATTERN)
      }
      for (const [token, color] of Object.entries(theme.tokens)) {
        expect(color, `${theme.id}.${token}`).toMatch(HEX_PATTERN)
      }
    }
  })

  it('keeps the typography presets aligned with preferences', () => {
    expect(WECHAT_FONT_SIZES).toContain(DEFAULT_WECHAT_PREFS.fontSize)
    expect(WECHAT_LINE_HEIGHTS).toContain(DEFAULT_WECHAT_PREFS.lineHeight)
    expect(WECHAT_FONTS.some((font) => font.id === DEFAULT_WECHAT_PREFS.font)).toBe(true)
    expect(WECHAT_THEMES.some((theme) => theme.id === DEFAULT_WECHAT_PREFS.theme)).toBe(true)
  })

  it('declares unique code themes with valid palettes', () => {
    expect(CODE_THEMES.length).toBeGreaterThanOrEqual(10)
    expect(new Set(CODE_THEMES.map((theme) => theme.id)).size).toBe(CODE_THEMES.length)
    expect(CODE_THEMES.some((theme) => theme.id === DEFAULT_WECHAT_PREFS.codeTheme)).toBe(true)
    for (const theme of CODE_THEMES) {
      for (const key of ['bg', 'text', 'headerBg', 'lineNumber']) {
        expect(theme[key], `${theme.id}.${key}`).toMatch(HEX_PATTERN)
      }
      for (const [token, color] of Object.entries(theme.tokens)) {
        expect(color, `${theme.id}.${token}`).toMatch(HEX_PATTERN)
      }
    }
  })
})

describe('normalizeWechatPrefs', () => {
  it('falls back to defaults for missing or invalid input', () => {
    expect(normalizeWechatPrefs(null)).toEqual(DEFAULT_WECHAT_PREFS)
    expect(normalizeWechatPrefs('invalid')).toEqual(DEFAULT_WECHAT_PREFS)
    expect(
      normalizeWechatPrefs({
        theme: 'unknown',
        fontSize: 99,
        lineHeight: 9,
        font: 'unknown',
        accent: 'red',
        blockSpacing: 3,
        linkColor: 'nope',
        quoteBg: 'nope',
        codeTheme: 'nope',
        macCode: 'yes',
        lineNumbers: 1,
        previewWidth: 'nope',
        headingStyle: 'nope',
        legend: 'nope',
        plantUmlServer: 'javascript:alert(1)'
      })
    ).toEqual(DEFAULT_WECHAT_PREFS)
  })

  it('keeps valid preferences and normalizes colors', () => {
    expect(
      normalizeWechatPrefs({
        theme: 'night',
        fontSize: 18,
        lineHeight: 2,
        font: 'serif',
        accent: '#ABCDEF',
        blockSpacing: 1.15,
        linkColor: 'wechat',
        quoteBg: 'none',
        codeTheme: 'dracula',
        macCode: false,
        lineNumbers: true,
        justify: false,
        indent: true,
        previewWidth: 'mobile',
        headingStyle: 'border-left',
        legend: 'filename',
        plantUmlServer: 'https://plantuml.example.com/svg/',
        customCss: 'p { color: red; }'
      })
    ).toEqual({
      theme: 'night',
      fontSize: 18,
      lineHeight: 2,
      font: 'serif',
      accent: '#abcdef',
      blockSpacing: 1.15,
      linkColor: 'wechat',
      quoteBg: 'none',
      codeTheme: 'dracula',
      macCode: false,
      lineNumbers: true,
      justify: false,
      indent: true,
      previewWidth: 'mobile',
      headingStyle: 'border-left',
      legend: 'filename',
      plantUmlServer: 'https://plantuml.example.com/svg/',
      customCss: 'p { color: red; }'
    })
  })

  it('clamps custom css length', () => {
    const css = 'a'.repeat(25000)
    expect(normalizeWechatPrefs({ customCss: css }).customCss).toHaveLength(20000)
  })
})

describe('resolveWechatTheme', () => {
  it('returns the preset palette by default', () => {
    const theme = resolveWechatTheme({ theme: 'classic' })
    const preset = WECHAT_THEMES.find((item) => item.id === 'classic')
    expect(theme).toEqual(preset)
  })

  it('overrides accent, link and quote border with a custom color', () => {
    const theme = resolveWechatTheme({ theme: 'warm', accent: '#123456' })
    expect(theme.id).toBe('warm')
    expect(theme.accent).toBe('#123456')
    expect(theme.link).toBe('#123456')
    expect(theme.quoteBorder).toBe('#123456')
    expect(theme.pageBg).toBe(WECHAT_THEMES.find((item) => item.id === 'warm').pageBg)
  })
})

describe('theme helpers', () => {
  it('resolves link colors by preference', () => {
    const theme = WECHAT_THEMES.find((item) => item.id === 'classic')
    expect(resolveLinkColor({ linkColor: 'wechat' }, theme)).toBe('#576b95')
    expect(resolveLinkColor({ linkColor: 'text' }, theme)).toBe(theme.text)
    expect(resolveLinkColor({ linkColor: 'theme' }, theme)).toBe(theme.link)
  })

  it('detects dark palettes', () => {
    expect(isDarkWechatTheme(WECHAT_THEMES.find((item) => item.id === 'night'))).toBe(true)
    expect(isDarkWechatTheme(WECHAT_THEMES.find((item) => item.id === 'classic'))).toBe(false)
  })

  it('resolves code themes and fonts with fallbacks', () => {
    expect(getCodeTheme('dracula').id).toBe('dracula')
    expect(getCodeTheme('unknown')).toBe(CODE_THEMES[0])
    expect(getWechatFont('serif').id).toBe('serif')
    expect(getWechatFont('unknown')).toBe(WECHAT_FONTS[0])
  })
})
