import { CODEC_DIRECTIONS, CODEC_MODES, transformCodec } from './codec.js'
import { TEXT_OPERATIONS, transformText } from './textTools.js'

export const RECIPE_LIMITS = Object.freeze({
  max: 30,
  nameLength: 60,
  maxSteps: 12,
  textLength: 100000
})

export const RECIPE_STEP_TYPES = Object.freeze([
  { value: 'codec', label: '编码转换' },
  { value: 'text', label: '文本处理' }
])

export const RECIPE_ERROR_LABELS = Object.freeze({
  'invalid-base64': 'Base64 解码失败，请检查输入',
  'invalid-url': 'URL 编码内容无效，请检查输入',
  'invalid-utf8': '解码结果不是有效的 UTF-8 文本',
  'invalid-hex': '十六进制解码失败，请检查输入',
  'invalid-json': 'JSON 字符串解码失败，请检查输入',
  'unsupported-mode': '不支持的编码方式',
  'unsupported-step': '不支持的步骤类型'
})

const CODEC_MODE_IDS = CODEC_MODES.map((mode) => mode.id)
const TEXT_OPERATION_IDS = TEXT_OPERATIONS.map((operation) => operation.id)

export function createRecipeId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `recipe-${Date.now().toString(36)}-${random}`
}

export function normalizeRecipeStep(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.type === 'text') {
    if (!TEXT_OPERATION_IDS.includes(raw.operation)) return null
    return { type: 'text', operation: raw.operation }
  }
  const mode = CODEC_MODE_IDS.includes(raw.mode) ? raw.mode : 'base64'
  const direction = raw.direction === 'decode' ? 'decode' : 'encode'
  return { type: 'codec', mode, direction }
}

export function normalizeRecipeSteps(raw) {
  if (!Array.isArray(raw)) return []
  const steps = []
  for (const entry of raw) {
    if (steps.length >= RECIPE_LIMITS.maxSteps) break
    const step = normalizeRecipeStep(entry)
    if (step) steps.push(step)
  }
  return steps
}

export function recipeStepLabel(step) {
  if (!step || typeof step !== 'object') return ''
  if (step.type === 'text') {
    return TEXT_OPERATIONS.find((operation) => operation.id === step.operation)?.label || ''
  }
  const mode = CODEC_MODES.find((item) => item.id === step.mode)?.label || ''
  const direction = CODEC_DIRECTIONS.find((item) => item.id === step.direction)?.label || ''
  return `${mode} ${direction}`.trim()
}

export function createRecipeStep(type = 'codec') {
  if (type === 'text') return { type: 'text', operation: TEXT_OPERATIONS[0].id }
  return { type: 'codec', mode: CODEC_MODES[0].id, direction: 'decode' }
}

export function normalizeRecipe(raw) {
  if (!raw || typeof raw !== 'object') return null
  const steps = normalizeRecipeSteps(raw.steps)
  if (!steps.length) return null
  const name = typeof raw.name === 'string' ? raw.name.trim().slice(0, RECIPE_LIMITS.nameLength) : ''
  const now = Date.now()
  const createdAt = Number.isFinite(raw.createdAt) && raw.createdAt > 0 ? raw.createdAt : now
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : createRecipeId(),
    name,
    steps,
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) && raw.updatedAt > 0 ? raw.updatedAt : createdAt
  }
}

export function normalizeRecipes(raw) {
  if (!Array.isArray(raw)) return []
  const recipes = []
  const seen = new Set()
  for (const entry of raw) {
    if (recipes.length >= RECIPE_LIMITS.max) break
    const recipe = normalizeRecipe(entry)
    if (!recipe || seen.has(recipe.id)) continue
    seen.add(recipe.id)
    recipes.push(recipe)
  }
  return recipes
}

export function sortRecipes(recipes) {
  if (!Array.isArray(recipes)) return []
  return recipes.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export function runRecipeSteps(steps, text) {
  const list = normalizeRecipeSteps(steps)
  let value = typeof text === 'string' ? text.slice(0, RECIPE_LIMITS.textLength) : ''
  const trace = []
  for (let index = 0; index < list.length; index += 1) {
    const step = list[index]
    const label = recipeStepLabel(step)
    if (step.type === 'codec') {
      const result = transformCodec(step.mode, step.direction, value)
      if (!result.ok) {
        trace.push({ index, ok: false, label, error: result.error, value: '' })
        return { ok: false, error: result.error, stepIndex: index, steps: trace, value }
      }
      value = result.value
    } else {
      value = transformText(step.operation, value)
    }
    trace.push({ index, ok: true, label, value })
  }
  return { ok: true, value, steps: trace }
}
