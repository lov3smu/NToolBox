import { describe, it, expect } from 'vitest'
import {
  backupTaskDue,
  backupTaskNextRun,
  backupTaskScheduleLabel,
  normalizeBackupTask,
  sanitizeFileSegment
} from '../src/shared/backupTasks.js'

describe('backup task helpers', () => {
  it('normalizes defaults and invalid values', () => {
    const task = normalizeBackupTask({ name: ' nightly ', connection: ' prod ', database: 'db', format: 'nope' })
    expect(task.name).toBe('nightly')
    expect(task.connection).toBe('prod')
    expect(task.format).toBe('sql')
    expect(task.mode).toBe('interval')
    expect(task.intervalMinutes).toBe(1440)
    expect(task.time).toBe('03:00')
    expect(task.enabled).toBe(true)
  })

  it('clamps interval and maxRows bounds', () => {
    expect(normalizeBackupTask({ intervalMinutes: 1 }).intervalMinutes).toBe(5)
    expect(normalizeBackupTask({ intervalMinutes: 999999 }).intervalMinutes).toBe(10080)
    expect(normalizeBackupTask({ maxRows: 5 }).maxRows).toBe(100)
    expect(normalizeBackupTask({ maxRows: 2e9 }).maxRows).toBe(1000000)
  })

  it('formats schedule labels', () => {
    expect(backupTaskScheduleLabel({ mode: 'daily', time: '02:30' })).toBe('每天 02:30')
    expect(backupTaskScheduleLabel({ mode: 'interval', intervalMinutes: 120 })).toBe('每 2 小时')
    expect(backupTaskScheduleLabel({ mode: 'interval', intervalMinutes: 45 })).toBe('每 45 分钟')
  })

  it('sanitizes file segments', () => {
    expect(sanitizeFileSegment('my db/name:*?')).toBe('my_db_name')
    expect(sanitizeFileSegment('   ')).toBe('backup')
  })

  it('detects interval tasks as due after the interval', () => {
    const now = Date.now()
    const task = normalizeBackupTask({ connection: 'prod', database: 'db', intervalMinutes: 60 })
    task.createdAt = now - 59 * 60 * 1000
    task.lastRunAt = 0
    expect(backupTaskDue(task, now)).toBe(false)
    task.createdAt = now - 61 * 60 * 1000
    expect(backupTaskDue(task, now)).toBe(true)
    task.lastRunAt = now - 30 * 60 * 1000
    expect(backupTaskDue(task, now)).toBe(false)
  })

  it('detects daily tasks using the most recent scheduled time', () => {
    const today = new Date()
    today.setHours(10, 0, 0, 0)
    const now = today.getTime()
    const task = normalizeBackupTask({ connection: 'prod', database: 'db', mode: 'daily', time: '09:00' })
    task.createdAt = now - 24 * 60 * 60 * 1000
    expect(backupTaskDue(task, now)).toBe(true)
    task.lastRunAt = now - 30 * 60 * 1000
    expect(backupTaskDue(task, now)).toBe(false)
    task.lastRunAt = 0
    task.createdAt = now - 5 * 60 * 1000
    expect(backupTaskDue(task, now)).toBe(false)
  })

  it('ignores disabled or incomplete tasks', () => {
    const base = { connection: 'prod', database: 'db', intervalMinutes: 5 }
    expect(backupTaskDue(normalizeBackupTask({ ...base, enabled: false }), Date.now())).toBe(false)
    expect(backupTaskDue(normalizeBackupTask({ database: 'db' }), Date.now())).toBe(false)
  })

  it('computes next run timestamps', () => {
    const now = new Date()
    now.setHours(10, 0, 0, 0)
    const intervalTask = normalizeBackupTask({ connection: 'prod', database: 'db', intervalMinutes: 60 })
    intervalTask.lastRunAt = now.getTime() - 10 * 60 * 1000
    expect(backupTaskNextRun(intervalTask, now.getTime())).toBe(now.getTime() + 50 * 60 * 1000)

    const dailyTask = normalizeBackupTask({ connection: 'prod', database: 'db', mode: 'daily', time: '09:00' })
    const next = backupTaskNextRun(dailyTask, now.getTime())
    const nextDate = new Date(next)
    expect(nextDate.getHours()).toBe(9)
    expect(nextDate.getDate()).toBe(new Date(now.getTime() + 24 * 60 * 60 * 1000).getDate())
  })
})
