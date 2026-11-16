export const MCP_TOOL_PREFIX = 'mcp__'

// 服务名不允许下划线，保证 mcp__<server>__<tool> 能用第一个双下划线切分
export const MCP_SERVER_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

const MAX_SERVERS = 16
const MAX_ARGS = 64
const MAX_ENV_ENTRIES = 32

export function isMcpToolName(name) {
  return typeof name === 'string' && name.startsWith(MCP_TOOL_PREFIX)
}

export function buildMcpToolName(server, tool) {
  const rawServer = String(server || '')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+/, '')
    .slice(0, 32)
  const safeServer = rawServer.replace(/-+$/, '') || 'server'
  const rawTool =
    String(tool || '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^_+/, '') || 'tool'
  const prefix = `${MCP_TOOL_PREFIX}${safeServer}__`
  return `${prefix}${rawTool.slice(0, Math.max(1, 64 - prefix.length))}`
}

export function parseMcpToolName(name) {
  if (!isMcpToolName(name)) return null
  const rest = name.slice(MCP_TOOL_PREFIX.length)
  const separator = rest.indexOf('__')
  if (separator <= 0 || separator === rest.length - 2) return null
  return { server: rest.slice(0, separator), tool: rest.slice(separator + 2) }
}

function normalizeEnv(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const env = {}
  let count = 0
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_ENV_ENTRIES) break
    const name = typeof key === 'string' ? key.trim() : ''
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) continue
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue
    env[name] = String(value)
    count += 1
  }
  return env
}

export function normalizeMcpServer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const name = typeof raw.name === 'string' ? raw.name.trim().toLowerCase() : ''
  if (!MCP_SERVER_NAME_PATTERN.test(name)) return null

  const command = typeof raw.command === 'string' ? raw.command.trim() : ''
  if (!command || command.includes('\0')) return null

  const args = Array.isArray(raw.args)
    ? raw.args
        .filter((arg) => typeof arg === 'string' && !arg.includes('\0'))
        .map((arg) => arg.trim())
        .filter(Boolean)
        .slice(0, MAX_ARGS)
    : []

  const server = {
    name,
    command,
    args,
    env: normalizeEnv(raw.env),
    enabled: raw.enabled !== false
  }

  const cwd = typeof raw.cwd === 'string' ? raw.cwd.trim() : ''
  if (cwd && !cwd.includes('\0')) server.cwd = cwd

  return server
}

export function normalizeMcpServers(raw) {
  if (!Array.isArray(raw)) return []
  const result = []
  const seen = new Set()
  for (const item of raw) {
    const server = normalizeMcpServer(item)
    if (!server || seen.has(server.name)) continue
    seen.add(server.name)
    result.push(server)
    if (result.length >= MAX_SERVERS) break
  }
  return result
}
