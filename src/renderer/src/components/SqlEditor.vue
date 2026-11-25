<template>
  <div ref="editorContainer" class="sql-editor-container" />
</template>

<script setup>
import { t } from '@/i18n'
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  hoverTooltip,
  gutter,
  GutterMarker,
  Decoration,
  ViewPlugin,
  placeholder as cmPlaceholder
} from '@codemirror/view'
import { Compartment, EditorState, RangeSet } from '@codemirror/state'
import { sql, MySQL } from '@codemirror/lang-sql'
import { autocompletion, closeBrackets, closeBracketsKeymap, snippetCompletion } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { defaultHighlightStyle, syntaxHighlighting, bracketMatching, indentOnInput } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { aura, config as auraConfig } from '@ddietr/codemirror-themes/aura'
import { dracula, config as draculaConfig } from '@ddietr/codemirror-themes/dracula'
import { githubDark, config as githubDarkConfig } from '@ddietr/codemirror-themes/github-dark'
import { githubLight, config as githubLightConfig } from '@ddietr/codemirror-themes/github-light'
import { materialDark, config as materialDarkConfig } from '@ddietr/codemirror-themes/material-dark'
import { materialLight, config as materialLightConfig } from '@ddietr/codemirror-themes/material-light'
import { solarizedDark, config as solarizedDarkConfig } from '@ddietr/codemirror-themes/solarized-dark'
import { solarizedLight, config as solarizedLightConfig } from '@ddietr/codemirror-themes/solarized-light'
import { tokyoNight, config as tokyoNightConfig } from '@ddietr/codemirror-themes/tokyo-night'
import { tokyoNightDay, config as tokyoNightDayConfig } from '@ddietr/codemirror-themes/tokyo-night-day'
import { tokyoNightStorm, config as tokyoNightStormConfig } from '@ddietr/codemirror-themes/tokyo-night-storm'
import {
  NodeSqlParser,
  SqlStructureAnalyzer,
  defaultSqlHoverTheme,
  sqlCompletion,
  sqlExtension,
  sqlSchemaFacet
} from '@marimo-team/codemirror-sql'
import commonKeywords from '@marimo-team/codemirror-sql/data/common-keywords.json'
import { getResolvedTheme } from '@/utils/theme'
import { isRoutineDdl, splitSqlStatementRanges } from '@shared/sqlStatements'
import { normalizeDatabaseEditorConfig } from '@shared/databaseEditor'
import { highlightSqlToHtml } from '@/utils/sqlHighlight'
import { dbGetTableMeta } from '@/api'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  tables: {
    type: Array,
    default: () => []
  },
  databases: {
    type: Array,
    default: () => []
  },
  schema: {
    type: Object,
    default: null
  },
  placeholder: {
    type: String,
    default: ''
  },
  connectionName: {
    type: String,
    default: ''
  },
  database: {
    type: String,
    default: ''
  },
  settings: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'execute'])

const editorContainer = ref(null)
let editorView = null

const editorSettings = computed(() => normalizeDatabaseEditorConfig(props.settings))

const sqlParser = new NodeSqlParser({
  getParserOptions: () => ({ database: 'MySQL', parseOptions: { includeLocations: true } })
})

class MysqlStructureAnalyzer extends SqlStructureAnalyzer {
  async extractStatements(content, state) {
    const statements = []
    for (const range of splitSqlStatementRanges(content)) {
      const fromLine = state.doc.lineAt(range.from)
      const toLine = state.doc.lineAt(range.to)
      const statement = {
        from: range.from,
        to: range.to,
        lineFrom: fromLine.number,
        lineTo: toLine.number,
        content: range.text,
        type: this.determineStatementType(range.text),
        isValid: true,
        errors: []
      }
      // node-sql-parser cannot parse MySQL routine bodies; skip them so the
      // body's semicolons don't surface bogus syntax errors.
      if (!isRoutineDdl(range.text)) {
        const result = await this.parser.parse(range.text, { state })
        statement.isValid = result.success
        statement.errors = result.errors ?? []
      }
      statements.push(statement)
    }
    return statements
  }
}

const sqlStructureAnalyzer = new MysqlStructureAnalyzer(sqlParser)

const customFunctions = [
  'NOW()',
  'CURDATE()',
  'CURTIME()',
  'DATE()',
  'YEAR()',
  'MONTH()',
  'DAY()',
  'HOUR()',
  'MINUTE()',
  'SECOND()',
  'DATEDIFF()',
  'TIMESTAMPDIFF()',
  'DATE_ADD()',
  'DATE_SUB()',
  'DATE_FORMAT()',
  'CONCAT()',
  'CONCAT_WS()',
  'SUBSTRING()',
  'LEFT()',
  'RIGHT()',
  'LENGTH()',
  'UPPER()',
  'LOWER()',
  'TRIM()',
  'REPLACE()',
  'CAST()',
  'CONVERT()',
  'COALESCE()',
  'IFNULL()',
  'NULLIF()',
  'GREATEST()',
  'LEAST()',
  'MD5()',
  'SHA1()',
  'RAND()',
  'UUID()',
  'ABS()',
  'CEIL()',
  'FLOOR()',
  'ROUND()',
  'MOD()',
  'SQRT()',
  'POWER()',
  'BIN()',
  'HEX()',
  'ASCII()',
  'LAST_INSERT_ID()',
  'VERSION()',
  'DATABASE()',
  'USER()',
  'CURRENT_USER()',
  'INET_ATON()',
  'INET_NTOA()',
  'ISNULL()',
  'FORMAT()',
  'SUBSTR()',
  'CHAR_LENGTH()',
  'INSTR()',
  'LOCATE()',
  'REVERSE()',
  'LPAD()',
  'RPAD()',
  'ELT()',
  'FIELD()',
  'INSERT()',
  'PI()',
  'SIN()',
  'COS()',
  'TAN()',
  'EXP()',
  'LOG()',
  'LOG10()'
]

const SQL_SNIPPETS = [
  snippetCompletion('SELECT ${columns}\nFROM ${table}\nWHERE ${condition};', {
    get label() {
      return t('SELECT 查询')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 85
  }),
  snippetCompletion('SELECT ${columns}, COUNT(*) AS total\nFROM ${table}\nGROUP BY ${columns};', {
    get label() {
      return t('SELECT COUNT 统计')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 82
  }),
  snippetCompletion('INSERT INTO ${table} (${columns})\nVALUES (${values});', {
    get label() {
      return t('INSERT 插入')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 85
  }),
  snippetCompletion(
    'INSERT INTO ${table} (${columns})\nVALUES (${values})\nON DUPLICATE KEY UPDATE ${column} = ${value};',
    {
      label: 'INSERT ON DUPLICATE',
      type: 'keyword',
      get detail() {
        return t('代码片段')
      },
      boost: 80
    }
  ),
  snippetCompletion('UPDATE ${table}\nSET ${column} = ${value}\nWHERE ${condition};', {
    get label() {
      return t('UPDATE 更新')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 85
  }),
  snippetCompletion('DELETE FROM ${table}\nWHERE ${condition};', {
    get label() {
      return t('DELETE 删除')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 85
  }),
  snippetCompletion('JOIN ${table} ON ${condition}', {
    get label() {
      return t('JOIN 联表')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 72
  }),
  snippetCompletion('LEFT JOIN ${table} ON ${condition}', {
    get label() {
      return t('LEFT JOIN 左连接')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 72
  }),
  snippetCompletion('GROUP BY ${columns}', {
    get label() {
      return t('GROUP BY 分组')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 70
  }),
  snippetCompletion('ORDER BY ${columns} ${direction}', {
    get label() {
      return t('ORDER BY 排序')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 70
  }),
  snippetCompletion('LIMIT ${count} OFFSET ${offset}', {
    get label() {
      return t('LIMIT 分页')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 70
  }),
  snippetCompletion('CASE\n  WHEN ${condition} THEN ${result}\n  ELSE ${result}\nEND', {
    get label() {
      return t('CASE WHEN 条件')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 70
  }),
  snippetCompletion('WITH ${name} AS (\n  ${query}\n)\nSELECT *\nFROM ${name};', {
    get label() {
      return t('WITH CTE 公共表')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 70
  }),
  snippetCompletion('CREATE TABLE ${table} (\n  ${column} ${type}\n);', {
    get label() {
      return t('CREATE TABLE 建表')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 65
  }),
  snippetCompletion('ALTER TABLE ${table}\n  ADD COLUMN ${column} ${type};', {
    get label() {
      return t('ALTER TABLE 改表')
    },
    type: 'keyword',
    get detail() {
      return t('代码片段')
    },
    boost: 65
  })
]

function schemaColumns(tableName) {
  const entry = props.schema?.[tableName]
  if (!entry) return []
  const list = Array.isArray(entry) ? entry : entry.children
  if (!Array.isArray(list)) return []
  return list.map((column) => (typeof column === 'string' ? column : column.label)).filter(Boolean)
}

function tableInfo(tableName) {
  const columns = schemaColumns(tableName)
  if (columns.length === 0) return undefined
  return t('{p0} 列：{p1}{p2}', {
    p0: columns.length,
    p1: columns.slice(0, 8).join(', '),
    p2: columns.length > 8 ? ' …' : ''
  })
}

const completionOptions = computed(() => [
  ...SQL_SNIPPETS,
  ...customFunctions.map((name) => ({
    label: name.replace('()', ''),
    type: 'function',
    get detail() {
      return t('MySQL 函数')
    },
    boost: 75
  })),
  ...props.databases.map((name) => ({
    label: name,
    type: 'constant',
    get detail() {
      return t('数据库')
    },
    boost: 68
  })),
  ...props.tables.map((name) => ({
    label: name,
    type: 'class',
    get detail() {
      return t('表')
    },
    info: tableInfo(name),
    boost: 60
  }))
])

const myCompletions = (context) => {
  const word = context.matchBefore(/[\w$]*/)
  if (!word || (word.from === word.to && !context.explicit)) return null

  // 表名/别名限定符之后交给 SQL 方言做列补全，避免自定义项挤掉列
  const before = context.state.sliceDoc(Math.max(0, word.from - 64), word.from)
  if (/(?:[\w$]+|`[^`]+`|"[^"]+"|\[[^\]]+\])\.$/.test(before)) return null

  return {
    from: word.from,
    options: completionOptions.value,
    validFor: /^[\w$]*$/
  }
}

const sqlKeymap = [
  ...defaultKeymap.filter((binding) => binding.key !== 'Mod-Enter'),
  ...historyKeymap,
  ...closeBracketsKeymap,
  indentWithTab
]

const MONO_FONT = "'Consolas', 'Monaco', 'Courier New', monospace"

const layoutTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: MONO_FONT
  },
  '.cm-content': {
    padding: '10px 0',
    minHeight: '100px'
  },
  '.cm-line': {
    padding: '0 10px'
  },
  '.cm-tooltip-autocomplete': {
    borderRadius: '4px',
    boxShadow: 'var(--shadow-md)',
    fontFamily: "'Consolas', 'Monaco', monospace",
    fontSize: '13px'
  },
  '.cm-tooltip-autocomplete ul': {
    maxHeight: '280px'
  },
  '.cm-tooltip-autocomplete li': {
    padding: '4px 8px',
    lineHeight: '1.5'
  },
  '.cm-completionDetail': {
    marginLeft: '10px',
    fontStyle: 'normal',
    fontSize: '12px'
  },
  '.cm-tooltip.cm-completionInfo': {
    padding: '8px 10px',
    maxWidth: '320px',
    borderRadius: '4px',
    fontFamily: "'Consolas', 'Monaco', monospace",
    fontSize: '12px',
    lineHeight: '1.6'
  },
  '.cm-completionLabel': {
    fontFamily: "'Consolas', 'Monaco', monospace"
  },
  '.cm-tooltip-lint': {
    borderRadius: '4px',
    boxShadow: 'var(--shadow-md)'
  },
  '.cm-diagnostic': {
    fontFamily: "'Consolas', 'Monaco', monospace",
    fontSize: '12px'
  },
  '.cm-run-gutter': {
    width: '22px'
  },
  '.cm-run-stmt-btn': {
    width: '18px',
    height: '18px',
    padding: '0',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    fontSize: '10px',
    lineHeight: '18px',
    textAlign: 'center',
    cursor: 'pointer',
    opacity: '0.6'
  },
  '.cm-ntb-ddl': {
    maxWidth: '560px',
    padding: '8px 10px',
    fontFamily: MONO_FONT
  },
  '.cm-ntb-ddl-title': {
    marginBottom: '6px',
    fontSize: '12px',
    fontWeight: '600'
  },
  '.cm-ntb-ddl-code': {
    margin: '0',
    maxHeight: '260px',
    overflow: 'auto',
    fontSize: '12px',
    lineHeight: '1.5',
    whiteSpace: 'pre'
  },
  '.cm-ntb-ddl-empty': {
    fontSize: '12px'
  }
})

const autoColorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--editor-bg)',
    color: 'var(--text-primary)'
  },
  '.cm-content': {
    caretColor: 'var(--editor-caret)',
    backgroundColor: 'var(--editor-bg)'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--editor-gutter-bg)',
    borderRight: '1px solid var(--editor-border)',
    color: 'var(--text-tertiary)'
  },
  '.cm-selectionBackground': {
    backgroundColor: 'var(--editor-selection)'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--editor-caret)'
  },
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--panel-elevated)',
    border: '1px solid rgba(var(--accent-rgb), 0.3)',
    color: 'var(--text-primary)'
  },
  '.cm-completionIcon': {
    color: 'var(--accent-color)',
    opacity: '0.9'
  },
  '.cm-completionDetail': {
    color: 'var(--text-tertiary)'
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none',
    color: 'var(--accent-color)',
    fontWeight: '600'
  },
  '.cm-tooltip.cm-completionInfo': {
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--panel-elevated)',
    color: 'var(--text-secondary)'
  },
  '.cm-tooltip-autocomplete li[aria-selected]': {
    backgroundColor: 'rgba(var(--accent-rgb), 0.18)',
    color: 'var(--text-primary)'
  },
  '.cm-tooltip-lint': {
    backgroundColor: 'var(--panel-elevated)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)'
  },
  '.cm-diagnostic-error': {
    borderLeftColor: 'var(--error-color)'
  },
  '.cm-diagnostic-warning': {
    borderLeftColor: 'var(--warning-color)'
  },
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--error-color)',
    textUnderlineOffset: '2px'
  },
  '.cm-lintRange-warning': {
    backgroundImage: 'none',
    textDecoration: 'underline wavy var(--warning-color)',
    textUnderlineOffset: '2px'
  },
  '.cm-run-stmt-btn': {
    color: 'var(--accent-color)'
  },
  '.cm-run-stmt-btn:hover': {
    background: 'rgba(var(--accent-rgb), 0.16)',
    opacity: '1'
  },
  '.cm-stmt-line': {
    backgroundColor: 'rgba(var(--accent-rgb), 0.045)',
    boxShadow: 'inset 2px 0 0 rgba(var(--accent-rgb), 0.35), inset -1px 0 0 rgba(var(--accent-rgb), 0.18)'
  },
  '.cm-stmt-first': {
    boxShadow:
      'inset 2px 0 0 rgba(var(--accent-rgb), 0.35), inset -1px 0 0 rgba(var(--accent-rgb), 0.18), inset 0 1px 0 rgba(var(--accent-rgb), 0.22)'
  },
  '.cm-stmt-last': {
    boxShadow:
      'inset 2px 0 0 rgba(var(--accent-rgb), 0.35), inset -1px 0 0 rgba(var(--accent-rgb), 0.18), inset 0 -1px 0 rgba(var(--accent-rgb), 0.22)'
  },
  '.cm-stmt-first.cm-stmt-last': {
    boxShadow:
      'inset 2px 0 0 rgba(var(--accent-rgb), 0.35), inset -1px 0 0 rgba(var(--accent-rgb), 0.18), inset 0 1px 0 rgba(var(--accent-rgb), 0.22), inset 0 -1px 0 rgba(var(--accent-rgb), 0.22)'
  },
  '.cm-ntb-ddl-title': {
    color: 'var(--accent-color)'
  },
  '.cm-ntb-ddl-code': {
    color: 'var(--text-primary)'
  },
  '.cm-ntb-ddl-empty': {
    color: 'var(--text-tertiary)'
  }
})

const ONE_DARK_CONFIG = {
  dark: true,
  background: '#282c34',
  foreground: '#abb2bf',
  selection: '#3e4451',
  cursor: '#528bff',
  dropdownBackground: '#21252b',
  dropdownBorder: '#181a1f',
  activeLine: '#2c313a',
  lineNumber: '#7d8799',
  invalid: '#e06c75',
  function: '#61afef',
  keyword: '#c678dd',
  type: '#e5c07b',
  string: '#98c379',
  number: '#d19a66',
  variable: '#e06c75',
  comment: '#7d8799'
}

const LIGHT_CONFIG = {
  dark: false,
  background: '#ffffff',
  foreground: '#1f2328',
  selection: '#b6d7ff',
  cursor: '#0969da',
  dropdownBackground: '#ffffff',
  dropdownBorder: '#d0d7de',
  activeLine: '#f3f5f8',
  lineNumber: '#8c959f',
  invalid: '#cf222e',
  function: '#8250df',
  keyword: '#0550ae',
  type: '#0550ae',
  string: '#0a7d38',
  number: '#b35900',
  variable: '#0969da',
  comment: '#6e7781'
}

const THEME_PRESETS = {
  light: { extension: [], config: LIGHT_CONFIG },
  'one-dark': { extension: oneDark, config: ONE_DARK_CONFIG },
  'github-light': { extension: githubLight, config: githubLightConfig },
  'github-dark': { extension: githubDark, config: githubDarkConfig },
  dracula: { extension: dracula, config: draculaConfig },
  'material-light': { extension: materialLight, config: materialLightConfig },
  'material-dark': { extension: materialDark, config: materialDarkConfig },
  'solarized-light': { extension: solarizedLight, config: solarizedLightConfig },
  'solarized-dark': { extension: solarizedDark, config: solarizedDarkConfig },
  'tokyo-night': { extension: tokyoNight, config: tokyoNightConfig },
  'tokyo-night-storm': { extension: tokyoNightStorm, config: tokyoNightStormConfig },
  'tokyo-night-day': { extension: tokyoNightDay, config: tokyoNightDayConfig },
  aura: { extension: aura, config: auraConfig }
}

function buildColorTheme(config) {
  return EditorView.theme({
    '&': {
      backgroundColor: config.background,
      color: config.foreground
    },
    '.cm-content': {
      caretColor: config.cursor
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: config.cursor
    },
    '.cm-gutters': {
      backgroundColor: config.background,
      color: config.lineNumber,
      borderRight: `1px solid ${config.dropdownBorder}`
    },
    '.cm-activeLineGutter': {
      backgroundColor: config.activeLine,
      color: config.foreground
    },
    '.cm-activeLine': {
      backgroundColor: config.activeLine
    },
    '.cm-selectionBackground': {
      backgroundColor: config.selection
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: config.selection
    },
    '.cm-matchingBracket': {
      backgroundColor: config.selection,
      outline: `1px solid ${config.dropdownBorder}`
    },
    '.cm-panels': {
      backgroundColor: config.dropdownBackground,
      color: config.foreground
    }
  })
}

function buildChromeTheme(config) {
  const accent = config.cursor || config.foreground
  const side = config.selection
  const tooltip = {
    backgroundColor: config.dropdownBackground,
    color: config.foreground,
    border: `1px solid ${config.dropdownBorder}`
  }
  return EditorView.theme({
    '.cm-tooltip-autocomplete': tooltip,
    '.cm-completionIcon': {
      color: accent,
      opacity: '0.9'
    },
    '.cm-completionDetail': {
      color: config.lineNumber
    },
    '.cm-completionMatchedText': {
      textDecoration: 'none',
      color: accent,
      fontWeight: '600'
    },
    '.cm-tooltip.cm-completionInfo': tooltip,
    '.cm-tooltip-autocomplete li[aria-selected]': {
      backgroundColor: config.selection,
      color: config.foreground
    },
    '.cm-tooltip-lint': tooltip,
    '.cm-diagnostic-error': {
      borderLeftColor: config.invalid
    },
    '.cm-diagnostic-warning': {
      borderLeftColor: config.function
    },
    '.cm-lintRange-error': {
      backgroundImage: 'none',
      textDecoration: `underline wavy ${config.invalid}`,
      textUnderlineOffset: '2px'
    },
    '.cm-lintRange-warning': {
      backgroundImage: 'none',
      textDecoration: `underline wavy ${config.function}`,
      textUnderlineOffset: '2px'
    },
    '.cm-run-stmt-btn': {
      color: accent
    },
    '.cm-run-stmt-btn:hover': {
      background: config.selection,
      opacity: '1'
    },
    '.cm-stmt-line': {
      backgroundColor: config.activeLine,
      boxShadow: `inset 2px 0 0 ${side}, inset -1px 0 0 ${side}`
    },
    '.cm-stmt-first': {
      boxShadow: `inset 2px 0 0 ${side}, inset -1px 0 0 ${side}, inset 0 1px 0 ${side}`
    },
    '.cm-stmt-last': {
      boxShadow: `inset 2px 0 0 ${side}, inset -1px 0 0 ${side}, inset 0 -1px 0 ${side}`
    },
    '.cm-stmt-first.cm-stmt-last': {
      boxShadow: `inset 2px 0 0 ${side}, inset -1px 0 0 ${side}, inset 0 1px 0 ${side}, inset 0 -1px 0 ${side}`
    },
    '.cm-ntb-ddl-title': {
      color: 'inherit',
      opacity: '0.75'
    },
    '.cm-ntb-ddl-code': {
      color: 'inherit'
    },
    '.cm-ntb-ddl-empty': {
      color: 'inherit',
      opacity: '0.65'
    }
  })
}

const themeCompartment = new Compartment()
const schemaCompartment = new Compartment()
const placeholderCompartment = new Compartment()
const lineNumbersCompartment = new Compartment()
const activeLineCompartment = new Compartment()
const wrapCompartment = new Compartment()
const autocompleteCompartment = new Compartment()
const sqlExtensionCompartment = new Compartment()
const statementOutlineCompartment = new Compartment()
const runButtonCompartment = new Compartment()
const ddlHoverCompartment = new Compartment()

function getActiveThemePreset() {
  const preference = editorSettings.value.theme
  if (preference === 'auto') {
    return getResolvedTheme() === 'dark' ? THEME_PRESETS['one-dark'] : null
  }
  return THEME_PRESETS[preference] || null
}

function getThemeExtensions() {
  const preset = getActiveThemePreset()
  if (!preset) return [layoutTheme, autoColorTheme]
  return [layoutTheme, buildColorTheme(preset.config), buildChromeTheme(preset.config), ...preset.extension]
}

function getHoverTheme() {
  const preset = getActiveThemePreset()
  return defaultSqlHoverTheme(preset?.config?.dark ? 'dark' : 'light')
}

class RunStatementMarker extends GutterMarker {
  constructor(from, to, text) {
    super()
    this.from = from
    this.to = to
    this.text = text
  }

  eq(other) {
    return other.from === this.from && other.to === this.to
  }

  toDOM() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-run-stmt-btn'
    button.title = t('执行该语句')
    button.setAttribute('aria-label', t('执行该语句'))
    button.textContent = '▶'
    button.addEventListener('mousedown', (event) => event.preventDefault())
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (this.text) emit('execute', this.text)
    })
    return button
  }
}

function buildRunMarkers(state) {
  const markers = []
  const seenLines = new Set()
  for (const statement of splitSqlStatementRanges(state.doc.toString())) {
    const line = state.doc.lineAt(statement.from)
    if (seenLines.has(line.number)) continue
    seenLines.add(line.number)
    markers.push(new RunStatementMarker(statement.from, statement.to, statement.text).range(line.from))
  }
  return RangeSet.of(markers, true)
}

function runGutterExtension() {
  return gutter({
    class: 'cm-run-gutter',
    markers: (view) => buildRunMarkers(view.state)
  })
}

function buildStatementDecorations(view) {
  const text = view.state.doc.toString()
  const head = view.state.selection.main.head
  const statement = splitSqlStatementRanges(text).find((item) => head >= item.from && head <= item.to)
  if (!statement) return Decoration.none

  const startLine = view.state.doc.lineAt(statement.from).number
  const endLine = view.state.doc.lineAt(statement.to).number
  const ranges = []
  for (let number = startLine; number <= endLine; number++) {
    const classes = ['cm-stmt-line']
    if (number === startLine) classes.push('cm-stmt-first')
    if (number === endLine) classes.push('cm-stmt-last')
    ranges.push(Decoration.line({ class: classes.join(' ') }).range(view.state.doc.line(number).from))
  }
  return Decoration.set(ranges)
}

function statementOutlineExtension() {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildStatementDecorations(view)
      }

      update(update) {
        if (update.docChanged || update.selectionSet) {
          this.decorations = buildStatementDecorations(update.view)
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations
    }
  )
}

const ddlCache = new Map()
const DDL_CACHE_TTL = 60 * 1000

function resolveTableName(word) {
  const name = word.replace(/[`"[\]]/g, '')
  if (!name) return ''
  const candidates = new Set([...(props.tables || []), ...Object.keys(props.schema || {})])
  if (candidates.has(name)) return name
  const lower = name.toLowerCase()
  for (const candidate of candidates) {
    if (candidate.toLowerCase() === lower) return candidate
  }
  return ''
}

function loadTableDdl(tableName) {
  if (!props.connectionName || !props.database) return Promise.resolve('')
  const key = `${props.connectionName}\u0000${props.database}\u0000${tableName}`
  const cached = ddlCache.get(key)
  if (cached && Date.now() - cached.time < DDL_CACHE_TTL) return cached.promise
  const promise = dbGetTableMeta(props.connectionName, props.database, tableName)
    .then((result) => (result?.success && result.ddl ? result.ddl : ''))
    .catch(() => '')
  ddlCache.set(key, { time: Date.now(), promise })
  return promise
}

const SQL_TOKEN_VARS = [
  ['--sql-keyword', 'keyword'],
  ['--sql-type', 'type'],
  ['--sql-string', 'string'],
  ['--sql-number', 'number'],
  ['--sql-identifier', 'variable'],
  ['--sql-comment', 'comment'],
  ['--sql-function', 'function']
]

function applySqlTokenVars(dom, config) {
  for (const [name, key] of SQL_TOKEN_VARS) {
    if (config[key]) dom.style.setProperty(name, config[key])
  }
}

function createDdlTooltip(tableName, ddl) {
  const dom = document.createElement('div')
  dom.className = 'cm-ntb-ddl'
  const title = document.createElement('div')
  title.className = 'cm-ntb-ddl-title'
  title.textContent = `DDL · ${tableName}`
  dom.appendChild(title)
  if (ddl) {
    const code = document.createElement('pre')
    code.className = 'cm-ntb-ddl-code sql-highlight'
    code.innerHTML = highlightSqlToHtml(ddl)
    dom.appendChild(code)
    const preset = getActiveThemePreset()
    if (preset) applySqlTokenVars(dom, preset.config)
  } else {
    const empty = document.createElement('div')
    empty.className = 'cm-ntb-ddl-empty'
    empty.textContent = t('暂无 DDL，或当前连接不可用')
    dom.appendChild(empty)
  }
  return dom
}

function ddlHoverExtension() {
  return hoverTooltip(
    async (view, pos, side) => {
      if (!props.connectionName || !props.database) return null
      const line = view.state.doc.lineAt(pos)
      let start = pos
      let end = pos
      while (start > line.from && /[\w$`"]/.test(line.text[start - line.from - 1] ?? '')) start--
      while (end < line.to && /[\w$`"]/.test(line.text[end - line.from] ?? '')) end++
      if ((start === pos && side < 0) || (end === pos && side > 0)) return null
      const word = line.text.slice(start - line.from, end - line.from)
      const tableName = resolveTableName(word)
      if (!tableName) return null
      const ddl = await loadTableDdl(tableName)
      return {
        pos: start,
        end,
        above: true,
        create: () => ({ dom: createDdlTooltip(tableName, ddl) })
      }
    },
    { hoverTime: 350 }
  )
}

function buildSqlExtension() {
  const settings = editorSettings.value
  return sqlExtension({
    enableSemanticLinting: settings.diagnostics,
    linterConfig: {
      delay: 600,
      parser: sqlParser,
      structureAnalyzer: sqlStructureAnalyzer
    },
    semanticLinterConfig: {
      delay: 600,
      parser: sqlParser,
      structureAnalyzer: sqlStructureAnalyzer,
      severity: {
        unknownTable: 'warning',
        unknownColumn: 'warning',
        ambiguousColumn: 'warning'
      }
    },
    gutterConfig: {
      width: 3,
      backgroundColor: 'rgba(var(--accent-rgb), 0.55)',
      // The library's gutter analyzer splits on ';' and cannot know a routine body, so it would mark valid procedures invalid.
      showInvalid: false,
      hideWhenNotFocused: true
    },
    hoverConfig: {
      hoverTime: 300,
      keywords: commonKeywords.keywords,
      enableTables: !settings.hover_ddl,
      theme: getHoverTheme()
    }
  })
}

function buildAutocompleteExtension() {
  return editorSettings.value.autocomplete
    ? autocompletion({
        activateOnTyping: true,
        maxRenderedCompletions: 50
      })
    : []
}

function buildActiveLineExtension() {
  return editorSettings.value.active_line ? [highlightActiveLine(), highlightActiveLineGutter()] : []
}

function handleThemeChange() {
  if (!editorView) return
  editorView.dispatch({
    effects: [
      themeCompartment.reconfigure(getThemeExtensions()),
      sqlExtensionCompartment.reconfigure(buildSqlExtension())
    ]
  })
}

function applyEditorSettings() {
  if (!editorView) return
  const settings = editorSettings.value
  editorView.dispatch({
    effects: [
      themeCompartment.reconfigure(getThemeExtensions()),
      lineNumbersCompartment.reconfigure(settings.line_numbers ? lineNumbers() : []),
      activeLineCompartment.reconfigure(buildActiveLineExtension()),
      wrapCompartment.reconfigure(settings.word_wrap ? EditorView.lineWrapping : []),
      autocompleteCompartment.reconfigure(buildAutocompleteExtension()),
      sqlExtensionCompartment.reconfigure(buildSqlExtension()),
      statementOutlineCompartment.reconfigure(settings.statement_outline ? statementOutlineExtension() : []),
      runButtonCompartment.reconfigure(settings.run_button ? runGutterExtension() : []),
      ddlHoverCompartment.reconfigure(settings.hover_ddl ? ddlHoverExtension() : [])
    ]
  })
}

const createEditor = () => {
  if (!editorContainer.value) return

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      const content = update.state.doc.toString()
      emit('update:modelValue', content)
    }
  })

  const settings = editorSettings.value

  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      runButtonCompartment.of(settings.run_button ? runGutterExtension() : []),
      lineNumbersCompartment.of(settings.line_numbers ? lineNumbers() : []),
      activeLineCompartment.of(buildActiveLineExtension()),
      bracketMatching(),
      indentOnInput(),
      sql({
        dialect: MySQL,
        upperCaseKeywords: true
      }),
      history(),
      closeBrackets(),
      keymap.of(sqlKeymap),
      placeholderCompartment.of(props.placeholder ? cmPlaceholder(props.placeholder) : []),
      schemaCompartment.of(sqlSchemaFacet.of(props.schema || {})),
      sqlCompletion({ dialect: MySQL, parser: sqlParser }),
      MySQL.language.data.of({ autocomplete: myCompletions }),
      sqlExtensionCompartment.of(buildSqlExtension()),
      statementOutlineCompartment.of(settings.statement_outline ? statementOutlineExtension() : []),
      ddlHoverCompartment.of(settings.hover_ddl ? ddlHoverExtension() : []),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      autocompleteCompartment.of(buildAutocompleteExtension()),
      themeCompartment.of(getThemeExtensions()),
      wrapCompartment.of(settings.word_wrap ? EditorView.lineWrapping : []),
      updateListener,
      EditorState.allowMultipleSelections.of(false)
    ]
  })

  editorView = new EditorView({
    state,
    parent: editorContainer.value
  })
}

const setContent = (content) => {
  if (!editorView) return
  const currentContent = editorView.state.doc.toString()
  if (content !== currentContent) {
    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: content
      }
    })
  }
}

watch(
  () => props.modelValue,
  (newVal) => {
    setContent(newVal)
  }
)

watch(
  () => props.schema,
  (schema) => {
    if (!editorView) return
    editorView.dispatch({
      effects: schemaCompartment.reconfigure(sqlSchemaFacet.of(schema || {}))
    })
  }
)

watch(
  () => props.placeholder,
  (value) => {
    if (!editorView) return
    editorView.dispatch({
      effects: placeholderCompartment.reconfigure(value ? cmPlaceholder(value) : [])
    })
  }
)

watch(editorSettings, () => applyEditorSettings())

onMounted(() => {
  createEditor()
  window.addEventListener('ntb-theme-changed', handleThemeChange)
})

onUnmounted(() => {
  window.removeEventListener('ntb-theme-changed', handleThemeChange)
  if (editorView) {
    editorView.destroy()
  }
})

defineExpose({
  getContent: () => editorView?.state.doc.toString() || '',
  getSelection: () => {
    if (!editorView) return ''
    const selection = editorView.state.selection.main
    if (selection.from === selection.to) {
      return ''
    }
    return editorView.state.doc.sliceString(selection.from, selection.to)
  },
  getSelectionOrAll: () => {
    if (!editorView) return ''
    const selection = editorView.state.selection.main
    if (selection.from === selection.to) {
      return editorView.state.doc.toString()
    }
    return editorView.state.doc.sliceString(selection.from, selection.to)
  },
  replaceSelection: (text) => {
    if (!editorView) return
    const selection = editorView.state.selection.main
    editorView.dispatch({
      changes: { from: selection.from, to: selection.to, insert: text },
      selection: { anchor: selection.from + text.length },
      scrollIntoView: true
    })
    editorView.focus()
  },
  setContent,
  focus: () => editorView?.focus(),
  clear: () => setContent('')
})
</script>

<style scoped>
.sql-editor-container {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 0;
  background: var(--editor-bg);
  overflow: hidden;
}

.sql-editor-container:focus-within {
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.sql-editor-container .cm-editor {
  height: 100%;
}
</style>
