import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', isPackaged: false }
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: { transports: { file: {}, console: {} } },
    on: vi.fn(),
    setFeedURL: vi.fn()
  },
  CancellationToken: class {}
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    transports: { file: {}, console: {} }
  }
}))

vi.mock('../src/main/services/config.js', () => ({
  getConfig: vi.fn(() => ({}))
}))

import { getUpdateReleases } from '../src/main/services/updater.js'
import {
  UPDATE_CHECK_INTERVALS,
  DEFAULT_UPDATE_CHECK_INTERVAL_HOURS,
  normalizeUpdateCheckInterval
} from '../src/shared/updater.js'

function mockFetchResponse(payload, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn(async () => ({
    ok,
    status,
    json: async () => payload
  }))
}

describe('getUpdateReleases', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    delete global.fetch
  })

  it('normalizes stable releases and drops drafts and prereleases', async () => {
    mockFetchResponse([
      {
        tag_name: 'v1.3.0',
        name: 'v1.3.0',
        body: '## 更新\r\n- 新功能',
        published_at: '2026-11-15T11:30:08Z',
        html_url: 'https://github.com/lov3smu/NToolBox/releases/tag/v1.3.0',
        prerelease: false,
        draft: false
      },
      {
        tag_name: 'v1.4.0-beta.1',
        name: 'v1.4.0-beta.1',
        body: 'beta',
        published_at: '2026-11-20T00:00:00Z',
        html_url: 'https://github.com/lov3smu/NToolBox/releases/tag/v1.4.0-beta.1',
        prerelease: true,
        draft: false
      },
      {
        tag_name: 'v1.5.0',
        name: 'v1.5.0',
        body: 'draft',
        published_at: '2026-11-25T00:00:00Z',
        html_url: '',
        prerelease: false,
        draft: true
      },
      {
        tag_name: 'v1.2.2',
        name: 'v1.2.2',
        body: '',
        published_at: '2026-06-26T00:00:00Z',
        html_url: 'https://github.com/lov3smu/NToolBox/releases/tag/v1.2.2',
        prerelease: false,
        draft: false
      }
    ])

    const result = await getUpdateReleases()

    expect(result.success).toBe(true)
    expect(result.releases).toHaveLength(2)
    expect(result.releases[0]).toMatchObject({
      version: '1.3.0',
      tag: 'v1.3.0',
      name: 'v1.3.0',
      notes: '## 更新\n- 新功能',
      publishedAt: '2026-11-15T11:30:08Z',
      htmlUrl: 'https://github.com/lov3smu/NToolBox/releases/tag/v1.3.0'
    })
    expect(result.releases[1].version).toBe('1.2.2')
  })

  it('skips entries without a tag or name', async () => {
    mockFetchResponse([{ body: 'missing version' }, { tag_name: 'v1.3.0', body: '' }])

    const result = await getUpdateReleases()

    expect(result.success).toBe(true)
    expect(result.releases).toHaveLength(1)
    expect(result.releases[0].version).toBe('1.3.0')
  })

  it('returns an error result on HTTP failure', async () => {
    mockFetchResponse({}, { ok: false, status: 503 })

    const result = await getUpdateReleases()

    expect(result.success).toBe(false)
    expect(result.releases).toEqual([])
    expect(result.error).toContain('503')
  })

  it('returns an error result when the payload is not an array', async () => {
    mockFetchResponse({ message: 'Not Found' })

    const result = await getUpdateReleases()

    expect(result.success).toBe(false)
    expect(result.releases).toEqual([])
  })
})

describe('normalizeUpdateCheckInterval', () => {
  it('accepts only supported intervals', () => {
    expect(UPDATE_CHECK_INTERVALS).toEqual([1, 6, 24])
    expect(normalizeUpdateCheckInterval(6)).toBe(6)
    expect(normalizeUpdateCheckInterval('24')).toBe(24)
    expect(normalizeUpdateCheckInterval(12)).toBe(DEFAULT_UPDATE_CHECK_INTERVAL_HOURS)
    expect(normalizeUpdateCheckInterval(undefined)).toBe(DEFAULT_UPDATE_CHECK_INTERVAL_HOURS)
  })
})
