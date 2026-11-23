import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

// 旧版把配置、数据库、Agent 产物与 Chromium profile 全部平铺在 userData 根目录；
// 这里按角色把已知条目搬到新布局，未知文件一律留在原处
const DATA_ITEMS = [
  { name: 'ntoolbox.db' },
  { name: 'ntoolbox.db-wal' },
  { name: 'ntoolbox.db-shm' },
  { name: 'password-vault.json' },
  { name: 'clipboard-history.json' },
  { name: 'plugins.json' },
  { name: 'memory' },
  { name: 'skills' },
  { name: 'plugins' },
  { name: 'agent-runs', target: 'agent/runs', artifact: { table: 'run_traces', column: 'file_path' } },
  { name: 'agent-results', target: 'agent/results', artifact: { table: 'tool_results', column: 'file_path' } },
  { name: 'agent-snapshots', target: 'agent/snapshots', artifact: { table: 'tool_snapshots', column: 'directory' } }
]

const CONFIG_ITEMS = ['.dbkey', 'config.json', 'config.json.bak']

// 纯缓存，可重建：新 profile 已有同名条目时直接丢弃旧副本，避免配置目录被上百 MB 缓存撑爆
export const CHROMIUM_CACHE_ITEMS = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'ShaderCache',
  'GrShaderCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Dictionaries',
  'Shared Dictionary',
  'DevToolsActivePort'
]

// 状态数据无法合并：新 profile 已有同名条目时把旧副本重命名为 .previous 保留，不再占用正式文件名
export const CHROMIUM_STATE_ITEMS = [
  'Local Storage',
  'Session Storage',
  'IndexedDB',
  'Service Worker',
  'blob_storage',
  'Network',
  'Partitions',
  'Crashpad',
  'Cookies',
  'Cookies-journal',
  'Preferences',
  'Local State',
  'Network Persistent State',
  'SharedStorage',
  'SharedStorage-wal',
  'Trust Tokens',
  'Trust Tokens-journal',
  'DIPS',
  'DIPS-wal'
]

export function samePath(left, right, platform = process.platform) {
  const normalize = (value) => path.resolve(String(value)).replace(/[\\/]+$/, '')
  const a = normalize(left)
  const b = normalize(right)
  if (platform === 'win32' || platform === 'darwin') return a.toLowerCase() === b.toLowerCase()
  return a === b
}

function moveIfNeeded(source, target, kind, actions, warnings) {
  if (!source || !target || samePath(source, target)) return false
  let stat
  try {
    stat = fs.lstatSync(source)
  } catch {
    return false
  }
  if (fs.existsSync(target)) return false
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  try {
    fs.renameSync(source, target)
  } catch (error) {
    if (error.code !== 'EXDEV') {
      warnings.push(`迁移 ${source} 失败：${error.message}`)
      return false
    }
    try {
      fs.cpSync(source, target, { recursive: stat.isDirectory(), errorOnExist: true, preserveTimestamps: true })
      fs.rmSync(source, { recursive: true, force: true })
    } catch (copyError) {
      warnings.push(`跨分区复制 ${source} 失败：${copyError.message}`)
      return false
    }
  }
  actions.push({ kind, from: source, to: target })
  return true
}

function copyIfNeeded(source, target, kind, actions, warnings) {
  if (!source || !target || samePath(source, target)) return false
  if (!fs.existsSync(source) || fs.existsSync(target)) return false
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
    const stat = fs.lstatSync(source)
    if (stat.isDirectory()) {
      fs.cpSync(source, target, { recursive: true, errorOnExist: true, preserveTimestamps: true })
    } else {
      fs.copyFileSync(source, target)
      if (process.platform !== 'win32') fs.chmodSync(target, 0o600)
    }
  } catch (error) {
    warnings.push(`复制 ${source} 失败：${error.message}`)
    return false
  }
  actions.push({ kind, from: source, to: target })
  return true
}

function pathExists(target) {
  try {
    fs.lstatSync(target)
    return true
  } catch {
    return false
  }
}

function chmodLegacy(target) {
  if (process.platform === 'win32') return
  try {
    fs.chmodSync(target, fs.lstatSync(target).isDirectory() ? 0o700 : 0o600)
  } catch {
    // 权限收紧失败不影响数据本身
  }
}

function dropLegacyCache(source, target, platform, actions, warnings) {
  if (samePath(source, target, platform) || !pathExists(source)) return
  try {
    fs.rmSync(source, { recursive: true, force: true })
    actions.push({ kind: 'chromium-cache-clear', from: source, to: target })
  } catch (error) {
    warnings.push(`删除旧缓存 ${source} 失败：${error.message}`)
  }
}

function backUpLegacyState(source, actions, warnings) {
  if (!pathExists(source)) return
  const backup = `${source}.previous`
  if (pathExists(backup)) {
    warnings.push(`旧 Chromium 数据 ${source} 已有备份，保留原文件`)
    return
  }
  try {
    fs.renameSync(source, backup)
    chmodLegacy(backup)
    actions.push({ kind: 'chromium-backup', from: source, to: backup })
  } catch (error) {
    warnings.push(`备份旧 Chromium 数据 ${source} 失败：${error.message}`)
  }
}

function directoryBytes(target, limit = 200000) {
  let total = 0
  let count = 0
  const stack = [target]
  while (stack.length && count < limit) {
    const current = stack.pop()
    let entries
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      count += 1
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile()) {
        try {
          total += fs.statSync(full).size
        } catch {
          // 读取失败的文件不计入体积
        }
      }
      if (count >= limit) break
    }
  }
  return total
}

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

const KNOWN_CHROMIUM_ITEMS = new Set([...CHROMIUM_CACHE_ITEMS, ...CHROMIUM_STATE_ITEMS])

// 清理后配置目录应只剩配置与备份；仍出现已知 Chromium 条目说明迁移未完成，需要提示体积
export function findLegacyChromiumLeftovers(configDir) {
  let entries
  try {
    entries = fs.readdirSync(configDir, { withFileTypes: true })
  } catch {
    return { items: [], bytes: 0 }
  }
  const items = []
  let bytes = 0
  for (const entry of entries) {
    if (entry.name.endsWith('.previous') || !KNOWN_CHROMIUM_ITEMS.has(entry.name)) continue
    const full = path.join(configDir, entry.name)
    items.push(entry.name)
    bytes += entry.isDirectory() ? directoryBytes(full) : 0
    if (entry.isFile()) {
      try {
        bytes += fs.statSync(full).size
      } catch {
        // 读取失败的文件不计入体积
      }
    }
  }
  return { items, bytes }
}

function removeEmptyDirs(dirs, platform, actions, warnings) {
  const seen = []
  for (const dir of dirs) {
    if (!dir || !pathExists(dir)) continue
    if (seen.some((item) => samePath(item, dir, platform))) continue
    seen.push(dir)
    try {
      fs.rmdirSync(dir)
      actions.push({ kind: 'remove-empty', from: dir })
    } catch (error) {
      if (error.code !== 'ENOTEMPTY' && error.code !== 'ENOENT') {
        warnings.push(`清理空目录 ${dir} 失败：${error.message}`)
      }
    }
  }
}

function rewriteArtifactPaths(dbPath, pairs, actions, warnings) {
  if (!pairs.length || !fs.existsSync(dbPath)) return
  let db
  try {
    db = new DatabaseSync(dbPath)
  } catch (error) {
    warnings.push(`打开数据库改写轨迹路径失败：${error.message}`)
    return
  }
  try {
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
    const tables = new Set(rows.map((row) => row.name))
    db.exec('BEGIN')
    for (const pair of pairs) {
      if (!tables.has(pair.table)) continue
      // oldDir 前缀替换为 newDir；project 版本存的是绝对路径
      db.prepare(
        `UPDATE ${pair.table} SET ${pair.column} = ? || substr(${pair.column}, ?)
         WHERE substr(${pair.column}, 1, ?) = ?`
      ).run(pair.newDir, pair.oldDir.length + 1, pair.oldDir.length, pair.oldDir)
    }
    db.exec('COMMIT')
    actions.push({ kind: 'rewrite-db-paths', from: dbPath, to: pairs.length })
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // ignore rollback failure
    }
    warnings.push(`改写数据库轨迹路径失败：${error.message}`)
  } finally {
    db.close()
  }
}

export function migrateLegacyLayout({
  paths,
  legacyRoots = [],
  legacyConfigFiles = [],
  legacyLogDirs = [],
  legacyRepoSources = [],
  platform = process.platform
}) {
  const actions = []
  const warnings = []
  const artifactPairs = []
  let dbMoved = false

  const roots = []
  const seenRoots = []
  for (const root of legacyRoots) {
    if (!root || !fs.existsSync(root)) continue
    if (seenRoots.some((item) => samePath(item, root, platform))) continue
    seenRoots.push(root)
    roots.push(root)
  }

  for (const root of roots) {
    for (const item of DATA_ITEMS) {
      const source = path.join(root, item.name)
      const target = path.join(paths.dataDir, item.target || item.name)
      const moved = moveIfNeeded(source, target, 'data', actions, warnings)
      if (moved) {
        if (item.name === 'ntoolbox.db') dbMoved = true
        if (item.artifact) artifactPairs.push({ ...item.artifact, oldDir: source, newDir: target })
      }
    }
    for (const name of CONFIG_ITEMS) {
      copyIfNeeded(path.join(root, name), path.join(paths.configDir, name), 'config', actions, warnings)
    }
    for (const name of CHROMIUM_CACHE_ITEMS) {
      const source = path.join(root, name)
      const target = path.join(paths.chromiumDir, name)
      if (pathExists(source) && pathExists(target)) {
        dropLegacyCache(source, target, platform, actions, warnings)
      } else {
        moveIfNeeded(source, target, 'chromium', actions, warnings)
      }
    }
    for (const name of CHROMIUM_STATE_ITEMS) {
      const source = path.join(root, name)
      const target = path.join(paths.chromiumDir, name)
      if (pathExists(source) && pathExists(target)) {
        backUpLegacyState(source, actions, warnings)
      } else {
        moveIfNeeded(source, target, 'chromium', actions, warnings)
      }
    }
  }

  for (const source of legacyConfigFiles) {
    copyIfNeeded(source, path.join(paths.configDir, 'config.json'), 'config', actions, warnings)
  }

  const seenLogDirs = []
  for (const dir of legacyLogDirs) {
    if (!dir || !fs.existsSync(dir)) continue
    if (seenLogDirs.some((item) => samePath(item, dir, platform))) continue
    seenLogDirs.push(dir)
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!/\.log(\.\d+)?$/.test(entry.name)) continue
      moveIfNeeded(path.join(dir, entry.name), path.join(paths.logsDir, entry.name), 'logs', actions, warnings)
    }
  }

  for (const item of legacyRepoSources) {
    copyIfNeeded(item?.source, item?.target, 'repo', actions, warnings)
  }

  if (dbMoved && artifactPairs.length) {
    rewriteArtifactPaths(path.join(paths.dataDir, 'ntoolbox.db'), artifactPairs, actions, warnings)
  }

  removeEmptyDirs(
    [...roots, path.join(paths.configDir, 'skills'), path.join(paths.configDir, 'cache')],
    platform,
    actions,
    warnings
  )

  const leftovers = findLegacyChromiumLeftovers(paths.configDir)
  if (leftovers.items.length) {
    warnings.push(
      `配置目录仍残留旧 Chromium 数据（${leftovers.items.join('、')}，约 ${formatBytes(leftovers.bytes)}），可手动删除`
    )
  }

  return { actions, warnings }
}
