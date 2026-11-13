import { BrowserWindow, ipcMain, dialog, clipboard, shell, nativeTheme } from 'electron'
import path from 'path'
import fs from 'fs'
import { log, getProjectRoot } from '../utils'
import {
  getConfig,
  saveConfig,
  loadConfig,
  generateSQLFile,
  openFile,
  openFolder,
  setAutoStart,
  getAutoStart,
  checkForUpdates,
  downloadUpdate,
  cancelUpdateDownload,
  installUpdate
} from '../services'
import {
  chat,
  chatStream,
  compressChatContext,
  validateApiKey,
  getProviderModels,
  getAiProviderCatalog
} from '../services/chat.js'
import {
  initSkills,
  getSkills,
  getSkill,
  executeSkill,
  installSkill,
  uninstallSkill,
  getSkillToolDefinitions,
  getMarketSkills,
  installMarketSkill,
  getUserSkillsDirectory
} from '../services/skills.js'
import { isPathWithinBase } from '../utils/sanitize'
import {
  getClipboardState,
  copyClipboardEntry,
  removeClipboardEntry,
  toggleClipboardPin,
  clearClipboardHistory,
  setClipboardPaused
} from '../services/clipboard.js'
import { getMainWindow, getSettingsWindow, createSettingsWindow, refreshWindowTheme } from '../windows'
import { createAppMenu, handleMenuAction } from '../ui'
import {
  testConnection,
  createConnection,
  closeConnection,
  closeAllConnections,
  executeQuery,
  queryDatabases,
  queryTables,
  getTableStructure,
  getActiveConnections,
  isConnectionActive,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  executeScript,
  cancelQuery,
  getTableData,
  getTableMeta,
  insertRows,
  applyTableChanges,
  alterTable,
  queryObjects,
  getObjectDefinition,
  queryUsers,
  getErData,
  explainQuery,
  exportTableData
} from '../services/database.js'

import { IPC_CHANNELS, IPC_EVENTS } from '../../shared/ipc'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const packageJson = require(path.join(getProjectRoot(), 'package.json'))

const MAX_IMPORT_SIZE = 50 * 1024 * 1024

function getDialogParentWindow() {
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  const settingsWindow = getSettingsWindow()
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined
}

export function registerIPCHandlers(ipc = ipcMain) {
  const activeChatStreams = new Map()

  const handle = (channel, handler) => {
    ipc.handle(channel, async (event, ...args) => {
      try {
        const data = await handler(event, ...args)
        return { __ipc: true, ok: true, data }
      } catch (error) {
        log.error(`IPC 处理失败 [${channel}]:`, error)
        return { __ipc: true, ok: false, error: error?.message || String(error) }
      }
    })
  }

  handle(IPC_CHANNELS.getConfig, async () => getConfig())

  handle(IPC_CHANNELS.getPackageInfo, async () => ({
    version: packageJson.version,
    author: packageJson.author,
    name: packageJson.name,
    description: packageJson.description
  }))

  handle(IPC_CHANNELS.saveConfig, async (_event, newConfig) => {
    const success = await saveConfig(newConfig)
    if (success) {
      nativeTheme.themeSource = getConfig().theme || 'system'
      refreshWindowTheme()
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC_EVENTS.configChanged)
      }
    }
    return success
  })

  handle(IPC_CHANNELS.generateScript, async (_event, scriptInfo) => await generateSQLFile(scriptInfo))

  handle(IPC_CHANNELS.openFile, async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return false
    const config = getConfig()
    if (config.base_path && !isPathWithinBase(filePath, config.base_path)) {
      log.warn('拒绝打开 base_path 外的文件:', filePath)
      return false
    }
    return await openFile(filePath, config.text_edit_app)
  })

  handle(IPC_CHANNELS.openFolder, async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') return false
    const config = getConfig()
    if (config.base_path && !isPathWithinBase(folderPath, config.base_path)) {
      log.warn('拒绝打开 base_path 外的文件夹:', folderPath)
      return false
    }
    return await openFolder(folderPath)
  })

  handle(IPC_CHANNELS.selectDirectory, async () => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, { properties: ['openDirectory'] })
    return result.filePaths[0] || ''
  })

  handle(IPC_CHANNELS.selectFile, async () => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow

    const platform = process.platform
    const filters = []

    if (platform === 'win32') {
      filters.push({ name: '可执行文件', extensions: ['exe', 'bat', 'cmd'] })
      filters.push({ name: '所有文件', extensions: ['*'] })
    } else if (platform === 'darwin') {
      filters.push({ name: '应用程序', extensions: ['app'] })
      filters.push({ name: '可执行文件', extensions: ['sh', 'command'] })
      filters.push({ name: '所有文件', extensions: ['*'] })
    } else {
      filters.push({ name: '可执行文件', extensions: ['sh', 'bin'] })
      filters.push({ name: '所有文件', extensions: ['*'] })
    }

    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ['openFile'],
      filters
    })
    return result.filePaths[0] || ''
  })

  handle(IPC_CHANNELS.reloadConfig, async () => await loadConfig())

  handle(IPC_CHANNELS.setAutoStart, async (_event, enable) => await setAutoStart(enable))
  handle(IPC_CHANNELS.getAutoStart, async () => await getAutoStart())

  handle(IPC_CHANNELS.checkForUpdates, async (event, manual) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    return await checkForUpdates(manual, senderWindow)
  })

  handle(IPC_CHANNELS.downloadUpdate, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    return await downloadUpdate(senderWindow)
  })

  handle(IPC_CHANNELS.cancelUpdateDownload, async () => cancelUpdateDownload())

  handle(IPC_CHANNELS.installUpdate, async () => installUpdate())

  handle(IPC_CHANNELS.openSettings, async (_event, tab) => {
    createSettingsWindow(tab)
    return true
  })

  handle(IPC_CHANNELS.closeSettingsWindow, async () => {
    const win = getSettingsWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  handle(IPC_CHANNELS.returnToApp, async () => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
    const settings = getSettingsWindow()
    if (settings && !settings.isDestroyed()) {
      settings.close()
    }
    return true
  })

  const getSenderWindow = (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return win && !win.isDestroyed() ? win : null
  }

  handle(IPC_CHANNELS.windowMinimize, async (event) => {
    const win = getSenderWindow(event)
    if (!win) return false
    win.minimize()
    return true
  })

  handle(IPC_CHANNELS.windowToggleMaximize, async (event) => {
    const win = getSenderWindow(event)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    return win.isMaximized()
  })

  handle(IPC_CHANNELS.windowIsMaximized, async (event) => Boolean(getSenderWindow(event)?.isMaximized()))

  handle(IPC_CHANNELS.windowClose, async (event) => {
    const win = getSenderWindow(event)
    if (!win) return false
    win.close()
    return true
  })

  handle(IPC_CHANNELS.openExternal, async (_event, url) => {
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      log.warn('拒绝打开非 HTTP(S) 链接:', url)
      return false
    }
    await shell.openExternal(url)
    return true
  })

  handle(IPC_CHANNELS.reloadMenu, async () => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
      return true
    }
    return false
  })

  handle(IPC_CHANNELS.menuAction, async (event, action) => handleMenuAction(event, action))

  handle(IPC_CHANNELS.readDirectory, async (_event, dirPath, options = {}) => {
    try {
      const config = getConfig()
      const basePath = config.base_path

      if (!dirPath || typeof dirPath !== 'string') {
        return { success: false, error: '路径无效' }
      }

      if (basePath && !isPathWithinBase(dirPath, basePath)) {
        log.warn('拒绝读取 base_path 外的目录:', dirPath)
        return { success: false, error: '无权访问该目录' }
      }

      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const directories = []
      const files = []

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stat = await fs.promises.stat(fullPath)
          const isDirectory = entry.isDirectory()
          const item = {
            name: entry.name,
            path: fullPath,
            created: stat.birthtimeMs || stat.mtimeMs,
            modified: stat.mtimeMs,
            isDirectory,
            size: isDirectory ? null : stat.size
          }

          if (isDirectory) {
            if (options.withDirectorySize) {
              item.size = (await getDirectoryStats(fullPath)).size
            }
            directories.push(item)
          } else {
            files.push(item)
          }
        } catch (e) {
          log.warn('无法读取文件信息:', fullPath, e.message)
        }
      }

      return { success: true, directories, files }
    } catch (e) {
      log.error('读取目录失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.searchDirectory, async (_event, rootPath, keyword, options = {}) => {
    try {
      const config = getConfig()
      const basePath = config.base_path

      if (!rootPath || typeof rootPath !== 'string') {
        return { success: false, error: '路径无效' }
      }

      if (basePath && !isPathWithinBase(rootPath, basePath)) {
        log.warn('拒绝搜索 base_path 外的目录:', rootPath)
        return { success: false, error: '无权访问该目录' }
      }

      const term = typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''
      if (!term) {
        return { success: true, items: [], truncated: false }
      }

      const limit = 500
      const maxDepth = 12
      const maxVisited = 20000
      const items = []
      let visited = 0
      let truncated = false

      const walk = async (dirPath, depth) => {
        let entries
        try {
          entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
        } catch (e) {
          log.warn('搜索时无法读取目录:', dirPath, e.message)
          return
        }

        for (const entry of entries) {
          if (items.length >= limit || visited >= maxVisited) {
            truncated = true
            return
          }
          visited++

          const fullPath = path.join(dirPath, entry.name)
          const isDirectory = entry.isDirectory()

          if (entry.name.toLowerCase().includes(term)) {
            try {
              const stat = await fs.promises.stat(fullPath)
              const item = {
                name: entry.name,
                path: fullPath,
                relativePath: path.relative(rootPath, fullPath),
                created: stat.birthtimeMs || stat.mtimeMs,
                modified: stat.mtimeMs,
                isDirectory,
                size: isDirectory ? null : stat.size
              }
              if (isDirectory && options.withDirectorySize) {
                item.size = (await getDirectoryStats(fullPath)).size
              }
              items.push(item)
            } catch (e) {
              log.warn('搜索时无法读取文件信息:', fullPath, e.message)
            }
          }

          if (isDirectory && depth < maxDepth) {
            await walk(fullPath, depth + 1)
          }
        }
      }

      await walk(rootPath, 0)

      return { success: true, items, truncated }
    } catch (e) {
      log.error('搜索目录失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.copyToClipboard, async (_event, itemPath, recursive = false) => {
    try {
      const config = getConfig()
      const basePath = config.base_path

      if (!itemPath || typeof itemPath !== 'string') {
        return false
      }

      if (basePath && !isPathWithinBase(itemPath, basePath)) {
        log.warn('拒绝访问 base_path 外的路径:', itemPath)
        return false
      }

      let filePaths = []

      const stat = await fs.promises.stat(itemPath)

      if (stat.isDirectory()) {
        filePaths = await collectFiles(itemPath, recursive)
      } else {
        filePaths = [itemPath]
      }

      const text = filePaths.join('\n')
      clipboard.writeText(text)
      return true
    } catch (e) {
      log.error('复制失败:', e)
      return false
    }
  })

  handle(IPC_CHANNELS.copyRichText, async (_event, html, text) => {
    try {
      if (typeof html !== 'string' || !html.trim()) return false
      if (html.length > 8 * 1024 * 1024) return false
      const plain = typeof text === 'string' ? text : ''
      clipboard.write({ html, text: plain })
      return true
    } catch (e) {
      log.error('复制富文本失败:', e)
      return false
    }
  })

  handle(IPC_CHANNELS.clipboardHistory, async () => getClipboardState())

  handle(IPC_CHANNELS.clipboardCopy, async (_event, id) => {
    if (typeof id !== 'string') return false
    return copyClipboardEntry(id)
  })

  handle(IPC_CHANNELS.clipboardRemove, async (_event, id) => {
    if (typeof id !== 'string') return false
    return removeClipboardEntry(id)
  })

  handle(IPC_CHANNELS.clipboardTogglePin, async (_event, id) => {
    if (typeof id !== 'string') return false
    return toggleClipboardPin(id)
  })

  handle(IPC_CHANNELS.clipboardClear, async () => clearClipboardHistory())

  handle(IPC_CHANNELS.clipboardSetPaused, async (_event, value) => setClipboardPaused(value === true))

  handle(IPC_CHANNELS.getItemInfo, async (_event, itemPath) => {
    try {
      const config = getConfig()
      const basePath = config.base_path

      if (!itemPath || typeof itemPath !== 'string') {
        return { success: false, error: '路径无效' }
      }

      if (basePath && !isPathWithinBase(itemPath, basePath)) {
        log.warn('拒绝访问 base_path 外的路径:', itemPath)
        return { success: false, error: '无权访问' }
      }

      const stat = await fs.promises.stat(itemPath)
      const isDirectory = stat.isDirectory()

      const info = {
        name: path.basename(itemPath),
        type: isDirectory ? '文件夹' : '文件',
        location: itemPath,
        created: stat.birthtimeMs || stat.ctimeMs,
        modified: stat.mtimeMs,
        accessed: stat.atimeMs
      }

      if (isDirectory) {
        const stats = await getDirectoryStats(itemPath)
        info.size = stats.size
        info.sizeOnDisk = stats.size
        info.directoryCount = stats.directoryCount
        info.fileCount = stats.fileCount
      } else {
        info.size = stat.size
        info.sizeOnDisk = stat.size
      }

      return { success: true, info }
    } catch (e) {
      log.error('获取信息失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.chat, async (event, messages, options) => {
    return await chat(messages, options)
  })

  handle(IPC_CHANNELS.chatStream, async (event, messages, options = {}) => {
    const requestId = options.requestId || `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const controller = { cancelled: false }
    activeChatStreams.set(requestId, controller)

    const sendChunk = (payload) => {
      if (event.sender.isDestroyed()) return
      const eventPayload = typeof payload === 'string' ? { kind: 'content', text: payload } : payload
      event.sender.send(IPC_EVENTS.chatStreamChunk, { requestId, ...eventPayload })
    }

    try {
      const result = await chatStream(
        messages,
        { ...options, requestId, shouldStop: () => controller.cancelled },
        sendChunk
      )

      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_EVENTS.chatStreamEnd, { requestId, ...result })
      }
      return result
    } finally {
      activeChatStreams.delete(requestId)
    }
  })

  handle(IPC_CHANNELS.cancelChatStream, async (_event, requestId) => {
    const controller = activeChatStreams.get(requestId)
    if (!controller) return false
    controller.cancelled = true
    return true
  })

  handle(IPC_CHANNELS.isChatStreamActive, async (_event, requestId) => {
    return activeChatStreams.has(requestId)
  })

  handle(IPC_CHANNELS.compressChatContext, async (_event, messages, options) => {
    return await compressChatContext(messages, options)
  })

  handle(IPC_CHANNELS.validateApiKey, async (_event, providerType, apiKey, extraConfig) => {
    return await validateApiKey(providerType, apiKey, extraConfig)
  })

  handle(IPC_CHANNELS.getAiProviders, async () => {
    return getAiProviderCatalog()
  })

  handle(IPC_CHANNELS.getProviderModels, async (_event, providerType, options) => {
    return getProviderModels(providerType, options)
  })

  // Database connection handlers
  handle(IPC_CHANNELS.dbTestConnection, async (_event, config) => {
    return await testConnection(config)
  })

  handle(IPC_CHANNELS.dbCreateConnection, async (_event, name, config) => {
    return await createConnection(name, config)
  })

  handle(IPC_CHANNELS.dbCloseConnection, async (_event, name) => {
    return await closeConnection(name)
  })

  handle(IPC_CHANNELS.dbCloseAllConnections, async () => {
    return await closeAllConnections()
  })

  handle(IPC_CHANNELS.dbExecuteQuery, async (_event, name, sql, params, options) => {
    return await executeQuery(name, sql, params, options)
  })

  handle(IPC_CHANNELS.dbQueryDatabases, async (_event, name) => {
    return await queryDatabases(name)
  })

  handle(IPC_CHANNELS.dbQueryTables, async (_event, name, database) => {
    return await queryTables(name, database)
  })

  handle(IPC_CHANNELS.dbGetTableStructure, async (_event, name, database, tableName) => {
    return await getTableStructure(name, database, tableName)
  })

  handle(IPC_CHANNELS.dbGetActiveConnections, async () => {
    return getActiveConnections()
  })

  handle(IPC_CHANNELS.dbIsConnectionActive, async (_event, name) => {
    return isConnectionActive(name)
  })

  handle(IPC_CHANNELS.dbBeginTransaction, async (_event, name, database) => {
    return await beginTransaction(name, database)
  })

  handle(IPC_CHANNELS.dbCommitTransaction, async (_event, name) => {
    return await commitTransaction(name)
  })

  handle(IPC_CHANNELS.dbRollbackTransaction, async (_event, name) => {
    return await rollbackTransaction(name)
  })

  handle(IPC_CHANNELS.dbExecuteScript, async (_event, name, sql, options) => {
    return await executeScript(name, sql, options)
  })

  handle(IPC_CHANNELS.dbCancelQuery, async (_event, name, requestId) => {
    return await cancelQuery(name, requestId)
  })

  handle(IPC_CHANNELS.dbGetTableData, async (_event, name, database, tableName, options) => {
    return await getTableData(name, database, tableName, options)
  })

  handle(IPC_CHANNELS.dbGetTableMeta, async (_event, name, database, tableName) => {
    return await getTableMeta(name, database, tableName)
  })

  handle(IPC_CHANNELS.dbInsertRows, async (_event, name, database, tableName, rows) => {
    return await insertRows(name, database, tableName, rows)
  })

  handle(IPC_CHANNELS.dbApplyTableChanges, async (_event, name, database, tableName, changes) => {
    return await applyTableChanges(name, database, tableName, changes)
  })

  handle(IPC_CHANNELS.dbAlterTable, async (_event, name, database, tableName, operations) => {
    return await alterTable(name, database, tableName, operations)
  })

  handle(IPC_CHANNELS.dbQueryObjects, async (_event, name, database, keyword) => {
    return await queryObjects(name, database, keyword)
  })

  handle(IPC_CHANNELS.dbGetObjectDefinition, async (_event, name, database, type, objectName) => {
    return await getObjectDefinition(name, database, type, objectName)
  })

  handle(IPC_CHANNELS.dbQueryUsers, async (_event, name) => {
    return await queryUsers(name)
  })

  handle(IPC_CHANNELS.dbGetErData, async (_event, name, database) => {
    return await getErData(name, database)
  })

  handle(IPC_CHANNELS.dbExplainQuery, async (_event, name, database, sql) => {
    return await explainQuery(name, database, sql)
  })

  handle(IPC_CHANNELS.dbExportTable, async (_event, name, database, tableName, options) => {
    return await exportTableData(name, database, tableName, options)
  })

  handle(IPC_CHANNELS.dbSelectImportFile, async (_event, format) => {
    const parentWindow = getDialogParentWindow()
    const filters =
      format === 'json' ? [{ name: 'JSON 文件', extensions: ['json'] }] : [{ name: 'CSV 文件', extensions: ['csv'] }]
    filters.push({ name: '所有文件', extensions: ['*'] })

    const result = await dialog.showOpenDialog(parentWindow, {
      title: '选择导入文件',
      filters,
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const filePath = result.filePaths[0]
    const stat = await fs.promises.stat(filePath)
    if (stat.size > MAX_IMPORT_SIZE) {
      return { canceled: false, error: '文件超过 50MB，请拆分后再导入' }
    }

    const content = await fs.promises.readFile(filePath, 'utf-8')
    return { canceled: false, filePath, content, size: stat.size }
  })

  handle(IPC_CHANNELS.dbSaveExportFile, async (_event, defaultName, content, format) => {
    const parentWindow = getDialogParentWindow()
    const extensionMap = { csv: 'csv', json: 'json', sql: 'sql', markdown: 'md', md: 'md' }
    const extension = extensionMap[format] || 'txt'
    const filters = [
      { name: `${extension.toUpperCase()} 文件`, extensions: [extension] },
      { name: '所有文件', extensions: ['*'] }
    ]

    const result = await dialog.showSaveDialog(parentWindow, {
      title: '导出数据',
      defaultPath: defaultName || `export.${extension}`,
      filters
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await fs.promises.writeFile(result.filePath, String(content ?? ''), 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  handle(IPC_CHANNELS.dbSelectConnectionFile, async () => {
    const parentWindow = getDialogParentWindow()
    const result = await dialog.showOpenDialog(parentWindow, {
      title: '导入连接配置',
      filters: [
        { name: 'JSON 文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }

    const content = await fs.promises.readFile(result.filePaths[0], 'utf-8')
    return { canceled: false, filePath: result.filePaths[0], content }
  })

  handle(IPC_CHANNELS.dbSaveConnectionFile, async (_event, defaultName, content) => {
    const parentWindow = getDialogParentWindow()
    const result = await dialog.showSaveDialog(parentWindow, {
      title: '导出连接配置',
      defaultPath: defaultName || 'connections.json',
      filters: [
        { name: 'JSON 文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    await fs.promises.writeFile(result.filePath, String(content ?? ''), 'utf-8')
    return { canceled: false, filePath: result.filePath }
  })

  handle(IPC_CHANNELS.selectSqlFile, async () => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, {
      title: '选择SQL文件',
      filters: [{ name: 'SQL文件', extensions: ['sql'] }],
      properties: ['openFile']
    })
    return result
  })

  handle(IPC_CHANNELS.readFile, async (_event, filePath) => {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (e) {
      log.error('读取文件失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.saveSqlFile, async (_event, defaultPath) => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showSaveDialog(parentWindow, {
      title: '保存SQL转储文件',
      defaultPath: defaultPath || 'dump.sql',
      filters: [{ name: 'SQL文件', extensions: ['sql'] }]
    })
    return result
  })

  handle(IPC_CHANNELS.writeFile, async (_event, filePath, content) => {
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (e) {
      log.error('写入文件失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.skillsInit, async () => {
    await initSkills()
    return { success: true }
  })

  handle(IPC_CHANNELS.skillsList, async () => {
    await initSkills()
    return getSkills()
  })

  handle(IPC_CHANNELS.skillsGet, async (_event, name) => {
    await initSkills()
    return getSkill(name)
  })

  handle(IPC_CHANNELS.skillsExecute, async (_event, name, params) => {
    return await executeSkill(name, params)
  })

  handle(IPC_CHANNELS.skillsInstall, async (_event, skillPath) => {
    await initSkills()
    return await installSkill(skillPath)
  })

  handle(IPC_CHANNELS.skillsUninstall, async (_event, name) => {
    await initSkills()
    return await uninstallSkill(name)
  })

  handle(IPC_CHANNELS.skillsGetToolDefinitions, async () => {
    return getSkillToolDefinitions()
  })

  handle(IPC_CHANNELS.extensionsMarket, async (_event, options = {}) => {
    await initSkills()
    return await getMarketSkills({ refresh: options?.refresh === true })
  })

  handle(IPC_CHANNELS.extensionsInstall, async (_event, name) => {
    await initSkills()
    return await installMarketSkill(name)
  })

  handle(IPC_CHANNELS.extensionsInstallFromFolder, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: '选择技能扩展目录',
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, canceled: true }
    }

    await initSkills()
    return await installSkill(result.filePaths[0])
  })

  handle(IPC_CHANNELS.extensionsDirectory, async () => {
    return getUserSkillsDirectory()
  })

  handle(IPC_CHANNELS.extensionsOpenDirectory, async () => {
    try {
      const directory = getUserSkillsDirectory()
      await fs.promises.mkdir(directory, { recursive: true })
      const error = await shell.openPath(directory)
      return error ? { success: false, error } : { success: true }
    } catch (error) {
      log.error('打开扩展目录失败:', error)
      return { success: false, error: error.message }
    }
  })
}

export function setupIPCHandlers() {
  registerIPCHandlers(ipcMain)
}

async function collectFiles(dirPath, recursive) {
  const files = []
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory() && recursive) {
      const subFiles = await collectFiles(fullPath, recursive)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }

  return files
}

async function getDirectoryStats(dirPath) {
  let size = 0
  let directoryCount = 0
  let fileCount = 0

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      try {
        if (entry.isDirectory()) {
          directoryCount++
          const subStats = await getDirectoryStats(fullPath)
          size += subStats.size
          directoryCount += subStats.directoryCount
          fileCount += subStats.fileCount
        } else {
          fileCount++
          const fileStat = await fs.promises.stat(fullPath)
          size += fileStat.size
        }
      } catch (e) {
        log.warn('无法读取:', fullPath, e.message)
      }
    }
  } catch (e) {
    log.warn('无法读取目录:', dirPath, e.message)
  }

  return { size, directoryCount, fileCount }
}
