import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import { pathToFileURL } from 'url'
import { log } from '../utils'
import { isPathWithinBase } from '../utils/sanitize'
import { getConfig } from './config'
import { getProvider, resolveProviderModels, resolveProviderDefaultModel } from './ai/index.js'
import { generateDictionarySql, generateDictionarySqlBatch, generateFunctionGroupSql } from './templateGenerator.js'
import * as database from './database.js'
import { generateSQLFile } from './generator.js'
import { fetchClawHubMarket, fetchClawHubSkillDetail, normalizeSkillName, searchClawHubSkills } from './clawhub.js'

const BUILTIN_SKILLS_PATH = path.join(__dirname, '../skills/builtin')
const MARKET_SKILLS_PATH = path.join(__dirname, '../skills/market')
const REMOTE_MARKET_TTL = 5 * 60 * 1000
const REMOTE_MARKET_LIMIT = 60

function getUserSkillsPath() {
  return path.join(app.getPath('userData'), 'skills')
}

function compareVersions(a, b) {
  const parse = (value) =>
    String(value || '0')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0)
  const left = parse(a)
  const right = parse(b)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const diff = (left[index] || 0) - (right[index] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

class SkillsManager {
  constructor() {
    this.skills = new Map()
    this.loaded = false
    this.remoteMarket = []
    this.remoteMarketFetchedAt = 0
    this.remoteMarketError = ''
    this.remoteMarketLoading = null
  }

  async loadSkills() {
    if (this.loaded) return

    log.info('开始加载 Skills...')
    log.info('__dirname:', __dirname)
    log.info('BUILTIN_SKILLS_PATH:', BUILTIN_SKILLS_PATH)
    log.info('USER_SKILLS_PATH:', getUserSkillsPath())

    await this._loadBuiltinSkills()
    await this._loadUserSkills()

    this.loaded = true
    log.info(`Skills 加载完成，共 ${this.skills.size} 个`)
  }

  async _loadBuiltinSkills() {
    try {
      log.info('检查内置 Skills 目录是否存在:', BUILTIN_SKILLS_PATH)
      if (!fs.existsSync(BUILTIN_SKILLS_PATH)) {
        log.warn('内置 Skills 目录不存在')
        return
      }

      log.info('内置 Skills 目录存在，开始读取...')
      const dirs = await fs.promises.readdir(BUILTIN_SKILLS_PATH)
      log.info('找到 Skills 目录:', dirs.length, '个')

      for (const dir of dirs) {
        const skillPath = path.join(BUILTIN_SKILLS_PATH, dir)
        if (fs.statSync(skillPath).isDirectory()) {
          await this._loadSkill(skillPath, 'builtin')
        }
      }
    } catch (error) {
      log.error('加载内置 Skills 失败:', error)
    }
  }

  async _loadUserSkills() {
    try {
      const userSkillsPath = getUserSkillsPath()
      if (!fs.existsSync(userSkillsPath)) {
        await fs.promises.mkdir(userSkillsPath, { recursive: true })
        return
      }

      const dirs = await fs.promises.readdir(userSkillsPath)

      for (const dir of dirs) {
        const skillPath = path.join(userSkillsPath, dir)
        if (fs.statSync(skillPath).isDirectory()) {
          await this._loadSkill(skillPath, 'user')
        }
      }
    } catch (error) {
      log.error('加载用户 Skills 失败:', error)
    }
  }

  async _loadSkill(skillPath, type) {
    const skillJsonPath = path.join(skillPath, 'skill.json')

    if (!fs.existsSync(skillJsonPath)) {
      log.warn(`Skill ${skillPath} 缺少 skill.json`)
      return
    }

    try {
      const content = await fs.promises.readFile(skillJsonPath, 'utf8')
      const skillDef = JSON.parse(content)

      if (!skillDef.name || !skillDef.description) {
        log.warn(`Skill ${skillPath} 缺少必要字段`)
        return
      }

      skillDef.type = type
      skillDef.path = skillPath

      if (skillDef.handler) {
        const handlerPath = path.join(skillPath, skillDef.handler)
        if (fs.existsSync(handlerPath)) {
          skillDef.handlerPath = handlerPath
        }
      }

      if (skillDef.promptTemplate) {
        const promptPath = path.join(skillPath, skillDef.promptTemplate)
        if (fs.existsSync(promptPath)) {
          skillDef.promptContent = await fs.promises.readFile(promptPath, 'utf8')
        }
      }

      this.skills.set(skillDef.name, skillDef)
      log.info(`加载 Skill: ${skillDef.name} (${type})`)
    } catch (error) {
      log.error(`加载 Skill ${skillPath} 失败:`, error)
    }
  }

  getSkills() {
    return Array.from(this.skills.values()).map((skill) => ({
      name: skill.name,
      version: skill.version,
      description: skill.description,
      author: skill.author,
      type: skill.type,
      builtin: skill.type === 'builtin',
      canUninstall: skill.type !== 'builtin',
      category: skill.category,
      tags: skill.tags || [],
      icon: skill.icon,
      parameters: skill.parameters,
      examples: skill.examples || [],
      path: skill.path,
      source: skill.source?.type || 'local',
      sourceUrl: skill.source?.url || '',
      hasHandler: Boolean(skill.handlerPath),
      hasPrompt: Boolean(skill.promptContent)
    }))
  }

  getSkill(name) {
    return this.skills.get(name)
  }

  getToolDefinitions() {
    return Array.from(this.skills.values()).map((skill) => ({
      type: 'function',
      function: {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters
      }
    }))
  }

  async executeSkill(name, params) {
    const skill = this.skills.get(name)

    if (!skill) {
      return { success: false, error: `Skill ${name} 不存在` }
    }

    log.info(`执行 Skill: ${name}`, params)

    try {
      if (skill.handlerPath) {
        return await this._executeHandler(skill, params)
      } else if (skill.promptContent) {
        return await this._executePrompt(skill, params)
      } else {
        return { success: false, error: `Skill ${name} 没有有效的执行方式` }
      }
    } catch (error) {
      log.error(`执行 Skill ${name} 失败:`, error)
      return { success: false, error: error.message }
    }
  }

  async _executeHandler(skill, params) {
    try {
      log.info(`Handler 执行开始: ${skill.name}`)
      log.info(`Handler 路径: ${skill.handlerPath}`)

      const handlerPath = pathToFileURL(skill.handlerPath).href
      log.info(`Handler URL: ${handlerPath}`)

      const handlerModule = await import(handlerPath)
      const handler = handlerModule.default || handlerModule.handler

      if (!handler || typeof handler !== 'function') {
        return { success: false, error: 'Handler 不是有效的函数' }
      }

      const config = getConfig()
      const context = {
        config,
        log,
        skill,
        database,
        getConfig,
        generateSQLFile,
        executeDictionarySql: (params) => {
          if (params.dict_list) return generateDictionarySqlBatch(params)
          return generateDictionarySql(params)
        },
        executeFunctionGroupSql: generateFunctionGroupSql
      }

      log.info(`开始调用 handler 函数`)
      const result = await handler(params, context)
      log.info(`Handler 执行完成: ${JSON.stringify(result)}`)

      if (result && typeof result === 'object') {
        return result
      }

      return { success: true, content: String(result) }
    } catch (error) {
      log.error(`Handler 执行失败:`, error)
      log.error(`错误堆栈:`, error.stack)
      return { success: false, error: error.message }
    }
  }

  async _executePrompt(skill, params) {
    let prompt = skill.promptContent

    for (const [key, value] of Object.entries(params)) {
      prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '')
    }

    const config = getConfig()
    const providerType = config.ai_provider || 'bailian'
    const apiKeys = config.ai_api_keys || {}

    const providerConfig = {
      apiKey: apiKeys[providerType] || '',
      models: resolveProviderModels(providerType, config.ai_models),
      defaultModel: resolveProviderDefaultModel(providerType, config.ai_models, apiKeys.volcengine_endpoint_id || '')
    }

    if (providerType === 'minimax') {
      providerConfig.groupId = apiKeys.minimax_group_id || ''
    }
    if (providerType === 'volcengine') {
      providerConfig.endpointId = apiKeys.volcengine_endpoint_id || ''
    }

    const provider = getProvider(providerType, providerConfig)

    if (!provider) {
      return { success: false, error: `未知的 AI Provider: ${providerType}` }
    }

    const validation = provider.validateConfig()
    if (!validation.valid) {
      return { success: false, error: `${provider.name} ${validation.error}` }
    }

    const messages = [{ role: 'user', content: prompt }]

    const result = await provider.chat(messages, [], { model: provider.getDefaultModel() })

    if (!result.success) {
      return { success: false, error: result.error || 'AI 调用失败' }
    }

    return {
      success: true,
      content: result.content,
      metadata: { provider: provider.name }
    }
  }

  async installSkill(skillPath, { overwrite = false } = {}) {
    try {
      if (!skillPath || !fs.existsSync(skillPath)) {
        return { success: false, error: 'Skill 路径不存在' }
      }

      const skillJsonPath = path.join(skillPath, 'skill.json')
      if (!fs.existsSync(skillJsonPath)) {
        return { success: false, error: '缺少 skill.json 定义文件' }
      }

      const content = await fs.promises.readFile(skillJsonPath, 'utf8')
      const skillDef = JSON.parse(content)

      if (!skillDef.name || !/^[a-z0-9][a-z0-9-]*$/.test(skillDef.name)) {
        return { success: false, error: 'skill.json 的 name 字段无效（仅允许小写字母、数字和连字符）' }
      }

      const existing = this.skills.get(skillDef.name)
      if (existing?.type === 'builtin') {
        return { success: false, error: `内置技能 ${skillDef.name} 不能覆盖` }
      }
      if (existing && !overwrite) {
        return { success: false, error: `Skill ${skillDef.name} 已存在` }
      }

      const targetPath = path.join(getUserSkillsPath(), skillDef.name)

      if (existing) {
        await this._removeDir(existing.path)
        this.skills.delete(skillDef.name)
      } else if (fs.existsSync(targetPath)) {
        await this._removeDir(targetPath)
      }

      await this._copyDir(skillPath, targetPath)
      await this._loadSkill(targetPath, 'user')

      log.info(`安装 Skill: ${skillDef.name}`)
      return { success: true, name: skillDef.name, version: skillDef.version }
    } catch (error) {
      log.error('安装 Skill 失败:', error)
      return { success: false, error: error.message }
    }
  }

  async uninstallSkill(name) {
    const skill = this.skills.get(name)

    if (!skill) {
      return { success: false, error: `Skill ${name} 不存在` }
    }

    if (skill.type === 'builtin') {
      return { success: false, error: '内置 Skill 不能卸载' }
    }

    if (!isPathWithinBase(skill.path, getUserSkillsPath())) {
      return { success: false, error: 'Skill 目录不在用户扩展目录内，已拒绝删除' }
    }

    try {
      if (fs.existsSync(skill.path)) {
        await this._removeDir(skill.path)
      }

      this.skills.delete(name)
      log.info(`卸载 Skill: ${name}`)
      return { success: true }
    } catch (error) {
      log.error('卸载 Skill 失败:', error)
      return { success: false, error: error.message }
    }
  }

  async _findMarketSkill(name) {
    if (!fs.existsSync(MARKET_SKILLS_PATH)) return null

    const entries = await fs.promises.readdir(MARKET_SKILLS_PATH, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = path.join(MARKET_SKILLS_PATH, entry.name)
      const definitionPath = path.join(skillPath, 'skill.json')
      if (!fs.existsSync(definitionPath)) continue

      try {
        const definition = JSON.parse(await fs.promises.readFile(definitionPath, 'utf8'))
        if (definition.name === name) {
          return { path: skillPath, definition }
        }
      } catch (error) {
        log.warn(`读取市场 Skill ${entry.name} 失败:`, error.message)
      }
    }

    return null
  }

  async _readBundledMarketSkills() {
    if (!fs.existsSync(MARKET_SKILLS_PATH)) return []

    const marketSkills = []
    const entries = await fs.promises.readdir(MARKET_SKILLS_PATH, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillPath = path.join(MARKET_SKILLS_PATH, entry.name)
      const definitionPath = path.join(skillPath, 'skill.json')
      if (!fs.existsSync(definitionPath)) continue

      try {
        const definition = JSON.parse(await fs.promises.readFile(definitionPath, 'utf8'))
        if (!definition.name || !definition.description) continue

        marketSkills.push({
          name: definition.name,
          version: definition.version,
          description: definition.description,
          author: definition.author,
          category: definition.category,
          tags: definition.tags || [],
          icon: definition.icon,
          parameters: definition.parameters,
          examples: definition.examples || [],
          featured: Boolean(definition.featured),
          downloads: Number(definition.downloads) || 0,
          changelog: definition.changelog || '',
          source: 'bundled',
          sourceUrl: '',
          remote: false
        })
      } catch (error) {
        log.warn(`读取市场 Skill ${entry.name} 失败:`, error.message)
      }
    }

    return marketSkills
  }

  _decorateMarketSkill(skill) {
    const installed = this.skills.get(skill.name)
    let status = 'available'

    if (installed?.type === 'builtin') {
      status = 'builtin'
    } else if (installed) {
      status = skill.version && compareVersions(skill.version, installed.version) > 0 ? 'update' : 'installed'
    }

    return {
      ...skill,
      installed: Boolean(installed),
      installedVersion: installed?.version || '',
      installedType: installed?.type || '',
      status
    }
  }

  async _getRemoteMarket({ refresh = false } = {}) {
    const now = Date.now()

    if (!refresh && this.remoteMarketFetchedAt && now - this.remoteMarketFetchedAt < REMOTE_MARKET_TTL) {
      return {
        ok: !this.remoteMarketError,
        error: this.remoteMarketError,
        items: this.remoteMarket,
        fetchedAt: this.remoteMarketFetchedAt
      }
    }

    if (this.remoteMarketLoading) return this.remoteMarketLoading

    this.remoteMarketLoading = (async () => {
      try {
        const items = await fetchClawHubMarket({ limit: REMOTE_MARKET_LIMIT })
        this.remoteMarket = items
        this.remoteMarketFetchedAt = Date.now()
        this.remoteMarketError = ''
        return { ok: true, error: '', items, fetchedAt: this.remoteMarketFetchedAt }
      } catch (error) {
        this.remoteMarketError = error.message
        log.warn('获取 ClawHub 扩展列表失败:', error.message)
        return {
          ok: false,
          error: error.message,
          items: this.remoteMarket,
          fetchedAt: this.remoteMarketFetchedAt
        }
      } finally {
        this.remoteMarketLoading = null
      }
    })()

    return this.remoteMarketLoading
  }

  async getMarketSkills({ refresh = false } = {}) {
    const bundled = await this._readBundledMarketSkills()
    const remote = await this._getRemoteMarket({ refresh })
    const merged = new Map()

    for (const skill of bundled) merged.set(skill.name, skill)

    let remoteCount = 0
    for (const skill of remote.items) {
      if (merged.has(skill.name)) continue
      merged.set(skill.name, skill)
      remoteCount += 1
    }

    const items = Array.from(merged.values())
      .map((skill) => this._decorateMarketSkill(skill))
      .sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          (b.downloads || 0) - (a.downloads || 0) ||
          a.name.localeCompare(b.name)
      )

    return {
      items,
      sources: { bundled: bundled.length, clawhub: remoteCount },
      remote: { ok: remote.ok, error: remote.error, fetchedAt: remote.fetchedAt }
    }
  }

  _checkMarketInstall(name, version) {
    const installed = this.skills.get(name)

    if (installed?.type === 'builtin') {
      return { installed, error: '内置技能无需安装，也不能被市场版本覆盖' }
    }

    if (installed && (!version || compareVersions(version, installed.version) <= 0)) {
      return { installed, error: `技能 ${name} 已安装` }
    }

    return { installed, error: '' }
  }

  async installMarketSkill(name) {
    try {
      const bundled = await this._findMarketSkill(name)
      if (bundled) return await this._installBundledMarketSkill(bundled)

      const remote = await this._findRemoteMarketSkill(name)
      if (remote) return await this._installRemoteMarketSkill(remote)

      return { success: false, error: `扩展市场中不存在技能 ${name}` }
    } catch (error) {
      log.error('从扩展市场安装 Skill 失败:', error)
      return { success: false, error: error.message }
    }
  }

  async _installBundledMarketSkill({ definition, path: sourcePath }) {
    const check = this._checkMarketInstall(definition.name, definition.version)
    if (check.error) return { success: false, error: check.error }

    const userSkillsPath = getUserSkillsPath()
    const targetPath = path.join(userSkillsPath, definition.name)

    if (!isPathWithinBase(targetPath, userSkillsPath)) {
      return { success: false, error: '扩展目录无效，已拒绝安装' }
    }
    if (check.installed && !isPathWithinBase(check.installed.path, userSkillsPath)) {
      return { success: false, error: '已安装扩展目录异常，已拒绝覆盖' }
    }

    if (check.installed) {
      await this._removeDir(check.installed.path)
      this.skills.delete(definition.name)
    } else if (fs.existsSync(targetPath)) {
      await this._removeDir(targetPath)
    }

    await this._copyDir(sourcePath, targetPath)
    await this._loadSkill(targetPath, 'user')

    log.info(`从扩展目录安装 Skill: ${definition.name}@${definition.version}`)
    return {
      success: true,
      name: definition.name,
      version: definition.version,
      updated: Boolean(check.installed)
    }
  }

  async _findRemoteMarketSkill(name) {
    const normalized = normalizeSkillName(name)
    if (!normalized) return null

    const cached = this.remoteMarket.find((skill) => skill.name === normalized)
    if (cached) return cached

    try {
      const results = await searchClawHubSkills(normalized, { limit: 10 })
      const found = results.find((skill) => skill.name === normalized) || results.find((skill) => skill.slug === name)
      if (!found) return null

      if (!this.remoteMarket.some((skill) => skill.name === found.name)) {
        this.remoteMarket = [...this.remoteMarket, found]
      }
      return found
    } catch (error) {
      log.warn(`搜索 ClawHub 技能 ${name} 失败:`, error.message)
      return null
    }
  }

  async _installRemoteMarketSkill(entry) {
    const name = normalizeSkillName(entry.name || entry.slug)
    if (!name) return { success: false, error: '在线扩展名称无效' }

    const detail = await fetchClawHubSkillDetail({ ownerHandle: entry.ownerHandle, slug: entry.slug })
    const version = detail.version || entry.version || '1.0.0'
    const check = this._checkMarketInstall(name, detail.version || entry.version)
    if (check.error) return { success: false, error: check.error }

    const promptBody = (detail.body || '').trim()
    if (!promptBody) {
      return { success: false, error: '在线扩展缺少技能内容，无法安装' }
    }

    const definition = {
      name,
      version,
      description: detail.summary || entry.description || '来自 ClawHub 的社区技能',
      author: entry.ownerHandle || detail.ownerHandle,
      category: detail.category || entry.category || 'general',
      tags: (detail.topics.length ? detail.topics : entry.tags).slice(0, 6),
      parameters: {
        type: 'object',
        properties: {
          request: { type: 'string', description: '交给该技能处理的具体需求或上下文' }
        },
        required: ['request']
      },
      promptTemplate: 'prompt.txt',
      examples: [],
      source: {
        type: 'clawhub',
        owner: entry.ownerHandle,
        slug: entry.slug,
        url: entry.sourceUrl || detail.sourceUrl,
        license: entry.license || ''
      },
      changelog: entry.changelog || ''
    }

    const userSkillsPath = getUserSkillsPath()
    const targetPath = path.join(userSkillsPath, name)

    if (!isPathWithinBase(targetPath, userSkillsPath)) {
      return { success: false, error: '扩展目录无效，已拒绝安装' }
    }
    if (check.installed && !isPathWithinBase(check.installed.path, userSkillsPath)) {
      return { success: false, error: '已安装扩展目录异常，已拒绝覆盖' }
    }

    await fs.promises.mkdir(userSkillsPath, { recursive: true })
    const tempPath = path.join(userSkillsPath, `.install-${name}-${Date.now()}`)

    try {
      await fs.promises.mkdir(tempPath, { recursive: true })
      await fs.promises.writeFile(path.join(tempPath, 'skill.json'), JSON.stringify(definition, null, 2), 'utf8')
      await fs.promises.writeFile(
        path.join(tempPath, 'prompt.txt'),
        `${promptBody}\n\n---\n\n用户需求：\n{{request}}\n`,
        'utf8'
      )

      if (check.installed) {
        await this._removeDir(check.installed.path)
        this.skills.delete(name)
      } else if (fs.existsSync(targetPath)) {
        await this._removeDir(targetPath)
      }

      await fs.promises.rename(tempPath, targetPath)
      await this._loadSkill(targetPath, 'user')
    } catch (error) {
      if (fs.existsSync(tempPath)) await this._removeDir(tempPath).catch(() => {})
      throw error
    }

    log.info(`从 ClawHub 安装 Skill: ${name}@${version}`)
    return {
      success: true,
      name,
      version,
      updated: Boolean(check.installed),
      source: 'clawhub'
    }
  }

  async _copyDir(src, dest) {
    await fs.promises.mkdir(dest, { recursive: true })
    const entries = await fs.promises.readdir(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        await this._copyDir(srcPath, destPath)
      } else {
        await fs.promises.copyFile(srcPath, destPath)
      }
    }
  }

  async _removeDir(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await this._removeDir(fullPath)
      } else {
        await fs.promises.unlink(fullPath)
      }
    }

    await fs.promises.rmdir(dir)
  }

  getSkillCategories() {
    const categories = new Set()
    for (const skill of this.skills.values()) {
      if (skill.category) {
        categories.add(skill.category)
      }
    }
    return Array.from(categories)
  }

  getSkillsByCategory(category) {
    return this.getSkills().filter((skill) => skill.category === category)
  }

  searchSkills(keyword) {
    const lowerKeyword = keyword.toLowerCase()
    return this.getSkills().filter(
      (skill) =>
        skill.name.toLowerCase().includes(lowerKeyword) ||
        skill.description.toLowerCase().includes(lowerKeyword) ||
        (skill.tags && skill.tags.some((tag) => tag.toLowerCase().includes(lowerKeyword)))
    )
  }
}

const skillsManager = new SkillsManager()

export async function initSkills() {
  await skillsManager.loadSkills()
  return skillsManager
}

export function getSkillsManager() {
  return skillsManager
}

export function getSkills() {
  return skillsManager.getSkills()
}

export function getSkill(name) {
  return skillsManager.getSkill(name)
}

export async function executeSkill(name, params) {
  return await skillsManager.executeSkill(name, params)
}

export function getSkillToolDefinitions() {
  return skillsManager.getToolDefinitions()
}

export async function installSkill(skillPath, options) {
  return await skillsManager.installSkill(skillPath, options)
}

export async function uninstallSkill(name) {
  return await skillsManager.uninstallSkill(name)
}

export async function getMarketSkills() {
  return await skillsManager.getMarketSkills()
}

export async function installMarketSkill(name) {
  return await skillsManager.installMarketSkill(name)
}

export function getUserSkillsDirectory() {
  return getUserSkillsPath()
}
