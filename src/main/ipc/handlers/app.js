import { BrowserWindow, dialog, nativeTheme } from 'electron'
import path from 'path'
import { log, getProjectRoot } from '../../utils'
import { t } from '../../services/i18n.js'
import { getConfig, getPublicConfig, saveConfig, patchConfig, loadConfig } from '../../services/config.js'
import {
  applyConfigImport,
  defaultConfigExportFileName,
  readConfigImport,
  writeConfigExport
} from '../../services/configTransfer.js'
import {
  fetchManagedProfilePreview,
  getManagedProfileInfo,
  readManagedProfileFile,
  readManagedProfileFilePreview,
  removeManagedProfileFile,
  writeManagedProfileFile
} from '../../services/managedProfile.js'
import {
  clearSync,
  getSyncStatus,
  previewSync,
  setSyncAutoSync,
  setSyncDeviceName,
  setSyncDirectory,
  setSyncPassphrase,
  setSyncSections,
  startAutoSync,
  syncNow
} from '../../services/syncService.js'
import {
  MANAGED_PROFILE_PATHS,
  applyManagedSettings,
  deleteValueAtPath,
  getValueAtPath,
  parseManagedProfile,
  setValueAtPath
} from '../../../shared/managedProfile.js'
import { generateSQLFile } from '../../services/templates/sqlScriptFile.js'
import { openFile, openFolder } from '../../services/fileOpener.js'
import { setAutoStart, getAutoStart } from '../../services/autostart.js'
import {
  checkForUpdates,
  startAutoUpdateCheck,
  getUpdateReleases,
  downloadUpdate,
  cancelUpdateDownload,
  installUpdate
} from '../../services/updater.js'
import { getMainWindow, getSettingsWindow, createSettingsWindow, refreshWindowTheme } from '../../windows'
import { createAppMenu, createTray } from '../../ui'
import { syncLocaleFromConfig } from '../../services/i18n.js'
import { reloadMcpFromConfig } from '../../services/extensions/mcp.js'
import { applyNetworkConfig } from '../../services/network.js'
import { isPathWithinBase } from '../../utils/sanitize'
import { IPC_CHANNELS, IPC_EVENTS } from '../../../shared/ipc'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const packageJson = require(path.join(getProjectRoot(), 'package.json'))

let autoSyncStarted = false

export function registerAppHandlers(handle) {
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
    if (config.sql_generator.base_path && !isPathWithinBase(filePath, config.sql_generator.base_path)) {
      log.warn('拒绝打开 base_path 外的文件:', filePath)
      return false
    }
    return await openFile(filePath, config.sql_generator.text_edit_app)
  })

  handle(IPC_CHANNELS.openFolder, async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') return false
    const config = getConfig()
    if (config.sql_generator.base_path && !isPathWithinBase(folderPath, config.sql_generator.base_path)) {
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

  handle(IPC_CHANNELS.reloadConfig, async () => await loadConfig())

  handle(IPC_CHANNELS.configExport, async () => {
    const settingsWindow = getSettingsWindow()
    const mainWindow = getMainWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showSaveDialog(parentWindow, {
      title: t('导出配置'),
      defaultPath: defaultConfigExportFileName(),
      filters: [{ name: t('配置文件'), extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { success: false, canceled: true }
    return await writeConfigExport(result.filePath)
  })

  handle(IPC_CHANNELS.configImportPick, async () => {
    const settingsWindow = getSettingsWindow()
    const mainWindow = getMainWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, {
      title: t('导入配置'),
      properties: ['openFile'],
      filters: [{ name: t('配置文件'), extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true }
    return await readConfigImport(result.filePaths[0])
  })

  handle(IPC_CHANNELS.configImportApply, async (_event, importedConfig) => {
    const previousMcp = JSON.stringify(getConfig().extensions?.mcp_servers || [])
    const success = await applyConfigImport(importedConfig)
    if (success) notifyConfigSaved(previousMcp)
    return success
  })

  function buildManagedTransition(stored, settings) {
    const restore =
      stored && stored.restore && typeof stored.restore === 'object' && !Array.isArray(stored.restore)
        ? JSON.parse(JSON.stringify(stored.restore))
        : {}
    const config = JSON.parse(JSON.stringify(getConfig()))
    for (const info of MANAGED_PROFILE_PATHS) {
      const managed = getValueAtPath(settings, info.path) !== undefined
      if (managed) {
        if (getValueAtPath(restore, info.path) === undefined) {
          const existing = getValueAtPath(config, info.path)
          if (existing !== undefined) setValueAtPath(restore, info.path, existing)
        }
        continue
      }
      const snapshot = getValueAtPath(restore, info.path)
      if (snapshot === undefined) continue
      setValueAtPath(config, info.path, snapshot)
      deleteValueAtPath(restore, info.path)
    }
    return { restore, config }
  }

  async function applyManagedProfilePayload(raw, source) {
    const parsed = parseManagedProfile(raw)
    if (!parsed.ok) return { success: false, code: parsed.code }

    const sourceInfo =
      source && (source.kind === 'url' || source.kind === 'file') && typeof source.value === 'string'
        ? { kind: source.kind, value: source.value.trim() }
        : null
    const existing = await readManagedProfileFile()
    const transition = buildManagedTransition(existing.ok ? existing.stored : null, parsed.profile.settings)
    const written = await writeManagedProfileFile({
      name: parsed.profile.name,
      owner: parsed.profile.owner,
      description: parsed.profile.description,
      updated_at: parsed.profile.updatedAt,
      applied_at: new Date().toISOString(),
      source: sourceInfo,
      settings: parsed.profile.settings,
      restore: transition.restore
    })
    if (!written.success) return written

    const previousMcp = JSON.stringify(getConfig().extensions?.mcp_servers || [])
    const nextConfig = applyManagedSettings(transition.config, parsed.profile.settings)
    const success = await saveConfig(nextConfig)
    if (success) notifyConfigSaved(previousMcp)
    return { success, info: getManagedProfileInfo() }
  }

  async function clearManagedProfile() {
    const existing = await readManagedProfileFile()
    const restore =
      existing.ok &&
      existing.stored?.restore &&
      typeof existing.stored.restore === 'object' &&
      !Array.isArray(existing.stored.restore)
        ? existing.stored.restore
        : null
    await removeManagedProfileFile()
    if (!restore) return { success: true, info: getManagedProfileInfo() }

    const previousMcp = JSON.stringify(getConfig().extensions?.mcp_servers || [])
    const nextConfig = applyManagedSettings(JSON.parse(JSON.stringify(getConfig())), restore)
    const success = await saveConfig(nextConfig)
    if (success) notifyConfigSaved(previousMcp)
    return { success, info: getManagedProfileInfo() }
  }

  handle(IPC_CHANNELS.managedProfileGet, async () => getManagedProfileInfo())

  handle(IPC_CHANNELS.managedProfilePick, async () => {
    const settingsWindow = getSettingsWindow()
    const mainWindow = getMainWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, {
      title: t('导入团队托管配置'),
      properties: ['openFile'],
      filters: [{ name: t('JSON 文件'), extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    return await readManagedProfileFilePreview(result.filePaths[0])
  })

  handle(IPC_CHANNELS.managedProfileFetch, async (_event, url) => await fetchManagedProfilePreview(url))

  handle(IPC_CHANNELS.managedProfileApply, async (_event, raw, source) => await applyManagedProfilePayload(raw, source))

  handle(IPC_CHANNELS.managedProfileRefresh, async () => {
    const existing = await readManagedProfileFile()
    const source = existing.ok ? existing.stored?.source : null
    if (!source || source.kind !== 'url' || typeof source.value !== 'string') {
      return { success: false, code: 'source' }
    }
    const preview = await fetchManagedProfilePreview(source.value)
    if (!preview.success) return preview
    return await applyManagedProfilePayload(preview.raw, preview.source)
  })

  handle(IPC_CHANNELS.managedProfileClear, async () => await clearManagedProfile())

  handle(IPC_CHANNELS.syncGetStatus, async () => await getSyncStatus())

  handle(IPC_CHANNELS.syncPickDirectory, async () => {
    const settingsWindow = getSettingsWindow()
    const mainWindow = getMainWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, {
      title: t('选择同步文件夹'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    return await setSyncDirectory(result.filePaths[0])
  })

  handle(IPC_CHANNELS.syncNow, async (_event, options) => {
    const previousMcp = JSON.stringify(getConfig().extensions?.mcp_servers || [])
    const result = await syncNow({ force: options?.force === true })
    if (result?.success) notifyConfigSaved(previousMcp)
    return result
  })

  handle(IPC_CHANNELS.syncClear, async () => await clearSync())

  handle(IPC_CHANNELS.syncPreview, async () => await previewSync())

  handle(IPC_CHANNELS.syncSetDeviceName, async (_event, name) => await setSyncDeviceName(name))

  handle(IPC_CHANNELS.syncSetSections, async (_event, disabledSections) => await setSyncSections(disabledSections))

  handle(IPC_CHANNELS.syncSetAutoSync, async (_event, enabled) => await setSyncAutoSync(enabled))

  handle(IPC_CHANNELS.syncSetPassphrase, async (_event, passphrase) => await setSyncPassphrase(passphrase))

  if (!autoSyncStarted) {
    autoSyncStarted = true
    startAutoSync({
      onApplied: () => notifyConfigSaved(JSON.stringify(getConfig().extensions?.mcp_servers || []))
    })
  }

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
}
