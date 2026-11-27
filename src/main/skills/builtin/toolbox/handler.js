import { CODEC_MODES, transformCodec } from '../../../../shared/codec.js'
import { TEXT_OPERATIONS, transformText } from '../../../../shared/textTools.js'
import { runRegex } from '../../../../shared/regexTester.js'
import { diffLines } from '../../../../shared/textDiff.js'
import { BUILTIN_TEMPLATES, filterTemplates, getTemplateById } from '../../../../shared/templates.js'

const MAX_TEXT_LENGTH = 200000
const MAX_OUTPUT = 20000
const MAX_LIMIT = 500

const CODEC_MODES_SET = new Set(CODEC_MODES.map((mode) => mode.id))
const TEXT_OPERATIONS_SET = new Set(TEXT_OPERATIONS.map((operation) => operation.id))
const DIFF_PREFIX = { equal: '  ', add: '+ ', remove: '- ' }

function readText(value, field = 'text') {
  if (typeof value !== 'string') return { error: `${field} 必须是字符串` }
  if (value.length > MAX_TEXT_LENGTH) return { error: `${field} 超过上限（${MAX_TEXT_LENGTH} 字符）` }
  return { text: value }
}

function readLimit(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 100
  return Math.min(MAX_LIMIT, Math.max(1, Math.round(parsed)))
}

function truncate(text) {
  if (text.length <= MAX_OUTPUT) return text
  return `${text.slice(0, MAX_OUTPUT)}\n…[输出已截断，共 ${text.length} 字符]`
}

function runCodec(params) {
  const mode = params.mode
  if (!CODEC_MODES_SET.has(mode)) {
    return { success: false, error: `mode 必须是 ${[...CODEC_MODES_SET].join('、')} 之一` }
  }
  const direction = params.direction === 'decode' ? 'decode' : 'encode'
  const input = readText(params.text)
  if (input.error) return { success: false, error: input.error }
  const result = transformCodec(mode, direction, input.text)
  if (!result.ok) return { success: false, error: `转换失败：${result.error}` }
  return {
    success: true,
    content: result.value,
    metadata: { action: 'codec', mode, direction, inputLength: input.text.length, outputLength: result.value.length }
  }
}

function runText(params) {
  if (!TEXT_OPERATIONS_SET.has(params.operation)) {
    return { success: false, error: `operation 必须是 ${[...TEXT_OPERATIONS_SET].join('、')} 之一` }
  }
  const input = readText(params.text)
  if (input.error) return { success: false, error: input.error }
  const value = transformText(params.operation, input.text)
  return {
    success: true,
    content: value,
    metadata: {
      action: 'text',
      operation: params.operation,
      inputLength: input.text.length,
      outputLength: value.length
    }
  }
}

function runRegexAction(params) {
  const input = readText(params.text)
  if (input.error) return { success: false, error: input.error }
  const result = runRegex(params.pattern, params.flags, input.text)
  if (!result.ok)
    return { success: false, error: `正则无效：${result.error}${result.detail ? `（${result.detail}）` : ''}` }

  const limit = Math.min(readLimit(params.limit), result.matches.length)
  const lines = [
    `正则 /${params.pattern}/${result.flags} 命中 ${result.matches.length} 处${result.truncated ? '（已达上限）' : ''}`
  ]
  for (const match of result.matches.slice(0, limit)) {
    const groups = match.groups.filter((group) => group !== null)
    lines.push(
      `- [${match.index}-${match.end}] ${JSON.stringify(match.value)}${
        groups.length ? ` 捕获组：${JSON.stringify(groups)}` : ''
      }`
    )
  }
  if (result.matches.length > limit) lines.push(`…仅显示前 ${limit} 处`)
  return {
    success: true,
    content: truncate(lines.join('\n')),
    metadata: { action: 'regex', matches: result.matches.length, shown: limit, truncated: result.truncated }
  }
}

function runDiffAction(params) {
  const left = readText(params.left, 'left')
  if (left.error) return { success: false, error: left.error }
  const right = readText(params.right, 'right')
  if (right.error) return { success: false, error: right.error }

  const result = diffLines(left.text, right.text, {
    ignoreCase: params.ignore_case === true,
    ignoreWhitespace: params.ignore_whitespace === true
  })
  const limit = readLimit(params.limit)
  const lines = [
    `新增 ${result.stats.added} 行，删除 ${result.stats.removed} 行，未变 ${result.stats.unchanged} 行${
      result.truncated ? '（内容过大，已按整段替换输出）' : ''
    }`
  ]
  for (const row of result.rows.slice(0, limit)) {
    lines.push(`${DIFF_PREFIX[row.type]}${row.text}`)
  }
  if (result.rows.length > limit) lines.push(`…仅显示前 ${limit} 行差异`)
  return {
    success: true,
    content: truncate(lines.join('\n')),
    metadata: {
      action: 'diff',
      ...result.stats,
      shown: Math.min(limit, result.rows.length),
      truncated: result.truncated
    }
  }
}

function runTemplateAction(params) {
  if (typeof params.template_id === 'string' && params.template_id.trim()) {
    const template = getTemplateById(BUILTIN_TEMPLATES, params.template_id.trim())
    if (!template) return { success: false, error: `未找到模板：${params.template_id}` }
    return {
      success: true,
      content: template.content,
      metadata: { action: 'template', templateId: template.id, targetPath: template.targetPath || '' }
    }
  }

  const matches = filterTemplates(BUILTIN_TEMPLATES, params.query || '', 'all')
  const lines = [`共 ${matches.length} 个模板`]
  for (const template of matches) {
    lines.push(`- ${template.id}：${template.name}（${template.description}）${template.targetPath || '仅复制'}`)
  }
  return {
    success: true,
    content: truncate(lines.join('\n')),
    metadata: { action: 'template', count: matches.length }
  }
}

export default function handler(params) {
  switch (params.action) {
    case 'codec':
      return runCodec(params)
    case 'text':
      return runText(params)
    case 'regex':
      return runRegexAction(params)
    case 'diff':
      return runDiffAction(params)
    case 'template':
      return runTemplateAction(params)
    default:
      return { success: false, error: 'action 必须是 codec、text、regex、diff 或 template' }
  }
}
