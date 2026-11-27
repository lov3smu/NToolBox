import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { buildConnectionConfig } from '../../shared/databaseConnection.js'
import { INLINE_AI_ACTIONS, INLINE_AI_MAX_CHARS } from '../../shared/inlineAi.js'
import { IPC_EVENTS } from '../../shared/ipc.js'
import { tools as navTools } from '../../shared/navTools.js'
import { log } from '../utils/index.js'
import { getMainWindow } from '../windows/index.js'
import { runInlineAi } from './ai/inline.js'
import { getConfig } from './config.js'
import { createConnection, isConnectionActive } from './database/index.js'
import { executeSkill } from './extensions/skills.js'
import { t } from './i18n.js'

// CLI 伴生：主进程内只监听 127.0.0.1 的窄接口，供 bin/ntb-cli.mjs 复用应用能力。
// 协议：POST {rpcUrl} + Bearer token，body 为 { cmd, args }；服务文件（含端口与 token）
// 写入系统临时目录，文件名 ntoolbox-cli-<pid>.json，权限 0600，退出时删除。
const SERVICE_PREFIX = 'ntoolbox-cli-'
const SERVICE_SUFFIX = '.json'
const RPC_PATH = '/rpc'
const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_TEXT_LENGTH = 200000
const DB_ACTIONS = ['databases', 'tables', 'query', 'schema']
const SCHEMA_ACTIONS = ['describe', 'show_create', 'show_indexes', 'show_columns']
const CONNECTION_SKILLS = new Set(['db-query', 'db-schema'])
const CURRENT_UID = typeof process.getuid === 'function' ? process.getuid() : null

export const CLI_COMMANDS = Object.freeze([
  'status',
  'codec',
  'text',
  'regex',
  'diff',
  'timestamp',
  'json',
  'db',
  'ai',
  'open'
])

let server = null
let serviceFile = ''
let token = ''
let appVersion = ''
let startedAt = 0

function compact(object) {
  const result = {}
  for (const [key, value] of Object.entries(object)) {
    if (value !== undefined) result[key] = value
  }
  return result
}

function readString(args, key, options = {}) {
  const value = args[key]
  if (value === undefined || value === null) {
    return options.required ? { error: t('缺少必填参数：{p0}', { p0: key }) } : {}
  }
  if (typeof value !== 'string') return { error: t('参数 {p0} 必须是字符串', { p0: key }) }
  if (value.length > (options.max || MAX_TEXT_LENGTH)) {
    return {
      error: t('参数 {p0} 超过长度上限（{p1} 字符）', { p0: key, p1: options.max || MAX_TEXT_LENGTH })
    }
  }
  if (options.required && !value.trim()) return { error: t('缺少必填参数：{p0}', { p0: key }) }
  return { value }
}

function readInteger(args, key, options = {}) {
  const value = args[key]
  if (value === undefined || value === null) {
    return options.required ? { error: t('缺少必填参数：{p0}', { p0: key }) } : {}
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return { error: t('参数 {p0} 必须是整数', { p0: key }) }
  return { value: parsed }
}

function readBoolean(args, key) {
  const value = args[key]
  return { value: value === true || value === 'true' }
}

function invalidValue(key, values) {
  return { ok: false, error: t('参数 {p0} 取值无效，可选值：{p1}', { p0: key, p1: values.join('、') }) }
}

function skillCommand(skill, params) {
  return { ok: true, kind: 'skill', skill, params }
}

export function resolveToolPath(target) {
  const value = typeof target === 'string' ? target.trim() : ''
  if (!value) return ''
  const direct = navTools.find((tool) => tool.path === value || tool.name === value)
  if (direct) return direct.path
  const normalized = value.startsWith('/') ? value : `/${value}`
  const byPath = navTools.find((tool) => tool.path === normalized)
  return byPath ? byPath.path : ''
}

export function normalizeCliCommand(cmd, args) {
  const name = typeof cmd === 'string' ? cmd.trim() : ''
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {}

  switch (name) {
    case 'status':
      return { ok: true, kind: 'status' }

    case 'codec': {
      const mode = readString(input, 'mode', { required: true })
      if (mode.error) return { ok: false, error: mode.error }
      const text = readString(input, 'text', { required: true })
      if (text.error) return { ok: false, error: text.error }
      const direction = input.direction === undefined ? 'encode' : input.direction
      if (direction !== 'encode' && direction !== 'decode') return invalidValue('direction', ['encode', 'decode'])
      return skillCommand('toolbox', { action: 'codec', mode: mode.value, direction, text: text.value })
    }

    case 'text': {
      const operation = readString(input, 'operation', { required: true })
      if (operation.error) return { ok: false, error: operation.error }
      const text = readString(input, 'text', { required: true })
      if (text.error) return { ok: false, error: text.error }
      return skillCommand('toolbox', { action: 'text', operation: operation.value, text: text.value })
    }

    case 'regex': {
      const pattern = readString(input, 'pattern', { required: true })
      if (pattern.error) return { ok: false, error: pattern.error }
      const text = readString(input, 'text', { required: true })
      if (text.error) return { ok: false, error: text.error }
      const flags = readString(input, 'flags')
      if (flags.error) return { ok: false, error: flags.error }
      const limit = readInteger(input, 'limit')
      if (limit.error) return { ok: false, error: limit.error }
      return skillCommand(
        'toolbox',
        compact({
          action: 'regex',
          pattern: pattern.value,
          text: text.value,
          flags: flags.value || '',
          limit: limit.value
        })
      )
    }

    case 'diff': {
      const left = readString(input, 'left', { required: true })
      if (left.error) return { ok: false, error: left.error }
      const right = readString(input, 'right', { required: true })
      if (right.error) return { ok: false, error: right.error }
      const limit = readInteger(input, 'limit')
      if (limit.error) return { ok: false, error: limit.error }
      return skillCommand(
        'toolbox',
        compact({
          action: 'diff',
          left: left.value,
          right: right.value,
          ignore_case: readBoolean(input, 'ignore_case').value,
          ignore_whitespace: readBoolean(input, 'ignore_whitespace').value,
          limit: limit.value
        })
      )
    }

    case 'timestamp': {
      const dateString = readString(input, 'date_string')
      if (dateString.error) return { ok: false, error: dateString.error }
      const timezone = readString(input, 'timezone')
      if (timezone.error) return { ok: false, error: timezone.error }
      const hasTimestamp = input.timestamp !== undefined && input.timestamp !== null && input.timestamp !== ''
      if (!hasTimestamp && !dateString.value) {
        return { ok: false, error: t('缺少必填参数：{p0}', { p0: 'timestamp' }) }
      }
      let timestamp
      if (hasTimestamp) {
        timestamp = Number(input.timestamp)
        if (!Number.isFinite(timestamp)) return { ok: false, error: t('参数 {p0} 必须是整数', { p0: 'timestamp' }) }
      }
      return skillCommand('timestamp', compact({ timestamp, date_string: dateString.value, timezone: timezone.value }))
    }

    case 'json': {
      const text = readString(input, 'text', { required: true })
      if (text.error) return { ok: false, error: text.error }
      const indent = readInteger(input, 'indent')
      if (indent.error) return { ok: false, error: indent.error }
      return skillCommand('json-format', compact({ json_string: text.value, indent: indent.value }))
    }

    case 'db': {
      const action = readString(input, 'action', { required: true })
      if (action.error) return { ok: false, error: action.error }
      if (!DB_ACTIONS.includes(action.value)) return invalidValue('action', DB_ACTIONS)
      const connection = readString(input, 'connection', { required: true })
      if (connection.error) return { ok: false, error: connection.error }
      const database = readString(input, 'database')
      if (database.error) return { ok: false, error: database.error }
      const limit = readInteger(input, 'limit')
      if (limit.error) return { ok: false, error: limit.error }

      if (action.value === 'databases' || action.value === 'tables') {
        return skillCommand(
          'db-query',
          compact({
            action: action.value === 'databases' ? 'list_databases' : 'list_tables',
            connection_name: connection.value,
            database: database.value,
            limit: limit.value
          })
        )
      }

      if (action.value === 'query') {
        const sql = readString(input, 'sql', { required: true })
        if (sql.error) return { ok: false, error: sql.error }
        const params = Array.isArray(input.params) ? input.params : undefined
        return skillCommand(
          'db-query',
          compact({
            action: 'execute',
            connection_name: connection.value,
            database: database.value,
            sql: sql.value,
            params,
            limit: limit.value
          })
        )
      }

      const table = readString(input, 'table', { required: true })
      if (table.error) return { ok: false, error: table.error }
      const schemaAction = input.schema_action === undefined ? 'describe' : String(input.schema_action)
      if (!SCHEMA_ACTIONS.includes(schemaAction)) return invalidValue('schema_action', SCHEMA_ACTIONS)
      return skillCommand(
        'db-schema',
        compact({
          action: schemaAction,
          connection_name: connection.value,
          database: database.value,
          table_name: table.value
        })
      )
    }

    case 'ai': {
      const action = readString(input, 'action', { required: true })
      if (action.error) return { ok: false, error: action.error }
      const text = readString(input, 'text', { required: true, max: INLINE_AI_MAX_CHARS })
      if (text.error) return { ok: false, error: text.error }
      return { ok: true, kind: 'ai', action: action.value, text: text.value }
    }

    case 'open': {
      const target = readString(input, 'target', { required: true })
      if (target.error) return { ok: false, error: target.error }
      const resolved = resolveToolPath(target.value)
      if (!resolved) return { ok: false, error: t('未找到可打开的工具或页面：{p0}', { p0: target.value }) }
      return { ok: true, kind: 'open', path: resolved }
    }

    default:
      return { ok: false, error: t('未知命令：{p0}', { p0: name || '—' }) }
  }
}

function toResponse(result) {
  if (!result || typeof result !== 'object') return { ok: false, error: t('工具执行失败') }
  if (result.success === false) {
    if (result.error) return { ok: false, error: String(result.error) }
    const content = typeof result.content === 'string' ? result.content.trim() : ''
    return { ok: false, error: content || t('工具执行失败') }
  }
  return {
    ok: true,
    content: typeof result.content === 'string' ? result.content : '',
    metadata: result.metadata && typeof result.metadata === 'object' ? result.metadata : null
  }
}

function statusResponse() {
  return {
    ok: true,
    content: t('NToolBox {p0} 正在运行（PID {p1}）', { p0: appVersion || '—', p1: process.pid }),
    metadata: {
      version: appVersion,
      pid: process.pid,
      startedAt,
      platform: process.platform,
      commands: [...CLI_COMMANDS],
      aiActions: INLINE_AI_ACTIONS.map((action) => action.id)
    }
  }
}

async function openTool(targetPath) {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return { ok: false, error: t('主窗口未就绪') }
  if (win.isMinimized()) win.restore()
  if (!win.isVisible()) win.show()
  win.focus()
  win.webContents.send(IPC_EVENTS.navigateTo, { path: targetPath })
  return { ok: true, content: t('已在 NToolBox 中打开：{p0}', { p0: targetPath }), metadata: { path: targetPath } }
}

// CLI 的数据库命令允许按名称直接使用已保存的连接：未激活时建立只读连接，
// 避免必须在界面上先手动连接；可写连接只来自用户自己在应用中建立的会话。
const connecting = new Map()

async function ensureReadOnlyConnection(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return { ok: false, error: t('缺少必填参数：{p0}', { p0: 'connection' }) }
  }
  if (isConnectionActive(name)) return { ok: true, saved: null }
  const saved = (getConfig().database?.connections || []).find((item) => item?.name === name)
  if (!saved) return { ok: false, error: t('未找到数据库连接：{p0}', { p0: name }) }

  if (!connecting.has(name)) {
    const task = createConnection(name, buildConnectionConfig(saved, { forceReadOnly: true }))
      .catch((error) => ({ success: false, error: error.message }))
      .finally(() => connecting.delete(name))
    connecting.set(name, task)
  }
  const result = await connecting.get(name)
  if (!result?.success) return { ok: false, error: result?.error || t('数据库连接失败') }
  return { ok: true, saved }
}

async function executeCommand(command) {
  if (command.kind === 'status') return statusResponse()
  if (command.kind === 'skill') {
    if (CONNECTION_SKILLS.has(command.skill)) {
      const connection = await ensureReadOnlyConnection(command.params.connection_name)
      if (!connection.ok) return { ok: false, error: connection.error }
      // SQLite 的库名就是文件名，未显式传 --database 时按保存的连接推导
      if (command.skill === 'db-schema' && !command.params.database && connection.saved?.engine === 'sqlite') {
        const filePath = String(connection.saved.filePath || '').trim()
        if (filePath) command.params.database = path.basename(filePath)
      }
    }
    return toResponse(await executeSkill(command.skill, command.params))
  }
  if (command.kind === 'ai') {
    const result = await runInlineAi({ action: command.action, text: command.text })
    if (!result || typeof result !== 'object') return { ok: false, error: t('工具执行失败') }
    if (result.success === false) return { ok: false, error: String(result.error || t('工具执行失败')) }
    return {
      ok: true,
      content: typeof result.content === 'string' ? result.content : '',
      metadata: { model: result.model || '', usage: result.usage || null }
    }
  }
  if (command.kind === 'open') return openTool(command.path)
  return { ok: false, error: t('未知命令：{p0}', { p0: String(command.kind) }) }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  })
  res.end(body)
}

function isLoopbackHost(header) {
  const host = typeof header === 'string' ? header.trim().toLowerCase() : ''
  return host === '127.0.0.1' || host.startsWith('127.0.0.1:')
}

function isAuthorized(req) {
  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : ''
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!provided || !token) return false
  const left = Buffer.from(provided)
  const right = Buffer.from(token)
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        const error = new Error(t('请求体过大'))
        error.status = 413
        req.destroy()
        reject(error)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        const error = new Error(t('请求格式错误'))
        error.status = 400
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

async function handleRequest(req, res) {
  if (req.method !== 'POST' || !req.url || req.url.split('?')[0] !== RPC_PATH) {
    sendJson(res, 404, { ok: false, error: t('接口不存在') })
    return
  }
  // 拒绝浏览器跨源请求，避免任意网页探测本机接口
  if (req.headers.origin) {
    sendJson(res, 403, { ok: false, error: t('仅接受本机请求') })
    return
  }
  if (!isLoopbackHost(req.headers.host)) {
    sendJson(res, 403, { ok: false, error: t('仅接受本机请求') })
    return
  }
  if (!isAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: t('未授权的请求') })
    return
  }
  const contentType = String(req.headers['content-type'] || '').toLowerCase()
  if (!contentType.startsWith('application/json')) {
    sendJson(res, 415, { ok: false, error: t('请求格式错误') })
    return
  }

  let payload
  try {
    payload = await readJsonBody(req)
  } catch (error) {
    sendJson(res, error.status || 400, { ok: false, error: error.message || t('请求格式错误') })
    return
  }

  const command = normalizeCliCommand(payload?.cmd, payload?.args)
  if (!command.ok) {
    sendJson(res, 400, { ok: false, error: command.error })
    return
  }

  try {
    sendJson(res, 200, await executeCommand(command))
  } catch (error) {
    log.warn('CLI 命令执行失败:', error.message)
    sendJson(res, 500, { ok: false, error: t('请求处理失败') })
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return pid === process.pid
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

function writeServiceFile(file, info) {
  fs.writeFileSync(file, JSON.stringify(info), { encoding: 'utf8', mode: 0o600 })
}

function cleanupStaleServiceFiles(serviceDir) {
  let names
  try {
    names = fs.readdirSync(serviceDir)
  } catch {
    return
  }
  for (const name of names) {
    if (!name.startsWith(SERVICE_PREFIX) || !name.endsWith(SERVICE_SUFFIX)) continue
    const file = path.join(serviceDir, name)
    try {
      const info = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (CURRENT_UID !== null && info?.uid !== CURRENT_UID) continue
      if (file === serviceFile) continue
      if (!isProcessAlive(info?.pid)) fs.unlinkSync(file)
    } catch {
      // 无法解析的残留文件交给用户或下次启动处理
    }
  }
}

export async function startCliServer(options = {}) {
  if (server) return { rpcUrl: `http://127.0.0.1:${server.address().port}${RPC_PATH}` }
  const serviceDir = typeof options.serviceDir === 'string' && options.serviceDir ? options.serviceDir : os.tmpdir()
  appVersion = typeof options.version === 'string' ? options.version : ''
  startedAt = Date.now()
  token = crypto.randomBytes(32).toString('hex')

  const instance = http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      log.warn('CLI 伴生服务请求失败:', error.message)
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: t('请求处理失败') })
    })
  })

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server = null
      reject(error)
    }
    instance.once('error', onError)
    instance.listen(0, '127.0.0.1', () => {
      instance.off('error', onError)
      resolve()
    })
  })

  server = instance
  server.on('error', (error) => log.warn('CLI 伴生服务异常:', error.message))

  const { port } = server.address()
  serviceFile = path.join(serviceDir, `${SERVICE_PREFIX}${process.pid}${SERVICE_SUFFIX}`)
  const info = {
    rpcUrl: `http://127.0.0.1:${port}${RPC_PATH}`,
    token,
    pid: process.pid,
    uid: CURRENT_UID,
    version: appVersion,
    startedAt
  }
  try {
    writeServiceFile(serviceFile, info)
  } catch (error) {
    log.warn('写入 CLI 服务文件失败:', error.message)
  }
  cleanupStaleServiceFiles(serviceDir)
  log.info(`CLI 伴生服务已启动：127.0.0.1:${port}`)
  return info
}

export function stopCliServer() {
  if (serviceFile) {
    try {
      fs.unlinkSync(serviceFile)
    } catch {
      // 已被清理或临时目录不可写
    }
    serviceFile = ''
  }
  token = ''
  if (!server) return
  const instance = server
  server = null
  try {
    instance.closeAllConnections?.()
    instance.close()
  } catch {
    // 关闭失败不影响退出流程
  }
}
