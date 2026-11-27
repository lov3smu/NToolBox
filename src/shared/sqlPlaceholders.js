function readQuoted(sql, start, quote) {
  let index = start + 1
  while (index < sql.length) {
    if (sql[index] === quote) {
      if (sql[index + 1] === quote) {
        index += 2
        continue
      }
      return index + 1
    }
    index += 1
  }
  return sql.length
}

function readDollarQuoted(sql, start) {
  const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(start))
  if (!tag) return null
  const endIndex = sql.indexOf(tag[0], start + tag[0].length)
  return endIndex === -1 ? sql.length : endIndex + tag[0].length
}

export function convertQuestionMarksToDollar(sql) {
  const source = String(sql ?? '')
  let out = ''
  let index = 0
  let placeholder = 0

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (char === "'" || char === '"' || char === '`') {
      const end = readQuoted(source, index, char)
      out += source.slice(index, end)
      index = end
      continue
    }

    if (char === '-' && next === '-') {
      const end = source.indexOf('\n', index)
      const stop = end === -1 ? source.length : end
      out += source.slice(index, stop)
      index = stop
      continue
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      out += source.slice(index, stop)
      index = stop
      continue
    }

    if (char === '$') {
      const end = readDollarQuoted(source, index)
      if (end !== null) {
        out += source.slice(index, end)
        index = end
        continue
      }
    }

    if (char === '?') {
      placeholder += 1
      out += `$${placeholder}`
      index += 1
      continue
    }

    out += char
    index += 1
  }

  return out
}

function formatSqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (value instanceof Date) return `'${value.toISOString()}'`
  return `'${String(value).replace(/'/g, "''")}'`
}

/**
 * Substitutes positional placeholders (`?` or `$1..$n`) with literals so the
 * generated SQL can be shown to the user. Scanning skips strings and comments,
 * matching how the placeholders were emitted.
 */
export function inlineSqlParameters(sql, params = []) {
  const source = String(sql ?? '')
  const values = Array.isArray(params) ? params : []
  let out = ''
  let index = 0
  let placeholder = 0

  const take = (position) => {
    placeholder = Math.max(placeholder, position)
    return formatSqlLiteral(values[position - 1])
  }

  while (index < source.length) {
    const char = source[index]
    const next = source[index + 1]

    if (char === "'" || char === '"' || char === '`') {
      const end = readQuoted(source, index, char)
      out += source.slice(index, end)
      index = end
      continue
    }

    if (char === '-' && next === '-') {
      const end = source.indexOf('\n', index)
      const stop = end === -1 ? source.length : end
      out += source.slice(index, stop)
      index = stop
      continue
    }

    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      const stop = end === -1 ? source.length : end + 2
      out += source.slice(index, stop)
      index = stop
      continue
    }

    if (char === '$') {
      const end = readDollarQuoted(source, index)
      if (end !== null) {
        out += source.slice(index, end)
        index = end
        continue
      }
      const numbered = /^\$(\d+)/.exec(source.slice(index))
      if (numbered) {
        out += take(Number(numbered[1]))
        index += numbered[0].length
        continue
      }
    }

    if (char === '?') {
      out += take(placeholder + 1)
      index += 1
      continue
    }

    out += char
    index += 1
  }

  return out
}
