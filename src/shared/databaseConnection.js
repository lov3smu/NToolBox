import { normalizeDatabaseEngine } from './databaseEngines.js'

// 由保存的连接配置生成主进程 createConnection 所需参数；渲染进程与 CLI 伴生共用。
// forceReadOnly 用于 CLI：即使保存的连接可写，也只建立只读连接。
export function buildConnectionConfig(source, options = {}) {
  const input = source && typeof source === 'object' ? source : {}
  const engine = normalizeDatabaseEngine(input.engine)
  const config = {
    engine,
    host: input.host,
    port: input.port,
    user: input.user,
    password: input.password,
    database: input.database || '',
    schema: input.schema || '',
    filePath: input.filePath || ''
  }

  if (engine === 'sqlite') {
    if (options.forceReadOnly) config.readOnly = true
    return config
  }

  config.ssh = { ...(input.ssh || {}) }
  config.ssl = { ...(input.ssl || {}) }

  if (input.charset) config.charset = input.charset
  if (input.enableKeepAlive) config.keepAliveInterval = input.keepAliveInterval
  if (input.enableConnectTimeout) config.connectTimeout = input.connectTimeout
  if (input.enableReadTimeout) config.readTimeout = input.readTimeout
  if (input.enableWriteTimeout) config.writeTimeout = input.writeTimeout
  if (input.readOnly || options.forceReadOnly) config.readOnly = true

  return config
}
