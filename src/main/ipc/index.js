import { BrowserWindow, ipcMain, dialog, clipboard, shell, nativeTheme, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { log, getProjectRoot } from '../utils'
import { t } from '../services/i18n.js'
import {
  getConfig,
  getPublicConfig,
  saveConfig,
  patchConfig,
  loadConfig,
  generateSQLFile,
  openFile,
  openFolder,
  setAutoStart,
  getAutoStart,
  checkForUpdates,
  startAutoUpdateCheck,
  getUpdateReleases,
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
import { getWorkspaceInfo, openWorkspaceItem } from '../services/workspace.js'
import {
  KNOWLEDGE_FILE_EXTENSIONS,
  getMemoryOverview,
  addMemory,
  updateMemory,
  removeMemory,
  clearMemory,
  addKnowledgeSource,
  removeKnowledgeSource,
  setKnowledgeSourceEnabled,
  searchKnowledge
} from '../services/memory.js'
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
  getUserSkillsDirectory,
  exportSkillBundle,
  importSkillBundle
} from '../services/skills.js'
import { installPluginSource, installPluginBundleSource } from '../services/pluginInstaller.js'
import { getInstalledPlugins, getPluginDirectory, installPluginBundle, uninstallPlugin } from '../services/plugins.js'
import { getBackupTasks, saveBackupTask, deleteBackupTask, runBackupTaskNow } from '../services/backupScheduler.js'
import { queryDbOperationLog, clearDbOperationLog } from '../services/dbAuditLog.js'
import { getMcpStatus, reloadMcpFromConfig, testMcpServer } from '../services/mcp.js'
import { applyNetworkConfig, testNetwork } from '../services/network.js'
import { getMcpRegistryBase } from '../../shared/network.js'
import { fetchMcpRegistryServers } from '../services/mcpRegistry.js'
import { createSnapshotStore, restoreSnapshot } from '../services/snapshots.js'
import { createToolResultStore } from '../services/toolResults.js'
import {
  countRunTracesByWorkspace,
  createRunTrace,
  listRunTraces,
  readRunTrace,
  writeRunTraceFile
} from '../services/runTrace.js'
import { isPathWithinBase } from '../utils/sanitize'
import { grantFilePath, isFilePathGranted } from '../utils/fileAccess'
import { maskImageHostSettings } from '../../shared/secrets.js'
import {
  getClipboardState,
  copyClipboardEntry,
  removeClipboardEntry,
  toggleClipboardPin,
  clearClipboardHistory,
  setClipboardPaused
} from '../services/clipboard.js'
import { getMainWindow, getSettingsWindow, createSettingsWindow, refreshWindowTheme } from '../windows'
import { createAppMenu, createTray, handleMenuAction } from '../ui'
import { syncLocaleFromConfig } from '../services/i18n.js'
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
  getTableCellValue,
  getTableMeta,
  insertRows,
  applyTableChanges,
  alterTable,
  previewAlterTable,
  createTable,
  compareSchemas,
  queryObjects,
  getObjectDefinition,
  queryUsers,
  getSessionInfo,
  killSession,
  getErData,
  explainQuery,
  queryServerStatus,
  querySlowQueries,
  queryDatabaseHealth,
  getUserGrants,
  createDatabaseUser,
  dropDatabaseUser,
  setDatabaseUserPassword,
  setDatabaseUserPrivileges,
  exportTableData
} from '../services/database.js'
import {
  clearImageHostHistory,
  getImageHostState,
  removeImageHostHistory,
  saveImageHostSettings,
  testImageHostProvider,
  uploadImageBuffer,
  uploadImagePaths
} from '../services/imageHost/index.js'
import { buildClipboardFileName } from '../services/imageHost/utils.js'
import {
  getPasswordVaultState,
  setPasswordVaultMasterPassword,
  unlockPasswordVault,
  lockPasswordVault,
  savePasswordGroup,
  deletePasswordGroup,
  savePasswordEntry,
  deletePasswordEntry,
  revealPasswordEntry
} from '../services/passwordVault.js'
import { IMAGE_HOST_EXTENSIONS } from '../../shared/imageHosts.js'
import {
  normalizeAiToolResultMaxKb,
  normalizeAiToolResultRetentionDays,
  normalizeAiToolResultRunKb
} from '../../shared/aiBehavior.js'

import { IPC_CHANNELS, IPC_EVENTS } from '../../shared/ipc'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const packageJson = require(path.join(getProjectRoot(), 'package.json'))

const MAX_IMPORT_SIZE = 50 * 1024 * 1024
const MAX_IMAGE_FILE_SIZE = 100 * 1024 * 1024
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']
const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif'
}

function getImageMime(filePath) {
  if (typeof filePath !== 'string') return ''
  return IMAGE_MIME[path.extname(filePath).toLowerCase().slice(1)] || ''
}

function getDialogParentWindow() {
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  const settingsWindow = getSettingsWindow()
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : undefined
}

export function registerIPCHandlers(ipc = ipcMain) {
  const activeChatStreams = new Map()
  const pendingApprovals = new Map()

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

  handle(IPC_CHANNELS.getConfig, async () => getPublicConfig())

  handle(IPC_CHANNELS.getPackageInfo, async () => ({
    version: packageJson.version,
    author: packageJson.author,
    name: packageJson.name,
    description: packageJson.description
  }))

  function notifyConfigSaved(previousMcp) {
    const config = getConfig()
    const localeChanged = syncLocaleFromConfig(config)
    nativeTheme.themeSource = config.appearance.theme || 'system'
    refreshWindowTheme()
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_EVENTS.configChanged)
    }
    if (localeChanged && mainWindow && !mainWindow.isDestroyed()) {
      createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
      createTray(mainWindow, checkForUpdates, createSettingsWindow)
    }
    startAutoUpdateCheck(mainWindow)
    if (JSON.stringify(getConfig().extensions?.mcp_servers || []) !== previousMcp) {
      reloadMcpFromConfig().catch((error) => log.warn('重载 MCP 服务失败:', error.message))
    }
    applyNetworkConfig(getConfig()).catch((error) => log.warn('应用网络配置失败:', error.message))
  }

  handle(IPC_CHANNELS.saveConfig, async (_event, newConfig) => {
    const previousMcp = JSON.stringify(getConfig().extensions?.mcp_servers || [])
    const success = await saveConfig(newConfig)
    if (success) notifyConfigSaved(previousMcp)
    return success
  })

  handle(IPC_CHANNELS.patchConfig, async (_event, partial) => {
    const previousMcp = JSON.stringify(getConfig().extensions?.mcp_servers || [])
    const success = await patchConfig(partial)
    if (success) notifyConfigSaved(previousMcp)
    return success
  })

  handle(IPC_CHANNELS.generateScript, async (_event, scriptInfo) => await generateSQLFile(scriptInfo))

  handle(IPC_CHANNELS.openFile, async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return false
    const config = getConfig()
    if (config.app.base_path && !isPathWithinBase(filePath, config.app.base_path)) {
      log.warn('拒绝打开 base_path 外的文件:', filePath)
      return false
    }
    return await openFile(filePath, config.app.text_edit_app)
  })

  handle(IPC_CHANNELS.openFolder, async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') return false
    const config = getConfig()
    if (config.app.base_path && !isPathWithinBase(folderPath, config.app.base_path)) {
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
      filters.push({ name: t('可执行文件'), extensions: ['exe', 'bat', 'cmd'] })
      filters.push({ name: t('所有文件'), extensions: ['*'] })
    } else if (platform === 'darwin') {
      filters.push({ name: t('应用程序'), extensions: ['app'] })
      filters.push({ name: t('可执行文件'), extensions: ['sh', 'command'] })
      filters.push({ name: t('所有文件'), extensions: ['*'] })
    } else {
      filters.push({ name: t('可执行文件'), extensions: ['sh', 'bin'] })
      filters.push({ name: t('所有文件'), extensions: ['*'] })
    }

    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ['openFile'],
      filters
    })
    return result.filePaths[0] || ''
  })

  handle(IPC_CHANNELS.memorySelectFiles, async () => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: t('文本与文档'), extensions: KNOWLEDGE_FILE_EXTENSIONS },
        { name: t('所有文件'), extensions: ['*'] }
      ]
    })
    return { canceled: result.canceled, paths: result.filePaths || [] }
  })

  handle(IPC_CHANNELS.reloadConfig, async () => await loadConfig())

  handle(IPC_CHANNELS.setAutoStart, async (_event, enable) => await setAutoStart(enable))
  handle(IPC_CHANNELS.getAutoStart, async () => await getAutoStart())

  handle(IPC_CHANNELS.checkForUpdates, async (event, manual) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    return await checkForUpdates(manual, senderWindow)
  })

  handle(IPC_CHANNELS.getUpdateReleases, async () => await getUpdateReleases())

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

  handle(IPC_CHANNELS.returnToApp, async (event) => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const hasSettingsWindow = Boolean(settingsWindow && !settingsWindow.isDestroyed())
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
    if (hasSettingsWindow) {
      settingsWindow.close()
    } else if (mainWindow && !mainWindow.isDestroyed() && event?.sender && mainWindow.webContents === event.sender) {
      mainWindow.webContents.send(IPC_EVENTS.navigateTo, '/')
    }
    return true
  })

  handle(IPC_CHANNELS.navigateMainWindow, async (_event, target = {}) => {
    const mainWindow = getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return false

    const targetPath = typeof target?.path === 'string' ? target.path.trim() : ''
    if (!targetPath.startsWith('/') || targetPath.startsWith('//')) return false

    if (mainWindow.isMinimized()) mainWindow.restore()
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()

    const payload = { path: targetPath }
    if (typeof target.prompt === 'string' && target.prompt.trim()) payload.prompt = target.prompt
    mainWindow.webContents.send(IPC_EVENTS.navigateTo, payload)
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

  handle(IPC_CHANNELS.windowIsFullscreen, async (event) => Boolean(getSenderWindow(event)?.isFullScreen()))

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
      const basePath = config.app.base_path

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
      const basePath = config.app.base_path

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
      const basePath = config.app.base_path

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
      const basePath = config.app.base_path

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

    const snapshots = createSnapshotStore(requestId)
    const budgetConfig = getConfig()
    const toolResults = createToolResultStore(requestId, {
      maxResultChars: normalizeAiToolResultMaxKb(budgetConfig.ai.tool_result.max_kb) * 1024,
      maxRunChars: normalizeAiToolResultRunKb(budgetConfig.ai.tool_result.run_kb) * 1024,
      retentionMs: normalizeAiToolResultRetentionDays(budgetConfig.ai.tool_result.retention_days) * 24 * 60 * 60 * 1000
    })
    const trace = createRunTrace(requestId, {
      provider: options.provider,
      model: options.model,
      workspacePath: options.workspacePath,
      conversationId: options.conversationId,
      approvalPolicy: options.approvalPolicy,
      toolsEnabled: options.toolsEnabled !== false
    })
    const allowedTools = new Set(Array.isArray(options.allowedTools) ? options.allowedTools.filter(Boolean) : [])
    const approvalsForRequest = new Set()

    const requestApproval = (request) => {
      if (event.sender.isDestroyed()) {
        return Promise.resolve({ approved: false, reason: 'cancelled' })
      }
      if (controller.cancelled) return Promise.resolve({ approved: false, reason: 'cancelled' })

      const approvalId = `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      return new Promise((resolve) => {
        const settle = (decision) => {
          if (!pendingApprovals.has(approvalId)) return
          pendingApprovals.delete(approvalId)
          approvalsForRequest.delete(approvalId)
          clearTimeout(timer)
          if (decision?.always && request?.key) allowedTools.add(request.key)
          resolve(decision)
        }

        const timer = setTimeout(() => {
          settle({ approved: false, reason: 'timeout' })
        }, 120000)
        if (typeof timer.unref === 'function') timer.unref()

        pendingApprovals.set(approvalId, settle)
        approvalsForRequest.add(approvalId)

        try {
          event.sender.send(IPC_EVENTS.chatApprovalRequest, {
            requestId,
            approvalId,
            tool: request?.tool,
            risk: request?.risk,
            key: request?.key,
            summary: request?.summary,
            arguments: request?.arguments,
            preview: request?.preview ?? null
          })
        } catch {
          settle({ approved: false, reason: 'cancelled' })
        }
      })
    }

    try {
      const result = await chatStream(
        messages,
        {
          ...options,
          requestId,
          shouldStop: () => controller.cancelled,
          snapshots,
          toolResults,
          trace,
          requestApproval,
          isToolAllowed: (key) => allowedTools.has(key)
        },
        sendChunk
      )

      await trace.finish({
        status: result?.termination || (result?.success ? 'goal_reached' : 'error'),
        termination: result?.termination || null,
        summary: result?.summary || null,
        usage: result?.usage || null,
        error: result?.error || null,
        content: result?.content || ''
      })

      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_EVENTS.chatStreamEnd, { requestId, ...result })
      }
      return result
    } finally {
      await trace.finish({ status: 'error', error: '执行中断' })
      for (const approvalId of approvalsForRequest) {
        const settle = pendingApprovals.get(approvalId)
        if (settle) settle({ approved: false, reason: 'cancelled' })
      }
      activeChatStreams.delete(requestId)
    }
  })

  handle(IPC_CHANNELS.respondChatApproval, async (_event, approvalId, decision) => {
    const settle = pendingApprovals.get(approvalId)
    if (!settle) return false
    const action = decision?.decision || (decision?.approved ? 'allow_once' : 'deny')
    if (action === 'deny') {
      settle({ approved: false, reason: decision?.reason || 'denied' })
      return true
    }
    settle({ approved: true, always: action === 'allow_always' })
    return true
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

  handle(IPC_CHANNELS.rollbackChatRun, async (_event, requestId) => {
    if (!requestId || typeof requestId !== 'string') {
      return { success: false, error: '缺少运行标识' }
    }
    return await restoreSnapshot(requestId)
  })

  handle(IPC_CHANNELS.listRunTraces, async (_event, limit, conversationId) => {
    return await listRunTraces(limit, conversationId)
  })

  handle(IPC_CHANNELS.runTraceStats, async () => {
    return await countRunTracesByWorkspace()
  })

  handle(IPC_CHANNELS.readRunTrace, async (_event, runId) => {
    if (!runId || typeof runId !== 'string') {
      return { success: false, error: '缺少运行标识' }
    }
    return await readRunTrace(runId)
  })

  handle(IPC_CHANNELS.exportRunTrace, async (_event, runId) => {
    if (!runId || typeof runId !== 'string') {
      return { canceled: false, success: false, error: t('缺少运行标识') }
    }
    const trace = await readRunTrace(runId)
    if (!trace.success) {
      return { canceled: false, success: false, error: trace.error }
    }
    const result = await dialog.showSaveDialog(getDialogParentWindow(), {
      title: t('导出运行轨迹'),
      defaultPath: `agent-run-${runId}.json`,
      filters: [
        { name: t('JSON 文件'), extensions: ['json'] },
        { name: t('所有文件'), extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }
    const written = await writeRunTraceFile(runId, result.filePath)
    return { canceled: false, ...written, filePath: result.filePath }
  })

  handle(IPC_CHANNELS.compressChatContext, async (_event, messages, options) => {
    return await compressChatContext(messages, options)
  })

  handle(IPC_CHANNELS.workspaceInfo, async (_event, workspacePath) => {
    return await getWorkspaceInfo(workspacePath)
  })

  handle(IPC_CHANNELS.workspaceOpen, async (_event, workspacePath, targetPath) => {
    return await openWorkspaceItem(workspacePath, targetPath)
  })

  handle(IPC_CHANNELS.memoryOverview, async (_event, workspacePath) => {
    return await getMemoryOverview(workspacePath)
  })

  handle(IPC_CHANNELS.memoryAdd, async (_event, input) => {
    return await addMemory(input)
  })

  handle(IPC_CHANNELS.memoryUpdate, async (_event, input) => {
    return await updateMemory(input)
  })

  handle(IPC_CHANNELS.memoryRemove, async (_event, input) => {
    return await removeMemory(input)
  })

  handle(IPC_CHANNELS.memoryClear, async (_event, input) => {
    return await clearMemory(input)
  })

  handle(IPC_CHANNELS.memoryKnowledgeAdd, async (_event, input) => {
    return await addKnowledgeSource(input)
  })

  handle(IPC_CHANNELS.memoryKnowledgeRemove, async (_event, id) => {
    return await removeKnowledgeSource(id)
  })

  handle(IPC_CHANNELS.memoryKnowledgeToggle, async (_event, id, enabled) => {
    return await setKnowledgeSourceEnabled(id, enabled)
  })

  handle(IPC_CHANNELS.memoryKnowledgeSearch, async (_event, input) => {
    return await searchKnowledge(input)
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

  handle(IPC_CHANNELS.dbGetTableCellValue, async (_event, name, database, tableName, columnName, keys, options) => {
    return await getTableCellValue(name, database, tableName, columnName, keys, options)
  })

  handle(IPC_CHANNELS.dbGetTableMeta, async (_event, name, database, tableName) => {
    return await getTableMeta(name, database, tableName)
  })

  handle(IPC_CHANNELS.dbInsertRows, async (_event, name, database, tableName, rows, options) => {
    return await insertRows(name, database, tableName, rows, options)
  })

  handle(IPC_CHANNELS.dbApplyTableChanges, async (_event, name, database, tableName, changes) => {
    return await applyTableChanges(name, database, tableName, changes)
  })

  handle(IPC_CHANNELS.dbAlterTable, async (_event, name, database, tableName, operations) => {
    return await alterTable(name, database, tableName, operations)
  })

  handle(IPC_CHANNELS.dbPreviewAlterTable, async (_event, name, database, tableName, operations) => {
    return await previewAlterTable(name, database, tableName, operations)
  })

  handle(IPC_CHANNELS.dbCreateTable, async (_event, name, database, tableName, options) => {
    return await createTable(name, database, tableName, options)
  })

  handle(IPC_CHANNELS.dbCompareSchemas, async (_event, name, baseDatabase, targetName, targetDatabase) => {
    return await compareSchemas(name, baseDatabase, targetName, targetDatabase)
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

  handle(IPC_CHANNELS.dbGetSessionInfo, async (_event, name) => {
    return await getSessionInfo(name)
  })

  handle(IPC_CHANNELS.dbKillSession, async (_event, name, threadId, mode) => {
    return await killSession(name, threadId, mode)
  })

  handle(IPC_CHANNELS.dbGetErData, async (_event, name, database) => {
    return await getErData(name, database)
  })

  handle(IPC_CHANNELS.dbExplainQuery, async (_event, name, database, sql) => {
    return await explainQuery(name, database, sql)
  })

  handle(IPC_CHANNELS.dbQueryServerStatus, async (_event, name) => {
    return await queryServerStatus(name)
  })

  handle(IPC_CHANNELS.dbQuerySlowQueries, async (_event, name, database, limit) => {
    return await querySlowQueries(name, database, limit)
  })

  handle(IPC_CHANNELS.dbQueryDatabaseHealth, async (_event, name, database) => {
    return await queryDatabaseHealth(name, database)
  })

  handle(IPC_CHANNELS.dbGetUserGrants, async (_event, name, user, host) => {
    return await getUserGrants(name, user, host)
  })

  handle(IPC_CHANNELS.dbCreateUser, async (_event, name, user, host, password) => {
    return await createDatabaseUser(name, user, host, password)
  })

  handle(IPC_CHANNELS.dbDropUser, async (_event, name, user, host) => {
    return await dropDatabaseUser(name, user, host)
  })

  handle(IPC_CHANNELS.dbSetUserPassword, async (_event, name, user, host, password) => {
    return await setDatabaseUserPassword(name, user, host, password)
  })

  handle(IPC_CHANNELS.dbSetUserPrivileges, async (_event, name, action, user, host, privileges, database, table) => {
    return await setDatabaseUserPrivileges(name, action, user, host, privileges, database, table)
  })

  handle(IPC_CHANNELS.dbExportTable, async (_event, name, database, tableName, options) => {
    return await exportTableData(name, database, tableName, options)
  })

  handle(IPC_CHANNELS.dbGetBackupTasks, async () => {
    return getBackupTasks()
  })

  handle(IPC_CHANNELS.dbSaveBackupTask, async (_event, task) => {
    return await saveBackupTask(task)
  })

  handle(IPC_CHANNELS.dbDeleteBackupTask, async (_event, id) => {
    return await deleteBackupTask(id)
  })

  handle(IPC_CHANNELS.dbRunBackupTask, async (_event, id) => {
    return await runBackupTaskNow(id)
  })

  handle(IPC_CHANNELS.dbSelectBackupDirectory, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('选择备份目录'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true }
    }
    return { canceled: false, directory: result.filePaths[0] }
  })

  handle(IPC_CHANNELS.dbQueryOperationLog, async (_event, options) => {
    return await queryDbOperationLog(options)
  })

  handle(IPC_CHANNELS.dbClearOperationLog, async () => {
    return await clearDbOperationLog()
  })

  handle(IPC_CHANNELS.dbSelectImportFile, async (_event, format) => {
    const parentWindow = getDialogParentWindow()
    const filters =
      format === 'json'
        ? [{ name: t('JSON 文件'), extensions: ['json'] }]
        : [{ name: t('CSV 文件'), extensions: ['csv'] }]
    filters.push({ name: t('所有文件'), extensions: ['*'] })

    const result = await dialog.showOpenDialog(parentWindow, {
      title: t('选择导入文件'),
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
      { name: t('{ext} 文件', { ext: extension.toUpperCase() }), extensions: [extension] },
      { name: t('所有文件'), extensions: ['*'] }
    ]

    const result = await dialog.showSaveDialog(parentWindow, {
      title: t('导出数据'),
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
      title: t('导入连接配置'),
      filters: [
        { name: t('JSON 文件'), extensions: ['json'] },
        { name: t('所有文件'), extensions: ['*'] }
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
      title: t('导出连接配置'),
      defaultPath: defaultName || 'connections.json',
      filters: [
        { name: t('JSON 文件'), extensions: ['json'] },
        { name: t('所有文件'), extensions: ['*'] }
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
      title: t('选择SQL文件'),
      filters: [{ name: t('SQL文件'), extensions: ['sql'] }],
      properties: ['openFile']
    })
    if (!result.canceled) {
      for (const filePath of result.filePaths || []) grantFilePath(filePath)
    }
    return result
  })

  handle(IPC_CHANNELS.readFile, async (_event, filePath) => {
    if (!isFilePathGranted(filePath)) {
      log.warn('拒绝读取未授权文件:', filePath)
      return { success: false, error: '文件路径未授权，请通过文件选择对话框重新选择' }
    }
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (e) {
      log.error('读取文件失败:', e)
      return { success: false, error: e.message }
    }
  })

  // 图片浏览器的目录授权：只允许访问用户通过对话框选择或拖入的目录
  const imageRoots = new Set()

  const grantImageRoot = (dirPath) => {
    imageRoots.add(path.resolve(dirPath))
    while (imageRoots.size > 24) {
      imageRoots.delete(imageRoots.values().next().value)
    }
  }

  const canAccessImagePath = (targetPath) =>
    typeof targetPath === 'string' && [...imageRoots].some((root) => isPathWithinBase(targetPath, root))

  const imageDialogFilters = [
    { name: t('图片文件'), extensions: IMAGE_EXTENSIONS },
    { name: t('所有文件'), extensions: ['*'] }
  ]

  handle(IPC_CHANNELS.imageOpenDialog, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('打开图片'),
      properties: ['openFile'],
      filters: imageDialogFilters
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const filePath = result.filePaths[0]
    if (!getImageMime(filePath)) return { canceled: false, error: '不支持的图片格式' }

    grantImageRoot(path.dirname(filePath))
    return { canceled: false, filePath, dir: path.dirname(filePath) }
  })

  handle(IPC_CHANNELS.imageOpenFolder, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('打开图片文件夹'),
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const folderPath = result.filePaths[0]
    grantImageRoot(folderPath)
    return { canceled: false, folderPath, dir: folderPath }
  })

  handle(IPC_CHANNELS.imageListDir, async (_event, dirPath) => {
    try {
      if (!canAccessImagePath(dirPath)) return { success: false, error: '无权访问该文件夹' }

      const stat = await fs.promises.stat(dirPath)
      if (!stat.isDirectory()) return { success: false, error: '不是有效的文件夹' }

      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const files = []
      for (const entry of entries) {
        if (!getImageMime(entry.name)) continue
        const fullPath = path.join(dirPath, entry.name)
        try {
          const fileStat = await fs.promises.stat(fullPath)
          if (!fileStat.isFile()) continue
          files.push({ name: entry.name, path: fullPath, size: fileStat.size, modified: fileStat.mtimeMs })
        } catch {
          // 忽略无法访问的条目
        }
      }

      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
      return { success: true, dir: path.resolve(dirPath), files }
    } catch (e) {
      log.error('读取图片目录失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.imageRead, async (_event, filePath) => {
    try {
      const mime = getImageMime(filePath)
      if (!mime || !canAccessImagePath(filePath)) return { success: false, error: '无权访问该图片' }

      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile()) return { success: false, error: '不是有效的图片文件' }
      if (stat.size > MAX_IMAGE_FILE_SIZE) return { success: false, error: '图片超过 100MB，暂不支持' }

      const data = await fs.promises.readFile(filePath)
      return { success: true, data, mime, size: stat.size, modified: stat.mtimeMs }
    } catch (e) {
      log.error('读取图片失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.imageThumbnail, async (_event, filePath) => {
    try {
      if (!getImageMime(filePath) || !canAccessImagePath(filePath)) return { success: false }

      const image = nativeImage.createFromPath(filePath)
      if (image.isEmpty()) return { success: false }

      const size = image.getSize()
      if (!size.width || !size.height) return { success: false }

      const scale = Math.min(240 / size.width, 180 / size.height, 1)
      const resized =
        scale < 1
          ? image.resize({
              width: Math.max(1, Math.round(size.width * scale)),
              height: Math.max(1, Math.round(size.height * scale)),
              quality: 'good'
            })
          : image

      return { success: true, dataUrl: resized.toDataURL() }
    } catch {
      return { success: false }
    }
  })

  handle(IPC_CHANNELS.imageAcceptDropped, async (_event, paths) => {
    if (!Array.isArray(paths) || !paths.length) return { success: false, error: '没有可打开的文件' }

    for (const candidate of paths) {
      if (typeof candidate !== 'string' || !candidate) continue
      try {
        const stat = await fs.promises.stat(candidate)
        if (stat.isDirectory()) {
          grantImageRoot(candidate)
          return { success: true, dir: candidate }
        }
        if (stat.isFile() && getImageMime(candidate)) {
          grantImageRoot(path.dirname(candidate))
          return { success: true, filePath: candidate, dir: path.dirname(candidate) }
        }
      } catch {
        // 跳过不存在或不可访问的路径
      }
    }

    return { success: false, error: '未找到可打开的图片或文件夹' }
  })

  handle(IPC_CHANNELS.imageHostState, async () => {
    const state = getImageHostState()
    return { ...state, settings: maskImageHostSettings(state.settings) }
  })

  handle(IPC_CHANNELS.imageHostSaveSettings, async (_event, settings) => {
    const result = await saveImageHostSettings(settings)
    return { ...result, settings: maskImageHostSettings(result.settings) }
  })

  handle(IPC_CHANNELS.imageHostSelectFiles, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('选择要上传的图片'),
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: t('图片文件'), extensions: IMAGE_HOST_EXTENSIONS },
        { name: t('所有文件'), extensions: ['*'] }
      ]
    })
    return { canceled: result.canceled, paths: result.canceled ? [] : result.filePaths }
  })

  handle(IPC_CHANNELS.imageHostUpload, async (_event, paths) => uploadImagePaths(paths))

  handle(IPC_CHANNELS.imageHostUploadClipboard, async () => {
    const image = clipboard.readImage()
    if (!image || image.isEmpty()) {
      return {
        success: false,
        results: [],
        error: '剪贴板中没有图片',
        history: getImageHostState().history
      }
    }
    return uploadImageBuffer({
      buffer: image.toPNG(),
      name: buildClipboardFileName(),
      mime: 'image/png'
    })
  })

  handle(IPC_CHANNELS.imageHostTest, async (_event, providerId, settings) =>
    testImageHostProvider(providerId, settings)
  )

  handle(IPC_CHANNELS.imageHostClearHistory, async () => clearImageHostHistory())

  handle(IPC_CHANNELS.imageHostRemoveHistory, async (_event, id) => removeImageHostHistory(id))

  handle(IPC_CHANNELS.passwordVaultState, async () => getPasswordVaultState())

  handle(IPC_CHANNELS.passwordVaultSetMasterPassword, async (_event, password) =>
    setPasswordVaultMasterPassword(password)
  )

  handle(IPC_CHANNELS.passwordVaultUnlock, async (_event, password) => unlockPasswordVault(password))

  handle(IPC_CHANNELS.passwordVaultLock, async () => lockPasswordVault())

  handle(IPC_CHANNELS.passwordGroupSave, async (_event, input) => savePasswordGroup(input))

  handle(IPC_CHANNELS.passwordGroupDelete, async (_event, id) => deletePasswordGroup(id))

  handle(IPC_CHANNELS.passwordEntrySave, async (_event, input) => savePasswordEntry(input))

  handle(IPC_CHANNELS.passwordEntryDelete, async (_event, id) => deletePasswordEntry(id))

  handle(IPC_CHANNELS.passwordEntryReveal, async (_event, id) => revealPasswordEntry(id))

  handle(IPC_CHANNELS.saveSqlFile, async (_event, defaultPath) => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showSaveDialog(parentWindow, {
      title: t('保存SQL转储文件'),
      defaultPath: defaultPath || 'dump.sql',
      filters: [{ name: t('SQL文件'), extensions: ['sql'] }]
    })
    if (!result.canceled && result.filePath) grantFilePath(result.filePath)
    return result
  })

  handle(IPC_CHANNELS.writeFile, async (_event, filePath, content) => {
    if (!isFilePathGranted(filePath)) {
      log.warn('拒绝写入未授权文件:', filePath)
      return { success: false, error: '文件路径未授权，请通过保存对话框重新选择' }
    }
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
    return await executeSkill(name, params, { runChat: chat })
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

  handle(IPC_CHANNELS.skillsExport, async (_event, name) => {
    await initSkills()
    const bundle = exportSkillBundle(name)
    if (!bundle.success) return bundle

    const result = await dialog.showSaveDialog(getDialogParentWindow(), {
      title: t('导出技能'),
      defaultPath: bundle.fileName,
      filters: [{ name: t('NToolBox 技能包'), extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }

    try {
      await fs.promises.writeFile(result.filePath, bundle.content, 'utf8')
      return { success: true, name: bundle.name, filePath: result.filePath }
    } catch (error) {
      log.error('导出技能失败:', error)
      return { success: false, error: error.message }
    }
  })

  handle(IPC_CHANNELS.skillsImport, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('导入技能'),
      filters: [{ name: t('NToolBox 技能包'), extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true }

    try {
      const content = await fs.promises.readFile(result.filePaths[0], 'utf8')
      await initSkills()
      return await importSkillBundle(content)
    } catch (error) {
      log.error('导入技能失败:', error)
      return { success: false, error: error.message }
    }
  })

  handle(IPC_CHANNELS.mcpStatus, async () => {
    return getMcpStatus()
  })

  handle(IPC_CHANNELS.mcpReload, async () => {
    const servers = await reloadMcpFromConfig()
    return { success: servers.every((server) => server.status !== 'error'), servers }
  })

  handle(IPC_CHANNELS.mcpTest, async (_event, server) => {
    return await testMcpServer(server)
  })

  handle(IPC_CHANNELS.mcpRegistryServers, async (_event, options = {}) => {
    return await fetchMcpRegistryServers({
      search: options?.search,
      maxPages: options?.maxPages,
      base: getMcpRegistryBase(getConfig().network?.market_sources)
    })
  })

  handle(IPC_CHANNELS.networkTest, async (_event, url) => await testNetwork(url))

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
      title: t('选择技能扩展目录'),
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, canceled: true }
    }

    await initSkills()
    return await installSkill(result.filePaths[0])
  })

  handle(IPC_CHANNELS.extensionsInstallSource, async (_event, payload = {}) => {
    return await installPluginSource(payload?.input, { registry: payload?.registry })
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

  handle(IPC_CHANNELS.pluginsList, async () => {
    await initSkills()
    return await getInstalledPlugins()
  })

  handle(IPC_CHANNELS.pluginsInstallFromFolder, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('选择插件目录（需包含 plugin.json）'),
      properties: ['openDirectory']
    })

    if (result.canceled || !result.filePaths[0]) {
      return { success: false, canceled: true }
    }

    return await installPluginBundle(result.filePaths[0], { source: 'local' })
  })

  handle(IPC_CHANNELS.pluginsInstallSource, async (_event, payload = {}) => {
    return await installPluginBundleSource(payload?.input, { registry: payload?.registry })
  })

  handle(IPC_CHANNELS.pluginsUninstall, async (_event, name) => {
    return await uninstallPlugin(name)
  })

  handle(IPC_CHANNELS.pluginsOpenDirectory, async () => {
    try {
      const directory = getPluginDirectory()
      await fs.promises.mkdir(directory, { recursive: true })
      const error = await shell.openPath(directory)
      return error ? { success: false, error } : { success: true }
    } catch (error) {
      log.error('打开插件目录失败:', error)
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
