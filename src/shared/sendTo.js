export const SEND_KINDS = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image'
})

export const SEND_MAX_TEXT = 1024 * 1024

export const IMAGE_EXTENSIONS = Object.freeze(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'])

export const TEXT_DOCUMENT_EXTENSIONS = Object.freeze(['md', 'markdown', 'json', 'yaml', 'yml', 'html', 'htm'])

export const SEND_TARGETS = Object.freeze([
  { path: '/staging', accepts: [SEND_KINDS.TEXT], hint: '收集内容，稍后再处理' },
  { path: '/markdown-editor', accepts: [SEND_KINDS.TEXT], hint: '作为文档内容打开' },
  { path: '/json-parser', accepts: [SEND_KINDS.TEXT], hint: '解析并校验 JSON' },
  { path: '/yaml-editor', accepts: [SEND_KINDS.TEXT], hint: '解析并校验 YAML' },
  { path: '/html-viewer', accepts: [SEND_KINDS.TEXT], hint: '渲染 HTML 代码' },
  { path: '/http-client', accepts: [SEND_KINDS.TEXT], hint: '作为请求地址打开' },
  { path: '/unixtimestamp', accepts: [SEND_KINDS.TEXT], hint: '转换时间戳' },
  { path: '/image-viewer', accepts: [SEND_KINDS.IMAGE], hint: '打开这张图片' }
])

export const SEND_TRANSFER_TYPE = 'application/x-ntb-resource'

export function basenameOf(filePath) {
  if (typeof filePath !== 'string') return ''
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return index === -1 ? filePath : filePath.slice(index + 1)
}

export function dirnameOf(filePath) {
  if (typeof filePath !== 'string') return ''
  const index = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  if (index <= 0) return filePath.slice(0, Math.max(index, 0))
  return filePath.slice(0, index)
}

export function isImagePath(filePath) {
  const extension = extensionOf(filePath)
  return Boolean(extension) && IMAGE_EXTENSIONS.includes(extension)
}

export function isTextDocumentPath(filePath) {
  const extension = extensionOf(filePath)
  return Boolean(extension) && TEXT_DOCUMENT_EXTENSIONS.includes(extension)
}

export function sendKindForPath(filePath) {
  if (isImagePath(filePath)) return SEND_KINDS.IMAGE
  if (isTextDocumentPath(filePath)) return SEND_KINDS.TEXT
  return null
}

function extensionOf(filePath) {
  const name = basenameOf(filePath)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

export function normalizeSendResource(raw) {
  if (!raw || typeof raw !== 'object') return null

  if (raw.kind === SEND_KINDS.IMAGE) {
    const filePath = typeof raw.path === 'string' ? raw.path.trim() : ''
    if (!filePath || !isImagePath(filePath)) return null
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : ''
    return { kind: SEND_KINDS.IMAGE, title: title || basenameOf(filePath), path: filePath }
  }

  if (raw.kind === SEND_KINDS.TEXT) {
    const text = typeof raw.text === 'string' ? raw.text : ''
    if (!text.trim()) return null
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : ''
    return { kind: SEND_KINDS.TEXT, title, text: text.slice(0, SEND_MAX_TEXT) }
  }

  return null
}

export function canSendResourceTo(targetPath, kind) {
  const target = SEND_TARGETS.find((entry) => entry.path === targetPath)
  return Boolean(target && target.accepts.includes(kind))
}

export function getSendTargets(kind, excludePath = '') {
  return SEND_TARGETS.filter((target) => target.path !== excludePath && target.accepts.includes(kind))
}

export function encodeSendResource(resource) {
  const normalized = normalizeSendResource(resource)
  if (!normalized) return ''
  return JSON.stringify({ ntb: 1, ...normalized })
}

export function parseSendResource(serialized) {
  if (typeof serialized !== 'string' || !serialized) return null
  try {
    const parsed = JSON.parse(serialized)
    if (!parsed || parsed.ntb !== 1) return null
    return normalizeSendResource(parsed)
  } catch {
    return null
  }
}

function cellText(value) {
  if (value === null || value === undefined) return ''
  let text
  try {
    text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  } catch {
    text = String(value)
  }
  return text.replace(/\r?\n/g, ' ').replace(/\t/g, ' ')
}

export function buildRowsText(fields, rows) {
  const names = (fields || [])
    .map((field) => (typeof field === 'string' ? field : field?.name))
    .filter((name) => typeof name === 'string' && name)
  if (!names.length || !Array.isArray(rows) || !rows.length) return ''
  const lines = [names.join('\t')]
  for (const row of rows) {
    lines.push(names.map((name) => cellText(row?.[name])).join('\t'))
  }
  return lines.join('\n')
}
