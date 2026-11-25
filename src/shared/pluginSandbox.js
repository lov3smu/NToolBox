import { CODEC_MODES } from './codec.js'
import { TEXT_OPERATIONS } from './textTools.js'

export const SANDBOX_MAX_ACTIONS = 16
export const SANDBOX_OUTPUT_MAX = 200000
export const SANDBOX_HTTP_PREVIEW = 4000
export const SANDBOX_STORAGE_MAX_BYTES = 32 * 1024

export const SANDBOX_OPS = Object.freeze(['toolbox', 'http', 'storage'])
export const SANDBOX_INPUTS = Object.freeze(['none', 'clipboard'])
export const SANDBOX_OUTPUTS = Object.freeze(['clipboard', 'notification'])
export const SANDBOX_TOOLBOX_ACTIONS = Object.freeze(['codec', 'text', 'regex', 'template'])

export const SANDBOX_PERMISSIONS = Object.freeze([
  { id: 'toolbox', label: '文本与编码工具', risk: 'low' },
  { id: 'clipboard.read', label: '读取剪贴板文本', risk: 'medium' },
  { id: 'clipboard.write', label: '写入剪贴板', risk: 'medium' },
  { id: 'notifications', label: '发送系统通知', risk: 'low' },
  { id: 'storage', label: '读写插件本地数据', risk: 'low' },
  { id: 'network', label: '访问插件声明的主机', risk: 'high' }
])

const ACTION_ID_RE = /^[a-z0-9][a-z0-9-]{0,31}$/
const STORAGE_KEY_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/
const CODEC_MODE_IDS = new Set(CODEC_MODES.map((mode) => mode.id))
const TEXT_OPERATION_IDS = new Set(TEXT_OPERATIONS.map((operation) => operation.id))
const REGEX_FLAGS = new Set(['g', 'i', 'm', 's', 'u'])
const ALLOWED_HTTP_HEADERS = new Set(['accept', 'content-type'])
const MAX_HTTP_BODY = 10000
const MAX_HTTP_TIMEOUT = 15000
const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  if (!host) return true
  if (host.startsWith('[') || host.includes(':')) return true
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  const match = host.match(IPV4_RE)
  if (match) {
    const [a, b] = [Number(match[1]), Number(match[2])]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  return false
}

export function normalizeSandboxHost(value) {
  const raw = cleanText(value, 253).toLowerCase().replace(/\.$/, '')
  if (!raw) return ''
  const host = raw.startsWith('*.') ? raw.slice(2) : raw
  if (isPrivateHost(host)) return ''
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) return ''
  return raw.startsWith('*.') ? `*.${host}` : host
}

export function isSandboxHostAllowed(hostname, allowedHosts) {
  const host = String(hostname || '').toLowerCase()
  return (Array.isArray(allowedHosts) ? allowedHosts : []).some((entry) =>
    entry.startsWith('*.') ? host.endsWith(entry.slice(1)) && host !== entry.slice(2) : host === entry
  )
}

function normalizeToolboxParams(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const action = cleanText(raw.action, 16)
  if (!SANDBOX_TOOLBOX_ACTIONS.includes(action)) return null
  if (action === 'codec') {
    const mode = cleanText(raw.mode, 16)
    if (!CODEC_MODE_IDS.has(mode)) return null
    return { action, mode, direction: raw.direction === 'decode' ? 'decode' : 'encode' }
  }
  if (action === 'text') {
    const operation = cleanText(raw.operation, 32)
    if (!TEXT_OPERATION_IDS.has(operation)) return null
    return { action, operation }
  }
  if (action === 'regex') {
    const pattern = typeof raw.pattern === 'string' ? raw.pattern : ''
    if (!pattern.trim() || pattern.length > 500) return null
    const flags = [...new Set(String(raw.flags || '').split(''))].filter((flag) => REGEX_FLAGS.has(flag)).join('')
    return { action, pattern, flags }
  }
  const templateId = cleanText(raw.template_id, 64)
  const query = cleanText(raw.query, 100)
  if (!templateId && !query) return null
  return templateId ? { action, template_id: templateId } : { action, query }
}

function normalizeHttpParams(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  let url
  try {
    url = new URL(raw.url)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password || isPrivateHost(url.hostname)) return null

  const method = raw.method === 'POST' ? 'POST' : 'GET'
  const body = method === 'POST' && typeof raw.body === 'string' ? raw.body.slice(0, MAX_HTTP_BODY) : ''
  const headers = {}
  if (raw.headers && typeof raw.headers === 'object' && !Array.isArray(raw.headers)) {
    for (const [name, value] of Object.entries(raw.headers)) {
      const key = name.toLowerCase()
      if (!ALLOWED_HTTP_HEADERS.has(key)) continue
      const text = cleanText(value, 200)
      if (text) headers[key] = text
    }
  }
  const timeoutMs = Math.min(
    MAX_HTTP_TIMEOUT,
    Math.max(1000, Number.isFinite(Number(raw.timeoutMs)) ? Math.round(Number(raw.timeoutMs)) : 10000)
  )
  const hosts = []
  const pushHost = (value) => {
    const host = normalizeSandboxHost(value)
    if (host && !hosts.includes(host) && hosts.length < 4) hosts.push(host)
  }
  pushHost(url.hostname)
  if (Array.isArray(raw.hosts)) raw.hosts.slice(0, 4).forEach(pushHost)

  return { url: url.toString(), method, body, headers, timeoutMs, hosts }
}

function normalizeStorageParams(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const key = cleanText(raw.key, 64)
  if (!STORAGE_KEY_RE.test(key)) return null
  const mode = raw.mode === 'set' || raw.mode === 'incr' ? raw.mode : 'get'
  const base = { key, mode }
  if (mode === 'set') {
    const value = raw.value
    const type = typeof value
    if (type === 'string' && value.length <= 1000) return { ...base, value }
    if (type === 'number' && Number.isFinite(value)) return { ...base, value }
    if (type === 'boolean') return { ...base, value }
    return null
  }
  if (mode === 'incr') {
    const delta = Number(raw.delta)
    return { ...base, delta: Number.isFinite(delta) ? Math.trunc(delta) : 1 }
  }
  return base
}

function normalizeParams(op, raw) {
  if (op === 'toolbox') return normalizeToolboxParams(raw)
  if (op === 'http') return normalizeHttpParams(raw)
  return normalizeStorageParams(raw)
}

export function sandboxPermissionsFor(action) {
  const permissions = new Set()
  if (action.op === 'toolbox') permissions.add('toolbox')
  if (action.op === 'http') permissions.add('network')
  if (action.op === 'storage') permissions.add('storage')
  if (action.input === 'clipboard') permissions.add('clipboard.read')
  if (action.output === 'clipboard') permissions.add('clipboard.write')
  if (action.output === 'notification') permissions.add('notifications')
  return [...permissions]
}

export function normalizeSandboxAction(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = cleanText(raw.id, 32).toLowerCase()
  if (!ACTION_ID_RE.test(id)) return null
  const title = cleanText(raw.title, 80)
  if (!title) return null
  const op = cleanText(raw.op, 16)
  if (!SANDBOX_OPS.includes(op)) return null
  const params = normalizeParams(op, raw.params)
  if (!params) return null
  const needsText = op === 'toolbox' && params.action !== 'template'
  const input = needsText ? 'clipboard' : 'none'
  const output = SANDBOX_OUTPUTS.includes(raw.output) ? raw.output : 'clipboard'
  const action = {
    id,
    title,
    description: cleanText(raw.description, 200),
    op,
    input,
    output,
    params,
    permissions: []
  }
  action.permissions = sandboxPermissionsFor(action)
  return action
}

export function normalizeSandbox(raw) {
  const empty = { actions: [], permissions: [] }
  if (raw === undefined || raw === null) return { sandbox: empty }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'plugin.json 的 sandbox 字段格式无效' }
  }
  const rawActions = Array.isArray(raw.actions) ? raw.actions : []
  if (rawActions.length > SANDBOX_MAX_ACTIONS) {
    return { error: `插件沙箱动作不能超过 ${SANDBOX_MAX_ACTIONS} 个` }
  }
  const actions = []
  for (const item of rawActions) {
    const action = normalizeSandboxAction(item)
    if (!action) {
      return { error: `沙箱动作配置无效：${String(item?.id || item?.title || '未命名')}` }
    }
    if (actions.some((entry) => entry.id === action.id)) {
      return { error: `沙箱动作 ID 重复：${action.id}` }
    }
    actions.push(action)
  }
  if (!actions.length && rawActions.length === 0 && Object.keys(raw).length > 0) {
    return { error: 'sandbox 字段需要包含至少一个动作' }
  }
  const permissions = [...new Set(actions.flatMap((action) => action.permissions))]
  return { sandbox: { actions, permissions } }
}

export function getSandboxPermission(id) {
  return SANDBOX_PERMISSIONS.find((permission) => permission.id === id) || null
}
