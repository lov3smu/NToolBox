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
import { CONFIG_VERSION, migrateConfig, mergeConfig } from './configMigrations'
import { t } from './i18n'
import { VALID_CLOSE_ACTIONS, VALID_THEMES, VALID_THEME_STYLES, VALID_FONT_SIZES } from '../constants'
import { normalizeLocale } from '../../shared/i18n.js'
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
import { normalizeRecentToolsLimit } from '../../shared/navTools.js'
import { getDefaultShortcuts } from '../../shared/shortcutActions.js'
import { normalizeUpdateCheckInterval } from '../../shared/updater.js'
import { applyManagedSettings } from '../../shared/managedProfile.js'
import { getManagedSettings } from './managedProfile'

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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
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
    config_version: CONFIG_VERSION,
    app: {
      auto_start: true,
      first_launch_done: false,
      close_action: 'ask',
      recent_tools_limit: normalizeRecentToolsLimit(),
      shortcuts: getDefaultShortcuts()
    },
    appearance: {
      theme: 'system',
      theme_style: 'sapphire',
      font_size: 'medium',
      language: 'zh-CN'
    },
    update: {
      auto_update: true,
      check_interval: normalizeUpdateCheckInterval()
    },
    network: {
      ...normalizeNetworkConfig(),
      market_sources: normalizeMarketSources()
    },
    database: {
      safe_mode: true,
      page_size: normalizeDatabasePageSize(),
      refresh_interval: normalizeDatabaseRefreshInterval(),
      transfer_batch_size: normalizeDatabaseTransferBatchSize(),
      history_limit: normalizeDatabaseHistoryLimit(),
      audit: {
        enabled: false,
        strict: false,
        rules: { ...DEFAULT_SQL_AUDIT_RULES }
      },
      operation_log_enabled: true,
      backup_tasks: [],
      transfer_tasks: [],
      connections: [],
      connection_groups: [],
      editor: normalizeDatabaseEditorConfig()
    },
    sql_generator: {
      base_path: defaultBasePath,
      developer: {
        ch_name: '张三',
        en_name: 'zhangsan'
      },
      text_edit_app: '',
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
      ]
    },
    ai: {
      provider: 'bailian',
      keys: {
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
      base_urls: {},
      models: {},
      fallback: {
        enabled: true,
        models: []
      },
      persona: '',
      temperature: null,
      timeout: normalizeAiTimeout(),
      connection_timeout: 10,
      context: {
        compress_threshold: normalizeAiCompressThreshold(),
        keep_recent: normalizeAiCompressKeepRecent()
      },
      attachments: {
        max_count: normalizeAiMaxAttachments(),
        max_image_mb: normalizeAiMaxImageMb(),
        max_text_kb: normalizeAiMaxTextKb()
      },
      agent: {
        max_iterations: normalizeAiAgentMaxIterations(),
        timeout_min: normalizeAiAgentTimeoutMin(),
        max_plan_steps: normalizeAiAgentPlanSteps(),
        max_parallel_tools: normalizeAiAgentParallelTools(),
        scenario_models: normalizeScenarioModels(),
        tool_policy: normalizeToolPolicy('all')
      },
      tool_result: {
        max_kb: normalizeAiToolResultMaxKb(),
        run_kb: normalizeAiToolResultRunKb(),
        retention_days: normalizeAiToolResultRetentionDays()
      }
    },
    memory: {
      auto_capture: true
    },
    image_hosting: normalizeImageHostConfig(),
    extensions: {
      mcp_servers: [],
      disabled_skills: [],
      skill_overrides: {}
    },
    notifications: normalizeNotificationConfig(),
    clipboard_history: normalizeClipboardHistoryConfig()
  }
}

function normalizeAppConfig(raw, defaults) {
  const source = isPlainObject(raw) ? raw : {}
  const appConfig = {
    auto_start: typeof source.auto_start === 'boolean' ? source.auto_start : defaults.auto_start,
    first_launch_done:
      typeof source.first_launch_done === 'boolean' ? source.first_launch_done : defaults.first_launch_done,
    close_action: VALID_CLOSE_ACTIONS.includes(source.close_action) ? source.close_action : defaults.close_action,
    recent_tools_limit: normalizeRecentToolsLimit(source.recent_tools_limit),
    shortcuts: normalizeShortcuts(source.shortcuts, defaults.shortcuts)
  }
  return appConfig
}

function normalizeDatabaseConfig(raw, defaults) {
  const source = isPlainObject(raw) ? raw : {}
  const audit = isPlainObject(source.audit) ? source.audit : {}
  const connections = Array.isArray(source.connections)
    ? source.connections.filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    : []
  let connectionGroups = Array.isArray(source.connection_groups)
    ? source.connection_groups.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim())
    : []
  connectionGroups = [...new Set(connectionGroups)]
  return {
    safe_mode: typeof source.safe_mode === 'boolean' ? source.safe_mode : defaults.safe_mode,
    page_size: normalizeDatabasePageSize(source.page_size),
    refresh_interval: normalizeDatabaseRefreshInterval(source.refresh_interval),
    transfer_batch_size: normalizeDatabaseTransferBatchSize(source.transfer_batch_size),
    history_limit: normalizeDatabaseHistoryLimit(source.history_limit),
    audit: {
      enabled: typeof audit.enabled === 'boolean' ? audit.enabled : defaults.audit.enabled,
      strict: typeof audit.strict === 'boolean' ? audit.strict : defaults.audit.strict,
      rules: normalizeAuditRules(audit.rules)
    },
    operation_log_enabled:
      typeof source.operation_log_enabled === 'boolean' ? source.operation_log_enabled : defaults.operation_log_enabled,
    backup_tasks: Array.isArray(source.backup_tasks)
      ? source.backup_tasks.map(normalizeBackupTask).filter((task) => task.id)
      : [],
    transfer_tasks: Array.isArray(source.transfer_tasks) ? source.transfer_tasks : [],
    connections,
    connection_groups: connectionGroups,
    editor: normalizeDatabaseEditorConfig(source.editor)
  }
}

function normalizeSqlGeneratorConfig(raw, defaults) {
  const source = isPlainObject(raw) ? raw : {}
  const developer = isPlainObject(source.developer) ? source.developer : {}
  const databases = Array.isArray(source.databases)
    ? source.databases.filter((name) => typeof name === 'string')
    : defaults.databases
  const scriptTypes = Array.isArray(source.script_types)
    ? source.script_types
        .filter((item) => item && typeof item === 'object' && typeof item.name === 'string')
        .map((item) => ({
          name: item.name,
          description: typeof item.description === 'string' ? item.description : ''
        }))
    : defaults.script_types
  return {
    base_path: typeof source.base_path === 'string' ? source.base_path : defaults.base_path,
    developer: {
      ch_name: typeof developer.ch_name === 'string' ? developer.ch_name : defaults.developer.ch_name,
      en_name: typeof developer.en_name === 'string' ? developer.en_name : defaults.developer.en_name
    },
    text_edit_app: typeof source.text_edit_app === 'string' ? source.text_edit_app : defaults.text_edit_app,
    databases,
    script_types: scriptTypes
  }
}

function normalizeAiConfig(raw, defaults) {
  const source = isPlainObject(raw) ? raw : {}
  const keys = {
    ...defaults.keys,
    ...(isPlainObject(source.keys) ? source.keys : {})
  }
  const fallback = isPlainObject(source.fallback) ? source.fallback : {}
  const context = isPlainObject(source.context) ? source.context : {}
  const attachments = isPlainObject(source.attachments) ? source.attachments : {}
  const agent = isPlainObject(source.agent) ? source.agent : {}
  const toolResult = isPlainObject(source.tool_result) ? source.tool_result : {}
  const connectionTimeout = normalizePositiveInt(source.connection_timeout)
  return {
    provider: typeof source.provider === 'string' && source.provider ? source.provider : defaults.provider,
    keys,
    base_urls: normalizeBaseUrls(source.base_urls),
    models: normalizeAiModels(source.models),
    fallback: {
      enabled: typeof fallback.enabled === 'boolean' ? fallback.enabled : defaults.fallback.enabled,
      models: normalizeFallbackModels(fallback.models)
    },
    persona: normalizeAiPersona(source.persona),
    temperature: normalizeAiTemperature(source.temperature),
    timeout: normalizeAiTimeout(source.timeout),
    connection_timeout: connectionTimeout || defaults.connection_timeout,
    context: {
      compress_threshold: normalizeAiCompressThreshold(context.compress_threshold),
      keep_recent: normalizeAiCompressKeepRecent(context.keep_recent)
    },
    attachments: {
      max_count: normalizeAiMaxAttachments(attachments.max_count),
      max_image_mb: normalizeAiMaxImageMb(attachments.max_image_mb),
      max_text_kb: normalizeAiMaxTextKb(attachments.max_text_kb)
    },
    agent: {
      max_iterations: normalizeAiAgentMaxIterations(agent.max_iterations),
      timeout_min: normalizeAiAgentTimeoutMin(agent.timeout_min),
      max_plan_steps: normalizeAiAgentPlanSteps(agent.max_plan_steps),
      max_parallel_tools: normalizeAiAgentParallelTools(agent.max_parallel_tools),
      scenario_models: normalizeScenarioModels(agent.scenario_models),
      tool_policy: normalizeToolPolicy(agent.tool_policy)
    },
    tool_result: {
      max_kb: normalizeAiToolResultMaxKb(toolResult.max_kb),
      run_kb: normalizeAiToolResultRunKb(toolResult.run_kb),
      retention_days: normalizeAiToolResultRetentionDays(toolResult.retention_days)
    }
  }
}

export function normalizeConfig(raw) {
  const defaults = getDefaultConfigContent()
  const merged = mergeConfig(defaults, isPlainObject(raw) ? raw : {})
  const appearance = isPlainObject(merged.appearance) ? merged.appearance : {}
  const update = isPlainObject(merged.update) ? merged.update : {}
  const network = normalizeNetworkConfig(merged.network)
  network.market_sources = normalizeMarketSources(merged.network?.market_sources ?? defaults.network.market_sources)
  const memory = isPlainObject(merged.memory) ? merged.memory : {}
  const extensions = isPlainObject(merged.extensions) ? merged.extensions : {}

  return {
    config_version: CONFIG_VERSION,
    app: normalizeAppConfig(merged.app, defaults.app),
    appearance: {
      theme: VALID_THEMES.includes(appearance.theme) ? appearance.theme : defaults.appearance.theme,
      theme_style: VALID_THEME_STYLES.includes(appearance.theme_style)
        ? appearance.theme_style
        : defaults.appearance.theme_style,
      font_size: VALID_FONT_SIZES.includes(appearance.font_size) ? appearance.font_size : defaults.appearance.font_size,
      language: normalizeLocale(appearance.language)
    },
    update: {
      auto_update: typeof update.auto_update === 'boolean' ? update.auto_update : defaults.update.auto_update,
      check_interval: normalizeUpdateCheckInterval(update.check_interval)
    },
    network,
    database: normalizeDatabaseConfig(merged.database, defaults.database),
    sql_generator: normalizeSqlGeneratorConfig(merged.sql_generator, defaults.sql_generator),
    ai: normalizeAiConfig(merged.ai, defaults.ai),
    memory: {
      auto_capture: typeof memory.auto_capture === 'boolean' ? memory.auto_capture : defaults.memory.auto_capture
    },
    image_hosting: normalizeImageHostConfig(merged.image_hosting),
    extensions: {
      mcp_servers: normalizeMcpServers(extensions.mcp_servers),
      disabled_skills: normalizeDisabledSkills(extensions.disabled_skills),
      skill_overrides: normalizeSkillOverrides(extensions.skill_overrides)
    },
    notifications: normalizeNotificationConfig(merged.notifications),
    clipboard_history: normalizeClipboardHistoryConfig(merged.clipboard_history)
  }
}

function decryptSecrets(target) {
  decryptAiApiKeys(target.ai?.keys)
  if (Array.isArray(target.database?.connections)) {
    for (const conn of target.database.connections) {
      if (conn.password) conn.password = decryptDbPassword(conn.password)
    }
  }
  transformImageHostSecrets(target.image_hosting, (value) => (isEncrypted(value) ? decrypt(value) : value))
}

async function persistConfig(source) {
  const configPath = getConfigPath()
  const configToSave = JSON.parse(JSON.stringify(source))
  if (Array.isArray(configToSave.database?.connections)) {
    for (const conn of configToSave.database.connections) {
      if (conn.password && conn.savePassword) {
        conn.password = encryptDbPassword(conn.password)
      } else if (conn.password && !conn.savePassword) {
        conn.password = ''
      }
    }
  }
  encryptAiApiKeys(configToSave.ai?.keys)
  transformImageHostSecrets(configToSave.image_hosting, (value) => (isEncrypted(value) ? value : encrypt(value)))
  await writeFileAtomic(configPath, JSON.stringify(configToSave, null, 2), 'utf8')
  try {
    await fs.promises.copyFile(configPath, `${configPath}.bak`)
  } catch (error) {
    log.error('备份配置文件失败:', error)
  }
}

async function createDefaultConfig() {
  try {
    const defaultConfig = getDefaultConfigContent()
    const configPath = getConfigPath()
    await writeFileAtomic(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8')
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

    const migration = migrateConfig(parsed.data)
    config = normalizeConfig(migration.config)
    decryptSecrets(config)
    applyManagedSettings(config, getManagedSettings())

    if (migration.migrated) {
      await persistConfig(config)
      log.info(`配置文件已迁移到版本 ${CONFIG_VERSION}`)
    }

    log.info('配置文件加载成功')
    return config
  } catch (error) {
    if (error instanceof SyntaxError) {
      log.error('配置文件 JSON 格式错误:', error)
      dialog.showErrorBox(
        t('配置错误'),
        t('配置文件 config.json 格式错误，请检查 JSON 语法：\n{error}', { error: error.message })
      )
    } else {
      log.error('加载配置文件失败:', error)
      dialog.showErrorBox(t('配置错误'), t('无法加载配置文件 config.json：\n{error}', { error: error.message }))
    }
    app.isQuitting = true
    app.quit()
    return null
  }
}

async function saveConfigNow(newConfig) {
  try {
    const mergedConfig = mergeConfig(config, newConfig)
    mergedConfig.ai = {
      ...mergedConfig.ai,
      keys: restoreMaskedAiApiKeys(mergedConfig.ai?.keys, config.ai?.keys)
    }
    mergedConfig.image_hosting = restoreMaskedImageHostSettings(mergedConfig.image_hosting, config.image_hosting)
    applyManagedSettings(mergedConfig, getManagedSettings())
    const error = validateConfig(mergedConfig)
    if (error) {
      log.error('配置校验失败:', error)
      return false
    }

    const normalized = normalizeConfig(mergedConfig)
    await persistConfig(normalized)
    config = normalized
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
