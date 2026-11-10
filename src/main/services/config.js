import { app, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { log } from '../utils'
import { getConfigPath, installDir } from '../utils/path'
import { initCrypto, decryptDbPassword, encryptDbPassword } from '../utils/crypto'
import { validateConfig, normalizeShortcuts } from './configValidation'
import { VALID_THEMES, VALID_THEME_STYLES, VALID_FONT_SIZES } from '../constants'

export { validateConfig }

let config = {}

export function getConfig() {
  return config
}

export function setConfig(newConfig) {
  config = newConfig
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
        models.push({
          id,
          name: normalizeModelName(type, id, model.name)
        })
      }
    }
    const defaultModel = typeof entry.default === 'string' ? entry.default.trim() : ''
    if (models.length === 0 && !defaultModel) continue
    result[type] = { default: defaultModel, models }
  }
  return result
}

function getDefaultConfigContent() {
  const defaultBasePath = path.join(installDir, 'Develop', '11 - Database Script')
  return {
    base_path: defaultBasePath,
    developer_ch_name: '张三',
    developer_en_name: 'zhangsan',
    text_edit_app: '',
    auto_update: true,
    auto_start: true,
    first_launch_done: false,
    close_action: 'ask',
    theme: 'system',
    theme_style: 'sapphire',
    font_size: 'medium',
    ai_provider: 'bailian',
    ai_api_keys: {
      bailian: '',
      moonshot: '',
      zhipu: '',
      minimax: '',
      minimax_group_id: '',
      volcengine: '',
      volcengine_endpoint_id: '',
      deepseek: ''
    },
    ai_models: {},
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
    }
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
    let data
    try {
      data = await fs.promises.readFile(configPath, 'utf8')
    } catch (readError) {
      if (readError.code === 'ENOENT') {
        log.info('配置文件不存在，创建默认配置')
        config = await createDefaultConfig()
        return config
      }
      throw readError
    }

    const loadedConfig = JSON.parse(data)
    const defaultConfig = getDefaultConfigContent()

    config = { ...defaultConfig, ...loadedConfig }

    if (config.auto_update === undefined) config.auto_update = true
    if (config.auto_start === undefined) config.auto_start = true
    if (config.first_launch_done === undefined) config.first_launch_done = false
    if (config.close_action === undefined) config.close_action = 'ask'
    if (!VALID_THEMES.includes(config.theme)) config.theme = 'system'
    if (!VALID_THEME_STYLES.includes(config.theme_style)) config.theme_style = 'sapphire'
    if (!VALID_FONT_SIZES.includes(config.font_size)) config.font_size = 'medium'
    if (config.ai_provider === undefined) config.ai_provider = 'bailian'

    if (!config.ai_api_keys || typeof config.ai_api_keys !== 'object') {
      config.ai_api_keys = { ...defaultConfig.ai_api_keys }
    } else {
      config.ai_api_keys = { ...defaultConfig.ai_api_keys, ...config.ai_api_keys }
    }

    config.ai_models = normalizeAiModels(config.ai_models)

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

export async function saveConfig(newConfig) {
  try {
    // 与现有配置合并，避免局部保存（如设置页不提交 first_launch_done、dbConnections）丢字段
    const mergedConfig = { ...config, ...newConfig }
    const error = validateConfig(mergedConfig)
    if (error) {
      log.error('配置校验失败:', error)
      return false
    }

    const configToSave = JSON.parse(JSON.stringify(mergedConfig))
    configToSave.ai_models = normalizeAiModels(configToSave.ai_models)

    if (Array.isArray(configToSave.dbConnections)) {
      for (const conn of configToSave.dbConnections) {
        if (conn.password && conn.savePassword) {
          conn.password = encryptDbPassword(conn.password)
        } else if (conn.password && !conn.savePassword) {
          conn.password = ''
        }
      }
    }

    const configPath = getConfigPath()
    try {
      await fs.promises.copyFile(configPath, `${configPath}.bak`)
    } catch (error) {
      if (error.code !== 'ENOENT') log.error('备份配置文件失败:', error)
    }
    await fs.promises.writeFile(configPath, JSON.stringify(configToSave, null, 2), 'utf8')
    config = { ...mergedConfig, ai_models: configToSave.ai_models }
    log.info('配置保存成功')
    return true
  } catch (error) {
    log.error('保存配置文件失败:', error)
    return false
  }
}
