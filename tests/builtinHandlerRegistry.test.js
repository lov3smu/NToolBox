import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => os.tmpdir() } }))
vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const { builtinHandlers, getBuiltinHandler } = await import('../src/main/skills/builtin/registry.js')

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/main/skills/builtin')

describe('builtin handler registry', () => {
  it('registers a handler for every builtin skill that declares one', () => {
    const handlerDirs = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => JSON.parse(fs.readFileSync(path.join(root, entry.name, 'skill.json'), 'utf8')).handler)
      .map((entry) => entry.name)

    expect(handlerDirs.length).toBeGreaterThan(0)
    for (const dir of handlerDirs) {
      expect(typeof getBuiltinHandler(path.join(root, dir)), dir).toBe('function')
    }
    expect(Object.keys(builtinHandlers).sort()).toEqual(handlerDirs.sort())
  })
})
