import { clipboard, dialog, Notification, shell } from 'electron'
import fs from 'fs'
import { log } from '../../utils'
import { t } from '../../services/i18n.js'
import { getConfig } from '../../services/config.js'
import { chat } from '../../services/agent/chat.js'
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
} from '../../services/extensions/skills.js'
import { installPluginSource, installPluginBundleSource } from '../../services/extensions/pluginInstaller.js'
import {
  approvePluginSandbox,
  getInstalledPlugins,
  getPluginDirectory,
  getPluginRecord,
  getSandboxHash,
  installPluginBundle,
  uninstallPlugin
} from '../../services/extensions/plugins.js'
import { executeSandboxAction } from '../../services/extensions/pluginSandbox.js'
import { SANDBOX_OUTPUT_MAX, SANDBOX_PERMISSIONS } from '../../../shared/pluginSandbox.js'
import { getMcpStatus, reloadMcpFromConfig, testMcpServer } from '../../services/extensions/mcp.js'
import { testNetwork } from '../../services/network.js'
import { getMcpRegistryBase } from '../../../shared/network.js'
import { fetchMcpRegistryServers } from '../../services/extensions/mcpRegistry.js'
import { IPC_CHANNELS } from '../../../shared/ipc'
import { getDialogParentWindow } from './common'

const SANDBOX_RISK_LABELS = { low: '低风险', medium: '中风险', high: '高风险' }

function describeSandboxPermissions(ids) {
  return (Array.isArray(ids) ? ids : [])
    .map((id) => {
      const permission = SANDBOX_PERMISSIONS.find((item) => item.id === id)
      if (!permission) return ''
      return `${t(permission.label)}（${t(SANDBOX_RISK_LABELS[permission.risk] || SANDBOX_RISK_LABELS.low)}）`
    })
    .filter(Boolean)
    .join('\n')
}

async function ensureSandboxApproval(record, action) {
  const hash = getSandboxHash(record.sandbox)
  if (record.approvedSandbox === hash) return true
  const hosts = [...new Set((record.sandbox.actions || []).flatMap((item) => item.params?.hosts || []))]
  const permissionText = describeSandboxPermissions(record.sandbox.permissions)
  const scopeText = hosts.length
    ? `${permissionText}\n\n${t('允许访问的主机：{p0}', { p0: hosts.join('、') })}`
    : permissionText
  const { response } = await dialog.showMessageBox(getDialogParentWindow(), {
    type: 'warning',
    title: t('插件权限确认'),
    message: t('插件 {p0} 请求运行「{p1}」', { p0: record.name, p1: action.title }),
    detail: t(
      '该动作需要以下权限：\n{p0}\n\n沙箱动作只调用应用内置能力，不会运行插件携带的代码；授权后同一版本插件不再重复询问。',
      {
        p0: scopeText
      }
    ),
    buttons: [t('允许并运行'), t('取消')],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  })
  if (response !== 0) return false
  await approvePluginSandbox(record.name, hash)
  return true
}

export function registerExtensionHandlers(handle) {
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

  handle(IPC_CHANNELS.pluginsRunAction, async (_event, name, actionId) => {
    const record = await getPluginRecord(String(name || ''))
    if (!record) return { success: false, error: t('插件 {p0} 不存在', { p0: name }) }
    const action = record.sandbox.actions.find((item) => item.id === actionId)
    if (!action) return { success: false, error: t('插件动作不存在') }
    if (!(await ensureSandboxApproval(record, action))) return { success: false, canceled: true }

    const text = action.input === 'clipboard' ? clipboard.readText() : ''
    const result = await executeSandboxAction(record.name, action, { text })
    if (!result.success) return result

    const output = String(result.output || '').slice(0, SANDBOX_OUTPUT_MAX)
    let outputMode = 'clipboard'
    if (action.output === 'notification' && Notification.isSupported()) {
      new Notification({ title: `${record.name} · ${action.title}`, body: output.slice(0, 200) }).show()
      outputMode = 'notification'
    } else {
      clipboard.writeText(output)
    }
    log.info(`插件沙箱动作: ${record.name}/${action.id}（${action.op}）`)
    return { success: true, outputMode, outputPreview: output.slice(0, 200) }
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
