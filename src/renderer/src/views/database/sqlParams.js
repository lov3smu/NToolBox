const IDENT_START = /[A-Za-z_]/
const IDENT_PART = /[A-Za-z0-9_]/

function scanSql(sql) {
  const text = String(sql || '')
  const names = []
  const order = []
  const seen = new Set()
  let prepared = ''
  let index = 0

  while (index < text.length) {
    const char = text[index]

    if (char === "'" || char === '"' || char === '`') {
      const quote = char
      let end = index + 1
      while (end < text.length) {
        if (text[end] === '\\' && quote !== '`') {
          end += 2
          continue
        }
        if (text[end] === quote) {
          if (text[end + 1] === quote) {
            end += 2
            continue
          }
          end += 1
          break
        }
        end += 1
      }
      prepared += text.slice(index, end)
      index = end
      continue
    }

    if (char === '-' && text[index + 1] === '-') {
      const newline = text.indexOf('\n', index)
      const end = newline === -1 ? text.length : newline
      prepared += text.slice(index, end)
      index = end
      continue
    }

    if (char === '#') {
      const newline = text.indexOf('\n', index)
      const end = newline === -1 ? text.length : newline
      prepared += text.slice(index, end)
      index = end
      continue
    }

    if (char === '/' && text[index + 1] === '*') {
      const closing = text.indexOf('*/', index + 2)
      const end = closing === -1 ? text.length : closing + 2
      prepared += text.slice(index, end)
      index = end
      continue
    }

    if (char === ':' && text[index + 1] !== '=' && text[index - 1] !== ':') {
      const next = text[index + 1]
      if (next && IDENT_START.test(next)) {
        let end = index + 1
        while (end < text.length && IDENT_PART.test(text[end])) end++
        const name = text.slice(index + 1, end)
        prepared += '?'
        order.push(name)
        if (!seen.has(name)) {
          seen.add(name)
          names.push(name)
        }
        index = end
        continue
      }
    }

    prepared += char
    index += 1
  }

  return { sql: prepared, params: names, order }
}

export function extractSqlParams(sql) {
  return scanSql(sql).params
}

export function hasSqlParams(sql) {
  return extractSqlParams(sql).length > 0
}

export function bindSqlParams(sql, values = {}) {
  const { sql: prepared, params: names, order } = scanSql(sql)
  return {
    sql: prepared,
    params: order.map((name) => {
      const value = values[name]
      return value === undefined ? null : value
    }),
    names
  }
}
