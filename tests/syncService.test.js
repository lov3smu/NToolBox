import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mergeConfig } from '../src/main/services/configMigrations'

let configDir = ''
let syncDir = ''

vi.mock('../src/main/utils/path', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, getConfigPath: () => path.join(configDir, 'config.json') }
})

vi.mock('../src/main/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../src/main/services/config', () => ({
  getConfig: () => globalThis.__syncConfig,
  saveConfig: (patch) => {
    globalThis.__syncConfig = mergeConfig(globalThis.__syncConfig, patch)
    return Promise.resolve(true)
  }
}))

vi.mock('../src/main/utils/crypto', () => ({
  encrypt: (value) => `enc:${Buffer.from(value, 'utf8').toString('base64')}`,
  decrypt: (value) => (value.startsWith('enc:') ? Buffer.from(value.slice(4), 'base64').toString('utf8') : '')
}))

import {
  clearSync,
  getSyncStatus,
  getSyncStatePath,
  previewSync,
  setSyncAutoSync,
  setSyncDeviceName,
  setSyncDirectory,
  setSyncPassphrase,
  setSyncSections,
  syncNow
} from '../src/main/services/syncService'
import { encryptSnapshotText } from '../src/main/services/syncCrypto'
import { SYNC_FILE_NAME, SYNC_MAX_BYTES, buildSyncSnapshot, parseSyncSnapshot } from '../src/shared/syncBundle.js'

function createConfig() {
  return {
    app: { shortcuts: { settings: 'CmdOrCtrl+,' } },
    appearance: { theme: 'system', theme_style: 'sapphire', font_size: 'medium', language: 'zh-CN' },
    notifications: { upload_done: 'system' },
    clipboard_history: { persist: true, max_entries: 120 },
    network: {
      proxy: { mode: 'manual', url: 'http://user:pass@127.0.0.1:7890', bypass: '' },
      market_sources: { clawhub: 'https://clawhub.example.com' }
    },
    database: {
      safe_mode: true,
      page_size: 100,
      audit: { enabled: false, strict: false, rules: {} },
      editor: { theme: 'dark' },
      connections: [{ name: 'prod', password: 'db-secret' }]
    },
    sql_generator: {
      base_path: '/home/user/scripts',
      developer: { ch_name: '张三', en_name: 'zhangsan' },
      databases: ['demo'],
      script_types: []
    },
    ai: {
      keys: { openai: 'sk-secret' },
      persona: '简洁',
      agent: { tool_policy: 'high-risk', scenario_models: { planner: 'openai:gpt' } }
    },
    memory: { auto_capture: true },
    extensions: { mcp_servers: [{ name: 'gh', token: 'mcp-secret' }] }
  }
}

function readSyncFile() {
  return JSON.parse(fs.readFileSync(path.join(syncDir, SYNC_FILE_NAME), 'utf8'))
}

function writeSyncFile(snapshot) {
  fs.writeFileSync(path.join(syncDir, SYNC_FILE_NAME), JSON.stringify(snapshot, null, 2), 'utf8')
}

beforeEach(() => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntb-sync-cfg-'))
  syncDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntb-sync-dir-'))
  globalThis.__syncConfig = createConfig()
})

afterEach(() => {
  fs.rmSync(configDir, { recursive: true, force: true })
  fs.rmSync(syncDir, { recursive: true, force: true })
})

describe('跨设备同步服务', () => {
  it('校验同步文件夹并持久化状态', async () => {
    expect((await setSyncDirectory('relative/dir')).code).toBe('invalid-directory')
    expect((await setSyncDirectory(path.join(syncDir, 'missing'))).code).toBe('invalid-directory')

    const result = await setSyncDirectory(syncDir)
    expect(result.success).toBe(true)
    expect(result.status.configured).toBe(true)
    expect((await getSyncStatus()).directory).toBe(syncDir)
    expect(fs.statSync(getSyncStatePath()).mode & 0o777).toBe(0o600)
  })

  it('未配置文件夹时拒绝同步', async () => {
    const result = await syncNow()
    expect(result.success).toBe(false)
    expect(result.code).toBe('not-configured')
  })

  it('首次同步写入快照且不包含密钥、连接与 MCP 凭据', async () => {
    await setSyncDirectory(syncDir)
    const result = await syncNow()

    expect(result.success).toBe(true)
    const raw = fs.readFileSync(path.join(syncDir, SYNC_FILE_NAME), 'utf8')
    expect(raw).not.toContain('sk-secret')
    expect(raw).not.toContain('db-secret')
    expect(raw).not.toContain('mcp-secret')
    expect(raw).not.toContain('user:pass')
    expect(raw).not.toContain('connections')
    expect(raw).not.toContain('scenario_models')
    expect(raw).not.toContain('/home/user/scripts')

    const parsed = parseSyncSnapshot(raw)
    expect(parsed.ok).toBe(true)
    expect(parsed.snapshot.sections.appearance.values.theme).toBe('system')
    expect(parsed.snapshot.sections.ai.values.keys).toBeUndefined()
    expect((await getSyncStatus()).lastSyncAt).toBeTruthy()
  })

  it('无变化时重复同步不应用也不推送', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()
    const before = fs.statSync(path.join(syncDir, SYNC_FILE_NAME)).mtimeMs

    const result = await syncNow()
    expect(result.success).toBe(true)
    expect(result.applied).toEqual([])
    expect(result.pushed).toEqual([])
    expect(fs.statSync(path.join(syncDir, SYNC_FILE_NAME)).mtimeMs).toBe(before)
  })

  it('远端较新的分区应用到本机，且忽略注入的未知字段', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()

    const snapshot = readSyncFile()
    snapshot.device = { id: 'other-device', name: '笔记本' }
    snapshot.sections.appearance = {
      updated_at: Date.now() + 600000,
      values: { theme: 'dark', theme_style: 'forest', font_size: 'large', language: 'en-US', sneaky: 'evil' }
    }
    writeSyncFile(snapshot)

    const result = await syncNow()
    expect(result.success).toBe(true)
    expect(result.applied).toContain('appearance')
    expect(result.pushed).toEqual([])
    expect(globalThis.__syncConfig.appearance.theme).toBe('dark')
    expect(globalThis.__syncConfig.appearance.language).toBe('en-US')
    expect(globalThis.__syncConfig.appearance.sneaky).toBeUndefined()
    expect((await getSyncStatus()).lastResult.remoteDevice).toBe('笔记本')
  })

  it('本机较新的分区推送到同步文件', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()

    const snapshot = readSyncFile()
    snapshot.sections.appearance = {
      updated_at: 1,
      values: { theme: 'light', theme_style: 'bee', font_size: 'small', language: 'zh-CN' }
    }
    writeSyncFile(snapshot)
    globalThis.__syncConfig.appearance.theme = 'dark'

    const result = await syncNow()
    expect(result.success).toBe(true)
    expect(result.pushed).toContain('appearance')
    expect(result.applied).toEqual([])
    expect(readSyncFile().sections.appearance.values.theme).toBe('dark')
  })

  it('两端都修改时按较新修改合并并报告冲突', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()

    const snapshot = readSyncFile()
    snapshot.sections.appearance = {
      updated_at: Date.now() + 600000,
      values: { theme: 'light', theme_style: 'bee', font_size: 'small', language: 'zh-CN' }
    }
    writeSyncFile(snapshot)
    globalThis.__syncConfig.appearance.theme = 'dark'

    const result = await syncNow()
    expect(result.success).toBe(true)
    expect(result.conflicts).toContain('appearance')
    expect(globalThis.__syncConfig.appearance.theme).toBe('light')
    expect((await getSyncStatus()).lastResult.conflicts).toContain('appearance')
  })

  it('新设备首次同步以共享文件为准，不用默认值覆盖远端', async () => {
    writeSyncFile({
      type: 'ntoolbox-sync',
      version: 1,
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      device: { id: 'other-device', name: '办公台式' },
      sections: {
        appearance: {
          updated_at: Date.now() - 3600000,
          values: { theme: 'dark', theme_style: 'forest', font_size: 'large', language: 'zh-CN' }
        }
      }
    })
    await setSyncDirectory(syncDir)

    const result = await syncNow()
    expect(result.success).toBe(true)
    expect(result.applied).toContain('appearance')
    expect(globalThis.__syncConfig.appearance.theme).toBe('dark')
    expect(readSyncFile().sections.appearance.values.theme).toBe('dark')
    expect(readSyncFile().sections.appearance.values.font_size).toBe('large')
  })

  it('同步文件损坏时保留原文件且不写入', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()
    const remotePath = path.join(syncDir, SYNC_FILE_NAME)
    fs.writeFileSync(remotePath, '{ broken', 'utf8')
    const before = fs.statSync(remotePath).mtimeMs

    const result = await syncNow()
    expect(result.success).toBe(false)
    expect(result.code).toBe('remote-invalid')
    expect(fs.readFileSync(remotePath, 'utf8')).toBe('{ broken')
    expect(fs.statSync(remotePath).mtimeMs).toBe(before)
  })

  it('停止同步后清除本机同步状态但保留共享文件夹中的文件', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()

    const result = await clearSync()
    expect(result.success).toBe(true)
    expect(result.status.configured).toBe(false)
    expect(fs.existsSync(getSyncStatePath())).toBe(false)
    expect(fs.existsSync(path.join(syncDir, SYNC_FILE_NAME))).toBe(true)
    expect((await syncNow()).code).toBe('not-configured')
  })

  it('同步预览只计算结果，不修改本机配置与共享文件', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()

    const remotePath = path.join(syncDir, SYNC_FILE_NAME)
    const before = fs.readFileSync(remotePath, 'utf8')
    const snapshot = readSyncFile()
    snapshot.sections.appearance = {
      updated_at: Date.now() + 600000,
      values: { theme: 'dark', theme_style: 'forest', font_size: 'large', language: 'zh-CN' }
    }
    writeSyncFile(snapshot)
    const remoteBefore = fs.readFileSync(remotePath, 'utf8')

    const preview = await previewSync()
    expect(preview.success).toBe(true)
    expect(preview.applied).toContain('appearance')
    expect(preview.pushed).toEqual([])
    expect(globalThis.__syncConfig.appearance.theme).toBe('system')
    expect(fs.readFileSync(remotePath, 'utf8')).toBe(remoteBefore)

    fs.writeFileSync(remotePath, before, 'utf8')
    const idle = await previewSync()
    expect(idle.applied).toEqual([])
    expect(idle.pushed).toEqual([])
  })

  it('共享文件损坏且可恢复时，强制同步先备份原文件再用本机覆盖', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()
    const remotePath = path.join(syncDir, SYNC_FILE_NAME)
    fs.writeFileSync(remotePath, '{ broken', 'utf8')

    const preview = await previewSync()
    expect(preview.success).toBe(false)
    expect(preview.code).toBe('remote-invalid')
    expect(preview.recoverable).toBe(true)

    const result = await syncNow({ force: true })
    expect(result.success).toBe(true)
    expect(result.backupPath).toBeTruthy()
    expect(result.backupPath.startsWith(`${remotePath}.broken-`)).toBe(true)
    expect(fs.readFileSync(result.backupPath, 'utf8')).toBe('{ broken')
    expect(parseSyncSnapshot(fs.readFileSync(remotePath, 'utf8')).ok).toBe(true)
  })

  it('共享文件超过 1 MB 时拒绝读取并标记为可覆盖', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()
    fs.writeFileSync(path.join(syncDir, SYNC_FILE_NAME), 'x'.repeat(SYNC_MAX_BYTES + 16), 'utf8')

    const result = await syncNow()
    expect(result.success).toBe(false)
    expect(result.code).toBe('remote-size')
    expect(result.recoverable).toBe(true)
    expect((await previewSync()).code).toBe('remote-size')
  })

  it('设置口令后共享文件加密，缺少口令时拒绝读取', async () => {
    await setSyncDirectory(syncDir)
    const setResult = await setSyncPassphrase('pw-123')
    expect(setResult.success).toBe(true)
    expect(setResult.status.passphraseSet).toBe(true)

    globalThis.__syncConfig.appearance.theme = 'dark'
    const result = await syncNow()
    expect(result.success).toBe(true)
    const raw = fs.readFileSync(path.join(syncDir, SYNC_FILE_NAME), 'utf8')
    expect(raw).toContain('"encrypted":true')
    expect(raw).not.toContain('appearance')
    expect((await getSyncStatus()).remoteEncrypted).toBe(true)

    await setSyncPassphrase('')
    const locked = await syncNow()
    expect(locked.success).toBe(false)
    expect(locked.code).toBe('locked')
    expect(locked.recoverable).toBe(true)
    expect((await previewSync()).code).toBe('locked')

    await setSyncPassphrase('pw-123')
    expect((await previewSync()).success).toBe(true)
    expect((await syncNow()).success).toBe(true)
  })

  it('本机设置口令但共享文件为明文时拒绝同步，可备份后覆盖', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()
    await setSyncPassphrase('pw-456')

    const plain = await syncNow()
    expect(plain.success).toBe(false)
    expect(plain.code).toBe('plaintext')
    expect(plain.recoverable).toBe(true)

    const result = await syncNow({ force: true })
    expect(result.success).toBe(true)
    expect(fs.readFileSync(result.backupPath, 'utf8')).toBeTruthy()
    const raw = fs.readFileSync(path.join(syncDir, SYNC_FILE_NAME), 'utf8')
    expect(raw).toContain('"encrypted":true')
  })

  it('加密共享文件可由相同口令的设备正常应用', async () => {
    const body = buildSyncSnapshot({
      sections: {
        appearance: {
          updated_at: Date.now() + 600000,
          values: { theme: 'dark', theme_style: 'forest', font_size: 'large', language: 'zh-CN' }
        }
      },
      device: { id: 'other-device', name: '加密笔记本' },
      updatedAt: new Date().toISOString()
    })
    const { sections, ...meta } = body
    fs.writeFileSync(
      path.join(syncDir, SYNC_FILE_NAME),
      encryptSnapshotText(JSON.stringify({ ...meta, sections }), 'shared-pw'),
      'utf8'
    )

    await setSyncDirectory(syncDir)
    expect((await syncNow()).code).toBe('locked')

    await setSyncPassphrase('shared-pw')
    const result = await syncNow()
    expect(result.success).toBe(true)
    expect(result.applied).toContain('appearance')
    expect(globalThis.__syncConfig.appearance.theme).toBe('dark')
  })

  it('停用的分区不应用远端也不写入本机，但保留共享文件中的副本', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()

    const snapshot = readSyncFile()
    snapshot.sections.appearance = {
      updated_at: Date.now() + 600000,
      values: { theme: 'forest', theme_style: 'forest', font_size: 'medium', language: 'zh-CN' }
    }
    writeSyncFile(snapshot)

    const sectionsResult = await setSyncSections(['appearance'])
    expect(sectionsResult.success).toBe(true)
    expect(sectionsResult.status.disabledSections).toEqual(['appearance'])

    globalThis.__syncConfig.appearance.theme = 'bee'
    globalThis.__syncConfig.clipboard_history.max_entries = 200

    const result = await syncNow()
    expect(result.success).toBe(true)
    expect(result.applied).not.toContain('appearance')
    expect(result.pushed).toContain('clipboard')
    expect(result.pushed).not.toContain('appearance')
    expect(globalThis.__syncConfig.appearance.theme).toBe('bee')
    expect(readSyncFile().sections.appearance.values.theme).toBe('forest')

    await setSyncSections([])
    const reenabled = await syncNow()
    expect(reenabled.applied).toContain('appearance')
    expect(globalThis.__syncConfig.appearance.theme).toBe('forest')
  })

  it('切换同步文件夹会重置分区基线，新目录中的共享文件优先', async () => {
    await setSyncDirectory(syncDir)
    await syncNow()

    const secondDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntb-sync-dir2-'))
    try {
      fs.writeFileSync(
        path.join(secondDir, SYNC_FILE_NAME),
        JSON.stringify({
          type: 'ntoolbox-sync',
          version: 1,
          updated_at: new Date(Date.now() - 60000).toISOString(),
          device: { id: 'other', name: '另一台' },
          sections: {
            appearance: {
              updated_at: Date.now() - 60000,
              values: { theme: 'forest', theme_style: 'forest', font_size: 'medium', language: 'zh-CN' }
            }
          }
        }),
        'utf8'
      )
      const switched = await setSyncDirectory(secondDir)
      expect(switched.status.lastSyncAt).toBe('')

      const result = await syncNow()
      expect(result.applied).toContain('appearance')
      expect(globalThis.__syncConfig.appearance.theme).toBe('forest')
    } finally {
      fs.rmSync(secondDir, { recursive: true, force: true })
    }
  })

  it('设备名称、分区开关与自动同步参数校验并持久化', async () => {
    expect((await setSyncDeviceName('')).code).toBe('invalid-name')
    expect((await setSyncDeviceName('x'.repeat(61))).code).toBe('invalid-name')
    expect((await setSyncDeviceName('工作站')).success).toBe(true)
    expect((await getSyncStatus()).deviceName).toBe('工作站')

    expect((await setSyncSections('appearance')).code).toBe('invalid-sections')
    const sections = await setSyncSections(['appearance', 'appearance', 'ghost'])
    expect(sections.status.disabledSections).toEqual(['appearance'])

    expect((await setSyncAutoSync('yes')).code).toBe('invalid-value')
    expect((await setSyncAutoSync(true)).status.autoSync).toBe(true)
    expect((await getSyncStatus()).autoSync).toBe(true)

    expect((await setSyncPassphrase('p'.repeat(129))).code).toBe('invalid-passphrase')
  })

  it('同步状态文件损坏时回退到未配置状态并可重新设置', async () => {
    fs.writeFileSync(getSyncStatePath(), 'not-json', 'utf8')
    const status = await getSyncStatus()
    expect(status.configured).toBe(false)
    expect(status.disabledSections).toEqual([])

    const result = await setSyncDirectory(syncDir)
    expect(result.success).toBe(true)
    expect((await getSyncStatus()).directory).toBe(syncDir)
  })
})
