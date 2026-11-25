import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchMcpRegistryServers, normalizeRegistryServer } from '../src/main/services/extensions/mcpRegistry.js'

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  }
}

function serverEntry(name, overrides = {}) {
  return {
    server: {
      name,
      title: overrides.title || '',
      description: overrides.description || 'A test server',
      version: overrides.version || '1.0.0',
      repository: overrides.repository || { url: `https://github.com/test/${name}` },
      packages: overrides.packages ?? [
        {
          registryType: 'npm',
          identifier: `@test/${name}`,
          version: '1.0.0',
          transport: { type: 'stdio' }
        }
      ]
    },
    _meta: {}
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mcp registry client', () => {
  it('normalizes npm stdio packages into npx commands', () => {
    const item = serverEntry('files', {
      title: 'Filesystem',
      description: 'File access server',
      version: 'v2.3.0'
    })

    const result = normalizeRegistryServer(item)

    expect(result).toMatchObject({
      key: 'files',
      name: 'Filesystem',
      version: '2.3.0',
      command: 'npx -y @test/files',
      runtime: 'npx · Node',
      packageType: 'npm',
      category: 'file',
      tags: ['npm'],
      source: 'mcp-registry',
      remote: true,
      sourceUrl: 'https://github.com/test/files'
    })
  })

  it('normalizes pypi packages into uvx commands', () => {
    const item = serverEntry('git', {
      packages: [
        {
          registryType: 'pypi',
          identifier: 'mcp-server-git',
          version: '1.0.0',
          transport: { type: 'stdio' }
        }
      ]
    })

    const result = normalizeRegistryServer(item)

    expect(result).toMatchObject({
      command: 'uvx mcp-server-git',
      runtime: 'uvx · Python',
      packageType: 'pypi',
      tags: ['PyPI'],
      category: 'dev'
    })
  })

  it('rejects entries without local packages or with non-stdio transports', () => {
    expect(normalizeRegistryServer(serverEntry('remote-only', { packages: [] }))).toBeNull()
    expect(normalizeRegistryServer({ server: { name: 'x' } })).toBeNull()
    expect(
      normalizeRegistryServer(
        serverEntry('oci', {
          packages: [{ registryType: 'oci', identifier: 'img', transport: { type: 'stdio' } }]
        })
      )
    ).toBeNull()
    expect(
      normalizeRegistryServer(
        serverEntry('http', {
          packages: [{ registryType: 'npm', identifier: '@x/y', transport: { type: 'streamable-http' } }]
        })
      )
    ).toBeNull()
  })

  it('falls back to the name tail when no title exists', () => {
    const result = normalizeRegistryServer(serverEntry('io.github.user/memory-mcp', { title: '' }))

    expect(result.name).toBe('memory-mcp')
    expect(result.category).toBe('knowledge')
  })

  it('fetches pages with cursor until maxPages and dedupes by name', async () => {
    const fetchMock = vi.fn(async (url) => {
      if (String(url).includes('cursor=page2')) {
        return jsonResponse({
          servers: [serverEntry('dupe'), serverEntry('second')],
          metadata: { nextCursor: '' }
        })
      }
      return jsonResponse({
        servers: [serverEntry('first'), serverEntry('dupe')],
        metadata: { nextCursor: 'page2' }
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { servers, remote } = await fetchMcpRegistryServers({ maxPages: 2 })

    expect(remote).toEqual({ ok: true })
    expect(servers.map((server) => server.key)).toEqual(['first', 'dupe', 'second'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toContain('version=latest')
    expect(String(fetchMock.mock.calls[0][0])).toContain('limit=100')
    expect(String(fetchMock.mock.calls[1][0])).toContain('cursor=page2')
  })

  it('passes search to the registry query', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ servers: [serverEntry('git-tools')], metadata: { nextCursor: '' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    await fetchMcpRegistryServers({ search: 'git' })

    expect(String(fetchMock.mock.calls[0][0])).toContain('search=git')
  })

  it('returns a remote failure payload instead of throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({}, 500))
    )

    const { servers, remote } = await fetchMcpRegistryServers()

    expect(servers).toEqual([])
    expect(remote.ok).toBe(false)
    expect(remote.error).toContain('HTTP 500')
  })

  it('reports timeouts as connection failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
    )

    const { remote } = await fetchMcpRegistryServers()

    expect(remote.ok).toBe(false)
    expect(remote.error).toContain('超时')
  })
})
