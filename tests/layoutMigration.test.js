import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { migrateLegacyLayout, samePath } from '../src/main/utils/layoutMigration.js'

let root
let paths

function writeFile(target, content = 'x') {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content)
}

function buildLegacyProfile(root) {
  fs.mkdirSync(root, { recursive: true })
  const dbPath = path.join(root, 'ntoolbox.db')
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE run_traces (id TEXT PRIMARY KEY, file_path TEXT NOT NULL DEFAULT '');
    CREATE TABLE tool_results (id TEXT PRIMARY KEY, file_path TEXT NOT NULL DEFAULT '');
    CREATE TABLE tool_snapshots (request_id TEXT PRIMARY KEY, directory TEXT NOT NULL DEFAULT '');
  `)
  db.prepare('INSERT INTO run_traces (id, file_path) VALUES (?, ?)').run(
    'run-1',
    path.join(root, 'agent-runs', 'run-1.json')
  )
  db.prepare('INSERT INTO tool_results (id, file_path) VALUES (?, ?)').run(
    'call-1',
    path.join(root, 'agent-results', 'chat-1__call_00_1.txt')
  )
  db.prepare('INSERT INTO tool_snapshots (request_id, directory) VALUES (?, ?)').run(
    'chat-1',
    path.join(root, 'agent-snapshots', 'chat-1')
  )
  db.close()

  writeFile(path.join(root, 'ntoolbox.db-wal'), 'wal')
  writeFile(path.join(root, '.dbkey'), 'key')
  writeFile(path.join(root, 'config.json'), '{"config_version":2}')
  writeFile(path.join(root, 'password-vault.json'), '{}')
  writeFile(path.join(root, 'plugins.json'), '{"plugins":[]}')
  writeFile(path.join(root, 'agent-runs', 'run-1.json'), '{}')
  writeFile(path.join(root, 'agent-results', 'chat-1__call_00_1.txt'), 'payload')
  writeFile(path.join(root, 'agent-snapshots', 'chat-1', 'meta.json'), '{}')
  writeFile(path.join(root, 'memory', 'global', 'a.md'), '# a')
  writeFile(path.join(root, 'skills', 'demo', 'skill.json'), '{}')
  writeFile(path.join(root, 'plugins', 'demo', 'plugin.json'), '{}')
  writeFile(path.join(root, 'logs', 'main.log'), 'log')
  writeFile(path.join(root, 'Cache', 'Cache_Data', 'data_0'), 'cache')
  writeFile(path.join(root, 'Local Storage', 'leveldb', 'LOG'), 'ls')
  writeFile(path.join(root, 'Cookies'), 'cookies')
  writeFile(path.join(root, 'Preferences'), '{}')
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-layout-'))
  paths = {
    configDir: path.join(root, 'new', 'config'),
    dataDir: path.join(root, 'new', 'data'),
    cacheDir: path.join(root, 'new', 'cache'),
    logsDir: path.join(root, 'new', 'logs'),
    chromiumDir: path.join(root, 'new', 'cache', 'chromium')
  }
  for (const dir of Object.values(paths)) fs.mkdirSync(dir, { recursive: true })
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

describe('旧存储布局迁移', () => {
  it('按角色搬运数据、配置与 Chromium profile，并改写 SQLite 路径', () => {
    const legacyRoot = path.join(root, 'legacy')
    buildLegacyProfile(legacyRoot)
    const repoSource = path.join(root, 'repo')
    writeFile(path.join(repoSource, 'repo-skill', 'skill.json'), '{}')

    const report = migrateLegacyLayout({
      paths,
      legacyRoots: [legacyRoot],
      legacyConfigFiles: [path.join(legacyRoot, 'config.json')],
      legacyLogDirs: [path.join(legacyRoot, 'logs')],
      legacyRepoSources: [{ source: repoSource, target: path.join(paths.dataDir, 'repo-skills') }]
    })

    expect(report.warnings).toEqual([])
    expect(fs.existsSync(path.join(paths.dataDir, 'ntoolbox.db'))).toBe(true)
    expect(fs.existsSync(path.join(paths.dataDir, 'agent', 'runs', 'run-1.json'))).toBe(true)
    expect(fs.existsSync(path.join(paths.dataDir, 'agent', 'results', 'chat-1__call_00_1.txt'))).toBe(true)
    expect(fs.existsSync(path.join(paths.dataDir, 'agent', 'snapshots', 'chat-1', 'meta.json'))).toBe(true)
    expect(fs.existsSync(path.join(paths.dataDir, 'memory', 'global', 'a.md'))).toBe(true)
    expect(fs.existsSync(path.join(paths.configDir, '.dbkey'))).toBe(true)
    expect(fs.existsSync(path.join(paths.configDir, 'config.json'))).toBe(true)
    expect(fs.existsSync(path.join(paths.logsDir, 'main.log'))).toBe(true)
    expect(fs.existsSync(path.join(paths.chromiumDir, 'Cache', 'Cache_Data', 'data_0'))).toBe(true)
    expect(fs.existsSync(path.join(paths.chromiumDir, 'Local Storage', 'leveldb', 'LOG'))).toBe(true)
    expect(fs.existsSync(path.join(paths.chromiumDir, 'Cookies'))).toBe(true)
    expect(fs.existsSync(path.join(paths.dataDir, 'repo-skills', 'repo-skill', 'skill.json'))).toBe(true)

    const db = new DatabaseSync(path.join(paths.dataDir, 'ntoolbox.db'))
    const trace = db.prepare('SELECT file_path FROM run_traces WHERE id = ?').get('run-1')
    const tool = db.prepare('SELECT file_path FROM tool_results WHERE id = ?').get('call-1')
    const snapshot = db.prepare('SELECT directory FROM tool_snapshots WHERE request_id = ?').get('chat-1')
    db.close()
    expect(trace.file_path).toBe(path.join(paths.dataDir, 'agent', 'runs', 'run-1.json'))
    expect(tool.file_path).toBe(path.join(paths.dataDir, 'agent', 'results', 'chat-1__call_00_1.txt'))
    expect(snapshot.directory).toBe(path.join(paths.dataDir, 'agent', 'snapshots', 'chat-1'))
  })

  it('重复执行不产生任何动作', () => {
    const legacyRoot = path.join(root, 'legacy-2')
    writeFile(path.join(legacyRoot, 'agent-runs', 'run-9.json'), '{}')

    const first = migrateLegacyLayout({ paths, legacyRoots: [legacyRoot], legacyLogDirs: [] })
    const second = migrateLegacyLayout({ paths, legacyRoots: [legacyRoot], legacyLogDirs: [] })
    expect(first.actions.map((action) => action.kind).sort()).toEqual(['data', 'remove-empty'])
    expect(second.actions).toEqual([])
  })

  it('新 profile 已存在时删除旧缓存并把旧状态备份为 .previous', () => {
    const legacyRoot = path.join(root, 'legacy-chromium')
    writeFile(path.join(legacyRoot, 'Cache', 'entry.bin'), 'old-cache')
    writeFile(path.join(legacyRoot, 'Code Cache', 'js', 'entry'), 'old-code')
    writeFile(path.join(legacyRoot, 'Local Storage', 'leveldb', 'LOG'), 'old-state')
    writeFile(path.join(legacyRoot, 'Preferences'), '{"old":true}')
    writeFile(path.join(paths.chromiumDir, 'Cache', 'entry.bin'), 'new-cache')
    writeFile(path.join(paths.chromiumDir, 'Local Storage', 'leveldb', 'LOG'), 'new-state')
    writeFile(path.join(paths.chromiumDir, 'Preferences'), '{"new":true}')

    const report = migrateLegacyLayout({ paths, legacyRoots: [legacyRoot], legacyLogDirs: [] })

    expect(fs.existsSync(path.join(legacyRoot, 'Cache'))).toBe(false)
    expect(fs.existsSync(path.join(legacyRoot, 'Code Cache'))).toBe(false)
    expect(fs.existsSync(path.join(legacyRoot, 'Local Storage'))).toBe(false)
    expect(fs.existsSync(path.join(legacyRoot, 'Preferences'))).toBe(false)
    expect(fs.readFileSync(path.join(legacyRoot, 'Local Storage.previous', 'leveldb', 'LOG'), 'utf8')).toBe('old-state')
    expect(fs.readFileSync(path.join(legacyRoot, 'Preferences.previous'), 'utf8')).toBe('{"old":true}')
    expect(fs.readFileSync(path.join(paths.chromiumDir, 'Cache', 'entry.bin'), 'utf8')).toBe('new-cache')
    expect(fs.readFileSync(path.join(paths.chromiumDir, 'Preferences'), 'utf8')).toBe('{"new":true}')
    expect(report.actions.some((action) => action.kind === 'chromium-cache-clear')).toBe(true)
    expect(report.actions.some((action) => action.kind === 'chromium-backup')).toBe(true)
    expect(report.warnings.some((warning) => warning.includes('残留'))).toBe(false)
  })

  it('配置目录残留 Chromium 数据时给出体积告警', () => {
    writeFile(path.join(paths.configDir, 'Cache', 'blocks', 'data_0'), 'x'.repeat(4096))

    const report = migrateLegacyLayout({ paths, legacyRoots: [], legacyLogDirs: [] })
    const warning = report.warnings.find((item) => item.includes('残留'))

    expect(warning).toBeTruthy()
    expect(warning).toContain('Cache')
    expect(warning).toMatch(/KB|MB|GB/)
  })

  it('迁移后清空空目录与空的旧根目录', () => {
    const legacyRoot = path.join(root, 'legacy-empty')
    fs.mkdirSync(path.join(legacyRoot, 'skills'), { recursive: true })
    fs.mkdirSync(path.join(paths.configDir, 'cache'), { recursive: true })

    const report = migrateLegacyLayout({ paths, legacyRoots: [legacyRoot], legacyLogDirs: [] })

    expect(fs.existsSync(legacyRoot)).toBe(false)
    expect(fs.existsSync(path.join(paths.configDir, 'cache'))).toBe(false)
    expect(report.actions.filter((action) => action.kind === 'remove-empty').length).toBeGreaterThanOrEqual(2)
  })

  it('旧根目录与新配置目录重合时不会自搬', () => {
    const legacyRoot = paths.configDir
    writeFile(path.join(legacyRoot, 'config.json'), '{}')
    writeFile(path.join(legacyRoot, 'ntoolbox.db'), 'db')

    const report = migrateLegacyLayout({ paths, legacyRoots: [legacyRoot], legacyConfigFiles: [] })

    expect(fs.existsSync(path.join(paths.configDir, 'config.json'))).toBe(true)
    expect(fs.existsSync(path.join(legacyRoot, 'ntoolbox.db'))).toBe(false)
    expect(fs.existsSync(path.join(paths.dataDir, 'ntoolbox.db'))).toBe(true)
    expect(report.actions.some((action) => action.kind === 'config')).toBe(false)
  })

  it('目标已存在时不覆盖', () => {
    const legacyRoot = path.join(root, 'legacy-3')
    writeFile(path.join(legacyRoot, 'ntoolbox.db'), 'old')
    writeFile(path.join(paths.dataDir, 'ntoolbox.db'), 'current')

    migrateLegacyLayout({ paths, legacyRoots: [legacyRoot] })

    expect(fs.readFileSync(path.join(paths.dataDir, 'ntoolbox.db'), 'utf8')).toBe('current')
    expect(fs.existsSync(path.join(legacyRoot, 'ntoolbox.db'))).toBe(true)
  })

  it('samePath 在大小写不敏感平台忽略大小写', () => {
    expect(samePath('/tmp/App', '/tmp/app', 'linux')).toBe(false)
    expect(samePath('/tmp/App', '/tmp/app', 'win32')).toBe(true)
    expect(samePath('/tmp/app/', '/tmp/app', 'linux')).toBe(true)
  })
})
