import fs from 'fs'
import path from 'path'
import { t } from '../i18n.js'
import { getLogDir } from '../../utils/path'
import { log } from '../../utils'
import { getConfig } from '../config.js'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_READ_BYTES = 4 * 1024 * 1024
const MAX_SQL_LENGTH = 500

let writing = Promise.resolve()

function getAuditLogPath() {
  return path.join(getLogDir(), 'database-audit.log')
}

function trimSql(sql) {
  const value = String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
  return value.length > MAX_SQL_LENGTH ? `${value.slice(0, MAX_SQL_LENGTH)}…` : value
}

async function rotateIfNeeded(filePath) {
  try {
    const stat = await fs.promises.stat(filePath)
    if (stat.size < MAX_FILE_BYTES) return
    const rotated = `${filePath}.1`
    await fs.promises.rm(rotated, { force: true })
    await fs.promises.rename(filePath, rotated)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

export function recordDbOperation(entry) {
  if (getConfig().database.operation_log_enabled === false) return Promise.resolve()
  const record = {
    time: Date.now(),
    connection: String(entry.connection || ''),
    database: String(entry.database || ''),
    table: String(entry.table || ''),
    action: String(entry.action || '')
      .toUpperCase()
      .slice(0, 40),
    sql: trimSql(entry.sql),
    success: entry.success !== false,
    duration: Number(entry.duration) || 0,
    rows: Number(entry.rows) || 0,
    source: String(entry.source || ''),
    error: entry.error ? String(entry.error).slice(0, 500) : '',
    readonlyBlocked: entry.readonlyBlocked === true
  }
  writing = writing
    .then(async () => {
      const filePath = getAuditLogPath()
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await rotateIfNeeded(filePath)
      await fs.promises.appendFile(filePath, `${JSON.stringify(record)}\n`, 'utf8')
    })
    .catch((error) => {
      log.warn('写入数据库操作日志失败:', error.message)
    })
  return writing
}

async function readRecentLines(filePath, maxBytes) {
  let handle
  try {
    handle = await fs.promises.open(filePath, 'r')
    const stat = await handle.stat()
    const start = Math.max(0, stat.size - maxBytes)
    const length = stat.size - start
    if (length <= 0) return []
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, start)
    const text = buffer.toString('utf8')
    const lines = text.split('\n')
    if (start > 0) lines.shift()
    return lines.filter(Boolean)
  } finally {
    await handle?.close()
  }
}

export async function queryDbOperationLog(options = {}) {
  const limit = Math.min(1000, Math.max(1, Math.floor(Number(options.limit) || 200)))
  const connection = String(options.connection || '').trim()
  const keyword = String(options.keyword || '')
    .trim()
    .toLowerCase()
  try {
    const lines = await readRecentLines(getAuditLogPath(), MAX_READ_BYTES)
    const entries = []
    for (let index = lines.length - 1; index >= 0 && entries.length < limit; index -= 1) {
      let record
      try {
        record = JSON.parse(lines[index])
      } catch {
        continue
      }
      if (connection && record.connection !== connection) continue
      if (keyword) {
        const haystack = `${record.sql} ${record.table} ${record.action} ${record.database}`.toLowerCase()
        if (!haystack.includes(keyword)) continue
      }
      entries.push(record)
    }
    return { success: true, entries, scanned: lines.length }
  } catch (error) {
    if (error.code === 'ENOENT') return { success: true, entries: [], scanned: 0 }
    log.error('读取数据库操作日志失败:', error)
    return { success: false, error: error.message || t('读取数据库操作日志失败'), entries: [] }
  }
}

export async function clearDbOperationLog() {
  try {
    await fs.promises.rm(getAuditLogPath(), { force: true })
    return { success: true }
  } catch (error) {
    log.error('清空数据库操作日志失败:', error)
    return { success: false, error: error.message || t('清空数据库操作日志失败') }
  }
}
