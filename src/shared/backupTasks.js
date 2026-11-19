export const BACKUP_FORMATS = Object.freeze([
  { value: 'sql', label: 'SQL（含结构）' },
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' }
])

export const BACKUP_SCHEDULE_MODES = Object.freeze([
  { value: 'interval', label: '按间隔' },
  { value: 'daily', label: '每天定时' }
])

const FORMAT_VALUES = BACKUP_FORMATS.map((item) => item.value)
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function sanitizeFileSegment(value) {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned.slice(0, 64) || 'backup'
}

export function normalizeBackupTask(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const mode = source.mode === 'daily' ? 'daily' : 'interval'
  const intervalMinutes = Math.min(10080, Math.max(5, Math.floor(Number(source.intervalMinutes) || 1440)))
  const time = TIME_PATTERN.test(String(source.time || '')) ? String(source.time) : '03:00'
  const task = {
    id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : '',
    name: String(source.name || '')
      .trim()
      .slice(0, 80),
    connection: String(source.connection || '').trim(),
    database: String(source.database || '').trim(),
    table: String(source.table || '')
      .trim()
      .slice(0, 128),
    format: FORMAT_VALUES.includes(source.format) ? source.format : 'sql',
    mode,
    intervalMinutes,
    time,
    maxRows: Math.min(1000000, Math.max(100, Math.floor(Number(source.maxRows) || 100000))),
    directory: typeof source.directory === 'string' ? source.directory.trim() : '',
    enabled: source.enabled !== false,
    createdAt: Number(source.createdAt) || 0,
    lastRunAt: Number(source.lastRunAt) || 0,
    lastStatus: source.lastStatus === 'success' || source.lastStatus === 'error' ? source.lastStatus : '',
    lastError: typeof source.lastError === 'string' ? source.lastError.slice(0, 500) : '',
    lastFile: typeof source.lastFile === 'string' ? source.lastFile : ''
  }
  return task
}

export function backupTaskScheduleLabel(task) {
  if (task.mode === 'daily') return `每天 ${task.time}`
  if (task.intervalMinutes % 60 === 0) return `每 ${task.intervalMinutes / 60} 小时`
  return `每 ${task.intervalMinutes} 分钟`
}

export function backupTaskDue(task, now = Date.now()) {
  if (!task.enabled || !task.connection || !task.database) return false
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

export function backupTaskNextRun(task, now = Date.now()) {
  if (!task.enabled) return 0
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
