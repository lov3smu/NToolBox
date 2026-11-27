export const TEXT_OPERATIONS = Object.freeze([
  { id: 'upper', label: '全部大写', group: 'case' },
  { id: 'lower', label: '全部小写', group: 'case' },
  { id: 'title', label: '单词首字母大写', group: 'case' },
  { id: 'sentence', label: '句首字母大写', group: 'case' },
  { id: 'trim-lines', label: '去除行首尾空白', group: 'lines' },
  { id: 'remove-empty-lines', label: '移除空行', group: 'lines' },
  { id: 'dedupe-lines', label: '行去重', group: 'lines' },
  { id: 'sort-lines', label: '按行排序', group: 'lines' },
  { id: 'sort-lines-desc', label: '按行倒序', group: 'lines' },
  { id: 'reverse-lines', label: '反转行序', group: 'lines' },
  { id: 'number-lines', label: '添加行号', group: 'lines' },
  { id: 'collapse-spaces', label: '压缩多余空格', group: 'whitespace' },
  { id: 'remove-whitespace', label: '删除全部空白', group: 'whitespace' }
])

export const TEXT_OPERATION_GROUPS = Object.freeze([
  { id: 'case', label: '大小写' },
  { id: 'lines', label: '行处理' },
  { id: 'whitespace', label: '空白处理' }
])

export function splitLines(text) {
  if (typeof text !== 'string' || !text) return []
  return text.split(/\r?\n/)
}

function joinLines(lines) {
  return lines.join('\n')
}

function toTitleCase(text) {
  return text
    .toLowerCase()
    .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_match, prefix, letter) => prefix + letter.toUpperCase())
}

function toSentenceCase(text) {
  return text.toLowerCase().replace(/(^\s*\p{L})|([.!?。！？]\s*\p{L})/gu, (match) => match.toUpperCase())
}

function compareLines(a, b) {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

const LINE_TRANSFORMS = {
  'trim-lines': (lines) => lines.map((line) => line.trim()),
  'remove-empty-lines': (lines) => lines.filter((line) => line.trim() !== ''),
  'dedupe-lines': (lines) => [...new Set(lines)],
  'sort-lines': (lines) => [...lines].sort(compareLines),
  'sort-lines-desc': (lines) => [...lines].sort((a, b) => compareLines(b, a)),
  'reverse-lines': (lines) => [...lines].reverse(),
  'number-lines': (lines) => lines.map((line, index) => `${index + 1}. ${line}`)
}

export function transformText(operationId, text) {
  const source = typeof text === 'string' ? text : ''
  switch (operationId) {
    case 'upper':
      return source.toUpperCase()
    case 'lower':
      return source.toLowerCase()
    case 'title':
      return toTitleCase(source)
    case 'sentence':
      return toSentenceCase(source)
    case 'collapse-spaces':
      return source
        .split(/\r?\n/)
        .map((line) => line.replace(/[ \t]+/g, ' ').trim())
        .join('\n')
    case 'remove-whitespace':
      return source.replace(/\s+/g, '')
    default:
      break
  }
  const transform = LINE_TRANSFORMS[operationId]
  if (!transform) return source
  return joinLines(transform(splitLines(source)))
}

export function textStats(text) {
  const source = typeof text === 'string' ? text : ''
  const lines = source === '' ? 0 : source.split(/\r?\n/).length
  const trimmed = source.trim()
  return {
    chars: source.length,
    charsNoSpace: source.replace(/\s/g, '').length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    lines,
    bytes: new TextEncoder().encode(source).length
  }
}
