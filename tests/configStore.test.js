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
  it('migrates legacy plaintext secrets and encrypts them on write-back', async () => {
    await seedConfig()
    await loadConfig()

    expect(getConfig().appearance.theme).toBe('system')
    expect(getConfig().ai.keys.openai).toBe('sk-legacy')
    expect(getConfig().image_hosting.providers.github.token).toBe('ghp_secret')
    expect(getPublicConfig().ai.keys.openai).toBe(SECRET_MASK)
    expect(getPublicConfig().image_hosting.providers.github.token).toBe(SECRET_MASK)

    await expect(saveConfig({ appearance: { theme: 'dark' } })).resolves.toBe(true)

    const disk = readDisk()
    expect(disk.config_version).toBe(3)
    expect(disk.appearance.theme).toBe('dark')
    expect(disk.ai.keys.openai.startsWith('enc:')).toBe(true)
    expect(decode(disk.ai.keys.openai)).toBe('sk-legacy')
    expect(disk.ai.keys.bailian).toBe('')
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
        ai: { keys: publicConfig.ai.keys, persona: '测试人设' },
        image_hosting: publicConfig.image_hosting
      })
    ).resolves.toBe(true)

    const disk = readDisk()
    expect(disk.ai.persona).toBe('测试人设')
    expect(decode(disk.ai.keys.openai)).toBe('sk-legacy')
    expect(decode(disk.image_hosting.providers.github.token)).toBe('ghp_secret')
    expect(getConfig().ai.keys.openai).toBe('sk-legacy')
    expect(getConfig().ai.persona).toBe('测试人设')
    expect(getConfig().image_hosting.providers.github.token).toBe('ghp_secret')
  })

  it('keeps the plaintext values in memory after saving', async () => {
    await seedConfig()
    await loadConfig()
    await saveConfig({ appearance: { theme: 'dark' } })

    expect(getConfig().appearance.theme).toBe('dark')
    expect(getConfig().ai.keys.openai).toBe('sk-legacy')
    expect(getConfig().image_hosting.providers.github.token).toBe('ghp_secret')
  })
})

describe('config atomic writes', () => {
  it('serializes concurrent saves and merges each update', async () => {
    await seedConfig()
    await loadConfig()

    const results = await Promise.all([
      saveConfig({ appearance: { theme: 'dark' } }),
      saveConfig({ appearance: { font_size: 'large' } }),
      saveConfig({ ai: { persona: '并发保存' } })
    ])
    expect(results).toEqual([true, true, true])

    const disk = readDisk()
    expect(disk.appearance.theme).toBe('dark')
    expect(disk.appearance.font_size).toBe('large')
    expect(disk.ai.persona).toBe('并发保存')
    const leftovers = (await fs.promises.readdir(dir)).filter((name) => name.endsWith('.tmp'))
    expect(leftovers).toEqual([])
    expect(JSON.parse(fs.readFileSync(`${state.configPath}.bak`, 'utf8')).ai.persona).toBe('并发保存')
  })

  it('patchConfig merges partial updates based on the latest config', async () => {
    await seedConfig()
    await loadConfig()

    const results = await Promise.all([
      patchConfig({ appearance: { theme: 'light' } }),
      patchConfig({ appearance: { font_size: 'small' } }),
      patchConfig({ notifications: { upload_done: false } })
    ])
    expect(results).toEqual([true, true, true])

    const disk = readDisk()
    expect(disk.appearance.theme).toBe('light')
    expect(disk.appearance.font_size).toBe('small')
    expect(disk.ai.keys.openai).toBeDefined()
    expect(getConfig().notifications.upload_done).toBe(false)
  })

  it('patchConfig rejects non-object payloads without writing', async () => {
    await seedConfig()
    await loadConfig()

    await expect(patchConfig(null)).resolves.toBe(false)
    await expect(patchConfig(['theme'])).resolves.toBe(false)
    await expect(patchConfig('dark')).resolves.toBe(false)
    expect(readDisk().appearance.theme).toBe('system')
  })

  it('recovers from a corrupt config.json by reading the backup', async () => {
    await fs.promises.writeFile(state.configPath, '{broken', 'utf8')
    await fs.promises.writeFile(
      `${state.configPath}.bak`,
      JSON.stringify({ config_version: 2, appearance: { theme: 'dark', font_size: 'large' } }),
      'utf8'
    )

    const loaded = await loadConfig()
    expect(loaded.appearance.theme).toBe('dark')
    expect(loaded.appearance.font_size).toBe('large')
    expect(state.warn).toHaveBeenCalled()
  })
})

describe('config migration on load', () => {
  it('maps v1 keys to the current config version and writes it back', async () => {
    await seedConfig({
      base_path: '/tmp/scripts',
      developer_ch_name: '李四',
      ai_provider: 'deepseek',
      ai_persona: '运维专家',
      ai_agent_max_iterations: 10,
      ai_tool_policy: 'high-risk',
      database_safe_mode: false,
      database_page_size: 200,
      dbConnections: [{ id: 'c1', name: 'prod' }],
      dbConnectionGroups: ['生产', '生产'],
      dbTransferTasks: [{ id: 't1' }],
      db_backup_tasks: [{ id: 'b1', name: 'backup', cron: '0 1 * * *' }],
      memory_auto_capture: false,
      market_sources: { clawhub: 'https://mirror.example.com' }
    })

    const loaded = await loadConfig()
    expect(loaded.config_version).toBe(3)
    expect(loaded.sql_generator.base_path).toBe('/tmp/scripts')
    expect(loaded.sql_generator.developer.ch_name).toBe('李四')
    expect(loaded.ai.provider).toBe('deepseek')
    expect(loaded.ai.persona).toBe('运维专家')
    expect(loaded.ai.agent.max_iterations).toBe(20)
    expect(loaded.ai.agent.tool_policy).toBe('high-risk')
    expect(loaded.database.safe_mode).toBe(false)
    expect(loaded.database.page_size).toBe(200)
    expect(loaded.database.connections).toHaveLength(1)
    expect(loaded.database.connection_groups).toEqual(['生产'])
    expect(loaded.database.transfer_tasks).toEqual([{ id: 't1' }])
    expect(loaded.database.backup_tasks).toHaveLength(1)
    expect(loaded.memory.auto_capture).toBe(false)
    expect(loaded.network.market_sources.clawhub).toBe('https://mirror.example.com')

    const disk = readDisk()
    expect(disk.config_version).toBe(3)
    expect(disk.sql_generator.base_path).toBe('/tmp/scripts')
    expect(disk.ai.agent.max_iterations).toBe(20)
    expect(disk).not.toHaveProperty('ai_api_keys')
    expect(disk).not.toHaveProperty('base_path')
    expect(disk.app).not.toHaveProperty('base_path')
  })

  it('absorbs legacy bailian_api_key once into ai.keys', async () => {
    await seedConfig({ bailian_api_key: 'sk-bailian-legacy' })
    const loaded = await loadConfig()
    expect(loaded.ai.keys.bailian).toBe('sk-bailian-legacy')
    expect(decode(readDisk().ai.keys.bailian)).toBe('sk-bailian-legacy')
  })

  it('migrates v2 config to v3 and writes it back', async () => {
    const v2 = {
      config_version: 2,
      app: { base_path: '/tmp/scripts', developer: { ch_name: '王五', en_name: 'wangwu' }, text_edit_app: 'subl' },
      appearance: { theme: 'dark' }
    }
    await fs.promises.writeFile(state.configPath, JSON.stringify(v2), 'utf8')

    const loaded = await loadConfig()
    expect(loaded.appearance.theme).toBe('dark')
    expect(loaded.sql_generator.base_path).toBe('/tmp/scripts')
    expect(loaded.sql_generator.developer.ch_name).toBe('王五')
    expect(loaded.sql_generator.text_edit_app).toBe('subl')

    const disk = readDisk()
    expect(disk.config_version).toBe(3)
    expect(disk.app).not.toHaveProperty('base_path')
  })

  it('keeps v3 config untouched and does not rewrite the file', async () => {
    const v3 = { config_version: 3, appearance: { theme: 'dark' } }
    await fs.promises.writeFile(state.configPath, JSON.stringify(v3), 'utf8')
    const before = fs.statSync(state.configPath).mtimeMs

    const loaded = await loadConfig()
    expect(loaded.appearance.theme).toBe('dark')
    expect(fs.statSync(state.configPath).mtimeMs).toBe(before)
  })
})
