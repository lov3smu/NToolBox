import { normalizeMcpServer } from './mcp.js'

export const PLUGIN_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

const MAX_SKILLS = 32
const MAX_CONNECTORS = 16

function normalizeRelativePath(value) {
  if (typeof value !== 'string') return ''
  const raw = value.trim().replace(/\\/g, '/')
  if (!raw || raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) return ''
  const parts = raw.split('/').filter((part) => part && part !== '.')
  if (!parts.length || parts.some((part) => part === '..')) return ''
  return parts.join('/')
}

export function normalizePluginManifest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'plugin.json 格式无效' }
  }

  const name = typeof raw.name === 'string' ? raw.name.trim().toLowerCase() : ''
  if (!PLUGIN_NAME_PATTERN.test(name)) {
    return { error: 'plugin.json 的 name 字段无效（仅允许小写字母、数字和连字符，最长 32 位）' }
  }

  const version = typeof raw.version === 'string' ? raw.version.trim() : ''
  if (version && !/^[0-9a-zA-Z][0-9a-zA-Z._+-]{0,31}$/.test(version)) {
    return { error: 'plugin.json 的 version 字段无效' }
  }

  const rawSkills = Array.isArray(raw.skills) ? raw.skills : []
  if (rawSkills.length > MAX_SKILLS) {
    return { error: `插件包含的技能不能超过 ${MAX_SKILLS} 个` }
  }
  const skills = []
  for (const item of rawSkills) {
    const relativePath = normalizeRelativePath(item)
    if (!relativePath) {
      return { error: `插件技能路径无效：${String(item)}` }
    }
    if (!skills.includes(relativePath)) skills.push(relativePath)
  }

  const rawConnectors = Array.isArray(raw.connectors) ? raw.connectors : []
  if (rawConnectors.length > MAX_CONNECTORS) {
    return { error: `插件包含的连接器不能超过 ${MAX_CONNECTORS} 个` }
  }
  const connectors = []
  for (const item of rawConnectors) {
    const server = normalizeMcpServer(item)
    if (!server) {
      return { error: `连接器配置无效：${String(item?.name || '未命名')}` }
    }
    if (connectors.some((entry) => entry.name === server.name)) {
      return { error: `连接器名称重复：${server.name}` }
    }
    connectors.push(server)
  }

  if (!skills.length && !connectors.length) {
    return { error: '插件至少需要包含一个技能或连接器' }
  }

  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 500) : ''
  const author = typeof raw.author === 'string' ? raw.author.trim().slice(0, 100) : ''

  return { manifest: { name, version, description, author, skills, connectors } }
}
