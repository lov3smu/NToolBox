import fs from 'fs'
import path from 'path'
import { t } from './i18n.js'
import { log } from '../utils'
import { getDataDir } from '../utils/path'
import { writeFileAtomic } from '../utils/atomicFile'
import { isPathWithinBase } from '../utils/sanitize'
import { getConfig, saveConfig } from './config.js'
import { getSkills, initSkills, installSkill, uninstallSkill } from './skills.js'
import { reloadMcpFromConfig } from './mcp.js'
import { normalizePluginManifest, PLUGIN_NAME_PATTERN } from '../../shared/pluginBundle.js'

const MAX_MCP_SERVERS = 16
const SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/

function getPluginDirectory() {
  return path.join(getDataDir(), 'plugins')
}

function getRegistryPath() {
  return path.join(getDataDir(), 'plugins.json')
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const name = typeof raw.name === 'string' ? raw.name.trim().toLowerCase() : ''
  if (!PLUGIN_NAME_PATTERN.test(name)) return null
  const toNames = (value) =>
    Array.isArray(value)
      ? value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : []
  return {
    name,
    version: typeof raw.version === 'string' ? raw.version : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    author: typeof raw.author === 'string' ? raw.author : '',
    source: typeof raw.source === 'string' ? raw.source : 'local',
    installedAt: typeof raw.installedAt === 'string' ? raw.installedAt : '',
    skills: toNames(raw.skills),
    connectors: toNames(raw.connectors)
  }
}

async function readRegistry() {
  try {
    const content = await fs.promises.readFile(getRegistryPath(), 'utf8')
    const parsed = JSON.parse(content)
    const list = Array.isArray(parsed?.plugins) ? parsed.plugins : []
    return list.map(normalizeRecord).filter(Boolean)
  } catch (error) {
    if (error.code !== 'ENOENT') log.error('读取插件注册表失败:', error)
    return []
  }
}

async function writeRegistry(records) {
  const registryPath = getRegistryPath()
  await fs.promises.mkdir(path.dirname(registryPath), { recursive: true, mode: 0o700 })
  await writeFileAtomic(registryPath, JSON.stringify({ plugins: records }, null, 2), 'utf8')
}

async function copyDirectory(source, target) {
  const entries = await fs.promises.readdir(source, { withFileTypes: true })
  await fs.promises.mkdir(target, { recursive: true })
  for (const entry of entries) {
    if (entry.name === 'node_modules') continue
    const from = path.join(source, entry.name)
    const to = path.join(target, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(from, to)
    } else if (entry.isFile()) {
      await fs.promises.copyFile(from, to)
    }
  }
}

async function readSkillManifest(skillDirectory) {
  const manifestPath = path.join(skillDirectory, 'skill.json')
  const content = await fs.promises.readFile(manifestPath, 'utf8')
  const definition = JSON.parse(content)
  const name = typeof definition?.name === 'string' ? definition.name.trim() : ''
  if (!SKILL_NAME_PATTERN.test(name)) {
    throw new Error(t('技能包 {p0} 的 name 字段无效', { p0: manifestPath }))
  }
  return {
    name,
    version: typeof definition?.version === 'string' ? definition.version : '',
    path: skillDirectory
  }
}

async function refreshMcpQuietly() {
  try {
    await reloadMcpFromConfig()
  } catch (error) {
    log.warn('插件安装后刷新连接器失败:', error?.message || error)
  }
}

export { getPluginDirectory }

export async function getInstalledPlugins() {
  const records = await readRegistry()
  const skillNames = new Set(getSkills().map((skill) => skill.name))
  const mcpServers = getConfig().extensions?.mcp_servers
  const configured = new Set((Array.isArray(mcpServers) ? mcpServers : []).map((server) => server?.name))

  return records
    .map((record) => ({
      ...record,
      path: path.join(getPluginDirectory(), record.name),
      missingSkills: record.skills.filter((name) => !skillNames.has(name)),
      missingConnectors: record.connectors.filter((name) => !configured.has(name)),
      canUninstall: true
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function installPluginBundle(pluginDirectory, { source = 'local' } = {}) {
  let root
  try {
    root = path.resolve(pluginDirectory)
    const stat = await fs.promises.stat(root)
    if (!stat.isDirectory()) {
      return { success: false, error: t('插件路径必须是一个目录') }
    }
  } catch {
    return { success: false, error: t('插件目录不存在：{p0}', { p0: pluginDirectory }) }
  }

  let manifest
  try {
    const content = await fs.promises.readFile(path.join(root, 'plugin.json'), 'utf8')
    const result = normalizePluginManifest(JSON.parse(content))
    if (result.error) return { success: false, error: result.error }
    manifest = result.manifest
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { success: false, error: t('插件目录缺少 plugin.json 定义文件') }
    }
    if (error instanceof SyntaxError) {
      return { success: false, error: t('plugin.json 无法解析') }
    }
    return { success: false, error: error.message }
  }

  await initSkills()

  const records = await readRegistry()
  if (records.some((record) => record.name === manifest.name)) {
    return { success: false, error: t('插件 {p0} 已安装，请先卸载', { p0: manifest.name }) }
  }

  const bundleTarget = path.join(getPluginDirectory(), manifest.name)
  if (fs.existsSync(bundleTarget)) {
    return { success: false, error: t('插件目录已存在：{p0}', { p0: bundleTarget }) }
  }

  const existingSkills = new Map(getSkills().map((skill) => [skill.name, skill]))
  const skills = []
  for (const relativePath of manifest.skills) {
    const skillDirectory = path.resolve(root, relativePath)
    if (!isPathWithinBase(skillDirectory, root)) {
      return { success: false, error: t('插件技能路径越界：{p0}', { p0: relativePath }) }
    }
    try {
      const stat = await fs.promises.stat(skillDirectory)
      if (!stat.isDirectory()) {
        return { success: false, error: t('插件技能路径不是目录：{p0}', { p0: relativePath }) }
      }
    } catch {
      return { success: false, error: t('插件技能目录不存在：{p0}', { p0: relativePath }) }
    }
    try {
      skills.push(await readSkillManifest(skillDirectory))
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
  const skillNameSet = new Set()
  for (const skill of skills) {
    if (skillNameSet.has(skill.name)) {
      return { success: false, error: t('插件内技能名称重复：{p0}', { p0: skill.name }) }
    }
    skillNameSet.add(skill.name)
    const existing = existingSkills.get(skill.name)
    if (existing) {
      return {
        success: false,
        error:
          existing.type === 'builtin'
            ? t('技能 {p0} 与内置技能冲突', { p0: skill.name })
            : t('技能 {p0} 已存在，请先卸载', { p0: skill.name })
      }
    }
  }

  const currentConfig = getConfig()
  const currentServers = Array.isArray(currentConfig?.extensions?.mcp_servers) ? currentConfig.mcp_servers : []
  const currentNames = new Set(currentServers.map((server) => server?.name))
  for (const connector of manifest.connectors) {
    if (currentNames.has(connector.name)) {
      return { success: false, error: t('连接器 {p0} 已存在，请先重命名或删除', { p0: connector.name }) }
    }
    currentNames.add(connector.name)
  }
  if (currentServers.length + manifest.connectors.length > MAX_MCP_SERVERS) {
    return { success: false, error: t('连接器总数不能超过 {p0} 个', { p0: MAX_MCP_SERVERS }) }
  }

  const installedSkills = []
  let configSaved = false
  try {
    await copyDirectory(root, bundleTarget)
    for (const skill of manifest.skills) {
      const result = await installSkill(path.join(bundleTarget, skill), { overwrite: false })
      if (!result.success) {
        throw new Error(result.error || t('安装技能 {p0} 失败', { p0: skill }))
      }
      installedSkills.push(result.name)
    }

    if (manifest.connectors.length) {
      const saved = await saveConfig({ extensions: { mcp_servers: [...currentServers, ...manifest.connectors] } })
      if (!saved) throw new Error(t('保存连接器配置失败'))
      configSaved = true
    }

    records.push({
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      source,
      installedAt: new Date().toISOString(),
      skills: installedSkills,
      connectors: manifest.connectors.map((connector) => connector.name)
    })
    await writeRegistry(records)

    if (manifest.connectors.length) await refreshMcpQuietly()

    log.info(`安装插件: ${manifest.name}（技能 ${installedSkills.length}，连接器 ${manifest.connectors.length}）`)
    return {
      success: true,
      name: manifest.name,
      version: manifest.version,
      skills: installedSkills,
      connectors: manifest.connectors.map((connector) => connector.name),
      path: bundleTarget,
      source
    }
  } catch (error) {
    for (const name of installedSkills) {
      await uninstallSkill(name).catch(() => {})
    }
    if (configSaved) {
      await saveConfig({ extensions: { mcp_servers: currentServers } }).catch(() => {})
      await refreshMcpQuietly()
    }
    await fs.promises.rm(bundleTarget, { recursive: true, force: true }).catch(() => {})
    log.error('安装插件失败:', error.message)
    return { success: false, error: error.message }
  }
}

export async function uninstallPlugin(name) {
  const records = await readRegistry()
  const record = records.find((item) => item.name === name)
  if (!record) {
    return { success: false, error: t('插件 {p0} 不存在', { p0: name }) }
  }

  const removedSkills = []
  const failedSkills = []
  for (const skillName of record.skills) {
    const result = await uninstallSkill(skillName)
    if (result.success) removedSkills.push(skillName)
    else failedSkills.push(skillName)
  }

  const currentServers = Array.isArray(getConfig().extensions?.mcp_servers) ? getConfig().extensions?.mcp_servers : []
  const removedConnectors = currentServers
    .filter((server) => record.connectors.includes(server?.name))
    .map((server) => server.name)
  if (removedConnectors.length) {
    const saved = await saveConfig({
      extensions: { mcp_servers: currentServers.filter((server) => !record.connectors.includes(server?.name)) }
    })
    if (!saved) {
      return { success: false, error: t('移除连接器配置失败') }
    }
    await refreshMcpQuietly()
  }

  const bundleTarget = path.join(getPluginDirectory(), record.name)
  if (isPathWithinBase(bundleTarget, getPluginDirectory())) {
    await fs.promises.rm(bundleTarget, { recursive: true, force: true }).catch(() => {})
  }

  await writeRegistry(records.filter((item) => item.name !== name))
  log.info(`卸载插件: ${name}（技能 ${removedSkills.length}，连接器 ${removedConnectors.length}）`)

  return {
    success: true,
    name,
    removedSkills,
    removedConnectors,
    failedSkills
  }
}
