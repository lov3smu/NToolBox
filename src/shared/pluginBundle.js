import { normalizeMcpServer } from './mcp.js'
import { normalizeSandbox } from './pluginSandbox.js'
import { SETTINGS_PATH, visibleTools } from './navTools.js'
import { SETTINGS_TAB_IDS } from './settingsTabs.js'
import { SEND_KINDS, SEND_TARGETS } from './sendTo.js'
import { TEMPLATE_CATEGORIES } from './templates.js'

export const PLUGIN_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/

export const PLUGIN_COMMAND_ID_PATTERN = PLUGIN_NAME_PATTERN

export const PLUGIN_COMMAND_ACTIONS = Object.freeze(['navigate', 'settings', 'send'])

const MAX_SKILLS = 32
const MAX_CONNECTORS = 16
const MAX_COMMANDS = 32
const MAX_TEMPLATES = 32
const MAX_TEXT = 20000

const TEXT_TARGETS = new Set(
  SEND_TARGETS.filter((target) => target.accepts.includes(SEND_KINDS.TEXT)).map((target) => target.path)
)
const NAVIGABLE_PATHS = new Set(visibleTools.map((tool) => tool.path))
const TEMPLATE_CATEGORY_IDS = new Set(TEMPLATE_CATEGORIES.map((category) => category.id))

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function normalizePluginCommand(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = cleanText(raw.id, 32).toLowerCase()
  if (!PLUGIN_COMMAND_ID_PATTERN.test(id)) return null
  const title = cleanText(raw.title, 80)
  if (!title) return null
  const action = cleanText(raw.action, 16)
  if (!PLUGIN_COMMAND_ACTIONS.includes(action)) return null
  const target = cleanText(raw.target, 120)
  const base = { id, title, subtitle: cleanText(raw.subtitle, 200), keywords: cleanText(raw.keywords, 200), action }
  if (action === 'send') {
    if (!TEXT_TARGETS.has(target)) return null
    const text = typeof raw.text === 'string' ? raw.text : ''
    if (!text.trim()) return null
    return { ...base, target, text: text.slice(0, MAX_TEXT) }
  }
  if (action === 'settings') {
    if (!SETTINGS_TAB_IDS.includes(target)) return null
    return { ...base, target }
  }
  if (!NAVIGABLE_PATHS.has(target) && target !== SETTINGS_PATH) return null
  return { ...base, target }
}

export function normalizePluginTemplate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const id = cleanText(raw.id, 32).toLowerCase()
  if (!PLUGIN_COMMAND_ID_PATTERN.test(id)) return null
  const name = cleanText(raw.name, 80)
  if (!name) return null
  const content = typeof raw.content === 'string' ? raw.content : ''
  if (!content.trim()) return null
  const category = cleanText(raw.category, 24) || 'docs'
  if (!TEMPLATE_CATEGORY_IDS.has(category)) return null
  const targetPath = cleanText(raw.targetPath, 120)
  if (targetPath && !TEXT_TARGETS.has(targetPath)) return null
  const tags = Array.isArray(raw.tags)
    ? raw.tags
        .map((tag) => cleanText(tag, 24))
        .filter(Boolean)
        .slice(0, 8)
    : []
  return {
    id,
    name,
    description: cleanText(raw.description, 200),
    category,
    targetPath: targetPath || null,
    tags,
    content: content.slice(0, MAX_TEXT)
  }
}

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

  const rawCommands = Array.isArray(raw.commands) ? raw.commands : []
  if (rawCommands.length > MAX_COMMANDS) {
    return { error: `插件包含的命令不能超过 ${MAX_COMMANDS} 个` }
  }
  const commands = []
  for (const item of rawCommands) {
    const command = normalizePluginCommand(item)
    if (!command) {
      return { error: `命令配置无效：${String(item?.id || item?.title || '未命名')}` }
    }
    if (commands.some((entry) => entry.id === command.id)) {
      return { error: `命令 ID 重复：${command.id}` }
    }
    commands.push(command)
  }

  const rawTemplates = Array.isArray(raw.templates) ? raw.templates : []
  if (rawTemplates.length > MAX_TEMPLATES) {
    return { error: `插件包含的模板不能超过 ${MAX_TEMPLATES} 个` }
  }
  const templates = []
  for (const item of rawTemplates) {
    const template = normalizePluginTemplate(item)
    if (!template) {
      return { error: `模板配置无效：${String(item?.id || item?.name || '未命名')}` }
    }
    if (templates.some((entry) => entry.id === template.id)) {
      return { error: `模板 ID 重复：${template.id}` }
    }
    templates.push(template)
  }

  const sandboxResult = normalizeSandbox(raw.sandbox)
  if (sandboxResult.error) {
    return { error: sandboxResult.error }
  }
  const sandbox = sandboxResult.sandbox

  if (!skills.length && !connectors.length && !commands.length && !templates.length && !sandbox.actions.length) {
    return { error: '插件至少需要包含一个技能、连接器、命令、模板或沙箱动作' }
  }

  const description = typeof raw.description === 'string' ? raw.description.trim().slice(0, 500) : ''
  const author = typeof raw.author === 'string' ? raw.author.trim().slice(0, 100) : ''

  return { manifest: { name, version, description, author, skills, connectors, commands, templates, sandbox } }
}
