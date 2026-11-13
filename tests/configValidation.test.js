import { describe, it, expect } from 'vitest'
import { validateConfig, normalizeShortcuts, VALID_SHORTCUT_KEYS } from '../src/main/services/configValidation.js'
import { tools } from '../src/shared/tools.js'

function createConfig(overrides = {}) {
  return {
    base_path: '/tmp/scripts',
    developer_ch_name: '张三',
    developer_en_name: 'zhangsan',
    text_edit_app: '',
    auto_update: true,
    auto_start: true,
    close_action: 'ask',
    ai_provider: 'bailian',
    ai_api_keys: {},
    databases: ['main_db'],
    script_types: [{ name: 'DDL' }],
    shortcuts: { settings: 'CmdOrCtrl+,' },
    ...overrides
  }
}

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    expect(validateConfig(createConfig())).toBeNull()
  })

  it('rejects non-object input', () => {
    expect(validateConfig(null)).toBe('配置不是有效对象')
    expect(validateConfig([])).toBe('配置不是有效对象')
  })

  it('validates required fields', () => {
    expect(validateConfig(createConfig({ base_path: 1 }))).toBe('base_path 必须是字符串')
    expect(validateConfig(createConfig({ auto_update: 'yes' }))).toBe('auto_update 必须是布尔值')
    expect(validateConfig(createConfig({ databases: 'main_db' }))).toBe('databases 必须是数组')
    expect(validateConfig(createConfig({ databases: [1] }))).toBe('databases 中的每项必须是字符串')
    expect(validateConfig(createConfig({ script_types: [{ name: 1 }] }))).toBe('script_types.name 必须是字符串')
  })

  it('validates close_action against the allowed values', () => {
    expect(validateConfig(createConfig({ close_action: 'hide' }))).toBeNull()
    expect(validateConfig(createConfig({ close_action: 'explode' }))).toBe('close_action 值不合法')
  })

  it('validates theme against the allowed values', () => {
    expect(validateConfig(createConfig({ theme: 'system' }))).toBeNull()
    expect(validateConfig(createConfig({ theme: 'dark' }))).toBeNull()
    expect(validateConfig(createConfig({ theme: 'sepia' }))).toBe('theme 值不合法')
  })

  it('validates theme_style against the allowed values', () => {
    expect(validateConfig(createConfig({ theme_style: 'sapphire' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'forest' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'mint' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'bee' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'parchment' }))).toBeNull()
    expect(validateConfig(createConfig({ theme_style: 'default' }))).toBe('theme_style 值不合法')
    expect(validateConfig(createConfig({ theme_style: 'neon' }))).toBe('theme_style 值不合法')
  })

  it('validates font_size against the allowed values', () => {
    expect(validateConfig(createConfig({ font_size: 'small' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'medium' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'large' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'xlarge' }))).toBeNull()
    expect(validateConfig(createConfig({ font_size: 'huge' }))).toBe('font_size 值不合法')
  })

  it('validates shortcut keys and values', () => {
    expect(validateConfig(createConfig({ shortcuts: { unknown: 'CmdOrCtrl+X' } }))).toBe(
      'shortcuts.unknown 不是有效的快捷键配置项'
    )
    expect(validateConfig(createConfig({ shortcuts: { chat: 'CmdOrCtrl+L' } }))).toBe(
      'shortcuts.chat 不是有效的快捷键配置项'
    )
    expect(validateConfig(createConfig({ shortcuts: { settings: 1 } }))).toBe('shortcuts.settings 必须是字符串')
  })

  it('validates ai_models shape', () => {
    expect(validateConfig(createConfig({ ai_models: {} }))).toBeNull()
    expect(
      validateConfig(
        createConfig({
          ai_models: { deepseek: { default: 'deepseek-v4-pro', models: [{ id: 'deepseek-v4-pro', name: 'V4 Pro' }] } }
        })
      )
    ).toBeNull()
    expect(validateConfig(createConfig({ ai_models: [] }))).toBe('ai_models 必须是对象')
    expect(validateConfig(createConfig({ ai_models: { zhipu: { default: 1 } } }))).toBe(
      'ai_models.zhipu.default 必须是字符串'
    )
    expect(validateConfig(createConfig({ ai_models: { zhipu: { models: {} } } }))).toBe(
      'ai_models.zhipu.models 必须是数组'
    )
    expect(validateConfig(createConfig({ ai_models: { zhipu: { models: [{ id: ' ' }] } } }))).toBe(
      'ai_models.zhipu.models.id 必须是非空字符串'
    )
  })

  it('keeps every valid shortcut key aligned with the shared tool registry', () => {
    const configurableKeys = tools.filter((tool) => tool.shortcutKey).map((tool) => tool.shortcutKey)
    expect(VALID_SHORTCUT_KEYS).toEqual(configurableKeys)
  })
})

describe('normalizeShortcuts', () => {
  const defaults = { settings: 'CmdOrCtrl+,' }

  it('drops obsolete shortcut keys from older configs', () => {
    expect(normalizeShortcuts({ chat: 'CmdOrCtrl+L', password: 'CmdOrCtrl+P' }, defaults)).toEqual(defaults)
  })

  it('keeps valid overrides and fills missing defaults', () => {
    expect(normalizeShortcuts({ settings: '' }, defaults)).toEqual({ settings: '' })
    expect(normalizeShortcuts({ settings: 'Alt+S' }, defaults)).toEqual({ settings: 'Alt+S' })
  })

  it('falls back to defaults for invalid input', () => {
    expect(normalizeShortcuts(null, defaults)).toEqual(defaults)
    expect(normalizeShortcuts([], defaults)).toEqual(defaults)
  })
})
