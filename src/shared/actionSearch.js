function actionHaystack(action, translate) {
  return [
    action.title,
    action.subtitle,
    action.keywords,
    action.categoryLabel,
    translate(action.title),
    translate(action.subtitle),
    translate(action.categoryLabel)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function scoreAction(action, tokens, translate) {
  const title = String(action.title || '').toLowerCase()
  const translatedTitle = String(translate(action.title) || '').toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (title === token || translatedTitle === token) score += 6
    else if (title.startsWith(token) || translatedTitle.startsWith(token)) score += 4
    else if (title.includes(token) || translatedTitle.includes(token)) score += 2
    else score += 1
  }
  return score
}

export function filterActions(actions, query, translate = (value) => value) {
  const tokens = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!tokens.length) return actions
  return actions
    .map((action, index) => ({ action, index, haystack: actionHaystack(action, translate) }))
    .filter((entry) => tokens.every((token) => entry.haystack.includes(token)))
    .map((entry) => ({ ...entry, score: scoreAction(entry.action, tokens, translate) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.action)
}
