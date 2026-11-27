const isDev = Boolean(import.meta.env?.DEV)

export function logError(scope, error) {
  if (isDev) console.error(`[${scope}]`, error)
}

export function logWarn(scope, error) {
  if (isDev) console.warn(`[${scope}]`, error)
}
