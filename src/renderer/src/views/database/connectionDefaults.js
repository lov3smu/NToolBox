import { ENGINE_INFO, normalizeDatabaseEngine } from '@shared/databaseEngines'

export function normalizeSsh(raw = {}) {
  return {
    enabled: raw.enabled === true,
    host: raw.host || '',
    port: Number(raw.port) || 22,
    user: raw.user || '',
    keyPath: raw.keyPath || ''
  }
}

export function normalizeSsl(raw = {}) {
  return {
    enabled: raw.enabled === true,
    verify: raw.verify !== false,
    caPath: raw.caPath || ''
  }
}

// 响应式对象的内层仍是 Proxy，直接经 IPC 传递会触发结构化克隆失败
export function toPlainRecord(record) {
  return JSON.parse(JSON.stringify(record ?? {}))
}

export function createDefaultConnection() {
  return {
    name: '',
    group: '',
    color: '',
    engine: 'mysql',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: '',
    schema: '',
    filePath: '',
    savePassword: true,
    charset: '',
    enableKeepAlive: true,
    keepAliveInterval: 240,
    enableConnectTimeout: true,
    connectTimeout: 30,
    enableReadTimeout: false,
    readTimeout: 30,
    enableWriteTimeout: true,
    writeTimeout: 30,
    autoConnect: false,
    readOnly: false,
    ssh: normalizeSsh({}),
    ssl: normalizeSsl({})
  }
}

export function normalizeConnectionRecord(conn = {}) {
  const defaults = createDefaultConnection()
  return {
    ...defaults,
    ...conn,
    engine: normalizeDatabaseEngine(conn.engine),
    color: typeof conn.color === 'string' ? conn.color : '',
    database: conn.database ?? '',
    schema: conn.schema ?? '',
    filePath: conn.filePath ?? '',
    savePassword: conn.savePassword ?? true,
    charset: conn.charset ?? '',
    readOnly: conn.readOnly === true,
    ssh: normalizeSsh(conn.ssh),
    ssl: normalizeSsl(conn.ssl)
  }
}

export function applyEngineDefaults(connection, previousEngine) {
  const previous = ENGINE_INFO[normalizeDatabaseEngine(previousEngine)] || ENGINE_INFO.mysql
  const next = ENGINE_INFO[connection.engine] || ENGINE_INFO.mysql

  if (next.fileBased) {
    connection.host = ''
    connection.port = 0
    connection.user = ''
    connection.password = ''
    connection.ssh.enabled = false
    connection.ssl.enabled = false
  } else {
    if (!connection.host) connection.host = 'localhost'
    if (!Number(connection.port) || Number(connection.port) === previous.defaultPort) {
      connection.port = next.defaultPort
    }
    if (!connection.user || connection.user === previous.defaultUser) connection.user = next.defaultUser
  }

  if (connection.engine !== 'mysql') connection.charset = ''
  return connection
}

function baseConnectionName(conn = {}) {
  const engine = normalizeDatabaseEngine(conn.engine)
  if (engine === 'sqlite') {
    const fileName =
      String(conn.filePath || '')
        .split(/[\\/]/)
        .pop() || ''
    return fileName.replace(/\.(sqlite3?|db3?)$/i, '') || ENGINE_INFO.sqlite.label
  }
  return String(conn.database || '').trim() || String(conn.host || '').trim() || ENGINE_INFO[engine].label
}

export function generateConnectionName(conn, existingNames = []) {
  const base = baseConnectionName(conn)
  const taken = new Set(existingNames.map((name) => String(name)))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base} ${index}`)) index++
  return `${base} ${index}`
}
