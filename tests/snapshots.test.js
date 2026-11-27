import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'

const testUserData = path.join(os.tmpdir(), `ntoolbox-snapshots-${process.pid}`)

vi.mock('electron', () => ({
  app: { getPath: () => testUserData }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const { createSnapshotStore, restoreSnapshot } = await import('../src/main/services/agent/snapshots.js')

function buildWorkspace(name) {
  const workspace = path.join(testUserData, name)
  fs.mkdirSync(workspace, { recursive: true })
  return workspace
}

beforeAll(() => {
  fs.mkdirSync(testUserData, { recursive: true })
})

afterAll(() => {
  fs.rmSync(testUserData, { recursive: true, force: true })
})

describe('agent snapshots', () => {
  it('restores overwritten files and removes newly created files', async () => {
    const workspace = buildWorkspace('ws-restore')
    const existing = path.join(workspace, 'keep.txt')
    const created = path.join(workspace, 'created.txt')
    fs.writeFileSync(existing, 'before')

    const store = createSnapshotStore('run-restore')
    await store.record(existing)
    await store.record(created)

    fs.writeFileSync(existing, 'after')
    fs.writeFileSync(created, 'new file')

    const entries = store.entries()
    expect(entries).toHaveLength(2)
    expect(entries.find((entry) => entry.path === existing)?.existed).toBe(true)
    expect(entries.find((entry) => entry.path === created)?.existed).toBe(false)

    const result = await restoreSnapshot('run-restore')
    expect(result.success).toBe(true)
    expect(result.restored).toBe(2)
    expect(result.errors).toEqual([])
    expect(fs.readFileSync(existing, 'utf8')).toBe('before')
    expect(fs.existsSync(created)).toBe(false)
  })

  it('restores directory deletions from the backup', async () => {
    const workspace = buildWorkspace('ws-dir')
    const directory = path.join(workspace, 'logs')
    fs.mkdirSync(directory, { recursive: true })
    fs.writeFileSync(path.join(directory, 'app.log'), 'line')
    fs.mkdirSync(path.join(directory, 'archive'))
    fs.writeFileSync(path.join(directory, 'archive', 'old.log'), 'old')

    const store = createSnapshotStore('run-dir')
    await store.record(directory)
    fs.rmSync(directory, { recursive: true, force: true })

    const result = await restoreSnapshot('run-dir')
    expect(result.success).toBe(true)
    expect(fs.readFileSync(path.join(directory, 'app.log'), 'utf8')).toBe('line')
    expect(fs.readFileSync(path.join(directory, 'archive', 'old.log'), 'utf8')).toBe('old')
  })

  it('refuses to roll back when no snapshot exists', async () => {
    const result = await restoreSnapshot('missing-run')
    expect(result.success).toBe(false)
    expect(result.error).toContain('没有可撤销')
  })
})
