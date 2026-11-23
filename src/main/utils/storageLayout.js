import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { resolveAppPaths } from './appPaths'
import { migrateLegacyLayout } from './layoutMigration'
import { decryptWithKey, findEncryptedValue, parseKey } from './secretKey'
import { getProjectRoot } from './path'

const DIR_MODE = 0o700
const FILE_MODE = 0o600
const LAYOUT_MARKER = '.layout-migrated'
const LAYOUT_VERSION = '2'

function ensureDir(dir, warnings) {
  try {
    fs.mkdirSync(dir, { recursive: true, mode: DIR_MODE })
  } catch (error) {
    warnings.push(`创建目录失败 ${dir}：${error.message}`)
    return
  }
  chmodSafe(dir, DIR_MODE)
}

function chmodSafe(target, mode) {
  if (process.platform === 'win32') return
  try {
    fs.chmodSync(target, mode)
  } catch {
    // 文件不存在或无权限时忽略，下次启动会重试
  }
}

function harden(paths) {
  const dirs = [
    paths.configDir,
    paths.dataDir,
    paths.cacheDir,
    paths.logsDir,
    path.join(paths.logsDir, 'crash'),
    paths.chromiumDir,
    path.join(paths.dataDir, 'memory'),
    path.join(paths.dataDir, 'skills'),
    path.join(paths.dataDir, 'plugins'),
    path.join(paths.dataDir, 'agent'),
    path.join(paths.dataDir, 'agent', 'runs'),
    path.join(paths.dataDir, 'agent', 'results'),
    path.join(paths.dataDir, 'agent', 'snapshots'),
    path.join(paths.dataDir, 'mcp')
  ]
  const files = [
    path.join(paths.configDir, 'config.json'),
    path.join(paths.configDir, 'config.json.bak'),
    path.join(paths.configDir, 'config.json.previous'),
    path.join(paths.configDir, '.dbkey'),
    path.join(paths.configDir, '.dbkey.previous'),
    path.join(paths.configDir, LAYOUT_MARKER),
    path.join(paths.dataDir, 'ntoolbox.db'),
    path.join(paths.dataDir, 'ntoolbox.db-wal'),
    path.join(paths.dataDir, 'ntoolbox.db-shm'),
    path.join(paths.dataDir, 'plugins.json'),
    path.join(paths.dataDir, 'password-vault.json'),
    path.join(paths.dataDir, 'mcp', 'memory.jsonl'),
    path.join(paths.dataDir, 'memory', 'knowledge.json')
  ]
  for (const dir of dirs) {
    if (fs.existsSync(dir)) chmodSafe(dir, DIR_MODE)
  }
  for (const file of files) {
    if (fs.existsSync(file)) chmodSafe(file, FILE_MODE)
  }
}

function pathOrNull(getter) {
  try {
    return getter()
  } catch {
    return null
  }
}

function readKey(file) {
  try {
    return parseKey(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function adoptKey(source, target, actions) {
  if (fs.existsSync(target)) {
    fs.copyFileSync(target, `${target}.previous`)
    chmodSafe(`${target}.previous`, FILE_MODE)
  }
  fs.copyFileSync(source, target)
  chmodSafe(target, FILE_MODE)
  actions.push({ kind: 'config-key', from: source, to: target })
}

// 开发版历史上把配置放在仓库根目录，首次迁移时若它比配置目录里的旧文件更新则接管；
// 旧文件备份为 config.json.previous，标记文件保证只接管一次
function adoptRepoConfig(paths, repoRoot, actions, warnings) {
  const source = path.join(repoRoot, 'config.json')
  const target = path.join(paths.configDir, 'config.json')
  let sourceStat
  try {
    sourceStat = fs.statSync(source)
  } catch {
    return
  }
  if (fs.existsSync(target)) {
    if (sourceStat.mtimeMs <= fs.statSync(target).mtimeMs) return
    const backup = `${target}.previous`
    fs.copyFileSync(target, backup)
    chmodSafe(backup, FILE_MODE)
    actions.push({ kind: 'config-backup', from: target, to: backup })
  }
  fs.copyFileSync(source, target)
  chmodSafe(target, FILE_MODE)
  actions.push({ kind: 'config-repo', from: source, to: target })
  if (warnings) warnings.push('开发版旧配置已接管，原文件备份为 config.json.previous')
}

function markLayoutMigrated(paths, warnings) {
  try {
    const marker = path.join(paths.configDir, LAYOUT_MARKER)
    fs.writeFileSync(marker, LAYOUT_VERSION, { encoding: 'utf8', mode: FILE_MODE })
    chmodSafe(marker, FILE_MODE)
  } catch (error) {
    warnings.push(`写入布局标记失败：${error.message}`)
  }
}

// 配置搬进平台目录后，目录里可能已有另一把旧密钥（如打包版曾用 app name 目录），
// 密文会解不开；按实际密文在候选密钥中挑出能解密的那把并替换
function reconcileConfigKey(paths, keyFiles, actions, warnings) {
  const configPath = path.join(paths.configDir, 'config.json')
  const keyPath = path.join(paths.configDir, '.dbkey')
  if (!fs.existsSync(configPath)) return
  const candidates = []
  for (const file of keyFiles) {
    if (!file) continue
    const key = readKey(file)
    if (key && !candidates.some((item) => item.key.equals(key))) candidates.push({ file, key })
  }
  if (candidates.length === 0) return

  const activeKey = readKey(keyPath)
  let config
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    warnings.push(`解析配置失败：${error.message}`)
    return
  }
  const cipher = findEncryptedValue(config)
  if (!cipher) {
    if (!activeKey && candidates[0].file !== keyPath) adoptKey(candidates[0].file, keyPath, actions)
    return
  }
  if (activeKey && decryptWithKey(activeKey, cipher) !== null) return
  const match = candidates.find((item) => decryptWithKey(item.key, cipher) !== null)
  if (!match || (activeKey && match.key.equals(activeKey))) return
  adoptKey(match.file, keyPath, actions)
}

export function prepareStorageLayout(app, overrides = {}) {
  const paths = resolveAppPaths(overrides)
  const warnings = []

  // setPath 之前读取旧位置：打包版 userData 由 app name 决定，开发版历史上被固定为 appData/ntoolbox
  const legacyAppData = pathOrNull(() => app.getPath('appData'))
  const legacyUserData = pathOrNull(() => app.getPath('userData'))
  const appName = typeof app.getName === 'function' ? app.getName() : 'NToolBox'
  const repoRoot = getProjectRoot()
  const isDev = !app.isPackaged
  const home = overrides.home || os.homedir()

  const legacyRoots = [
    legacyUserData,
    legacyAppData && path.join(legacyAppData, appName),
    legacyAppData && path.join(legacyAppData, 'ntoolbox')
  ].filter(Boolean)

  const legacyConfigFiles = [path.join(home, '.config', 'ntoolbox', 'config.json')]
  if (isDev) legacyConfigFiles.push(path.join(repoRoot, 'config.json'))

  const legacyLogDirs = [legacyUserData && path.join(legacyUserData, 'logs')].filter(Boolean)
  if (isDev) legacyLogDirs.push(path.join(repoRoot, 'logs'))

  const legacyRepoSources = isDev
    ? [
        { source: path.join(repoRoot, 'plugins.json'), target: path.join(paths.dataDir, 'plugins.json') },
        { source: path.join(repoRoot, 'plugins'), target: path.join(paths.dataDir, 'plugins') }
      ]
    : []

  for (const dir of [paths.configDir, paths.dataDir, paths.cacheDir, paths.logsDir, paths.chromiumDir]) {
    ensureDir(dir, warnings)
  }

  let report
  try {
    report = migrateLegacyLayout({
      paths,
      legacyRoots,
      legacyConfigFiles,
      legacyLogDirs,
      legacyRepoSources,
      platform: overrides.platform
    })
    report.warnings.unshift(...warnings)
  } catch (error) {
    warnings.push(`布局迁移失败：${error.message}`)
    report = { actions: [], warnings }
  }

  const markerPath = path.join(paths.configDir, LAYOUT_MARKER)
  const migrated = fs.existsSync(markerPath)

  if (isDev && !migrated) {
    try {
      adoptRepoConfig(paths, repoRoot, report.actions, report.warnings)
    } catch (error) {
      report.warnings.push(`接管旧配置失败：${error.message}`)
    }
  }

  try {
    const keyFiles = [
      path.join(paths.configDir, '.dbkey'),
      isDev && path.join(repoRoot, '.dbkey'),
      ...legacyRoots.map((root) => path.join(root, '.dbkey'))
    ].filter(Boolean)
    reconcileConfigKey(paths, keyFiles, report.actions, report.warnings)
  } catch (error) {
    report.warnings.push(`校验配置密钥失败：${error.message}`)
  }

  if (!migrated) markLayoutMigrated(paths, report.warnings)

  try {
    app.setPath('userData', paths.dataDir)
    app.setPath('sessionData', paths.chromiumDir)
    app.setPath('logs', paths.logsDir)
  } catch (error) {
    warnings.push(`设置应用目录失败：${error.message}`)
  }
  try {
    app.setPath('crashDumps', path.join(paths.logsDir, 'crash'))
  } catch {
    // 旧版 Electron 不支持该路径时忽略
  }

  harden(paths)
  return { paths, actions: report.actions, warnings: report.warnings }
}
