const MODIFIER_ALIASES = {
  cmdorctrl: 'mod',
  command: 'mod',
  cmd: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  shift: 'shift'
}

const KEY_ALIASES = {
  esc: 'escape',
  return: 'enter',
  spacebar: 'space',
  del: 'delete',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright'
}

const MODIFIER_KEYS = new Set(['control', 'meta', 'alt', 'shift', 'os', 'altgraph'])

const NAMED_KEY_LABELS = {
  enter: 'Enter',
  escape: 'Esc',
  space: 'Space',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown'
}

export function normalizeKeyName(key) {
  if (typeof key !== 'string' || !key) return ''
  const lower = key.toLowerCase()
  if (lower === ' ' || lower === 'space') return 'space'
  return KEY_ALIASES[lower] || lower
}

export function parseAccelerator(accelerator) {
  if (typeof accelerator !== 'string' || !accelerator.trim()) return null
  const parsed = { mod: false, ctrl: false, alt: false, shift: false, key: '' }
  for (const rawPart of accelerator.split('+')) {
    const part = rawPart.trim()
    if (!part) continue
    const modifier = MODIFIER_ALIASES[part.toLowerCase()]
    if (modifier) {
      parsed[modifier] = true
    } else {
      parsed.key = normalizeKeyName(part)
    }
  }
  return parsed.key ? parsed : null
}

export function matchesAccelerator(event, accelerator) {
  const parsed = parseAccelerator(accelerator)
  if (!parsed || !event) return false
  const hasCtrl = Boolean(event.ctrlKey)
  const hasMeta = Boolean(event.metaKey)
  const hasMod = hasCtrl || hasMeta
  if (parsed.mod) {
    if (!hasMod) return false
  } else if (parsed.ctrl) {
    if (!hasCtrl) return false
  } else if (hasMod) {
    return false
  }
  if (parsed.alt !== Boolean(event.altKey)) return false
  if (parsed.shift !== Boolean(event.shiftKey)) return false
  return normalizeKeyName(event.key) === parsed.key
}

export function formatAccelerator(accelerator, isMac) {
  const parsed = parseAccelerator(accelerator)
  if (!parsed) return ''
  const modifiers = []
  if (isMac) {
    if (parsed.ctrl) modifiers.push('⌃')
    if (parsed.alt) modifiers.push('⌥')
    if (parsed.shift) modifiers.push('⇧')
    if (parsed.mod) modifiers.push('⌘')
  } else {
    if (parsed.mod) modifiers.push('Ctrl')
    if (parsed.ctrl) modifiers.push('Ctrl')
    if (parsed.alt) modifiers.push('Alt')
    if (parsed.shift) modifiers.push('Shift')
  }
  let label = NAMED_KEY_LABELS[parsed.key]
  if (!label) label = parsed.key === 'space' ? 'Space' : parsed.key.toUpperCase()
  return [...modifiers, label].join(isMac ? '' : '+')
}

export function captureAccelerator(event) {
  if (!event || typeof event.key !== 'string') return null
  const raw = event.key
  if (MODIFIER_KEYS.has(raw.toLowerCase())) return null
  const key = normalizeKeyName(raw)
  if (!key) return null
  const parts = []
  if (event.ctrlKey || event.metaKey) parts.push('CmdOrCtrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  let label = NAMED_KEY_LABELS[key]
  if (!label) label = key === 'space' ? 'Space' : raw.length === 1 ? raw.toUpperCase() : raw
  parts.push(label)
  return parts.join('+')
}
