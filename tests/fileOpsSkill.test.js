import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'
import fileOps from '../src/main/skills/builtin/file-ops/handler.js'
import { isPathWithinBase } from '../src/main/utils/sanitize.js'

const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-file-ops-'))
const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-file-ops-outside-'))
const context = {
  config: { sql_generator: { base_path: baseDir } },
  getConfig: () => ({ sql_generator: { base_path: baseDir } }),
  isPathWithinBase,
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }
}

function run(params) {
  return fileOps({ action: 'list', ...params }, context)
}

beforeAll(() => {
  fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'outside')
})

afterAll(() => {
  fs.rmSync(baseDir, { recursive: true, force: true })
  fs.rmSync(outsideDir, { recursive: true, force: true })
})

describe('file-ops path guard', () => {
  it('rejects relative and absolute paths outside base_path', async () => {
    const relative = await run({ action: 'read', path: '../escape.txt' })
    expect(relative.success).toBe(false)
    expect(relative.error).toContain('超出允许范围')

    const absolute = await run({ action: 'read', path: path.join(outsideDir, 'secret.txt') })
    expect(absolute.success).toBe(false)
    expect(absolute.error).toContain('超出允许范围')
  })

  it('rejects missing base_path', async () => {
    const result = await fileOps({ action: 'list' }, { ...context, config: {}, getConfig: () => ({}) })
    expect(result.success).toBe(false)
    expect(result.error).toContain('base_path')
  })

  it.skipIf(process.platform === 'win32')('rejects symlinks that escape base_path', async () => {
    const linkPath = path.join(baseDir, 'escape-link')
    fs.symlinkSync(path.join(outsideDir, 'secret.txt'), linkPath)

    const result = await run({ action: 'read', path: 'escape-link' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('超出允许范围')
  })
})

describe('file-ops write and read', () => {
  it('creates parent directories and reads the file back', async () => {
    const write = await run({
      action: 'write',
      path: 'nested/report.md',
      content: '# 报告\n内容',
      create_dirs: true
    })
    expect(write.success).toBe(true)
    expect(write.metadata.path).toBe(path.join('nested', 'report.md'))

    const read = await run({ action: 'read', path: 'nested/report.md' })
    expect(read.success).toBe(true)
    expect(read.content).toBe('# 报告\n内容')
    expect(read.metadata.lines).toBe(2)
  })

  it('overwrites existing files by default and honors explicit overwrite=false', async () => {
    const append = await run({ action: 'append', path: 'nested/report.md', content: '\n追加' })
    expect(append.success).toBe(true)

    const blocked = await run({ action: 'write', path: 'nested/report.md', content: '覆盖', overwrite: false })
    expect(blocked.success).toBe(false)
    expect(blocked.error).toContain('overwrite=false')

    const overwritten = await run({ action: 'write', path: 'nested/report.md', content: '覆盖' })
    expect(overwritten.success).toBe(true)

    const read = await run({ action: 'read', path: 'nested/report.md' })
    expect(read.content).toBe('覆盖')
  })

  it('edits with a unique match and reports duplicate or missing matches', async () => {
    fs.writeFileSync(path.join(baseDir, 'edit-me.txt'), 'const timeout = 5000\nconst retry = 2\n')

    const edited = await run({
      action: 'edit',
      path: 'edit-me.txt',
      old_string: 'const timeout = 5000',
      new_string: 'const timeout = 10000'
    })
    expect(edited.success).toBe(true)
    expect(edited.metadata.replacements).toBe(1)
    expect(fs.readFileSync(path.join(baseDir, 'edit-me.txt'), 'utf8')).toContain('const timeout = 10000')

    const missing = await run({ action: 'edit', path: 'edit-me.txt', old_string: 'not there', new_string: 'x' })
    expect(missing.success).toBe(false)
    expect(missing.error).toContain('未找到')

    fs.writeFileSync(path.join(baseDir, 'edit-me.txt'), 'same\nsame\n')
    const duplicated = await run({ action: 'edit', path: 'edit-me.txt', old_string: 'same', new_string: 'next' })
    expect(duplicated.success).toBe(false)
    expect(duplicated.error).toContain('匹配 2 处')

    const replacedAll = await run({
      action: 'edit',
      path: 'edit-me.txt',
      old_string: 'same',
      new_string: 'next',
      replace_all: true
    })
    expect(replacedAll.success).toBe(true)
    expect(replacedAll.metadata.replacements).toBe(2)
  })

  it('previews edits as a diff in dry-run mode without writing', async () => {
    fs.writeFileSync(path.join(baseDir, 'preview.txt'), 'alpha\nbeta\n')
    const preview = await fileOps(
      { action: 'edit', path: 'preview.txt', old_string: 'beta', new_string: 'gamma' },
      { ...context, dryRun: true }
    )
    expect(preview.success).toBe(true)
    expect(preview.preview.kind).toBe('diff')
    expect(preview.preview.added).toBe(1)
    expect(preview.preview.removed).toBe(1)
    expect(fs.readFileSync(path.join(baseDir, 'preview.txt'), 'utf8')).toBe('alpha\nbeta\n')
  })

  it('rejects binary files and truncates oversized reads', async () => {
    fs.writeFileSync(path.join(baseDir, 'binary.bin'), Buffer.from([0, 1, 2, 3]))
    const binary = await run({ action: 'read', path: 'binary.bin' })
    expect(binary.success).toBe(false)
    expect(binary.error).toContain('二进制')

    fs.writeFileSync(path.join(baseDir, 'large.txt'), 'x'.repeat(2048))
    const large = await run({ action: 'read', path: 'large.txt', max_bytes: 1024 })
    expect(large.success).toBe(true)
    expect(large.metadata.truncated).toBe(true)
    expect(large.metadata.size).toBe(2048)
    expect(large.metadata.returnedBytes).toBe(1024)
    expect(large.content.startsWith('x'.repeat(1024))).toBe(true)
    expect(large.content).toContain('内容已截断')
  })
})

describe('file-ops directory operations', () => {
  it('lists directories first and reports the total', async () => {
    const result = await run({ action: 'list', path: '.' })
    expect(result.success).toBe(true)
    expect(result.metadata.total).toBeGreaterThan(0)
    expect(result.content).toContain('[目录] nested/')

    const limited = await run({ action: 'list', path: '.', limit: 1 })
    expect(limited.metadata.returned).toBe(1)
    expect(limited.metadata.truncated).toBe(true)
  })

  it('creates directories and copies files and directories', async () => {
    const mkdir = await run({ action: 'mkdir', path: 'copies' })
    expect(mkdir.success).toBe(true)
    expect(mkdir.metadata.created).toBe(true)

    const copyFile = await run({ action: 'copy', path: 'nested/report.md', destination: 'copies/report.md' })
    expect(copyFile.success).toBe(true)
    expect(fs.readFileSync(path.join(baseDir, 'copies/report.md'), 'utf8')).toBe('覆盖')

    const copyDirWithoutRecursive = await run({ action: 'copy', path: 'nested', destination: 'copies/nested' })
    expect(copyDirWithoutRecursive.success).toBe(false)
    expect(copyDirWithoutRecursive.error).toContain('recursive=true')

    const copyDir = await run({
      action: 'copy',
      path: 'nested',
      destination: 'copies/nested',
      recursive: true
    })
    expect(copyDir.success).toBe(true)
    expect(fs.existsSync(path.join(baseDir, 'copies/nested/report.md'))).toBe(true)
  })

  it('refuses to copy or move a directory into itself', async () => {
    const copy = await run({ action: 'copy', path: 'nested', destination: 'nested/inner', recursive: true })
    expect(copy.success).toBe(false)

    const move = await run({ action: 'move', path: 'nested', destination: 'nested/inner' })
    expect(move.success).toBe(false)
  })

  it('moves files and respects overwrite protection', async () => {
    const blocked = await run({ action: 'move', path: 'copies/report.md', destination: 'nested/report.md' })
    expect(blocked.success).toBe(false)
    expect(blocked.error).toContain('目标已存在')

    const moved = await run({
      action: 'move',
      path: 'copies/report.md',
      destination: 'nested/moved.md'
    })
    expect(moved.success).toBe(true)
    expect(fs.existsSync(path.join(baseDir, 'copies/report.md'))).toBe(false)
    expect(fs.existsSync(path.join(baseDir, 'nested/moved.md'))).toBe(true)
  })

  it('requires confirmation for deletes and protects the base directory', async () => {
    const unconfirmed = await run({ action: 'delete', path: 'nested/moved.md' })
    expect(unconfirmed.success).toBe(false)
    expect(unconfirmed.error).toContain('confirm=true')

    const dirWithoutRecursive = await run({ action: 'delete', path: 'copies/nested', confirm: true })
    expect(dirWithoutRecursive.success).toBe(false)
    expect(dirWithoutRecursive.error).toContain('recursive=true')

    const root = await run({ action: 'delete', path: '.', confirm: true, recursive: true })
    expect(root.success).toBe(false)
    expect(root.error).toContain('根目录')

    const deleted = await run({ action: 'delete', path: 'nested/moved.md', confirm: true })
    expect(deleted.success).toBe(true)
    expect(fs.existsSync(path.join(baseDir, 'nested/moved.md'))).toBe(false)
  })

  it('returns file attributes', async () => {
    const result = await run({ action: 'stat', path: 'nested/report.md' })
    expect(result.success).toBe(true)
    expect(result.metadata.type).toBe('file')
    expect(result.metadata.size).toBeGreaterThan(0)
    expect(result.content).toContain('路径：')
  })
})

describe('file-ops search', () => {
  it('finds files by name and by content', async () => {
    fs.writeFileSync(path.join(baseDir, 'schema.sql'), 'CREATE TABLE users (id int);')
    fs.writeFileSync(path.join(baseDir, 'notes.txt'), 'contains CREATE TABLE marker')

    const byName = await run({ action: 'search', path: '.', pattern: 'schema' })
    expect(byName.success).toBe(true)
    expect(byName.metadata.matches.some((item) => item.name === 'schema.sql')).toBe(true)

    const byContent = await run({
      action: 'search',
      path: '.',
      pattern: 'unlikely-name',
      content_match: 'create table'
    })
    expect(byContent.success).toBe(true)
    expect(byContent.metadata.matches.map((item) => item.name).sort()).toEqual(['notes.txt', 'schema.sql'])
  })

  it('requires a pattern and a directory', async () => {
    expect((await run({ action: 'search', path: '.' })).success).toBe(false)
    expect((await run({ action: 'search', path: 'nested/report.md', pattern: 'x' })).success).toBe(false)
  })
})
