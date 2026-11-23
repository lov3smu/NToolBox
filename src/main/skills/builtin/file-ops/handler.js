import path from 'node:path'
import fs from 'node:fs'
import { computeLineDiff } from '../../../utils/textDiff.js'

const SEARCH_MAX_DEPTH = 8
const SEARCH_MAX_SCAN = 5000
const SEARCH_MAX_CONTENT_SCAN = 300
const SEARCH_SKIP_DIRS = new Set(['.git', '.svn', '.hg', 'node_modules'])
const CONTENT_MATCH_MAX_BYTES = 1024 * 1024

function resolveBasePath(context) {
  const workspace = typeof context?.workspacePath === 'string' ? context.workspacePath.trim() : ''
  if (workspace && path.isAbsolute(workspace)) {
    try {
      if (fs.statSync(workspace).isDirectory()) return { basePath: path.resolve(workspace) }
    } catch {
      // 工作区不可用时回退到设置中的 base_path
    }
  }

  const config = typeof context.getConfig === 'function' ? context.getConfig() : context.config
  const basePath = typeof config?.sql_generator?.base_path === 'string' ? config.sql_generator.base_path.trim() : ''

  if (!basePath) {
    return { error: '未配置工作区或脚本基础目录（base_path），请先选择工作区或在设置中配置' }
  }

  return { basePath: path.resolve(basePath) }
}

function resolveTarget(input, basePath, isPathWithinBase, label = 'path') {
  if (typeof input !== 'string' || !input.trim()) {
    return { error: `请提供 ${label} 参数` }
  }

  if (input.includes('\0')) {
    return { error: '路径包含非法字符' }
  }

  const target = path.isAbsolute(input) ? path.normalize(input) : path.resolve(basePath, input)

  if (!isPathWithinBase(target, basePath)) {
    return { error: '路径超出允许范围：仅允许访问当前工作区内的文件' }
  }

  return { target }
}

function displayPath(basePath, target) {
  return path.relative(basePath, target) || '.'
}

function formatSize(size) {
  if (!Number.isFinite(size)) return ''
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function isBinary(buffer) {
  return buffer.includes(0)
}

async function readHead(target, maxBytes) {
  const handle = await fs.promises.open(target, 'r')
  try {
    const buffer = Buffer.alloc(maxBytes)
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

const PREVIEW_MAX_BYTES = 512 * 1024
const PREVIEW_MAX_ITEMS = 50
const PREVIEW_MAX_SCAN = 5000

async function collectDeletePreview(target, basePath) {
  const items = []
  let total = 0
  let totalSize = 0
  let scanned = 0
  let truncated = false
  const stack = [target]

  while (stack.length > 0) {
    const current = stack.pop()
    const stat = await fs.promises.lstat(current).catch(() => null)
    if (!stat) continue

    scanned += 1
    if (scanned > PREVIEW_MAX_SCAN) {
      truncated = true
      break
    }

    total += 1
    if (stat.isDirectory()) {
      if (items.length < PREVIEW_MAX_ITEMS) {
        items.push({ path: `${displayPath(basePath, current)}/`, size: null })
      } else {
        truncated = true
      }
      const children = await fs.promises.readdir(current, { withFileTypes: true }).catch(() => [])
      for (const child of children) stack.push(path.join(current, child.name))
    } else {
      totalSize += stat.size
      if (items.length < PREVIEW_MAX_ITEMS) {
        items.push({ path: displayPath(basePath, current), size: stat.size })
      } else {
        truncated = true
      }
    }
  }

  return { total, totalSize, items, truncated }
}

async function recordSnapshots(context, targets) {
  if (!context.snapshots) return []
  const records = []
  for (const target of targets) {
    records.push(await context.snapshots.record(target))
  }
  return records
}

async function isBaseRoot(target, basePath) {
  const normalize = (value) => (process.platform === 'win32' ? value.toLowerCase() : value)
  const [targetReal, baseReal] = await Promise.all([
    fs.promises.realpath(target).catch(() => path.resolve(target)),
    fs.promises.realpath(basePath).catch(() => path.resolve(basePath))
  ])
  return normalize(targetReal) === normalize(baseReal)
}

async function listDirectory(target, limit) {
  const entries = await fs.promises.readdir(target, { withFileTypes: true })
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const selected = entries.slice(0, limit)
  const items = []

  for (const entry of selected) {
    const item = {
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : entry.isSymbolicLink() ? 'symlink' : 'file'
    }

    if (item.type === 'file') {
      try {
        item.size = (await fs.promises.lstat(path.join(target, entry.name))).size
      } catch {
        item.size = null
      }
    }

    items.push(item)
  }

  return { items, total: entries.length, truncated: entries.length > items.length }
}

async function searchDirectory(target, pattern, contentMatch, limit) {
  const nameTerm = pattern.toLowerCase()
  const contentTerm = contentMatch ? contentMatch.toLowerCase() : ''
  const matches = []
  const stack = [{ dir: target, depth: 0 }]
  let scanned = 0
  let contentScanned = 0
  let truncated = false
  let contentScanTruncated = false

  while (stack.length > 0) {
    const { dir, depth } = stack.pop()
    let entries

    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (scanned >= SEARCH_MAX_SCAN) {
        truncated = true
        break
      }
      scanned += 1

      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        if (!SEARCH_SKIP_DIRS.has(entry.name) && depth < SEARCH_MAX_DEPTH) {
          stack.push({ dir: fullPath, depth: depth + 1 })
        }
        continue
      }

      const nameMatched = entry.name.toLowerCase().includes(nameTerm)
      let contentMatched = false

      if (!nameMatched && contentTerm) {
        if (contentScanned >= SEARCH_MAX_CONTENT_SCAN) {
          contentScanTruncated = true
          continue
        }

        try {
          const stat = await fs.promises.lstat(fullPath)
          if (stat.isFile() && stat.size <= CONTENT_MATCH_MAX_BYTES) {
            contentScanned += 1
            const buffer = await fs.promises.readFile(fullPath)
            if (!isBinary(buffer)) {
              contentMatched = buffer.toString('utf8').toLowerCase().includes(contentTerm)
            }
          }
        } catch {
          contentMatched = false
        }
      }

      if (nameMatched || contentMatched) {
        if (matches.length >= limit) {
          truncated = true
          break
        }

        matches.push({
          path: displayPath(target, fullPath),
          name: entry.name,
          matched: nameMatched ? 'name' : 'content'
        })
      }
    }

    if (truncated) break
  }

  return { matches, scanned, truncated, contentScanTruncated }
}

async function copyEntry(source, destination, { overwrite, createDirs, recursive }) {
  const stat = await fs.promises.lstat(source)
  const isDirectory = stat.isDirectory()

  if (isDirectory && !recursive) {
    return { error: '复制目录需要设置 recursive=true' }
  }

  if (isDirectory && !overwrite) {
    const existing = await fs.promises.lstat(destination).catch(() => null)
    if (existing) {
      return { error: '目标已存在；覆盖目录请设置 overwrite=true' }
    }
  }

  if (createDirs) {
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  }

  await fs.promises.cp(source, destination, {
    recursive: isDirectory,
    force: overwrite,
    errorOnExist: !overwrite,
    preserveTimestamps: true
  })

  return { isDirectory }
}

async function moveEntry(source, destination, overwrite, createDirs) {
  if (overwrite) {
    await fs.promises.rm(destination, { recursive: true, force: true })
  }

  if (createDirs) {
    await fs.promises.mkdir(path.dirname(destination), { recursive: true })
  }

  try {
    await fs.promises.rename(source, destination)
    return
  } catch (error) {
    if (error.code !== 'EXDEV') throw error
  }

  const stat = await fs.promises.lstat(source)
  await fs.promises.cp(source, destination, {
    recursive: stat.isDirectory(),
    force: true,
    errorOnExist: false,
    preserveTimestamps: true
  })
  await fs.promises.rm(source, { recursive: true, force: false })
}

export default async function handler(params, context) {
  const { log } = context
  const { action, path: inputPath = '.', limit = 100, max_bytes: maxBytes = 204800 } = params

  log.debug(`执行 file-ops: action=${action}`)

  if (typeof context.isPathWithinBase !== 'function') {
    return { success: false, error: '文件路径校验不可用，已拒绝执行' }
  }

  const base = resolveBasePath(context)
  if (base.error) return { success: false, error: base.error }

  const targetResult = resolveTarget(inputPath, base.basePath, context.isPathWithinBase)
  if (targetResult.error) return { success: false, error: targetResult.error }

  const { target } = targetResult
  const relativePath = displayPath(base.basePath, target)

  try {
    switch (action) {
      case 'list': {
        const stat = await fs.promises.stat(target)
        if (!stat.isDirectory()) {
          return { success: false, error: `不是目录：${relativePath}` }
        }

        const result = await listDirectory(target, limit)
        const lines = result.items.map((item) => {
          if (item.type === 'directory') return `- [目录] ${item.name}/`
          if (item.type === 'symlink') return `- [链接] ${item.name}`
          return `- [文件] ${item.name}${item.size === null ? '' : ` (${formatSize(item.size)})`}`
        })

        let content = `目录：${relativePath}（共 ${result.total} 项）\n${lines.join('\n')}`
        if (result.truncated) content += `\n... 还有 ${result.total - result.items.length} 项未显示`

        return {
          success: true,
          content,
          metadata: {
            action,
            path: relativePath,
            total: result.total,
            returned: result.items.length,
            truncated: result.truncated,
            items: result.items
          }
        }
      }

      case 'read': {
        const stat = await fs.promises.stat(target)
        if (!stat.isFile()) {
          return { success: false, error: `不是文件：${relativePath}` }
        }

        const readLimit = Math.max(1, Math.min(Number(maxBytes) || 204800, 1048576))
        const truncated = stat.size > readLimit
        const buffer = truncated ? await readHead(target, readLimit) : await fs.promises.readFile(target)
        if (isBinary(buffer)) {
          return { success: false, error: `文件疑似二进制内容，无法按文本读取：${relativePath}` }
        }

        let content = buffer.toString('utf8')
        if (truncated) {
          content += `\n\n[内容已截断：文件共 ${formatSize(stat.size)}，本次仅返回前 ${formatSize(readLimit)}；可提高 max_bytes 或先 search 定位后分段读取]`
        }

        return {
          success: true,
          content,
          metadata: {
            action,
            path: relativePath,
            size: stat.size,
            returnedBytes: buffer.length,
            truncated,
            lines: content.split('\n').length,
            modified: stat.mtime.toISOString()
          }
        }
      }

      case 'write':
      case 'append': {
        if (typeof params.content !== 'string') {
          return { success: false, error: `${action === 'write' ? '写入' : '追加'}需要 content 参数（可为空字符串）` }
        }

        const existing = await fs.promises.lstat(target).catch(() => null)
        if (existing && !existing.isFile()) {
          return { success: false, error: `目标不是文件：${relativePath}` }
        }
        if (action === 'write' && existing && params.overwrite === false) {
          return { success: false, error: `文件已存在：${relativePath}；已按 overwrite=false 拒绝覆盖` }
        }

        if (context.dryRun) {
          let oldContent = ''
          if (existing) {
            if (existing.size > PREVIEW_MAX_BYTES) {
              return {
                success: true,
                preview: { kind: 'summary', path: relativePath, text: '文件较大，本次不展示差异预览' }
              }
            }
            const buffer = await fs.promises.readFile(target)
            if (isBinary(buffer)) {
              return {
                success: true,
                preview: { kind: 'summary', path: relativePath, text: '目标为二进制文件，本次不展示差异预览' }
              }
            }
            oldContent = buffer.toString('utf8')
          }

          const nextContent = action === 'write' ? params.content : oldContent + params.content
          const diff = computeLineDiff(oldContent, nextContent)
          return {
            success: true,
            preview: {
              kind: 'diff',
              path: relativePath,
              added: diff.added,
              removed: diff.removed,
              truncated: diff.truncated,
              approximate: diff.approximate,
              lines: diff.lines,
              oldSize: existing?.size ?? 0,
              newSize: Buffer.byteLength(nextContent, 'utf8')
            }
          }
        }

        if (params.create_dirs) {
          await fs.promises.mkdir(path.dirname(target), { recursive: true })
        }

        const snapshots = await recordSnapshots(context, [target])

        if (action === 'write') {
          await fs.promises.writeFile(target, params.content, 'utf8')
        } else {
          await fs.promises.appendFile(target, params.content, 'utf8')
        }

        const stat = await fs.promises.stat(target)
        return {
          success: true,
          content: `${action === 'write' ? '已写入' : '已追加'}：${relativePath}（${formatSize(stat.size)}）`,
          metadata: { action, path: relativePath, size: stat.size, snapshots: snapshots.length }
        }
      }

      case 'mkdir': {
        const existing = await fs.promises.stat(target).catch(() => null)
        if (context.dryRun) {
          return {
            success: true,
            preview: { kind: 'summary', path: relativePath, text: existing ? '目录已存在' : '创建新目录' }
          }
        }

        const snapshots = await recordSnapshots(context, [target])
        await fs.promises.mkdir(target, { recursive: true })

        return {
          success: true,
          content: existing ? `目录已存在：${relativePath}` : `已创建目录：${relativePath}`,
          metadata: { action, path: relativePath, created: !existing, snapshots: snapshots.length }
        }
      }

      case 'copy': {
        const destinationResult = resolveTarget(
          params.destination,
          base.basePath,
          context.isPathWithinBase,
          'destination'
        )
        if (destinationResult.error) return { success: false, error: destinationResult.error }

        if (destinationResult.target === target) {
          return { success: false, error: '源路径与目标路径相同' }
        }
        if (context.isPathWithinBase(target, destinationResult.target)) {
          return { success: false, error: '目标不能是源路径的上级目录' }
        }

        const sourceStat = await fs.promises.lstat(target)
        if (sourceStat.isDirectory() && context.isPathWithinBase(destinationResult.target, target)) {
          return { success: false, error: '不能把目录复制到自身内部' }
        }

        const destination = displayPath(base.basePath, destinationResult.target)
        if (context.dryRun) {
          return {
            success: true,
            preview: {
              kind: 'transfer',
              mode: 'copy',
              from: relativePath,
              to: destination,
              overwrite: Boolean(params.overwrite)
            }
          }
        }

        const destinationExisting = await fs.promises.lstat(destinationResult.target).catch(() => null)
        const snapshots = destinationExisting ? await recordSnapshots(context, [destinationResult.target]) : []

        const result = await copyEntry(target, destinationResult.target, {
          overwrite: Boolean(params.overwrite),
          createDirs: Boolean(params.create_dirs),
          recursive: Boolean(params.recursive)
        })
        if (result.error) return { success: false, error: result.error }

        return {
          success: true,
          content: `已复制：${relativePath} -> ${destination}`,
          metadata: {
            action,
            path: relativePath,
            destination,
            snapshots: snapshots.length
          }
        }
      }

      case 'move': {
        const destinationResult = resolveTarget(
          params.destination,
          base.basePath,
          context.isPathWithinBase,
          'destination'
        )
        if (destinationResult.error) return { success: false, error: destinationResult.error }

        if (destinationResult.target === target) {
          return { success: false, error: '源路径与目标路径相同' }
        }
        if (context.isPathWithinBase(target, destinationResult.target)) {
          return { success: false, error: '目标不能是源路径的上级目录' }
        }

        const sourceStat = await fs.promises.lstat(target)
        if (sourceStat.isDirectory() && context.isPathWithinBase(destinationResult.target, target)) {
          return { success: false, error: '不能把目录移动到自身内部' }
        }

        const existing = await fs.promises.lstat(destinationResult.target).catch(() => null)
        if (existing && !params.overwrite) {
          return {
            success: false,
            error: `目标已存在：${displayPath(base.basePath, destinationResult.target)}；覆盖请设置 overwrite=true`
          }
        }

        const destination = displayPath(base.basePath, destinationResult.target)
        if (context.dryRun) {
          return {
            success: true,
            preview: {
              kind: 'transfer',
              mode: 'move',
              from: relativePath,
              to: destination,
              overwrite: Boolean(params.overwrite)
            }
          }
        }

        const snapshots = await recordSnapshots(context, existing ? [target, destinationResult.target] : [target])

        await moveEntry(target, destinationResult.target, Boolean(params.overwrite), Boolean(params.create_dirs))

        return {
          success: true,
          content: `已移动：${relativePath} -> ${destination}`,
          metadata: {
            action,
            path: relativePath,
            destination,
            snapshots: snapshots.length
          }
        }
      }

      case 'delete': {
        if (params.confirm !== true) {
          return { success: false, error: '删除操作需要显式设置 confirm=true' }
        }

        if (await isBaseRoot(target, base.basePath)) {
          return { success: false, error: '拒绝删除 base_path 根目录' }
        }

        const stat = await fs.promises.lstat(target)
        if (stat.isDirectory() && !params.recursive) {
          return { success: false, error: `删除目录需要设置 recursive=true：${relativePath}` }
        }

        if (context.dryRun) {
          const preview = await collectDeletePreview(target, base.basePath)
          return {
            success: true,
            preview: {
              kind: 'delete',
              path: relativePath,
              type: stat.isDirectory() ? 'directory' : 'file',
              total: preview.total,
              totalSize: preview.totalSize,
              items: preview.items,
              truncated: preview.truncated
            }
          }
        }

        const snapshots = await recordSnapshots(context, [target])
        await fs.promises.rm(target, { recursive: Boolean(params.recursive), force: false })

        return {
          success: true,
          content: `已删除：${relativePath}`,
          metadata: {
            action,
            path: relativePath,
            type: stat.isDirectory() ? 'directory' : 'file',
            snapshots: snapshots.length
          }
        }
      }

      case 'search': {
        if (typeof params.pattern !== 'string' || !params.pattern.trim()) {
          return { success: false, error: 'search 需要非空的 pattern 参数' }
        }

        const stat = await fs.promises.stat(target)
        if (!stat.isDirectory()) {
          return { success: false, error: `搜索起点不是目录：${relativePath}` }
        }

        const result = await searchDirectory(
          target,
          params.pattern.trim(),
          typeof params.content_match === 'string' ? params.content_match.trim() : '',
          limit
        )

        let content = `搜索 "${params.pattern}"：命中 ${result.matches.length} 项，扫描 ${result.scanned} 项\n`
        content += result.matches
          .map((item) => `- ${item.path}（${item.matched === 'name' ? '文件名' : '内容'}）`)
          .join('\n')
        if (result.truncated) content += '\n... 结果已截断，请缩小范围或提高 limit'
        if (result.contentScanTruncated) content += '\n注意：内容匹配达到扫描上限，部分文件未检查内容'

        return {
          success: true,
          content,
          metadata: {
            action,
            path: relativePath,
            pattern: params.pattern,
            content_match: params.content_match || '',
            scanned: result.scanned,
            returned: result.matches.length,
            truncated: result.truncated,
            content_scan_truncated: result.contentScanTruncated,
            matches: result.matches
          }
        }
      }

      case 'stat': {
        const stat = await fs.promises.lstat(target)
        const type = stat.isDirectory()
          ? 'directory'
          : stat.isFile()
            ? 'file'
            : stat.isSymbolicLink()
              ? 'symlink'
              : 'other'

        const content = [
          `路径：${relativePath}`,
          `类型：${type}`,
          `大小：${formatSize(stat.size)}`,
          `修改时间：${stat.mtime.toISOString()}`,
          `创建时间：${stat.birthtime.toISOString()}`,
          `权限：${(stat.mode & 0o777).toString(8)}`
        ].join('\n')

        return {
          success: true,
          content,
          metadata: {
            action,
            path: relativePath,
            type,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            created: stat.birthtime.toISOString(),
            mode: (stat.mode & 0o777).toString(8)
          }
        }
      }

      default:
        return { success: false, error: `未知的操作类型：${action}` }
    }
  } catch (error) {
    log.debug(`file-ops ${action} 失败`)
    return { success: false, error: error.message }
  }
}
