export function quoteIdentifier(name, engine = 'mysql') {
  const value = String(name)
  if (engine === 'mysql') return `\`${value.replace(/`/g, '``')}\``
  return `"${value.replace(/"/g, '""')}"`
}

export function escapeSqlValue(value, engine = 'mysql') {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  const text = String(value)
  const escaped = engine === 'mysql' ? text.replace(/\\/g, '\\\\').replace(/'/g, "''") : text.replace(/'/g, "''")
  return `'${escaped}'`
}

export function coerceValue(column, raw) {
  if (raw === null || raw === undefined || raw === '') return null
  const type = String(column?.dataType || '').toLowerCase()
  if (
    [
      'tinyint',
      'smallint',
      'mediumint',
      'int',
      'integer',
      'bigint',
      'decimal',
      'numeric',
      'float',
      'double',
      'real',
      'year'
    ].includes(type)
  ) {
    const number = Number(raw)
    return Number.isNaN(number) ? raw : number
  }
  return raw
}

export function isSameValue(left, right) {
  if (left === null || left === undefined) return right === null || right === undefined
  if (right === null || right === undefined) return false
  return String(left) === String(right)
}

export function rowKeyFor(keys, row) {
  const list = keys || []
  if (!list.length) return null
  return JSON.stringify(list.map((key) => (row[key] === undefined ? null : row[key])))
}

export function keysForRow(keys, row) {
  const result = {}
  for (const key of keys || []) {
    result[key] = row[key] === undefined ? null : row[key]
  }
  return result
}

function tableRefFor(database, tableName, engine) {
  const table = quoteIdentifier(tableName, engine)
  if (engine === 'mysql' && database) {
    return `${quoteIdentifier(database, engine)}.${table}`
  }
  return table
}

function equalityOperator(engine) {
  if (engine === 'mysql') return '<=>'
  if (engine === 'postgres') return 'IS NOT DISTINCT FROM'
  return 'IS'
}

export function buildPendingSql({
  database,
  tableName,
  rowEdits = {},
  rowDeletes = {},
  rowInserts = [],
  engine = 'mysql'
}) {
  const tableRef = tableRefFor(database, tableName, engine)
  const equals = equalityOperator(engine)
  const lines = []

  for (const entry of Object.values(rowEdits)) {
    const fields = Object.entries(entry.values || {})
    if (!fields.length) continue
    const setSql = fields
      .map(([field, value]) => `${quoteIdentifier(field, engine)} = ${escapeSqlValue(value, engine)}`)
      .join(', ')
    const whereSql = Object.entries(entry.keys || {})
      .map(([field, value]) => `${quoteIdentifier(field, engine)} ${equals} ${escapeSqlValue(value, engine)}`)
      .join(' AND ')
    lines.push(`UPDATE ${tableRef} SET ${setSql} WHERE ${whereSql};`)
  }

  for (const keys of Object.values(rowDeletes)) {
    const whereSql = Object.entries(keys || {})
      .map(([field, value]) => `${quoteIdentifier(field, engine)} ${equals} ${escapeSqlValue(value, engine)}`)
      .join(' AND ')
    lines.push(`DELETE FROM ${tableRef} WHERE ${whereSql};`)
  }

  for (const draft of rowInserts) {
    const fields = Object.entries(draft.values || {}).filter(([, value]) => value !== '' && value !== undefined)
    if (!fields.length) {
      lines.push(
        engine === 'mysql' ? `INSERT INTO ${tableRef} () VALUES ();` : `INSERT INTO ${tableRef} DEFAULT VALUES;`
      )
      continue
    }
    lines.push(
      `INSERT INTO ${tableRef} (${fields
        .map(([field]) => quoteIdentifier(field, engine))
        .join(', ')}) VALUES (${fields.map(([, value]) => escapeSqlValue(value, engine)).join(', ')});`
    )
  }

  return lines.join('\n')
}
