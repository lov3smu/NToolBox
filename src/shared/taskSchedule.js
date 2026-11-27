import { HTTP_METHODS } from './httpClient.js'
import { normalizeRecipeSteps } from './recipes.js'

export const SCHEDULE_LIMITS = Object.freeze({
  max: 20,
  nameLength: 60,
  intervalMin: 5,
  intervalMax: 10080,
  headersLength: 4000,
  bodyLength: 20000,
  inputLength: 100000,
  summaryLength: 500
})

export const SCHEDULE_MODES = Object.freeze([
  { value: 'interval', label: '按间隔' },
  { value: 'daily', label: '每天定时' }
])

export const SCHEDULE_ACTIONS = Object.freeze([
  { value: 'http', label: '发送 HTTP 请求', hint: '按计划请求地址并记录状态码与耗时' },
  { value: 'recipe', label: '运行 Recipe', hint: '按步骤处理输入文本，结果写入输出目录' },
  { value: 'clipboard-clear', label: '清空剪贴板历史', hint: '定期清理剪贴板记录，保护隐私' }
])

const ACTION_VALUES = SCHEDULE_ACTIONS.map((item) => item.value)
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function createScheduledTaskId() {
  const random = Math.random().toString(36).slice(2, 8)
  return `task-${Date.now().toString(36)}-${random}`
}

export function scheduleModeLabel(task) {
  if (!task) return ''
  if (task.mode === 'daily') return `每天 ${task.time}`
  if (task.intervalMinutes % 60 === 0) return `每 ${task.intervalMinutes / 60} 小时`
  return `每 ${task.intervalMinutes} 分钟`
}

export function scheduleActionLabel(task) {
  return SCHEDULE_ACTIONS.find((item) => item.value === task?.action)?.label || ''
}

export function normalizeScheduledTask(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const action = ACTION_VALUES.includes(source.action) ? source.action : 'http'
  const mode = source.mode === 'daily' ? 'daily' : 'interval'
  const intervalMinutes = Math.min(
    SCHEDULE_LIMITS.intervalMax,
    Math.max(SCHEDULE_LIMITS.intervalMin, Math.floor(Number(source.intervalMinutes) || 60))
  )
  const time = TIME_PATTERN.test(String(source.time || '')) ? String(source.time) : '09:00'

  return {
    id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : '',
    name: String(source.name || '')
      .trim()
      .slice(0, SCHEDULE_LIMITS.nameLength),
    action,
    method: HTTP_METHODS.includes(String(source.method || '').toUpperCase())
      ? String(source.method).toUpperCase()
      : 'GET',
    url: typeof source.url === 'string' ? source.url.trim() : '',
    headers: typeof source.headers === 'string' ? source.headers.slice(0, SCHEDULE_LIMITS.headersLength) : '',
    body: typeof source.body === 'string' ? source.body.slice(0, SCHEDULE_LIMITS.bodyLength) : '',
    steps: normalizeRecipeSteps(source.steps),
    input: typeof source.input === 'string' ? source.input.slice(0, SCHEDULE_LIMITS.inputLength) : '',
    directory: typeof source.directory === 'string' ? source.directory.trim() : '',
    mode,
    intervalMinutes,
    time,
    enabled: source.enabled !== false,
    createdAt: Number(source.createdAt) || 0,
    lastRunAt: Number(source.lastRunAt) || 0,
    lastStatus: source.lastStatus === 'success' || source.lastStatus === 'error' ? source.lastStatus : '',
    lastError: typeof source.lastError === 'string' ? source.lastError.slice(0, SCHEDULE_LIMITS.summaryLength) : '',
    lastSummary:
      typeof source.lastSummary === 'string' ? source.lastSummary.slice(0, SCHEDULE_LIMITS.summaryLength) : ''
  }
}

export function normalizeScheduledTasks(raw) {
  if (!Array.isArray(raw)) return []
  const tasks = []
  const seen = new Set()
  for (const entry of raw) {
    if (tasks.length >= SCHEDULE_LIMITS.max) break
    const task = normalizeScheduledTask(entry)
    if (!task.id || seen.has(task.id)) continue
    seen.add(task.id)
    tasks.push(task)
  }
  return tasks
}

export function scheduledTaskReady(task) {
  if (!task || !task.enabled) return false
  if (task.action === 'http') return Boolean(task.url)
  if (task.action === 'recipe') return task.steps.length > 0 && Boolean(task.input)
  return task.action === 'clipboard-clear'
}

export function scheduledTaskDue(task, now = Date.now()) {
  if (!scheduledTaskReady(task)) return false
  const base = task.lastRunAt || task.createdAt || now
  if (task.mode === 'interval') {
    return now - base >= task.intervalMinutes * 60 * 1000
  }
  const [hour, minute] = task.time.split(':').map(Number)
  const anchor = new Date(now)
  anchor.setHours(hour, minute, 0, 0)
  let scheduled = anchor.getTime()
  if (now < scheduled) scheduled -= 24 * 60 * 60 * 1000
  const createdAt = task.createdAt || 0
  if (createdAt > scheduled) return false
  return !task.lastRunAt || task.lastRunAt < scheduled
}

export function scheduledTaskNextRun(task, now = Date.now()) {
  if (!task || !task.enabled) return 0
  if (task.mode === 'interval') {
    const base = task.lastRunAt || task.createdAt || now
    return base + task.intervalMinutes * 60 * 1000
  }
  const [hour, minute] = task.time.split(':').map(Number)
  const next = new Date(now)
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= now) next.setDate(next.getDate() + 1)
  return next.getTime()
}
