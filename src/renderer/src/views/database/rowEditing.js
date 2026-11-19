export function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

export function escapeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
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

export function buildPendingSql({ database, tableName, rowEdits = {}, rowDeletes = {}, rowInserts = [] }) {
  const tableRef = `${quoteIdentifier(database)}.${quoteIdentifier(tableName)}`
  const lines = []

  for (const entry of Object.values(rowEdits)) {
    const fields = Object.entries(entry.values || {})
    if (!fields.length) continue
    const setSql = fields.map(([field, value]) => `${quoteIdentifier(field)} = ${escapeSqlValue(value)}`).join(', ')
    const whereSql = Object.entries(entry.keys || {})
      .map(([field, value]) => `${quoteIdentifier(field)} <=> ${escapeSqlValue(value)}`)
      .join(' AND ')
    lines.push(`UPDATE ${tableRef} SET ${setSql} WHERE ${whereSql};`)
  }

  for (const keys of Object.values(rowDeletes)) {
    const whereSql = Object.entries(keys || {})
      .map(([field, value]) => `${quoteIdentifier(field)} <=> ${escapeSqlValue(value)}`)
      .join(' AND ')
    lines.push(`DELETE FROM ${tableRef} WHERE ${whereSql};`)
  }

  for (const draft of rowInserts) {
    const fields = Object.entries(draft.values || {}).filter(([, value]) => value !== '' && value !== undefined)
    if (!fields.length) {
      lines.push(`INSERT INTO ${tableRef} () VALUES ();`)
      continue
    }
    lines.push(
      `INSERT INTO ${tableRef} (${fields.map(([field]) => quoteIdentifier(field)).join(', ')}) VALUES (${fields
        .map(([, value]) => escapeSqlValue(value))
        .join(', ')});`
    )
  }

  return lines.join('\n')
}
