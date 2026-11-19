export const LOCALE_VALUES = ['zh-CN', 'en-US']
export const DEFAULT_LOCALE = 'zh-CN'
export const LOCALE_OPTIONS = Object.freeze([
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' }
])

export function normalizeLocale(value, fallback = DEFAULT_LOCALE) {
  return LOCALE_VALUES.includes(value) ? value : fallback
}

export function interpolate(template, params) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  )
}
