import path from 'path'
import fs from 'fs'
import os from 'os'
import { spawn } from 'child_process'
import { t } from '../i18n.js'
import { log } from '../../utils'
import { getConfig } from '../config.js'
import { buildMcpToolName, isMcpToolName, normalizeMcpServers, parseMcpToolName } from '../../../shared/mcp.js'
import { getNetworkEnv } from '../network.js'
import { getDataDir } from '../../utils/path'

const PROTOCOL_VERSION = '2024-11-05'
const CLIENT_INFO = { name: 'NToolBox', version: '1.0.0' }
const REQUEST_TIMEOUT = 30 * 1000
const CALL_TIMEOUT = 2 * 60 * 1000
const MAX_BUFFER_SIZE = 4 * 1024 * 1024
const MAX_TOOLS_PER_SERVER = 200
const MEMORY_SERVER_PACKAGE = '@modelcontextprotocol/server-memory'

function trimError(error) {
  const text = String(error?.message || error || t('未知错误'))
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 300)
}

// 官方 memory 服务默认把知识图谱写进 npx 缓存目录，清缓存会连带删除；未显式配置时落到数据目录
function buildServerEnv(server) {
  const env = { ...process.env, ...getNetworkEnv(), ...server.env }
  const commandLine = [server.command, ...(server.args || [])].join(' ')
  if (!env.MEMORY_FILE_PATH && commandLine.includes(MEMORY_SERVER_PACKAGE)) {
    try {
      const memoryDir = path.join(getDataDir(), 'mcp')
      fs.mkdirSync(memoryDir, { recursive: true, mode: 0o700 })
      const memoryFile = path.join(memoryDir, 'memory.jsonl')
      migrateLegacyMemoryFile(memoryFile, server)
      env.MEMORY_FILE_PATH = memoryFile
    } catch (error) {
      log.warn(`MCP ${server.name} 记忆文件目录创建失败: ${error.message}`)
    }
  }
  return env
}

function npxCacheRoots() {
  const roots = []
  if (process.env.npm_config_cache) roots.push(path.join(process.env.npm_config_cache, '_npx'))
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    roots.push(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'))
  }
  roots.push(path.join(os.homedir(), '.npm', '_npx'))
  return roots
}

function migrateLegacyMemoryFile(target, server) {
  if (fs.existsSync(target)) return
  let newest = null
  for (const cacheRoot of npxCacheRoots()) {
    let entries
    try {
      entries = fs.readdirSync(cacheRoot, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const legacy = path.join(cacheRoot, entry.name, 'node_modules', MEMORY_SERVER_PACKAGE, 'dist', 'memory.jsonl')
      try {
        const stat = fs.statSync(legacy)
        if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { file: legacy, mtimeMs: stat.mtimeMs }
      } catch {
        // 未命中该 npx 缓存条目
      }
    }
  }
  if (!newest) return
  try {
    fs.copyFileSync(newest.file, target)
    if (process.platform !== 'win32') fs.chmodSync(target, 0o600)
    log.info(`MCP ${server.name} 旧记忆文件已迁移到 ${target}`)
  } catch (error) {
    log.warn(`MCP ${server.name} 旧记忆文件迁移失败: ${error.message}`)
  }
}

function spawnServer(server) {
  return new Promise((resolve, reject) => {
    const attempt = (command, overrideArgs) => {
      let child
      try {
        child = spawn(command, overrideArgs ?? server.args, {
          cwd: server.cwd || undefined,
          // MCP 子进程（npx/uvx）只认代理环境变量；server.env 优先于全局网络配置
          env: buildServerEnv(server),
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true
        })
      } catch (error) {
        reject(error)
        return
      }

      const onError = (error) => {
        child.removeListener('spawn', onSpawn)
        // Windows 下 npx/pnpm 等脚本需要带 .cmd 后缀才能被 spawn 解析
        if (process.platform === 'win32' && error.code === 'ENOENT' && !path.extname(server.command)) {
          attempt(`${server.command}.cmd`, server.args)
          return
        }
        if (error.code === 'ENOENT') {
          reject(
            new Error(t('启动命令 {p0} 不存在，请先安装该命令并确认它在 PATH 中', { p0: server.command }), {
              cause: error
            })
          )
          return
        }
        reject(error)
      }
      const onSpawn = () => {
        child.removeListener('error', onError)
        resolve(child)
      }

      child.once('error', onError)
      child.once('spawn', onSpawn)
    }

    attempt(server.command)
  })
}

export class McpClient {
  constructor(server) {
    this.server = server
    this.child = null
    this.buffer = ''
    this.nextId = 1
    this.pending = new Map()
    this.closed = false
    this.stderrTail = []
    this.onToolsChanged = null
    this.onExit = null
  }

  async start() {
    const child = await spawnServer(this.server)
    this.child = child

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => this._handleData(chunk))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => this._handleStderr(chunk))
    child.once('exit', (code, signal) => this._handleExit(code, signal))
    child.stdin.on('error', (error) => log.debug(`MCP ${this.server.name} stdin 写入失败: ${error.message}`))

    const init = await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO
    })
    this.notify('notifications/initialized', {})

    const tools = []
    let cursor = ''
    for (let page = 0; page < 10; page += 1) {
      const result = await this.request('tools/list', cursor ? { cursor } : {})
      if (Array.isArray(result?.tools)) tools.push(...result.tools)
      cursor = typeof result?.nextCursor === 'string' ? result.nextCursor : ''
      if (!cursor || tools.length >= MAX_TOOLS_PER_SERVER) break
    }

    log.info(
      `MCP 服务 ${this.server.name} 已连接，协议 ${init?.protocolVersion || PROTOCOL_VERSION}，工具 ${tools.length} 个`
    )
    return tools.slice(0, MAX_TOOLS_PER_SERVER)
  }

  request(method, params, timeout = REQUEST_TIMEOUT) {
    if (!this.child || this.closed) return Promise.reject(new Error(t('MCP 服务未连接')))

    const id = this.nextId
    this.nextId += 1

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(t('MCP 请求超时（{p0}，{p1} 秒）', { p0: method, p1: Math.round(timeout / 1000) })))
      }, timeout)

      this.pending.set(id, { resolve, reject, timer })
      try {
        this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`, 'utf8')
      } catch (error) {
        clearTimeout(timer)
        this.pending.delete(id)
        reject(error)
      }
    })
  }

  notify(method, params) {
    if (!this.child || this.closed) return
    try {
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`, 'utf8')
    } catch (error) {
      log.debug(`MCP ${this.server.name} 通知发送失败: ${error.message}`)
    }
  }

  callTool(toolName, args) {
    return this.request('tools/call', { name: toolName, arguments: args || {} }, CALL_TIMEOUT)
  }

  stop() {
    this.closed = true
    this._rejectPending(new Error(t('MCP 服务已停止')))
    if (!this.child) return
    const child = this.child
    this.child = null
    try {
      child.kill()
    } catch (error) {
      log.debug(`MCP ${this.server.name} 停止失败: ${error.message}`)
    }
  }

  _rejectPending(error) {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    this.pending.clear()
  }

  _handleStderr(chunk) {
    const text = String(chunk || '').trim()
    if (!text) return
    log.debug(`MCP ${this.server.name} stderr: ${text.slice(-500)}`)
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      this.stderrTail.push(trimmed.slice(0, 300))
      if (this.stderrTail.length > 20) this.stderrTail.shift()
    }
  }

  _handleData(chunk) {
    this.buffer += chunk
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer = ''
      log.warn(`MCP ${this.server.name} 输出超过上限，已丢弃缓冲区`)
      return
    }

    let index = this.buffer.indexOf('\n')
    while (index >= 0) {
      const line = this.buffer.slice(0, index).trim()
      this.buffer = this.buffer.slice(index + 1)
      if (line) this._handleLine(line)
      index = this.buffer.indexOf('\n')
    }
  }

  _handleLine(line) {
    let message
    try {
      message = JSON.parse(line)
    } catch {
      log.debug(`MCP ${this.server.name} 返回非 JSON 内容: ${line.slice(0, 200)}`)
      return
    }
    if (!message || typeof message !== 'object') return

    if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
      const entry = this.pending.get(message.id)
      if (!entry) return
      this.pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error) {
        entry.reject(new Error(trimError(message.error)))
      } else {
        entry.resolve(message.result)
      }
      return
    }

    if (message.id !== undefined && typeof message.method === 'string') {
      this.child?.stdin.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32601, message: `Unsupported method: ${message.method}` }
        })}\n`,
        'utf8'
      )
      return
    }

    if (message.method === 'notifications/tools/list_changed') {
      if (typeof this.onToolsChanged === 'function') this.onToolsChanged()
    }
  }

  _handleExit(code, signal) {
    const wasRunning = !this.closed
    this.closed = true
    this.child = null
    const detail = [...this.stderrTail].reverse().find((line) => /^error\b/i.test(line)) || this.stderrTail.at(-1)
    const message = detail
      ? t('MCP 服务已退出（code={p0}，signal={p1}）：{p2}', {
          p0: code ?? '-',
          p1: signal || '-',
          p2: detail
        })
      : t('MCP 服务已退出（code={p0}，signal={p1}）', { p0: code ?? '-', p1: signal || '-' })
    this._rejectPending(new Error(message))
    if (wasRunning) {
      log.warn(`MCP 服务 ${this.server.name} 意外退出（code=${code ?? '-'}，signal=${signal || '-'}）`)
      if (typeof this.onToolsChanged === 'function') this.onToolsChanged()
      if (typeof this.onExit === 'function') this.onExit({ code, signal })
    }
  }
}

class McpManager {
  constructor() {
    this.entries = new Map()
    this.toolIndex = new Map()
    this.reloading = null
  }

  async reload(rawServers) {
    if (this.reloading) await this.reloading.catch(() => {})
    this.reloading = this._reload(rawServers)
    try {
      return await this.reloading
    } finally {
      this.reloading = null
    }
  }

  async _reload(rawServers) {
    this._stopAll()
    const servers = normalizeMcpServers(rawServers)
    const enabled = servers.filter((server) => server.enabled)

    await Promise.all(
      enabled.map(async (server) => {
        const entry = {
          config: server,
          status: 'starting',
          error: '',
          tools: [],
          client: null
        }
        this.entries.set(server.name, entry)

        const client = new McpClient(server)
        client.onToolsChanged = () => {
          this._refreshTools(server.name).catch((error) => {
            log.warn(`MCP ${server.name} 刷新工具失败: ${trimError(error)}`)
          })
        }
        client.onExit = () => {
          entry.status = 'error'
          entry.error = t('MCP 服务已退出')
          entry.tools = []
          this._reindex()
        }
        entry.client = client

        try {
          const tools = await client.start()
          entry.tools = this._normalizeTools(server.name, tools)
          entry.status = 'ready'
          this._reindex()
        } catch (error) {
          entry.status = 'error'
          entry.error = trimError(error)
          entry.tools = []
          client.stop()
          log.warn(`MCP 服务 ${server.name} 启动失败: ${entry.error}`)
        }
      })
    )

    for (const server of servers) {
      if (server.enabled) continue
      this.entries.set(server.name, {
        config: server,
        status: 'disabled',
        error: '',
        tools: [],
        client: null
      })
    }

    return this.getStatus()
  }

  _normalizeTools(serverName, rawTools) {
    const tools = []
    const seen = new Set()
    for (const raw of rawTools) {
      const toolName = typeof raw?.name === 'string' ? raw.name.trim() : ''
      if (!toolName) continue

      const fullName = buildMcpToolName(serverName, toolName)
      if (seen.has(fullName)) continue
      seen.add(fullName)

      const schema =
        raw.inputSchema && typeof raw.inputSchema === 'object' && !Array.isArray(raw.inputSchema)
          ? raw.inputSchema
          : { type: 'object', properties: {} }

      tools.push({
        fullName,
        serverName,
        toolName,
        description: typeof raw.description === 'string' ? raw.description.trim() : '',
        parameters: schema,
        readOnly: raw.annotations?.readOnlyHint === true
      })
    }
    return tools
  }

  _reindex() {
    const index = new Map()
    for (const entry of this.entries.values()) {
      if (entry.status !== 'ready') continue
      for (const tool of entry.tools) index.set(tool.fullName, tool)
    }
    this.toolIndex = index
  }

  async _refreshTools(serverName) {
    const entry = this.entries.get(serverName)
    if (!entry?.client || entry.status !== 'ready') return

    const result = await entry.client.request('tools/list', {})
    entry.tools = this._normalizeTools(serverName, Array.isArray(result?.tools) ? result.tools : [])
    this._reindex()
  }

  getToolDefinitions() {
    return Array.from(this.toolIndex.values()).map((tool) => {
      const suffix = tool.description ? `：${tool.description}` : ''
      return {
        type: 'function',
        function: {
          name: tool.fullName,
          description: `[MCP:${tool.serverName}] ${tool.toolName}${suffix}`.slice(0, 1024),
          parameters: tool.parameters
        }
      }
    })
  }

  getSkill(name) {
    const tool = this.toolIndex.get(name)
    if (!tool) return null
    return {
      name: tool.fullName,
      description: `[MCP:${tool.serverName}] ${tool.description || tool.toolName}`,
      parameters: tool.parameters,
      type: 'mcp',
      mcp: { server: tool.serverName, tool: tool.toolName }
    }
  }

  async callTool(name, args) {
    const tool = this.toolIndex.get(name)
    if (!tool) {
      const parsed = parseMcpToolName(name)
      const serverName = parsed?.server || ''
      const entry = serverName ? this.entries.get(serverName) : null
      const detail = entry?.error ? `：${entry.error}` : ''
      return { success: false, error: t('MCP 工具 {p0} 不可用{p1}', { p0: name, p1: detail }) }
    }

    const entry = this.entries.get(tool.serverName)
    if (!entry?.client || entry.status !== 'ready') {
      return { success: false, error: t('MCP 服务 {p0} 未连接', { p0: tool.serverName }) }
    }

    try {
      const result = await entry.client.callTool(tool.toolName, args || {})
      const pieces = Array.isArray(result?.content) ? result.content : []
      const texts = pieces
        .filter((piece) => piece?.type === 'text' && typeof piece.text === 'string')
        .map((piece) => piece.text)
      const others = pieces
        .filter((piece) => piece?.type && piece.type !== 'text')
        .map((piece) => `[${piece.type} 内容]`)
      let content = [...texts, ...others].filter(Boolean).join('\n')

      if (!content && result?.structuredContent) content = JSON.stringify(result.structuredContent)
      if (!content) content = t('(MCP 工具未返回内容)')

      if (result?.isError) {
        return { success: false, error: content, metadata: { server: tool.serverName, tool: tool.toolName } }
      }

      return {
        success: true,
        content,
        metadata: { server: tool.serverName, tool: tool.toolName }
      }
    } catch (error) {
      return {
        success: false,
        error: trimError(error),
        metadata: { server: tool.serverName, tool: tool.toolName }
      }
    }
  }

  getStatus() {
    return Array.from(this.entries.values()).map((entry) => ({
      name: entry.config.name,
      command: entry.config.command,
      args: entry.config.args,
      enabled: entry.config.enabled,
      status: entry.status,
      error: entry.error,
      toolCount: entry.tools.length
    }))
  }

  stopAll() {
    this._stopAll()
  }

  _stopAll() {
    for (const entry of this.entries.values()) {
      entry.client?.stop()
    }
    this.entries.clear()
    this.toolIndex = new Map()
  }
}

const manager = new McpManager()

export async function initMcp(servers) {
  const source = servers === undefined ? getConfig().extensions?.mcp_servers : servers
  return await manager.reload(source)
}

export async function reloadMcpFromConfig() {
  return await initMcp()
}

export async function testMcpServer(rawServer) {
  const [server] = normalizeMcpServers([{ ...rawServer, enabled: true }])
  if (!server) {
    return { success: false, error: t('MCP 配置无效：服务名仅允许小写字母、数字和连字符，启动命令不能为空') }
  }

  const client = new McpClient(server)
  try {
    const tools = await client.start()
    return {
      success: true,
      toolCount: tools.length,
      tools: tools.map((tool) => tool.name).slice(0, 20)
    }
  } catch (error) {
    return { success: false, error: trimError(error) }
  } finally {
    client.stop()
  }
}

export function stopMcp() {
  manager.stopAll()
}

export function getMcpStatus() {
  return manager.getStatus()
}

export function getMcpToolDefinitions() {
  return manager.getToolDefinitions()
}

export function getMcpSkill(name) {
  return manager.getSkill(name)
}

export async function callMcpTool(name, args) {
  return await manager.callTool(name, args)
}

export { isMcpToolName }
