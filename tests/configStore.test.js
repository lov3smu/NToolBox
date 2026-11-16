import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  configPath: '',
  installDir: '',
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
}))

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => state.installDir, isQuitting: false, quit: vi.fn() },
  dialog: { showErrorBox: vi.fn() }
}))

vi.mock('../src/main/utils/path.js', () => ({
  getConfigPath: () => state.configPath,
  getInstallDir: () => state.installDir
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: state.info, warn: state.warn, error: state.error, debug: state.debug }
}))

vi.mock('../src/main/utils/crypto.js', () => ({
  initCrypto: vi.fn(async () => {}),
  encrypt: (value) => `enc:${Buffer.from(String(value), 'utf8').toString('base64')}`,
  decrypt: (value) =>
    typeof value === 'string' && value.startsWith('enc:')
      ? Buffer.from(value.slice(4), 'base64').toString('utf8')
      : value,
  isEncrypted: (value) => typeof value === 'string' && value.startsWith('enc:'),
  encryptDbPassword: (value) => (value ? `enc:${Buffer.from(String(value), 'utf8').toString('base64')}` : ''),
  decryptDbPassword: (value) =>
    typeof value === 'string' && value.startsWith('enc:')
      ? Buffer.from(value.slice(4), 'base64').toString('utf8')
      : value
}))

import {
  getConfig,
  getPublicConfig,
  loadConfig,
  patchConfig,
  saveConfig,
  setConfig
} from '../src/main/services/config.js'
import { SECRET_MASK } from '../src/shared/secrets.js'

function decode(value) {
  return typeof value === 'string' && value.startsWith('enc:')
    ? Buffer.from(value.slice(4), 'base64').toString('utf8')
    : value
}

function readDisk() {
  return JSON.parse(fs.readFileSync(state.configPath, 'utf8'))
}

async function seedConfig(overrides = {}) {
  await fs.promises.writeFile(
    state.configPath,
    JSON.stringify({
      theme: 'system',
      ai_api_keys: { openai: 'sk-legacy', bailian: '' },
      image_hosting: {
        active: 'github',
        providers: { github: { token: 'ghp_secret', repo: 'owner/repo' } }
      },
      ...overrides
    }),
    'utf8'
  )
}

let dir

beforeEach(async () => {
  dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ntoolbox-config-'))
  state.installDir = dir
  state.configPath = path.join(dir, 'config.json')
  state.warn.mockClear()
  state.error.mockClear()
  setConfig({})
})

afterEach(async () => {
  await fs.promises.rm(dir, { recursive: true, force: true })
})

describe('config secret storage', () => {
  it('loads legacy plaintext secrets and encrypts them on the next save', async () => {
    await seedConfig()
    await loadConfig()

    expect(getConfig().ai_api_keys.openai).toBe('sk-legacy')
    expect(getConfig().image_hosting.providers.github.token).toBe('ghp_secret')
    expect(getPublicConfig().ai_api_keys.openai).toBe(SECRET_MASK)
    expect(getPublicConfig().image_hosting.providers.github.token).toBe(SECRET_MASK)

    await expect(saveConfig({ theme: 'dark' })).resolves.toBe(true)

    const disk = readDisk()
    expect(disk.ai_api_keys.openai.startsWith('enc:')).toBe(true)
    expect(decode(disk.ai_api_keys.openai)).toBe('sk-legacy')
    expect(disk.ai_api_keys.bailian).toBe('')
    expect(disk.image_hosting.providers.github.token.startsWith('enc:')).toBe(true)
    expect(decode(disk.image_hosting.providers.github.token)).toBe('ghp_secret')
    expect(disk.image_hosting.providers.github.repo).toBe('owner/repo')
    expect(fs.existsSync(`${state.configPath}.bak`)).toBe(true)
  })

  it('restores masked input from stored values instead of persisting the mask', async () => {
    await seedConfig()
    await loadConfig()
    const publicConfig = getPublicConfig()

    await expect(
      saveConfig({
        ai_api_keys: publicConfig.ai_api_keys,
        image_hosting: publicConfig.image_hosting,
        ai_persona: '测试人设'
      })
    ).resolves.toBe(true)

    const disk = readDisk()
    expect(disk.ai_persona).toBe('测试人设')
    expect(decode(disk.ai_api_keys.openai)).toBe('sk-legacy')
    expect(decode(disk.image_hosting.providers.github.token)).toBe('ghp_secret')
    expect(getConfig().ai_api_keys.openai).toBe('sk-legacy')
    expect(getConfig().image_hosting.providers.github.token).toBe('ghp_secret')
  })

  it('keeps the plaintext values in memory after saving', async () => {
    await seedConfig()
    await loadConfig()
    await saveConfig({ theme: 'dark' })

    expect(getConfig().theme).toBe('dark')
    expect(getConfig().ai_api_keys.openai).toBe('sk-legacy')
    expect(getConfig().image_hosting.providers.github.token).toBe('ghp_secret')
  })
})

describe('config atomic writes', () => {
  it('serializes concurrent saves and merges each update', async () => {
    await seedConfig()
    await loadConfig()

    const results = await Promise.all([
      saveConfig({ theme: 'dark' }),
      saveConfig({ font_size: 'large' }),
      saveConfig({ ai_persona: '并发保存' })
    ])
    expect(results).toEqual([true, true, true])

    const disk = readDisk()
    expect(disk.theme).toBe('dark')
    expect(disk.font_size).toBe('large')
    expect(disk.ai_persona).toBe('并发保存')
    const leftovers = (await fs.promises.readdir(dir)).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
    expect(JSON.parse(fs.readFileSync(`${state.configPath}.bak`, 'utf8')).ai_persona).toBe('并发保存')
  })

  it('patchConfig merges partial updates based on the latest config', async () => {
    await seedConfig()
    await loadConfig()

    const results = await Promise.all([
      patchConfig({ theme: 'light' }),
      patchConfig({ font_size: 'small' }),
      patchConfig({ notifications: { upload_done: false } })
    ])
    expect(results).toEqual([true, true, true])

    const disk = readDisk()
    expect(disk.theme).toBe('light')
    expect(disk.font_size).toBe('small')
    expect(disk.ai_api_keys.openai).toBeDefined()
    expect(getConfig().notifications.upload_done).toBe(false)
  })

  it('patchConfig rejects non-object payloads without writing', async () => {
    await seedConfig()
    await loadConfig()

    await expect(patchConfig(null)).resolves.toBe(false)
    await expect(patchConfig(['theme'])).resolves.toBe(false)
    await expect(patchConfig('dark')).resolves.toBe(false)
    expect(readDisk().theme).toBe('system')
  })

  it('recovers from a corrupt config.json by reading the backup', async () => {
    await fs.promises.writeFile(state.configPath, '{broken', 'utf8')
    await fs.promises.writeFile(
      `${state.configPath}.bak`,
      JSON.stringify({ theme: 'dark', font_size: 'large' }),
      'utf8'
    )

    const loaded = await loadConfig()
    expect(loaded.theme).toBe('dark')
    expect(loaded.font_size).toBe('large')
    expect(state.warn).toHaveBeenCalled()
  })
})
