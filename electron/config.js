const { app, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises
const log = require('electron-log')
const { VALID_CLOSE_ACTIONS } = require('./common/constants')

function getInstallDir() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

const installDir = getInstallDir()
const configPath = path.join(installDir, 'config.json')

let config = {}

function getConfig() {
  return config
}

function setConfig(newConfig) {
  config = newConfig
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
    databases: [
      'order_db', 'product_db', 'community_db', 'content_db', 'device_db',
      'main_db', 'promotion_db', 'ota_db', 'payment_db', 'pmp_db',
      'report_db', 'report_data_db', 'sharespace_db', 'user_db',
      'workbench_db', 'worktask_db', 'data_warehouse_db',
    ],
    script_types: [
      { name: 'DDL', description: 'Data Definition Language (CREATE, ALTER, DROP)' },
      { name: 'DML', description: 'Data Manipulation Language (INSERT, UPDATE, DELETE)' },
      { name: 'DQL', description: 'Data Query Language (SELECT)' },
    ],
    shortcuts: {
      home: 'CmdOrCtrl+H',
      password: 'CmdOrCtrl+P',
      cron: 'CmdOrCtrl+Shift+C',
      template: 'CmdOrCtrl+T',
      settings: 'CmdOrCtrl+,'
    },
  }
}

async function createDefaultConfig() {
  try {
    const defaultConfig = getDefaultConfigContent()
    await fsPromises.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8')
    log.info('已创建默认配置文件:', configPath)
    return defaultConfig
  } catch (error) {
    log.error('创建默认配置文件失败:', error)
    throw error
  }
}

function validateConfig(cfg) {
  if (!cfg || typeof cfg !== 'object') return '配置不是有效对象'
  if (typeof cfg.base_path !== 'string') return 'base_path 必须是字符串'
  if (typeof cfg.developer_ch_name !== 'string') return 'developer_ch_name 必须是字符串'
  if (typeof cfg.developer_en_name !== 'string') return 'developer_en_name 必须是字符串'
  if (cfg.text_edit_app !== undefined && typeof cfg.text_edit_app !== 'string') return 'text_edit_app 必须是字符串'
  if (typeof cfg.auto_update !== 'boolean') return 'auto_update 必须是布尔值'
  if (typeof cfg.auto_start !== 'boolean') return 'auto_start 必须是布尔值'
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
  if (cfg.shortcuts !== undefined) {
    if (typeof cfg.shortcuts !== 'object') return 'shortcuts 必须是对象'
    const validKeys = ['home', 'password', 'cron', 'template', 'settings']
    for (const key of Object.keys(cfg.shortcuts)) {
      if (!validKeys.includes(key)) return `shortcuts.${key} 不是有效的快捷键配置项`
      if (typeof cfg.shortcuts[key] !== 'string') return `shortcuts.${key} 必须是字符串`
    }
  }
  return null
}

async function loadConfig() {
  try {
    let data
    try {
      data = await fsPromises.readFile(configPath, 'utf8')
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

async function saveConfig(newConfig) {
  try {
    const error = validateConfig(newConfig)
    if (error) {
      log.error('配置校验失败:', error)
      return false
    }
    await fsPromises.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf8')
    config = newConfig
    log.info('配置保存成功')
    return true
  } catch (error) {
    log.error('保存配置文件失败:', error)
    return false
  }
}

module.exports = {
  installDir,
  configPath,
  getConfig,
  setConfig,
  loadConfig,
  saveConfig,
  validateConfig,
}