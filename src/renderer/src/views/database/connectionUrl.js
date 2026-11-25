import { ENGINE_INFO } from '@shared/databaseEngines'

const PROTOCOL_ENGINES = {
  mysql: 'mysql',
  postgres: 'postgres',
  postgresql: 'postgres',
  sqlite: 'sqlite',
  sqlite3: 'sqlite'
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function parseConnectionUrl(raw) {
  const text = String(raw ?? '').trim()
  if (!text) return null
  let url
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const engine = PROTOCOL_ENGINES[url.protocol.replace(/:$/, '').toLowerCase()]
  if (!engine) return null

  if (engine === 'sqlite') {
    const filePath = safeDecode(url.pathname || '')
    return filePath ? { engine, filePath } : null
  }

  const info = ENGINE_INFO[engine]
  const host = url.hostname ? safeDecode(url.hostname) : ''
  if (!host) return null
  const result = {
    engine,
    host,
    port: Number(url.port) || info.defaultPort
  }
  if (url.username) result.user = safeDecode(url.username)
  if (url.password) result.password = safeDecode(url.password)
  const database = safeDecode(url.pathname.replace(/^\//, ''))
  if (database) result.database = database
  return result
}
