import { t } from '@/i18n'
import { normalizeMaskPresetKeys } from '@shared/dataMasking'

export const TRANSFER_TYPES = [
  {
    type: 'table',
    get label() {
      return t('表')
    }
  },
  {
    type: 'view',
    get label() {
      return t('视图')
    }
  },
  {
    type: 'procedure',
    get label() {
      return t('存储过程')
    }
  },
  {
    type: 'function',
    get label() {
      return t('函数')
    }
  },
  {
    type: 'trigger',
    get label() {
      return t('触发器')
    }
  },
  {
    type: 'event',
    get label() {
      return t('事件')
    }
  }
]

export const CONTENT_MODES = ['all', 'structure', 'data']
export const TARGET_MODES = ['append', 'truncate', 'skip']
export const NAME_CASES = ['keep', 'lower', 'upper']
export const DEFAULT_BATCH_SIZE = 1000

const TYPE_ORDER = new Map(TRANSFER_TYPES.map((item, index) => [item.type, index]))
const TABLE_IDENTIFIER_PLACEHOLDER = '__NTB_TABLE_IDENT_9F3C__'

export function getTransferTypeLabel(type) {
  return TRANSFER_TYPES.find((item) => item.type === type)?.label || ''
}

export function transferObjectKey(item) {
  if (!item?.type || !item?.name) return ''
  return `${item.type}:${item.name}`
}

export function applyNameCase(name, mode) {
  const value = String(name ?? '')
  if (mode === 'lower') return value.toLowerCase()
  if (mode === 'upper') return value.toUpperCase()
  return value
}

export function normalizeTransferObjects(items = []) {
  const seen = new Set()
  const result = []

  for (const item of items) {
    if (!item || !TYPE_ORDER.has(item.type)) continue
    const name = String(item.name || '').trim()
    if (!name) continue
    const key = `${item.type}:${name}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ type: item.type, name, detail: String(item.detail || '') })
  }

  return result.sort((left, right) => {
    const typeDiff = TYPE_ORDER.get(left.type) - TYPE_ORDER.get(right.type)
    return typeDiff || left.name.localeCompare(right.name)
  })
}

export function filterTransferObjects(objects = [], keyword = '') {
  const needle = String(keyword || '')
    .trim()
    .toLowerCase()
  if (!needle) return objects.slice()
  return objects.filter(
    (item) =>
      String(item.name || '')
        .toLowerCase()
        .includes(needle) ||
      String(item.detail || '')
        .toLowerCase()
        .includes(needle)
  )
}

export function groupTransferObjects(objects = []) {
  return TRANSFER_TYPES.map((type) => ({
    type: type.type,
    label: type.label,
    items: objects.filter((item) => item.type === type.type)
  })).filter((group) => group.items.length > 0)
}

export function parseBulkObjectNames(text, objects = []) {
  const tokens = String(text || '')
    .split(/[\s,;，；]+/)
    .map((token) => token.trim())
    .filter(Boolean)
  const selected = new Set()
  const unmatched = []

  for (const token of tokens) {
    const separator = token.indexOf(':')
    if (separator > 0) {
      const type = token.slice(0, separator)
      const name = token.slice(separator + 1)
      if (TYPE_ORDER.has(type)) {
        const matched = objects.find((item) => item.type === type && item.name === name)
        if (matched) selected.add(transferObjectKey(matched))
        else unmatched.push(token)
        continue
      }
    }

    const matches = objects.filter((item) => item.name === token)
    if (matches.length) {
      matches.forEach((item) => selected.add(transferObjectKey(item)))
    } else {
      unmatched.push(token)
    }
  }

  return { keys: Array.from(selected), unmatched }
}

export function normalizeTimeoutMode(value) {
  if (value === 'inherit') return 'inherit'
  const seconds = Math.floor(Number(value))
  return Number.isFinite(seconds) && seconds > 0 ? String(Math.min(3600, seconds)) : 'inherit'
}

export function normalizeTransferSettings(raw = {}) {
  const batchSize = Math.min(10000, Math.max(1, Math.floor(Number(raw.batchSize)) || DEFAULT_BATCH_SIZE))

  return {
    sourceConnection: String(raw.sourceConnection || ''),
    sourceDatabase: String(raw.sourceDatabase || ''),
    targetConnection: String(raw.targetConnection || ''),
    targetDatabase: String(raw.targetDatabase || ''),
    selectedObjects: Array.from(
      new Set(
        (Array.isArray(raw.selectedObjects) ? raw.selectedObjects : []).filter(
          (item) => typeof item === 'string' && item.includes(':')
        )
      )
    ),
    contentMode: CONTENT_MODES.includes(raw.contentMode) ? raw.contentMode : 'all',
    targetMode: TARGET_MODES.includes(raw.targetMode) ? raw.targetMode : 'append',
    tableNameCase: NAME_CASES.includes(raw.tableNameCase) ? raw.tableNameCase : 'keep',
    columnNameCase: NAME_CASES.includes(raw.columnNameCase) ? raw.columnNameCase : 'keep',
    batchSize,
    timeoutMode: normalizeTimeoutMode(raw.timeoutMode),
    maskPresets: normalizeMaskPresetKeys(raw.maskPresets)
  }
}

export function normalizeTransferTask(raw = {}) {
  return {
    name: String(raw.name || '').trim(),
    ...normalizeTransferSettings(raw)
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function quoteName(name) {
  return `\`${String(name).replace(/`/g, '``')}\``
}

export function quoteTransferIdentifier(name) {
  return quoteName(name)
}

export function quoteTransferTable(database, name) {
  return `${quoteName(database)}.${quoteName(name)}`
}

export function stripDefiner(ddl) {
  return String(ddl || '').replace(
    /\s+DEFINER\s*=\s*(?:`[^`]*`|'[^']*'|[\w%.@-]+)\s*@\s*(?:`[^`]*`|'[^']*'|[\w%.@-]+)/i,
    ''
  )
}

export function transformTableDdl(ddl, options = {}) {
  let text = String(ddl || '')
    .trim()
    .replace(/;\s*$/, '')
  if (!text) return ''

  const createMatch = /CREATE\s+TABLE\s+(?:`[^`]+`\.)?`([^`]+)`/i.exec(text)
  if (!createMatch) return text

  const sourceName = createMatch[1]
  const targetName = options.targetName || sourceName
  const columnCase = options.columnCase || 'keep'
  const tableNameCase = options.tableNameCase || 'keep'

  text =
    text.slice(0, createMatch.index) +
    `CREATE TABLE ${TABLE_IDENTIFIER_PLACEHOLDER}` +
    text.slice(createMatch.index + createMatch[0].length)

  if (tableNameCase !== 'keep') {
    // 外键引用的是其他表的名称，需与目标表名大小写保持一致，否则 Linux 下大小写敏感会报错
    text = text.replace(
      /(\bREFERENCES\s+)(?:`([^`]+)`\.)?`([^`]+)`/gi,
      (full, prefix, schema, name) =>
        `${prefix}${schema ? `${quoteName(schema)}.` : ''}${quoteName(applyNameCase(name, tableNameCase))}`
    )
  }

  if (columnCase !== 'keep') {
    const renamed = []
    text = text.replace(/^([ \t]*)`([^`]+)`([ \t]+)/gm, (full, indent, name, spacing) => {
      const cased = applyNameCase(name, columnCase)
      if (cased !== name) renamed.push([name, cased])
      return `${indent}${quoteName(cased)}${spacing}`
    })

    for (const [from, to] of renamed) {
      text = text.replace(new RegExp(`\`${escapeRegExp(from)}\``, 'g'), quoteName(to))
    }
  }

  return text.replace(TABLE_IDENTIFIER_PLACEHOLDER, quoteName(targetName))
}

export function transformViewDdl(ddl, options = {}) {
  const original = String(ddl || '')
    .trim()
    .replace(/;\s*$/, '')
  if (!original) return ''

  const nameMatch = /\bVIEW\s+(?:`[^`]+`\.)?`([^`]+)`/i.exec(original)
  const targetName = options.targetName || nameMatch?.[1] || ''
  let text = stripDefiner(original)

  if (targetName) {
    text = text.replace(/\bVIEW\s+(?:`[^`]+`\.)?`[^`]+`/i, `VIEW ${quoteName(targetName)}`)
  }

  return text.replace(/^CREATE\b/i, 'CREATE OR REPLACE')
}

export function sortTransferObjects(objects = []) {
  return normalizeTransferObjects(objects)
}

export function buildDropStatement(type, database, name) {
  const keywords = {
    view: 'VIEW',
    procedure: 'PROCEDURE',
    function: 'FUNCTION',
    trigger: 'TRIGGER',
    event: 'EVENT'
  }
  const keyword = keywords[type]
  if (!keyword) return ''
  return `DROP ${keyword} IF EXISTS ${quoteTransferTable(database, name)}`
}

export function buildTruncateStatement(database, tableName) {
  return `TRUNCATE TABLE ${quoteTransferTable(database, tableName)}`
}

export function remapRow(row, targetFields = []) {
  const mapping = new Map()
  for (const field of targetFields) {
    const name = field?.name
    if (!name) continue
    if (/GENERATED/i.test(String(field.extra || ''))) continue
    mapping.set(String(name).toLowerCase(), name)
  }

  const result = {}
  let matched = 0
  for (const [key, value] of Object.entries(row || {})) {
    const target = mapping.get(String(key).toLowerCase())
    if (!target) continue
    result[target] = value
    matched++
  }

  return matched ? result : null
}
