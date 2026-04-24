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