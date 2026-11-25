import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  basePath: '',
  openFile: vi.fn(async () => ({ success: true })),
  openFolder: vi.fn(async () => ({ success: true }))
}))

vi.mock('../src/main/services/config', () => ({
  getConfig: vi.fn(() => ({ sql_generator: { base_path: state.basePath, text_edit_app: 'code' } }))
}))

vi.mock('../src/main/services/fileOpener.js', () => ({
  openFile: state.openFile,
  openFolder: state.openFolder
}))

const root = path.join(os.tmpdir(), `ntoolbox-workspace-${process.pid}`)
const repo = path.join(root, 'repo')
const plain = path.join(root, 'plain')

function git(args) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'test',
      GIT_COMMITTER_EMAIL: 'test@example.com'
    }
  }).trim()
}

describe('workspace service', () => {
  let service

  beforeAll(async () => {
    fs.mkdirSync(repo, { recursive: true })
    fs.mkdirSync(plain, { recursive: true })
    git(['init', '-b', 'feature/workspace'])
    fs.writeFileSync(path.join(repo, 'app.js'), 'console.log(1)\n')
    git(['add', 'app.js'])
    git(['commit', '-m', 'init workspace'])
    fs.writeFileSync(path.join(repo, 'app.js'), 'console.log(2)\n')
    fs.writeFileSync(path.join(repo, 'new.txt'), 'draft\n')
    state.basePath = root
    service = await import('../src/main/services/agent/workspace.js')
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('reads git branch, changes and last commit', async () => {
    const info = await service.getWorkspaceInfo(repo)
    expect(info.success).toBe(true)
    expect(info.path).toBe(repo)
    expect(info.name).toBe('repo')
    expect(info.isGit).toBe(true)
    expect(info.branch).toBe('feature/workspace')
    expect(info.changes).toBe(2)
    expect(info.unstaged).toBe(1)
    expect(info.untracked).toBe(1)
    expect(info.ahead).toBe(0)
    expect(info.behind).toBe(0)
    expect(info.lastCommit.subject).toBe('init workspace')
  })

  it('reports non git folders without failing', async () => {
    const info = await service.getWorkspaceInfo(plain)
    expect(info.success).toBe(true)
    expect(info.isGit).toBe(false)
    expect(info.branch).toBe('')
  })

  it('rejects missing or invalid workspace paths', async () => {
    expect((await service.getWorkspaceInfo('')).success).toBe(false)
    expect((await service.getWorkspaceInfo(path.join(root, 'missing'))).success).toBe(false)
    expect((await service.getWorkspaceInfo(path.join(repo, 'app.js'))).success).toBe(false)
  })

  it('opens files and folders only inside the workspace', async () => {
    state.openFile.mockClear()
    state.openFolder.mockClear()

    const file = path.join(repo, 'app.js')
    expect(await service.openWorkspaceItem(repo, file)).toEqual({ success: true, error: '' })
    expect(state.openFile).toHaveBeenCalledWith(file, 'code')

    expect(await service.openWorkspaceItem(repo, repo)).toEqual({ success: true, error: '' })
    expect(state.openFolder).toHaveBeenCalledWith(repo)

    const outside = path.join(root, 'plain')
    const escaped = await service.openWorkspaceItem(repo, outside)
    expect(escaped.success).toBe(false)
    expect(state.openFile).toHaveBeenCalledTimes(1)
    expect(state.openFolder).toHaveBeenCalledTimes(1)
  })
})
