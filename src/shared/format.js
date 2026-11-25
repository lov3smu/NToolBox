const SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

export function formatBytes(bytes, options = {}) {
  const { decimals = 2, trimZeros = false, zero = '0 B' } = options
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return zero
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
    value /= 1024
    unitIndex++
  }
  let text = unitIndex === 0 ? String(Math.round(value)) : value.toFixed(decimals)
  if (trimZeros && text.includes('.')) text = text.replace(/0+$/, '').replace(/\.$/, '')
  return `${text} ${SIZE_UNITS[unitIndex]}`
}

export function formatDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatDurationMs(ms) {
  const value = Math.max(0, Number(ms) || 0)
  if (value < 1000) return `${Math.round(value)}ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.floor(value / 60000)}m${Math.round((value % 60000) / 1000)}s`
}
