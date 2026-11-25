import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'
import runCommand from '../src/main/skills/builtin/run-command/handler.js'

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-run-command-'))
const context = {
  workspacePath: workspace,
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function run(params) {
  return runCommand(params, context)
}

beforeAll(() => {
  fs.writeFileSync(path.join(workspace, 'index.js'), 'console.log(1)\n')
})

afterAll(() => {
  fs.rmSync(workspace, { recursive: true, force: true })
})

describe('run-command validation', () => {
  it('only allows whitelisted command names', async () => {
    for (const command of ['bash', 'sh', 'npx', 'rm', './node_modules/.bin/tsc', ' node']) {
      const result = await run({ command, args: [] })
      expect(result.success).toBe(false)
      expect(result.metadata).toBeUndefined()
    }
  })

  it('rejects shell metacharacters, newlines and escaping paths', async () => {
    const cases = [
      { command: 'node', args: ['--version', '&&', 'rm'] },
      { command: 'node', args: ['--version\n--eval'] },
      { command: 'node', args: ['../outside.js'] },
      { command: 'node', args: ['/etc/passwd'] },
      { command: 'node', args: ['~/secret.txt'] },
      { command: 'node', args: [123] }
    ]
    for (const params of cases) {
      const result = await run(params)
      expect(result.success).toBe(false)
    }
  })

  it('blocks inline code execution and write-side flags', async () => {
    expect((await run({ command: 'node', args: ['-e', 'process.exit(0)'] })).success).toBe(false)
    expect((await run({ command: 'python3', args: ['-c', 'print(1)'] })).success).toBe(false)
    expect((await run({ command: 'eslint', args: ['.', '--fix'] })).success).toBe(false)
    expect((await run({ command: 'prettier', args: ['--write', '.'] })).success).toBe(false)
  })

  it('blocks npm install and directory switching', async () => {
    expect((await run({ command: 'npm', args: ['install'] })).success).toBe(false)
    expect((await run({ command: 'npm', args: ['test', '--prefix', '../x'] })).success).toBe(false)
    expect((await run({ command: 'pnpm', args: ['add', 'left-pad'] })).success).toBe(false)
  })

  it('blocks git write subcommands and work-tree escape flags', async () => {
    expect((await run({ command: 'git', args: ['commit', '-m', 'x'] })).success).toBe(false)
    expect((await run({ command: 'git', args: ['checkout', '.'] })).success).toBe(false)
    expect((await run({ command: 'git', args: ['--git-dir=/tmp/x', 'status'] })).success).toBe(false)
    expect((await run({ command: 'git', args: ['status', '-C', '../other'] })).success).toBe(false)
  })

  it('requires a bound workspace', async () => {
    const missing = await runCommand({ command: 'node', args: ['--version'] }, {})
    expect(missing.success).toBe(false)
    expect(missing.error).toContain('工作区')

    const relative = await runCommand({ command: 'node', args: ['--version'] }, { workspacePath: 'relative/dir' })
    expect(relative.success).toBe(false)
  })
})

describe('run-command execution', () => {
  it('runs node --version inside the workspace', async () => {
    const result = await run({ command: 'node', args: ['--version'] })
    expect(result.success).toBe(true)
    expect(result.metadata.exitCode).toBe(0)
    expect(result.metadata.command).toBe('node')
    expect(result.metadata.duration).toBeGreaterThanOrEqual(0)
    expect(result.content).toContain('退出码：0')
    expect(result.content).toContain('v' + process.versions.node)
  })

  it('runs git --version as a harmless read-only command', async () => {
    const result = await run({ command: 'git', args: ['--version'] })
    if (!result.success && /无法启动命令/.test(result.error || '')) return
    expect(result.success).toBe(true)
    expect(result.metadata.exitCode).toBe(0)
    expect(result.content.toLowerCase()).toContain('git version')
  })

  it('reports a non-zero exit code with stderr', async () => {
    const result = await run({ command: 'node', args: ['--check', 'missing-file.js'] })
    expect(result.success).toBe(false)
    expect(result.metadata.exitCode).not.toBe(0)
    expect(result.error).toContain('命令退出码')
  })

  it.skipIf(process.platform === 'win32')(
    'suggests the workspace package manager when a binary is missing',
    async () => {
      const lock = path.join(workspace, 'package-lock.json')
      fs.writeFileSync(lock, '{}\n')
      const originalPath = process.env.PATH
      process.env.PATH = ''
      try {
        const result = await run({ command: 'pnpm', args: ['test'] })
        expect(result.success).toBe(false)
        expect(result.error).toContain('无法启动命令 pnpm')
        expect(result.error).toContain('请改用 npm')
      } finally {
        process.env.PATH = originalPath
        fs.rmSync(lock, { force: true })
      }
    }
  )
})
