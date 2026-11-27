export const HTTP_METHODS = Object.freeze(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

export const HTTP_DEFAULT_TIMEOUT_MS = 30000
export const HTTP_MIN_TIMEOUT_MS = 1000
export const HTTP_MAX_TIMEOUT_MS = 120000
export const HTTP_MAX_HEADERS = 64
export const HTTP_MAX_BODY_LENGTH = 1024 * 1024
export const HTTP_MAX_RESPONSE_BYTES = 2 * 1024 * 1024

export const HTTP_ERROR_CODES = Object.freeze({
  METHOD: 'invalid-method',
  URL: 'invalid-url',
  HEADERS: 'invalid-headers',
  HEADERS_TOO_MANY: 'headers-too-many',
  TIMEOUT: 'invalid-timeout',
  BODY: 'body-too-large'
})

export function parseHeaderLines(lines) {
  const source = typeof lines === 'string' ? lines : ''
  const headers = {}
  let count = 0
  const entries = source.split(/\r?\n/)
  for (let index = 0; index < entries.length; index += 1) {
    const line = entries[index].trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator <= 0) return { ok: false, error: HTTP_ERROR_CODES.HEADERS, line: index + 1 }
    const name = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!name) return { ok: false, error: HTTP_ERROR_CODES.HEADERS, line: index + 1 }
    count += 1
    if (count > HTTP_MAX_HEADERS) return { ok: false, error: HTTP_ERROR_CODES.HEADERS_TOO_MANY }
    headers[name] = value
  }
  return { ok: true, headers }
}

function normalizeTimeout(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return HTTP_DEFAULT_TIMEOUT_MS
  return Math.min(HTTP_MAX_TIMEOUT_MS, Math.max(HTTP_MIN_TIMEOUT_MS, Math.round(num)))
}

export function normalizeHttpRequest(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: HTTP_ERROR_CODES.URL }

  const method = String(raw.method || 'GET').toUpperCase()
  if (!HTTP_METHODS.includes(method)) return { ok: false, error: HTTP_ERROR_CODES.METHOD }

  const urlText = typeof raw.url === 'string' ? raw.url.trim() : ''
  let parsed
  try {
    parsed = new URL(urlText)
  } catch {
    return { ok: false, error: HTTP_ERROR_CODES.URL }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: HTTP_ERROR_CODES.URL }
  }

  const headers = {}
  if (raw.headers && typeof raw.headers === 'object') {
    const entries = Object.entries(raw.headers)
    if (entries.length > HTTP_MAX_HEADERS) return { ok: false, error: HTTP_ERROR_CODES.HEADERS_TOO_MANY }
    for (const [name, value] of entries) {
      const key = String(name).trim()
      if (!key) return { ok: false, error: HTTP_ERROR_CODES.HEADERS }
      headers[key] = String(value ?? '')
    }
  }

  let body = typeof raw.body === 'string' ? raw.body : ''
  if (method === 'GET' || method === 'HEAD') body = ''
  if (body.length > HTTP_MAX_BODY_LENGTH) return { ok: false, error: HTTP_ERROR_CODES.BODY }

  return {
    ok: true,
    request: {
      method,
      url: parsed.toString(),
      headers,
      body,
      timeoutMs: normalizeTimeout(raw.timeoutMs)
    }
  }
}
