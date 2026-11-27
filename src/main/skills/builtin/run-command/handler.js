import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const MAX_ARGS = 40
const MAX_ARG_LENGTH = 300
const MAX_TIMEOUT = 100000
const DEFAULT_TIMEOUT = 60000
const MAX_STDOUT = 20000
const MAX_STDERR = 12000

const ALLOWED_COMMANDS = new Set([
  'npm',
  'pnpm',
  'yarn',
  'node',
  'tsc',
  'eslint',
  'prettier',
  'vitest',
  'jest',
  'git',
  'python',
  'python3',
  'pytest',
  'ruff',
  'mypy',
  'cargo',
  'go',
  'dotnet'
])

const PACKAGE_VERBS = new Set(['test', 't', 'run', 'run-script', 'ls', 'why', 'outdated'])
const PACKAGE_DENY_FLAGS = ['--prefix', '--cwd', '-C']
const GIT_SUBCOMMANDS = new Set([
  'status',
  'diff',
  'log',
  'show',
  'branch',
  'rev-parse',
  'ls-files',
  'blame',
  'describe',
  'shortlog'
])
const GIT_DENY_FLAGS = [
  '--output',
  '--ext-diff',
  '--textconv',
  '--git-dir',
  '--work-tree',
  '--exec-path',
  '--upload-pack',
  '-C'
]
const NODE_VERBS = new Set(['--version', '-v', '--check', '--test'])
const NODE_DENY_FLAGS = ['-e', '--eval', '-p', '--print', '-i', '--interactive']
const CARGO_VERBS = new Set(['test', 'check', 'build', 'clippy', 'metadata', 'tree', '--version', '-V'])
const GO_VERBS = new Set(['test', 'vet', 'build', 'version', 'env', 'list'])
const DOTNET_VERBS = new Set(['test', 'build', '--version', '--info'])

function isDeniedFlag(arg, flag) {
  if (arg === flag) return true
  if (flag.startsWith('--')) return arg.startsWith(`${flag}=`)
  return arg.startsWith(flag) && arg.length > flag.length && !arg.startsWith('--')
}

function hasDeniedFlag(args, flags) {
  return args.some((arg) => flags.some((flag) => isDeniedFlag(arg, flag)))
}

function validateArg(arg) {
  if (typeof arg !== 'string') return '命令参数必须是字符串'
  if (!arg) return '命令参数不能为空字符串'
  if (arg.length > MAX_ARG_LENGTH) return `命令参数过长（上限 ${MAX_ARG_LENGTH} 字符）`
  if (/[\0\r\n]/.test(arg)) return '命令参数不能包含换行或空字符'
  if (/[;&|`]|\$\(/.test(arg)) return `命令参数不能包含 shell 特殊字符：${arg}`
  if (process.platform === 'win32' && /[<>^%!"()]/.test(arg)) {
    return `命令参数包含 Windows 不安全的字符：${arg}`
  }
  return ''
}

function looksLikeEscapingPath(arg) {
  if (arg.startsWith('~/') || arg === '~') return true
  if (arg.startsWith('/') || arg.startsWith('\\\\')) return true
  if (/^[A-Za-z]:[\\/]/.test(arg)) return true
  return arg.split(/[\\/]/).includes('..')
}

function validateCommand(command, args) {
  if (typeof command !== 'string' || !command.trim()) return { error: '请提供 command 参数' }
  const name = command.trim()
  if (name !== command || name.includes('/') || name.includes('\\')) {
    return { error: `不支持的命令：${command}；只能使用白名单内的命令名` }
  }
  const normalized = process.platform === 'win32' ? name.toLowerCase() : name
  if (!ALLOWED_COMMANDS.has(normalized)) {
    return { error: `不支持的命令：${command}；可用命令：${[...ALLOWED_COMMANDS].join('、')}` }
  }
  if (!Array.isArray(args)) return { error: 'args 必须是字符串数组' }
  if (args.length > MAX_ARGS) return { error: `命令参数过多（上限 ${MAX_ARGS} 个）` }

  for (const arg of args) {
    const error = validateArg(arg)
    if (error) return { error }
    if (looksLikeEscapingPath(arg)) {
      return { error: `命令参数不能引用工作区外的绝对路径或上级目录：${arg}` }
    }
  }

  if (['npm', 'pnpm', 'yarn'].includes(normalized)) {
    const verb = args[0]
    if (!verb) return { error: `${normalized} 需要子命令，例如 test 或 run lint` }
    if (!PACKAGE_VERBS.has(verb) && verb !== '--version' && verb !== '-v') {
      return {
        error: `不允许 ${normalized} ${verb}；仅支持测试、run 脚本与只读查询。安装依赖需由用户在工作区手动执行，请停止重试，说明缺少的包与手动安装命令`
      }
    }
    if (hasDeniedFlag(args, PACKAGE_DENY_FLAGS)) {
      return { error: `${normalized} 不允许切换工作目录或前缀参数` }
    }
  }

  if (normalized === 'git') {
    if (!args[0]) return { error: 'git 需要子命令，例如 status 或 diff' }
    const subcommand = args[0] === '--version' ? '--version' : args[0]
    if (subcommand !== '--version' && !GIT_SUBCOMMANDS.has(subcommand)) {
      return { error: `不允许 git ${subcommand}；仅支持只读子命令：${[...GIT_SUBCOMMANDS].join('、')}` }
    }
    if (hasDeniedFlag(args, GIT_DENY_FLAGS)) {
      return { error: 'git 命令包含不允许的参数（可能跳出工作区或写入文件）' }
    }
  }

  if (normalized === 'node') {
    if (!args[0] || !NODE_VERBS.has(args[0])) {
      return { error: 'node 仅允许 --version、--check 或 --test' }
    }
    if (hasDeniedFlag(args, NODE_DENY_FLAGS)) {
      return { error: 'node 不允许内联执行代码参数，请改用 code-exec 工具' }
    }
  }

  if (normalized === 'prettier' && hasDeniedFlag(args, ['--write', '-w'])) {
    return { error: 'prettier 不允许 --write；需要格式化修改请让 AI 使用 file-ops edit' }
  }
  if (normalized === 'eslint' && hasDeniedFlag(args, ['--fix'])) {
    return { error: 'eslint 不允许 --fix；需要修复请让 AI 使用 file-ops edit' }
  }
  if (normalized === 'cargo' && (!args[0] || !CARGO_VERBS.has(args[0]))) {
    return { error: 'cargo 仅允许 test、check、build、clippy、metadata 或 tree' }
  }
  if (normalized === 'go' && (!args[0] || !GO_VERBS.has(args[0]))) {
    return { error: 'go 仅允许 test、vet、build、version、env 或 list' }
  }
  if (normalized === 'dotnet' && (!args[0] || !DOTNET_VERBS.has(args[0]))) {
    return { error: 'dotnet 仅允许 test、build、--version 或 --info' }
  }
  if ((normalized === 'python' || normalized === 'python3') && hasDeniedFlag(args, ['-c'])) {
    return { error: 'python 不允许 -c 内联执行代码，请运行工作区内的脚本文件' }
  }

  return { name: normalized }
}

function quoteWindowsArg(arg) {
  return /[\s]/.test(arg) ? `"${arg}"` : arg
}

function buildEnv(baseEnv) {
  const allowed = [
    'PATH',
    'Path',
    'PATHEXT',
    'SystemRoot',
    'windir',
    'ComSpec',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
    'HOME',
    'TMPDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'SHELL'
  ]
  const env = {}
  for (const key of allowed) {
    if (typeof baseEnv[key] === 'string') env[key] = baseEnv[key]
  }
  env.NO_COLOR = '1'
  env.FORCE_COLOR = '0'
  env.CI = '1'
  return env
}

const PACKAGE_MANAGER_LOCKS = [
  ['pnpm', 'pnpm-lock.yaml'],
  ['yarn', 'yarn.lock'],
  ['npm', 'package-lock.json']
]

function detectPackageManager(root) {
  let declared = ''
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    const field = typeof pkg.packageManager === 'string' ? pkg.packageManager.split('@')[0] : ''
    if (PACKAGE_MANAGER_LOCKS.some(([name]) => name === field)) declared = field
  } catch {
    declared = ''
  }
  if (declared) return declared
  for (const [name, lock] of PACKAGE_MANAGER_LOCKS) {
    if (fs.existsSync(path.join(root, lock))) return name
  }
  return ''
}

function missingCommandHint(name, root) {
  if (!['npm', 'pnpm', 'yarn'].includes(name)) return ''
  const expected = detectPackageManager(root)
  if (!expected || expected === name) return ''
  return `；当前工作区使用的包管理器是 ${expected}，请改用 ${expected} 运行脚本`
}

function resolveWorkspace(workspacePath) {
  if (typeof workspacePath !== 'string' || !path.isAbsolute(workspacePath.trim())) {
    return { error: '未绑定工作区，请先为当前会话选择工作区后再运行命令' }
  }
  const root = path.resolve(workspacePath.trim())
  try {
    if (!fs.statSync(root).isDirectory()) return { error: `工作区不是目录：${root}` }
  } catch {
    return { error: `工作区不存在：${root}` }
  }
  return { root }
}

function runProcess(name, args, root, timeout) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const commandLine = [name, ...args].join(' ')
    const useShell = process.platform === 'win32'
    const executable = useShell ? process.env.ComSpec || 'cmd.exe' : name
    const spawnArgs = useShell ? ['/d', '/s', '/c', [name, ...args].map(quoteWindowsArg).join(' ')] : args

    let child
    try {
      child = spawn(executable, spawnArgs, {
        cwd: root,
        env: buildEnv(process.env),
        windowsHide: true,
        windowsVerbatimArguments: useShell,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (error) {
      resolve({ success: false, error: `无法启动命令：${error.message}` })
      return
    }

    let stdout = ''
    let stderr = ''
    let truncated = false
    let timedOut = false

    child.stdout.on('data', (chunk) => {
      if (stdout.length >= MAX_STDOUT) {
        truncated = true
        return
      }
      stdout += chunk.toString('utf8')
      if (stdout.length > MAX_STDOUT) {
        stdout = stdout.slice(0, MAX_STDOUT)
        truncated = true
      }
    })
    child.stderr.on('data', (chunk) => {
      if (stderr.length >= MAX_STDERR) {
        truncated = true
        return
      }
      stderr += chunk.toString('utf8')
      if (stderr.length > MAX_STDERR) {
        stderr = stderr.slice(0, MAX_STDERR)
        truncated = true
      }
    })

    const timer = setTimeout(() => {
      timedOut = true
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
        } else if (child.pid) {
          process.kill(-child.pid, 'SIGKILL')
        }
      } catch {
        child.kill('SIGKILL')
      }
    }, timeout)
    if (typeof timer.unref === 'function') timer.unref()

    child.on('error', (error) => {
      clearTimeout(timer)
      const hint = error.code === 'ENOENT' ? missingCommandHint(name, root) : ''
      resolve({ success: false, error: `无法启动命令 ${name}：${error.message}${hint}` })
    })

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const duration = Date.now() - startedAt
      const exitCode = typeof code === 'number' ? code : null
      const success = !timedOut && exitCode === 0

      const exitLabel = timedOut ? '超时终止' : (exitCode ?? signal ?? '未知')
      const sections = [`命令：${commandLine}`, `退出码：${exitLabel}`]
      sections.push(`用时：${duration}ms`)
      if (stdout.trim()) sections.push(`stdout:\n${stdout.trimEnd()}`)
      if (stderr.trim()) sections.push(`stderr:\n${stderr.trimEnd()}`)
      if (truncated) sections.push('[输出已截断，仅保留前一部分内容]')
      if (timedOut) sections.push(`[命令执行超过 ${timeout}ms，已被终止]`)

      resolve({
        success,
        content: sections.join('\n'),
        metadata: {
          command: name,
          args,
          exitCode,
          signal: signal || '',
          timedOut,
          duration,
          truncated,
          stdoutBytes: Buffer.byteLength(stdout, 'utf8'),
          stderrBytes: Buffer.byteLength(stderr, 'utf8')
        },
        error: success
          ? undefined
          : timedOut
            ? `命令超时（${timeout}ms）已被终止`
            : `命令退出码 ${exitCode ?? '未知'}${stderr.trim() ? `：${stderr.trim().split('\n')[0].slice(0, 200)}` : ''}`
      })
    })
  })
}

export default async function handler(params, context = {}) {
  const { log } = context
  const validation = validateCommand(params.command, params.args ?? [])
  if (validation.error) return { success: false, error: validation.error }

  const workspace = resolveWorkspace(context.workspacePath)
  if (workspace.error) return { success: false, error: workspace.error }

  const timeout = Math.max(1000, Math.min(Number(params.timeout_ms) || DEFAULT_TIMEOUT, MAX_TIMEOUT))
  log?.debug?.(`执行 run-command: ${validation.name}，工作区 ${workspace.root}`)

  return await runProcess(validation.name, params.args ?? [], workspace.root, timeout)
}
