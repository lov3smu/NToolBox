import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

const DEFAULT_MAX_CHARS = 1800
const MAX_DEPTH = 3
const MAX_ENTRIES = 120
const CACHE_TTL_MS = 60 * 1000
const GIT_TIMEOUT_MS = 2500

const IGNORED_DIRS = new Set([
  '.git',
  '.svn',
  '.hg',
  'node_modules',
  'bower_components',
  'dist',
  'build',
  'out',
  'release',
  'target',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  '.parcel-cache',
  '.turbo',
  '.venv',
  'venv',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.idea',
  '.gradle',
  '.terraform',
  '.qoder',
  'tmp',
  'temp'
])

const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'])

const ENTRY_CANDIDATES = [
  'src/main/index.js',
  'src/main/index.ts',
  'src/index.js',
  'src/index.ts',
  'src/App.vue',
  'src/main.js',
  'src/main.ts',
  'main.js',
  'main.py',
  'app.py',
  'manage.py',
  'cmd/main.go',
  'main.go',
  'Program.cs',
  'Cargo.toml'
]

const cache = new Map()

function isIgnoredDir(name) {
  return IGNORED_DIRS.has(name) || name.startsWith('.git')
}

function listTree(root, maxEntries) {
  const lines = []
  let entries = 0
  let truncated = false

  const walk = (dir, depth, prefix) => {
    if (truncated || depth > MAX_DEPTH) return
    let dirents
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    dirents.sort((a, b) => {
      const aDir = a.isDirectory() ? 0 : 1
      const bDir = b.isDirectory() ? 0 : 1
      if (aDir !== bDir) return aDir - bDir
      return a.name.localeCompare(b.name)
    })

    for (const dirent of dirents) {
      if (entries >= maxEntries) {
        truncated = true
        return
      }
      const name = dirent.name
      if (dirent.isDirectory()) {
        if (isIgnoredDir(name)) continue
        lines.push(`${prefix}${name}/`)
        entries += 1
        walk(path.join(dir, name), depth + 1, `${prefix}  `)
      } else if (dirent.isFile()) {
        if (IGNORED_FILES.has(name)) continue
        lines.push(`${prefix}${name}`)
        entries += 1
      }
    }
  }

  walk(root, 1, '  ')
  return { lines, truncated }
}

function readPackageSummary(root) {
  const file = path.join(root, 'package.json')
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    const parts = []
    if (typeof parsed.name === 'string' && parsed.name.trim()) parts.push(`name=${parsed.name.trim()}`)
    const scripts = parsed.scripts && typeof parsed.scripts === 'object' ? Object.keys(parsed.scripts) : []
    if (scripts.length) parts.push(`脚本：${scripts.slice(0, 10).join(', ')}${scripts.length > 10 ? ' …' : ''}`)
    return parts.length ? `package.json：${parts.join('；')}` : ''
  } catch {
    return ''
  }
}

function readEntryHints(root) {
  const found = ENTRY_CANDIDATES.filter((relative) => fs.existsSync(path.join(root, relative)))
  return found.length ? `入口线索：${found.slice(0, 6).join(', ')}` : ''
}

function readGitSummary(root) {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['status', '--porcelain=v1', '-b'],
      { cwd: root, timeout: GIT_TIMEOUT_MS, maxBuffer: 256 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error || typeof stdout !== 'string') {
          resolve('')
          return
        }
        const lines = stdout.split('\n').filter(Boolean)
        const header = lines[0] || ''
        const branch = header.startsWith('## ') ? header.slice(3).split('...')[0].trim() : ''
        const changes = lines.length - (header ? 1 : 0)
        if (!branch && !changes) {
          resolve('')
          return
        }
        resolve(`git：${branch || '未知分支'}${changes ? `，${changes} 个未提交改动` : '，工作区干净'}`)
      }
    )
  })
}

function clampLines(lines, budget) {
  const kept = []
  let length = 0
  for (const line of lines) {
    if (length + line.length + 1 > budget) return { lines: kept, truncated: true }
    kept.push(line)
    length += line.length + 1
  }
  return { lines: kept, truncated: false }
}

export function invalidateRepoMap(workspacePath) {
  if (workspacePath) cache.delete(path.resolve(workspacePath))
}

export async function buildRepoMap(workspacePath, options = {}) {
  if (typeof workspacePath !== 'string' || !workspacePath.trim()) return ''
  const root = path.resolve(workspacePath.trim())
  try {
    if (!fs.statSync(root).isDirectory()) return ''
  } catch {
    return ''
  }

  const cacheKey = root
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value

  const maxChars = Math.max(400, Number(options.maxChars) || DEFAULT_MAX_CHARS)
  const { lines: treeLines, truncated } = listTree(root, MAX_ENTRIES)
  const sections = []

  const summaryLines = [readEntryHints(root), readPackageSummary(root), await readGitSummary(root)].filter(Boolean)
  if (summaryLines.length) sections.push(summaryLines.join('\n'))

  if (treeLines.length) {
    const budget = maxChars - sections.join('\n').length - 120
    const tree = clampLines(treeLines, Math.max(200, budget))
    const treeBody = tree.lines.join('\n')
    sections.push(`文件树（深度 ≤${MAX_DEPTH}）：\n${treeBody}`)
    if (tree.truncated || truncated) sections[sections.length - 1] += '\n…（列表已截断）'
  }

  if (!sections.length) return ''

  const value = `\n\n<repo_map>\n工作区概览（仅用于定位文件，具体内容请用 file-ops read/search 读取，不要凭空假设）：\n${sections.join('\n\n')}\n</repo_map>`
  cache.set(cacheKey, { at: Date.now(), value })
  return value
}
