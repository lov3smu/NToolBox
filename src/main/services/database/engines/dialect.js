import { normalizeDatabaseEngine } from '../../../../shared/databaseEngines.js'
import { convertQuestionMarksToDollar } from '../../../../shared/sqlPlaceholders.js'

function doubleQuoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function backtickIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``
}

const DIALECTS = {
  mysql: {
    engine: 'mysql',
    quote: backtickIdentifier,
    castText: (column) => `CAST(${column} AS CHAR)`,
    nullSafeEquals: (column) => `${column} <=> ?`,
    likeOperator: 'LIKE',
    convertPlaceholders: (sql) => sql
  },
  postgres: {
    engine: 'postgres',
    quote: doubleQuoteIdentifier,
    castText: (column) => `CAST(${column} AS TEXT)`,
    nullSafeEquals: (column) => `${column} IS NOT DISTINCT FROM ?`,
    likeOperator: 'ILIKE',
    convertPlaceholders: convertQuestionMarksToDollar
  },
  sqlite: {
    engine: 'sqlite',
    quote: doubleQuoteIdentifier,
    castText: (column) => `CAST(${column} AS TEXT)`,
    nullSafeEquals: (column) => `${column} IS ?`,
    likeOperator: 'LIKE',
    convertPlaceholders: (sql) => sql
  }
}

export function getDialect(engine) {
  return DIALECTS[normalizeDatabaseEngine(engine)]
}

export function qualifyTable(dialect, database, tableName) {
  if (!database) return dialect.quote(tableName)
  return `${dialect.quote(database)}.${dialect.quote(tableName)}`
}
