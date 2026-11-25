import { clipboardHistory, clipboardSetPaused, getConfig, openSettings, patchConfig, pluginsRunAction } from '@/api'
import { openUpdateCenter, useToast } from '@/composables'
import { iconSvg } from '@/icons'
import { t } from '@/i18n'
import { LOCALE_OPTIONS } from '@shared/i18n'
import { MENU_GROUP_LABELS, SETTINGS_PATH, visibleTools } from '@shared/navTools'
import { SETTINGS_TAB_ITEMS } from '@shared/settingsTabs'

const SETTINGS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>`

const UPDATE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M21 12a9 9 0 1 1-2.64-6.36"/>
  <polyline points="21 3 21 9 15 9"/>
</svg>`

const PLUGIN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
  <line x1="12" y1="22.08" x2="12" y2="12"/>
</svg>`

export const ACTION_GROUP_LABELS = Object.freeze({
  tool: '工具',
  settings: '设置',
  command: '命令',
  plugin: '插件'
})

const THEME_CHOICES = [
  { id: 'light', label: '明亮', icon: 'sun', keywords: 'theme light 亮色 浅色 明亮 外观' },
  { id: 'dark', label: '暗黑', icon: 'moon', keywords: 'theme dark 暗色 深色 暗黑 夜间 外观' },
  { id: 'system', label: '跟随系统', icon: 'monitor', keywords: 'theme system auto 跟随系统 外观' }
]

const FONT_SIZE_ORDER = ['small', 'medium', 'large', 'xlarge']
const FONT_SIZE_LABELS = { small: '小', medium: '标准', large: '大', xlarge: '特大' }

const THEME_STYLE_CHOICES = [
  { id: 'sapphire', label: '蓝宝石', keywords: 'theme style sapphire 蓝宝石 主题风格 配色' },
  { id: 'forest', label: '森林', keywords: 'theme style forest 森林 主题风格 配色' },
  { id: 'mint', label: '薄荷', keywords: 'theme style mint 薄荷 主题风格 配色' },
  { id: 'bee', label: '蜜蜂', keywords: 'theme style bee 蜜蜂 主题风格 配色' },
  { id: 'parchment', label: '羊皮纸', keywords: 'theme style parchment sepia 羊皮纸 主题风格 配色' }
]

export function buildSearchActions({ navigate, addRecent, pluginCommands = [], sendText }) {
  const { showSuccess, showError, showInfo } = useToast()

  async function applyTheme(theme, label) {
    const ok = await patchConfig({ appearance: { theme } })
    if (ok) showSuccess(t('主题已切换为{theme}', { theme: t(label) }))
    else showError(t('设置保存失败'))
  }

  async function applyThemeStyle(style, label) {
    const ok = await patchConfig({ appearance: { theme_style: style } })
    if (ok) showSuccess(t('主题风格已切换为{style}', { style: t(label) }))
    else showError(t('设置保存失败'))
  }

  async function applyLanguage(value, label) {
    const ok = await patchConfig({ appearance: { language: value } })
    if (ok) showSuccess(t('界面语言已切换为{language}', { language: label }))
    else showError(t('设置保存失败'))
  }

  async function toggleClipboardPause() {
    const state = await clipboardHistory()
    const paused = state?.paused === true
    const next = await clipboardSetPaused(!paused)
    if (typeof next === 'boolean') showSuccess(next ? t('已暂停记录剪贴板') : t('已恢复记录剪贴板'))
    else showError(t('操作失败'))
  }

  async function runPluginSandbox(command) {
    const result = await pluginsRunAction(command.plugin, command.target)
    if (!result?.success) {
      if (!result?.canceled) showError(result?.error || t('插件动作运行失败'))
      return
    }
    showSuccess(
      result.outputMode === 'notification'
        ? t('已运行「{title}」，结果已发送通知', { title: command.title })
        : t('已运行「{title}」，结果已复制到剪贴板', { title: command.title })
    )
  }

  async function stepFontSize(direction) {
    const config = await getConfig()
    const current = config?.appearance?.font_size
    const index = FONT_SIZE_ORDER.includes(current) ? FONT_SIZE_ORDER.indexOf(current) : 1
    const nextIndex = Math.min(FONT_SIZE_ORDER.length - 1, Math.max(0, index + direction))
    if (nextIndex === index) {
      showInfo(t(direction > 0 ? '已使用最大字号' : '已使用最小字号'))
      return
    }
    const next = FONT_SIZE_ORDER[nextIndex]
    const ok = await patchConfig({ appearance: { font_size: next } })
    if (ok) showSuccess(t('字号已切换为{size}', { size: t(FONT_SIZE_LABELS[next]) }))
    else showError(t('设置保存失败'))
  }

  const toolActions = visibleTools.map((tool) => ({
    id: `tool:${tool.path}`,
    group: 'tool',
    categoryLabel: MENU_GROUP_LABELS[tool.menuGroup],
    title: tool.name,
    subtitle: tool.description,
    icon: tool.icon,
    keywords: [tool.keywords, tool.path, MENU_GROUP_LABELS[tool.menuGroup]].filter(Boolean).join(' '),
    run: () => {
      addRecent?.(tool)
      if (tool.path === SETTINGS_PATH) openSettings()
      else navigate(tool.path)
    }
  }))

  const settingsActions = SETTINGS_TAB_ITEMS.map((tab) => ({
    id: `settings:${tab.id}`,
    group: 'settings',
    title: tab.label,
    subtitle: '',
    icon: SETTINGS_ICON,
    keywords: [tab.keywords, `设置 settings ${tab.id}`].filter(Boolean).join(' '),
    run: () => openSettings(tab.id)
  }))

  const commands = [
    {
      id: 'command:check-updates',
      group: 'command',
      title: '检查更新',
      subtitle: '检查并安装应用更新',
      icon: UPDATE_ICON,
      keywords: 'update upgrade version',
      run: () => openUpdateCenter()
    },
    ...THEME_CHOICES.map((choice) => ({
      id: `command:theme-${choice.id}`,
      group: 'command',
      categoryLabel: '外观',
      title: `切换到${choice.label}主题`,
      subtitle: '主题',
      icon: iconSvg(choice.icon),
      keywords: choice.keywords,
      run: () => applyTheme(choice.id, choice.label)
    })),
    {
      id: 'command:font-size-up',
      group: 'command',
      categoryLabel: '外观',
      title: '放大界面字号',
      subtitle: '字号',
      icon: iconSvg('plus'),
      keywords: 'font size larger 字号 放大',
      run: () => stepFontSize(1)
    },
    {
      id: 'command:font-size-down',
      group: 'command',
      categoryLabel: '外观',
      title: '缩小界面字号',
      subtitle: '字号',
      icon: iconSvg('minus'),
      keywords: 'font size smaller 字号 缩小',
      run: () => stepFontSize(-1)
    },
    ...THEME_STYLE_CHOICES.map((choice) => ({
      id: `command:theme-style-${choice.id}`,
      group: 'command',
      categoryLabel: '外观',
      title: `切换到${choice.label}主题风格`,
      subtitle: '主题风格',
      icon: iconSvg('layers'),
      keywords: choice.keywords,
      run: () => applyThemeStyle(choice.id, choice.label)
    })),
    ...LOCALE_OPTIONS.map((option) => ({
      id: `command:language-${option.value}`,
      group: 'command',
      categoryLabel: '语言',
      title: `切换界面语言为${option.label}`,
      subtitle: '语言',
      icon: iconSvg('globe'),
      keywords: `language locale i18n 语言 ${option.label} ${option.value}`,
      run: () => applyLanguage(option.value, option.label)
    })),
    {
      id: 'command:clipboard-pause',
      group: 'command',
      categoryLabel: '剪贴板',
      title: '暂停或恢复剪贴板记录',
      subtitle: '剪贴板',
      icon: iconSvg('pause'),
      keywords: 'clipboard pause resume 剪贴板 暂停 恢复',
      run: () => toggleClipboardPause()
    }
  ]

  const pluginActions = (Array.isArray(pluginCommands) ? pluginCommands : []).map((command) => ({
    id: `plugin:${command.plugin}:${command.id}`,
    group: 'plugin',
    title: command.title,
    subtitle: command.subtitle,
    icon: PLUGIN_ICON,
    keywords: `插件 plugin ${command.plugin} ${command.keywords || ''}`,
    run: () => {
      if (command.action === 'run') {
        runPluginSandbox(command)
        return
      }
      if (command.action === 'settings') {
        openSettings(command.target)
        return
      }
      if (command.action === 'send') {
        sendText?.({ kind: 'text', text: command.text, title: command.title }, command.target)
        return
      }
      const tool = visibleTools.find((item) => item.path === command.target)
      if (tool) addRecent?.(tool)
      if (command.target === SETTINGS_PATH) openSettings()
      else navigate(command.target)
    }
  }))

  return [...toolActions, ...settingsActions, ...commands, ...pluginActions]
}
