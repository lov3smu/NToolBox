import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { log } from '../utils'
import { getConfigPath, getInstallDir } from '../utils/path'
import { initCrypto, encrypt, decrypt, isEncrypted, decryptDbPassword, encryptDbPassword } from '../utils/crypto'
import { writeFileAtomic, readJsonWithBackup } from '../utils/atomicFile'
import {
  maskConfigForRenderer,
  restoreMaskedAiApiKeys,
  restoreMaskedImageHostSettings,
  transformImageHostSecrets
} from '../../shared/secrets.js'
import { validateConfig, normalizeShortcuts } from './configValidation'
import { VALID_THEMES, VALID_THEME_STYLES, VALID_FONT_SIZES } from '../constants'
import { normalizeImageHostConfig } from '../../shared/imageHosts.js'
import { normalizeDatabaseEditorConfig } from '../../shared/databaseEditor.js'
import { normalizeMcpServers } from '../../shared/mcp.js'
import { DEFAULT_SQL_AUDIT_RULES, SQL_AUDIT_RULES } from '../../shared/sqlAudit.js'
import { normalizeBackupTask } from '../../shared/backupTasks.js'
import { normalizeDisabledSkills, normalizeSkillOverrides } from '../../shared/skillOverrides.js'
import { normalizeNetworkConfig, normalizeMarketSources } from '../../shared/network.js'
import { normalizeNotificationConfig } from '../../shared/notifications.js'
import { normalizeClipboardHistoryConfig } from '../../shared/clipboardSettings.js'
import {
  normalizeAiAgentMaxIterations,
  normalizeAiAgentParallelTools,
  normalizeAiAgentPlanSteps,
  normalizeAiAgentTimeoutMin,
  normalizeAiCompressKeepRecent,
  normalizeAiCompressThreshold,
  normalizeAiMaxAttachments,
  normalizeAiMaxImageMb,
  normalizeAiMaxTextKb,
  normalizeAiPersona,
  normalizeAiTemperature,
  normalizeAiTimeout,
  normalizeAiToolResultMaxKb,
  normalizeAiToolResultRetentionDays,
  normalizeAiToolResultRunKb,
  normalizeScenarioModels,
  normalizeToolPolicy
} from '../../shared/aiBehavior.js'
import {
  normalizeDatabaseHistoryLimit,
  normalizeDatabasePageSize,
  normalizeDatabaseRefreshInterval,
  normalizeDatabaseTransferBatchSize
} from '../../shared/databaseClient.js'
import { normalizeRecentToolsLimit } from '../../shared/tools.js'
import { normalizeUpdateCheckInterval } from '../../shared/updater.js'

export { validateConfig }

let config = {}

export function getConfig() {
  return config
}

export function setConfig(newConfig) {
  config = newConfig
}

export function getPublicConfig() {
  return maskConfigForRenderer(config)
}

function decryptAiApiKeys(keys) {
  if (!keys || typeof keys !== 'object') return
  for (const [name, value] of Object.entries(keys)) {
    if (typeof value === 'string' && value && isEncrypted(value)) keys[name] = decrypt(value)
  }
}

function encryptAiApiKeys(keys) {
  if (!keys || typeof keys !== 'object') return
  for (const [name, value] of Object.entries(keys)) {
    if (typeof value === 'string' && value && !isEncrypted(value)) keys[name] = encrypt(value)
  }
}

function normalizeAiAgentConfig(target) {
  target.ai_agent_max_iterations = normalizeAiAgentMaxIterations(target.ai_agent_max_iterations)
  target.ai_agent_timeout_min = normalizeAiAgentTimeoutMin(target.ai_agent_timeout_min)
  target.ai_agent_plan_steps = normalizeAiAgentPlanSteps(target.ai_agent_plan_steps)
  target.ai_agent_parallel_tools = normalizeAiAgentParallelTools(target.ai_agent_parallel_tools)
  target.ai_tool_result_max_kb = normalizeAiToolResultMaxKb(target.ai_tool_result_max_kb)
  target.ai_tool_result_run_kb = normalizeAiToolResultRunKb(target.ai_tool_result_run_kb)
  target.ai_tool_result_retention_days = normalizeAiToolResultRetentionDays(target.ai_tool_result_retention_days)
  return target
}

const LEGACY_MODEL_NAMES = {
  bailian: {
    'qwen3.8-max': 'Qwen3.8 Max (旗舰)',
    'qwen3.7-plus': 'Qwen3.7 Plus (均衡)',
    'qwen3.8-flash': 'Qwen3.8 Flash (快速)'
  },
  moonshot: {
    'kimi-k3.1-pro': 'Kimi K3.1 Pro (旗舰)',
    'kimi-k3.1-pro-highspeed': 'Kimi K3.1 Pro 高速版',
    'kimi-k3': 'Kimi K3'
  },
  zhipu: {
    'glm-5.3': 'GLM-5.3 (旗舰)',
    'glm-5.2': 'GLM-5.2',
    'glm-5': 'GLM-5',
    'glm-4.7': 'GLM-4.7',
    'glm-4.7-flash': 'GLM-4.7-Flash (免费)'
  },
  minimax: {
    'MiniMax-M3.1-Flash': 'MiniMax M3.1 Flash (快速)',
    'MiniMax-M3': 'MiniMax M3 (旗舰)',
    'MiniMax-M2.7': 'MiniMax M2.7',
    'MiniMax-M2.7-highspeed': 'MiniMax M2.7 高速版'
  },
  volcengine: {
    'doubao-seed-evolving': 'Doubao Seed Evolving',
    'doubao-seed-2.1-pro': 'Doubao Seed 2.1 Pro',
    'doubao-seed-2.0-pro': 'Doubao Seed 2.0 Pro'
  },
  deepseek: {
    'deepseek-v4-pro': 'DeepSeek V4 Pro (旗舰)',
    'deepseek-flash': 'DeepSeek Flash (快速)'
  }
}

function normalizeModelName(type, id, name) {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) return id
  return LEGACY_MODEL_NAMES[type]?.[id] === trimmed ? id : trimmed
}

function normalizePositiveInt(value) {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) return 0
  return Math.floor(num)
}

function normalizeInputTypes(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((type) => type === 'text' || type === 'image'))]
}

function normalizeAiModels(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result = {}
  for (const [type, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const seen = new Set()
    const models = []
    if (Array.isArray(entry.models)) {
      for (const model of entry.models) {
        if (!model || typeof model !== 'object' || typeof model.id !== 'string') continue
        const id = model.id.trim()
        if (!id || seen.has(id)) continue
        seen.add(id)
        const normalized = {
          id,
          name: normalizeModelName(type, id, model.name)
        }
        const contextWindow = normalizePositiveInt(model.contextWindow)
        if (contextWindow) normalized.contextWindow = contextWindow
        const maxOutput = normalizePositiveInt(model.maxOutput)
        if (maxOutput) normalized.maxOutput = maxOutput
        const inputTypes = normalizeInputTypes(model.inputTypes)
        if (inputTypes.length > 0) normalized.inputTypes = inputTypes
        models.push(normalized)
      }
    }
    const defaultModel = typeof entry.default === 'string' ? entry.default.trim() : ''
    if (models.length === 0 && !defaultModel) continue
    result[type] = { default: defaultModel, models }
  }
  return result
}

function normalizeBaseUrls(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const result = {}
  for (const [type, value] of Object.entries(raw)) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim().replace(/\/+$/, '')
    if (!trimmed) continue
    try {
      const url = new URL(trimmed)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue
    } catch {
      continue
    }
    result[type] = trimmed
  }
  return result
}

function normalizeFallbackModels(raw) {
  if (!Array.isArray(raw)) return []
  const result = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const value = item.trim()
    const separator = value.indexOf(':')
    if (separator <= 0 || separator === value.length - 1) continue
    if (!result.includes(value)) result.push(value)
    if (result.length >= 5) break
  }
  return result
}

function normalizeAuditRules(raw) {
  const result = { ...DEFAULT_SQL_AUDIT_RULES }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result
  for (const rule of SQL_AUDIT_RULES) {
    if (typeof raw[rule.id] === 'boolean') result[rule.id] = raw[rule.id]
  }
  return result
}

function getDefaultConfigContent() {
  const defaultBasePath = path.join(getInstallDir(), 'Develop', '11 - Database Script')
  return {
    base_path: defaultBasePath,
    developer_ch_name: '张三',
    developer_en_name: 'zhangsan',
    text_edit_app: '',
    auto_update: true,
    auto_start: true,
    first_launch_done: false,
    close_action: 'ask',
    update_check_interval: normalizeUpdateCheckInterval(),
    recent_tools_limit: normalizeRecentToolsLimit(),
    theme: 'system',
    theme_style: 'sapphire',
    font_size: 'medium',
    memory_auto_capture: true,
    database_safe_mode: true,
    database_page_size: normalizeDatabasePageSize(),
    database_refresh_interval: normalizeDatabaseRefreshInterval(),
    database_transfer_batch_size: normalizeDatabaseTransferBatchSize(),
    database_history_limit: normalizeDatabaseHistoryLimit(),
    database_audit_enabled: false,
    database_audit_strict: false,
    database_audit_rules: { ...DEFAULT_SQL_AUDIT_RULES },
    database_operation_log_enabled: true,
    db_backup_tasks: [],
    ai_provider: 'bailian',
    ai_api_keys: {
      bailian: '',
      moonshot: '',
      zhipu: '',
      minimax: '',
      minimax_group_id: '',
      volcengine: '',
      volcengine_endpoint_id: '',
      deepseek: '',
      mimo: '',
      opencode: '',
      opencode_go: '',
      openai: '',
      google: '',
      anthropic: ''
    },
    ai_base_urls: {},
    ai_models: {},
    ai_fallback_enabled: true,
    ai_fallback_models: [],
    ai_persona: '',
    ai_temperature: null,
    ai_timeout: normalizeAiTimeout(),
    ai_compress_threshold: normalizeAiCompressThreshold(),
    ai_compress_keep_recent: normalizeAiCompressKeepRecent(),
    ai_max_attachments: normalizeAiMaxAttachments(),
    ai_max_image_mb: normalizeAiMaxImageMb(),
    ai_max_text_kb: normalizeAiMaxTextKb(),
    ai_agent_max_iterations: normalizeAiAgentMaxIterations(),
    ai_agent_timeout_min: normalizeAiAgentTimeoutMin(),
    ai_agent_plan_steps: normalizeAiAgentPlanSteps(),
    ai_agent_parallel_tools: normalizeAiAgentParallelTools(),
    ai_tool_result_max_kb: normalizeAiToolResultMaxKb(),
    ai_tool_result_run_kb: normalizeAiToolResultRunKb(),
    ai_tool_result_retention_days: normalizeAiToolResultRetentionDays(),
    ai_scenario_models: normalizeScenarioModels(),
    ai_tool_policy: normalizeToolPolicy('all'),
    databases: [
      'order_db',
      'product_db',
      'community_db',
      'content_db',
      'device_db',
      'main_db',
      'promotion_db',
      'ota_db',
      'payment_db',
      'pmp_db',
      'report_db',
      'report_data_db',
      'sharespace_db',
      'user_db',
      'workbench_db',
      'worktask_db',
      'data_warehouse_db'
    ],
    script_types: [
      { name: 'DDL', description: 'Data Definition Language (CREATE, ALTER, DROP)' },
      { name: 'DML', description: 'Data Manipulation Language (INSERT, UPDATE, DELETE)' },
      { name: 'DQL', description: 'Data Query Language (SELECT)' }
    ],
    shortcuts: {
      settings: 'CmdOrCtrl+,'
    },
    database_editor: normalizeDatabaseEditorConfig(),
    image_hosting: normalizeImageHostConfig(),
    mcp_servers: [],
    disabled_skills: [],
    skill_overrides: {},
    network: normalizeNetworkConfig(),
    market_sources: normalizeMarketSources(),
    notifications: normalizeNotificationConfig(),
    clipboard_history: normalizeClipboardHistoryConfig()
  }
}

async function createDefaultConfig() {
  try {
    const defaultConfig = getDefaultConfigContent()
    const configPath = getConfigPath()
    await fs.promises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8')
    log.info('已创建默认配置文件:', configPath)
    return defaultConfig
  } catch (error) {
    log.error('创建默认配置文件失败:', error)
    throw error
  }
}

export async function loadConfig() {
  try {
    await initCrypto()

    const configPath = getConfigPath()
    let parsed
    try {
      parsed = await readJsonWithBackup(configPath)
    } catch (readError) {
      if (readError.code === 'ENOENT') {
        log.info('配置文件不存在，创建默认配置')
        config = await createDefaultConfig()
        return config
      }
      throw readError
    }
    if (parsed.recovered) log.warn('配置文件解析失败，已使用 .bak 备份恢复')

    const loadedConfig = parsed.data
    const defaultConfig = getDefaultConfigContent()

    config = { ...defaultConfig, ...loadedConfig }

    if (config.auto_update === undefined) config.auto_update = true
    if (config.auto_start === undefined) config.auto_start = true
    if (config.first_launch_done === undefined) config.first_launch_done = false
    if (config.close_action === undefined) config.close_action = 'ask'
    if (!VALID_THEMES.includes(config.theme)) config.theme = 'system'
    if (!VALID_THEME_STYLES.includes(config.theme_style)) config.theme_style = 'sapphire'
    if (!VALID_FONT_SIZES.includes(config.font_size)) config.font_size = 'medium'
    if (typeof config.memory_auto_capture !== 'boolean') config.memory_auto_capture = true
    config.update_check_interval = normalizeUpdateCheckInterval(config.update_check_interval)
    config.recent_tools_limit = normalizeRecentToolsLimit(config.recent_tools_limit)
    if (typeof config.database_safe_mode !== 'boolean') config.database_safe_mode = true
    config.database_page_size = normalizeDatabasePageSize(config.database_page_size)
    config.database_refresh_interval = normalizeDatabaseRefreshInterval(config.database_refresh_interval)
    config.database_transfer_batch_size = normalizeDatabaseTransferBatchSize(config.database_transfer_batch_size)
    config.database_history_limit = normalizeDatabaseHistoryLimit(config.database_history_limit)
    if (typeof config.database_audit_enabled !== 'boolean') config.database_audit_enabled = false
    if (typeof config.database_audit_strict !== 'boolean') config.database_audit_strict = false
    config.database_audit_rules = normalizeAuditRules(config.database_audit_rules)
    if (typeof config.database_operation_log_enabled !== 'boolean') config.database_operation_log_enabled = true
    config.db_backup_tasks = Array.isArray(config.db_backup_tasks)
      ? config.db_backup_tasks.map(normalizeBackupTask).filter((task) => task.id)
      : []
    if (config.ai_provider === undefined) config.ai_provider = 'bailian'

    if (!config.ai_api_keys || typeof config.ai_api_keys !== 'object') {
      config.ai_api_keys = { ...defaultConfig.ai_api_keys }
    } else {
      config.ai_api_keys = { ...defaultConfig.ai_api_keys, ...config.ai_api_keys }
    }

    config.ai_models = normalizeAiModels(config.ai_models)
    config.ai_base_urls = normalizeBaseUrls(config.ai_base_urls)
    if (typeof config.ai_fallback_enabled !== 'boolean') config.ai_fallback_enabled = true
    config.ai_fallback_models = normalizeFallbackModels(config.ai_fallback_models)
    config.ai_persona = normalizeAiPersona(config.ai_persona)
    config.ai_temperature = normalizeAiTemperature(config.ai_temperature)
    config.ai_timeout = normalizeAiTimeout(config.ai_timeout)
    config.ai_compress_threshold = normalizeAiCompressThreshold(config.ai_compress_threshold)
    config.ai_compress_keep_recent = normalizeAiCompressKeepRecent(config.ai_compress_keep_recent)
    config.ai_max_attachments = normalizeAiMaxAttachments(config.ai_max_attachments)
    config.ai_max_image_mb = normalizeAiMaxImageMb(config.ai_max_image_mb)
    config.ai_max_text_kb = normalizeAiMaxTextKb(config.ai_max_text_kb)
    // 旧版本把默认值一并写入配置文件，10 轮为历史默认；升级一次到 20 轮，之后用户自选值不再改动
    if (config.ai_agent_iterations_upgraded !== true) {
      if (normalizeAiAgentMaxIterations(config.ai_agent_max_iterations) === 10) config.ai_agent_max_iterations = 20
      config.ai_agent_iterations_upgraded = true
    }
    normalizeAiAgentConfig(config)
    config.ai_scenario_models = normalizeScenarioModels(config.ai_scenario_models)
    config.ai_tool_policy = normalizeToolPolicy(config.ai_tool_policy)
    config.database_editor = normalizeDatabaseEditorConfig(config.database_editor)
    config.image_hosting = normalizeImageHostConfig(config.image_hosting)
    config.mcp_servers = normalizeMcpServers(config.mcp_servers)
    // Older configs predate extension toggles; defaulting here keeps them loadable.
    config.disabled_skills = normalizeDisabledSkills(config.disabled_skills)
    config.skill_overrides = normalizeSkillOverrides(config.skill_overrides)
    config.network = normalizeNetworkConfig(config.network)
    config.market_sources = normalizeMarketSources(config.market_sources)
    config.notifications = normalizeNotificationConfig(config.notifications)
    config.clipboard_history = normalizeClipboardHistoryConfig(config.clipboard_history)

    if (loadedConfig.bailian_api_key && !config.ai_api_keys.bailian) {
      config.ai_api_keys.bailian = loadedConfig.bailian_api_key
      delete config.bailian_api_key
    }

    config.shortcuts = normalizeShortcuts(config.shortcuts, defaultConfig.shortcuts)

    if (Array.isArray(config.dbConnections)) {
      for (const conn of config.dbConnections) {
        if (conn.password) {
          conn.password = decryptDbPassword(conn.password)
        }
      }
    }

    decryptAiApiKeys(config.ai_api_keys)
    transformImageHostSecrets(config.image_hosting, (value) => (isEncrypted(value) ? decrypt(value) : value))

    log.info('配置文件加载成功')
    return config
  } catch (error) {
    if (error instanceof SyntaxError) {
      log.error('配置文件 JSON 格式错误:', error)
      dialog.showErrorBox('配置错误', `配置文件 config.json 格式错误，请检查 JSON 语法：\n${error.message}`)
    } else {
      log.error('加载配置文件失败:', error)
      dialog.showErrorBox('配置错误', `无法加载配置文件 config.json：\n${error.message}`)
    }
    app.isQuitting = true
    app.quit()
    return null
  }
}

async function saveConfigNow(newConfig) {
  try {
    // 与现有配置合并，避免局部保存（如设置页不提交 first_launch_done、dbConnections）丢字段
    const mergedConfig = { ...config, ...newConfig }
    mergedConfig.ai_api_keys = restoreMaskedAiApiKeys(mergedConfig.ai_api_keys, config.ai_api_keys)
    mergedConfig.image_hosting = restoreMaskedImageHostSettings(mergedConfig.image_hosting, config.image_hosting)
    mergedConfig.image_hosting = normalizeImageHostConfig(mergedConfig.image_hosting)
    mergedConfig.update_check_interval = normalizeUpdateCheckInterval(mergedConfig.update_check_interval)
    mergedConfig.recent_tools_limit = normalizeRecentToolsLimit(mergedConfig.recent_tools_limit)
    mergedConfig.database_page_size = normalizeDatabasePageSize(mergedConfig.database_page_size)
    mergedConfig.database_refresh_interval = normalizeDatabaseRefreshInterval(mergedConfig.database_refresh_interval)
    mergedConfig.database_transfer_batch_size = normalizeDatabaseTransferBatchSize(
      mergedConfig.database_transfer_batch_size
    )
    mergedConfig.database_history_limit = normalizeDatabaseHistoryLimit(mergedConfig.database_history_limit)
    mergedConfig.ai_timeout = normalizeAiTimeout(mergedConfig.ai_timeout)
    mergedConfig.ai_compress_threshold = normalizeAiCompressThreshold(mergedConfig.ai_compress_threshold)
    mergedConfig.ai_compress_keep_recent = normalizeAiCompressKeepRecent(mergedConfig.ai_compress_keep_recent)
    mergedConfig.ai_max_attachments = normalizeAiMaxAttachments(mergedConfig.ai_max_attachments)
    mergedConfig.ai_max_image_mb = normalizeAiMaxImageMb(mergedConfig.ai_max_image_mb)
    mergedConfig.ai_max_text_kb = normalizeAiMaxTextKb(mergedConfig.ai_max_text_kb)
    normalizeAiAgentConfig(mergedConfig)
    const error = validateConfig(mergedConfig)
    if (error) {
      log.error('配置校验失败:', error)
      return false
    }

    const configToSave = JSON.parse(JSON.stringify(mergedConfig))
    configToSave.ai_models = normalizeAiModels(configToSave.ai_models)
    configToSave.ai_base_urls = normalizeBaseUrls(configToSave.ai_base_urls)
    configToSave.ai_fallback_models = normalizeFallbackModels(configToSave.ai_fallback_models)
    configToSave.ai_persona = normalizeAiPersona(configToSave.ai_persona)
    configToSave.ai_temperature = normalizeAiTemperature(configToSave.ai_temperature)
    configToSave.ai_scenario_models = normalizeScenarioModels(configToSave.ai_scenario_models)
    configToSave.ai_tool_policy = normalizeToolPolicy(configToSave.ai_tool_policy)
    configToSave.database_editor = normalizeDatabaseEditorConfig(configToSave.database_editor)
    configToSave.database_audit_rules = normalizeAuditRules(configToSave.database_audit_rules)
    configToSave.db_backup_tasks = Array.isArray(configToSave.db_backup_tasks)
      ? configToSave.db_backup_tasks.map(normalizeBackupTask).filter((task) => task.id)
      : []
    configToSave.image_hosting = normalizeImageHostConfig(configToSave.image_hosting)
    configToSave.mcp_servers = normalizeMcpServers(configToSave.mcp_servers)
    configToSave.disabled_skills = normalizeDisabledSkills(configToSave.disabled_skills)
    configToSave.skill_overrides = normalizeSkillOverrides(configToSave.skill_overrides)
    configToSave.network = normalizeNetworkConfig(configToSave.network)
    configToSave.market_sources = normalizeMarketSources(configToSave.market_sources)
    configToSave.notifications = normalizeNotificationConfig(configToSave.notifications)
    configToSave.clipboard_history = normalizeClipboardHistoryConfig(configToSave.clipboard_history)

    if (Array.isArray(configToSave.dbConnections)) {
      for (const conn of configToSave.dbConnections) {
        if (conn.password && conn.savePassword) {
          conn.password = encryptDbPassword(conn.password)
        } else if (conn.password && !conn.savePassword) {
          conn.password = ''
        }
      }
    }

    encryptAiApiKeys(configToSave.ai_api_keys)
    transformImageHostSecrets(configToSave.image_hosting, (value) => (isEncrypted(value) ? value : encrypt(value)))

    const configPath = getConfigPath()
    await writeFileAtomic(configPath, JSON.stringify(configToSave, null, 2), 'utf8')
    try {
      await fs.promises.copyFile(configPath, `${configPath}.bak`)
    } catch (error) {
      log.error('备份配置文件失败:', error)
    }
    config = {
      ...mergedConfig,
      ai_models: configToSave.ai_models,
      ai_base_urls: configToSave.ai_base_urls,
      ai_fallback_models: configToSave.ai_fallback_models,
      ai_persona: configToSave.ai_persona,
      ai_temperature: configToSave.ai_temperature,
      ai_scenario_models: configToSave.ai_scenario_models,
      ai_tool_policy: configToSave.ai_tool_policy,
      database_editor: configToSave.database_editor,
      database_audit_rules: configToSave.database_audit_rules,
      db_backup_tasks: configToSave.db_backup_tasks,
      image_hosting: mergedConfig.image_hosting,
      mcp_servers: configToSave.mcp_servers,
      disabled_skills: configToSave.disabled_skills,
      skill_overrides: configToSave.skill_overrides,
      network: configToSave.network,
      market_sources: configToSave.market_sources,
      notifications: configToSave.notifications,
      clipboard_history: configToSave.clipboard_history
    }
    log.info('配置保存成功')
    return true
  } catch (error) {
    log.error('保存配置文件失败:', error)
    return false
  }
}

let saveChain = Promise.resolve()

export function saveConfig(newConfig) {
  const task = saveChain.then(() => saveConfigNow(newConfig))
  saveChain = task.catch(() => {})
  return task
}

// 局部写入：只提交变更字段，在写队列内基于主进程最新配置合并，避免渲染层旧快照覆盖其他改动
export function patchConfig(partial) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return Promise.resolve(false)
  return saveConfig(partial)
}
