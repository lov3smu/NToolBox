import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { openUpdateCenter, useAutoSaveConfig, usePaneResize, useToast } from '@/composables'
import {
  getConfig,
  patchConfig,
  selectDirectory,
  selectFile,
  getPackageInfo,
  getAiProviders,
  getProviderModels,
  validateApiKey,
  getAiApiKey,
  returnToApp,
  windowMinimize,
  windowToggleMaximize,
  windowClose,
  platform as hostPlatform,
  setAutoStart,
  reloadConfig,
  configExport,
  configImportPick,
  configImportApply,
  managedProfileGet,
  managedProfilePick,
  managedProfileFetch,
  managedProfileApply,
  managedProfileRefresh,
  managedProfileClear,
  syncGetStatus,
  syncPickDirectory,
  syncPreview,
  syncNow,
  syncClear,
  syncSetDeviceName,
  syncSetSections,
  syncSetAutoSync,
  syncSetPassphrase,
  reloadMenu,
  openExternal,
  onSettingsTab,
  networkTest
} from '@/api'
import { tools, RECENT_TOOLS_LIMIT_OPTIONS, normalizeRecentToolsLimit } from '@shared/navTools'
import { SYNC_SECTION_IDS } from '@shared/syncBundle'
import { SETTINGS_TAB_ITEMS } from '@shared/settingsTabs'
import { DEFAULT_SHORTCUT_ACTIONS, getDefaultShortcuts } from '@shared/shortcutActions'
import { formatAccelerator } from '@/utils/shortcut'
import { normalizeDatabaseEditorConfig, DATABASE_EDITOR_THEME_OPTIONS } from '@shared/databaseEditor'
import {
  DATABASE_HISTORY_LIMIT_OPTIONS,
  DATABASE_PAGE_SIZE_OPTIONS,
  DATABASE_REFRESH_INTERVAL_OPTIONS,
  DATABASE_TRANSFER_BATCH_SIZE_OPTIONS,
  normalizeDatabaseHistoryLimit,
  normalizeDatabasePageSize,
  normalizeDatabaseRefreshInterval,
  normalizeDatabaseTransferBatchSize
} from '@shared/databaseClient'
import { UPDATE_CHECK_INTERVAL_OPTIONS, normalizeUpdateCheckInterval } from '@shared/updater'
import { SQL_AUDIT_RULES, DEFAULT_SQL_AUDIT_RULES } from '@shared/sqlAudit'
import { SECRET_MASK, isSecretMask } from '@shared/secrets'
import {
  PROXY_MODE_OPTIONS,
  DEFAULT_PROXY_BYPASS,
  DEFAULT_MARKET_SOURCES,
  UPDATE_FEED_DEFAULT_URL,
  isHttpUrl,
  isProxyUrl
} from '@shared/network'
import {
  TOOL_POLICY_OPTIONS,
  AI_TIMEOUT_OPTIONS,
  AI_COMPRESS_THRESHOLD_OPTIONS,
  AI_COMPRESS_KEEP_RECENT_OPTIONS,
  AI_MAX_ATTACHMENT_OPTIONS,
  AI_MAX_IMAGE_MB_OPTIONS,
  AI_MAX_TEXT_KB_OPTIONS,
  AI_AGENT_MAX_ITERATIONS_OPTIONS,
  AI_AGENT_TIMEOUT_MIN_OPTIONS,
  AI_AGENT_PLAN_STEPS_OPTIONS,
  AI_AGENT_PARALLEL_TOOLS_OPTIONS,
  AI_TOOL_RESULT_MAX_KB_OPTIONS,
  AI_TOOL_RESULT_RUN_KB_OPTIONS,
  AI_TOOL_RESULT_RETENTION_OPTIONS,
  AI_PRESETS,
  normalizeToolPolicy,
  normalizeAiTimeout,
  normalizeAiCompressThreshold,
  normalizeAiCompressKeepRecent,
  normalizeAiMaxAttachments,
  normalizeAiMaxImageMb,
  normalizeAiMaxTextKb,
  normalizeAiAgentMaxIterations,
  normalizeAiAgentTimeoutMin,
  normalizeAiAgentPlanSteps,
  normalizeAiAgentParallelTools,
  normalizeAiToolResultMaxKb,
  normalizeAiToolResultRunKb,
  normalizeAiToolResultRetentionDays,
  parseScenarioModel
} from '@shared/aiBehavior'
import { NOTIFICATION_CHANNEL_OPTIONS, NOTIFICATION_ITEMS, normalizeNotificationConfig } from '@shared/notifications'
import { MANAGED_PROFILE_PATHS } from '@shared/managedProfile'
import { CLIPBOARD_HISTORY_LIMITS, normalizeClipboardHistoryConfig } from '@shared/clipboardSettings'
import { t, setLocale } from '@/i18n'
import { DEFAULT_LOCALE, LOCALE_OPTIONS } from '@shared/i18n'
import {
  applyFontSize,
  applyTheme,
  applyThemeStyle,
  getFontSizePreference,
  getThemePreference,
  getThemeStylePreference,
  normalizeFontSizePreference,
  normalizeThemeStyle
} from '@/utils/theme'

export function createSettingsState({ route }) {
  const { showError, showSuccess } = useToast()
  const isMac = hostPlatform === 'darwin'
  let removeSettingsTabListener = null

  const configTransferBusy = ref(false)
  const configImportConfirm = ref({ visible: false, config: null, summary: null })

  const CONFIG_IMPORT_ERROR_MESSAGES = {
    format: '文件格式无效，不是可识别的 NToolBox 配置文件',
    type: '文件类型不匹配，不是 NToolBox 配置导出文件',
    version: '配置文件版本不受支持，请升级应用后重试',
    config: '配置文件内容缺失',
    size: '配置文件过大，无法导入',
    read: '读取配置文件失败'
  }

  const configImportMessage = computed(() => {
    const summary = configImportConfirm.value.summary
    if (!summary) return ''
    return t(
      '将覆盖当前配置：模型服务商 {providers} 个、数据库连接 {connections} 个、MCP 连接器 {mcpServers} 个、快捷键 {shortcuts} 项。导出文件不含密钥与密码，数据库密码需重新填写。',
      { ...summary }
    )
  })

  const managedProfileInfo = ref({ active: false })
  const managedProfileBusy = ref(false)
  const managedProfileUrl = ref('')
  const managedProfileConfirm = ref({ visible: false, mode: 'apply', raw: '', source: null, profile: null })

  function defaultSyncInfo() {
    return {
      configured: false,
      directory: '',
      deviceName: '',
      lastSyncAt: '',
      lastResult: null,
      disabledSections: [],
      autoSync: false,
      passphraseSet: false,
      remoteExists: false,
      remoteEncrypted: false,
      remoteUpdatedAt: '',
      remoteNewer: false,
      remoteError: ''
    }
  }

  const syncInfo = ref(defaultSyncInfo())
  const syncBusy = ref(false)
  const syncDeviceNameDraft = ref('')
  const syncPassphraseDraft = ref('')
  const syncConfirm = ref({
    visible: false,
    applied: [],
    pushed: [],
    conflicts: [],
    remoteDevice: '',
    remoteUpdatedAt: ''
  })
  const syncForceConfirm = ref({ visible: false, code: '' })

  const SYNC_SECTION_LABELS = {
    appearance: '外观',
    shortcuts: '快捷键',
    notifications: '通知',
    clipboard: '剪贴板',
    network: '镜像源',
    database: '数据库偏好',
    sql_generator: 'SQL 生成器',
    ai: 'AI 行为',
    memory: '记忆开关'
  }

  const syncSectionItems = computed(() =>
    SYNC_SECTION_IDS.map((id) => ({
      id,
      label: t(SYNC_SECTION_LABELS[id]),
      enabled: !(syncInfo.value.disabledSections || []).includes(id)
    }))
  )

  function syncSectionNames(ids) {
    return (ids || []).map((id) => t(SYNC_SECTION_LABELS[id] || id)).join('、')
  }

  const SYNC_ERROR_MESSAGES = {
    'not-configured': '请先选择共享的同步文件夹',
    'missing-directory': '同步文件夹不存在或不可写',
    'invalid-directory': '请选择可写的文件夹',
    'remote-invalid': '同步文件格式无效，已保留原文件未覆盖',
    'remote-size': '同步文件过大，已跳过',
    'read-failed': '读取同步文件失败',
    'write-failed': '写入同步文件失败',
    'save-failed': '保存同步设置失败',
    'clear-failed': '清除同步状态失败',
    locked: '同步文件已加密，请先设置正确的同步口令',
    plaintext: '同步文件未加密，与当前同步口令不匹配',
    'invalid-name': '设备名称不能为空且不超过 60 个字符',
    'invalid-sections': '同步范围无效',
    'invalid-value': '参数无效',
    'invalid-passphrase': '同步口令过长（最多 128 个字符）',
    'passphrase-failed': '保存同步口令失败',
    unavailable: '同步功能不可用'
  }

  function syncErrorMessage(code) {
    return t(SYNC_ERROR_MESSAGES[code] || '跨设备同步失败')
  }

  const syncConfirmMessage = computed(() => {
    const confirm = syncConfirm.value
    if (!confirm.visible) return ''
    const parts = []
    if (confirm.applied?.length) parts.push(t('将应用：{sections}', { sections: syncSectionNames(confirm.applied) }))
    if (confirm.pushed?.length) parts.push(t('将推送：{sections}', { sections: syncSectionNames(confirm.pushed) }))
    if (confirm.conflicts?.length) {
      parts.push(t('冲突按较新修改合并：{sections}', { sections: syncSectionNames(confirm.conflicts) }))
    }
    if (confirm.remoteDevice) parts.push(t('共享文件最近写入设备：{device}', { device: confirm.remoteDevice }))
    return parts.join('；')
  })

  const syncForceMessage = computed(() => {
    const code = syncForceConfirm.value.code
    if (!code) return ''
    return t('{reason}。继续将先备份原共享文件，再用本机设置覆盖。', { reason: syncErrorMessage(code) })
  })

  const syncRemoteHint = computed(() => {
    const info = syncInfo.value
    if (!info.configured) return ''
    if (info.remoteError) return t('共享文件状态：{status}', { status: syncErrorMessage(info.remoteError) })
    if (info.remoteNewer) return t('共享文件有更新，点击立即同步查看并应用')
    return ''
  })

  async function loadSyncInfo() {
    const info = await syncGetStatus()
    syncInfo.value = info && typeof info === 'object' ? { ...defaultSyncInfo(), ...info } : defaultSyncInfo()
    if (!syncDeviceNameDraft.value) syncDeviceNameDraft.value = syncInfo.value.deviceName || ''
  }

  async function pickSyncDirectory() {
    if (syncBusy.value) return
    syncBusy.value = true
    try {
      const result = await syncPickDirectory()
      if (result?.canceled) return
      if (!result?.success) {
        showError(syncErrorMessage(result?.code))
        return
      }
      if (result.status) syncInfo.value = { ...syncInfo.value, ...result.status }
      else await loadSyncInfo()
      if (syncInfo.value.deviceName) syncDeviceNameDraft.value = syncInfo.value.deviceName
      showSuccess(t('同步文件夹已设置'))
    } finally {
      syncBusy.value = false
    }
  }

  function handleSyncFailure(result) {
    if (result?.recoverable) {
      syncForceConfirm.value = { visible: true, code: result.code }
      return
    }
    showError(syncErrorMessage(result?.code))
  }

  function resetSyncConfirm() {
    syncConfirm.value = {
      visible: false,
      applied: [],
      pushed: [],
      conflicts: [],
      remoteDevice: '',
      remoteUpdatedAt: ''
    }
  }

  function resetSyncForceConfirm() {
    syncForceConfirm.value = { visible: false, code: '' }
  }

  async function runSyncNow() {
    if (syncBusy.value) return
    if (!syncInfo.value.configured) {
      showError(t('请先选择共享的同步文件夹'))
      return
    }
    syncBusy.value = true
    try {
      await flushAutoSave(true)
      const preview = await syncPreview()
      if (!preview?.success) {
        handleSyncFailure(preview)
        return
      }
      const total = (preview.applied?.length || 0) + (preview.pushed?.length || 0)
      if (total === 0 && !preview.conflicts?.length) {
        await loadSyncInfo()
        showSuccess(t('同步完成：已是最新'))
        return
      }
      syncConfirm.value = {
        visible: true,
        applied: preview.applied || [],
        pushed: preview.pushed || [],
        conflicts: preview.conflicts || [],
        remoteDevice: preview.remoteDevice || '',
        remoteUpdatedAt: preview.remoteUpdatedAt || ''
      }
    } finally {
      syncBusy.value = false
    }
  }

  async function executeSync(force) {
    if (syncBusy.value) return
    resetSyncConfirm()
    resetSyncForceConfirm()
    syncBusy.value = true
    try {
      const result = await syncNow(force ? { force: true } : undefined)
      if (!result?.success) {
        handleSyncFailure(result)
        return
      }
      await loadSyncInfo()
      const applied = result.applied?.length || 0
      const pushed = result.pushed?.length || 0
      if (applied === 0 && pushed === 0) {
        showSuccess(t('同步完成：已是最新'))
      } else if (result.conflicts?.length) {
        showSuccess(
          t('同步完成：应用 {applied} 项、推送 {pushed} 项，冲突已按较新修改合并', {
            applied,
            pushed
          })
        )
      } else {
        showSuccess(t('同步完成：应用 {applied} 项、推送 {pushed} 项', { applied, pushed }))
      }
      if (result.backupPath) showSuccess(t('原共享文件已备份'))
      if (applied > 0) {
        await reloadConfig()
        setTimeout(() => window.location.reload(), 600)
      }
    } finally {
      syncBusy.value = false
    }
  }

  async function confirmSyncNow() {
    await executeSync(false)
  }

  async function confirmForceSync() {
    await executeSync(true)
  }

  async function saveSyncDeviceName() {
    if (syncBusy.value) return
    syncBusy.value = true
    try {
      const result = await syncSetDeviceName(syncDeviceNameDraft.value)
      if (!result?.success) {
        showError(syncErrorMessage(result?.code))
        return
      }
      await loadSyncInfo()
      syncDeviceNameDraft.value = syncInfo.value.deviceName || ''
      showSuccess(t('设备名称已保存'))
    } finally {
      syncBusy.value = false
    }
  }

  async function toggleSyncSection(id, enabled) {
    if (syncBusy.value) return
    const disabled = new Set(syncInfo.value.disabledSections || [])
    if (enabled) disabled.delete(id)
    else disabled.add(id)
    const result = await syncSetSections([...disabled])
    if (!result?.success) {
      showError(syncErrorMessage(result?.code))
      return
    }
    await loadSyncInfo()
  }

  async function setSyncAutoSyncEnabled(enabled) {
    if (syncBusy.value) return
    syncBusy.value = true
    try {
      const result = await syncSetAutoSync(Boolean(enabled))
      if (!result?.success) {
        showError(syncErrorMessage(result?.code))
        return
      }
      await loadSyncInfo()
      showSuccess(enabled ? t('已开启自动同步') : t('已关闭自动同步'))
    } finally {
      syncBusy.value = false
    }
  }

  async function saveSyncPassphrase() {
    if (syncBusy.value) return
    syncBusy.value = true
    try {
      const value = syncPassphraseDraft.value
      const result = await syncSetPassphrase(value)
      if (!result?.success) {
        showError(syncErrorMessage(result?.code))
        return
      }
      syncPassphraseDraft.value = ''
      await loadSyncInfo()
      showSuccess(value ? t('同步口令已设置') : t('同步口令已清除'))
    } finally {
      syncBusy.value = false
    }
  }

  async function clearSyncPassphrase() {
    if (syncBusy.value) return
    syncPassphraseDraft.value = ''
    await saveSyncPassphrase()
  }

  async function stopSync() {
    if (syncBusy.value) return
    syncBusy.value = true
    try {
      const result = await syncClear()
      if (!result?.success) {
        showError(syncErrorMessage(result?.code))
        return
      }
      syncInfo.value = { ...defaultSyncInfo(), ...(result.status || {}) }
      syncDeviceNameDraft.value = syncInfo.value.deviceName || ''
      showSuccess(t('已停止跨设备同步'))
    } finally {
      syncBusy.value = false
    }
  }

  const MANAGED_PROFILE_ERROR_MESSAGES = {
    format: '文件格式无效，不是可识别的团队托管配置',
    type: '文件类型不匹配，不是 NToolBox 团队托管配置',
    version: '托管配置版本不受支持，请升级应用后重试',
    settings: '托管配置缺少 settings 字段',
    empty: '托管配置不包含受支持的配置项',
    size: '托管配置过大，无法导入',
    read: '读取托管配置失败',
    url: '请输入以 http:// 或 https:// 开头的托管配置地址',
    network: '下载托管配置失败，请检查网络或地址',
    source: '当前托管配置不是从 URL 导入的，无法同步',
    save: '应用托管配置失败'
  }

  const managedProfileTags = computed(() => {
    const paths = managedProfileInfo.value.paths || []
    return MANAGED_PROFILE_PATHS.filter((info) => paths.includes(info.path)).map((info) => t(info.label))
  })

  const managedProfileSourceLabel = computed(() => {
    const source = managedProfileInfo.value.source
    return source?.value || t('本机文件')
  })

  const managedProfileConfirmMessage = computed(() => {
    const confirm = managedProfileConfirm.value
    if (confirm.mode === 'clear') {
      return t('取消托管后，托管期间被覆盖的设置会恢复为托管前的本机值，托管字段重新可编辑。')
    }
    const profile = confirm.profile
    if (!profile) return ''
    const fields = MANAGED_PROFILE_PATHS.filter((info) => profile.paths.includes(info.path)).map((info) =>
      t(info.label)
    )
    return t('将应用托管配置「{name}」，强制覆盖：{fields}。应用后这些字段以团队配置为准，本机修改会在保存时被覆盖。', {
      name: profile.name,
      fields: fields.join('、')
    })
  })

  function managedProfileErrorMessage(code) {
    return t(MANAGED_PROFILE_ERROR_MESSAGES[code] || '托管配置操作失败')
  }

  async function loadManagedProfileInfo() {
    const info = await managedProfileGet()
    managedProfileInfo.value = info && typeof info === 'object' ? info : { active: false }
    const source = managedProfileInfo.value.source
    if (source?.kind === 'url' && typeof source.value === 'string') managedProfileUrl.value = source.value
  }

  function openManagedProfileConfirm(mode, payload = {}) {
    managedProfileConfirm.value = { visible: true, mode, raw: '', source: null, profile: null, ...payload }
  }

  function cancelManagedProfileConfirm() {
    managedProfileConfirm.value = { visible: false, mode: 'apply', raw: '', source: null, profile: null }
  }

  async function pickManagedProfile() {
    if (managedProfileBusy.value) return
    managedProfileBusy.value = true
    try {
      const result = await managedProfilePick()
      if (result?.canceled) return
      if (!result?.success) {
        showError(managedProfileErrorMessage(result?.code))
        return
      }
      openManagedProfileConfirm('apply', { raw: result.raw, source: result.source, profile: result.profile })
    } finally {
      managedProfileBusy.value = false
    }
  }

  async function previewManagedProfileFromUrl() {
    if (managedProfileBusy.value) return
    const url = managedProfileUrl.value.trim()
    if (!/^https?:\/\//i.test(url)) {
      showError(managedProfileErrorMessage('url'))
      return
    }
    managedProfileBusy.value = true
    try {
      const result = await managedProfileFetch(url)
      if (!result?.success) {
        showError(managedProfileErrorMessage(result?.code))
        return
      }
      openManagedProfileConfirm('apply', { raw: result.raw, source: result.source, profile: result.profile })
    } finally {
      managedProfileBusy.value = false
    }
  }

  async function confirmManagedProfileAction() {
    const confirm = managedProfileConfirm.value
    if (managedProfileBusy.value) return
    managedProfileConfirm.value = { visible: false, mode: 'apply', raw: '', source: null, profile: null }
    managedProfileBusy.value = true
    try {
      await flushAutoSave(true)
      const result =
        confirm.mode === 'clear'
          ? await managedProfileClear()
          : await managedProfileApply(confirm.raw, confirm.source ? { ...confirm.source } : null)
      if (!result?.success) {
        showError(managedProfileErrorMessage(result?.code))
        return
      }
      await reloadConfig()
      showSuccess(confirm.mode === 'clear' ? t('已取消团队托管配置') : t('团队托管配置已应用'))
      setTimeout(() => window.location.reload(), 600)
    } finally {
      managedProfileBusy.value = false
    }
  }

  function requestClearManagedProfile() {
    if (managedProfileBusy.value) return
    openManagedProfileConfirm('clear')
  }

  async function refreshManagedProfile() {
    if (managedProfileBusy.value) return
    managedProfileBusy.value = true
    try {
      const result = await managedProfileRefresh()
      if (!result?.success) {
        showError(managedProfileErrorMessage(result?.code))
        return
      }
      await reloadConfig()
      showSuccess(t('团队托管配置已同步'))
      setTimeout(() => window.location.reload(), 600)
    } finally {
      managedProfileBusy.value = false
    }
  }

  const shortcutTools = tools.filter((tool) => tool.shortcutKey)
  const shortcutActionItems = [
    {
      key: 'chat_send',
      label: '发送消息',
      desc: '聊天输入框中发送消息，未设置时按 Enter 发送、Shift+Enter 换行',
      placeholder: formatAccelerator(DEFAULT_SHORTCUT_ACTIONS.chat_send, isMac)
    },
    {
      key: 'database_run',
      label: '执行查询',
      desc: '数据库查询编辑器中执行当前 SQL',
      placeholder: formatAccelerator(DEFAULT_SHORTCUT_ACTIONS.database_run, isMac)
    },
    {
      key: 'global_search',
      label: '全局搜索',
      desc: '打开全局搜索面板',
      placeholder: formatAccelerator(DEFAULT_SHORTCUT_ACTIONS.global_search, isMac)
    }
  ]

  function toSelectOptions(options) {
    return options.map((option) => ({ ...option, value: String(option.value) }))
  }

  function applyAiPreset(preset) {
    if (!preset?.values) return
    const values = preset.values
    aiTemperature.value =
      values.temperature === null || values.temperature === undefined ? '' : String(values.temperature)
    aiCompressThreshold.value = String(normalizeAiCompressThreshold(values.context.compress_threshold))
    aiCompressKeepRecent.value = String(normalizeAiCompressKeepRecent(values.context.keep_recent))
    agentMaxIterations.value = String(normalizeAiAgentMaxIterations(values.agent.max_iterations))
    agentTimeoutMin.value = String(normalizeAiAgentTimeoutMin(values.agent.timeout_min))
    agentPlanSteps.value = String(normalizeAiAgentPlanSteps(values.agent.max_plan_steps))
    agentParallelTools.value = String(normalizeAiAgentParallelTools(values.agent.max_parallel_tools))
    toolResultMaxKb.value = String(normalizeAiToolResultMaxKb(values.tool_result.max_kb))
    toolResultRunKb.value = String(normalizeAiToolResultRunKb(values.tool_result.run_kb))
    toolResultRetentionDays.value = String(normalizeAiToolResultRetentionDays(values.tool_result.retention_days))
    if (values.agent.tool_policy) toolPolicy.value = normalizeToolPolicy(values.agent.tool_policy)
    appliedPresetId.value = preset.id
  }

  const menuItems = SETTINGS_TAB_ITEMS.map((item) => ({
    id: item.id,
    get text() {
      return t(item.label)
    }
  }))

  // Old deep links (settings windows opened before the rename) keep working.
  const TAB_ALIASES = {
    'database-editor': 'database-client',
    database: 'sql-generator',
    scripttype: 'sql-generator',
    mcp: 'extensions'
  }

  function resolveTabId(tab) {
    return TAB_ALIASES[tab] || tab
  }

  const tabMeta = {
    general: {
      get title() {
        return t('通用')
      },
      get description() {
        return t('管理界面语言、启动与窗口行为、系统通知以及剪贴板历史。')
      }
    },
    appearance: {
      get title() {
        return t('外观')
      },
      get description() {
        return t('选择主题模式、配色方案与字体大小，界面会随系统明暗设置自动适配。')
      }
    },
    api: {
      get title() {
        return t('模型')
      },
      get description() {
        return t('管理已添加的模型服务商，可编辑密钥、自定义地址与模型目录；未配置的服务商可通过下方按钮添加。')
      }
    },
    assistant: {
      get title() {
        return t('AI 助手')
      },
      get description() {
        return t('定义助手的人设与回答风格，设置采样参数、分场景模型、上下文压缩、Agent 运行与工具审批策略。')
      }
    },
    network: {
      get title() {
        return t('网络')
      },
      get description() {
        return t('配置代理、类型镜像源与更新检查地址；更改会自动保存并对后续联网请求生效。')
      }
    },
    'database-client': {
      get title() {
        return t('数据库客户端')
      },
      get description() {
        return t('设置查询分页、刷新轮询、数据传输、安全审计与编辑器偏好。')
      }
    },
    'sql-generator': {
      get title() {
        return t('SQL 脚本生成')
      },
      get description() {
        return t('配置脚本存储路径、开发者信息、默认编辑器以及可选的数据库与脚本类型。')
      }
    },
    'image-hosting': {
      get title() {
        return t('图床配置')
      },
      get description() {
        return t('配置上传使用的图床服务、单文件大小与历史记录上限。')
      }
    },
    shortcuts: {
      get title() {
        return t('快捷键')
      },
      get description() {
        return t('配置打开设置窗口、聊天发送、数据库执行查询与全局搜索的快捷键。')
      }
    },
    about: {
      get title() {
        return t('关于软件')
      },
      get description() {
        return t('查看版本信息、项目动态与更新入口。')
      }
    }
  }

  const themeOptions = [
    {
      value: 'system',
      get label() {
        return t('跟随系统')
      }
    },
    {
      value: 'light',
      get label() {
        return t('明亮')
      }
    },
    {
      value: 'dark',
      get label() {
        return t('暗黑')
      }
    }
  ]

  const themeStyleOptions = [
    {
      value: 'sapphire',
      get label() {
        return t('蓝宝石')
      },
      swatch: { accent: '#2f5fd0', surface: '#fbfcff', app: '#e9eff9', sidebar: '#1d3557' }
    },
    {
      value: 'forest',
      get label() {
        return t('森林')
      },
      swatch: { accent: '#2f7d5c', surface: '#fbfdfb', app: '#ebf2ed', sidebar: '#1b2b22' }
    },
    {
      value: 'mint',
      get label() {
        return t('薄荷')
      },
      swatch: { accent: '#0e9c88', surface: '#fbfefd', app: '#e9f4f1', sidebar: '#15302b' }
    },
    {
      value: 'bee',
      get label() {
        return t('蜜蜂')
      },
      swatch: { accent: '#b77900', surface: '#fffdf7', app: '#f7f0dc', sidebar: '#2f2716' }
    },
    {
      value: 'parchment',
      get label() {
        return t('羊皮纸')
      },
      swatch: { accent: '#9c6a3c', surface: '#fbf7ee', app: '#f0e8d6', sidebar: '#352a1d' }
    }
  ]

  const fontSizeOptions = [
    {
      value: 'small',
      get label() {
        return t('小')
      }
    },
    {
      value: 'medium',
      get label() {
        return t('标准')
      }
    },
    {
      value: 'large',
      get label() {
        return t('大')
      }
    },
    {
      value: 'xlarge',
      get label() {
        return t('特大')
      }
    }
  ]

  const databaseEditorOptions = [
    {
      key: 'line_numbers',
      get label() {
        return t('显示行号')
      },
      get description() {
        return t('在编辑区左侧展示行号')
      }
    },
    {
      key: 'run_button',
      get label() {
        return t('显示左侧执行按钮')
      },
      get description() {
        return t('每条语句左侧显示 ▶ 按钮，可直接执行该语句')
      }
    },
    {
      key: 'statement_outline',
      get label() {
        return t('显示当前语句外框线')
      },
      get description() {
        return t('用外框线标出光标所在的 SQL 语句')
      }
    },
    {
      key: 'active_line',
      get label() {
        return t('高亮当前行')
      },
      get description() {
        return t('突出显示光标所在行')
      }
    },
    {
      key: 'word_wrap',
      get label() {
        return t('自动换行')
      },
      get description() {
        return t('较长的 SQL 在编辑区内折行显示')
      }
    },
    {
      key: 'autocomplete',
      get label() {
        return t('自动补全')
      },
      get description() {
        return t('输入时提示表名、字段、函数与代码片段')
      }
    },
    {
      key: 'diagnostics',
      get label() {
        return t('SQL 语义诊断')
      },
      get description() {
        return t('检测未知表、未知字段与歧义字段并给出警告')
      }
    },
    {
      key: 'hover_ddl',
      get label() {
        return t('悬浮表名展示 DDL')
      },
      get description() {
        return t('鼠标悬停表名时显示建表语句')
      }
    }
  ]

  const databaseEditorThemes = DATABASE_EDITOR_THEME_OPTIONS

  function swatchStyle(swatch) {
    return {
      '--swatch-accent': swatch.accent,
      '--swatch-surface': swatch.surface,
      '--swatch-app': swatch.app,
      '--swatch-sidebar': swatch.sidebar
    }
  }

  const activeTab = ref('general')
  const settingsContentRef = ref(null)
  const menuCollapsed = ref(false)
  const {
    size: settingsSidebarWidth,
    resizing: settingsSidebarResizing,
    startResize: startSettingsSidebarResize,
    onKeydown: onSettingsSidebarKeydown
  } = usePaneResize({
    key: 'settingsSidebarWidth',
    initial: 176,
    min: 150,
    max: () => Math.min(360, Math.max(180, window.innerWidth - 620))
  })
  const activeMeta = computed(() => tabMeta[activeTab.value] || { title: '', description: '' })
  const tabHistory = ref([])
  const tabForwardHistory = ref([])
  const canGoBackTab = computed(() => tabHistory.value.length > 0)
  const canGoForwardTab = computed(() => tabForwardHistory.value.length > 0)

  watch(activeTab, async () => {
    await nextTick()
    const el = settingsContentRef.value
    if (!el || typeof el.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    el.animate(
      [
        { opacity: 0, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'none' }
      ],
      { duration: 140, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
    )
  })

  function selectTab(tab) {
    if (tab === activeTab.value) return
    void flushAutoSave(false, autoSaveKind())
    tabHistory.value.push(activeTab.value)
    tabForwardHistory.value = []
    activeTab.value = tab
  }

  function goBackTab() {
    if (!tabHistory.value.length) return
    void flushAutoSave(false, autoSaveKind())
    tabForwardHistory.value.push(activeTab.value)
    activeTab.value = tabHistory.value.pop()
  }

  function goForwardTab() {
    if (!tabForwardHistory.value.length) return
    void flushAutoSave(false, autoSaveKind())
    tabHistory.value.push(activeTab.value)
    activeTab.value = tabForwardHistory.value.pop()
  }
  const theme = ref('system')
  const themeStyle = ref('sapphire')
  const fontSize = ref('medium')
  const language = ref(DEFAULT_LOCALE)
  const languageOptions = LOCALE_OPTIONS
  const basePath = ref('')
  const developerChName = ref('')
  const developerEnName = ref('')
  const textEditApp = ref('')
  const autoUpdate = ref(true)
  const autoStart = ref(false)
  const closeAction = ref('ask')
  const closeActionOptions = [
    {
      value: 'ask',
      get label() {
        return t('每次询问')
      },
      get hint() {
        return t('关闭时弹窗选择隐藏到托盘或退出')
      }
    },
    {
      value: 'hide',
      get label() {
        return t('隐藏到托盘')
      },
      get hint() {
        return t('关闭后窗口隐藏，应用在托盘继续运行')
      }
    },
    {
      value: 'quit',
      get label() {
        return t('直接退出')
      },
      get hint() {
        return t('关闭窗口即完全退出应用')
      }
    }
  ]
  const updateCheckInterval = ref('1')
  const updateCheckIntervalOptions = toSelectOptions(UPDATE_CHECK_INTERVAL_OPTIONS)
  const recentToolsLimit = ref('4')
  const recentToolsLimitOptions = toSelectOptions(RECENT_TOOLS_LIMIT_OPTIONS)
  const notificationItems = NOTIFICATION_ITEMS
  const notificationChannelOptions = NOTIFICATION_CHANNEL_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.label),
    hint: t(option.hint)
  }))
  const notifications = ref(normalizeNotificationConfig())
  const clipboardLimitOptions = CLIPBOARD_HISTORY_LIMITS.map((limit) => ({
    value: String(limit),
    label: t('{p0} 条', { p0: limit })
  }))
  const clipboardSettings = normalizeClipboardHistoryConfig()
  const clipboardPersist = ref(clipboardSettings.persist)
  const clipboardMaxEntries = ref(clipboardSettings.max_entries)
  const clipboardMaxEntriesModel = computed({
    get: () => String(clipboardMaxEntries.value),
    set: (value) => {
      clipboardMaxEntries.value = Number(value)
    }
  })

  const platform = ref('')
  const editorPresets = ref([])
  const textEditorOptions = computed(() => [
    {
      value: '',
      get label() {
        return t('自定义路径')
      }
    },
    ...editorPresets.value.map((editor) => ({ value: editor.path, label: editor.name }))
  ])
  const aiProvider = ref('bailian')
  const aiApiKeys = ref({
    bailian: '',
    moonshot: '',
    zhipu: '',
    minimax: '',
    minimax_group_id: '',
    volcengine: '',
    volcengine_endpoint_id: '',
    deepseek: '',
    mimo: '',
    opencode: '',
    opencode_go: '',
    openai: '',
    google: '',
    anthropic: ''
  })
  const aiProviders = ref([])
  const aiBaseUrls = ref({})
  const savedApiKeys = ref({})
  const savedBaseUrls = ref({})
  const aiModels = ref({})
  const fallbackEnabled = ref(true)
  const fallbackModels = ref([])
  const modelConfigs = ref({})
  const initialModelConfigs = ref({})
  const modelConfigSources = ref({})
  const modelFetching = ref({})
  const modelFetchMessage = ref({})
  const modelFetchSuccess = ref({})
  const providerSaving = ref({})
  const expandedProviders = ref({})
  const pendingProviders = ref({})
  const addProviderOpen = ref(false)
  const removeProviderTarget = ref('')
  const openCustomSettings = ref({})
  const expandedModels = ref({})
  const modelDrag = ref({ type: '', enabled: false, from: -1, over: -1 })
  const databases = ref([])
  const databaseEditor = ref(normalizeDatabaseEditorConfig())
  const databaseSafeMode = ref(true)
  const databaseAuditEnabled = ref(false)
  const databaseAuditStrict = ref(false)
  const databaseOperationLogEnabled = ref(true)
  const databaseAuditRules = ref({ ...DEFAULT_SQL_AUDIT_RULES })
  const sqlAuditRules = SQL_AUDIT_RULES
  const scriptTypes = ref([])
  const shortcuts = ref(getDefaultShortcuts())
  const defaultShortcuts = getDefaultShortcuts()
  const shortcutEditor = ref({ visible: false, key: '', name: '', fallback: '' })

  function shortcutLabel(value) {
    if (!value) return ''
    return formatAccelerator(value, isMac) || value
  }

  function openShortcutEditor(key, name, fallback = '') {
    shortcutEditor.value = { visible: true, key, name, fallback: fallback || '' }
  }

  function closeShortcutEditor() {
    shortcutEditor.value = { ...shortcutEditor.value, visible: false }
  }

  function saveShortcut(accelerator) {
    const key = shortcutEditor.value.key
    if (!key || !accelerator) return
    shortcuts.value = { ...shortcuts.value, [key]: accelerator }
    closeShortcutEditor()
  }

  function clearShortcut(key) {
    shortcuts.value = { ...shortcuts.value, [key]: '' }
  }

  function canRestoreShortcut(key) {
    return !shortcuts.value[key] && Boolean(defaultShortcuts[key])
  }

  function restoreShortcut(key) {
    if (!defaultShortcuts[key]) return
    shortcuts.value = { ...shortcuts.value, [key]: defaultShortcuts[key] }
  }
  const proxyMode = ref('system')
  const proxyUrl = ref('')
  const proxyBypass = ref(DEFAULT_PROXY_BYPASS)
  const marketSources = ref({ ...DEFAULT_MARKET_SOURCES })
  const networkTestUrl = ref('https://clawhub.ai')
  const networkTesting = ref(false)
  const networkTestResult = ref(null)
  const proxyModeOptions = PROXY_MODE_OPTIONS
  const defaultUpdateFeed = UPDATE_FEED_DEFAULT_URL
  const proxyModeHint = computed(
    () => PROXY_MODE_OPTIONS.find((option) => option.value === proxyMode.value)?.hint || ''
  )
  const aiPersona = ref('')
  const aiTemperature = ref('')
  const scenarioPlanner = ref('')
  const scenarioCompression = ref('')
  const aiTimeout = ref('60')
  const aiTimeoutOptions = toSelectOptions(AI_TIMEOUT_OPTIONS)
  const aiCompressThreshold = ref('70')
  const aiCompressThresholdOptions = toSelectOptions(AI_COMPRESS_THRESHOLD_OPTIONS)
  const aiCompressKeepRecent = ref('6')
  const aiCompressKeepRecentOptions = toSelectOptions(AI_COMPRESS_KEEP_RECENT_OPTIONS)
  const aiMaxAttachments = ref('6')
  const aiMaxAttachmentOptions = toSelectOptions(AI_MAX_ATTACHMENT_OPTIONS)
  const aiMaxImageMb = ref('10')
  const aiMaxImageMbOptions = toSelectOptions(AI_MAX_IMAGE_MB_OPTIONS)
  const aiMaxTextKb = ref('256')
  const aiMaxTextKbOptions = toSelectOptions(AI_MAX_TEXT_KB_OPTIONS)
  const agentMaxIterations = ref('10')
  const agentMaxIterationsOptions = toSelectOptions(AI_AGENT_MAX_ITERATIONS_OPTIONS)
  const agentTimeoutMin = ref('5')
  const agentTimeoutMinOptions = toSelectOptions(AI_AGENT_TIMEOUT_MIN_OPTIONS)
  const agentPlanSteps = ref('8')
  const agentPlanStepsOptions = toSelectOptions(AI_AGENT_PLAN_STEPS_OPTIONS)
  const agentParallelTools = ref('4')
  const agentParallelToolsOptions = toSelectOptions(AI_AGENT_PARALLEL_TOOLS_OPTIONS)
  const toolResultMaxKb = ref('24')
  const toolResultMaxKbOptions = toSelectOptions(AI_TOOL_RESULT_MAX_KB_OPTIONS)
  const toolResultRunKb = ref('160')
  const toolResultRunKbOptions = toSelectOptions(AI_TOOL_RESULT_RUN_KB_OPTIONS)
  const toolResultRetentionDays = ref('7')
  const toolResultRetentionOptions = toSelectOptions(AI_TOOL_RESULT_RETENTION_OPTIONS)
  const aiPresets = AI_PRESETS
  const appliedPresetId = ref('')
  const databasePageSize = ref('100')
  const databasePageSizeOptions = toSelectOptions(DATABASE_PAGE_SIZE_OPTIONS)
  const databaseRefreshInterval = ref('5')
  const databaseRefreshIntervalOptions = toSelectOptions(DATABASE_REFRESH_INTERVAL_OPTIONS)
  const databaseTransferBatchSize = ref('1000')
  const databaseTransferBatchSizeOptions = toSelectOptions(DATABASE_TRANSFER_BATCH_SIZE_OPTIONS)
  const databaseHistoryLimit = ref('200')
  const databaseHistoryLimitOptions = toSelectOptions(DATABASE_HISTORY_LIMIT_OPTIONS)
  const toolPolicy = ref('all')
  const toolPolicyOptions = TOOL_POLICY_OPTIONS
  const toolPolicyHint = computed(
    () => TOOL_POLICY_OPTIONS.find((option) => option.value === toolPolicy.value)?.hint || ''
  )
  const scenarioModelOptions = computed(() =>
    aiProviders.value.flatMap((provider) =>
      (modelConfigs.value[provider.type]?.models || []).map((model) => ({
        value: `${provider.type}:${model.id}`,
        label: `${t(provider.name)} · ${model.name || model.id}`
      }))
    )
  )
  const version = ref('1.0.0')
  const author = ref('lov3smu')
  const databaseListRef = ref(null)
  const scriptTypeListRef = ref(null)
  const configDrag = ref({ list: '', enabled: false, from: -1, over: -1 })
  const showApiKey = ref({})
  const revealedApiKeys = ref({})
  const testingApiKey = ref({})
  const apiKeyTestResult = ref({})

  const year = computed(() => new Date().getFullYear())
  const visibleProviders = computed(() =>
    aiProviders.value.filter((provider) => hasProviderKey(provider.type) || pendingProviders.value[provider.type])
  )
  const addableProviders = computed(() =>
    aiProviders.value.filter((provider) => !hasProviderKey(provider.type) && !pendingProviders.value[provider.type])
  )
  const chatModelOptions = computed(() =>
    visibleProviders.value.flatMap((provider) =>
      (modelConfigs.value[provider.type]?.models || [])
        .filter((model) => model.id)
        .map((model) => ({
          value: `${provider.type}:${model.id}`,
          label: `${t(provider.name)} · ${model.name || model.id}`
        }))
    )
  )
  const fallbackModelOptions = computed(() => {
    const options = [...chatModelOptions.value]
    const seen = new Set(options.map((option) => option.value))
    for (const entry of fallbackModels.value) {
      const value = String(entry || '').trim()
      if (!value || seen.has(value)) continue
      seen.add(value)
      options.push({ value, label: value })
    }
    return options
  })
  const aiProviderModel = computed({
    get() {
      const config = modelConfigs.value[aiProvider.value]
      if (!config) return ''
      const model = config.default || config.models?.[0]?.id || ''
      return model ? `${aiProvider.value}:${model}` : ''
    },
    set(value) {
      const parsed = parseScenarioModel(value)
      if (!parsed) return
      const config = modelConfigs.value[parsed.provider]
      if (!config || !config.models.some((model) => model.id === parsed.model)) return
      aiProvider.value = parsed.provider
      config.default = parsed.model
    }
  })
  const removeProviderMessage = computed(() => {
    const type = removeProviderTarget.value
    if (!type) return ''
    const provider = aiProviders.value.find((item) => item.type === type)
    const name = providerName(type)
    if (pendingProviders.value[type] && !hasProviderKey(type)) {
      return t('「{name}」尚未保存，移除后不会写入配置。', { name })
    }
    if (provider?.hasEnvKey && !(savedApiKeys.value[type] || '').trim()) {
      return t('「{name}」的密钥来自环境变量 {envKey}，无法移除；确认后将丢弃未保存的修改，服务商仍会显示在列表中。', {
        name,
        envKey: provider.envKey
      })
    }
    if (provider?.hasEnvKey) {
      return t(
        '将删除「{name}」已保存的 API 密钥、自定义地址与模型目录，并移除引用它的备用模型；检测到环境变量 {envKey}，之后仍会使用环境变量中的密钥。',
        { name, envKey: provider.envKey }
      )
    }
    return t('将立即删除「{name}」的 API 密钥、自定义地址与模型目录，并移除引用它的备用模型。', { name })
  })

  function normalizeModelList(models) {
    return (Array.isArray(models) ? models : [])
      .map((model) => {
        const id = String(model?.id || '').trim()
        if (!id) return null
        const name = String(model?.name || id).trim() || id
        const normalized = { id, name }
        const contextWindow = Number(model?.contextWindow)
        if (Number.isFinite(contextWindow) && contextWindow > 0) {
          normalized.contextWindow = Math.floor(contextWindow)
        }
        const maxOutput = Number(model?.maxOutput)
        if (Number.isFinite(maxOutput) && maxOutput > 0) {
          normalized.maxOutput = Math.floor(maxOutput)
        }
        const inputTypes = Array.isArray(model?.inputTypes)
          ? [...new Set(model.inputTypes.filter((item) => item === 'text' || item === 'image'))]
          : ['text', 'image']
        normalized.inputTypes = inputTypes.length > 0 ? inputTypes : ['text']
        return normalized
      })
      .filter(Boolean)
  }

  function isSameModelConfig(a, b) {
    if (!a || !b) return false
    return (
      JSON.stringify({ default: a.default || '', models: normalizeModelList(a.models) }) ===
      JSON.stringify({ default: b.default || '', models: normalizeModelList(b.models) })
    )
  }

  function cloneModelConfig(config) {
    return {
      default: config.default,
      models: config.models.map((model) => ({
        ...model,
        inputTypes: [...(model.inputTypes || [])]
      }))
    }
  }

  function createProviderModelConfig(provider) {
    const saved = aiModels.value[provider.type]
    if (saved && Array.isArray(saved.models) && saved.models.length > 0) {
      const config = {
        default: saved.default || saved.models[0].id,
        models: normalizeModelList(saved.models)
      }
      return { config, initial: cloneModelConfig(config), source: 'config' }
    }

    const models = normalizeModelList(provider.models)
    const config = {
      default: models.some((model) => model.id === provider.defaultModel) ? provider.defaultModel : models[0]?.id || '',
      models
    }
    return { config, initial: cloneModelConfig(config), source: 'builtin' }
  }

  function initModelConfigs(providers) {
    const configs = {}
    const initial = {}
    const sources = {}
    for (const provider of providers) {
      const { config, initial: saved, source } = createProviderModelConfig(provider)
      configs[provider.type] = config
      initial[provider.type] = saved
      sources[provider.type] = source
    }
    modelConfigs.value = configs
    initialModelConfigs.value = initial
    modelConfigSources.value = sources
  }

  function serializeProviderModels(type) {
    const config = modelConfigs.value[type]
    if (!config || config.models.length === 0) return null
    const source = modelConfigSources.value[type]
    const changed = !isSameModelConfig(config, initialModelConfigs.value[type])
    if (source === 'builtin' && !changed) return null
    return {
      default: config.default || config.models[0]?.id || '',
      models: normalizeModelList(config.models)
    }
  }

  function hasStoredApiKey(type) {
    return Boolean((aiApiKeys.value[type] || '').trim())
  }

  function isValidBaseUrl(value) {
    const trimmed = String(value || '').trim()
    if (!trimmed) return true
    try {
      const url = new URL(trimmed)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  }

  function providerName(type) {
    const found = aiProviders.value.find((provider) => provider.type === type)?.name
    return found ? t(found) : type
  }

  function hasProviderKey(type) {
    const provider = aiProviders.value.find((item) => item.type === type)
    if (provider?.requiresApiKey === false) return Boolean(provider.hasApiKey)
    if ((savedApiKeys.value[type] || '').trim()) return true
    return Boolean(provider?.hasApiKey || provider?.hasEnvKey)
  }

  function addProvider(provider) {
    pendingProviders.value = { ...pendingProviders.value, [provider.type]: true }
    expandedProviders.value = { ...expandedProviders.value, [provider.type]: true }
    if (!aiProvider.value || !hasProviderKey(aiProvider.value)) aiProvider.value = provider.type
    addProviderOpen.value = false
  }

  function requestRemoveProvider(provider) {
    removeProviderTarget.value = provider.type
  }

  function clearProviderState(type) {
    // 只丢弃待添加与展开状态；模型配置保留，避免服务商以环境变量密钥重新出现时卡片因缺少配置而报错
    const nextPending = { ...pendingProviders.value }
    delete nextPending[type]
    pendingProviders.value = nextPending
    const nextExpanded = { ...expandedProviders.value }
    delete nextExpanded[type]
    expandedProviders.value = nextExpanded
  }

  async function confirmRemoveProvider() {
    const type = removeProviderTarget.value
    removeProviderTarget.value = ''
    if (!type) return
    const provider = aiProviders.value.find((item) => item.type === type)
    if (!provider) return

    const hasStoredKey = Boolean((savedApiKeys.value[type] || '').trim())
    if (!hasStoredKey && provider.requiresApiKey !== false) {
      // 未保存的草稿或仅靠环境变量提供密钥：不删除持久化配置，仅还原卡片状态
      cancelProviderCard(provider)
      return
    }

    // patchConfig 对对象做深合并，delete 不会清除已存字段，必须用空值覆盖再由归一化丢弃
    const nextApiKeys = { ...savedApiKeys.value, [type]: '' }
    const nextBaseUrls = { ...savedBaseUrls.value, [type]: '' }
    const nextModels = { ...aiModels.value, [type]: { default: '', models: [] } }
    const nextFallbackModels = fallbackModels.value
      .map((entry) => String(entry || '').trim())
      .filter((entry) => entry && parseScenarioModel(entry)?.provider !== type)

    let nextAiProvider = aiProvider.value
    if (nextAiProvider === type) {
      nextAiProvider =
        aiProviders.value.find(
          (item) => item.type !== type && (nextApiKeys[item.type] || item.hasApiKey || item.hasEnvKey)
        )?.type || ''
    }

    providerSaving.value = { ...providerSaving.value, [type]: true }
    try {
      const success = await patchConfig({
        ai: {
          provider: nextAiProvider,
          keys: nextApiKeys,
          base_urls: nextBaseUrls,
          models: nextModels,
          fallback: {
            models: nextFallbackModels
          }
        }
      })
      if (!success) {
        showError(t('移除失败，请检查配置'))
        return
      }

      const nextDraftKeys = { ...aiApiKeys.value }
      delete nextDraftKeys[type]
      aiApiKeys.value = nextDraftKeys
      resetApiKeyVisibility(type)
      const nextDraftBaseUrls = { ...aiBaseUrls.value }
      delete nextDraftBaseUrls[type]
      aiBaseUrls.value = nextDraftBaseUrls
      savedApiKeys.value = nextApiKeys
      savedBaseUrls.value = nextBaseUrls
      aiModels.value = nextModels
      aiProvider.value = nextAiProvider
      fallbackModels.value = nextFallbackModels
      clearProviderState(type)
      await reloadConfig()

      const providers = await getAiProviders()
      if (Array.isArray(providers) && providers.length > 0) aiProviders.value = providers
      showSuccess(t('{name} 已移除', { name: t(provider.name) }))
    } catch (e) {
      showError(t('移除失败: {error}', { error: e.message }))
    } finally {
      providerSaving.value = { ...providerSaving.value, [type]: false }
    }
  }

  function isProviderExpanded(type) {
    return Boolean(expandedProviders.value[type])
  }

  function toggleProviderExpanded(type) {
    expandedProviders.value = { ...expandedProviders.value, [type]: !expandedProviders.value[type] }
  }

  function isCustomSettingsOpen(type) {
    return Boolean(openCustomSettings.value[type])
  }

  function toggleCustomSettings(type) {
    openCustomSettings.value = { ...openCustomSettings.value, [type]: !openCustomSettings.value[type] }
  }

  function defaultContextWindow(provider) {
    return Number(provider?.models?.[0]?.contextWindow) || 131072
  }

  function modelDefaultOptions(type) {
    const config = modelConfigs.value[type]
    if (!config) return []
    return config.models
      .filter((model) => model.id)
      .map((model) => ({ value: model.id, label: model.name || model.id }))
  }

  function addFallbackModel() {
    if (fallbackModels.value.length >= 5) return
    fallbackModels.value = [...fallbackModels.value, '']
  }

  function removeFallbackModel(index) {
    fallbackModels.value = fallbackModels.value.filter((_, itemIndex) => itemIndex !== index)
  }

  function modelSourceHint(type) {
    const source = modelConfigSources.value[type]
    if (source === 'config') return t('正在使用已保存的模型目录')
    if (source === 'custom') return t('正在使用在线获取的模型目录')
    return t('未自定义模型，正在使用服务商内置模型目录')
  }

  function modelExpandedKey(type, index) {
    return `${type}:${index}`
  }

  function clearExpandedModels(type) {
    const next = {}
    for (const [key, value] of Object.entries(expandedModels.value)) {
      if (!key.startsWith(`${type}:`)) next[key] = value
    }
    expandedModels.value = next
  }

  function isModelExpanded(type, index) {
    return Boolean(expandedModels.value[modelExpandedKey(type, index)])
  }

  function toggleModelExpanded(type, index) {
    const key = modelExpandedKey(type, index)
    expandedModels.value = { ...expandedModels.value, [key]: !expandedModels.value[key] }
  }

  function currentInputTypes(model) {
    if (!Array.isArray(model.inputTypes) || model.inputTypes.length === 0) return ['text', 'image']
    return model.inputTypes
  }

  function hasInputType(model, type) {
    return currentInputTypes(model).includes(type)
  }

  function toggleInputType(model, type) {
    const types = currentInputTypes(model)
    const next = types.includes(type) ? types.filter((item) => item !== type) : [...types, type]
    model.inputTypes = next.length > 0 ? next : ['text']
  }

  function isModelDragEnabled(type) {
    return modelDrag.value.enabled && modelDrag.value.type === type
  }

  function isModelDragging(type, index) {
    return modelDrag.value.type === type && modelDrag.value.from === index
  }

  function isModelDragOver(type, index) {
    const state = modelDrag.value
    return state.type === type && state.from >= 0 && state.over === index && state.from !== index
  }

  function enableModelDrag(type) {
    modelDrag.value.type = type
    modelDrag.value.enabled = true
  }

  function startModelDrag(type, index, event) {
    if (!isModelDragEnabled(type)) {
      event.preventDefault()
      return
    }
    modelDrag.value.from = index
    modelDrag.value.over = index
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
    }
  }

  function overModelDrag(type, index) {
    if (modelDrag.value.type !== type || modelDrag.value.from < 0) return
    modelDrag.value.over = index
  }

  function dropModelDrag(type) {
    const state = modelDrag.value
    const config = modelConfigs.value[type]
    if (!config || state.type !== type || state.from < 0) return
    if (state.over >= 0 && state.over < config.models.length && state.from !== state.over) {
      const [moved] = config.models.splice(state.from, 1)
      config.models.splice(state.over, 0, moved)

      const nextExpanded = {}
      for (const [key, value] of Object.entries(expandedModels.value)) {
        const [keyType, keyIndex] = key.split(':')
        if (keyType !== type) {
          nextExpanded[key] = value
          continue
        }
        let index = Number(keyIndex)
        if (index === state.from) {
          index = state.over
        } else if (state.from < state.over && index > state.from && index <= state.over) {
          index -= 1
        } else if (state.from > state.over && index >= state.over && index < state.from) {
          index += 1
        }
        nextExpanded[modelExpandedKey(type, index)] = value
      }
      expandedModels.value = nextExpanded
    }
    endModelDrag(type)
  }

  function endModelDrag(type) {
    if (modelDrag.value.type !== type) return
    modelDrag.value = { type: '', enabled: false, from: -1, over: -1 }
  }

  function resetApiKeyVisibility(type) {
    const nextShow = { ...showApiKey.value }
    delete nextShow[type]
    showApiKey.value = nextShow
    const nextRevealed = { ...revealedApiKeys.value }
    delete nextRevealed[type]
    revealedApiKeys.value = nextRevealed
  }

  async function toggleShowApiKey(type) {
    if (showApiKey.value[type]) {
      const revealed = revealedApiKeys.value[type]
      if (revealed !== undefined && (aiApiKeys.value[type] || '') === revealed) {
        aiApiKeys.value = { ...aiApiKeys.value, [type]: SECRET_MASK }
      }
      resetApiKeyVisibility(type)
      return
    }

    const current = (aiApiKeys.value[type] || '').trim()
    if (isSecretMask(current)) {
      const plain = await getAiApiKey(type)
      if (plain) {
        revealedApiKeys.value = { ...revealedApiKeys.value, [type]: plain }
        aiApiKeys.value = { ...aiApiKeys.value, [type]: plain }
      }
    }
    showApiKey.value = { ...showApiKey.value, [type]: true }
  }

  onMounted(async () => {
    removeSettingsTabListener = onSettingsTab((tab) => {
      const resolved = resolveTabId(tab)
      if (!menuItems.some((item) => item.id === resolved)) return
      void flushAutoSave(false, autoSaveKind())
      tabHistory.value = []
      tabForwardHistory.value = []
      activeTab.value = resolved
    })

    platform.value = navigator.platform.toLowerCase()

    if (platform.value.includes('win')) {
      editorPresets.value = [
        { name: 'VS Code', path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe' },
        { name: 'Notepad++', path: 'C:\\Program Files\\Notepad++\\notepad++.exe' },
        { name: 'Sublime Text', path: 'C:\\Program Files\\Sublime Text\\sublime_text.exe' },
        {
          get name() {
            return t('记事本')
          },
          path: 'C:\\Windows\\System32\\notepad.exe'
        }
      ]
    } else if (platform.value.includes('mac')) {
      editorPresets.value = [
        { name: 'VS Code', path: '/Applications/Visual Studio Code.app' },
        { name: 'Sublime Text', path: '/Applications/Sublime Text.app' },
        { name: 'TextEdit', path: '/Applications/TextEdit.app' },
        { name: 'Vim', path: '/usr/bin/vim' }
      ]
    } else {
      editorPresets.value = [
        { name: 'VS Code', path: '/usr/bin/code' },
        { name: 'Sublime Text', path: '/usr/bin/subl' },
        { name: 'Vim', path: '/usr/bin/vim' },
        { name: 'Nano', path: '/usr/bin/nano' },
        { name: 'Gedit', path: '/usr/bin/gedit' }
      ]
    }

    const tabParam = route.query.tab
    const initialTab = resolveTabId(typeof tabParam === 'string' ? tabParam : '')
    if (initialTab && menuItems.some((item) => item.id === initialTab)) {
      activeTab.value = initialTab
    }

    const config = await getConfig()
    basePath.value = config.sql_generator.base_path || ''
    developerChName.value = config.sql_generator.developer.ch_name || ''
    developerEnName.value = config.sql_generator.developer.en_name || ''
    textEditApp.value = config.sql_generator.text_edit_app || ''
    void loadManagedProfileInfo()
    void loadSyncInfo()
    autoUpdate.value = config.update.auto_update !== false
    autoStart.value = config.app.auto_start === true
    databaseSafeMode.value = config.database.safe_mode !== false
    databaseAuditEnabled.value = config.database.audit.enabled === true
    databaseAuditStrict.value = config.database.audit.strict === true
    databaseOperationLogEnabled.value = config.database.operation_log_enabled !== false
    databaseAuditRules.value = { ...DEFAULT_SQL_AUDIT_RULES, ...(config.database.audit.rules || {}) }
    closeAction.value = config.app.close_action || 'ask'
    updateCheckInterval.value = String(normalizeUpdateCheckInterval(config.update.check_interval))
    recentToolsLimit.value = String(normalizeRecentToolsLimit(config.app.recent_tools_limit))
    notifications.value = normalizeNotificationConfig(config.notifications)
    const clipboardConfig = normalizeClipboardHistoryConfig(config.clipboard_history)
    clipboardPersist.value = clipboardConfig.persist
    clipboardMaxEntries.value = clipboardConfig.max_entries
    theme.value = config.appearance.theme || getThemePreference()
    applyTheme(theme.value)
    themeStyle.value = normalizeThemeStyle(config.appearance.theme_style || getThemeStylePreference())
    applyThemeStyle(themeStyle.value)
    fontSize.value = normalizeFontSizePreference(config.appearance.font_size || getFontSizePreference())
    applyFontSize(fontSize.value)
    language.value = config.appearance.language || DEFAULT_LOCALE
    setLocale(language.value)
    aiProvider.value = config.ai.provider || 'bailian'
    aiApiKeys.value = { ...aiApiKeys.value, ...(config.ai.keys || {}) }
    aiBaseUrls.value = { ...(config.ai.base_urls || {}) }
    savedApiKeys.value = { ...aiApiKeys.value }
    savedBaseUrls.value = { ...aiBaseUrls.value }
    aiModels.value = config.ai.models && typeof config.ai.models === 'object' ? config.ai.models : {}
    fallbackEnabled.value = config.ai.fallback.enabled !== false
    fallbackModels.value = Array.isArray(config.ai.fallback.models) ? [...config.ai.fallback.models] : []
    databases.value = (config.sql_generator.databases || []).map((name) => ({ name, error: false }))
    databaseEditor.value = normalizeDatabaseEditorConfig(config.database.editor)
    scriptTypes.value = (config.sql_generator.script_types || []).map((st) => ({
      name: st.name,
      description: st.description || '',
      error: false
    }))

    if (config.app.shortcuts) {
      shortcuts.value = { ...shortcuts.value, ...config.app.shortcuts }
    }

    const proxy = config.network?.proxy || {}
    proxyMode.value = proxy.mode || 'system'
    proxyUrl.value = proxy.url || ''
    proxyBypass.value = proxy.bypass || DEFAULT_PROXY_BYPASS
    marketSources.value = { ...DEFAULT_MARKET_SOURCES, ...(config.network.market_sources || {}) }
    aiPersona.value = typeof config.ai.persona === 'string' ? config.ai.persona : ''
    aiTemperature.value =
      config.ai.temperature === null || config.ai.temperature === undefined ? '' : String(config.ai.temperature)
    const scenarioModels = config.ai.agent.scenario_models || {}
    scenarioPlanner.value = typeof scenarioModels.planner === 'string' ? scenarioModels.planner : ''
    scenarioCompression.value = typeof scenarioModels.compression === 'string' ? scenarioModels.compression : ''
    toolPolicy.value = normalizeToolPolicy(config.ai.agent.tool_policy)
    aiTimeout.value = String(normalizeAiTimeout(config.ai.timeout))
    aiCompressThreshold.value = String(normalizeAiCompressThreshold(config.ai.context.compress_threshold))
    aiCompressKeepRecent.value = String(normalizeAiCompressKeepRecent(config.ai.context.keep_recent))
    aiMaxAttachments.value = String(normalizeAiMaxAttachments(config.ai.attachments.max_count))
    aiMaxImageMb.value = String(normalizeAiMaxImageMb(config.ai.attachments.max_image_mb))
    aiMaxTextKb.value = String(normalizeAiMaxTextKb(config.ai.attachments.max_text_kb))
    agentMaxIterations.value = String(normalizeAiAgentMaxIterations(config.ai.agent.max_iterations))
    agentTimeoutMin.value = String(normalizeAiAgentTimeoutMin(config.ai.agent.timeout_min))
    agentPlanSteps.value = String(normalizeAiAgentPlanSteps(config.ai.agent.max_plan_steps))
    agentParallelTools.value = String(normalizeAiAgentParallelTools(config.ai.agent.max_parallel_tools))
    toolResultMaxKb.value = String(normalizeAiToolResultMaxKb(config.ai.tool_result.max_kb))
    toolResultRunKb.value = String(normalizeAiToolResultRunKb(config.ai.tool_result.run_kb))
    toolResultRetentionDays.value = String(normalizeAiToolResultRetentionDays(config.ai.tool_result.retention_days))
    databasePageSize.value = String(normalizeDatabasePageSize(config.database.page_size))
    databaseRefreshInterval.value = String(normalizeDatabaseRefreshInterval(config.database.refresh_interval))
    databaseTransferBatchSize.value = String(normalizeDatabaseTransferBatchSize(config.database.transfer_batch_size))
    databaseHistoryLimit.value = String(normalizeDatabaseHistoryLimit(config.database.history_limit))

    const providers = await getAiProviders()
    aiProviders.value = providers || []
    initModelConfigs(aiProviders.value)
    if (!visibleProviders.value.some((provider) => provider.type === aiProvider.value)) {
      aiProvider.value = visibleProviders.value[0]?.type || ''
    }
    expandedProviders.value = {}
    openCustomSettings.value = Object.fromEntries(
      aiProviders.value.map((provider) => [provider.type, Boolean((aiBaseUrls.value[provider.type] || '').trim())])
    )

    const packageJson = await getPackageInfo()
    if (packageJson.version) version.value = packageJson.version
    if (packageJson.author) {
      let a = packageJson.author
      a = a.replace(/<[^>]*>/g, '').trim()
      author.value = a
    }

    lastAutoStart = autoStart.value
    seedAutoSaveStates(AUTO_SAVE_KINDS)
    markAutoSaveReady()
  })

  onUnmounted(() => {
    removeSettingsTabListener?.()
    void flushAutoSave(false, autoSaveKind())
  })

  function selectTheme(value) {
    theme.value = value
    applyTheme(value)
  }

  function selectThemeStyle(value) {
    themeStyle.value = normalizeThemeStyle(value)
    applyThemeStyle(themeStyle.value)
  }

  function selectFontSize(value) {
    fontSize.value = normalizeFontSizePreference(value)
    applyFontSize(fontSize.value)
  }

  function isDragEnabled(list) {
    return configDrag.value.enabled && configDrag.value.list === list
  }

  function isDragging(list, index) {
    return configDrag.value.list === list && configDrag.value.from === index
  }

  function isDragOver(list, index) {
    const state = configDrag.value
    return state.list === list && state.from >= 0 && state.over === index && state.from !== index
  }

  function enableConfigDrag(list) {
    configDrag.value.list = list
    configDrag.value.enabled = true
  }

  function startConfigDrag(list, index, event) {
    if (!isDragEnabled(list)) {
      event.preventDefault()
      return
    }
    configDrag.value.from = index
    configDrag.value.over = index
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', String(index))
    }
  }

  function overConfigDrag(list, index) {
    if (configDrag.value.list !== list || configDrag.value.from < 0) return
    configDrag.value.over = index
  }

  function dropConfigDrag(list) {
    const state = configDrag.value
    if (state.list !== list || state.from < 0) return
    const items = list === 'database' ? databases.value : scriptTypes.value
    if (state.over >= 0 && state.over < items.length && state.from !== state.over) {
      const [moved] = items.splice(state.from, 1)
      items.splice(state.over, 0, moved)
    }
    endConfigDrag(list)
  }

  function endConfigDrag(list) {
    if (configDrag.value.list !== list) return
    configDrag.value = { list: '', enabled: false, from: -1, over: -1 }
  }

  async function addDatabase() {
    databases.value.push({ name: '', error: false })
    await nextTick()
    if (databaseListRef.value) {
      const items = databaseListRef.value.querySelectorAll('.config-item')
      const lastItem = items[items.length - 1]
      if (lastItem) {
        lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        const input = lastItem.querySelector('input')
        if (input) input.focus()
      }
    }
  }

  function removeDatabase(index) {
    databases.value.splice(index, 1)
  }

  async function addScriptType() {
    scriptTypes.value.push({ name: '', description: '', error: false })
    await nextTick()
    if (scriptTypeListRef.value) {
      const items = scriptTypeListRef.value.querySelectorAll('.config-item')
      const lastItem = items[items.length - 1]
      if (lastItem) {
        lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        const input = lastItem.querySelector('input')
        if (input) input.focus()
      }
    }
  }

  function removeScriptType(index) {
    scriptTypes.value.splice(index, 1)
  }

  async function selectDir() {
    const path = await selectDirectory()
    if (path) basePath.value = path
  }

  async function selectEditor() {
    const path = await selectFile()
    if (path) textEditApp.value = path
  }

  function getSqlGroupError() {
    databases.value.forEach((db) => (db.error = false))
    scriptTypes.value.forEach((st) => (st.error = false))

    const dbNames = []
    for (const db of databases.value) {
      const name = db.name.trim()
      if (!name) {
        db.error = true
        return t('数据库名称不能为空')
      }
      if (dbNames.includes(name)) {
        db.error = true
        return t('数据库名称 "{name}" 重复', { name })
      }
      dbNames.push(name)
    }

    const typeNames = []
    for (const st of scriptTypes.value) {
      const name = st.name.trim()
      if (!name) {
        st.error = true
        return t('脚本类型名称不能为空')
      }
      if (typeNames.includes(name)) {
        st.error = true
        return t('脚本类型名称 "{name}" 重复', { name })
      }
      typeNames.push(name)
    }

    return ''
  }

  function normalizedFallbackModels() {
    return fallbackModels.value.map((entry) => String(entry || '').trim()).filter(Boolean)
  }

  function getModelGroupError() {
    const entries = normalizedFallbackModels()
    if (entries.length > 5) return t('备用模型最多配置 5 个')
    const seen = new Set()
    for (const entry of entries) {
      const parsed = parseScenarioModel(entry)
      if (!parsed) return t('备用模型格式无效：{entry}（应为 provider:model）', { entry })
      if (!aiProviders.value.some((provider) => provider.type === parsed.provider)) {
        return t('备用模型包含未知服务商：{provider}', { provider: parsed.provider })
      }
      if (seen.has(entry)) return t('备用模型重复：{entry}', { entry })
      seen.add(entry)
    }
    return ''
  }

  function getAssistantGroupError() {
    if (scenarioPlanner.value.trim() && !parseScenarioModel(scenarioPlanner.value.trim())) {
      return t('任务规划模型格式无效（应为 provider:model）')
    }
    if (scenarioCompression.value.trim() && !parseScenarioModel(scenarioCompression.value.trim())) {
      return t('上下文压缩模型格式无效（应为 provider:model）')
    }
    if (aiTemperature.value !== '') {
      const temperature = Number(aiTemperature.value)
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
        return t('温度必须在 0 到 2 之间，或留空使用默认值')
      }
    }
    return ''
  }

  function getNetworkGroupError() {
    if (proxyMode.value === 'manual') {
      if (!proxyUrl.value.trim()) return t('手动代理模式需要填写代理地址')
      if (!isProxyUrl(proxyUrl.value.trim())) {
        return t('代理地址必须是有效的 http:// 、https:// 或 socks5:// 地址')
      }
    }
    for (const [key, label] of [
      ['clawhub', t('ClawHub 地址')],
      ['mcp_registry', t('MCP 类型注册表')],
      ['update_feed', t('更新源')]
    ]) {
      const value = String(marketSources.value[key] || '').trim()
      if (value && !isHttpUrl(value)) return t('{label} 必须是有效的 http(s) 地址', { label: t(label) })
    }
    return ''
  }

  function getAutoSaveError(kind) {
    if (kind === 'sql') return getSqlGroupError()
    if (kind === 'model') return getModelGroupError()
    if (kind === 'assistant') return getAssistantGroupError()
    if (kind === 'network') return getNetworkGroupError()
    return ''
  }

  function buildAutoSavePayload(kind) {
    if (kind === 'general') {
      return {
        app: {
          auto_start: autoStart.value,
          close_action: closeAction.value,
          recent_tools_limit: normalizeRecentToolsLimit(recentToolsLimit.value)
        },
        update: {
          auto_update: autoUpdate.value,
          check_interval: normalizeUpdateCheckInterval(updateCheckInterval.value)
        },
        appearance: {
          theme: theme.value,
          theme_style: themeStyle.value,
          font_size: fontSize.value,
          language: language.value
        },
        notifications: { ...notifications.value },
        clipboard_history: {
          persist: clipboardPersist.value,
          max_entries: Number(clipboardMaxEntries.value)
        }
      }
    }
    if (kind === 'model') {
      return {
        ai: {
          provider: aiProvider.value,
          timeout: normalizeAiTimeout(aiTimeout.value),
          fallback: {
            enabled: fallbackEnabled.value,
            models: normalizedFallbackModels()
          }
        }
      }
    }
    if (kind === 'assistant') {
      return {
        ai: {
          persona: aiPersona.value.trim(),
          temperature: aiTemperature.value === '' ? null : Number(aiTemperature.value),
          context: {
            compress_threshold: normalizeAiCompressThreshold(aiCompressThreshold.value),
            keep_recent: normalizeAiCompressKeepRecent(aiCompressKeepRecent.value)
          },
          attachments: {
            max_count: normalizeAiMaxAttachments(aiMaxAttachments.value),
            max_image_mb: normalizeAiMaxImageMb(aiMaxImageMb.value),
            max_text_kb: normalizeAiMaxTextKb(aiMaxTextKb.value)
          },
          agent: {
            max_iterations: normalizeAiAgentMaxIterations(agentMaxIterations.value),
            timeout_min: normalizeAiAgentTimeoutMin(agentTimeoutMin.value),
            max_plan_steps: normalizeAiAgentPlanSteps(agentPlanSteps.value),
            max_parallel_tools: normalizeAiAgentParallelTools(agentParallelTools.value),
            scenario_models: {
              planner: scenarioPlanner.value.trim(),
              compression: scenarioCompression.value.trim()
            },
            tool_policy: normalizeToolPolicy(toolPolicy.value)
          },
          tool_result: {
            max_kb: normalizeAiToolResultMaxKb(toolResultMaxKb.value),
            run_kb: normalizeAiToolResultRunKb(toolResultRunKb.value),
            retention_days: normalizeAiToolResultRetentionDays(toolResultRetentionDays.value)
          }
        }
      }
    }
    if (kind === 'database') {
      return {
        database: {
          safe_mode: databaseSafeMode.value,
          audit: {
            enabled: databaseAuditEnabled.value,
            strict: databaseAuditStrict.value,
            rules: { ...databaseAuditRules.value }
          },
          operation_log_enabled: databaseOperationLogEnabled.value,
          page_size: normalizeDatabasePageSize(databasePageSize.value),
          refresh_interval: normalizeDatabaseRefreshInterval(databaseRefreshInterval.value),
          transfer_batch_size: normalizeDatabaseTransferBatchSize(databaseTransferBatchSize.value),
          history_limit: normalizeDatabaseHistoryLimit(databaseHistoryLimit.value),
          editor: { ...databaseEditor.value }
        }
      }
    }
    if (kind === 'sql') {
      return {
        sql_generator: {
          base_path: basePath.value,
          developer: {
            ch_name: developerChName.value,
            en_name: developerEnName.value
          },
          text_edit_app: textEditApp.value,
          databases: databases.value.map((db) => db.name.trim()).filter(Boolean),
          script_types: scriptTypes.value
            .map((st) => ({
              name: st.name.trim(),
              description: st.description.trim()
            }))
            .filter((st) => st.name)
        }
      }
    }
    if (kind === 'network') {
      return {
        network: {
          proxy: {
            mode: proxyMode.value,
            url: proxyUrl.value.trim(),
            bypass: proxyBypass.value.trim() || DEFAULT_PROXY_BYPASS
          },
          market_sources: {
            clawhub: marketSources.value.clawhub.trim(),
            mcp_registry: marketSources.value.mcp_registry.trim(),
            update_feed: marketSources.value.update_feed.trim()
          }
        }
      }
    }
    if (kind === 'shortcuts') {
      return { app: { shortcuts: { ...shortcuts.value } } }
    }
    return null
  }

  let lastAutoStart = null
  let lastChatModelState = ''

  const AUTO_SAVE_KINDS = ['general', 'model', 'assistant', 'database', 'sql', 'network', 'shortcuts']
  const AUTO_SAVE_KIND_BY_TAB = {
    general: 'general',
    appearance: 'general',
    api: 'model',
    assistant: 'assistant',
    network: 'network',
    'database-client': 'database',
    'sql-generator': 'sql',
    shortcuts: 'shortcuts'
  }

  function autoSaveKind() {
    return AUTO_SAVE_KIND_BY_TAB[activeTab.value] || ''
  }

  const {
    schedule: scheduleAutoSave,
    flush: flushAutoSave,
    onFocusOut: onSettingsFocusOut,
    enqueue: enqueueAutoSave,
    markReady: markAutoSaveReady,
    isReady: isAutoSaveReady,
    seedSavedStates: seedAutoSaveStates,
    rememberSaved: rememberAutoSaveState
  } = useAutoSaveConfig({
    getKind: autoSaveKind,
    buildPayload: buildAutoSavePayload,
    getError: getAutoSaveError,
    save: patchConfig,
    showError,
    onSaved: async (kind, payload) => {
      if (kind === 'general' && payload.app.auto_start !== lastAutoStart) {
        lastAutoStart = payload.app.auto_start
        await setAutoStart(payload.app.auto_start)
      }
      if (kind === 'shortcuts') await reloadMenu()
    }
  })

  async function persistChatModelSelection() {
    if (!isAutoSaveReady()) return
    await enqueueAutoSave(async () => {
      const value = aiProviderModel.value
      const parsed = parseScenarioModel(value)
      if (!parsed) return
      const config = modelConfigs.value[parsed.provider]
      if (!config) return
      const models = normalizeModelList(config.models)
      if (!models.some((model) => model.id === parsed.model)) return
      const stateKey = JSON.stringify([parsed.provider, parsed.model, models.map((model) => model.id)])
      if (lastChatModelState === stateKey) return

      const nextConfig = { default: parsed.model, models }
      const nextModels = { ...aiModels.value, [parsed.provider]: nextConfig }
      try {
        const success = await patchConfig({ ai: { provider: parsed.provider, models: nextModels } })
        if (!success) return
        aiModels.value = nextModels
        initialModelConfigs.value = {
          ...initialModelConfigs.value,
          [parsed.provider]: cloneModelConfig(nextConfig)
        }
        modelConfigSources.value = { ...modelConfigSources.value, [parsed.provider]: 'config' }
        lastChatModelState = stateKey
        rememberAutoSaveState('model')
      } catch (e) {
        showError(t('保存失败: {error}', { error: e.message }))
      }
    })
  }

  const autoSaveSignature = computed(() =>
    JSON.stringify([
      autoUpdate.value,
      autoStart.value,
      closeAction.value,
      updateCheckInterval.value,
      recentToolsLimit.value,
      notifications.value,
      clipboardPersist.value,
      clipboardMaxEntries.value,
      theme.value,
      themeStyle.value,
      fontSize.value,
      language.value,
      aiTimeout.value,
      fallbackEnabled.value,
      fallbackModels.value,
      aiPersona.value,
      aiTemperature.value,
      scenarioPlanner.value,
      scenarioCompression.value,
      aiCompressThreshold.value,
      aiCompressKeepRecent.value,
      aiMaxAttachments.value,
      aiMaxImageMb.value,
      aiMaxTextKb.value,
      agentMaxIterations.value,
      agentTimeoutMin.value,
      agentPlanSteps.value,
      agentParallelTools.value,
      toolResultMaxKb.value,
      toolResultRunKb.value,
      toolResultRetentionDays.value,
      toolPolicy.value,
      databasePageSize.value,
      databaseRefreshInterval.value,
      databaseTransferBatchSize.value,
      databaseHistoryLimit.value,
      databaseSafeMode.value,
      databaseAuditEnabled.value,
      databaseAuditStrict.value,
      databaseOperationLogEnabled.value,
      databaseAuditRules.value,
      databaseEditor.value,
      basePath.value,
      developerChName.value,
      developerEnName.value,
      textEditApp.value,
      databases.value,
      scriptTypes.value,
      proxyMode.value,
      proxyUrl.value,
      proxyBypass.value,
      marketSources.value,
      shortcuts.value
    ])
  )

  watch(language, (value) => setLocale(value))
  watch(autoSaveSignature, () => scheduleAutoSave())
  watch(aiProviderModel, () => {
    void persistChatModelSelection()
  })

  async function runNetworkTest() {
    const saved = await flushAutoSave(true, 'network')
    if (!saved) return
    const url = networkTestUrl.value.trim()
    if (!isHttpUrl(url)) {
      showError(t('请输入有效的 http(s) 地址'))
      return
    }
    networkTesting.value = true
    networkTestResult.value = null
    try {
      const result = await networkTest(url)
      networkTestResult.value = result.ok
        ? {
            ok: true,
            message: t('连接成功（HTTP {status}，{elapsed}ms）', { status: result.status, elapsed: result.elapsedMs })
          }
        : {
            ok: false,
            message: result.error || t('请求失败（HTTP {status}）', { status: result.status })
          }
    } finally {
      networkTesting.value = false
    }
  }

  function minimizeWindow() {
    windowMinimize()
  }
  function toggleMaximizeWindow() {
    windowToggleMaximize()
  }

  async function closeWindow() {
    await flushAutoSave(true)
    windowClose()
  }

  async function leaveSettings() {
    await flushAutoSave(true)
    returnToApp()
  }

  async function exportSettingsConfig() {
    if (configTransferBusy.value) return
    configTransferBusy.value = true
    try {
      const result = await configExport()
      if (result?.canceled) return
      if (!result?.success) {
        showError(result?.error || t('导出配置失败'))
        return
      }
      showSuccess(t('配置已导出到 {path}', { path: result.filePath }), 3000)
    } finally {
      configTransferBusy.value = false
    }
  }

  async function pickSettingsConfigImport() {
    if (configTransferBusy.value) return
    configTransferBusy.value = true
    try {
      const result = await configImportPick()
      if (result?.canceled) return
      if (!result?.success) {
        showError(t(CONFIG_IMPORT_ERROR_MESSAGES[result?.code] || '导入配置失败'))
        return
      }
      configImportConfirm.value = { visible: true, config: result.config, summary: result.summary }
    } finally {
      configTransferBusy.value = false
    }
  }

  function cancelSettingsConfigImport() {
    configImportConfirm.value = { visible: false, config: null, summary: null }
  }

  async function confirmSettingsConfigImport() {
    const imported = configImportConfirm.value.config
    configImportConfirm.value = { visible: false, config: null, summary: null }
    if (!imported || configTransferBusy.value) return
    configTransferBusy.value = true
    try {
      await flushAutoSave(true)
      const success = await configImportApply(imported)
      if (!success) {
        showError(t('导入配置失败'))
        return
      }
      await reloadConfig()
      showSuccess(t('配置已导入，设置窗口即将刷新'))
      setTimeout(() => window.location.reload(), 800)
    } finally {
      configTransferBusy.value = false
    }
  }

  async function checkUpdate() {
    await openUpdateCenter()
  }

  async function testApiKey(provider) {
    const type = provider.type
    const apiKey = (aiApiKeys.value[type] || '').trim()
    if (!apiKey && !provider.hasEnvKey && provider.requiresApiKey !== false) return

    testingApiKey.value = { ...testingApiKey.value, [type]: true }
    apiKeyTestResult.value = { ...apiKeyTestResult.value, [type]: null }

    try {
      const result = await validateApiKey(type, apiKey, {
        baseUrl: (aiBaseUrls.value[type] || '').trim()
      })
      const isValid = typeof result === 'object' && result !== null ? result.valid === true : Boolean(result)
      const detail = typeof result === 'object' && result !== null ? String(result.error || '').trim() : ''
      const status =
        typeof result === 'object' && result !== null && result.status
          ? t('（HTTP {status}）', { status: result.status })
          : ''
      apiKeyTestResult.value = {
        ...apiKeyTestResult.value,
        [type]: isValid
          ? { success: true, message: t('{name} 验证成功', { name: t(provider.name) }) }
          : {
              success: false,
              message: detail
                ? t('{name} 验证失败{status}：{detail}', { name: t(provider.name), status, detail })
                : t('{name} 验证失败，请检查密钥是否正确', { name: t(provider.name) })
            }
      }
    } catch (e) {
      apiKeyTestResult.value = {
        ...apiKeyTestResult.value,
        [type]: { success: false, message: t('验证失败: {error}', { error: e.message }) }
      }
    }

    testingApiKey.value = { ...testingApiKey.value, [type]: false }
  }

  function setModelFetchState(type, state) {
    if (state.fetching !== undefined) {
      modelFetching.value = { ...modelFetching.value, [type]: Boolean(state.fetching) }
    }
    if (state.success !== undefined) {
      modelFetchSuccess.value = { ...modelFetchSuccess.value, [type]: state.success }
    }
    if (state.message !== undefined) {
      modelFetchMessage.value = { ...modelFetchMessage.value, [type]: state.message }
    }
  }

  function mergeRemoteModels(remoteModels, previousModels) {
    return normalizeModelList(
      remoteModels.map((model) => {
        const existing = previousModels.find((item) => item.id === model.id)
        if (!existing) return model
        return {
          ...model,
          name: existing.name || model.name,
          contextWindow: existing.contextWindow,
          maxOutput: existing.maxOutput,
          inputTypes: existing.inputTypes
        }
      })
    )
  }

  async function refreshModels(provider) {
    const type = provider.type
    const apiKey = (aiApiKeys.value[type] || '').trim()
    if (!apiKey && !provider.hasEnvKey && provider.requiresApiKey !== false) {
      setModelFetchState(type, { success: false, message: t('请先填写 API Key 或设置环境变量，再获取最新模型') })
      return
    }

    setModelFetchState(type, { fetching: true, message: '' })

    try {
      const result = await getProviderModels(type, {
        apiKey,
        baseUrl: (aiBaseUrls.value[type] || '').trim(),
        refresh: true
      })
      if (Array.isArray(result)) {
        setModelFetchState(type, {
          fetching: false,
          success: false,
          message: t('主进程仍在运行旧版本，请重启应用后再获取最新模型')
        })
        return
      }
      if (!result?.success) {
        setModelFetchState(type, {
          fetching: false,
          success: false,
          message:
            result?.error || t('{name} 模型获取失败，请检查 API Key、网络或服务商接口状态', { name: t(provider.name) })
        })
        return
      }

      const config = modelConfigs.value[type]
      const models = mergeRemoteModels(result.models, config.models)
      if (models.length === 0) {
        setModelFetchState(type, { fetching: false, success: false, message: t('未获取到可用模型') })
        return
      }

      const keepDefault = models.some((model) => model.id === config.default)
      config.models = models
      config.default = keepDefault ? config.default : result.defaultModel || models[0].id
      modelConfigSources.value = { ...modelConfigSources.value, [type]: 'custom' }
      clearExpandedModels(type)
      setModelFetchState(type, {
        fetching: false,
        success: true,
        message: t('已获取 {count} 个可用模型', { count: models.length })
      })
    } catch (e) {
      setModelFetchState(type, {
        fetching: false,
        success: false,
        message: t('获取 {name} 模型失败: {error}', { name: t(provider.name), error: e.message })
      })
    }
  }

  async function resetModels(provider) {
    const type = provider.type
    setModelFetchState(type, { fetching: true, message: '' })

    try {
      const result = await getProviderModels(type, { defaults: true })
      if (!result?.success) {
        setModelFetchState(type, {
          fetching: false,
          success: false,
          message: result?.error || t('恢复内置模型失败')
        })
        return
      }

      const fallbackWindow = defaultContextWindow(provider)
      const models = normalizeModelList(
        result.models.map((model) => ({
          ...model,
          contextWindow: model.contextWindow || fallbackWindow
        }))
      )
      modelConfigs.value[type] = {
        default: result.defaultModel || models[0]?.id || '',
        models
      }
      modelConfigSources.value = { ...modelConfigSources.value, [type]: 'builtin' }
      clearExpandedModels(type)
      setModelFetchState(type, { fetching: false, success: true, message: t('已恢复内置模型列表') })
    } catch (e) {
      setModelFetchState(type, {
        fetching: false,
        success: false,
        message: t('恢复内置模型失败: {error}', { error: e.message })
      })
    }
  }

  function addModel(type) {
    const config = modelConfigs.value[type]
    if (!config) return
    config.models.push({ id: '', name: '', inputTypes: ['text', 'image'] })
    expandedModels.value = {
      ...expandedModels.value,
      [modelExpandedKey(type, config.models.length - 1)]: true
    }
  }

  function removeModel(type, index) {
    const config = modelConfigs.value[type]
    if (!config) return

    const [removed] = config.models.splice(index, 1)
    if (removed?.id === config.default) {
      config.default = config.models.find((model) => model.id)?.id || ''
    }

    const nextExpanded = {}
    for (const [key, value] of Object.entries(expandedModels.value)) {
      const [keyType, keyIndex] = key.split(':')
      if (keyType !== type) {
        nextExpanded[key] = value
        continue
      }
      const expandedIndex = Number(keyIndex)
      if (expandedIndex < index) nextExpanded[key] = value
      else if (expandedIndex > index) nextExpanded[modelExpandedKey(type, expandedIndex - 1)] = value
    }
    expandedModels.value = nextExpanded
  }

  async function saveProviderCard(provider) {
    const type = provider.type
    const config = modelConfigs.value[type]
    if (!config) return

    if (
      pendingProviders.value[type] &&
      !hasStoredApiKey(type) &&
      !provider.hasEnvKey &&
      provider.requiresApiKey !== false
    ) {
      showError(t('请先填写 API Key'))
      return
    }

    const baseUrl = (aiBaseUrls.value[type] || '').trim()
    if (!isValidBaseUrl(baseUrl)) {
      showError(t('{name} 的 API 地址必须是有效的 http(s) URL', { name: t(provider.name) }))
      return
    }

    const models = normalizeModelList(config.models)
    if (models.length === 0) {
      showError(t('请至少保留一个模型'))
      return
    }
    const duplicate = models.find((model, index) => models.findIndex((item) => item.id === model.id) !== index)
    if (duplicate) {
      showError(t('模型 ID "{id}" 重复', { id: duplicate.id }))
      return
    }

    config.models = models
    if (!models.some((model) => model.id === config.default)) {
      config.default = models[0].id
    }

    const nextModels = { ...aiModels.value }
    const storedModels = serializeProviderModels(type)
    if (storedModels) nextModels[type] = storedModels
    else nextModels[type] = { default: '', models: [] }

    const nextApiKeys = { ...savedApiKeys.value, [type]: (aiApiKeys.value[type] || '').trim() }
    const nextBaseUrls = { ...savedBaseUrls.value }
    if (baseUrl) nextBaseUrls[type] = baseUrl.replace(/\/+$/, '')
    else nextBaseUrls[type] = ''

    providerSaving.value = { ...providerSaving.value, [type]: true }
    try {
      const nextAiProvider = visibleProviders.value.some((item) => item.type === aiProvider.value)
        ? aiProvider.value
        : type
      aiProvider.value = nextAiProvider
      const success = await patchConfig({
        ai: {
          provider: nextAiProvider,
          keys: nextApiKeys,
          base_urls: nextBaseUrls,
          models: nextModels
        }
      })
      if (!success) {
        showError(t('保存失败，请检查配置'))
        return
      }

      savedApiKeys.value = nextApiKeys
      savedBaseUrls.value = nextBaseUrls
      aiModels.value = nextModels
      if (pendingProviders.value[type]) {
        const nextPending = { ...pendingProviders.value }
        delete nextPending[type]
        pendingProviders.value = nextPending
      }
      await reloadConfig()

      const providers = await getAiProviders()
      if (Array.isArray(providers) && providers.length > 0) aiProviders.value = providers

      const savedProvider = aiProviders.value.find((item) => item.type === type) || provider
      const { config: savedConfig, initial: savedInitial, source } = createProviderModelConfig(savedProvider)
      modelConfigs.value = { ...modelConfigs.value, [type]: savedConfig }
      initialModelConfigs.value = { ...initialModelConfigs.value, [type]: savedInitial }
      modelConfigSources.value = { ...modelConfigSources.value, [type]: source }
      clearExpandedModels(type)
      showSuccess(t('{name} 配置已保存', { name: t(provider.name) }))
    } catch (e) {
      showError(t('保存失败: {error}', { error: e.message }))
    } finally {
      providerSaving.value = { ...providerSaving.value, [type]: false }
    }
  }

  function cancelProviderCard(provider) {
    const type = provider.type

    aiApiKeys.value = { ...aiApiKeys.value, [type]: savedApiKeys.value[type] || '' }
    aiBaseUrls.value = { ...aiBaseUrls.value, [type]: savedBaseUrls.value[type] || '' }
    resetApiKeyVisibility(type)

    const saved = aiModels.value[type]
    if (saved && Array.isArray(saved.models) && saved.models.length > 0) {
      modelConfigs.value[type] = {
        default: saved.default || saved.models[0].id,
        models: normalizeModelList(saved.models)
      }
      modelConfigSources.value = { ...modelConfigSources.value, [type]: 'config' }
    } else {
      const models = normalizeModelList(provider.models)
      const defaultModel = provider.defaultModel
      modelConfigs.value[type] = {
        default: models.some((model) => model.id === defaultModel) ? defaultModel : models[0]?.id || '',
        models
      }
      modelConfigSources.value = { ...modelConfigSources.value, [type]: 'builtin' }
    }

    setModelFetchState(type, { fetching: false, message: '' })
    apiKeyTestResult.value = { ...apiKeyTestResult.value, [type]: null }
    clearExpandedModels(type)

    if (pendingProviders.value[type] && !hasProviderKey(type)) {
      const nextPending = { ...pendingProviders.value }
      delete nextPending[type]
      pendingProviders.value = nextPending
      expandedProviders.value = { ...expandedProviders.value, [type]: false }
      if (aiProvider.value === type) {
        aiProvider.value = aiProviders.value.find((item) => hasProviderKey(item.type))?.type || ''
      }
    }
  }

  function openProviderDocs(provider) {
    if (provider?.docsUrl) {
      openExternal(provider.docsUrl)
    }
  }

  return {
    DEFAULT_SHORTCUT_ACTIONS,
    activeMeta,
    activeTab,
    addDatabase,
    addFallbackModel,
    addModel,
    addProvider,
    addProviderOpen,
    addScriptType,
    addableProviders,
    agentMaxIterations,
    agentMaxIterationsOptions,
    agentParallelTools,
    agentParallelToolsOptions,
    agentPlanSteps,
    agentPlanStepsOptions,
    agentTimeoutMin,
    agentTimeoutMinOptions,
    aiApiKeys,
    aiBaseUrls,
    aiCompressKeepRecent,
    aiCompressKeepRecentOptions,
    aiCompressThreshold,
    aiCompressThresholdOptions,
    aiMaxAttachmentOptions,
    aiMaxAttachments,
    aiMaxImageMb,
    aiMaxImageMbOptions,
    aiMaxTextKb,
    aiMaxTextKbOptions,
    aiPersona,
    aiPresets,
    aiProvider,
    aiProviderModel,
    aiTemperature,
    aiTimeout,
    aiTimeoutOptions,
    apiKeyTestResult,
    appliedPresetId,
    applyAiPreset,
    author,
    autoStart,
    autoUpdate,
    basePath,
    canGoBackTab,
    canGoForwardTab,
    cancelProviderCard,
    cancelSettingsConfigImport,
    chatModelOptions,
    checkUpdate,
    clearShortcut,
    clipboardLimitOptions,
    clipboardMaxEntriesModel,
    clipboardPersist,
    closeAction,
    closeActionOptions,
    closeShortcutEditor,
    closeWindow,
    configImportConfirm,
    configImportMessage,
    configTransferBusy,
    confirmManagedProfileAction,
    confirmRemoveProvider,
    confirmSettingsConfigImport,
    cancelManagedProfileConfirm,
    databaseAuditEnabled,
    databaseAuditRules,
    databaseAuditStrict,
    databaseEditor,
    databaseEditorOptions,
    databaseEditorThemes,
    databaseHistoryLimit,
    databaseHistoryLimitOptions,
    databaseOperationLogEnabled,
    databasePageSize,
    databasePageSizeOptions,
    databaseRefreshInterval,
    databaseRefreshIntervalOptions,
    databaseSafeMode,
    databaseTransferBatchSize,
    databaseTransferBatchSizeOptions,
    databases,
    defaultContextWindow,
    defaultUpdateFeed,
    developerChName,
    developerEnName,
    dropConfigDrag,
    dropModelDrag,
    editorPresets,
    enableConfigDrag,
    enableModelDrag,
    endConfigDrag,
    endModelDrag,
    exportSettingsConfig,
    fallbackEnabled,
    fallbackModelOptions,
    fallbackModels,
    fontSize,
    fontSizeOptions,
    goBackTab,
    goForwardTab,
    hasInputType,
    hasProviderKey,
    hasStoredApiKey,
    isCustomSettingsOpen,
    isDragEnabled,
    isDragOver,
    isDragging,
    isMac,
    isModelDragEnabled,
    isModelDragOver,
    isModelDragging,
    isModelExpanded,
    isProviderExpanded,
    language,
    languageOptions,
    leaveSettings,
    managedProfileBusy,
    managedProfileConfirm,
    managedProfileConfirmMessage,
    managedProfileInfo,
    managedProfileSourceLabel,
    managedProfileTags,
    managedProfileUrl,
    marketSources,
    menuCollapsed,
    menuItems,
    minimizeWindow,
    modelConfigs,
    modelDefaultOptions,
    modelFetchMessage,
    modelFetchSuccess,
    modelFetching,
    modelSourceHint,
    networkTestResult,
    networkTestUrl,
    networkTesting,
    notificationChannelOptions,
    notificationItems,
    notifications,
    onSettingsFocusOut,
    onSettingsSidebarKeydown,
    openProviderDocs,
    pickManagedProfile,
    previewManagedProfileFromUrl,
    refreshManagedProfile,
    requestClearManagedProfile,
    openShortcutEditor,
    overConfigDrag,
    overModelDrag,
    pendingProviders,
    pickSettingsConfigImport,
    pickSyncDirectory,
    stopSync,
    syncBusy,
    syncInfo,
    runSyncNow,
    syncConfirm,
    syncConfirmMessage,
    syncForceConfirm,
    syncForceMessage,
    confirmSyncNow,
    confirmForceSync,
    cancelSyncConfirm: resetSyncConfirm,
    cancelSyncForceConfirm: resetSyncForceConfirm,
    syncSectionItems,
    toggleSyncSection,
    syncDeviceNameDraft,
    saveSyncDeviceName,
    syncPassphraseDraft,
    saveSyncPassphrase,
    clearSyncPassphrase,
    setSyncAutoSyncEnabled,
    syncRemoteHint,
    providerSaving,
    proxyBypass,
    proxyMode,
    proxyModeHint,
    proxyModeOptions,
    proxyUrl,
    recentToolsLimit,
    recentToolsLimitOptions,
    refreshModels,
    removeDatabase,
    removeFallbackModel,
    removeModel,
    removeProviderMessage,
    removeProviderTarget,
    removeScriptType,
    requestRemoveProvider,
    resetModels,
    runNetworkTest,
    saveProviderCard,
    saveShortcut,
    canRestoreShortcut,
    defaultShortcuts,
    restoreShortcut,
    scenarioCompression,
    scenarioModelOptions,
    scenarioPlanner,
    scriptTypes,
    selectDir,
    selectEditor,
    selectFontSize,
    selectTab,
    selectTheme,
    selectThemeStyle,
    settingsSidebarResizing,
    settingsSidebarWidth,
    shortcutActionItems,
    shortcutEditor,
    shortcutLabel,
    shortcutTools,
    shortcuts,
    showApiKey,
    sqlAuditRules,
    startConfigDrag,
    startModelDrag,
    startSettingsSidebarResize,
    swatchStyle,
    testApiKey,
    testingApiKey,
    textEditApp,
    textEditorOptions,
    theme,
    themeOptions,
    themeStyle,
    themeStyleOptions,
    toggleCustomSettings,
    toggleInputType,
    toggleMaximizeWindow,
    toggleModelExpanded,
    toggleProviderExpanded,
    toggleShowApiKey,
    toolPolicy,
    toolPolicyHint,
    toolPolicyOptions,
    toolResultMaxKb,
    toolResultMaxKbOptions,
    toolResultRetentionDays,
    toolResultRetentionOptions,
    toolResultRunKb,
    toolResultRunKbOptions,
    updateCheckInterval,
    updateCheckIntervalOptions,
    version,
    visibleProviders,
    year
  }
}
