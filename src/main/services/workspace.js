import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isPathWithinBase } from '../utils/sanitize.js'
import { getConfig } from './config.js'
import { openFile, openFolder } from './generator.js'

const execFileAsync = promisify(execFile)
const GIT_TIMEOUT = 5000
const GIT_MAX_BUFFER = 1024 * 1024

async function runGit(cwd, args) {
  try {
    const { stdout } = await execFileAsync('git', args, {
      cwd,
      timeout: GIT_TIMEOUT,
      maxBuffer: GIT_MAX_BUFFER,
      windowsHide: true
    })
    return stdout
  } catch {
    return ''
  }
}

async function readGitInfo(root) {
  const topLevel = (await runGit(root, ['rev-parse', '--show-toplevel'])).trim()
  if (!topLevel) return null

  const [branchOutput, statusOutput, lastCommitOutput, trackingOutput] = await Promise.all([
    runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(root, ['status', '--porcelain']),
    runGit(root, ['log', '-1', '--format=%s%x00%ct']),
    runGit(root, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD'])
  ])
  const branch = branchOutput.trim()
  const status = statusOutput.replace(/\s+$/, '')
  const lastCommit = lastCommitOutput.trim()
  const tracking = trackingOutput.trim()

  const lines = status ? status.split('\n').filter(Boolean) : []
  const untracked = lines.filter((line) => line.startsWith('??')).length
  const staged = lines.filter((line) => /^[MADRC]/.test(line)).length
  const unstaged = lines.filter((line) => /^.[MADRC]/.test(line)).length

  let ahead = 0
  let behind = 0
  if (tracking) {
    const [left, right] = tracking.split(/\s+/).map((value) => Number(value) || 0)
    behind = left
    ahead = right
  }

  const [subject = '', timestamp = ''] = lastCommit.split('\u0000')
  return {
    isGit: true,
    repositoryRoot: topLevel,
    branch: branch === 'HEAD' ? 'detached' : branch,
    changes: lines.length,
    staged,
    unstaged,
    untracked,
    ahead,
    behind,
    lastCommit: subject ? { subject, time: Number(timestamp) ? Number(timestamp) * 1000 : null } : null
  }
}

export async function getWorkspaceInfo(input) {
  if (typeof input !== 'string' || !input.trim()) {
    return { success: false, error: '未选择工作区' }
  }

  const root = path.resolve(input.trim())
  let stat

  try {
    stat = await fs.promises.stat(root)
  } catch {
    return { success: false, error: '工作区目录不存在', path: root }
  }

  if (!stat.isDirectory()) {
    return { success: false, error: '工作区路径不是目录', path: root }
  }

  const git = await readGitInfo(root)

  return {
    success: true,
    path: root,
    name: path.basename(root) || root,
    updatedAt: stat.mtimeMs,
    isGit: Boolean(git),
    ...(git || {
      repositoryRoot: '',
      branch: '',
      changes: 0,
      staged: 0,
      unstaged: 0,
      untracked: 0,
      ahead: 0,
      behind: 0,
      lastCommit: null
    })
  }
}

export async function openWorkspaceItem(rootPath, targetPath) {
  if (typeof rootPath !== 'string' || typeof targetPath !== 'string') {
    return { success: false, error: '路径参数无效' }
  }

  const root = path.resolve(rootPath)
  const target = path.isAbsolute(targetPath) ? path.normalize(targetPath) : path.resolve(root, targetPath)

  if (!isPathWithinBase(target, root)) {
    return { success: false, error: '目标不在工作区内' }
  }

  let stat
  try {
    stat = await fs.promises.stat(target)
  } catch {
    return { success: false, error: '目标不存在' }
  }

  const opened = stat.isDirectory() ? await openFolder(target) : await openFile(target, getConfig().app.text_edit_app)
  return { success: Boolean(opened), error: opened ? '' : '无法打开目标' }
}
