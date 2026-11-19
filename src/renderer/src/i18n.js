import { ref } from 'vue'
import { DEFAULT_LOCALE, normalizeLocale, interpolate } from '@shared/i18n'
import enUS from '@shared/locales/en-US/index.js'

const STORAGE_KEY = 'ntb_locale'
const locale = ref(DEFAULT_LOCALE)

export function getLocale() {
  return locale.value
}

export function setLocale(value) {
  const next = normalizeLocale(value)
  locale.value = next
  if (typeof document !== 'undefined') document.documentElement.lang = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // ignore storage failures
  }
  return next
}

export function initLocale() {
  let stored
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    stored = null
  }
  setLocale(stored || DEFAULT_LOCALE)
}

export function t(key, params) {
  const current = locale.value
  const template = current === 'en-US' && Object.hasOwn(enUS, key) ? enUS[key] : key
  return interpolate(template, params)
}
