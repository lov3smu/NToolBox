import path from 'path'

const MAX_GRANTED_PATHS = 64
const grantedPaths = new Set()

export function grantFilePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return
  const resolved = path.resolve(filePath)
  grantedPaths.delete(resolved)
  grantedPaths.add(resolved)
  while (grantedPaths.size > MAX_GRANTED_PATHS) {
    grantedPaths.delete(grantedPaths.values().next().value)
  }
}

export function isFilePathGranted(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return false
  return grantedPaths.has(path.resolve(filePath))
}

export function resetFileAccessGrants() {
  grantedPaths.clear()
}
