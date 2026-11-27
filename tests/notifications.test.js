import { describe, it, expect } from 'vitest'
import {
  NOTIFICATION_CHANNEL_OPTIONS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_ITEMS,
  NOTIFICATION_KEYS,
  getNotificationLevel,
  normalizeNotificationChannel,
  normalizeNotificationConfig
} from '../src/shared/notifications.js'

describe('notification config', () => {
  it('exposes a unique key for every notification item', () => {
    expect(NOTIFICATION_KEYS).toEqual(NOTIFICATION_ITEMS.map((item) => item.key))
    expect(new Set(NOTIFICATION_KEYS).size).toBe(NOTIFICATION_KEYS.length)
  })

  it('offers a channel option for every supported channel', () => {
    expect(NOTIFICATION_CHANNEL_OPTIONS.map((option) => option.value)).toEqual([...NOTIFICATION_CHANNELS])
  })

  it('defaults every notification to the system channel', () => {
    expect(normalizeNotificationConfig(null)).toEqual(
      Object.fromEntries(NOTIFICATION_KEYS.map((key) => [key, 'system']))
    )
  })

  it('maps legacy booleans onto channels', () => {
    expect(normalizeNotificationChannel(true)).toBe('system')
    expect(normalizeNotificationChannel(false)).toBe('off')
    const result = normalizeNotificationConfig({ upload_done: false, backup_done: true })
    expect(result.upload_done).toBe('off')
    expect(result.backup_done).toBe('system')
  })

  it('keeps explicit channels and falls back to system for invalid values', () => {
    const result = normalizeNotificationConfig({
      upload_done: 'panel',
      backup_done: 'off',
      update_found: 'email',
      agent_done: 'system'
    })
    expect(result).toEqual({
      upload_done: 'panel',
      backup_done: 'off',
      update_found: 'system',
      agent_done: 'system',
      scheduled_task_done: 'system'
    })
  })

  it('drops unknown keys', () => {
    const result = normalizeNotificationConfig({ upload_done: 'panel', extra: false })
    expect(result).not.toHaveProperty('extra')
  })

  it('maps notification keys to levels', () => {
    expect(getNotificationLevel('upload_done')).toBe('success')
    expect(getNotificationLevel('update_found')).toBe('info')
    expect(getNotificationLevel('unknown')).toBe('info')
  })
})
