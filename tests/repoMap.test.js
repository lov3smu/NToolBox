import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildRepoMap, invalidateRepoMap } from '../src/main/services/agent/repoMap.js'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-repo-map-'))

beforeAll(() => {
  fs.mkdirSync(path.join(root, 'src', 'main'), { recursive: true })
  fs.mkdirSync(path.join(root, 'src', 'renderer'), { recursive: true })
  fs.mkdirSync(path.join(root, 'node_modules', 'pkg'), { recursive: true })
  fs.mkdirSync(path.join(root, 'dist'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'demo-app', scripts: { dev: 'vite', build: 'vite build' } })
  )
  fs.writeFileSync(path.join(root, 'src', 'main', 'index.js'), 'export default 1\n')
  fs.writeFileSync(path.join(root, 'src', 'renderer', 'App.vue'), '<template><div /></template>\n')
  fs.writeFileSync(path.join(root, 'README.md'), '# demo\n')
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}')
  fs.writeFileSync(path.join(root, 'node_modules', 'pkg', 'index.js'), '')
})

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('buildRepoMap', () => {
  it('returns empty string without a usable workspace', async () => {
    expect(await buildRepoMap('')).toBe('')
    expect(await buildRepoMap(path.join(root, 'missing'))).toBe('')
  })

  it('summarizes tree, entries, package scripts and ignores heavy directories', async () => {
    invalidateRepoMap(root)
    const map = await buildRepoMap(root)
    expect(map).toContain('<repo_map>')
    expect(map).toContain('src/')
    expect(map).toContain('index.js')
    expect(map).toContain('入口线索：src/main/index.js')
    expect(map).toContain('name=demo-app')
    expect(map).toContain('dev')
    expect(map).not.toContain('node_modules')
    expect(map).not.toContain('dist/')
    expect(map).not.toContain('package-lock.json')
  })

  it('respects the character budget and marks truncation', async () => {
    invalidateRepoMap(root)
    const map = await buildRepoMap(root, { maxChars: 400 })
    expect(map.length).toBeLessThan(1200)
  })

  it('caches per workspace until invalidated', async () => {
    invalidateRepoMap(root)
    const first = await buildRepoMap(root)
    fs.writeFileSync(path.join(root, 'fresh-file.txt'), 'x')
    const cached = await buildRepoMap(root)
    expect(cached).toBe(first)

    invalidateRepoMap(root)
    const refreshed = await buildRepoMap(root)
    expect(refreshed).toContain('fresh-file.txt')
  })
})
