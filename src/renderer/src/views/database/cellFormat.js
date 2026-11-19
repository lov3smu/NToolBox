import { t } from '@/i18n'
const BINARY_COLUMN_PATTERN = /blob|binary|\bbit\b|geometry|point|linestring|polygon/i
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}:\d{2}/
const JSON_PREVIEW_LIMIT = 160
const BINARY_DUMP_LIMIT = 16 * 1024

export function isBinaryColumn(dataType) {
  return BINARY_COLUMN_PATTERN.test(String(dataType || ''))
}

export function isBinaryValue(value) {
  if (!value || typeof value !== 'object') return false
  if (value instanceof Uint8Array) return true
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return true
  if (Array.isArray(value)) return false
  return value.type === 'Buffer' && Array.isArray(value.data)
}

export function binaryByteLength(value) {
  if (!isBinaryValue(value)) return 0
  if (value instanceof Uint8Array) return value.byteLength
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return value.byteLength
  return value.data.length
}

export function toByteArray(value) {
  if (value instanceof Uint8Array) return value
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return new Uint8Array(value)
  if (value?.type === 'Buffer' && Array.isArray(value.data)) return Uint8Array.from(value.data)
  return new Uint8Array(0)
}

export function formatBytes(bytes) {
  const size = Number(bytes)
  if (!Number.isFinite(size) || size <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  const text = unitIndex === 0 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '')
  return `${text} ${units[unitIndex]}`
}

function formatClockDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function safeJson(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function formatBinaryPreview(value) {
  return t('[二进制 {p0}]', { p0: formatBytes(binaryByteLength(value)) })
}

export function formatJsonPreview(value, maxLength = JSON_PREVIEW_LIMIT) {
  const text = safeJson(value)
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

export function formatCellText(value) {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (isBinaryValue(value)) return formatBinaryPreview(value)
  if (value instanceof Date) return formatClockDate(value)
  if (typeof value === 'string') {
    if (DATE_TIME_PATTERN.test(value)) {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime())) return formatClockDate(date)
    }
    return value
  }
  if (typeof value === 'object') return formatJsonPreview(value)
  return String(value)
}

export function formatCellInput(value) {
  if (value === null || value === undefined) return ''
  if (isBinaryValue(value)) return ''
  if (value instanceof Date) return formatClockDate(value)
  if (typeof value === 'object') return safeJson(value)
  return String(value)
}

export function formatBinaryDump(value, maxBytes = BINARY_DUMP_LIMIT) {
  const bytes = toByteArray(value)
  if (!bytes.length) return t('(空二进制)')
  const limit = Math.min(bytes.length, maxBytes)
  const lines = []
  for (let offset = 0; offset < limit; offset += 16) {
    const chunk = bytes.subarray(offset, Math.min(offset + 16, limit))
    const hex = Array.from(chunk, (byte) => byte.toString(16).padStart(2, '0'))
      .join(' ')
      .padEnd(47, ' ')
    const ascii = Array.from(chunk, (byte) => (byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.')).join('')
    lines.push(`${offset.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`)
  }
  if (bytes.length > limit) {
    lines.push(t('… 已截断，共 {p0}', { p0: formatBytes(bytes.length) }))
  }
  return lines.join('\n')
}

export function formatCellViewerText(value) {
  if (value === null) return 'NULL'
  if (value === undefined) return ''
  if (isBinaryValue(value)) return formatBinaryDump(value)
  if (typeof value === 'object' && !(value instanceof Date)) {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const text = value instanceof Date ? formatClockDate(value) : String(value)
  if (/^[[{]/.test(text.trim())) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }
  return text
}
