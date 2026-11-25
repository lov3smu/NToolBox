import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let configDir = ''

vi.mock('../src/main/utils/path', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getConfigPath: () => path.join(configDir, 'config.json') }
})

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  MANAGED_PROFILE_TYPE,
  MANAGED_PROFILE_VERSION,
  applyManagedSettings,
  deleteValueAtPath,
  getValueAtPath,
  parseManagedProfile,
  setValueAtPath
} from '../src/shared/managedProfile'
import {
  getManagedProfileInfo,
  getManagedSettings,
  initManagedProfile,
  readManagedProfileFilePreview,
  removeManagedProfileFile,
  writeManagedProfileFile
} from '../src/main/services/managedProfile'

function createProfile(overrides = {}) {
  return {
    type: MANAGED_PROFILE_TYPE,
    version: MANAGED_PROFILE_VERSION,
    name: '研发部标准配置',
    owner: '平台组',
    updated_at: '2026-11-27T00:00:00.000Z',
    settings: {
      ai: {
        provider: 'zhipu',
        keys: { zhipu: 'sk-should-not-leak' },
        agent: { tool_policy: 'high-risk', max_iterations: 6 }
      },
      database: { safe_mode: false, connections: [{ password: 'db-secret' }] },
      unsupported: { foo: 1 }
    },
    ...overrides
  }
}

describe('parseManagedProfile', () => {
  it('extracts only allowlisted settings and drops secrets', () => {
    const result = parseManagedProfile(JSON.stringify(createProfile()))
    expect(result.ok).toBe(true)
    const { profile } = result
    expect(profile.name).toBe('研发部标准配置')
    expect(profile.owner).toBe('平台组')
    expect(profile.paths).toEqual(['ai.provider', 'ai.agent', 'database.safe_mode'])
    expect(profile.settings.ai).toEqual({ provider: 'zhipu', agent: { tool_policy: 'high-risk', max_iterations: 6 } })
    expect(profile.settings.database).toEqual({ safe_mode: false })
    expect(profile.settings.unsupported).toBeUndefined()
    expect(JSON.stringify(profile.settings)).not.toContain('secret')
  })

  it('defaults the profile name and truncates metadata', () => {
    const payload = createProfile({ name: '   ', owner: 'x'.repeat(200), description: 'y'.repeat(600) })
    const result = parseManagedProfile(payload)
    expect(result.profile.name).toBe('团队托管配置')
    expect(result.profile.owner).toHaveLength(80)
    expect(result.profile.description).toHaveLength(500)
  })

  it('rejects malformed payloads', () => {
    expect(parseManagedProfile('{')).toEqual({ ok: false, code: 'format' })
    expect(parseManagedProfile({})).toEqual({ ok: false, code: 'type' })
    expect(parseManagedProfile(createProfile({ type: 'other' }))).toEqual({ ok: false, code: 'type' })
    expect(parseManagedProfile(createProfile({ version: 99 }))).toEqual({ ok: false, code: 'version' })
    expect(parseManagedProfile({ type: MANAGED_PROFILE_TYPE, version: 1 })).toEqual({
      ok: false,
      code: 'settings'
    })
    expect(
      parseManagedProfile({ type: MANAGED_PROFILE_TYPE, version: 1, settings: { ai: { temperature: 0.5 } } })
    ).toEqual({ ok: false, code: 'empty' })
  })
})

describe('applyManagedSettings', () => {
  it('overrides managed paths and keeps local values elsewhere', () => {
    const config = {
      ai: {
        provider: 'bailian',
        keys: { bailian: 'sk-local' },
        agent: { tool_policy: 'all', max_iterations: 10, max_plan_steps: 8 },
        temperature: 0.7
      },
      database: { safe_mode: true, page_size: 50 }
    }
    const parsed = parseManagedProfile(createProfile())
    applyManagedSettings(config, parsed.profile.settings)
    expect(config.ai.provider).toBe('zhipu')
    expect(config.ai.keys.bailian).toBe('sk-local')
    expect(config.ai.agent).toEqual({ tool_policy: 'high-risk', max_iterations: 6 })
    expect(config.ai.temperature).toBe(0.7)
    expect(config.database.safe_mode).toBe(false)
    expect(config.database.page_size).toBe(50)
  })

  it('ignores an empty managed payload', () => {
    const config = { ai: { provider: 'bailian' } }
    applyManagedSettings(config, null)
    expect(config.ai.provider).toBe('bailian')
  })
})

describe('managed profile path helpers', () => {
  it('reads and writes nested paths', () => {
    const target = {}
    setValueAtPath(target, 'ai.agent.tool_policy', 'high-risk')
    expect(getValueAtPath(target, 'ai.agent.tool_policy')).toBe('high-risk')
    expect(getValueAtPath(target, 'ai.missing.value')).toBeUndefined()
  })

  it('deletes nested paths and prunes empty parents', () => {
    const target = { ai: { provider: 'zhipu' }, database: { safe_mode: false, page_size: 50 } }
    deleteValueAtPath(target, 'database.safe_mode')
    expect(target.database).toEqual({ page_size: 50 })
    deleteValueAtPath(target, 'database.page_size')
    expect(target.database).toBeUndefined()
    expect(target.ai.provider).toBe('zhipu')
  })
})

describe('managed profile service', () => {
  beforeEach(async () => {
    configDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ntb-managed-profile-'))
  })

  afterEach(async () => {
    await fs.promises.rm(configDir, { recursive: true, force: true })
  })

  it('persists an active profile and clears it again', async () => {
    expect(await initManagedProfile()).toBeNull()
    expect(getManagedSettings()).toBeNull()
    expect(getManagedProfileInfo().active).toBe(false)

    const written = await writeManagedProfileFile({
      name: '研发部标准配置',
      owner: '平台组',
      updated_at: '2026-11-27T00:00:00.000Z',
      applied_at: '2026-11-27T01:00:00.000Z',
      source: { kind: 'url', value: 'https://example.com/profile.json' },
      settings: { ai: { provider: 'zhipu' }, database: { safe_mode: false } },
      restore: { ai: { provider: 'bailian' } }
    })
    expect(written.success).toBe(true)
    expect(written.info.active).toBe(true)
    expect(written.info.paths).toEqual(['ai.provider', 'database.safe_mode'])
    expect(written.info.source).toEqual({ kind: 'url', value: 'https://example.com/profile.json' })
    expect(getManagedSettings()).toEqual({ ai: { provider: 'zhipu' }, database: { safe_mode: false } })

    const filePath = path.join(configDir, 'managed-profile.json')
    const stored = JSON.parse(await fs.promises.readFile(filePath, 'utf8'))
    expect(stored.type).toBe(MANAGED_PROFILE_TYPE)
    expect(stored.restore).toEqual({ ai: { provider: 'bailian' } })

    const preview = await readManagedProfileFilePreview(filePath)
    expect(preview.success).toBe(true)
    expect(preview.profile.paths).toEqual(['ai.provider', 'database.safe_mode'])

    await removeManagedProfileFile()
    expect(getManagedSettings()).toBeNull()
    expect(getManagedProfileInfo().active).toBe(false)
    await expect(fs.promises.stat(filePath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a profile without supported settings', async () => {
    const result = await writeManagedProfileFile({ settings: { ai: { temperature: 0.2 } } })
    expect(result).toEqual({ success: false, code: 'empty' })
    expect(getManagedProfileInfo().active).toBe(false)
  })
})
