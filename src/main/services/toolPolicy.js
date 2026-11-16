const FILE_WRITE_ACTIONS = new Set(['write', 'append', 'mkdir', 'copy'])
const FILE_DESTRUCTIVE_ACTIONS = new Set(['delete', 'move'])
const MEMORY_WRITE_ACTIONS = new Set(['add', 'update', 'remove'])

const FILE_ACTION_LABELS = {
  write: '写入文件',
  append: '追加文件',
  mkdir: '创建目录',
  copy: '复制文件',
  delete: '删除文件或目录',
  move: '移动或覆盖文件',
  list: '列出目录',
  read: '读取文件',
  search: '搜索文件',
  stat: '读取文件属性'
}

const PASSIVE_WRITE_TOOLS = new Set(['sql-script'])

export const RISK_LABELS = Object.freeze({
  read: '只读',
  write: '写入',
  destructive: '破坏性操作'
})

function describeTarget(args) {
  const candidates = [args?.path, args?.destination, args?.url, args?.pattern]
  const first = candidates.find((value) => typeof value === 'string' && value.trim())
  return first ? first.trim() : ''
}

function buildResult(level, key, summary, extra = {}) {
  return { level, key, summary, ...extra }
}

export function classifyToolRisk(name, args = {}) {
  const tool = typeof name === 'string' ? name : ''
  const action = typeof args?.action === 'string' ? args.action : ''

  if (tool.startsWith('mcp__')) {
    const rest = tool.slice(5)
    const separator = rest.indexOf('__')
    const server = separator > 0 ? rest.slice(0, separator) : rest
    const toolName = separator > 0 ? rest.slice(separator + 2) : tool
    return buildResult('write', `mcp:${server}:${toolName}`, `调用 MCP 工具 ${server}/${toolName}`)
  }

  if (tool === 'file-ops') {
    if (FILE_DESTRUCTIVE_ACTIONS.has(action)) {
      return buildResult('destructive', `file-ops:${action}`, FILE_ACTION_LABELS[action], { action })
    }
    if (FILE_WRITE_ACTIONS.has(action)) {
      return buildResult('write', `file-ops:${action}`, FILE_ACTION_LABELS[action], { action })
    }
    const label = FILE_ACTION_LABELS[action] || FILE_ACTION_LABELS[action === '' ? 'list' : 'stat']
    return buildResult('read', `file-ops:${action || 'list'}`, label, { action })
  }

  if (tool === 'memory') {
    if (action === 'clear') {
      return buildResult('destructive', 'memory:clear', '清空记忆', { action })
    }
    if (MEMORY_WRITE_ACTIONS.has(action)) {
      return buildResult('write', `memory:${action}`, `修改记忆（${action}）`, { action })
    }
    return buildResult('read', `memory:${action || 'list'}`, '查看记忆', { action })
  }

  if (tool === 'web-fetch') {
    return buildResult('read', 'web-fetch:*', `访问网页 ${describeTarget(args)}`.trim())
  }

  if (tool === 'db-query') {
    const scope = [action, args?.database, describeTarget(args)].filter(Boolean).join(' ')
    return buildResult('read', 'db-query:*', `查询数据库 ${scope}`.trim(), { action })
  }

  if (PASSIVE_WRITE_TOOLS.has(tool)) {
    return buildResult('write', `${tool}:*`, `生成文件（${tool}）`)
  }

  const known =
    tool === 'db-connect' ||
    tool === 'db-schema' ||
    tool === 'knowledge-search' ||
    tool === 'result-read' ||
    tool === 'subagent' ||
    tool === 'sql-config' ||
    tool === 'timestamp' ||
    tool === 'cron' ||
    tool === 'password' ||
    tool === 'json-format' ||
    tool === 'yaml-validate' ||
    tool === 'code-generate' ||
    tool === 'code-review' ||
    tool === 'doc-generate' ||
    tool === 'api-design' ||
    tool === 'sql-optimize' ||
    tool === 'dictionary-sql' ||
    tool === 'function-group-sql'

  if (known) {
    return buildResult('read', `${tool}:*`, `调用 ${tool}`)
  }

  return buildResult('write', `${tool || 'unknown'}:*`, `调用未登记工具 ${tool || 'unknown'}`)
}

export function needsApproval(level) {
  return level === 'write' || level === 'destructive'
}

export function summarizeToolArgs(name, args = {}) {
  if (!args || typeof args !== 'object') return ''
  const path = describeTarget(args)
  const action = typeof args.action === 'string' ? args.action : ''
  const parts = []
  if (action) parts.push(action)
  if (path) parts.push(path)
  if (typeof args.database === 'string' && args.database) parts.push(`库 ${args.database}`)
  if (typeof args.table_name === 'string' && args.table_name) parts.push(`表 ${args.table_name}`)
  return parts.join(' · ') || name
}
