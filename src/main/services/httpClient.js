import { netFetch } from './network.js'
import { t } from './i18n.js'
import { HTTP_MAX_RESPONSE_BYTES, normalizeHttpRequest } from '../../shared/httpClient.js'

const ERROR_MESSAGES = {
  'invalid-method': '请求方法无效',
  'invalid-url': '请输入有效的 http(s) 请求地址',
  'invalid-headers': '请求头格式无效，应为「名称: 值」',
  'headers-too-many': '请求头数量过多',
  'body-too-large': '请求体超过 1 MB 限制',
  'invalid-timeout': '超时时间无效'
}

async function readBody(response) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const text = await response.text()
    const bytes = new TextEncoder().encode(text)
    return {
      text,
      size: bytes.length,
      truncated: bytes.length > HTTP_MAX_RESPONSE_BYTES,
      bytes
    }
  }

  const reader = response.body.getReader()
  const chunks = []
  let size = 0
  let truncated = false
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (size + value.length >= HTTP_MAX_RESPONSE_BYTES) {
      const remaining = HTTP_MAX_RESPONSE_BYTES - size
      if (remaining > 0) chunks.push(value.subarray(0, remaining))
      size += Math.max(remaining, 0)
      truncated = true
      try {
        await reader.cancel()
      } catch {
        // 已读满预算，取消失败不影响结果
      }
      break
    }
    chunks.push(value)
    size += value.length
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return { text: new TextDecoder().decode(bytes), size, truncated, bytes }
}

function resolveErrorMessage(error) {
  const code = ERROR_MESSAGES[error]
  if (!code) return null
  return t(code)
}

export async function sendHttpRequest(raw) {
  const normalized = normalizeHttpRequest(raw)
  if (!normalized.ok) {
    return { success: false, error: resolveErrorMessage(normalized.error) || t('请求参数无效') }
  }

  const { method, url, headers, body, timeoutMs } = normalized.request
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const started = Date.now()

  try {
    const response = await netFetch(url, {
      method,
      headers,
      body: body || undefined,
      signal: controller.signal,
      redirect: 'follow'
    })
    const { text, size, truncated } = await readBody(response)
    const responseHeaders = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: responseHeaders,
      contentType: response.headers.get('content-type') || '',
      body: text,
      size,
      truncated,
      elapsedMs: Date.now() - started,
      url: response.url || url
    }
  } catch (error) {
    const aborted = error?.name === 'AbortError' || /ERR_ABORTED/.test(error?.message || '')
    return {
      success: false,
      status: 0,
      elapsedMs: Date.now() - started,
      error: aborted
        ? t('请求超时（{p0}s）', { p0: Math.round(timeoutMs / 1000) })
        : error?.message || t('网络请求失败')
    }
  } finally {
    clearTimeout(timer)
  }
}
