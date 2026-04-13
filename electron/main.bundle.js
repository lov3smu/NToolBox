const { app, BrowserWindow, dialog, ipcMain, Menu, Tray, nativeImage, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const fsPromises = require('fs').promises
const { execFile } = require('child_process')
const log = require('electron-log')
const { autoUpdater } = require('electron-updater')

const MIN_SPLASH_DISPLAY_TIME = 3000
const UPDATE_CHECK_INTERVAL = 12 * 60 * 60 * 1000
const VALID_CLOSE_ACTIONS = ['ask', 'hide', 'quit']
const VALID_OPERATE_TYPES = ['FIX', 'PUBLISH', 'QUERY']

function escapeSql(str) {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '')
}

function isValidIdentifier(name) {
  if (!name || typeof name !== 'string') return false
  return /^[a-zA-Z0-9_]+$/.test(name)
}

function escapeIdentifier(name) {
  if (!name) return '``'
  return '`' + name.replace(/`/g, '``') + '`'
}

function sanitizePathSegment(segment) {
  if (!segment || typeof segment !== 'string') return ''
  return segment
    .replace(/\.\./g, '')
    .replace(/[\/\\:*?"<>|]/g, '_')
    .trim()
}

function isPathWithinBase(targetPath, basePath) {
  const resolvedTarget = path.resolve(targetPath)
  const resolvedBase = path.resolve(basePath)
  return resolvedTarget.startsWith(resolvedBase + path.sep) || resolvedTarget === resolvedBase
}

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

let isGenerating = false

async function generateSQLFile(scriptInfo) {
  if (isGenerating) {
    return { success: false, error: '正在生成中，请稍后再试' }
  }
  isGenerating = true

  try {
    const currentConfig = getConfig()
    log.info('开始生成SQL文件', scriptInfo)

    if (!scriptInfo || typeof scriptInfo !== 'object') {
      throw new Error('无效的脚本信息')
    }
    if (!isValidIdentifier(scriptInfo.database)) {
      throw new Error('数据库名称不合法，仅允许字母、数字和下划线')
    }
    if (!VALID_OPERATE_TYPES.includes(scriptInfo.operateType)) {
      throw new Error('无效的操作类型')
    }
    if (scriptInfo.operateType !== 'QUERY') {
      if (!scriptInfo.scriptType || !isValidIdentifier(scriptInfo.scriptType)) {
        throw new Error('脚本类型不合法，仅允许字母、数字和下划线')
      }
    }

    const safeDirName = sanitizePathSegment(scriptInfo.dirName)
    const safeUsageForFilename = sanitizePathSegment(scriptInfo.usage)
    if (!safeDirName) throw new Error('目录名不能为空或包含非法字符')
    if (!safeUsageForFilename) throw new Error('脚本用途不能为空或包含非法字符')

    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentDate = now.toISOString().split('T')[0]
    const dateCompact = now.toISOString().slice(2, 10).replace(/-/g, '')

    let targetPath
    switch (scriptInfo.operateType) {
      case 'FIX':
        targetPath = path.join(currentConfig.base_path, 'PRODUCT-FIX', currentYear, safeDirName)
        if (scriptInfo.scriptType) targetPath = path.join(targetPath, scriptInfo.scriptType)
        break
      case 'PUBLISH':
        targetPath = path.join(currentConfig.base_path, 'PUBLISH', currentYear, safeDirName)
        if (scriptInfo.scriptType) targetPath = path.join(targetPath, scriptInfo.scriptType)
        break
      case 'QUERY':
        targetPath = path.join(currentConfig.base_path, 'DATA-QUERY', currentYear, safeDirName)
        break
    }

    if (!isPathWithinBase(targetPath, currentConfig.base_path)) {
      throw new Error('目标路径超出允许范围')
    }

    await fsPromises.mkdir(targetPath, { recursive: true })

    const files = await fsPromises.readdir(targetPath)
    const sqlFiles = files.filter(f => f.endsWith('.sql'))
    let maxNumber = 0
    for (const f of sqlFiles) {
      const match = f.match(/^S(\d+)-/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }
    const nextNumber = maxNumber + 1
    const padWidth = Math.max(3, String(nextNumber).length)
    const sNumber = `S${String(nextNumber).padStart(padWidth, '0')}`

    let filename
    if (scriptInfo.operateType === 'QUERY') {
      filename = `${sNumber}-${currentDate}-${scriptInfo.database}-${safeUsageForFilename}.sql`
    } else {
      filename = `${sNumber}-${currentDate}-${scriptInfo.scriptType}-${scriptInfo.database}-${safeUsageForFilename}.sql`
    }
    filename = filename.replace(/\s/g, '_')

    const filePath = path.join(targetPath, filename)
    if (!isPathWithinBase(filePath, currentConfig.base_path)) {
      throw new Error('生成的文件路径超出允许范围')
    }

    const safeUsage = escapeSql(scriptInfo.usage)
    const safeDevEnName = escapeSql(currentConfig.developer_en_name)
    const safeFilename = escapeSql(filename)
    const safeDbIdentifier = escapeIdentifier(scriptInfo.database)

    const content = `-- Please use UTF8 encoding without BOM
-- Script Usage: ${scriptInfo.usage}
-- Script Author: ${currentConfig.developer_ch_name}
-- Creation Time: ${currentDate}

USE ${safeDbIdentifier};

BEGIN;

SET @author = '${safeDevEnName}${dateCompact}';

INSERT INTO t_script_history (scriptName, remark, create_by, modify_by, create_time, modify_time)
VALUES ('${safeFilename}', '${safeUsage}', @author, @author, NOW(), NOW());

COMMIT;
`

    await fsPromises.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' })

    return { success: true, filePath, filename, targetPath }
  } catch (error) {
    log.error('生成SQL文件失败:', error)
    return { success: false, error: error.message }
  } finally {
    isGenerating = false
  }
}

async function openFile(filePath, editor) {
  try {
    await fsPromises.access(filePath)
    if (editor && editor !== '') {
      try {
        const editorStat = await fsPromises.stat(editor)
        if (!editorStat.isFile()) {
          log.error('编辑器路径不是有效文件:', editor)
          await shell.openPath(filePath)
          return true
        }
      } catch (statErr) {
        log.error('编辑器路径不存在，回退到系统默认:', editor, statErr.message)
        await shell.openPath(filePath)
        return true
      }
      execFile(editor, [filePath], (err) => {
        if (err) log.error('使用编辑器打开文件失败:', err)
      })
    } else {
      await shell.openPath(filePath)
    }
    return true
  } catch (error) {
    log.error('打开文件失败:', error)
    return false
  }
}

async function openFolder(folderPath) {
  try {
    await fsPromises.access(folderPath)
    await shell.openPath(folderPath)
    return true
  } catch (error) {
    log.error('打开文件夹失败:', error)
    return false
  }
}

async function setAutoStart(enable) {
  try {
    if (!app.isPackaged) {
      log.warn('开发环境，跳过开机启动设置')
      return true
    }

    const exePath = process.execPath
    log.info(`设置开机启动: ${enable ? '开启' : '关闭'}，路径: ${exePath}`)

    app.setLoginItemSettings({
      openAtLogin: enable,
      path: exePath,
    })

    const settings = app.getLoginItemSettings({
      path: exePath,
    })
    log.info(`开机启动验证: openAtLogin=${settings.openAtLogin}`)

    return true
  } catch (error) {
    log.error('设置开机启动失败:', error)
    return false
  }
}

async function getAutoStart() {
  if (!app.isPackaged) return false
  return app.getLoginItemSettings().openAtLogin
}

async function promptAutoStartOnFirstLaunch(mainWindow) {
  const currentConfig = getConfig()

  if (currentConfig.first_launch_done) {
    log.info('首次启动询问已完成')
    if (app.isPackaged) {
      await setAutoStart(currentConfig.auto_start)
    }
    return
  }

  log.info('首次启动，准备弹窗询问开机启动设置')

  if (!mainWindow || mainWindow.isDestroyed()) {
    log.warn('主窗口不存在，跳过弹窗')
    return
  }

  setTimeout(async () => {
    try {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: '开机启动',
        message: '是否设置开机自动启动？',
        detail: '开启后，系统启动时会自动运行本应用。\n\n您也可以在【设置】页面随时更改此选项。',
        buttons: ['开启', '不开启'],
        defaultId: 0,
        cancelId: 1,
      })

      const enableAutoStart = result.response === 0
      await setAutoStart(enableAutoStart)
      currentConfig.auto_start = enableAutoStart
      currentConfig.first_launch_done = true
      await saveConfig(currentConfig)

      log.info(`首次启动询问结果: ${enableAutoStart ? '开启' : '关闭'}开机启动`)
    } catch (error) {
      log.error('开机启动询问失败:', error)
    }
  }, 1000)
}

autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'
autoUpdater.logger.transports.console.level = 'debug'

if (process.platform === 'win32') {
  autoUpdater.autoDownload = false
  autoUpdater.allowPrerelease = false
}

let updateCheckInterval = null

function checkForUpdates(manual = true, mainWindow = null) {
  if (!app.isPackaged) {
    log.info('开发环境，跳过更新检查')
    if (manual && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '检查更新',
        message: '当前为开发环境，无法检查更新。\n请打包后测试更新功能。',
        buttons: ['确定'],
      })
    }
    return Promise.resolve({ status: 'dev-environment' })
  }

  log.info('开始检查更新，手动触发:', manual)

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'lov3smu',
    repo: 'sql-script-generator',
    releaseType: 'release',
  })

  autoUpdater.removeAllListeners('checking-for-update')
  autoUpdater.removeAllListeners('update-available')
  autoUpdater.removeAllListeners('update-not-available')
  autoUpdater.removeAllListeners('error')
  autoUpdater.removeAllListeners('download-progress')
  autoUpdater.removeAllListeners('update-downloaded')

  return new Promise((resolve) => {
    autoUpdater.once('checking-for-update', () => {
      log.info('正在检查更新...')
      if (manual && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', '正在检查更新...')
      }
    })

    autoUpdater.once('update-available', (info) => {
      log.info('发现新版本:', info.version)
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '发现新版本',
          message: `发现新版本 ${info.version}，是否立即下载？`,
          buttons: ['下载', '以后'],
        }).then(result => {
          if (result.response === 0) autoUpdater.downloadUpdate()
        })
      }
      resolve({ status: 'update-available', info })
    })

    autoUpdater.once('update-not-available', () => {
      log.info('当前已是最新版本')
      if (manual && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '检查更新',
          message: '当前已是最新版本',
          buttons: ['确定'],
        })
      }
      resolve({ status: 'update-not-available' })
    })

    autoUpdater.once('error', (err) => {
      log.error('更新出错:', err)
      
      if (err.message && err.message.includes('not signed')) {
        log.warn('更新包签名验证失败')
        if (manual && mainWindow && !mainWindow.isDestroyed()) {
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: '更新失败',
            message: '无法安装更新：更新包签名验证失败。\n\n请前往 GitHub Releases 页面手动下载最新版本。',
            buttons: ['前往下载', '取消'],
          }).then(result => {
            if (result.response === 0) {
              shell.openExternal(
                'https://github.com/lov3smu/sql-script-generator/releases'
              )
            }
          })
        }
        resolve({ status: 'error', error: err })
        return
      }
      
      if (manual && mainWindow && !mainWindow.isDestroyed()) {
        dialog.showErrorBox('检查更新失败', `无法检查更新：${err.message}`)
      }
      resolve({ status: 'error', error: err })
    })

    autoUpdater.once('download-progress', (progressObj) => {
      log.info(`下载进度: ${progressObj.percent}%`)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-progress', progressObj.percent)
      }
    })

    autoUpdater.once('update-downloaded', (info) => {
      log.info('更新下载完成:', info)
      if (!mainWindow || mainWindow.isDestroyed()) {
        log.warn('主窗口不存在，跳过更新安装提示')
        return
      }
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '更新就绪',
        message: `新版本 ${info.version} 已下载完成，是否立即重启安装？`,
        buttons: ['立即重启', '稍后'],
      }).then(result => {
        if (result.response === 0) autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.checkForUpdatesAndNotify()
  })
}

function startAutoUpdateCheck(mainWindow) {
  if (updateCheckInterval) clearInterval(updateCheckInterval)

  const currentConfig = getConfig()
  if (currentConfig.auto_update && app.isPackaged) {
    updateCheckInterval = setInterval(() => {
      log.info('定时检查更新')
      checkForUpdates(false, mainWindow)
    }, UPDATE_CHECK_INTERVAL)
    log.info(`已启动定时更新检查，间隔: ${UPDATE_CHECK_INTERVAL / 3600000} 小时`)
  } else {
    log.info('定时更新检查未开启')
  }
}

let tray = null
let trayMainWindow = null

function getIconPath() {
  let iconPath = null
  if (app.isPackaged) {
    const resourcesDir = process.resourcesPath
    const possiblePaths = [
      path.join(resourcesDir, 'assets', 'icon.ico'),
      path.join(resourcesDir, 'assets', 'icon.png'),
    ]
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) { iconPath = p; break }
    }
  } else {
    const devIco = path.join(__dirname, '..', 'assets', 'icon.ico')
    const devPng = path.join(__dirname, '..', 'assets', 'icon.png')
    if (fs.existsSync(devIco)) iconPath = devIco
    else if (fs.existsSync(devPng)) iconPath = devPng
  }
  return iconPath
}

function createTray(window, checkForUpdatesFn, createSettingsWindowFn) {
  trayMainWindow = window
  
  if (tray) {
    tray.destroy()
    tray = null
  }

  let iconPath = getIconPath()
  
  if (!iconPath || !fs.existsSync(iconPath)) {
    const defaultIcon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAADSSURBVDiNpZMxSgNBFIafNwsJFhZqY6WVWAgWXiCtF2gTb2AnHkGwtBEtBAsL8QpWsRFUkNRCYwjMzm4KhyCbKDObeTL8/3zzzftn4H+zTGn2V1OrB2CSUgqPLZtFQnSj1Pz5tSIlgPco0n1dUj9kzT1EW1IqyUYZ0K1AN+Ms0s1zIcR99mZ3AH5n4DqbzDMIE6CvjR7gBqgUYhfnAAdoCmB2JxVrKwf0QwhhpVgLfRDCE9C/HgT4HntSygXKskzlnH+A5c2Oruu+mqaRZVm+r+u6/iCE8F7f3F0AbRfnMiBN7nQAAAAASUVORK5CYII='
    )
    tray = new Tray(defaultIcon)
  } else {
    tray = new Tray(iconPath)
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (trayMainWindow && !trayMainWindow.isDestroyed()) {
          trayMainWindow.show()
          if (trayMainWindow.isMinimized()) trayMainWindow.restore()
          trayMainWindow.focus()
        }
      },
    },
    { type: 'separator' },
    {
      label: '密码生成器',
      click: () => {
        if (trayMainWindow && !trayMainWindow.isDestroyed()) {
          trayMainWindow.show()
          trayMainWindow.webContents.send('navigate-to', '/password')
        }
      },
    },
    {
      label: 'Cron表达式生成器',
      click: () => {
        if (trayMainWindow && !trayMainWindow.isDestroyed()) {
          trayMainWindow.show()
          trayMainWindow.webContents.send('navigate-to', '/cron')
        }
      },
    },
    {
      label: 'SQL模版生成器',
      click: () => {
        if (trayMainWindow && !trayMainWindow.isDestroyed()) {
          trayMainWindow.show()
          trayMainWindow.webContents.send('navigate-to', '/template')
        }
      },
    },
    {
      label: '设置',
      click: () => {
        createSettingsWindowFn()
      },
    },
    { type: 'separator' },
    {
      label: '检查更新',
      click: () => checkForUpdatesFn(true, trayMainWindow),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        destroyTray()
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)
  tray.setToolTip('SQL Script Generator')

  tray.on('click', () => {
    if (trayMainWindow && !trayMainWindow.isDestroyed()) {
      if (trayMainWindow.isVisible()) {
        trayMainWindow.hide()
      } else {
        trayMainWindow.show()
        if (trayMainWindow.isMinimized()) trayMainWindow.restore()
        trayMainWindow.focus()
      }
    }
  })

  tray.on('double-click', () => {
    if (trayMainWindow && !trayMainWindow.isDestroyed()) {
      trayMainWindow.show()
      if (trayMainWindow.isMinimized()) trayMainWindow.restore()
      trayMainWindow.focus()
    }
  })

  log.info('系统托盘已创建')
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

let packageJson = null
try {
  packageJson = require('../package.json')
} catch (e) {
  packageJson = { version: '0.0.0', author: '', name: 'sql-script-generator', description: '' }
}

function setupIPCHandlers(getMainWindow, checkForUpdatesFn, createAppMenuFn, createSettingsWindowFn) {
  ipcMain.handle('get-config', async () => getConfig())

  ipcMain.handle('get-package-info', async () => ({
    version: packageJson.version,
    author: packageJson.author,
    name: packageJson.name,
    description: packageJson.description,
  }))

  ipcMain.handle('save-config', async (_event, newConfig) => await saveConfig(newConfig))

  ipcMain.handle('generate-script', async (_event, scriptInfo) => await generateSQLFile(scriptInfo))

  ipcMain.handle('open-file', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return false
    const currentConfig = getConfig()
    if (currentConfig.base_path && !isPathWithinBase(filePath, currentConfig.base_path)) {
      log.warn('拒绝打开 base_path 外的文件:', filePath)
      return false
    }
    return await openFile(filePath, currentConfig.text_edit_app)
  })

  ipcMain.handle('open-folder', async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') return false
    const currentConfig = getConfig()
    if (currentConfig.base_path && !isPathWithinBase(folderPath, currentConfig.base_path)) {
      log.warn('拒绝打开 base_path 外的文件夹:', folderPath)
      return false
    }
    return await openFolder(folderPath)
  })

  ipcMain.handle('select-directory', async () => {
    const mainWindow = getMainWindow()
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    return result.filePaths[0] || ''
  })

  ipcMain.handle('select-file', async () => {
    const mainWindow = getMainWindow()
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '可执行文件', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    return result.filePaths[0] || ''
  })

  ipcMain.handle('reload-config', async () => await loadConfig())

  ipcMain.handle('set-auto-start', async (_event, enable) => await setAutoStart(enable))
  ipcMain.handle('get-auto-start', async () => await getAutoStart())

  ipcMain.handle('check-for-updates', async (_event, manual) => {
    const mainWindow = getMainWindow()
    return await checkForUpdatesFn(manual, mainWindow)
  })

  ipcMain.handle('open-settings', async () => {
    createSettingsWindow()
    return true
  })

  ipcMain.handle('close-settings-window', async () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close()
    }
  })

  ipcMain.handle('reload-menu', async () => {
    const mainWindow = getMainWindow()
    if (mainWindow && createAppMenuFn) {
      createAppMenuFn(mainWindow, checkForUpdatesFn, createSettingsWindowFn)
      return true
    }
    return false
  })
}

const logDir = path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd(), 'logs')
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}
log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log')
log.transports.file.level = 'info'
log.transports.console.level = 'debug'

log.info('========================================')
log.info('应用启动')
log.info('========================================')

let mainWindow = null
let settingsWindow = null
let splashWindow = null
let splashStartTime = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createSplashWindow(onReady) {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '启动中...',
  })

  if (VITE_DEV_SERVER_URL) {
    splashWindow.loadURL(VITE_DEV_SERVER_URL.replace(/\/$/, '') + '/splash.html')
  } else {
    splashWindow.loadFile(path.join(__dirname, '../dist/splash.html'))
  }

  splashWindow.center()

  splashWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.show()
      splashStartTime = Date.now()
      log.info('启动窗口已显示')
      if (onReady) onReady()
    }
  })

  splashWindow.on('closed', () => {
    splashWindow = null
  })

  return splashWindow
}

function closeSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close()
    splashWindow = null
  }
}

function createWindow() {
  const iconPath = getIconPath()
  
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    backgroundColor: '#667eea',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'SQL Script Generator',
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    const elapsed = Date.now() - (splashStartTime || Date.now())
    const minSplashTime = 1500
    const delay = Math.max(0, minSplashTime - elapsed)

    setTimeout(() => {
      closeSplashWindow()
      mainWindow.maximize()
      mainWindow.show()
      log.info('主窗口已显示')
      
      setTimeout(() => promptAutoStartOnFirstLaunch(mainWindow), 1000)
    }, delay)
  })

  mainWindow.on('close', async (event) => {
    if (app.isQuitting) return
    event.preventDefault()

    const currentConfig = getConfig()

    if (currentConfig.close_action === 'hide') {
      mainWindow.hide()
      log.info('主窗口已隐藏到系统托盘')
    } else if (currentConfig.close_action === 'quit') {
      app.isQuitting = true
      app.quit()
      log.info('应用已退出')
    } else {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        title: '关闭确认',
        message: '是否隐藏到系统托盘？',
        detail: '选择"隐藏"后，应用将在后台运行。\n选择"退出"将完全关闭应用。',
        buttons: ['隐藏', '退出'],
        defaultId: 0,
        cancelId: 1,
        checkboxLabel: '记住我的选择',
        checkboxChecked: false,
      })

      if (result.response === 0) {
        mainWindow.hide()
        log.info('主窗口已隐藏')
      } else {
        app.isQuitting = true
        app.quit()
      }
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return settingsWindow
  }

  const iconPath = getIconPath()
  
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 650,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    backgroundColor: '#667eea',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: '设置 - SQL Script Generator',
  })

  settingsWindow.setMenu(null)

  if (VITE_DEV_SERVER_URL) {
    settingsWindow.loadURL(VITE_DEV_SERVER_URL + '#/settings')
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/settings' })
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
    log.info('设置窗口已关闭')
  })

  log.info('设置窗口已创建')
  return settingsWindow
}

function getMainWindow() {
  return mainWindow
}

app.on('before-quit', () => {
  app.isQuitting = true
  destroyTray()
})

app.whenReady().then(async () => {
  const shouldHide = process.argv.includes('--hidden')
  log.info('启动模式:', shouldHide ? '隐藏' : '正常')

  const loadedConfig = await loadConfig()
  if (!loadedConfig) {
    log.error('配置加载失败')
    return
  }

  setupIPCHandlers(getMainWindow, checkForUpdates, createAppMenu, createSettingsWindow)

  if (!shouldHide) {
    createSplashWindow(() => {
      createWindow()
      createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
      createTray(mainWindow, checkForUpdates, createSettingsWindow)
      startAutoUpdateCheck(mainWindow)
      log.info('应用启动完成')
    })
  } else {
    createWindow()
    createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
    createTray(mainWindow, checkForUpdates, createSettingsWindow)
    startAutoUpdateCheck(mainWindow)
    log.info('应用启动完成（隐藏模式）')
  }
})

app.on('window-all-closed', () => {})

const appVersion = packageJson.version
let appAuthor = packageJson.author || 'lov3smu'
appAuthor = appAuthor.replace(/<[^>]*>/g, '').trim()

function showAboutDialog(mainWindow) {
  const appName = 'SQL Script Generator'
  const description = 'SQL脚本生成工具，用于快速生成符合规范的SQL脚本文件。'
  const copyright = `© ${new Date().getFullYear()} ${appAuthor}. All rights reserved.`
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '关于软件',
    message: `${appName} ${appVersion}`,
    detail: `${description}\n\n作者：${appAuthor}\n\n${copyright}`,
    buttons: ['确定'],
  })
}

function createAppMenu(mainWindow, checkForUpdatesFn, createSettingsWindowFn) {
  const config = getConfig()
  const shortcuts = config.shortcuts || {
    home: 'CmdOrCtrl+H',
    password: 'CmdOrCtrl+P',
    cron: 'CmdOrCtrl+Shift+C',
    template: 'CmdOrCtrl+T',
    settings: 'CmdOrCtrl+,'
  }

  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '首页',
          accelerator: shortcuts.home || 'CmdOrCtrl+H',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/')
            }
          },
        },
        { type: 'separator' },
        {
          label: '隐藏窗口',
          click: () => { if (mainWindow) mainWindow.hide() },
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            app.isQuitting = true
            destroyTray()
            app.quit()
          },
        },
      ],
    },
    {
      label: '工具',
      submenu: [
        {
          label: '密码生成器',
          accelerator: shortcuts.password || 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/password')
            }
          },
        },
        {
          label: 'Cron表达式生成器',
          accelerator: shortcuts.cron || 'CmdOrCtrl+Shift+C',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/cron')
            }
          },
        },
        {
          label: 'SQL模版生成器',
          accelerator: shortcuts.template || 'CmdOrCtrl+T',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.webContents.send('navigate-to', '/template')
            }
          },
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: shortcuts.settings || 'CmdOrCtrl+,',
          click: () => {
            if (createSettingsWindowFn) {
              createSettingsWindowFn()
            }
          },
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新',
          click: () => checkForUpdatesFn(true, mainWindow),
        },
        { type: 'separator' },
        {
          label: '关于软件',
          click: () => showAboutDialog(mainWindow),
        },
      ],
    },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}