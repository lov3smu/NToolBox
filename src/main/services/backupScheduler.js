import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { log } from '../utils'
import { getConfig, saveConfig } from './config'
import { backupTaskDue, normalizeBackupTask, sanitizeFileSegment } from '../../shared/backupTasks.js'
import { createConnection, closeConnection, isConnectionActive, exportTableData, exportDatabaseData } from './database'
import { notify } from './notifications.js'
import { t } from './i18n.js'

const CHECK_INTERVAL = 60 * 1000
const runningTasks = new Set()
let timer = null

function createTaskId() {
  return `bak_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function formatTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`
}

function getTasks() {
  return Array.isArray(getConfig().database.backup_tasks) ? getConfig().database.backup_tasks : []
}

function resolveBackupDirectory(directory) {
  const fallback = path.join(app.getPath('documents'), 'NToolBox Backups')
  const value = String(directory || '').trim() || fallback
  if (!path.isAbsolute(value)) throw new Error(t('备份目录必须是绝对路径'))
  const resolved = path.resolve(value)
  if (path.dirname(resolved) === resolved) throw new Error(t('备份目录不能是磁盘根目录'))
  return resolved
}

function buildConnectionConfig(conn) {
  const config = {
    host: conn.host || 'localhost',
    port: Number(conn.port) || 3306,
    user: conn.user || 'root',
    password: conn.password,
    ssh: conn.ssh,
    ssl: conn.ssl
  }
  if (conn.charset) config.charset = conn.charset
  if (conn.enableConnectTimeout !== false) config.connectTimeout = conn.connectTimeout || 30
  return config
}

async function updateTaskStatus(id, patch) {
  const tasks = getTasks().map((task) => (task.id === id ? normalizeBackupTask({ ...task, ...patch }) : task))
  await saveConfig({ database: { backup_tasks: tasks } })
}

async function executeBackupTask(task, notifyOnFinish = true) {
  if (runningTasks.has(task.id)) return { success: false, error: t('任务正在执行中') }
  runningTasks.add(task.id)
  let temporaryConnection = false
  try {
    const conn = (getConfig().database.connections || []).find((item) => item.name === task.connection)
    if (!conn) throw new Error(t('连接不存在：{name}', { name: task.connection }))
    if (!task.database) throw new Error(t('请选择要备份的数据库'))

    const directory = resolveBackupDirectory(task.directory)

    if (!isConnectionActive(task.connection)) {
      if (!conn.savePassword && !conn.password) {
        throw new Error(t('连接未保存密码，请先连接该数据库或开启保存密码'))
      }
      const created = await createConnection(task.connection, buildConnectionConfig(conn))
      if (!created.success) throw new Error(created.error || t('创建连接失败'))
      temporaryConnection = true
    }

    const exported = task.table
      ? await exportTableData(task.connection, task.database, task.table, {
          format: task.format,
          maxRows: task.maxRows,
          includeStructure: true
        })
      : await exportDatabaseData(task.connection, task.database, {
          format: task.format,
          maxRows: task.maxRows
        })

    if (!exported.success) throw new Error(exported.error || t('导出数据失败'))

    await fs.promises.mkdir(directory, { recursive: true })
    const baseName = `${sanitizeFileSegment(task.name || task.database)}_${formatTimestamp()}`
    let target

    if (Array.isArray(exported.files)) {
      target = path.join(directory, baseName)
      await fs.promises.mkdir(target, { recursive: true })
      for (const file of exported.files) {
        await fs.promises.writeFile(path.join(target, `${sanitizeFileSegment(file.name)}.csv`), file.content, 'utf8')
      }
    } else {
      const extension = task.format === 'json' ? 'json' : 'sql'
      target = path.join(directory, `${baseName}.${extension}`)
      await fs.promises.writeFile(target, exported.content, 'utf8')
    }

    await updateTaskStatus(task.id, {
      lastRunAt: Date.now(),
      lastStatus: 'success',
      lastError: '',
      lastFile: target
    })
    log.info(`备份任务执行成功: ${task.name} -> ${target}`)
    if (notifyOnFinish) {
      void notify('backup_done', {
        title: t('数据库备份完成'),
        body: t('{name} 已备份到 {file}', { name: task.name, file: target })
      })
    }
    return {
      success: true,
      file: target,
      rowCount: exported.rowCount,
      truncated: exported.truncated,
      task: getTasks().find((item) => item.id === task.id) || null
    }
  } catch (error) {
    log.warn(`备份任务执行失败: ${task.name}:`, error.message)
    await updateTaskStatus(task.id, {
      lastRunAt: Date.now(),
      lastStatus: 'error',
      lastError: error.message || t('备份失败')
    })
    if (notifyOnFinish) {
      void notify('backup_done', {
        title: t('数据库备份失败'),
        body: t('{name}：{error}', { name: task.name, error: error.message || t('备份失败') })
      })
    }
    return { success: false, error: error.message || t('备份失败') }
  } finally {
    if (temporaryConnection) {
      try {
        await closeConnection(task.connection)
      } catch {
        // ignore - temporary connection may already be gone
      }
    }
    runningTasks.delete(task.id)
  }
}

async function checkDueTasks() {
  const now = Date.now()
  for (const task of getTasks()) {
    if (!backupTaskDue(task, now)) continue
    await executeBackupTask(task)
  }
}

export function startBackupScheduler() {
  if (timer) return
  const tick = () => {
    checkDueTasks().catch((error) => log.warn('检查备份任务失败:', error.message))
  }
  timer = setInterval(tick, CHECK_INTERVAL)
  if (typeof timer.unref === 'function') timer.unref()
  setTimeout(tick, 5000).unref?.()
  log.info('定时备份调度器已启动')
}

export function stopBackupScheduler() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

export function getBackupTasks() {
  return {
    success: true,
    tasks: getTasks(),
    defaultDirectory: path.join(app.getPath('documents'), 'NToolBox Backups')
  }
}

export async function saveBackupTask(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const existing = getTasks()
  const current = source.id ? existing.find((task) => task.id === source.id) : null
  const task = normalizeBackupTask({
    ...source,
    id: current?.id || source.id || createTaskId(),
    createdAt: current?.createdAt || source.createdAt || Date.now(),
    lastRunAt: current?.lastRunAt || 0,
    lastStatus: current?.lastStatus || '',
    lastError: current?.lastError || '',
    lastFile: current?.lastFile || ''
  })

  if (!task.name) return { success: false, error: t('请输入任务名称') }
  if (!task.connection) return { success: false, error: t('请选择连接') }
  if (!task.database) return { success: false, error: t('请选择数据库') }

  const tasks = current ? existing.map((item) => (item.id === task.id ? task : item)) : [...existing, task]
  const saved = await saveConfig({ database: { backup_tasks: tasks } })
  if (!saved) return { success: false, error: t('保存备份任务失败') }
  return { success: true, tasks: getTasks() }
}

export async function deleteBackupTask(id) {
  const tasks = getTasks().filter((task) => task.id !== id)
  const saved = await saveConfig({ database: { backup_tasks: tasks } })
  if (!saved) return { success: false, error: t('删除备份任务失败') }
  return { success: true, tasks: getTasks() }
}

export async function runBackupTaskNow(id) {
  const task = getTasks().find((item) => item.id === id)
  if (!task) return { success: false, error: t('备份任务不存在') }
  return executeBackupTask(task, false)
}
