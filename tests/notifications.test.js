import { describe, it, expect } from 'vitest'
import { NOTIFICATION_ITEMS, NOTIFICATION_KEYS, normalizeNotificationConfig } from '../src/shared/notifications.js'

describe('notification config', () => {
  it('exposes a unique key for every notification item', () => {
    expect(NOTIFICATION_KEYS).toEqual(NOTIFICATION_ITEMS.map((item) => item.key))
    expect(new Set(NOTIFICATION_KEYS).size).toBe(NOTIFICATION_KEYS.length)
  })

  it('defaults every notification to enabled', () => {
    expect(normalizeNotificationConfig(null)).toEqual(Object.fromEntries(NOTIFICATION_KEYS.map((key) => [key, true])))
    expect(normalizeNotificationConfig({ upload_done: false }).upload_done).toBe(false)
  })

  it('drops unknown keys and coerces invalid values to enabled', () => {
    const result = normalizeNotificationConfig({ upload_done: 'no', backup_done: true, extra: false })
    expect(result).toEqual({
      ...Object.fromEntries(NOTIFICATION_KEYS.map((key) => [key, true])),
      backup_done: true
    })
    expect(result).not.toHaveProperty('extra')
  })
})
