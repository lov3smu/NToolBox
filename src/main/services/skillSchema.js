import { t } from './i18n.js'

const TYPE_VALIDATORS = {
  string: (value) => typeof value === 'string',
  integer: (value) => Number.isInteger(value),
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  boolean: (value) => typeof value === 'boolean',
  array: (value) => Array.isArray(value),
  object: (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isMissing(value) {
  return value === undefined || value === null || value === ''
}

function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

function describeType(value) {
  if (Array.isArray(value)) return 'array'
  return typeof value
}

export function normalizeSkillParams(schema, params) {
  if (!schema || typeof schema !== 'object') {
    return { params: params && typeof params === 'object' ? params : {} }
  }

  const input = params === undefined || params === null ? {} : params
  if (typeof input !== 'object' || Array.isArray(input)) {
    return { error: t('工具参数必须是 JSON 对象') }
  }

  const properties = schema.properties || {}
  const required = new Set(Array.isArray(schema.required) ? schema.required : [])
  const normalized = {}
  const errors = []

  for (const [key, property] of Object.entries(properties)) {
    let value = input[key]

    if (isMissing(value)) {
      if (property && property.default !== undefined) {
        value = cloneValue(property.default)
      } else if (required.has(key)) {
        errors.push(t('缺少必填参数：{p0}', { p0: key }))
        continue
      } else {
        continue
      }
    }

    if (property?.type) {
      const validator = TYPE_VALIDATORS[property.type]
      if (validator && !validator(value)) {
        errors.push(t('参数 {p0} 应为 {p1}，实际为 {p2}', { p0: key, p1: property.type, p2: describeType(value) }))
        continue
      }
    }

    if (Array.isArray(property?.enum) && !property.enum.includes(value)) {
      errors.push(t('参数 {p0} 取值无效，可选值：{p1}', { p0: key, p1: property.enum.join(t('、')) }))
      continue
    }

    if (typeof value === 'number') {
      if (typeof property?.minimum === 'number' && value < property.minimum) {
        errors.push(t('参数 {p0} 不能小于 {p1}', { p0: key, p1: property.minimum }))
        continue
      }
      if (typeof property?.maximum === 'number' && value > property.maximum) {
        errors.push(t('参数 {p0} 不能大于 {p1}', { p0: key, p1: property.maximum }))
        continue
      }
    }

    normalized[key] = value
  }

  for (const key of required) {
    if (!(key in normalized) && !errors.some((error) => error.includes(key))) {
      errors.push(t('缺少必填参数：{p0}', { p0: key }))
    }
  }

  if (errors.length > 0) {
    return { error: errors.join(t('；')) }
  }

  return { params: normalized }
}

export function renderPromptTemplate(template, params = {}) {
  const missing = new Set()

  const content = String(template || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
    const value = params[key]

    if (isMissing(value)) {
      missing.add(key)
      return ''
    }

    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })

  if (missing.size > 0) {
    return { error: t('缺少提示词参数：{p0}', { p0: [...missing].join(t('、')) }) }
  }

  return { content }
}
