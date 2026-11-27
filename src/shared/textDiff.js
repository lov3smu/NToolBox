export const DIFF_MAX_LINES = 2000
export const DIFF_MAX_CELLS = 4_000_000

export function splitDiffLines(text) {
  const source = typeof text === 'string' ? text : ''
  if (!source) return []
  const lines = source.split(/\r?\n/)
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  return lines
}

function normalizeLine(line, options) {
  let value = line
  if (options.ignoreCase) value = value.toLowerCase()
  if (options.ignoreWhitespace) value = value.replace(/\s+/g, ' ').trim()
  return value
}

function summarize(rows) {
  const stats = { added: 0, removed: 0, unchanged: 0 }
  for (const row of rows) {
    if (row.type === 'add') stats.added += 1
    else if (row.type === 'remove') stats.removed += 1
    else stats.unchanged += 1
  }
  return stats
}

export function diffLines(oldText, newText, options = {}) {
  const settings = {
    ignoreCase: Boolean(options.ignoreCase),
    ignoreWhitespace: Boolean(options.ignoreWhitespace)
  }
  const oldLines = splitDiffLines(oldText)
  const newLines = splitDiffLines(newText)

  if (oldLines.length * newLines.length > DIFF_MAX_CELLS) {
    const rows = []
    oldLines.forEach((line, index) => rows.push({ type: 'remove', text: line, oldNo: index + 1, newNo: null }))
    newLines.forEach((line, index) => rows.push({ type: 'add', text: line, oldNo: null, newNo: index + 1 }))
    return { rows, stats: summarize(rows), truncated: true }
  }

  const oldKeys = oldLines.map((line) => normalizeLine(line, settings))
  const newKeys = newLines.map((line) => normalizeLine(line, settings))
  const width = newLines.length + 1
  const table = new Uint32Array((oldLines.length + 1) * width)

  for (let i = oldLines.length - 1; i >= 0; i -= 1) {
    for (let j = newLines.length - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        oldKeys[i] === newKeys[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }

  const rows = []
  let i = 0
  let j = 0
  while (i < oldLines.length && j < newLines.length) {
    if (oldKeys[i] === newKeys[j]) {
      rows.push({ type: 'equal', text: oldLines[i], oldNo: i + 1, newNo: j + 1 })
      i += 1
      j += 1
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      rows.push({ type: 'remove', text: oldLines[i], oldNo: i + 1, newNo: null })
      i += 1
    } else {
      rows.push({ type: 'add', text: newLines[j], oldNo: null, newNo: j + 1 })
      j += 1
    }
  }
  while (i < oldLines.length) {
    rows.push({ type: 'remove', text: oldLines[i], oldNo: i + 1, newNo: null })
    i += 1
  }
  while (j < newLines.length) {
    rows.push({ type: 'add', text: newLines[j], oldNo: null, newNo: j + 1 })
    j += 1
  }

  return { rows, stats: summarize(rows), truncated: false }
}
