import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { log } from '../utils'
import { recordSnapshot, pruneArtifacts } from './sqlite/artifactRepository.js'

const MAX_ENTRIES = 50
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_DIRECTORY_FILES = 500
const MAX_DIRECTORY_BYTES = 20 * 1024 * 1024
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

let cleanedUp = false

function snapshotsRoot() {
  return path.join(app.getPath('userData'), 'agent', 'snapshots')
}

function normalizeStoreId(requestId) {
  const safe = String(requestId || '')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 80)
  return safe || `run-${Date.now()}`
}

function storeDir(requestId) {
  return path.join(snapshotsRoot(), normalizeStoreId(requestId))
}

async function pathExists(target) {
  try {
    await fs.promises.lstat(target)
    return true
  } catch {
    return false
  }
}

async function copyLimited(source, destination, budget) {
  const stat = await fs.promises.lstat(source)
  if (stat.isDirectory()) {
    budget.files += 1
    if (budget.files > MAX_DIRECTORY_FILES) {
      throw new Error(`目录文件数超过快照上限（${MAX_DIRECTORY_FILES} 个），已拒绝执行`)
    }
    await fs.promises.mkdir(destination, { recursive: true })
    const entries = await fs.promises.readdir(source, { withFileTypes: true })
    for (const entry of entries) {
      await copyLimited(path.join(source, entry.name), path.join(destination, entry.name), budget)
    }
    return
  }

  budget.files += 1
  budget.bytes += stat.size
  if (budget.bytes > MAX_DIRECTORY_BYTES) {
    throw new Error(`目录大小超过快照上限（${Math.round(MAX_DIRECTORY_BYTES / 1024 / 1024)}MB），已拒绝执行`)
  }
  await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  await fs.promises.copyFile(source, destination)
}

async function cleanupOldSnapshots() {
  if (cleanedUp) return
  cleanedUp = true
  try {
    const root = snapshotsRoot()
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
    const now = Date.now()
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = path.join(root, entry.name)
      const stat = await fs.promises.stat(dir).catch(() => null)
      if (stat && now - stat.mtimeMs > RETENTION_MS) {
        await fs.promises.rm(dir, { recursive: true, force: true })
      }
    }
    await pruneArtifacts(now - RETENTION_MS).catch(() => {})
  } catch (error) {
    log.warn('清理历史快照失败:', error.message)
  }
}

export function createSnapshotStore(requestId, options = {}) {
  const dir = storeDir(requestId)
  const conversationId = String(options.conversationId || '')
  const entries = []
  let initialized = false

  async function ensureStore() {
    if (initialized) return
    await fs.promises.mkdir(path.join(dir, 'files'), { recursive: true })
    initialized = true
  }

  async function writeManifest() {
    const manifest = {
      requestId: normalizeStoreId(requestId),
      createdAt: Date.now(),
      entries: entries.map((entry) => ({
        id: entry.id,
        path: entry.path,
        existed: entry.existed,
        kind: entry.kind
      }))
    }
    await fs.promises.writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
    void recordSnapshot({
      requestId: manifest.requestId,
      conversationId,
      fileCount: entries.length,
      directory: dir,
      createdAt: manifest.createdAt
    }).catch((error) => log.warn('写入快照索引失败:', error.message))
  }

  async function record(target) {
    const absolute = path.resolve(String(target))
    if (entries.length >= MAX_ENTRIES) {
      throw new Error(`本次执行的文件变更超过快照上限（${MAX_ENTRIES} 个），已停止执行`)
    }

    if (!cleanedUp) await cleanupOldSnapshots()
    await ensureStore()

    const stat = await fs.promises.lstat(absolute).catch(() => null)
    const existed = Boolean(stat)
    const kind = stat?.isDirectory() ? 'directory' : 'file'
    const id = `s${entries.length + 1}`

    if (existed) {
      const backup = path.join(dir, 'files', id)
      if (kind === 'file' && stat.size > MAX_FILE_BYTES) {
        throw new Error(`文件超过快照上限（${Math.round(MAX_FILE_BYTES / 1024 / 1024)}MB），无法备份，已拒绝执行`)
      }
      await copyLimited(absolute, backup, { files: 0, bytes: 0 })
    }

    const entry = { id, path: absolute, existed, kind }
    entries.push(entry)
    await writeManifest()
    return { id: entry.id, path: absolute, existed, kind }
  }

  return {
    record,
    entries: () =>
      entries.map((entry) => ({
        id: entry.id,
        path: entry.path,
        existed: entry.existed,
        kind: entry.kind
      }))
  }
}

export async function restoreSnapshot(requestId) {
  const dir = storeDir(requestId)
  let manifest

  try {
    manifest = JSON.parse(await fs.promises.readFile(path.join(dir, 'manifest.json'), 'utf8'))
  } catch {
    return { success: false, error: '没有可撤销的文件变更' }
  }

  const entries = Array.isArray(manifest?.entries) ? manifest.entries : []
  if (entries.length === 0) {
    return { success: false, error: '没有可撤销的文件变更' }
  }

  const errors = []
  let restored = 0

  for (const entry of [...entries].reverse()) {
    const target = typeof entry?.path === 'string' ? path.resolve(entry.path) : ''
    if (!target || path.parse(target).root === target) {
      errors.push(`跳过不安全的路径：${entry?.path || '未知'}`)
      continue
    }

    try {
      if (entry.existed) {
        const backup = path.join(dir, 'files', String(entry.id))
        if (!(await pathExists(backup))) {
          errors.push(`快照缺失：${target}`)
          continue
        }
        await fs.promises.rm(target, { recursive: true, force: true })
        await fs.promises.mkdir(path.dirname(target), { recursive: true })
        await copyLimited(backup, target, { files: 0, bytes: 0 })
      } else {
        await fs.promises.rm(target, { recursive: true, force: true })
      }
      restored += 1
    } catch (error) {
      errors.push(`${target}：${error.message}`)
    }
  }

  if (errors.length === 0) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {})
  }

  return {
    success: errors.length === 0,
    restored,
    total: entries.length,
    errors
  }
}
