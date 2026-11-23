import { describe, it, expect } from 'vitest'
import {
  ALL_SHORTCUT_KEYS,
  DEFAULT_SHORTCUT_ACTIONS,
  SHORTCUT_ACTION_KEYS,
  getDefaultShortcuts
} from '../src/shared/shortcutActions.js'
import {
  captureAccelerator,
  formatAccelerator,
  matchesAccelerator,
  normalizeKeyName,
  parseAccelerator
} from '../src/renderer/src/utils/shortcut.js'

function keyEvent(key, modifiers = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers }
}

describe('shared shortcut actions', () => {
  it('merges tool shortcuts with generic defaults', () => {
    const defaults = getDefaultShortcuts()
    expect(defaults.settings).toBe('CmdOrCtrl+,')
    expect(defaults.chat_send).toBe('Enter')
    expect(defaults.database_run).toBe('CmdOrCtrl+Enter')
    expect(defaults.global_search).toBe('CmdOrCtrl+K')
  })

  it('exposes every valid config key', () => {
    expect(ALL_SHORTCUT_KEYS).toEqual(['settings', ...SHORTCUT_ACTION_KEYS])
    expect(ALL_SHORTCUT_KEYS).toContain('chat_send')
    expect(DEFAULT_SHORTCUT_ACTIONS.chat_send).toBe('Enter')
  })
})

describe('accelerator parsing', () => {
  it('parses modifiers and keys', () => {
    expect(parseAccelerator('CmdOrCtrl+Enter')).toEqual({
      mod: true,
      ctrl: false,
      alt: false,
      shift: false,
      key: 'enter'
    })
    expect(parseAccelerator('Shift+Alt+Esc')).toEqual({
      mod: false,
      ctrl: false,
      alt: true,
      shift: true,
      key: 'escape'
    })
    expect(parseAccelerator('')).toBeNull()
    expect(parseAccelerator('Ctrl+')).toBeNull()
  })

  it('normalizes event keys', () => {
    expect(normalizeKeyName(' ')).toBe('space')
    expect(normalizeKeyName('ArrowUp')).toBe('arrowup')
    expect(normalizeKeyName('Return')).toBe('enter')
    expect(normalizeKeyName('k')).toBe('k')
  })
})

describe('matchesAccelerator', () => {
  it('matches a bare Enter without modifiers', () => {
    expect(matchesAccelerator(keyEvent('Enter'), 'Enter')).toBe(true)
    expect(matchesAccelerator(keyEvent('Enter', { shiftKey: true }), 'Enter')).toBe(false)
    expect(matchesAccelerator(keyEvent('Enter', { ctrlKey: true }), 'Enter')).toBe(false)
  })

  it('treats CmdOrCtrl as either ctrl or meta', () => {
    expect(matchesAccelerator(keyEvent('Enter', { ctrlKey: true }), 'CmdOrCtrl+Enter')).toBe(true)
    expect(matchesAccelerator(keyEvent('Enter', { metaKey: true }), 'CmdOrCtrl+Enter')).toBe(true)
    expect(matchesAccelerator(keyEvent('Enter'), 'CmdOrCtrl+Enter')).toBe(false)
  })

  it('requires exact shift/alt state', () => {
    expect(matchesAccelerator(keyEvent('Enter', { ctrlKey: true, shiftKey: true }), 'CmdOrCtrl+Shift+Enter')).toBe(true)
    expect(matchesAccelerator(keyEvent('Enter', { ctrlKey: true }), 'CmdOrCtrl+Shift+Enter')).toBe(false)
    expect(matchesAccelerator(keyEvent('k', { metaKey: true }), 'CmdOrCtrl+K')).toBe(true)
  })

  it('rejects modifier-only accelerators', () => {
    expect(matchesAccelerator(keyEvent('Control', { ctrlKey: true }), 'Ctrl')).toBe(false)
  })
})

describe('formatAccelerator', () => {
  it('formats for Windows/Linux and macOS', () => {
    expect(formatAccelerator('CmdOrCtrl+Enter', false)).toBe('Ctrl+Enter')
    expect(formatAccelerator('CmdOrCtrl+K', false)).toBe('Ctrl+K')
    expect(formatAccelerator('CmdOrCtrl+Enter', true)).toBe('⌘Enter')
    expect(formatAccelerator('Shift+Alt+Esc', true)).toBe('⌥⇧Esc')
    expect(formatAccelerator('', false)).toBe('')
  })
})

describe('captureAccelerator', () => {
  it('captures modifier combinations as config strings', () => {
    expect(captureAccelerator(keyEvent('Enter', { ctrlKey: true }))).toBe('CmdOrCtrl+Enter')
    expect(captureAccelerator(keyEvent('k', { metaKey: true, shiftKey: true }))).toBe('CmdOrCtrl+Shift+K')
    expect(captureAccelerator(keyEvent('Enter'))).toBe('Enter')
    expect(captureAccelerator(keyEvent(' '))).toBe('Space')
  })

  it('ignores modifier-only keydown events', () => {
    expect(captureAccelerator(keyEvent('Shift', { shiftKey: true }))).toBeNull()
    expect(captureAccelerator(keyEvent('Control', { ctrlKey: true }))).toBeNull()
  })
})
