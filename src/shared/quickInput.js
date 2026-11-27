export const QUICK_INPUT_MAX_CHARS = 262144

export const QUICK_INPUT_KINDS = Object.freeze({
  JSON: 'json',
  SQL: 'sql',
  JWT: 'jwt',
  URL: 'url',
  TIMESTAMP: 'timestamp',
  COLOR: 'color',
  BASE64: 'base64',
  URL_ENCODED: 'urlencoded'
})

const HEX_COLOR = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB_COLOR = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*(?:[,/]\s*([01]?(?:\.\d+)?)\s*)?\)$/i
const HSL_COLOR =
  /^hsla?\(\s*(-?\d{1,3}(?:\.\d+)?)(?:deg)?\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%\s*[, ]\s*(\d{1,3}(?:\.\d+)?)%\s*(?:[,/]\s*([01]?(?:\.\d+)?)\s*)?\)$/i
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/
const SQL_START =
  /^(select|insert|update|delete|replace|create|alter|drop|truncate|with|show|describe|desc|explain|use|grant|revoke|call|set)\b/i

export function detectQuickInput(raw, now = Date.now()) {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text || text.length > QUICK_INPUT_MAX_CHARS) return null

  return (
    detectColor(text) ||
    detectTimestamp(text, now) ||
    detectJwt(text, now) ||
    detectUrl(text) ||
    detectJson(text) ||
    detectSql(text) ||
    detectBase64(text) ||
    detectUrlEncoded(text)
  )
}

function clampByte(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.min(255, Math.max(0, Math.round(number)))
}

function clampAlpha(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 1
  return Math.min(1, Math.max(0, number))
}

function toHex(value) {
  return clampByte(value).toString(16).padStart(2, '0')
}

function rgbToHex({ r, g, b, a }) {
  const base = `#${toHex(r)}${toHex(g)}${toHex(b)}`
  return a < 1 ? `${base}${toHex(a * 255)}` : base
}

function rgbToHsl({ r, g, b }) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: Math.round(lightness * 100) }
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue
  if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6
  else if (max === green) hue = ((blue - red) / delta + 2) / 6
  else hue = ((red - green) / delta + 4) / 6
  return { h: Math.round(hue * 360), s: Math.round(saturation * 100), l: Math.round(lightness * 100) }
}

function hslToRgb({ h, s, l }) {
  const hue = (((h % 360) + 360) % 360) / 360
  const saturation = Math.min(100, Math.max(0, s)) / 100
  const lightness = Math.min(100, Math.max(0, l)) / 100
  if (saturation === 0) {
    const value = Math.round(lightness * 255)
    return { r: value, g: value, b: value }
  }
  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
  const p = 2 * lightness - q
  const channel = (offset) => {
    let value = offset
    if (value < 0) value += 1
    if (value > 1) value -= 1
    if (value < 1 / 6) return p + (q - p) * 6 * value
    if (value < 1 / 2) return q
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6
    return p
  }
  return {
    r: Math.round(channel(hue + 1 / 3) * 255),
    g: Math.round(channel(hue) * 255),
    b: Math.round(channel(hue - 1 / 3) * 255)
  }
}

function buildColorResult({ r, g, b, a = 1, size = 0 }) {
  const rgb = { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clampAlpha(a) }
  const hsl = rgbToHsl(rgb)
  const hex = rgbToHex(rgb)
  return {
    kind: QUICK_INPUT_KINDS.COLOR,
    size,
    copyText: hex,
    send: null,
    payload: {
      hex,
      rgb: rgb.a < 1 ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${rgb.a})` : `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      hsl: hsl.s === 0 ? `hsl(0, 0%, ${hsl.l}%)` : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      alpha: rgb.a
    }
  }
}

function detectColor(text) {
  const hexMatch = text.match(HEX_COLOR)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((char) => char + char)
        .join('')
    }
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    return buildColorResult({ r, g, b, a, size: text.length })
  }

  const rgbMatch = text.match(RGB_COLOR)
  if (rgbMatch) {
    const channels = [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(Number)
    if (channels.some((channel) => channel > 255)) return null
    const alpha = rgbMatch[4] === undefined ? 1 : clampAlpha(rgbMatch[4])
    return buildColorResult({
      r: channels[0],
      g: channels[1],
      b: channels[2],
      a: alpha,
      size: text.length
    })
  }

  const hslMatch = text.match(HSL_COLOR)
  if (hslMatch) {
    const rgb = hslToRgb({ h: Number(hslMatch[1]), s: Number(hslMatch[2]), l: Number(hslMatch[3]) })
    const alpha = hslMatch[4] === undefined ? 1 : clampAlpha(hslMatch[4])
    return buildColorResult({ ...rgb, a: alpha, size: text.length })
  }

  return null
}

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatLocal(epochMs) {
  const date = new Date(epochMs)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}

function detectTimestamp(text, now) {
  if (!/^\d{10}$|^\d{13}$/.test(text)) return null
  const epochMs = text.length === 10 ? Number(text) * 1000 : Number(text)
  // 限定在 2000-2100 年之间，避免把普通数字误判为时间戳
  if (epochMs < 946684800000 || epochMs > 4102444800000) return null
  return {
    kind: QUICK_INPUT_KINDS.TIMESTAMP,
    size: text.length,
    copyText: new Date(epochMs).toISOString(),
    send: { path: '/unixtimestamp', text, title: 'Timestamp' },
    payload: {
      unit: text.length === 10 ? 'seconds' : 'milliseconds',
      epochMs,
      iso: new Date(epochMs).toISOString(),
      local: formatLocal(epochMs),
      skewMs: Math.abs(now - epochMs)
    }
  }
}

function decodeBase64Url(segment) {
  if (!segment) return ''
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  try {
    const binary = globalThis.atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return ''
  }
}

function detectJwt(text, now) {
  if (text.length > 8192 || !JWT_PATTERN.test(text)) return null
  const [headerPart, payloadPart] = text.split('.')
  let header
  let claims
  try {
    header = JSON.parse(decodeBase64Url(headerPart))
    claims = JSON.parse(decodeBase64Url(payloadPart))
  } catch {
    return null
  }
  if (!header || typeof header !== 'object' || typeof header.alg !== 'string') return null
  if (!claims || typeof claims !== 'object') return null

  const expiresAt = typeof claims.exp === 'number' ? claims.exp * 1000 : null
  const formatted = JSON.stringify(claims, null, 2)
  return {
    kind: QUICK_INPUT_KINDS.JWT,
    size: text.length,
    copyText: formatted,
    send: { path: '/json-parser', text: formatted, title: 'JWT Payload' },
    payload: {
      algorithm: header.alg,
      type: typeof header.typ === 'string' ? header.typ : '',
      expired: expiresAt === null ? null : expiresAt <= now,
      expiresAt: expiresAt === null ? '' : new Date(expiresAt).toISOString(),
      claimCount: Object.keys(claims).length,
      claims
    }
  }
}

function detectUrl(text) {
  if (/\s/.test(text) || text.length > 4096) return null
  let parsed
  try {
    parsed = new URL(text)
  } catch {
    return null
  }
  if (!/^https?:$/.test(parsed.protocol)) return null
  return {
    kind: QUICK_INPUT_KINDS.URL,
    size: text.length,
    copyText: text,
    send: { path: '/http-client', text, title: parsed.host },
    payload: {
      protocol: parsed.protocol.replace(':', ''),
      host: parsed.host,
      path: parsed.pathname || '/',
      params: Array.from(parsed.searchParams.keys()).length,
      hash: parsed.hash.replace(/^#/, '')
    }
  }
}

function detectJson(text) {
  const first = text[0]
  const last = text[text.length - 1]
  if (!((first === '{' && last === '}') || (first === '[' && last === ']'))) return null

  let valid = true
  let value
  try {
    value = JSON.parse(text)
  } catch {
    valid = false
  }

  const payload = { valid }
  if (valid && value && typeof value === 'object') {
    payload.type = Array.isArray(value) ? 'array' : 'object'
    payload.count = Array.isArray(value) ? value.length : Object.keys(value).length
  } else if (valid) {
    payload.type = value === null ? 'null' : typeof value
    payload.count = 0
  }

  return {
    kind: QUICK_INPUT_KINDS.JSON,
    size: text.length,
    copyText: text,
    send: { path: '/json-parser', text, title: 'JSON' },
    payload
  }
}

function detectSql(text) {
  const match = text.match(SQL_START)
  if (!match) return null
  const rest = text.slice(match[0].length).trim()
  if (!rest) return null
  return {
    kind: QUICK_INPUT_KINDS.SQL,
    size: text.length,
    copyText: text,
    send: null,
    payload: {
      statement: match[1].toUpperCase(),
      lines: text.split(/\r?\n/).length,
      hasComment: /(--|\/\*)/.test(text)
    }
  }
}

const BASE64_TEXT = /^[A-Za-z0-9+/_-]+={0,2}$/
const URL_ENCODED_SEQUENCE = /%[0-9A-Fa-f]{2}/
const QUICK_DECODE_MAX = 8192

function isPlainText(value) {
  for (const char of value) {
    const code = char.codePointAt(0)
    if (code === 9 || code === 10 || code === 13) continue
    if (code < 32 || code === 127) return false
  }
  return true
}

function jsonObjectOrNull(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? value : null
  } catch {
    return null
  }
}

function detectBase64(text) {
  if (text.length < 8 || text.length > QUICK_DECODE_MAX) return null
  if (!BASE64_TEXT.test(text)) return null

  const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
  if (normalized.length % 4 === 1) return null
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  let decoded
  try {
    const binary = globalThis.atob(padded)
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
  if (decoded.length < 4 || !isPlainText(decoded) || decoded.trim() === text) return null

  const json = jsonObjectOrNull(decoded.trim())
  return {
    kind: QUICK_INPUT_KINDS.BASE64,
    size: text.length,
    copyText: decoded,
    send: json ? { path: '/json-parser', text: json, title: 'Base64 JSON' } : null,
    payload: { decoded, preview: decoded.slice(0, 300) }
  }
}

function detectUrlEncoded(text) {
  if (text.length < 4 || text.length > QUICK_DECODE_MAX) return null
  if (!URL_ENCODED_SEQUENCE.test(text)) return null
  let decoded
  try {
    decoded = decodeURIComponent(text)
  } catch {
    return null
  }
  if (!decoded || decoded === text || !isPlainText(decoded)) return null

  const json = jsonObjectOrNull(decoded.trim())
  return {
    kind: QUICK_INPUT_KINDS.URL_ENCODED,
    size: text.length,
    copyText: decoded,
    send: json ? { path: '/json-parser', text: json, title: 'URL-encoded JSON' } : null,
    payload: { decoded, preview: decoded.slice(0, 300) }
  }
}
