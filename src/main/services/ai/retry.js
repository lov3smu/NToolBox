const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])
const RETRYABLE_NETWORK_CODES = new Set([
  'ETIMEDOUT',
  'ESOCKETTIMEDOUT',
  'ECONNRESET',
  'EPIPE',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ECONNABORTED'
])
const NON_RETRYABLE_NETWORK_CODES = new Set(['ENOTFOUND', 'ECONNREFUSED', 'ERR_INVALID_URL'])

export const RETRY_DEFAULTS = {
  retries: 2,
  baseDelay: 800,
  maxDelay: 8000
}

export function isRetryableStatus(statusCode) {
  return RETRYABLE_STATUS.has(Number(statusCode))
}

export function isRetryableNetworkCode(code) {
  if (!code) return false
  if (NON_RETRYABLE_NETWORK_CODES.has(code)) return false
  return RETRYABLE_NETWORK_CODES.has(code)
}

export function computeRetryDelay(attempt, baseDelay = RETRY_DEFAULTS.baseDelay, maxDelay = RETRY_DEFAULTS.maxDelay) {
  const exponent = Math.max(1, Number(attempt) || 1) - 1
  return Math.min(maxDelay, baseDelay * 2 ** exponent)
}

export function waitForDelay(delay, shouldStop) {
  return new Promise((resolve) => {
    const deadline = Date.now() + delay
    const tick = () => {
      if (typeof shouldStop === 'function' && shouldStop()) {
        resolve(false)
        return
      }
      if (Date.now() >= deadline) {
        resolve(true)
        return
      }
      setTimeout(tick, Math.min(100, deadline - Date.now()))
    }
    tick()
  })
}

export async function withRetry(task, options = {}) {
  const retries = Number.isInteger(options.retries) ? Math.max(0, options.retries) : RETRY_DEFAULTS.retries
  const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : () => false
  let last = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (shouldStop()) {
      return { success: false, cancelled: true, error: '已停止' }
    }

    try {
      const result = await task(attempt)
      if (!result || result.retryable !== true || attempt >= retries) return result
      last = result
    } catch (error) {
      last = {
        success: false,
        error: error?.message || String(error),
        retryable: true
      }
      if (attempt >= retries) return last
    }

    if (shouldStop()) {
      return { success: false, cancelled: true, error: '已停止' }
    }

    const delay = computeRetryDelay(attempt + 1, options.baseDelay, options.maxDelay)
    if (typeof options.onRetry === 'function') {
      options.onRetry({ attempt: attempt + 1, retries, delay, error: last?.error || '' })
    }
    const canContinue = await waitForDelay(delay, shouldStop)
    if (!canContinue) {
      return { success: false, cancelled: true, error: '已停止' }
    }
  }

  return last || { success: false, error: '请求失败' }
}
