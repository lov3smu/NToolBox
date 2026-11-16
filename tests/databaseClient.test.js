import { describe, expect, it } from 'vitest'
import {
  DATABASE_HISTORY_LIMITS,
  DATABASE_PAGE_SIZES,
  DATABASE_REFRESH_INTERVALS,
  DATABASE_TRANSFER_BATCH_SIZES,
  DEFAULT_DATABASE_HISTORY_LIMIT,
  DEFAULT_DATABASE_PAGE_SIZE,
  DEFAULT_DATABASE_REFRESH_INTERVAL,
  DEFAULT_DATABASE_TRANSFER_BATCH_SIZE,
  normalizeDatabasePageSize,
  normalizeDatabaseRefreshInterval,
  normalizeDatabaseTransferBatchSize,
  normalizeDatabaseHistoryLimit,
  normalizeDatabaseClientSettings
} from '../src/shared/databaseClient.js'

describe('database client settings', () => {
  it('accepts only supported page sizes', () => {
    expect(DATABASE_PAGE_SIZES).toEqual([50, 100, 200, 500])
    expect(normalizeDatabasePageSize(200)).toBe(200)
    expect(normalizeDatabasePageSize('50')).toBe(50)
    expect(normalizeDatabasePageSize(123)).toBe(DEFAULT_DATABASE_PAGE_SIZE)
    expect(normalizeDatabasePageSize(undefined)).toBe(DEFAULT_DATABASE_PAGE_SIZE)
  })

  it('accepts disabling auto refresh with 0', () => {
    expect(DATABASE_REFRESH_INTERVALS).toEqual([0, 2, 5, 10])
    expect(normalizeDatabaseRefreshInterval(0)).toBe(0)
    expect(normalizeDatabaseRefreshInterval('10')).toBe(10)
    expect(normalizeDatabaseRefreshInterval(3)).toBe(DEFAULT_DATABASE_REFRESH_INTERVAL)
    expect(normalizeDatabaseRefreshInterval(null)).toBe(DEFAULT_DATABASE_REFRESH_INTERVAL)
  })

  it('normalizes a grouped payload', () => {
    expect(
      normalizeDatabaseClientSettings({ pageSize: 500, refreshInterval: 0, transferBatchSize: 2000, historyLimit: 50 })
    ).toEqual({
      pageSize: 500,
      refreshInterval: 0,
      transferBatchSize: 2000,
      historyLimit: 50
    })
    expect(normalizeDatabaseClientSettings(null)).toEqual({
      pageSize: DEFAULT_DATABASE_PAGE_SIZE,
      refreshInterval: DEFAULT_DATABASE_REFRESH_INTERVAL,
      transferBatchSize: DEFAULT_DATABASE_TRANSFER_BATCH_SIZE,
      historyLimit: DEFAULT_DATABASE_HISTORY_LIMIT
    })
  })

  it('accepts only supported transfer batch sizes', () => {
    expect(DATABASE_TRANSFER_BATCH_SIZES).toEqual([100, 500, 1000, 2000, 5000])
    expect(normalizeDatabaseTransferBatchSize(500)).toBe(500)
    expect(normalizeDatabaseTransferBatchSize('2000')).toBe(2000)
    expect(normalizeDatabaseTransferBatchSize(1)).toBe(DEFAULT_DATABASE_TRANSFER_BATCH_SIZE)
    expect(normalizeDatabaseTransferBatchSize(null)).toBe(DEFAULT_DATABASE_TRANSFER_BATCH_SIZE)
  })

  it('accepts only supported history limits', () => {
    expect(DATABASE_HISTORY_LIMITS).toEqual([50, 100, 200, 500])
    expect(normalizeDatabaseHistoryLimit(100)).toBe(100)
    expect(normalizeDatabaseHistoryLimit('500')).toBe(500)
    expect(normalizeDatabaseHistoryLimit(0)).toBe(DEFAULT_DATABASE_HISTORY_LIMIT)
    expect(normalizeDatabaseHistoryLimit('')).toBe(DEFAULT_DATABASE_HISTORY_LIMIT)
  })
})
