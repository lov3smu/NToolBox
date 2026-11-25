import fs from 'fs'
import path from 'path'
import { log } from '../utils'
import { getDataDir } from '../utils/path'
import { writeFileAtomic } from '../utils/atomicFile'
import {
  createScheduledTaskId,
  normalizeScheduledTask,
  normalizeScheduledTasks,
  scheduledTaskDue,
  SCHEDULE_LIMITS
} from '../../shared/taskSchedule.js'
import { parseHeaderLines } from '../../shared/httpClient.js'
import { RECIPE_ERROR_LABELS, runRecipeSteps } from '../../shared/recipes.js'
import { sanitizeFileSegment } from '../../shared/backupTasks.js'
import { sendHttpRequest } from './httpClient.js'
import { resolveRequestSecrets } from './profiles.js'
import { clearClipboardHistory } from './clipboard.js'
import { notify } from './notifications.js'
import { t } from './i18n.js'

const CHECK_INTERVAL = 60 * 1000
const FILE_NAME = 'scheduled-tasks.json'
const running = new Set()

let tasks = null
let loading = null
let timer = null

function tasksPath() {
  return path.join(getDataDir(), FILE_NAME)
}

function defaultOutputDirectory() {
  return path.join(getDataDir(), 'scheduled-output')
}

async function loadTasks() {
  if (tasks) return tasks
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await fs.promises.readFile(tasksPath(), 'utf8')
        tasks = normalizeScheduledTasks(JSON.parse(raw)?.tasks)
      } catch {
        tasks = []
      }
      return tasks
    })()
  }
  return loading
}

async function persistTasks() {
  await fs.promises.mkdir(getDataDir(), { recursive: true })
  await writeFileAtomic(tasksPath(), JSON.stringify({ tasks }, null, 2), 'utf8')
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`
}

function formatBytes(size) {
  const value = Number(size) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function resolveOutputDirectory(directory) {
  const fallback = defaultOutputDirectory()
  const value = String(directory || '').trim() || fallback
  if (!path.isAbsolute(value)) throw new Error(t('输出目录必须是绝对路径'))
  const resolved = path.resolve(value)
  if (path.dirname(resolved) === resolved) throw new Error(t('输出目录不能是磁盘根目录'))
  return resolved
}

async function executeHttp(task) {
  const parsed = parseHeaderLines(task.headers)
  if (!parsed.ok) throw new Error(t('请求头格式无效，应为「名称: 值」'))
  const resolved = await resolveRequestSecrets({ url: task.url, headers: parsed.headers, body: task.body })
  if (!resolved.ok) throw new Error(resolved.error)
  const response = await sendHttpRequest({
    method: task.method,
    url: resolved.request.url,
    headers: resolved.request.headers,
    body: resolved.request.body
  })
  const summary = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''} · ${formatBytes(
    response.size
  )} · ${response.elapsedMs} ms`
  if (!response.success) throw new Error(response.error || t('请求失败'))
  if (!response.ok) {
    const error = new Error(summary)
    error.summary = summary
    throw error
  }
  return summary
}

async function executeRecipe(task) {
  const result = runRecipeSteps(task.steps, task.input)
  if (!result.ok) throw new Error(t(RECIPE_ERROR_LABELS[result.error] || '执行失败'))
  const directory = resolveOutputDirectory(task.directory)
  await fs.promises.mkdir(directory, { recursive: true })
  const file = path.join(directory, `${sanitizeFileSegment(task.name || 'recipe')}_${formatTimestamp()}.txt`)
  await fs.promises.writeFile(file, result.value, 'utf8')
  return t('已写入 {p0} 字符到 {p1}', { p0: result.value.length, p1: file })
}

async function executeTask(task, notifyOnFinish = true) {
  if (running.has(task.id)) return { success: false, error: t('任务正在执行中') }
  running.add(task.id)
  try {
    let summary = ''
    if (task.action === 'http') summary = await executeHttp(task)
    else if (task.action === 'recipe') summary = await executeRecipe(task)
    else if (task.action === 'clipboard-clear') {
      await clearClipboardHistory()
      summary = t('已清空剪贴板历史')
    } else {
      throw new Error(t('不支持的任务动作'))
    }
    await updateTaskStatus(task.id, { lastStatus: 'success', lastError: '', lastSummary: summary })
    log.info(`计划任务执行成功: ${task.name || task.id}`)
    if (notifyOnFinish) {
      void notify('scheduled_task_done', {
        title: t('计划任务完成'),
        body: t('{name}：{summary}', { name: task.name || task.id, summary })
      })
    }
    return { success: true, summary, task: findTask(task.id) }
  } catch (error) {
    const summary = error?.summary || ''
    await updateTaskStatus(task.id, {
      lastStatus: 'error',
      lastError: error?.message || t('执行失败'),
      lastSummary: summary
    })
    log.warn(`计划任务执行失败: ${task.name || task.id}:`, error?.message)
    if (notifyOnFinish) {
      void notify('scheduled_task_done', {
        title: t('计划任务失败'),
        body: t('{name}：{error}', { name: task.name || task.id, error: error?.message || t('执行失败') })
      })
    }
    return { success: false, error: error?.message || t('执行失败'), task: findTask(task.id) }
  } finally {
    running.delete(task.id)
  }
}

function findTask(id) {
  return (tasks || []).find((item) => item.id === id) || null
}

async function updateTaskStatus(id, patch) {
  tasks = (tasks || []).map((task) =>
    task.id === id ? normalizeScheduledTask({ ...task, ...patch, lastRunAt: Date.now() }) : task
  )
  await persistTasks()
}

async function checkDueTasks() {
  const list = await loadTasks()
  const now = Date.now()
  for (const task of list) {
    if (!scheduledTaskDue(task, now)) continue
    await executeTask(task)
  }
}

export function startScheduledTasks() {
  if (timer) return
  const tick = () => {
    checkDueTasks().catch((error) => log.warn('检查计划任务失败:', error.message))
  }
  timer = setInterval(tick, CHECK_INTERVAL)
  if (typeof timer.unref === 'function') timer.unref()
  setTimeout(tick, 5000).unref?.()
  log.info('计划任务调度器已启动')
}

export function stopScheduledTasks() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

export async function listScheduledTasks() {
  return { success: true, tasks: await loadTasks(), defaultDirectory: defaultOutputDirectory() }
}

export async function saveScheduledTask(raw) {
  const list = await loadTasks()
  const source = raw && typeof raw === 'object' ? raw : {}
  const current = source.id ? list.find((task) => task.id === source.id) : null
  const task = normalizeScheduledTask({
    ...source,
    id: current?.id || createScheduledTaskId(),
    createdAt: current?.createdAt || Date.now(),
    lastRunAt: current?.lastRunAt || 0,
    lastStatus: current?.lastStatus || '',
    lastError: current?.lastError || '',
    lastSummary: current?.lastSummary || ''
  })

  if (!task.name) return { success: false, error: t('请输入任务名称') }
  if (task.action === 'http') {
    if (!task.url) return { success: false, error: t('请填写请求地址') }
    try {
      const parsed = new URL(task.url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('invalid')
    } catch {
      return { success: false, error: t('请输入有效的 http(s) 请求地址') }
    }
  }
  if (task.action === 'recipe') {
    if (!task.steps.length) return { success: false, error: t('请添加至少一个步骤') }
    if (!task.input.trim()) return { success: false, error: t('请填写输入文本') }
  }
  if (!current && list.length >= SCHEDULE_LIMITS.max) {
    return { success: false, error: t('最多创建 {p0} 个计划任务', { p0: SCHEDULE_LIMITS.max }) }
  }

  tasks = current ? list.map((item) => (item.id === task.id ? task : item)) : [...list, task]
  await persistTasks()
  return { success: true, task, tasks }
}

export async function deleteScheduledTask(id) {
  const list = await loadTasks()
  tasks = list.filter((task) => task.id !== id)
  await persistTasks()
  return { success: true, tasks }
}

export async function runScheduledTaskNow(id) {
  const task = (await loadTasks()).find((item) => item.id === id)
  if (!task) return { success: false, error: t('任务不存在') }
  const result = await executeTask(task, false)
  return { ...result, tasks }
}
