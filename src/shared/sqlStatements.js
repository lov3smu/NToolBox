const ROUTINE_TYPES = new Set(['procedure', 'function', 'trigger', 'event'])
const OBJECT_TYPES = [
  'procedure',
  'function',
  'trigger',
  'event',
  'table',
  'view',
  'database',
  'schema',
  'index',
  'user',
  'role',
  'tablespace',
  'server'
]
const STATEMENT_END_FOLLOWERS = new Set(['IF', 'LOOP', 'WHILE', 'REPEAT'])

function stripLeadingComments(sql) {
  return sql.replace(/^(?:\s+|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '')
}

export function isRoutineDdl(sql) {
  const head = stripLeadingComments(String(sql || ''))
  if (!/^create\b/i.test(head)) return false
  const match = head.match(new RegExp(`\\b(?:${OBJECT_TYPES.join('|')})\\b`, 'i'))
  return !!match && ROUTINE_TYPES.has(match[0].toLowerCase())
}

function isWordStart(char) {
  return /[A-Za-z_]/.test(char)
}

function isWordChar(char) {
  return /[A-Za-z0-9_]/.test(char)
}

export function stripSqlComments(sql) {
  const text = String(sql || '')
  let result = ''
  let i = 0
  while (i < text.length) {
    const char = text[i]
    const next = text[i + 1]
    if (char === '-' && next === '-') {
      const newline = text.indexOf('\n', i + 2)
      i = newline === -1 ? text.length : newline
      continue
    }
    if (char === '#') {
      const newline = text.indexOf('\n', i + 1)
      i = newline === -1 ? text.length : newline
      continue
    }
    if (char === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2)
      i = close === -1 ? text.length : close + 2
      result += ' '
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      const quote = char
      result += char
      i++
      while (i < text.length) {
        const current = text[i]
        result += current
        if (current === '\\' && i + 1 < text.length) {
          result += text[i + 1]
          i += 2
          continue
        }
        if (current === quote) {
          if (text[i + 1] === quote) {
            result += text[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    result += char
    i++
  }
  return result
}

/**
 * Splits SQL into statements, honoring strings, comments, `DELIMITER`
 * directives and `BEGIN ... END` bodies of routine DDL (CREATE PROCEDURE /
 * FUNCTION / TRIGGER / EVENT) so a whole routine is one statement.
 */
export function splitSqlStatementRanges(sql) {
  const text = typeof sql === 'string' ? sql : ''
  const ranges = []
  let delimiter = ';'
  let start = 0
  let routine = false
  let depth = 0
  let i = 0

  const emit = (textEnd, rangeEnd) => {
    let from = start
    while (from < textEnd && /\s/.test(text[from])) from++
    let to = textEnd
    while (to > from && /\s/.test(text[to - 1])) to--
    if (to > from && stripSqlComments(text.slice(from, to)).trim()) {
      ranges.push({ from, to: rangeEnd, text: text.slice(from, to) })
    }
  }

  const skipStatementStart = () => {
    let advanced = true
    while (advanced) {
      advanced = false
      while (i < text.length && /\s/.test(text[i])) i++
      const newline = text.indexOf('\n', i)
      const lineEnd = newline === -1 ? text.length : newline
      const directive = /^delimiter\s+(\S+)\s*$/i.exec(text.slice(i, lineEnd))
      if (directive) {
        delimiter = directive[1]
        i = newline === -1 ? text.length : newline + 1
        start = i
        advanced = true
      }
    }
    routine = i < text.length && isRoutineDdl(text.slice(i))
    depth = 0
  }

  skipStatementStart()

  while (i < text.length) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '-' && next === '-') {
      const newline = text.indexOf('\n', i + 2)
      i = newline === -1 ? text.length : newline + 1
      continue
    }
    if (char === '#') {
      const newline = text.indexOf('\n', i + 1)
      i = newline === -1 ? text.length : newline + 1
      continue
    }
    if (char === '/' && next === '*') {
      const close = text.indexOf('*/', i + 2)
      i = close === -1 ? text.length : close + 2
      continue
    }
    if (char === "'" || char === '"' || char === '`') {
      const quote = char
      i++
      while (i < text.length) {
        const current = text[i]
        if (current === '\\') {
          i += 2
          continue
        }
        if (current === quote) {
          if (text[i + 1] === quote) {
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    if (routine && isWordStart(char)) {
      let wordEnd = i + 1
      while (wordEnd < text.length && isWordChar(text[wordEnd])) wordEnd++
      const word = text.slice(i, wordEnd).toUpperCase()
      if (word === 'BEGIN' || word === 'CASE') {
        depth++
      } else if (word === 'END') {
        let follower = wordEnd
        while (follower < text.length && /\s/.test(text[follower])) follower++
        let followerEnd = follower
        while (followerEnd < text.length && isWordChar(text[followerEnd])) {
          followerEnd++
        }
        const nextWord = text.slice(follower, followerEnd).toUpperCase()
        // END IF / LOOP / WHILE / REPEAT close constructs that were not counted;
        // CASE was counted above so END CASE (and a CASE expression's END) must close it.
        if (!STATEMENT_END_FOLLOWERS.has(nextWord)) depth = Math.max(0, depth - 1)
      }
      i = wordEnd
      continue
    }
    if (text.startsWith(delimiter, i) && (!routine || depth === 0)) {
      const rangeEnd = i + delimiter.length
      emit(i, rangeEnd)
      i = rangeEnd
      start = i
      skipStatementStart()
      continue
    }
    i++
  }

  emit(text.length, text.length)
  return ranges
}

export function splitSqlStatements(sql) {
  return splitSqlStatementRanges(sql).map((statement) => statement.text)
}
