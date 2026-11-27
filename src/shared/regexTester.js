export const REGEX_FLAG_OPTIONS = Object.freeze([
  { value: 'g', label: '全局 (g)' },
  { value: 'i', label: '忽略大小写 (i)' },
  { value: 'm', label: '多行 (m)' },
  { value: 's', label: '点匹配换行 (s)' },
  { value: 'u', label: 'Unicode (u)' },
  { value: 'y', label: '粘性 (y)' }
])

export const REGEX_ALLOWED_FLAGS = 'gimsuyd'
export const REGEX_MAX_MATCHES = 500
export const REGEX_MAX_TEXT_LENGTH = 100000

function normalizeFlags(flagsInput) {
  const raw = (typeof flagsInput === 'string' ? flagsInput : '').replace(/[^a-z]/gi, '').toLowerCase()
  const unique = []
  for (const flag of raw) {
    if (!REGEX_ALLOWED_FLAGS.includes(flag)) return { ok: false }
    if (!unique.includes(flag)) unique.push(flag)
  }
  if (!unique.includes('g')) unique.push('g')
  if (!unique.includes('d')) unique.push('d')
  return { ok: true, flags: unique.join('') }
}

export function runRegex(pattern, flagsInput, text) {
  if (typeof pattern !== 'string' || pattern === '') {
    return { ok: false, error: 'empty-pattern' }
  }
  const normalized = normalizeFlags(flagsInput)
  if (!normalized.ok) {
    return { ok: false, error: 'invalid-flags' }
  }

  let regex
  try {
    regex = new RegExp(pattern, normalized.flags)
  } catch (error) {
    return { ok: false, error: 'invalid-pattern', detail: error.message }
  }

  const source = (typeof text === 'string' ? text : '').slice(0, REGEX_MAX_TEXT_LENGTH)
  const matches = []
  let truncated = false
  let guard = null

  while (true) {
    const match = regex.exec(source)
    if (!match) break
    if (match[0] === '' && guard !== null && match.index === guard) {
      regex.lastIndex += 1
      continue
    }
    guard = match[0] === '' ? match.index : null
    const indices = match.indices ? match.indices.groups || {} : {}
    const named = {}
    if (match.groups) {
      for (const [name, value] of Object.entries(match.groups)) {
        named[name] = { value, index: indices[name] ? indices[name][0] : null }
      }
    }
    matches.push({
      index: match.index,
      end: match.index + match[0].length,
      value: match[0],
      groups: match.slice(1).map((group) => (group === undefined ? null : group)),
      named
    })
    if (matches.length >= REGEX_MAX_MATCHES) {
      truncated = true
      break
    }
    if (match[0] === '') regex.lastIndex += 1
  }

  return { ok: true, flags: normalized.flags, matches, truncated, textLength: source.length }
}
