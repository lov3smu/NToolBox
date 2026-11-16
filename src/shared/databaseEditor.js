export const DATABASE_EDITOR_THEME_OPTIONS = [
  { value: 'auto', label: '跟随应用主题' },
  { value: 'light', label: '明亮' },
  { value: 'one-dark', label: 'One Dark' },
  { value: 'github-light', label: 'GitHub Light' },
  { value: 'github-dark', label: 'GitHub Dark' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'material-light', label: 'Material Light' },
  { value: 'material-dark', label: 'Material Dark' },
  { value: 'solarized-light', label: 'Solarized Light' },
  { value: 'solarized-dark', label: 'Solarized Dark' },
  { value: 'tokyo-night', label: 'Tokyo Night' },
  { value: 'tokyo-night-storm', label: 'Tokyo Night Storm' },
  { value: 'tokyo-night-day', label: 'Tokyo Night Day' },
  { value: 'aura', label: 'Aura' }
]

export const DATABASE_EDITOR_THEMES = DATABASE_EDITOR_THEME_OPTIONS.map((option) => option.value)

export const DATABASE_EDITOR_BOOLEAN_KEYS = [
  'line_numbers',
  'run_button',
  'active_line',
  'word_wrap',
  'autocomplete',
  'diagnostics',
  'hover_ddl',
  'statement_outline'
]

export const DEFAULT_DATABASE_EDITOR_CONFIG = Object.freeze({
  theme: 'auto',
  line_numbers: true,
  run_button: true,
  active_line: true,
  word_wrap: true,
  autocomplete: true,
  diagnostics: true,
  hover_ddl: true,
  statement_outline: true
})

export function normalizeDatabaseEditorConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const config = { ...DEFAULT_DATABASE_EDITOR_CONFIG }
  if (DATABASE_EDITOR_THEMES.includes(source.theme)) config.theme = source.theme
  for (const key of DATABASE_EDITOR_BOOLEAN_KEYS) {
    if (typeof source[key] === 'boolean') config[key] = source[key]
  }
  return config
}
