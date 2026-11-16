import { VALID_CLOSE_ACTIONS, VALID_THEMES, VALID_THEME_STYLES, VALID_FONT_SIZES } from '../constants'
import { tools } from '../../shared/tools.js'
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

export const VALID_SHORTCUT_KEYS = tools.filter((tool) => tool.shortcutKey).map((tool) => tool.shortcutKey)

const SQL_AUDIT_RULE_IDS = SQL_AUDIT_RULES.map((rule) => rule.id)

export function normalizeShortcuts(raw, defaults) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...defaults }
  const result = {}
  for (const key of VALID_SHORTCUT_KEYS) {
    if (typeof raw[key] === 'string') result[key] = raw[key]
  }
  return { ...defaults, ...result }
}

export function validateConfig(cfg) {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return '配置不是有效对象'
  if (typeof cfg.base_path !== 'string') return 'base_path 必须是字符串'
  if (typeof cfg.developer_ch_name !== 'string') return 'developer_ch_name 必须是字符串'
  if (typeof cfg.developer_en_name !== 'string') return 'developer_en_name 必须是字符串'
  if (cfg.text_edit_app !== undefined && typeof cfg.text_edit_app !== 'string') return 'text_edit_app 必须是字符串'
  if (typeof cfg.auto_update !== 'boolean') return 'auto_update 必须是布尔值'
  if (typeof cfg.auto_start !== 'boolean') return 'auto_start 必须是布尔值'
  if (cfg.ai_provider !== undefined && typeof cfg.ai_provider !== 'string') return 'ai_provider 必须是字符串'
  if (cfg.ai_api_keys !== undefined && typeof cfg.ai_api_keys !== 'object') return 'ai_api_keys 必须是对象'
  if (cfg.ai_base_urls !== undefined) {
    if (!cfg.ai_base_urls || typeof cfg.ai_base_urls !== 'object' || Array.isArray(cfg.ai_base_urls)) {
      return 'ai_base_urls 必须是对象'
    }
    for (const [type, value] of Object.entries(cfg.ai_base_urls)) {
      if (typeof value !== 'string') return `ai_base_urls.${type} 必须是字符串`
      if (value.trim() && !isHttpUrl(value.trim())) return `ai_base_urls.${type} 必须是有效的 http(s) 地址`
    }
  }
  if (cfg.ai_models !== undefined) {
    if (!cfg.ai_models || typeof cfg.ai_models !== 'object' || Array.isArray(cfg.ai_models)) {
      return 'ai_models 必须是对象'
    }
    for (const [type, entry] of Object.entries(cfg.ai_models)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `ai_models.${type} 必须是对象`
      if (entry.default !== undefined && typeof entry.default !== 'string') {
        return `ai_models.${type}.default 必须是字符串`
      }
      if (entry.models !== undefined) {
        if (!Array.isArray(entry.models)) return `ai_models.${type}.models 必须是数组`
        for (const model of entry.models) {
          if (!model || typeof model !== 'object') return `ai_models.${type}.models 中的每项必须是对象`
          if (typeof model.id !== 'string' || !model.id.trim()) return `ai_models.${type}.models.id 必须是非空字符串`
          if (model.name !== undefined && typeof model.name !== 'string') {
            return `ai_models.${type}.models.name 必须是字符串`
          }
          if (model.contextWindow !== undefined) {
            if (!Number.isFinite(model.contextWindow) || model.contextWindow <= 0) {
              return `ai_models.${type}.models.contextWindow 必须是正数`
            }
          }
          if (model.maxOutput !== undefined) {
            if (!Number.isFinite(model.maxOutput) || model.maxOutput <= 0) {
              return `ai_models.${type}.models.maxOutput 必须是正数`
            }
          }
          if (model.inputTypes !== undefined) {
            if (!Array.isArray(model.inputTypes)) {
              return `ai_models.${type}.models.inputTypes 必须是数组`
            }
            for (const inputType of model.inputTypes) {
              if (inputType !== 'text' && inputType !== 'image') {
                return `ai_models.${type}.models.inputTypes 值不合法`
              }
            }
          }
        }
      }
    }
  }
  if (cfg.ai_fallback_enabled !== undefined && typeof cfg.ai_fallback_enabled !== 'boolean') {
    return 'ai_fallback_enabled 必须是布尔值'
  }
  if (cfg.ai_fallback_models !== undefined) {
    if (!Array.isArray(cfg.ai_fallback_models)) return 'ai_fallback_models 必须是数组'
    for (const item of cfg.ai_fallback_models) {
      if (typeof item !== 'string' || !item.trim()) return 'ai_fallback_models 每项必须是非空字符串'
      const separator = item.indexOf(':')
      if (separator <= 0 || separator === item.trim().length - 1) {
        return 'ai_fallback_models 每项格式应为 provider:model'
      }
    }
  }
  if (cfg.ai_persona !== undefined && typeof cfg.ai_persona !== 'string') {
    return 'ai_persona 必须是字符串'
  }
  if (cfg.ai_temperature !== undefined && cfg.ai_temperature !== null) {
    if (typeof cfg.ai_temperature !== 'number' || !Number.isFinite(cfg.ai_temperature)) {
      return 'ai_temperature 必须是数字或 null'
    }
    if (cfg.ai_temperature < 0 || cfg.ai_temperature > 2) return 'ai_temperature 必须在 0 到 2 之间'
  }
  if (cfg.ai_scenario_models !== undefined) {
    if (
      !cfg.ai_scenario_models ||
      typeof cfg.ai_scenario_models !== 'object' ||
      Array.isArray(cfg.ai_scenario_models)
    ) {
      return 'ai_scenario_models 必须是对象'
    }
    for (const key of SCENARIO_MODEL_KEYS) {
      const value = cfg.ai_scenario_models[key]
      if (value === undefined) continue
      if (typeof value !== 'string') return `ai_scenario_models.${key} 必须是字符串`
      if (value.trim() && !parseScenarioModel(value)) {
        return `ai_scenario_models.${key} 格式应为 provider:model`
      }
    }
  }
  if (cfg.ai_tool_policy !== undefined && !TOOL_POLICIES.includes(cfg.ai_tool_policy)) {
    return 'ai_tool_policy 值不合法'
  }
  if (cfg.ai_timeout !== undefined) {
    if (!Number.isInteger(cfg.ai_timeout) || cfg.ai_timeout < 10 || cfg.ai_timeout > 600) {
      return 'ai_timeout 必须是 10 到 600 之间的整数（秒）'
    }
  }
  for (const [key, min, max, label] of [
    ['ai_compress_threshold', 50, 90, '上下文压缩触发百分比'],
    ['ai_compress_keep_recent', 4, 12, '压缩后保留消息数'],
    ['ai_max_attachments', 1, 20, '附件数量上限'],
    ['ai_max_image_mb', 1, 50, '图片附件大小上限（MB）'],
    ['ai_max_text_kb', 32, 4096, '文本附件大小上限（KB）'],
    ['ai_agent_max_iterations', 3, 30, 'Agent 最大执行轮次'],
    ['ai_agent_timeout_min', 1, 30, 'Agent 单任务时长上限（分钟）'],
    ['ai_agent_plan_steps', 3, 12, '计划步骤上限'],
    ['ai_agent_parallel_tools', 1, 8, '并行工具调用数'],
    ['ai_tool_result_max_kb', 4, 64, '单个工具结果预算（KB）'],
    ['ai_tool_result_run_kb', 32, 512, '单次运行工具结果预算（KB）'],
    ['ai_tool_result_retention_days', 1, 30, '工具结果保留天数']
  ]) {
    if (cfg[key] === undefined) continue
    if (!Number.isInteger(cfg[key]) || cfg[key] < min || cfg[key] > max) {
      return `${key} 必须是 ${min} 到 ${max} 之间的整数（${label}）`
    }
  }
  if (
    cfg.recent_tools_limit !== undefined &&
    (!Number.isInteger(cfg.recent_tools_limit) ||
      cfg.recent_tools_limit < RECENT_TOOLS_LIMIT_MIN ||
      cfg.recent_tools_limit > RECENT_TOOLS_LIMIT_MAX)
  ) {
    return 'recent_tools_limit 值不合法'
  }
  if (cfg.update_check_interval !== undefined && !UPDATE_CHECK_INTERVALS.includes(cfg.update_check_interval)) {
    return 'update_check_interval 值不合法'
  }
  if (cfg.database_page_size !== undefined && !DATABASE_PAGE_SIZES.includes(cfg.database_page_size)) {
    return 'database_page_size 值不合法'
  }
  if (
    cfg.database_refresh_interval !== undefined &&
    !DATABASE_REFRESH_INTERVALS.includes(cfg.database_refresh_interval)
  ) {
    return 'database_refresh_interval 值不合法'
  }
  if (
    cfg.database_transfer_batch_size !== undefined &&
    !DATABASE_TRANSFER_BATCH_SIZES.includes(cfg.database_transfer_batch_size)
  ) {
    return 'database_transfer_batch_size 值不合法'
  }
  if (cfg.database_history_limit !== undefined && !DATABASE_HISTORY_LIMITS.includes(cfg.database_history_limit)) {
    return 'database_history_limit 值不合法'
  }
  if (!Array.isArray(cfg.databases)) return 'databases 必须是数组'
  for (const db of cfg.databases) {
    if (typeof db !== 'string') return 'databases 中的每项必须是字符串'
  }
  if (!Array.isArray(cfg.script_types)) return 'script_types 必须是数组'
  for (const st of cfg.script_types) {
    if (!st || typeof st !== 'object') return 'script_types 中的每项必须是对象'
    if (typeof st.name !== 'string') return 'script_types.name 必须是字符串'
  }
  if (cfg.close_action && !VALID_CLOSE_ACTIONS.includes(cfg.close_action)) return 'close_action 值不合法'
  if (cfg.theme !== undefined && !VALID_THEMES.includes(cfg.theme)) return 'theme 值不合法'
  if (cfg.theme_style !== undefined && !VALID_THEME_STYLES.includes(cfg.theme_style)) {
    return 'theme_style 值不合法'
  }
  if (cfg.font_size !== undefined && !VALID_FONT_SIZES.includes(cfg.font_size)) {
    return 'font_size 值不合法'
  }
  if (cfg.memory_auto_capture !== undefined && typeof cfg.memory_auto_capture !== 'boolean') {
    return 'memory_auto_capture 必须是布尔值'
  }
  if (cfg.database_safe_mode !== undefined && typeof cfg.database_safe_mode !== 'boolean') {
    return 'database_safe_mode 必须是布尔值'
  }
  if (cfg.database_audit_enabled !== undefined && typeof cfg.database_audit_enabled !== 'boolean') {
    return 'database_audit_enabled 必须是布尔值'
  }
  if (cfg.database_audit_strict !== undefined && typeof cfg.database_audit_strict !== 'boolean') {
    return 'database_audit_strict 必须是布尔值'
  }
  if (cfg.database_audit_rules !== undefined) {
    if (
      !cfg.database_audit_rules ||
      typeof cfg.database_audit_rules !== 'object' ||
      Array.isArray(cfg.database_audit_rules)
    ) {
      return 'database_audit_rules 必须是对象'
    }
    for (const [ruleId, enabled] of Object.entries(cfg.database_audit_rules)) {
      if (!SQL_AUDIT_RULE_IDS.includes(ruleId)) return `database_audit_rules.${ruleId} 不是有效的审核规则`
      if (typeof enabled !== 'boolean') return `database_audit_rules.${ruleId} 必须是布尔值`
    }
  }
  if (cfg.database_operation_log_enabled !== undefined && typeof cfg.database_operation_log_enabled !== 'boolean') {
    return 'database_operation_log_enabled 必须是布尔值'
  }
  if (cfg.db_backup_tasks !== undefined) {
    if (!Array.isArray(cfg.db_backup_tasks)) return 'db_backup_tasks 必须是数组'
    const ids = new Set()
    for (const item of cfg.db_backup_tasks) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return 'db_backup_tasks 中的每项必须是对象'
      const task = normalizeBackupTask(item)
      if (!task.id) return 'db_backup_tasks 中的任务缺少 id'
      if (!task.name) return 'db_backup_tasks 中的任务缺少名称'
      if (ids.has(task.id)) return `db_backup_tasks 任务 id 重复：${task.id}`
      ids.add(task.id)
    }
  }
  if (cfg.shortcuts !== undefined) {
    if (typeof cfg.shortcuts !== 'object') return 'shortcuts 必须是对象'
    for (const key of Object.keys(cfg.shortcuts)) {
      if (!VALID_SHORTCUT_KEYS.includes(key)) return `shortcuts.${key} 不是有效的快捷键配置项`
      if (typeof cfg.shortcuts[key] !== 'string') return `shortcuts.${key} 必须是字符串`
    }
  }
  if (cfg.image_hosting !== undefined) {
    if (!cfg.image_hosting || typeof cfg.image_hosting !== 'object' || Array.isArray(cfg.image_hosting)) {
      return 'image_hosting 必须是对象'
    }
  }
  if (cfg.database_editor !== undefined) {
    const editor = cfg.database_editor
    if (!editor || typeof editor !== 'object' || Array.isArray(editor)) return 'database_editor 必须是对象'
    if (editor.theme !== undefined && !DATABASE_EDITOR_THEMES.includes(editor.theme)) {
      return 'database_editor.theme 值不合法'
    }
    for (const key of DATABASE_EDITOR_BOOLEAN_KEYS) {
      if (editor[key] !== undefined && typeof editor[key] !== 'boolean') {
        return `database_editor.${key} 必须是布尔值`
      }
    }
  }
  if (cfg.mcp_servers !== undefined) {
    if (!Array.isArray(cfg.mcp_servers)) return 'mcp_servers 必须是数组'
    const seen = new Set()
    for (const server of cfg.mcp_servers) {
      const normalized = normalizeMcpServer(server)
      if (!normalized) return 'mcp_servers 中存在无效配置（服务名仅允许小写字母、数字和连字符，command 不能为空）'
      if (seen.has(normalized.name)) return `mcp_servers 服务名重复：${normalized.name}`
      seen.add(normalized.name)
    }
  }
  if (cfg.disabled_skills !== undefined) {
    if (!Array.isArray(cfg.disabled_skills)) return 'disabled_skills 必须是数组'
    for (const name of cfg.disabled_skills) {
      if (!isValidSkillName(name)) return `disabled_skills 中存在无效技能名：${name}`
    }
  }
  if (cfg.skill_overrides !== undefined) {
    if (!cfg.skill_overrides || typeof cfg.skill_overrides !== 'object' || Array.isArray(cfg.skill_overrides)) {
      return 'skill_overrides 必须是对象'
    }
    for (const [name, value] of Object.entries(cfg.skill_overrides)) {
      if (!isValidSkillName(name)) return `skill_overrides.${name} 不是有效的技能名`
      if (!value || typeof value !== 'object' || Array.isArray(value)) return `skill_overrides.${name} 必须是对象`
      if (value.description !== undefined && typeof value.description !== 'string') {
        return `skill_overrides.${name}.description 必须是字符串`
      }
    }
    if (
      Object.keys(normalizeSkillOverrides(cfg.skill_overrides)).length === 0 &&
      Object.keys(cfg.skill_overrides).length > 0
    ) {
      return 'skill_overrides 中没有有效的描述覆盖'
    }
  }
  if (
    cfg.disabled_skills !== undefined &&
    normalizeDisabledSkills(cfg.disabled_skills).length !== cfg.disabled_skills.length
  ) {
    return 'disabled_skills 中存在重复或无效的技能名'
  }
  if (cfg.network !== undefined) {
    const network = cfg.network
    if (!network || typeof network !== 'object' || Array.isArray(network)) return 'network 必须是对象'
    if (network.proxy !== undefined) {
      const proxy = network.proxy
      if (!proxy || typeof proxy !== 'object' || Array.isArray(proxy)) return 'network.proxy 必须是对象'
      if (proxy.mode !== undefined && !PROXY_MODES.includes(proxy.mode)) return 'network.proxy.mode 值不合法'
      if (proxy.url !== undefined && typeof proxy.url !== 'string') return 'network.proxy.url 必须是字符串'
      if (proxy.bypass !== undefined && typeof proxy.bypass !== 'string') return 'network.proxy.bypass 必须是字符串'
      if (proxy.mode === 'manual' && (!proxy.url || !proxy.url.trim()))
        return 'network.proxy.mode 为手动时必须填写代理地址'
      if (proxy.url && proxy.url.trim() && !isProxyUrl(proxy.url.trim())) {
        return 'network.proxy.url 必须是有效的 http(s) 或 socks5 地址'
      }
    }
  }
  if (cfg.market_sources !== undefined) {
    const sources = cfg.market_sources
    if (!sources || typeof sources !== 'object' || Array.isArray(sources)) return 'market_sources 必须是对象'
    for (const [key, value] of Object.entries(sources)) {
      if (key !== 'clawhub' && key !== 'mcp_registry' && key !== 'update_feed') {
        return `market_sources.${key} 不是有效的配置项`
      }
      if (typeof value !== 'string') return `market_sources.${key} 必须是字符串`
      if (value.trim() && !isHttpUrl(value.trim())) return `market_sources.${key} 必须是有效的 http(s) 地址`
    }
  }
  if (cfg.notifications !== undefined) {
    const notifications = cfg.notifications
    if (!notifications || typeof notifications !== 'object' || Array.isArray(notifications)) {
      return 'notifications 必须是对象'
    }
    for (const [key, value] of Object.entries(notifications)) {
      if (!NOTIFICATION_KEYS.includes(key)) return `notifications.${key} 不是有效的通知项`
      if (typeof value !== 'boolean') return `notifications.${key} 必须是布尔值`
    }
  }
  if (cfg.clipboard_history !== undefined) {
    const history = cfg.clipboard_history
    if (!history || typeof history !== 'object' || Array.isArray(history)) {
      return 'clipboard_history 必须是对象'
    }
    if (history.persist !== undefined && typeof history.persist !== 'boolean') {
      return 'clipboard_history.persist 必须是布尔值'
    }
    if (history.max_entries !== undefined && !CLIPBOARD_HISTORY_LIMITS.includes(history.max_entries)) {
      return 'clipboard_history.max_entries 值不合法'
    }
  }
  return null
}
