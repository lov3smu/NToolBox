export const DATABASE_ENGINES = ['mysql', 'postgres', 'sqlite']

export const DEFAULT_DATABASE_ENGINE = 'mysql'

export const ENGINE_INFO = {
  mysql: { label: 'MySQL', defaultPort: 3306, defaultUser: 'root', fileBased: false },
  postgres: { label: 'PostgreSQL', defaultPort: 5432, defaultUser: 'postgres', fileBased: false },
  sqlite: { label: 'SQLite', defaultPort: 0, defaultUser: '', fileBased: true }
}

const MYSQL_CAPABILITIES = Object.freeze({
  sessions: true,
  serverStatus: true,
  health: true,
  users: true,
  backup: true,
  schemaDiff: true,
  er: true,
  tableDesigner: true,
  createTable: true,
  transfer: true,
  explain: true,
  cancel: true,
  exportData: true,
  routines: true,
  triggers: true,
  events: true
})

const POSTGRES_CAPABILITIES = Object.freeze({
  sessions: true,
  serverStatus: false,
  health: false,
  users: false,
  backup: false,
  schemaDiff: false,
  er: true,
  tableDesigner: false,
  createTable: false,
  transfer: true,
  explain: true,
  cancel: true,
  exportData: true,
  routines: true,
  triggers: true,
  events: false
})

const SQLITE_CAPABILITIES = Object.freeze({
  sessions: false,
  serverStatus: false,
  health: false,
  users: false,
  backup: false,
  schemaDiff: false,
  er: true,
  tableDesigner: false,
  createTable: false,
  transfer: true,
  explain: true,
  cancel: false,
  exportData: true,
  routines: false,
  triggers: true,
  events: false
})

export const ENGINE_CAPABILITIES = {
  mysql: MYSQL_CAPABILITIES,
  postgres: POSTGRES_CAPABILITIES,
  sqlite: SQLITE_CAPABILITIES
}

export function normalizeDatabaseEngine(value) {
  return DATABASE_ENGINES.includes(value) ? value : DEFAULT_DATABASE_ENGINE
}

export function getEngineCapabilities(engine) {
  return ENGINE_CAPABILITIES[normalizeDatabaseEngine(engine)]
}

export function isFileBasedEngine(engine) {
  return ENGINE_INFO[normalizeDatabaseEngine(engine)]?.fileBased === true
}
