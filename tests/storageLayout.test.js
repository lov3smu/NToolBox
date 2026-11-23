import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ repoRoot: '' }))

vi.mock('../src/main/utils/path.js', () => ({
  getProjectRoot: () => state.repoRoot
}))

import { prepareStorageLayout } from '../src/main/utils/storageLayout.js'

function encryptWithKey(key, plaintext) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return 'enc:' + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
}

function configWithKey(key) {
  return JSON.stringify({
    config_version: 2,
    ai: { keys: { openai: encryptWithKey(key, 'sk-legacy') } }
  })
}

function makeApp(appData) {
  return {
    getName: () => 'NToolBox',
    isPackaged: false,
    getPath: (name) => {
      if (name === 'appData') return appData
      if (name === 'userData') return path.join(appData, 'NToolBox')
      throw new Error(`unexpected path: ${name}`)
    },
    setPath: vi.fn()
  }
}

let root
let env
let configDir
let repoKey
let staleKey

function run(app) {
  return prepareStorageLayout(app, { platform: 'linux', env, home: path.join(root, 'home') })
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-storage-'))
  state.repoRoot = path.join(root, 'repo')
  env = {
    XDG_CONFIG_HOME: path.join(root, 'xdg-config'),
    XDG_DATA_HOME: path.join(root, 'xdg-data'),
    XDG_CACHE_HOME: path.join(root, 'xdg-cache'),
    XDG_STATE_HOME: path.join(root, 'xdg-state')
  }
  configDir = path.join(env.XDG_CONFIG_HOME, 'ntoolbox')
  fs.mkdirSync(configDir, { recursive: true })
  repoKey = crypto.randomBytes(32)
  staleKey = crypto.randomBytes(32)
  fs.mkdirSync(state.repoRoot, { recursive: true })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('开发版配置密钥配对', () => {
  it('仓库根配置搬入后换回仓库根的 .dbkey 并备份旧密钥', () => {
    fs.writeFileSync(path.join(state.repoRoot, 'config.json'), configWithKey(repoKey))
    fs.writeFileSync(path.join(state.repoRoot, '.dbkey'), repoKey.toString('base64'))
    fs.writeFileSync(path.join(configDir, 'config.json'), configWithKey(repoKey))
    fs.writeFileSync(path.join(configDir, '.dbkey'), staleKey.toString('base64'))

    const report = run(makeApp(env.XDG_CONFIG_HOME))

    expect(fs.readFileSync(path.join(configDir, '.dbkey'), 'utf8')).toBe(repoKey.toString('base64'))
    expect(fs.readFileSync(path.join(configDir, '.dbkey.previous'), 'utf8')).toBe(staleKey.toString('base64'))
    expect(report.actions.some((action) => action.kind === 'config-key')).toBe(true)
  })

  it('配置目录已有能解开密文的密钥时保持不变', () => {
    fs.writeFileSync(path.join(state.repoRoot, 'config.json'), configWithKey(repoKey))
    fs.writeFileSync(path.join(state.repoRoot, '.dbkey'), repoKey.toString('base64'))
    fs.writeFileSync(path.join(configDir, 'config.json'), configWithKey(staleKey))
    fs.writeFileSync(path.join(configDir, '.dbkey'), staleKey.toString('base64'))

    const report = run(makeApp(env.XDG_CONFIG_HOME))

    expect(fs.readFileSync(path.join(configDir, '.dbkey'), 'utf8')).toBe(staleKey.toString('base64'))
    expect(fs.existsSync(path.join(configDir, '.dbkey.previous'))).toBe(false)
    expect(report.actions.some((action) => action.kind === 'config-key')).toBe(false)
  })

  it('配置目录没有密钥且配置无密文时补上仓库根密钥', () => {
    fs.writeFileSync(path.join(state.repoRoot, 'config.json'), '{"config_version":2}')
    fs.writeFileSync(path.join(state.repoRoot, '.dbkey'), repoKey.toString('base64'))
    fs.writeFileSync(path.join(configDir, 'config.json'), '{"config_version":2}')

    run(makeApp(env.XDG_CONFIG_HOME))

    expect(fs.readFileSync(path.join(configDir, '.dbkey'), 'utf8')).toBe(repoKey.toString('base64'))
  })

  it('仓库根配置更新时间更晚时由它接管并备份旧配置', () => {
    const repoConfig = path.join(state.repoRoot, 'config.json')
    const targetConfig = path.join(configDir, 'config.json')
    const repoContent = configWithKey(repoKey)
    const staleContent = configWithKey(staleKey)
    fs.writeFileSync(repoConfig, repoContent)
    fs.writeFileSync(path.join(state.repoRoot, '.dbkey'), repoKey.toString('base64'))
    fs.writeFileSync(targetConfig, staleContent)
    fs.writeFileSync(path.join(configDir, '.dbkey'), staleKey.toString('base64'))
    fs.utimesSync(targetConfig, new Date('2026-01-01'), new Date('2026-01-01'))
    fs.utimesSync(repoConfig, new Date('2026-02-01'), new Date('2026-02-01'))

    const report = run(makeApp(env.XDG_CONFIG_HOME))

    expect(fs.readFileSync(targetConfig, 'utf8')).toBe(repoContent)
    expect(fs.readFileSync(path.join(configDir, 'config.json.previous'), 'utf8')).toBe(staleContent)
    expect(fs.readFileSync(path.join(configDir, '.dbkey'), 'utf8')).toBe(repoKey.toString('base64'))
    expect(fs.existsSync(path.join(configDir, '.layout-migrated'))).toBe(true)
    expect(report.actions.some((action) => action.kind === 'config-repo')).toBe(true)
  })

  it('仓库根配置更旧时保留现有配置，改用旧打包目录里能解密的密钥', () => {
    const legacyKey = crypto.randomBytes(32)
    const targetConfig = path.join(configDir, 'config.json')
    const repoConfig = path.join(state.repoRoot, 'config.json')
    const legacyContent = configWithKey(legacyKey)
    fs.writeFileSync(repoConfig, configWithKey(repoKey))
    fs.writeFileSync(path.join(state.repoRoot, '.dbkey'), repoKey.toString('base64'))
    fs.writeFileSync(targetConfig, legacyContent)
    fs.writeFileSync(path.join(configDir, '.dbkey'), staleKey.toString('base64'))
    fs.mkdirSync(path.join(env.XDG_CONFIG_HOME, 'NToolBox'), { recursive: true })
    fs.writeFileSync(path.join(env.XDG_CONFIG_HOME, 'NToolBox', '.dbkey'), legacyKey.toString('base64'))
    fs.utimesSync(repoConfig, new Date('2026-01-01'), new Date('2026-01-01'))
    fs.utimesSync(targetConfig, new Date('2026-02-01'), new Date('2026-02-01'))

    run(makeApp(env.XDG_CONFIG_HOME))

    expect(fs.readFileSync(targetConfig, 'utf8')).toBe(legacyContent)
    expect(fs.existsSync(path.join(configDir, 'config.json.previous'))).toBe(false)
    expect(fs.readFileSync(path.join(configDir, '.dbkey'), 'utf8')).toBe(legacyKey.toString('base64'))
    expect(fs.readFileSync(path.join(configDir, '.dbkey.previous'), 'utf8')).toBe(staleKey.toString('base64'))
  })

  it('布局标记写入后不再重复接管仓库根配置', () => {
    const repoConfig = path.join(state.repoRoot, 'config.json')
    const targetConfig = path.join(configDir, 'config.json')
    const repoContent = configWithKey(repoKey)
    const staleContent = configWithKey(staleKey)
    fs.writeFileSync(repoConfig, repoContent)
    fs.writeFileSync(path.join(state.repoRoot, '.dbkey'), repoKey.toString('base64'))

    run(makeApp(env.XDG_CONFIG_HOME))
    const firstContent = fs.readFileSync(targetConfig, 'utf8')
    fs.writeFileSync(targetConfig, staleContent)
    fs.writeFileSync(path.join(configDir, '.dbkey'), staleKey.toString('base64'))
    fs.utimesSync(targetConfig, new Date('2026-03-01'), new Date('2026-03-01'))
    fs.utimesSync(repoConfig, new Date('2026-04-01'), new Date('2026-04-01'))

    const report = run(makeApp(env.XDG_CONFIG_HOME))

    expect(firstContent).toBe(repoContent)
    expect(fs.readFileSync(targetConfig, 'utf8')).toBe(staleContent)
    expect(report.actions.some((action) => action.kind === 'config-repo')).toBe(false)
  })
})
