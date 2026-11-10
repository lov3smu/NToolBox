const STORAGE_KEY = 'ntb_theme'
const STYLE_STORAGE_KEY = 'ntb_theme_style'
const FONT_SIZE_STORAGE_KEY = 'ntb_font_size'
const VALID_PREFERENCES = ['system', 'light', 'dark']
export const THEME_STYLES = ['sapphire', 'forest', 'mint', 'bee', 'parchment']
export const FONT_SIZE_SCALES = {
  small: 0.9,
  medium: 1,
  large: 1.1,
  xlarge: 1.2
}

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

let preference = 'system'
let stylePreference = 'sapphire'
let fontSizePreference = 'medium'
let systemListenerAttached = false

function normalize(value) {
  return VALID_PREFERENCES.includes(value) ? value : 'system'
}

function normalizeStyle(value) {
  if (value === 'default') return 'sapphire'
  return THEME_STYLES.includes(value) ? value : 'sapphire'
}

function normalizeFontSize(value) {
  return Object.hasOwn(FONT_SIZE_SCALES, value) ? value : 'medium'
}

export function normalizeThemeStyle(value) {
  return normalizeStyle(value)
}

export function normalizeFontSizePreference(value) {
  return normalizeFontSize(value)
}

export function getResolvedTheme(pref = preference) {
  return normalize(pref) === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : normalize(pref)
}

export function getThemePreference() {
  return preference
}

export function getThemeStylePreference() {
  return stylePreference
}

export function getFontSizePreference() {
  return fontSizePreference
}

function dispatchThemeChange() {
  window.dispatchEvent(
    new CustomEvent('ntb-theme-changed', {
      detail: {
        theme: getResolvedTheme(),
        preference,
        style: stylePreference,
        fontSize: fontSizePreference
      }
    })
  )
}

export function applyTheme(pref, { persist = true } = {}) {
  preference = normalize(pref)
  document.documentElement.dataset.theme = getResolvedTheme()
  document.documentElement.dataset.themePreference = preference
  if (persist) localStorage.setItem(STORAGE_KEY, preference)
  dispatchThemeChange()
  return getResolvedTheme()
}

export function applyThemeStyle(style, { persist = true } = {}) {
  stylePreference = normalizeStyle(style)
  document.documentElement.dataset.themeStyle = stylePreference
  if (persist) localStorage.setItem(STYLE_STORAGE_KEY, stylePreference)
  dispatchThemeChange()
  return stylePreference
}

export function applyFontSize(size, { persist = true } = {}) {
  fontSizePreference = normalizeFontSize(size)
  const root = document.documentElement
  const wasChanging = root.dataset.fontSizeChanging !== undefined
  root.dataset.fontSizeChanging = ''
  root.dataset.fontSize = fontSizePreference
  root.style.setProperty('--font-scale', String(FONT_SIZE_SCALES[fontSizePreference]))
  if (persist) localStorage.setItem(FONT_SIZE_STORAGE_KEY, fontSizePreference)
  dispatchThemeChange()
  if (!wasChanging) {
    const done = () => delete root.dataset.fontSizeChanging
    globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(done))
    globalThis.setTimeout(done, 120)
  }
  return fontSizePreference
}

export function initTheme() {
  applyTheme(localStorage.getItem(STORAGE_KEY) || 'system', { persist: false })
  applyThemeStyle(localStorage.getItem(STYLE_STORAGE_KEY) || 'sapphire', { persist: false })
  applyFontSize(localStorage.getItem(FONT_SIZE_STORAGE_KEY) || 'medium', { persist: false })

  if (!systemListenerAttached) {
    mediaQuery.addEventListener('change', () => {
      if (preference === 'system') applyTheme('system', { persist: false })
    })
    systemListenerAttached = true
  }
}

export function syncThemeFromConfig(theme) {
  if (typeof theme === 'string' && normalize(theme) !== preference) {
    applyTheme(theme)
  }
}

export function syncThemeStyleFromConfig(style) {
  if (typeof style === 'string' && normalizeStyle(style) !== stylePreference) {
    applyThemeStyle(style)
  }
}

export function syncFontSizeFromConfig(size) {
  if (typeof size === 'string' && normalizeFontSize(size) !== fontSizePreference) {
    applyFontSize(size)
  }
}
