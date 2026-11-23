import { VALID_CLOSE_ACTIONS, VALID_THEMES, VALID_THEME_STYLES, VALID_FONT_SIZES } from '../constants'
import { t } from './i18n.js'
import { LOCALE_VALUES } from '../../shared/i18n.js'
import { ALL_SHORTCUT_KEYS } from '../../shared/shortcutActions.js'
import { DATABASE_EDITOR_THEMES, DATABASE_EDITOR_BOOLEAN_KEYS } from '../../shared/databaseEditor.js'
import { normalizeMcpServer } from '../../shared/mcp.js'
import { SQL_AUDIT_RULES } from '../../shared/sqlAudit.js'
import { normalizeBackupTask } from '../../shared/backupTasks.js'
import { normalizeDisabledSkills, normalizeSkillOverrides, isValidSkillName } from '../../shared/skillOverrides.js'
import { PROXY_MODES, isHttpUrl, isProxyUrl } from '../../shared/network.js'
import { NOTIFICATION_KEYS } from '../../shared/notifications.js'
import { CLIPBOARD_HISTORY_LIMITS } from '../../shared/clipboardSettings.js'
import { SCENARIO_MODEL_KEYS, TOOL_POLICIES, parseScenarioModel } from '../../shared/aiBehavior.js'
import {
  DATABASE_HISTORY_LIMITS,
  DATABASE_PAGE_SIZES,
  DATABASE_REFRESH_INTERVALS,
  DATABASE_TRANSFER_BATCH_SIZES
} from '../../shared/databaseClient.js'
import { RECENT_TOOLS_LIMIT_MAX, RECENT_TOOLS_LIMIT_MIN } from '../../shared/tools.js'
import { UPDATE_CHECK_INTERVALS } from '../../shared/updater.js'

export const VALID_SHORTCUT_KEYS = [...ALL_SHORTCUT_KEYS]

const SQL_AUDIT_RULE_IDS = SQL_AUDIT_RULES.map((rule) => rule.id)

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeShortcuts(raw, defaults) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...defaults }
  const result = {}
  for (const key of VALID_SHORTCUT_KEYS) {
    if (typeof raw[key] === 'string') result[key] = raw[key]
  }
  return { ...defaults, ...result }
}

function validateApp(app) {
  if (!isPlainObject(app)) return t('app 必须是对象')
  if (app.auto_start !== undefined && typeof app.auto_start !== 'boolean') return t('app.auto_start 必须是布尔值')
  if (app.first_launch_done !== undefined && typeof app.first_launch_done !== 'boolean') {
    return t('app.first_launch_done 必须是布尔值')
  }
  if (app.close_action && !VALID_CLOSE_ACTIONS.includes(app.close_action)) return t('app.close_action 值不合法')
  if (
    app.recent_tools_limit !== undefined &&
    (!Number.isInteger(app.recent_tools_limit) ||
      app.recent_tools_limit < RECENT_TOOLS_LIMIT_MIN ||
      app.recent_tools_limit > RECENT_TOOLS_LIMIT_MAX)
  ) {
    return t('app.recent_tools_limit 值不合法')
  }
  if (app.shortcuts !== undefined) {
    if (!isPlainObject(app.shortcuts)) return t('app.shortcuts 必须是对象')
    for (const key of Object.keys(app.shortcuts)) {
      if (!VALID_SHORTCUT_KEYS.includes(key)) return t('app.shortcuts.{p0} 不是有效的快捷键配置项', { p0: key })
      if (typeof app.shortcuts[key] !== 'string') return t('app.shortcuts.{p0} 必须是字符串', { p0: key })
    }
  }
  return null
}

function validateAppearance(appearance) {
  if (!isPlainObject(appearance)) return t('appearance 必须是对象')
  if (appearance.theme !== undefined && !VALID_THEMES.includes(appearance.theme)) return t('appearance.theme 值不合法')
  if (appearance.theme_style !== undefined && !VALID_THEME_STYLES.includes(appearance.theme_style)) {
    return t('appearance.theme_style 值不合法')
  }
  if (appearance.font_size !== undefined && !VALID_FONT_SIZES.includes(appearance.font_size)) {
    return t('appearance.font_size 值不合法')
  }
  if (appearance.language !== undefined && !LOCALE_VALUES.includes(appearance.language)) {
    return t('appearance.language 值不合法')
  }
  return null
}

function validateUpdate(update) {
  if (!isPlainObject(update)) return t('update 必须是对象')
  if (update.auto_update !== undefined && typeof update.auto_update !== 'boolean') {
    return t('update.auto_update 必须是布尔值')
  }
  if (update.check_interval !== undefined && !UPDATE_CHECK_INTERVALS.includes(update.check_interval)) {
    return t('update.check_interval 值不合法')
  }
  return null
}

function validateNetwork(network) {
  if (!isPlainObject(network)) return t('network 必须是对象')
  if (network.proxy !== undefined) {
    const proxy = network.proxy
    if (!isPlainObject(proxy)) return t('network.proxy 必须是对象')
    if (proxy.mode !== undefined && !PROXY_MODES.includes(proxy.mode)) return t('network.proxy.mode 值不合法')
    if (proxy.url !== undefined && typeof proxy.url !== 'string') return t('network.proxy.url 必须是字符串')
    if (proxy.bypass !== undefined && typeof proxy.bypass !== 'string') return t('network.proxy.bypass 必须是字符串')
    if (proxy.mode === 'manual' && (!proxy.url || !proxy.url.trim())) {
      return t('network.proxy.mode 为手动时必须填写代理地址')
    }
    if (proxy.url && proxy.url.trim() && !isProxyUrl(proxy.url.trim())) {
      return t('network.proxy.url 必须是有效的 http(s) 或 socks5 地址')
    }
  }
  if (network.market_sources !== undefined) {
    const sources = network.market_sources
    if (!isPlainObject(sources)) return t('network.market_sources 必须是对象')
    for (const [key, value] of Object.entries(sources)) {
      if (key !== 'clawhub' && key !== 'mcp_registry' && key !== 'update_feed') {
        return t('network.market_sources.{p0} 不是有效的配置项', { p0: key })
      }
      if (typeof value !== 'string') return t('network.market_sources.{p0} 必须是字符串', { p0: key })
      if (value.trim() && !isHttpUrl(value.trim()))
        return t('network.market_sources.{p0} 必须是有效的 http(s) 地址', { p0: key })
    }
  }
  return null
}

function validateDatabase(database) {
  if (!isPlainObject(database)) return t('database 必须是对象')
  if (database.safe_mode !== undefined && typeof database.safe_mode !== 'boolean') {
    return t('database.safe_mode 必须是布尔值')
  }
  if (database.page_size !== undefined && !DATABASE_PAGE_SIZES.includes(database.page_size)) {
    return t('database.page_size 值不合法')
  }
  if (database.refresh_interval !== undefined && !DATABASE_REFRESH_INTERVALS.includes(database.refresh_interval)) {
    return t('database.refresh_interval 值不合法')
  }
  if (
    database.transfer_batch_size !== undefined &&
    !DATABASE_TRANSFER_BATCH_SIZES.includes(database.transfer_batch_size)
  ) {
    return t('database.transfer_batch_size 值不合法')
  }
  if (database.history_limit !== undefined && !DATABASE_HISTORY_LIMITS.includes(database.history_limit)) {
    return t('database.history_limit 值不合法')
  }
  if (database.audit !== undefined) {
    const audit = database.audit
    if (!isPlainObject(audit)) return t('database.audit 必须是对象')
    if (audit.enabled !== undefined && typeof audit.enabled !== 'boolean') {
      return t('database.audit.enabled 必须是布尔值')
    }
    if (audit.strict !== undefined && typeof audit.strict !== 'boolean') {
      return t('database.audit.strict 必须是布尔值')
    }
    if (audit.rules !== undefined) {
      if (!isPlainObject(audit.rules)) return t('database.audit.rules 必须是对象')
      for (const [ruleId, enabled] of Object.entries(audit.rules)) {
        if (!SQL_AUDIT_RULE_IDS.includes(ruleId))
          return t('database.audit.rules.{p0} 不是有效的审核规则', { p0: ruleId })
        if (typeof enabled !== 'boolean') return t('database.audit.rules.{p0} 必须是布尔值', { p0: ruleId })
      }
    }
  }
  if (database.operation_log_enabled !== undefined && typeof database.operation_log_enabled !== 'boolean') {
    return t('database.operation_log_enabled 必须是布尔值')
  }
  if (database.backup_tasks !== undefined) {
    if (!Array.isArray(database.backup_tasks)) return t('database.backup_tasks 必须是数组')
    const ids = new Set()
    for (const item of database.backup_tasks) {
      if (!isPlainObject(item)) return t('database.backup_tasks 中的每项必须是对象')
      const task = normalizeBackupTask(item)
      if (!task.id) return t('database.backup_tasks 中的任务缺少 id')
      if (!task.name) return t('database.backup_tasks 中的任务缺少名称')
      if (ids.has(task.id)) return t('database.backup_tasks 任务 id 重复：{p0}', { p0: task.id })
      ids.add(task.id)
    }
  }
  if (database.transfer_tasks !== undefined && !Array.isArray(database.transfer_tasks)) {
    return t('database.transfer_tasks 必须是数组')
  }
  if (database.connections !== undefined) {
    if (!Array.isArray(database.connections)) return t('database.connections 必须是数组')
    for (const conn of database.connections) {
      if (!isPlainObject(conn)) return t('database.connections 中的每项必须是对象')
    }
    const names = new Set()
    for (const conn of database.connections) {
      if (typeof conn.name !== 'string' || !conn.name.trim()) return t('database.connections 中的连接缺少名称')
      if (names.has(conn.name)) return t('database.connections 连接名重复：{p0}', { p0: conn.name })
      names.add(conn.name)
    }
  }
  if (database.connection_groups !== undefined) {
    if (!Array.isArray(database.connection_groups)) return t('database.connection_groups 必须是数组')
    const groups = new Set()
    for (const name of database.connection_groups) {
      if (typeof name !== 'string' || !name.trim()) return t('database.connection_groups 中的每项必须是非空字符串')
      if (groups.has(name)) return t('database.connection_groups 分组名重复：{p0}', { p0: name })
      groups.add(name)
    }
  }
  if (database.editor !== undefined) {
    const editor = database.editor
    if (!isPlainObject(editor)) return t('database.editor 必须是对象')
    if (editor.theme !== undefined && !DATABASE_EDITOR_THEMES.includes(editor.theme)) {
      return t('database.editor.theme 值不合法')
    }
    for (const key of DATABASE_EDITOR_BOOLEAN_KEYS) {
      if (editor[key] !== undefined && typeof editor[key] !== 'boolean') {
        return t('database.editor.{p0} 必须是布尔值', { p0: key })
      }
    }
  }
  return null
}

function validateSqlGenerator(sqlGenerator) {
  if (!isPlainObject(sqlGenerator)) return t('sql_generator 必须是对象')
  if (typeof sqlGenerator.base_path !== 'string') return t('sql_generator.base_path 必须是字符串')
  if (!isPlainObject(sqlGenerator.developer)) return t('sql_generator.developer 必须是对象')
  if (typeof sqlGenerator.developer.ch_name !== 'string') return t('sql_generator.developer.ch_name 必须是字符串')
  if (typeof sqlGenerator.developer.en_name !== 'string') return t('sql_generator.developer.en_name 必须是字符串')
  if (sqlGenerator.text_edit_app !== undefined && typeof sqlGenerator.text_edit_app !== 'string') {
    return t('sql_generator.text_edit_app 必须是字符串')
  }
  if (sqlGenerator.databases !== undefined) {
    if (!Array.isArray(sqlGenerator.databases)) return t('sql_generator.databases 必须是数组')
    for (const name of sqlGenerator.databases) {
      if (typeof name !== 'string') return t('sql_generator.databases 中的每项必须是字符串')
    }
  }
  if (sqlGenerator.script_types !== undefined) {
    if (!Array.isArray(sqlGenerator.script_types)) return t('sql_generator.script_types 必须是数组')
    for (const item of sqlGenerator.script_types) {
      if (!isPlainObject(item)) return t('sql_generator.script_types 中的每项必须是对象')
      if (typeof item.name !== 'string') return t('sql_generator.script_types.name 必须是字符串')
      if (item.description !== undefined && typeof item.description !== 'string') {
        return t('sql_generator.script_types.description 必须是字符串')
      }
    }
  }
  return null
}

function validateAiModels(models) {
  if (!isPlainObject(models)) return t('ai.models 必须是对象')
  for (const [type, entry] of Object.entries(models)) {
    if (!isPlainObject(entry)) return t('ai.models.{p0} 必须是对象', { p0: type })
    if (entry.default !== undefined && typeof entry.default !== 'string') {
      return t('ai.models.{p0}.default 必须是字符串', { p0: type })
    }
    if (entry.models !== undefined) {
      if (!Array.isArray(entry.models)) return t('ai.models.{p0}.models 必须是数组', { p0: type })
      for (const model of entry.models) {
        if (!isPlainObject(model)) return t('ai.models.{p0}.models 中的每项必须是对象', { p0: type })
        if (typeof model.id !== 'string' || !model.id.trim())
          return t('ai.models.{p0}.models.id 必须是非空字符串', { p0: type })
        if (model.name !== undefined && typeof model.name !== 'string') {
          return t('ai.models.{p0}.models.name 必须是字符串', { p0: type })
        }
        if (model.contextWindow !== undefined) {
          if (!Number.isFinite(model.contextWindow) || model.contextWindow <= 0) {
            return t('ai.models.{p0}.models.contextWindow 必须是正数', { p0: type })
          }
        }
        if (model.maxOutput !== undefined) {
          if (!Number.isFinite(model.maxOutput) || model.maxOutput <= 0) {
            return t('ai.models.{p0}.models.maxOutput 必须是正数', { p0: type })
          }
        }
        if (model.inputTypes !== undefined) {
          if (!Array.isArray(model.inputTypes)) return t('ai.models.{p0}.models.inputTypes 必须是数组', { p0: type })
          for (const inputType of model.inputTypes) {
            if (inputType !== 'text' && inputType !== 'image') {
              return t('ai.models.{p0}.models.inputTypes 值不合法', { p0: type })
            }
          }
        }
      }
    }
  }
  return null
}

function validateAi(ai) {
  if (!isPlainObject(ai)) return t('ai 必须是对象')
  if (ai.provider !== undefined && typeof ai.provider !== 'string') return t('ai.provider 必须是字符串')
  if (ai.keys !== undefined) {
    if (!isPlainObject(ai.keys)) return t('ai.keys 必须是对象')
    for (const [name, value] of Object.entries(ai.keys)) {
      if (typeof value !== 'string') return t('ai.keys.{p0} 必须是字符串', { p0: name })
    }
  }
  if (ai.base_urls !== undefined) {
    if (!isPlainObject(ai.base_urls)) return t('ai.base_urls 必须是对象')
    for (const [type, value] of Object.entries(ai.base_urls)) {
      if (typeof value !== 'string') return t('ai.base_urls.{p0} 必须是字符串', { p0: type })
      if (value.trim() && !isHttpUrl(value.trim()))
        return t('ai.base_urls.{p0} 必须是有效的 http(s) 地址', { p0: type })
    }
  }
  if (ai.models !== undefined) {
    const error = validateAiModels(ai.models)
    if (error) return error
  }
  if (ai.fallback !== undefined) {
    const fallback = ai.fallback
    if (!isPlainObject(fallback)) return t('ai.fallback 必须是对象')
    if (fallback.enabled !== undefined && typeof fallback.enabled !== 'boolean') {
      return t('ai.fallback.enabled 必须是布尔值')
    }
    if (fallback.models !== undefined) {
      if (!Array.isArray(fallback.models)) return t('ai.fallback.models 必须是数组')
      for (const item of fallback.models) {
        if (typeof item !== 'string' || !item.trim()) return t('ai.fallback.models 每项必须是非空字符串')
        const separator = item.indexOf(':')
        if (separator <= 0 || separator === item.trim().length - 1) {
          return t('ai.fallback.models 每项格式应为 provider:model')
        }
      }
    }
  }
  if (ai.persona !== undefined && typeof ai.persona !== 'string') return t('ai.persona 必须是字符串')
  if (ai.temperature !== undefined && ai.temperature !== null) {
    if (typeof ai.temperature !== 'number' || !Number.isFinite(ai.temperature)) {
      return t('ai.temperature 必须是数字或 null')
    }
    if (ai.temperature < 0 || ai.temperature > 2) return t('ai.temperature 必须在 0 到 2 之间')
  }
  if (ai.timeout !== undefined) {
    if (!Number.isInteger(ai.timeout) || ai.timeout < 10 || ai.timeout > 600) {
      return t('ai.timeout 必须是 10 到 600 之间的整数（秒）')
    }
  }
  if (ai.connection_timeout !== undefined) {
    if (!Number.isInteger(ai.connection_timeout) || ai.connection_timeout < 1 || ai.connection_timeout > 600) {
      return t('ai.connection_timeout 必须是 1 到 600 之间的整数（秒）')
    }
  }
  for (const [path, value, min, max, label] of [
    ['ai.context.compress_threshold', ai.context?.compress_threshold, 50, 90, t('上下文压缩触发百分比')],
    ['ai.context.keep_recent', ai.context?.keep_recent, 4, 12, t('压缩后保留消息数')],
    ['ai.attachments.max_count', ai.attachments?.max_count, 1, 20, t('附件数量上限')],
    ['ai.attachments.max_image_mb', ai.attachments?.max_image_mb, 1, 50, t('图片附件大小上限（MB）')],
    ['ai.attachments.max_text_kb', ai.attachments?.max_text_kb, 32, 4096, t('文本附件大小上限（KB）')],
    ['ai.agent.max_iterations', ai.agent?.max_iterations, 3, 30, t('Agent 最大执行轮次')],
    ['ai.agent.timeout_min', ai.agent?.timeout_min, 1, 30, t('Agent 单任务时长上限（分钟）')],
    ['ai.agent.max_plan_steps', ai.agent?.max_plan_steps, 3, 12, t('计划步骤上限')],
    ['ai.agent.max_parallel_tools', ai.agent?.max_parallel_tools, 1, 8, t('并行工具调用数')],
    ['ai.tool_result.max_kb', ai.tool_result?.max_kb, 4, 64, t('单个工具结果预算（KB）')],
    ['ai.tool_result.run_kb', ai.tool_result?.run_kb, 32, 512, t('单次运行工具结果预算（KB）')],
    ['ai.tool_result.retention_days', ai.tool_result?.retention_days, 1, 30, t('工具结果保留天数')]
  ]) {
    if (value === undefined) continue
    if (!Number.isInteger(value) || value < min || value > max) {
      return t('{path} 必须是 {min} 到 {max} 之间的整数（{label}）', { path, min, max, label: t(label) })
    }
  }
  if (ai.agent?.scenario_models !== undefined) {
    const scenarioModels = ai.agent.scenario_models
    if (!isPlainObject(scenarioModels)) return t('ai.agent.scenario_models 必须是对象')
    for (const key of SCENARIO_MODEL_KEYS) {
      const value = scenarioModels[key]
      if (value === undefined) continue
      if (typeof value !== 'string') return t('ai.agent.scenario_models.{p0} 必须是字符串', { p0: key })
      if (value.trim() && !parseScenarioModel(value)) {
        return t('ai.agent.scenario_models.{p0} 格式应为 provider:model', { p0: key })
      }
    }
  }
  if (ai.agent?.tool_policy !== undefined && !TOOL_POLICIES.includes(ai.agent.tool_policy)) {
    return t('ai.agent.tool_policy 值不合法')
  }
  return null
}

function validateExtensions(extensions) {
  if (!isPlainObject(extensions)) return t('extensions 必须是对象')
  if (extensions.mcp_servers !== undefined) {
    if (!Array.isArray(extensions.mcp_servers)) return t('extensions.mcp_servers 必须是数组')
    const seen = new Set()
    for (const server of extensions.mcp_servers) {
      const normalized = normalizeMcpServer(server)
      if (!normalized) {
        return t('extensions.mcp_servers 中存在无效配置（服务名仅允许小写字母、数字和连字符，command 不能为空）')
      }
      if (seen.has(normalized.name)) return t('extensions.mcp_servers 服务名重复：{p0}', { p0: normalized.name })
      seen.add(normalized.name)
    }
  }
  if (extensions.disabled_skills !== undefined) {
    if (!Array.isArray(extensions.disabled_skills)) return t('extensions.disabled_skills 必须是数组')
    for (const name of extensions.disabled_skills) {
      if (!isValidSkillName(name)) return t('extensions.disabled_skills 中存在无效技能名：{p0}', { p0: name })
    }
    if (normalizeDisabledSkills(extensions.disabled_skills).length !== extensions.disabled_skills.length) {
      return t('extensions.disabled_skills 中存在重复或无效的技能名')
    }
  }
  if (extensions.skill_overrides !== undefined) {
    const overrides = extensions.skill_overrides
    if (!isPlainObject(overrides)) return t('extensions.skill_overrides 必须是对象')
    for (const [name, value] of Object.entries(overrides)) {
      if (!isValidSkillName(name)) return t('extensions.skill_overrides.{p0} 不是有效的技能名', { p0: name })
      if (!isPlainObject(value)) return t('extensions.skill_overrides.{p0} 必须是对象', { p0: name })
      if (value.description !== undefined && typeof value.description !== 'string') {
        return t('extensions.skill_overrides.{p0}.description 必须是字符串', { p0: name })
      }
    }
    if (Object.keys(normalizeSkillOverrides(overrides)).length === 0 && Object.keys(overrides).length > 0) {
      return t('extensions.skill_overrides 中没有有效的描述覆盖')
    }
  }
  return null
}

function validateNotifications(notifications) {
  if (!isPlainObject(notifications)) return t('notifications 必须是对象')
  for (const [key, value] of Object.entries(notifications)) {
    if (!NOTIFICATION_KEYS.includes(key)) return t('notifications.{p0} 不是有效的通知项', { p0: key })
    if (typeof value !== 'boolean') return t('notifications.{p0} 必须是布尔值', { p0: key })
  }
  return null
}

function validateClipboardHistory(history) {
  if (!isPlainObject(history)) return t('clipboard_history 必须是对象')
  if (history.persist !== undefined && typeof history.persist !== 'boolean') {
    return t('clipboard_history.persist 必须是布尔值')
  }
  if (history.max_entries !== undefined && !CLIPBOARD_HISTORY_LIMITS.includes(history.max_entries)) {
    return t('clipboard_history.max_entries 值不合法')
  }
  return null
}

export function validateConfig(cfg) {
  if (!isPlainObject(cfg)) return t('配置不是有效对象')
  if (cfg.config_version !== undefined && (!Number.isInteger(cfg.config_version) || cfg.config_version < 1)) {
    return t('config_version 必须是正整数')
  }
  for (const validate of [
    () => validateApp(cfg.app),
    () => validateAppearance(cfg.appearance),
    () => validateUpdate(cfg.update),
    () => validateNetwork(cfg.network),
    () => validateDatabase(cfg.database),
    () => validateSqlGenerator(cfg.sql_generator),
    () => validateAi(cfg.ai),
    () => validateExtensions(cfg.extensions),
    () => validateNotifications(cfg.notifications),
    () => validateClipboardHistory(cfg.clipboard_history)
  ]) {
    const error = validate()
    if (error) return error
  }
  if (cfg.memory !== undefined) {
    if (!isPlainObject(cfg.memory)) return t('memory 必须是对象')
    if (cfg.memory.auto_capture !== undefined && typeof cfg.memory.auto_capture !== 'boolean') {
      return t('memory.auto_capture 必须是布尔值')
    }
  }
  if (cfg.image_hosting !== undefined && !isPlainObject(cfg.image_hosting)) {
    return t('image_hosting 必须是对象')
  }
  return null
}
