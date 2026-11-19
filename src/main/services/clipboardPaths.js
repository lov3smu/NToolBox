import path from 'node:path'
import { fileURLToPath } from 'node:url'

const IMAGE_FILE_PATTERN = /\.(png|jpe?g|gif|webp|bmp|ico|avif|tiff?)$/i

function stripQuotes(value) {
  return value
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
}

export function normalizeClipboardPath(value) {
  if (typeof value !== 'string') return ''
  const trimmed = stripQuotes(value)
  if (!trimmed) return ''

  if (trimmed.startsWith('file:')) {
    try {
      const url = new URL(trimmed)
      if (!url.pathname || url.pathname === '/') return ''
      return fileURLToPath(url)
    } catch {
      return ''
    }
  }

  return trimmed
}

export function imageFilePathsFromText(text, limit = 20) {
  if (typeof text !== 'string' || !text) return []

  const paths = []
  const seen = new Set()

  for (const line of text.split(/\r?\n/, limit)) {
    const filePath = normalizeClipboardPath(line)
    if (!filePath || !IMAGE_FILE_PATTERN.test(filePath) || !path.isAbsolute(filePath)) continue
    if (seen.has(filePath)) continue
    seen.add(filePath)
    paths.push(filePath)
  }

  return paths
}
