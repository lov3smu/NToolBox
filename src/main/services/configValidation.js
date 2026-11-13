import { VALID_CLOSE_ACTIONS, VALID_THEMES, VALID_THEME_STYLES, VALID_FONT_SIZES } from '../constants'
import { tools } from '../../shared/tools.js'

export const VALID_SHORTCUT_KEYS = tools.filter((tool) => tool.shortcutKey).map((tool) => tool.shortcutKey)

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
        }
      }
    }
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
  if (cfg.shortcuts !== undefined) {
    if (typeof cfg.shortcuts !== 'object') return 'shortcuts 必须是对象'
    for (const key of Object.keys(cfg.shortcuts)) {
      if (!VALID_SHORTCUT_KEYS.includes(key)) return `shortcuts.${key} 不是有效的快捷键配置项`
      if (typeof cfg.shortcuts[key] !== 'string') return `shortcuts.${key} 必须是字符串`
    }
  }
  return null
}
