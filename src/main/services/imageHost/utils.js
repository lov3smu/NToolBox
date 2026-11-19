import path from 'path'
import crypto from 'crypto'

export const IMAGE_HOST_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  avif: 'image/avif'
}

export function getImageMime(filePath) {
  if (typeof filePath !== 'string') return ''
  return IMAGE_HOST_MIME[path.extname(filePath).toLowerCase().slice(1)] || ''
}

export function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function sanitizeSegment(segment) {
  return String(segment || '')
    .normalize('NFC')
    .replace(/[\p{Cc}]/gu, '')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80)
}

export function normalizeRemoteDir(dir) {
  if (typeof dir !== 'string') return ''
  return dir
    .split(/[\\/]+/)
    .map((segment) => (segment === '.' || segment === '..' ? '' : sanitizeSegment(segment)))
    .filter(Boolean)
    .join('/')
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('')
}

export function buildRemoteFilename(filePath, { rename = true, now = new Date(), unique } = {}) {
  const ext = path.extname(filePath || '').toLowerCase()
  const baseName = sanitizeSegment(path.basename(filePath || '', ext)) || 'image'
  if (!rename) return `${baseName}${ext}`
  const suffix = unique || crypto.randomBytes(2).toString('hex')
  return `${baseName}-${formatTimestamp(now)}-${suffix}${ext}`
}

export function buildObjectKey(filePath, settings = {}) {
  const dir = normalizeRemoteDir(settings.path)
  const name = buildRemoteFilename(filePath, { rename: settings.rename !== false })
  return dir ? `${dir}/${name}` : name
}

export function encodeKeyPath(key) {
  return String(key || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export function joinUrl(base, key) {
  const trimmed = String(base || '').trim()
  if (!trimmed) return ''
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const root = withScheme.replace(/\/+$/, '')
  const encodedKey = encodeKeyPath(key).replace(/^\/+/, '')
  return encodedKey ? `${root}/${encodedKey}` : root
}

export function toAbsoluteUrl(value, prefix) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  const base = typeof prefix === 'string' ? prefix.trim().replace(/\/+$/, '') : ''
  if (!base) return ''
  return `${base}/${trimmed.replace(/^\/+/, '')}`
}

export function resolveJsonPath(source, expression) {
  if (!expression) return source
  if (source === null || source === undefined) return undefined

  const pathExpression = String(expression)
    .trim()
    .replace(/^\$\.?/, '')
  if (!pathExpression) return source

  const tokens = pathExpression.match(/[^.[\]]+/g) || []
  let current = source
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined
    current = current[token]
  }
  return current
}

export function buildClipboardFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`
  return `clipboard-${stamp}.png`
}
