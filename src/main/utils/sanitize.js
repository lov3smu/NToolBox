import path from 'path'
import fs from 'fs'

export function escapeSql(str) {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\x00/g, '')
    .replace(/\x1a/g, '')
}

export function isValidIdentifier(name) {
  if (!name || typeof name !== 'string') return false
  if (name.length > 64) return false
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

export function escapeIdentifier(name) {
  if (!name) return '``'
  if (!isValidIdentifier(name)) {
    name = name.replace(/[^\w]/g, '_')
  }
  return '`' + name.replace(/`/g, '``') + '`'
}

export function sanitizePathSegment(segment) {
  if (!segment || typeof segment !== 'string') return ''
  return segment
    .replace(/\.\./g, '')
    .replace(/[/\\:*?"<>|]/g, '_')
    .trim()
}

export async function isPathWithinBase(targetPath, basePath) {
  try {
    const resolvedTarget = await fs.promises.realpath(targetPath)
    const resolvedBase = await fs.promises.realpath(basePath)
    return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase
  } catch {
    return false
  }
}

export function sanitizeInput(input, maxLength = 1000) {
  if (!input || typeof input !== 'string') return ''
  if (input.length > maxLength) {
    input = input.slice(0, maxLength)
  }
  return input.trim()
}

export function normalizeDirNameWithDate(dirName, date) {
  if (!dirName || typeof dirName !== 'string') return ''

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const currentDatePrefix = `${month}${day}`

  const dashIndex = dirName.indexOf('-')
  if (dashIndex === -1) {
    return `${currentDatePrefix}-${dirName}`
  }

  const prefix = dirName.slice(0, dashIndex)

  if (/^\d{4}$/.test(prefix)) {
    const mm = parseInt(prefix.slice(0, 2), 10)
    const dd = parseInt(prefix.slice(2, 4), 10)
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return dirName
    }
  }

  return `${currentDatePrefix}-${dirName}`
}
