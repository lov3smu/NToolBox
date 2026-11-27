export const MASK_LIMITS = Object.freeze({
  maxPresets: 12,
  maxMaskLength: 16
})

export const MASK_PRESETS = Object.freeze([
  {
    key: 'email',
    label: '邮箱',
    keywords: ['email', 'mail'],
    strategy: 'email'
  },
  {
    key: 'phone',
    label: '手机号',
    keywords: ['phone', 'mobile', 'tel'],
    strategy: 'partial',
    keepStart: 3,
    keepEnd: 4
  },
  {
    key: 'idcard',
    label: '证件号',
    keywords: ['id_card', 'idcard', 'id_no', 'identity', 'cert_no', '证件'],
    strategy: 'partial',
    keepStart: 4,
    keepEnd: 4
  },
  {
    key: 'bankcard',
    label: '银行卡',
    keywords: ['bank', 'card_no', 'cardno'],
    strategy: 'partial',
    keepStart: 4,
    keepEnd: 4
  },
  {
    key: 'name',
    label: '姓名',
    keywords: [
      'real_name',
      'realname',
      'full_name',
      'first_name',
      'last_name',
      'user_name',
      'username',
      'nickname',
      '姓名'
    ],
    exactKeywords: ['name'],
    strategy: 'name'
  },
  {
    key: 'address',
    label: '地址',
    keywords: ['address', 'addr', '地址'],
    strategy: 'full'
  },
  {
    key: 'ip',
    label: 'IP 地址',
    keywords: ['ip_address', 'ip_addr', 'ipaddr', 'remote_ip', 'client_ip', 'host_ip'],
    exactKeywords: ['ip'],
    strategy: 'ip'
  },
  {
    key: 'secret',
    label: '密钥/令牌',
    keywords: ['password', 'passwd', 'secret', 'token', 'api_key', 'apikey'],
    strategy: 'full'
  }
])

const PRESET_MAP = new Map(MASK_PRESETS.map((preset) => [preset.key, preset]))
const FULL_MASK = '******'

export function findMaskPreset(key) {
  return PRESET_MAP.get(String(key || '')) || null
}

export function normalizeMaskPresetKeys(keys) {
  const result = []
  for (const key of Array.isArray(keys) ? keys : []) {
    const preset = findMaskPreset(key)
    if (!preset || result.includes(preset.key)) continue
    result.push(preset.key)
    if (result.length >= MASK_LIMITS.maxPresets) break
  }
  return result
}

export function findColumnMaskPreset(columnName, presetKeys) {
  const lower = String(columnName || '').toLowerCase()
  if (!lower) return null
  for (const key of normalizeMaskPresetKeys(presetKeys)) {
    const preset = PRESET_MAP.get(key)
    if ((preset.exactKeywords || []).includes(lower)) return preset
    if (preset.keywords.some((keyword) => lower.includes(keyword))) return preset
  }
  return null
}

function maskRepeat(length) {
  return '*'.repeat(Math.min(Math.max(Math.floor(length), 0), MASK_LIMITS.maxMaskLength))
}

export function maskValue(value, preset) {
  if (value === null || value === undefined) return value
  if (!preset) return value
  const text = typeof value === 'string' ? value : String(value)
  if (!text) return text

  if (preset.strategy === 'email') {
    const at = text.lastIndexOf('@')
    if (at <= 0 || at === text.length - 1) return FULL_MASK
    return `${text.slice(0, 1)}***@${text.slice(at + 1)}`
  }

  if (preset.strategy === 'name') {
    return `${text.slice(0, 1)}${maskRepeat(Math.max(text.length - 1, 1))}`
  }

  if (preset.strategy === 'ip') {
    const parts = text.split('.')
    if (parts.length !== 4) return FULL_MASK
    return `${parts[0]}.${parts[1]}.*.*`
  }

  if (preset.strategy === 'partial') {
    const start = Math.max(Number(preset.keepStart) || 0, 0)
    const end = Math.max(Number(preset.keepEnd) || 0, 0)
    if (text.length <= start + end) return FULL_MASK
    const suffix = end > 0 ? text.slice(-end) : ''
    return `${text.slice(0, start)}${maskRepeat(text.length - start - end)}${suffix}`
  }

  return FULL_MASK
}

function collectColumns(rows) {
  const columns = []
  const seen = new Set()
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    for (const key of Object.keys(row)) {
      if (seen.has(key)) continue
      seen.add(key)
      columns.push(key)
    }
  }
  return columns
}

export function applyDataMasking(rows, presetKeys) {
  const keys = normalizeMaskPresetKeys(presetKeys)
  if (!keys.length || !Array.isArray(rows) || !rows.length) {
    return { rows: Array.isArray(rows) ? rows : [], maskedColumns: [] }
  }

  const presetByColumn = new Map()
  for (const column of collectColumns(rows)) {
    const preset = findColumnMaskPreset(column, keys)
    if (preset) presetByColumn.set(column, preset)
  }
  if (!presetByColumn.size) return { rows, maskedColumns: [] }

  const maskedRows = rows.map((row) => {
    if (!row || typeof row !== 'object') return row
    const next = { ...row }
    for (const [column, preset] of presetByColumn) {
      if (!Object.prototype.hasOwnProperty.call(row, column)) continue
      next[column] = maskValue(row[column], preset)
    }
    return next
  })

  return { rows: maskedRows, maskedColumns: Array.from(presetByColumn.keys()) }
}
