import { DEFAULT_LOCALE, normalizeLocale, interpolate } from '../../shared/i18n.js'
import enUS from '../../shared/locales/en-US/index.js'

let locale = DEFAULT_LOCALE

export function getLocale() {
  return locale
}

export function setLocale(value) {
  const next = normalizeLocale(value)
  const changed = next !== locale
  locale = next
  return changed
}

export function syncLocaleFromConfig(config) {
  return setLocale(config?.appearance?.language)
}

export function t(key, params) {
  const template = locale === 'en-US' && Object.hasOwn(enUS, key) ? enUS[key] : key
  return interpolate(template, params)
}
