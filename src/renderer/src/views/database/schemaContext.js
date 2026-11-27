function promptTokens(prompt) {
  const text = String(prompt || '').toLowerCase()
  const tokens = new Set()
  for (const word of text.match(/[a-z0-9_]{2,}/g) || []) tokens.add(word)
  for (const segment of text.match(/[\u4e00-\u9fff]+/g) || []) {
    if (segment.length === 1) tokens.add(segment)
    for (let i = 0; i < segment.length - 1; i += 1) tokens.add(segment.slice(i, i + 2))
  }
  return [...tokens]
}

function scoreTable(table, tokens, loweredPrompt) {
  const name = String(table.name || '').toLowerCase()
  const comment = String(table.comment || '').toLowerCase()
  let score = 0
  if (name && loweredPrompt.includes(name)) score += 10
  if (comment && loweredPrompt.includes(comment)) score += 8
  let columnScore = 0
  for (const token of tokens) {
    if (name.includes(token)) score += 5
    if (comment.includes(token)) score += 3
    for (const column of table.columns || []) {
      if (
        String(column.name || '')
          .toLowerCase()
          .includes(token)
      )
        columnScore += 1
      if (
        String(column.comment || '')
          .toLowerCase()
          .includes(token)
      )
        columnScore += 2
    }
  }
  return score + Math.min(columnScore, 10)
}

export function rankSchemaTables(tables, prompt) {
  const list = Array.isArray(tables) ? tables : []
  if (!prompt) return list.slice()
  const tokens = promptTokens(prompt)
  if (!tokens.length) return list.slice()
  const loweredPrompt = String(prompt).toLowerCase()
  return list
    .map((table, index) => ({ table, index, score: scoreTable(table, tokens, loweredPrompt) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.table)
}
