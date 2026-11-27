export const CODEC_MODES = Object.freeze([
  { id: 'base64', label: 'Base64' },
  { id: 'url', label: 'URL 编码' },
  { id: 'html', label: 'HTML 实体' },
  { id: 'unicode', label: 'Unicode 转义' },
  { id: 'hex', label: '十六进制' },
  { id: 'json', label: 'JSON 字符串' }
])

export const CODEC_DIRECTIONS = Object.freeze([
  { id: 'encode', label: '编码' },
  { id: 'decode', label: '解码' }
])

const HTML_ESCAPES = Object.freeze([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;']
])

const HTML_ENTITIES = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0'
})

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

function base64ToBytes(value) {
  const compact = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = compact + '='.repeat((4 - (compact.length % 4)) % 4)
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(padded)) return null
  let binary
  try {
    binary = globalThis.atob(padded)
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function decodeUtf8(bytes) {
  try {
    return { ok: true, value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  } catch {
    return { ok: false, error: 'invalid-utf8' }
  }
}

function encodeHtml(text) {
  let result = text
  for (const [char, entity] of HTML_ESCAPES) result = result.split(char).join(entity)
  return result
}

function decodeHtml(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match
      try {
        return String.fromCodePoint(code)
      } catch {
        return match
      }
    }
    return Object.prototype.hasOwnProperty.call(HTML_ENTITIES, body) ? HTML_ENTITIES[body] : match
  })
}

function encodeUnicode(text) {
  let result = ''
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code <= 0x7e) {
      result += char
    } else if (code > 0xffff) {
      for (let i = 0; i < char.length; i += 1) {
        result += `\\u${char.charCodeAt(i).toString(16).padStart(4, '0')}`
      }
    } else {
      result += `\\u${code.toString(16).padStart(4, '0')}`
    }
  }
  return result
}

function decodeUnicode(text) {
  return text.replace(/\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})/g, (match, braced, plain) => {
    const code = Number.parseInt(braced || plain, 16)
    if (!Number.isFinite(code) || code > 0x10ffff) return match
    try {
      return String.fromCodePoint(code)
    } catch {
      return match
    }
  })
}

function encodeHex(text) {
  return Array.from(new TextEncoder().encode(text), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function decodeHex(text) {
  const compact = text.replace(/\s+/g, '')
  if (compact.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(compact)) {
    return { ok: false, error: 'invalid-hex' }
  }
  const bytes = new Uint8Array(compact.length / 2)
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Number.parseInt(compact.slice(i * 2, i * 2 + 2), 16)
  return decodeUtf8(bytes)
}

function encodeJsonString(text) {
  return JSON.stringify(text).slice(1, -1)
}

function decodeJsonString(text) {
  let source = text.trim()
  if (source.startsWith('"') && source.endsWith('"') && source.length >= 2) source = source.slice(1, -1)
  try {
    const value = JSON.parse(`"${source}"`)
    return { ok: true, value: typeof value === 'string' ? value : String(value) }
  } catch {
    return { ok: false, error: 'invalid-json' }
  }
}

export const CODEC_MAX_CHAIN_STEPS = 8

export function transformCodec(mode, direction, text) {
  const source = typeof text === 'string' ? text : ''
  const decode = direction === 'decode'

  if (mode === 'base64') {
    if (!decode) return { ok: true, value: bytesToBase64(new TextEncoder().encode(source)) }
    const bytes = base64ToBytes(source)
    if (!bytes) return { ok: false, error: 'invalid-base64' }
    return decodeUtf8(bytes)
  }

  if (mode === 'url') {
    try {
      return { ok: true, value: decode ? decodeURIComponent(source) : encodeURIComponent(source) }
    } catch {
      return { ok: false, error: 'invalid-url' }
    }
  }

  if (mode === 'html') {
    return { ok: true, value: decode ? decodeHtml(source) : encodeHtml(source) }
  }

  if (mode === 'unicode') {
    return { ok: true, value: decode ? decodeUnicode(source) : encodeUnicode(source) }
  }

  if (mode === 'hex') {
    if (!decode) return { ok: true, value: encodeHex(source) }
    return decodeHex(source)
  }

  if (mode === 'json') {
    return decode ? decodeJsonString(source) : { ok: true, value: encodeJsonString(source) }
  }

  return { ok: false, error: 'unsupported-mode' }
}

export function applyCodecChain(steps, text) {
  let value = typeof text === 'string' ? text : ''
  if (!Array.isArray(steps) || steps.length === 0) return { ok: true, value }
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index] || {}
    const result = transformCodec(step.mode, step.direction === 'decode' ? 'decode' : 'encode', value)
    if (!result.ok) return { ok: false, error: result.error, stepIndex: index }
    value = result.value
  }
  return { ok: true, value }
}
