const KEYWORDS = new Set(
  `SELECT FROM WHERE GROUP ORDER HAVING LIMIT OFFSET UNION ALL INTERSECT EXCEPT DISTINCT INSERT INTO
   VALUES UPDATE SET DELETE REPLACE JOIN LEFT RIGHT INNER OUTER CROSS ON USING AND OR NOT NULL
   IS IN BETWEEN LIKE REGEXP EXISTS CASE WHEN THEN ELSE END ASC DESC CREATE ALTER DROP TABLE VIEW
   INDEX DATABASE COLUMN ADD MODIFY CHANGE RENAME PRIMARY KEY FOREIGN REFERENCES DEFAULT
   AUTO_INCREMENT COMMENT UNIQUE CONSTRAINT IF WITH RECURSIVE TRUE FALSE AS BY DUPLICATE TRUNCATE
   SHOW DESCRIBE EXPLAIN INT INTEGER BIGINT SMALLINT TINYINT MEDIUMINT DECIMAL NUMERIC FLOAT DOUBLE
   CHAR VARCHAR TEXT LONGTEXT DATETIME TIMESTAMP DATE TIME JSON BLOB BOOLEAN UNSIGNED ZEROFILL ENGINE`
    .split(/\s+/)
    .filter(Boolean)
)

const CLAUSE_KEYWORDS = new Set([
  'SELECT',
  'FROM',
  'WHERE',
  'HAVING',
  'LIMIT',
  'UNION',
  'UNION ALL',
  'INTERSECT',
  'EXCEPT',
  'GROUP BY',
  'ORDER BY',
  'INSERT',
  'INSERT INTO',
  'VALUES',
  'SET',
  'UPDATE',
  'DELETE',
  'DELETE FROM',
  'WITH',
  'REPLACE INTO',
  'CREATE',
  'CREATE TABLE',
  'CREATE INDEX',
  'ALTER',
  'ALTER TABLE',
  'DROP',
  'DROP TABLE',
  'DROP INDEX',
  'TRUNCATE'
])

const JOIN_KEYWORDS = new Set([
  'JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'INNER JOIN',
  'OUTER JOIN',
  'CROSS JOIN',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN'
])

const PHRASES = [
  ['LEFT', 'OUTER', 'JOIN'],
  ['RIGHT', 'OUTER', 'JOIN'],
  ['GROUP', 'BY'],
  ['ORDER', 'BY'],
  ['UNION', 'ALL'],
  ['LEFT', 'JOIN'],
  ['RIGHT', 'JOIN'],
  ['INNER', 'JOIN'],
  ['OUTER', 'JOIN'],
  ['CROSS', 'JOIN'],
  ['INSERT', 'INTO'],
  ['DELETE', 'FROM'],
  ['REPLACE', 'INTO'],
  ['PRIMARY', 'KEY'],
  ['FOREIGN', 'KEY'],
  ['IF', 'NOT', 'EXISTS'],
  ['IF', 'EXISTS'],
  ['NOT', 'NULL'],
  ['NOT', 'IN'],
  ['NOT', 'LIKE'],
  ['NOT', 'BETWEEN'],
  ['IS', 'NOT'],
  ['IS', 'NULL'],
  ['CREATE', 'TABLE'],
  ['CREATE', 'INDEX'],
  ['ALTER', 'TABLE'],
  ['DROP', 'TABLE'],
  ['DROP', 'INDEX']
]

const TYPE_KEYWORDS = new Set([
  'CHAR',
  'VARCHAR',
  'DECIMAL',
  'NUMERIC',
  'FLOAT',
  'DOUBLE',
  'INT',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'TINYINT',
  'MEDIUMINT',
  'BLOB',
  'TEXT',
  'LONGTEXT',
  'DATETIME',
  'TIMESTAMP',
  'DATE',
  'TIME',
  'JSON',
  'BOOLEAN'
])

const OPERATORS = ['<=>', '->>', '<=', '>=', '<>', '!=', ':=', '||', '&&', '<<', '>>', '->', '::']
const CLAUSE_BREAK_CONTEXTS = new Set(['WHERE', 'HAVING', 'ON', 'JOIN'])

function isWordStart(ch) {
  return /[A-Za-z_$\u00a0-\uffff]/.test(ch)
}

function isWordPart(ch) {
  return /[A-Za-z0-9_$\u00a0-\uffff]/.test(ch)
}

function tokenize(sql) {
  const tokens = []
  const length = sql.length
  let i = 0
  while (i < length) {
    const ch = sql[i]
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      let end = sql.indexOf('\n', i)
      if (end === -1) end = length
      tokens.push({ type: 'line-comment', value: sql.slice(i, end).trimEnd() })
      i = end
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2)
      const stop = end === -1 ? length : end + 2
      tokens.push({ type: 'block-comment', value: sql.slice(i, stop) })
      i = stop
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < length) {
        if (sql[j] === '\\' && ch !== '`') {
          j += 2
          continue
        }
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2
            continue
          }
          j += 1
          break
        }
        j += 1
      }
      tokens.push({ type: 'literal', value: sql.slice(i, Math.min(j, length)) })
      i = Math.min(j, length)
      continue
    }
    if (/[0-9]/.test(ch)) {
      const match = /^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(sql.slice(i))
      const value = match ? match[0] : ch
      tokens.push({ type: 'literal', value })
      i += value.length
      continue
    }
    if (isWordStart(ch)) {
      let j = i + 1
      while (j < length && isWordPart(sql[j])) j += 1
      tokens.push({ type: 'word', value: sql.slice(i, j) })
      i = j
      continue
    }
    const multi = OPERATORS.find((operator) => sql.startsWith(operator, i))
    if (multi) {
      tokens.push({ type: 'operator', value: multi })
      i += multi.length
      continue
    }
    tokens.push({ type: 'punct', value: ch })
    i += 1
  }
  return tokens
}

function wordUpper(token) {
  return token && token.type === 'word' ? token.value.toUpperCase() : ''
}

function matchPhrase(tokens, index) {
  for (const phrase of PHRASES) {
    let matched = true
    for (let offset = 0; offset < phrase.length; offset += 1) {
      if (wordUpper(tokens[index + offset]) !== phrase[offset]) {
        matched = false
        break
      }
    }
    if (matched) return phrase
  }
  return null
}

export function formatSql(sql) {
  const text = String(sql || '').trim()
  if (!text) return ''
  const tokens = tokenize(text)

  const lines = []
  let line = ''
  let pendingIndent = 0

  const pad = (level) => '  '.repeat(Math.max(0, level))

  function flush() {
    const trimmed = line.replace(/\s+$/, '')
    if (trimmed.trim()) lines.push(trimmed)
    line = ''
  }

  function newline(level) {
    flush()
    pendingIndent = level
  }

  function emit(value, spaceBefore) {
    if (!line) line = pad(pendingIndent)
    if (spaceBefore && line && !/\s$/.test(line)) line += ' '
    line += value
  }

  let context = { clause: '', clauseDepth: 0, baseIndent: 0 }
  const contextStack = []
  const parenStack = []
  let depth = 0
  let betweenPending = false
  let previousType = 'start'
  let previousValue = ''
  let previousIsKeyword = false

  function spaceBeforePrevious() {
    if (previousType === 'start' || previousType === 'open' || previousType === 'dot') return false
    if (previousType === 'operator' && previousValue === '::') return false
    if (previousType === 'operator-tight') return false
    return true
  }

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const rawValue = token.value

    if (token.type === 'line-comment') {
      newline(context.baseIndent)
      emit(rawValue, false)
      newline(context.baseIndent)
      previousType = 'line-comment'
      previousIsKeyword = false
      continue
    }

    if (token.type === 'block-comment') {
      emit(rawValue, spaceBeforePrevious())
      previousType = 'block-comment'
      previousIsKeyword = false
      continue
    }

    if (token.type === 'punct') {
      if (rawValue === '(') {
        const nextWord = wordUpper(tokens[index + 1])
        const subquery = nextWord === 'SELECT' || nextWord === 'WITH'
        const clauseHead = context.clause.split(' ')[0]
        const definitionList = depth === context.clauseDepth && ['CREATE', 'ALTER', 'DROP'].includes(clauseHead)
        const functionCall =
          !definitionList &&
          previousType === 'word' &&
          (!previousIsKeyword || TYPE_KEYWORDS.has(previousValue.toUpperCase()))
        const insertList =
          depth === context.clauseDepth && ['INSERT', 'INSERT INTO', 'REPLACE INTO'].includes(context.clause)
        const parenSpace = (spaceBeforePrevious() && (!functionCall || insertList)) || definitionList
        if (subquery) {
          emit('(', parenSpace)
          contextStack.push({ ...context })
          parenStack.push({ subquery: true, definitionList: false, openIndent: context.baseIndent })
          depth += 1
          context = { clause: '', clauseDepth: depth, baseIndent: context.baseIndent + 1 }
          newline(context.baseIndent)
        } else {
          emit('(', parenSpace)
          parenStack.push({ subquery: false, definitionList, openIndent: context.baseIndent })
          depth += 1
          if (definitionList) newline(context.baseIndent + 1)
        }
        betweenPending = false
        previousType = 'open'
        previousIsKeyword = false
        continue
      }

      if (rawValue === ')') {
        const entry = parenStack.pop()
        depth = Math.max(0, depth - 1)
        if (entry?.subquery) {
          context = contextStack.pop() || { clause: '', clauseDepth: depth, baseIndent: 0 }
          newline(entry.openIndent)
          emit(')', false)
        } else if (entry?.definitionList) {
          newline(context.baseIndent)
          emit(')', false)
        } else {
          emit(')', false)
        }
        betweenPending = false
        previousType = 'close'
        previousIsKeyword = false
        continue
      }

      if (rawValue === ',') {
        emit(',', false)
        const topParen = parenStack[parenStack.length - 1]
        if (context.clause === 'SELECT' && depth === context.clauseDepth) {
          newline(context.baseIndent + 1)
        } else if (topParen?.definitionList && depth === context.clauseDepth + 1) {
          newline(context.baseIndent + 1)
        }
        betweenPending = false
        previousType = 'comma'
        previousIsKeyword = false
        continue
      }

      if (rawValue === ';') {
        emit(';', false)
        newline(0)
        context = { clause: '', clauseDepth: 0, baseIndent: 0 }
        betweenPending = false
        previousType = 'semicolon'
        previousIsKeyword = false
        continue
      }

      if (rawValue === '.') {
        emit('.', false)
        previousType = 'dot'
        previousIsKeyword = false
        continue
      }

      emit(rawValue, spaceBeforePrevious())
      previousType = 'operator'
      previousValue = rawValue
      previousIsKeyword = false
      continue
    }

    if (token.type === 'operator') {
      const tight = rawValue === '::'
      emit(rawValue, tight ? false : spaceBeforePrevious())
      previousType = tight ? 'operator-tight' : 'operator'
      previousValue = rawValue
      previousIsKeyword = false
      continue
    }

    if (token.type === 'literal') {
      emit(rawValue, spaceBeforePrevious())
      previousType = 'literal'
      previousIsKeyword = false
      continue
    }

    const phrase = matchPhrase(tokens, index)
    const upper = phrase ? phrase.join(' ') : wordUpper(token)
    const isKeyword = phrase ? phrase.every((part) => KEYWORDS.has(part)) : KEYWORDS.has(upper)
    const display = isKeyword ? upper : rawValue

    if (isKeyword) {
      if (CLAUSE_KEYWORDS.has(upper)) {
        newline(context.baseIndent)
        emit(display, false)
        context = { ...context, clause: upper, clauseDepth: depth }
        betweenPending = false
      } else if (JOIN_KEYWORDS.has(upper)) {
        newline(context.baseIndent)
        emit(display, false)
        context = { ...context, clause: 'JOIN', clauseDepth: depth }
        betweenPending = false
      } else if (upper === 'ON') {
        newline(context.baseIndent + 1)
        emit(display, false)
        context = { ...context, clause: 'ON', clauseDepth: depth }
        betweenPending = false
      } else if (upper === 'AND' || upper === 'OR') {
        const breakable = CLAUSE_BREAK_CONTEXTS.has(context.clause) && depth === context.clauseDepth
        if (breakable && !betweenPending) {
          newline(context.baseIndent + 1)
          emit(display, false)
        } else {
          emit(display, spaceBeforePrevious())
        }
        betweenPending = false
      } else {
        if (upper === 'BETWEEN' || upper === 'NOT BETWEEN') betweenPending = true
        emit(display, spaceBeforePrevious())
      }
    } else {
      emit(display, spaceBeforePrevious())
    }

    previousType = 'word'
    previousIsKeyword = isKeyword
    if (phrase) {
      index += phrase.length - 1
      previousValue = phrase[phrase.length - 1]
    } else {
      previousValue = token.value
    }
  }

  flush()
  return lines.join('\n')
}
