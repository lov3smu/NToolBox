import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const MAX_CODE_LENGTH = 20000
const DEFAULT_TIMEOUT = 8000
const MAX_TIMEOUT = 20000
const MAX_OUTPUT = 20000
const MAX_FILES = 20

function nodeMajorVersion() {
  return Number(String(process.versions.node || '').split('.')[0]) || 0
}

function buildPermissionArgs(sandboxDir, workspacePath) {
  const major = nodeMajorVersion()
  const flag = major >= 23 ? '--permission' : major >= 20 ? '--experimental-permission' : ''
  if (!flag) return { args: [], enabled: false }
  const args = [flag, `--allow-fs-read=${sandboxDir}`, `--allow-fs-write=${sandboxDir}`]
  if (workspacePath) args.push(`--allow-fs-read=${workspacePath}`)
  return { args, enabled: true }
}

async function listSandboxFiles(root, current = root, depth = 0, output = []) {
  if (depth > 3 || output.length >= MAX_FILES) return output
  let names
  try {
    names = await fsp.readdir(current)
  } catch {
    return output
  }
  for (const name of names) {
    if (name === 'main.cjs') continue
    if (output.length >= MAX_FILES) break
    const target = path.join(current, name)
    let stat
    try {
      stat = await fsp.stat(target)
    } catch {
      continue
    }
    const relative = path.relative(root, target)
    if (stat.isDirectory()) {
      await listSandboxFiles(root, target, depth + 1, output)
    } else {
      output.push({ path: relative, size: stat.size })
    }
  }
  return output
}

function runProcess({ permissionArgs, scriptPath, sandboxDir, timeout }) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const child = spawn(process.execPath, [...permissionArgs, scriptPath], {
      cwd: sandboxDir,
      env: {
        PATH: process.env.PATH || '',
        HOME: sandboxDir,
        TMPDIR: sandboxDir,
        TEMP: sandboxDir,
        TMP: sandboxDir,
        NO_COLOR: '1',
        ELECTRON_RUN_AS_NODE: '1'
      },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    let truncated = false
    let timedOut = false

    const append = (current, chunk) => {
      if (current.length >= MAX_OUTPUT) {
        truncated = true
        return current
      }
      const next = current + chunk.toString('utf8')
      if (next.length > MAX_OUTPUT) {
        truncated = true
        return next.slice(0, MAX_OUTPUT)
      }
      return next
    }

    child.stdout.on('data', (chunk) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr = append(stderr, chunk)
    })

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeout)

    child.on('error', (error) => {
      clearTimeout(timer)
      resolve({
        exitCode: null,
        signal: null,
        stdout,
        stderr,
        truncated,
        timedOut,
        duration: Date.now() - startedAt,
        error
      })
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({
        exitCode: code,
        signal,
        stdout,
        stderr,
        truncated,
        timedOut,
        duration: Date.now() - startedAt
      })
    })
  })
}

export default async function handler(params, context) {
  const code = typeof params?.code === 'string' ? params.code : ''
  if (!code.trim()) return { success: false, error: '请提供要执行的代码' }
  if (code.length > MAX_CODE_LENGTH) {
    return { success: false, error: `代码过长（最多 ${MAX_CODE_LENGTH} 字符）` }
  }

  const timeout = Math.min(MAX_TIMEOUT, Math.max(1000, Number(params?.timeout_ms) || DEFAULT_TIMEOUT))
  const workspacePath =
    typeof context?.workspacePath === 'string' && context.workspacePath.trim()
      ? path.resolve(context.workspacePath.trim())
      : ''
  const readableWorkspace = workspacePath && fs.existsSync(workspacePath) ? workspacePath : ''

  let sandboxDir = ''
  try {
    sandboxDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ntoolbox-exec-'))
    const scriptPath = path.join(sandboxDir, 'main.cjs')
    await fsp.writeFile(scriptPath, code, 'utf8')

    const permission = buildPermissionArgs(sandboxDir, readableWorkspace)
    const outcome = await runProcess({
      permissionArgs: permission.args,
      scriptPath,
      sandboxDir,
      timeout
    })

    const files = await listSandboxFiles(sandboxDir)
    const blocks = []
    if (outcome.stdout) blocks.push(`stdout:\n${outcome.stdout.trimEnd()}`)
    if (outcome.stderr) blocks.push(`stderr:\n${outcome.stderr.trimEnd()}`)
    if (files.length)
      blocks.push(`沙箱文件：\n${files.map((file) => `- ${file.path}（${file.size} 字节）`).join('\n')}`)
    if (outcome.truncated) blocks.push('（输出过长已截断）')
    const content = blocks.join('\n\n') || '（无输出）'

    const metadata = {
      action: 'code-exec',
      exitCode: outcome.exitCode,
      signal: outcome.signal,
      timedOut: outcome.timedOut,
      duration: outcome.duration,
      permissionModel: permission.enabled,
      workspaceRead: Boolean(readableWorkspace),
      files
    }

    if (outcome.error) {
      return { success: false, error: `启动执行失败：${outcome.error.message}`, metadata }
    }
    if (outcome.timedOut) {
      return { success: false, error: `执行超时（${timeout} 毫秒），进程已终止`, content, metadata }
    }
    if (outcome.exitCode !== 0) {
      return { success: false, error: `代码以退出码 ${outcome.exitCode} 结束`, content, metadata }
    }
    return { success: true, content: `退出码：0 · 耗时 ${outcome.duration}ms\n\n${content}`, metadata }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      metadata: { action: 'code-exec', exitCode: null, permissionModel: false }
    }
  } finally {
    if (sandboxDir) await fsp.rm(sandboxDir, { recursive: true, force: true }).catch(() => {})
  }
}
