import { describe, it, expect } from 'vitest'
import { DEFAULT_DATABASE_EDITOR_CONFIG, normalizeDatabaseEditorConfig } from '../src/shared/databaseEditor.js'
import { validateConfig } from '../src/main/services/configValidation.js'

function createConfig(overrides = {}) {
  return {
    app: {
      auto_start: true,
      close_action: 'ask',
      shortcuts: { settings: 'CmdOrCtrl+,' }
    },
    appearance: {},
    update: { auto_update: true },
    network: {},
    database: {},
    sql_generator: {
      base_path: '/tmp/scripts',
      developer: { ch_name: '张三', en_name: 'zhangsan' },
      text_edit_app: '',
      databases: ['main_db'],
      script_types: [{ name: 'DDL' }]
    },
    ai: { provider: 'bailian', keys: {} },
    extensions: {},
    notifications: {},
    clipboard_history: {},
    ...overrides
  }
}

describe('normalizeDatabaseEditorConfig', () => {
  it('returns defaults for missing or invalid input', () => {
    expect(normalizeDatabaseEditorConfig()).toEqual(DEFAULT_DATABASE_EDITOR_CONFIG)
    expect(normalizeDatabaseEditorConfig(null)).toEqual(DEFAULT_DATABASE_EDITOR_CONFIG)
    expect(normalizeDatabaseEditorConfig([])).toEqual(DEFAULT_DATABASE_EDITOR_CONFIG)
  })

  it('keeps valid values and drops unknown ones', () => {
    const result = normalizeDatabaseEditorConfig({
      theme: 'one-dark',
      line_numbers: false,
      run_button: false,
      hover_ddl: false,
      unknown: true
    })
    expect(result.theme).toBe('one-dark')
    expect(result.line_numbers).toBe(false)
    expect(result.run_button).toBe(false)
    expect(result.hover_ddl).toBe(false)
    expect(result.diagnostics).toBe(true)
    expect(result).not.toHaveProperty('unknown')
  })

  it('ignores invalid theme and non-boolean toggles', () => {
    const result = normalizeDatabaseEditorConfig({
      theme: 'sepia',
      line_numbers: 'yes',
      word_wrap: 0
    })
    expect(result.theme).toBe('auto')
    expect(result.line_numbers).toBe(true)
    expect(result.word_wrap).toBe(true)
  })
})

describe('validateConfig database_editor', () => {
  it('accepts a valid editor config', () => {
    expect(
      validateConfig(
        createConfig({
          database: { editor: { theme: 'auto', line_numbers: true, hover_ddl: false } }
        })
      )
    ).toBeNull()
  })

  it('rejects invalid shapes and values', () => {
    expect(validateConfig(createConfig({ database: { editor: [] } }))).toBe('database.editor 必须是对象')
    expect(validateConfig(createConfig({ database: { editor: { theme: 'sepia' } } }))).toBe('database.editor.theme 值不合法')
    expect(validateConfig(createConfig({ database: { editor: { run_button: 1 } } }))).toBe(
      'database.editor.run_button 必须是布尔值'
    )
  })
})
