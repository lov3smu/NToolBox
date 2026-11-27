import os from 'os'
import path from 'path'
import zlib from 'zlib'
import { fileURLToPath } from 'url'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

vi.mock('../src/main/services/extensions/skills.js', () => ({
  initSkills: vi.fn(),
  installSkill: vi.fn()
}))

import {
  DEFAULT_REGISTRY,
  MIRROR_REGISTRY,
  extractTarGz,
  findPluginRoot,
  normalizeRegistry,
  parsePluginSource,
  sanitizeArchivePath
} from '../src/main/services/extensions/pluginInstaller.js'

function octal(value, length) {
  return `${value.toString(8).padStart(length - 1, '0')}\0`
}

function tarHeader(name, size, type = '0') {
  const header = Buffer.alloc(512, 0)
  header.write(name, 0, 100, 'utf8')
  header.write(octal(0o644, 8), 100)
  header.write(octal(0, 8), 108)
  header.write(octal(0, 8), 116)
  header.write(octal(size, 12), 124)
  header.write(octal(0, 12), 136)
  header.write('        ', 148)
  header.write(type, 156)
  header.write('ustar\0', 257)
  header.write('00', 263)
  let checksum = 0
  for (const byte of header) checksum += byte
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148)
  return header
}

function buildTarGz(files) {
  const blocks = []
  for (const [name, content] of Object.entries(files)) {
    if (content === null) {
      blocks.push(tarHeader(name, 0, '5'))
      continue
    }
    const data = Buffer.from(content)
    blocks.push(tarHeader(name, data.length), data, Buffer.alloc((512 - (data.length % 512)) % 512))
  }
  blocks.push(Buffer.alloc(1024))
  return zlib.gzipSync(Buffer.concat(blocks))
}

describe('parsePluginSource', () => {
  it('parses npm package names with and without versions', () => {
    expect(parsePluginSource('plugin-name')).toEqual({ kind: 'npm', name: 'plugin-name', version: '' })
    expect(parsePluginSource('plugin-name@1.2.3')).toEqual({ kind: 'npm', name: 'plugin-name', version: '1.2.3' })
    expect(parsePluginSource('@scope/plugin')).toEqual({ kind: 'npm', name: '@scope/plugin', version: '' })
    expect(parsePluginSource('@scope/plugin@latest')).toEqual({
      kind: 'npm',
      name: '@scope/plugin',
      version: 'latest'
    })
  })

  it('parses GitHub repository URLs', () => {
    expect(parsePluginSource('https://github.com/owner/repo')).toEqual({
      kind: 'github',
      owner: 'owner',
      repo: 'repo'
    })
    expect(parsePluginSource('https://www.github.com/owner/repo.git/')).toEqual({
      kind: 'github',
      owner: 'owner',
      repo: 'repo'
    })
  })

  it('rejects unsupported URLs and GitHub sub-paths', () => {
    expect(() => parsePluginSource('https://gitlab.com/owner/repo')).toThrow('仅支持 GitHub')
    expect(() => parsePluginSource('https://github.com/owner')).toThrow('GitHub 地址格式无效')
    expect(() => parsePluginSource('https://github.com/owner/repo/tree/main')).toThrow('不要包含子目录')
  })

  it('parses local and home-relative directories', () => {
    expect(parsePluginSource('/opt/plugins/my-skill')).toEqual({ kind: 'local', path: '/opt/plugins/my-skill' })
    expect(parsePluginSource('~/plugins/my-skill')).toEqual({
      kind: 'local',
      path: path.join(os.homedir(), 'plugins/my-skill')
    })
    expect(parsePluginSource('file:///opt/plugins/my-skill')).toEqual({
      kind: 'local',
      path: fileURLToPath('file:///opt/plugins/my-skill')
    })
  })

  it('rejects unknown input', () => {
    expect(() => parsePluginSource('')).toThrow('请输入插件包名')
    expect(() => parsePluginSource('Plugin Name')).toThrow('无法识别插件来源')
  })
})

describe('normalizeRegistry', () => {
  it('falls back to the default registry and trims trailing slashes', () => {
    expect(normalizeRegistry()).toBe(DEFAULT_REGISTRY)
    expect(normalizeRegistry('')).toBe(DEFAULT_REGISTRY)
    expect(normalizeRegistry('https://registry.npmmirror.com/')).toBe(MIRROR_REGISTRY)
    expect(normalizeRegistry('https://npm.example.com/private/')).toBe('https://npm.example.com/private')
  })

  it('rejects non-http registries', () => {
    expect(() => normalizeRegistry('ftp://registry.example.com')).toThrow('http:// 或 https://')
    expect(() => normalizeRegistry('not a url')).toThrow('安装源地址格式无效')
  })
})

describe('extractTarGz', () => {
  it('extracts regular files and skips directory entries', () => {
    const archive = buildTarGz({
      'package/': null,
      'package/skill.json': '{"name":"demo"}',
      'package/handler.js': 'export default 1'
    })
    const entries = extractTarGz(archive)
    expect(entries.map((entry) => entry.path)).toEqual(['package/skill.json', 'package/handler.js'])
    expect(entries[0].data.toString('utf8')).toBe('{"name":"demo"}')
  })

  it('drops path traversal entries', () => {
    expect(sanitizeArchivePath('../evil.js')).toBe('')
    expect(sanitizeArchivePath('/etc/passwd')).toBe('')
    expect(sanitizeArchivePath('C:\\Windows\\evil.js')).toBe('')
    expect(sanitizeArchivePath('./package/./skill.json')).toBe('package/skill.json')
  })

  it('reports invalid archives', () => {
    expect(() => extractTarGz(Buffer.from('not a gzip'))).toThrow('插件压缩包解压失败')
  })
})

describe('findPluginRoot', () => {
  it('prefers the shallowest skill.json', () => {
    const entries = [
      { path: 'repo-hash/README.md' },
      { path: 'repo-hash/plugins/demo/skill.json' },
      { path: 'repo-hash/skill.json' }
    ]
    expect(findPluginRoot(entries)).toBe('repo-hash')
    expect(findPluginRoot([{ path: 'skill.json' }])).toBe('')
  })

  it('rejects ambiguous packages', () => {
    expect(() =>
      findPluginRoot([{ path: 'repo/plugins/a/skill.json' }, { path: 'repo/plugins/b/skill.json' }])
    ).toThrow('多个 skill.json')
    expect(() => findPluginRoot([{ path: 'repo/README.md' }])).toThrow('未找到 skill.json')
  })
})
