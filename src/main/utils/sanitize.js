import path from 'path'

export function escapeSql(str) {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '')
}

export function isValidIdentifier(name) {
  if (!name || typeof name !== 'string') return false
  return /^[a-zA-Z0-9_]+$/.test(name)
}

export function escapeIdentifier(name) {
  if (!name) return '``'
  return '`' + name.replace(/`/g, '``') + '`'
}

export function sanitizePathSegment(segment) {
  if (!segment || typeof segment !== 'string') return ''
  return segment
    .replace(/\.\./g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .trim()
}

export function isPathWithinBase(targetPath, basePath) {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(basePath)
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase
}