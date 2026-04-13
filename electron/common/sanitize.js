const path = require('path')

function escapeSql(str) {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '')
}

function isValidIdentifier(name) {
  if (!name || typeof name !== 'string') return false
  return /^[a-zA-Z0-9_]+$/.test(name)
}

function escapeIdentifier(name) {
  if (!name) return '``'
  return '`' + name.replace(/`/g, '``') + '`'
}

function sanitizePathSegment(segment) {
  if (!segment || typeof segment !== 'string') return ''
  return segment
    .replace(/\.\./g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .trim()
}

function isPathWithinBase(targetPath, basePath) {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(basePath)
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase
}

module.exports = {
  escapeSql,
  isValidIdentifier,
  escapeIdentifier,
  sanitizePathSegment,
  isPathWithinBase,
}