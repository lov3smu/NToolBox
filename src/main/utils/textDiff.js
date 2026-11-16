const MAX_DIFF_CELLS = 4_000_000
const MAX_PREVIEW_LINES = 400

function splitLines(text) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n')
  if (normalized === '') return []
  return normalized.split('\n')
}

function countByWalk(oldLines, newLines, limit) {
  const n = oldLines.length
  const m = newLines.length
  const width = m + 1
  const dp = new Uint32Array((n + 1) * width)

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const index = i * width + j
      dp[index] =
        oldLines[i] === newLines[j]
          ? dp[(i + 1) * width + j + 1] + 1
          : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1])
    }
  }

  const lines = []
  let added = 0
  let removed = 0
  let i = 0
  let j = 0
  let truncated = false

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      if (lines.length < limit) lines.push({ type: 'equal', text: oldLines[i] })
      else truncated = true
      i += 1
      j += 1
    } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
      removed += 1
      if (lines.length < limit) lines.push({ type: 'del', text: oldLines[i] })
      else truncated = true
      i += 1
    } else {
      added += 1
      if (lines.length < limit) lines.push({ type: 'add', text: newLines[j] })
      else truncated = true
      j += 1
    }
  }

  while (i < n) {
    removed += 1
    if (lines.length < limit) lines.push({ type: 'del', text: oldLines[i] })
    else truncated = true
    i += 1
  }

  while (j < m) {
    added += 1
    if (lines.length < limit) lines.push({ type: 'add', text: newLines[j] })
    else truncated = true
    j += 1
  }

  return { added, removed, truncated, lines }
}

export function computeLineDiff(oldText, newText, options = {}) {
  const limit = Number(options.maxLines) > 0 ? Number(options.maxLines) : MAX_PREVIEW_LINES
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)

  if (oldLines.length * newLines.length > MAX_DIFF_CELLS) {
    return {
      added: Math.max(0, newLines.length - oldLines.length),
      removed: Math.max(0, oldLines.length - newLines.length),
      truncated: true,
      approximate: true,
      lines: []
    }
  }

  const result = countByWalk(oldLines, newLines, limit)
  return {
    ...result,
    approximate: false,
    oldLines: oldLines.length,
    newLines: newLines.length
  }
}
