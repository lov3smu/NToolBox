import { describe, expect, it } from 'vitest'
import {
  normalizeScheduledTask,
  normalizeScheduledTasks,
  scheduledTaskDue,
  scheduledTaskNextRun,
  scheduledTaskReady,
  scheduleActionLabel,
  scheduleModeLabel,
  SCHEDULE_LIMITS
} from '../src/shared/taskSchedule.js'

const HOUR = 60 * 60 * 1000

describe('taskSchedule', () => {
  it('normalizes defaults and clamps interval', () => {
    const task = normalizeScheduledTask({ name: '  每日检查  ', intervalMinutes: 1 })
    expect(task.name).toBe('每日检查')
    expect(task.action).toBe('http')
    expect(task.method).toBe('GET')
    expect(task.mode).toBe('interval')
    expect(task.intervalMinutes).toBe(SCHEDULE_LIMITS.intervalMin)
    expect(task.time).toBe('09:00')
    expect(task.enabled).toBe(true)
  })

  it('clamps strings and step count', () => {
    const steps = Array.from({ length: 20 }, () => ({ type: 'codec', mode: 'base64', direction: 'encode' }))
    const task = normalizeScheduledTask({
      name: 'x'.repeat(200),
      headers: 'h'.repeat(10000),
      body: 'b'.repeat(50000),
      input: 'i'.repeat(200000),
      steps
    })
    expect(task.name.length).toBe(SCHEDULE_LIMITS.nameLength)
    expect(task.headers.length).toBe(SCHEDULE_LIMITS.headersLength)
    expect(task.body.length).toBe(SCHEDULE_LIMITS.bodyLength)
    expect(task.input.length).toBe(SCHEDULE_LIMITS.inputLength)
    expect(task.steps.length).toBe(12)
  })

  it('drops tasks without id and caps total', () => {
    const tasks = normalizeScheduledTasks([
      { id: '', name: 'a' },
      { id: 't1', name: 'a' },
      { id: 't1', name: 'dup' },
      ...Array.from({ length: 30 }, (_, index) => ({ id: `t${index + 2}`, name: `n${index}` }))
    ])
    expect(tasks.length).toBe(SCHEDULE_LIMITS.max)
    expect(tasks[0].id).toBe('t1')
    expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length)
  })

  it('labels schedule and action', () => {
    expect(scheduleModeLabel({ mode: 'interval', intervalMinutes: 30 })).toBe('每 30 分钟')
    expect(scheduleModeLabel({ mode: 'interval', intervalMinutes: 120 })).toBe('每 2 小时')
    expect(scheduleModeLabel({ mode: 'daily', time: '08:30' })).toBe('每天 08:30')
    expect(scheduleActionLabel({ action: 'recipe' })).toBe('运行 Recipe')
  })

  it('only considers ready and due tasks', () => {
    const now = Date.now()
    const httpTask = normalizeScheduledTask({
      id: 't1',
      action: 'http',
      url: '',
      createdAt: now - 2 * HOUR,
      intervalMinutes: 60
    })
    expect(scheduledTaskReady(httpTask)).toBe(false)
    expect(scheduledTaskDue(httpTask, now)).toBe(false)

    const ready = normalizeScheduledTask({
      id: 't1',
      action: 'http',
      url: 'https://example.com',
      createdAt: now - 2 * HOUR,
      intervalMinutes: 60
    })
    expect(scheduledTaskDue(ready, now)).toBe(true)
    expect(scheduledTaskNextRun(ready, now)).toBe(ready.createdAt + 60 * 60 * 1000)

    const disabled = normalizeScheduledTask({ ...ready, enabled: false })
    expect(scheduledTaskDue(disabled, now)).toBe(false)
    expect(scheduledTaskNextRun(disabled, now)).toBe(0)
  })

  it('daily tasks wait for the next matching time', () => {
    const now = new Date(2026, 10, 26, 10, 0, 0).getTime()
    const task = normalizeScheduledTask({
      id: 'd1',
      action: 'clipboard-clear',
      mode: 'daily',
      time: '09:00',
      createdAt: new Date(2026, 10, 26, 8, 0, 0).getTime()
    })
    // 创建时间早于今天 09:00 且尚未运行 → 首次检查补跑一次
    expect(scheduledTaskDue(task, now)).toBe(true)
    // 今天 09:00 已经跑过 → 明天再说
    expect(scheduledTaskDue({ ...task, lastRunAt: new Date(2026, 10, 26, 9, 0, 1).getTime() }, now)).toBe(false)
    // 创建于 09:00 之后 → 等到明天
    const createdLater = normalizeScheduledTask({ ...task, createdAt: new Date(2026, 10, 26, 9, 30, 0).getTime() })
    expect(scheduledTaskDue(createdLater, now)).toBe(false)

    const next = scheduledTaskNextRun(createdLater, now)
    expect(new Date(next).getHours()).toBe(9)
    expect(next).toBeGreaterThan(now)
  })
})
