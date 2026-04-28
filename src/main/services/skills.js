import path from 'path'
import fs from 'fs'
import { log } from '../utils'
import { getConfig } from './config'
import { getProvider } from './ai/index.js'

const BUILTIN_SKILLS_PATH = path.join(__dirname, '../skills/builtin')
const USER_SKILLS_PATH = path.join(__dirname, '../skills/user')

class SkillsManager {
  constructor() {
    this.skills = new Map()
    this.loaded = false
  }

  async loadSkills() {
    if (this.loaded) return
    
    log.info('开始加载 Skills...')
    
    await this._loadBuiltinSkills()
    await this._loadUserSkills()
    
    this.loaded = true
    log.info(`Skills 加载完成，共 ${this.skills.size} 个`)
  }

  async _loadBuiltinSkills() {
    try {
      if (!fs.existsSync(BUILTIN_SKILLS_PATH)) {
        log.warn('内置 Skills 目录不存在')
        return
      }

      const dirs = await fs.promises.readdir(BUILTIN_SKILLS_PATH)
      
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
      if (!fs.existsSync(USER_SKILLS_PATH)) {
        await fs.promises.mkdir(USER_SKILLS_PATH, { recursive: true })
        return
      }

      const dirs = await fs.promises.readdir(USER_SKILLS_PATH)
      
      for (const dir of dirs) {
        const skillPath = path.join(USER_SKILLS_PATH, dir)
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
    return Array.from(this.skills.values()).map(skill => ({
      name: skill.name,
      version: skill.version,
      description: skill.description,
      author: skill.author,
      type: skill.type,
      category: skill.category,
      tags: skill.tags || [],
      icon: skill.icon,
      parameters: skill.parameters,
      examples: skill.examples || []
    }))
  }

  getSkill(name) {
    return this.skills.get(name)
  }

  getToolDefinitions() {
    return Array.from(this.skills.values()).map(skill => ({
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
      const handlerModule = await import(skill.handlerPath)
      const handler = handlerModule.default || handlerModule.handler
      
      if (!handler || typeof handler !== 'function') {
        return { success: false, error: 'Handler 不是有效的函数' }
      }

      const config = getConfig()
      const context = {
        config,
        log,
        skill
      }

      const result = await handler(params, context)
      
      if (result && typeof result === 'object') {
        return result
      }
      
      return { success: true, content: String(result) }
    } catch (error) {
      log.error(`Handler 执行失败:`, error)
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
      apiKey: apiKeys[providerType] || ''
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

    const messages = [
      { role: 'user', content: prompt }
    ]

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

  async installSkill(skillPath) {
    try {
      if (!fs.existsSync(skillPath)) {
        return { success: false, error: 'Skill 路径不存在' }
      }

      const skillJsonPath = path.join(skillPath, 'skill.json')
      if (!fs.existsSync(skillJsonPath)) {
        return { success: false, error: '缺少 skill.json 定义文件' }
      }

      const content = await fs.promises.readFile(skillJsonPath, 'utf8')
      const skillDef = JSON.parse(content)
      
      if (!skillDef.name) {
        return { success: false, error: 'skill.json 缺少 name 字段' }
      }

      const targetPath = path.join(USER_SKILLS_PATH, skillDef.name)
      
      if (fs.existsSync(targetPath)) {
        return { success: false, error: `Skill ${skillDef.name} 已存在` }
      }

      await this._copyDir(skillPath, targetPath)
      
      await this._loadSkill(targetPath, 'user')
      
      log.info(`安装 Skill: ${skillDef.name}`)
      return { success: true, name: skillDef.name }
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
    return this.getSkills().filter(skill => skill.category === category)
  }

  searchSkills(keyword) {
    const lowerKeyword = keyword.toLowerCase()
    return this.getSkills().filter(skill => 
      skill.name.toLowerCase().includes(lowerKeyword) ||
      skill.description.toLowerCase().includes(lowerKeyword) ||
      (skill.tags && skill.tags.some(tag => tag.toLowerCase().includes(lowerKeyword)))
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

export async function installSkill(skillPath) {
  return await skillsManager.installSkill(skillPath)
}

export async function uninstallSkill(name) {
  return await skillsManager.uninstallSkill(name)
}