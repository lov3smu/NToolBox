import { describe, it, expect } from 'vitest'
import {
  CLIPBOARD_HISTORY_LIMITS,
  DEFAULT_CLIPBOARD_HISTORY_LIMIT,
  normalizeClipboardHistoryConfig
} from '../src/shared/clipboardSettings.js'

describe('normalizeClipboardHistoryConfig', () => {
  it('enables persistence and the default limit for missing input', () => {
    expect(normalizeClipboardHistoryConfig(null)).toEqual({
      persist: true,
      max_entries: DEFAULT_CLIPBOARD_HISTORY_LIMIT
    })
    expect(normalizeClipboardHistoryConfig([])).toEqual({
      persist: true,
      max_entries: DEFAULT_CLIPBOARD_HISTORY_LIMIT
    })
  })

  it('keeps supported limits and fallback to the default otherwise', () => {
    for (const limit of CLIPBOARD_HISTORY_LIMITS) {
      expect(normalizeClipboardHistoryConfig({ persist: false, max_entries: limit })).toEqual({
        persist: false,
        max_entries: limit
      })
    }
    expect(normalizeClipboardHistoryConfig({ max_entries: 77 }).max_entries).toBe(DEFAULT_CLIPBOARD_HISTORY_LIMIT)
    expect(normalizeClipboardHistoryConfig({ max_entries: '200' }).max_entries).toBe(200)
  })

  it('ignores non-boolean persistence flags', () => {
    expect(normalizeClipboardHistoryConfig({ persist: 'no' }).persist).toBe(true)
  })
})
