export function joinPath(base, parts) {
  const separator = base.includes('\\') && !base.includes('/') ? '\\' : '/'
  const root = base.replace(/[\\/]+$/, '')
  return parts.length ? `${root}${separator}${parts.join(separator)}` : root
}
