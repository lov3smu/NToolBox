import { createServer } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  IMAGE_HOST_PROVIDERS,
  createDefaultImageHostSettings,
  formatImageLink,
  getMissingRequiredFields,
  normalizeImageHostConfig,
  normalizeImageHostSettings
} from '../src/shared/imageHosts.js'
import { buildObjectKey, buildRemoteFilename, resolveJsonPath } from '../src/main/services/imageHost/utils.js'
import { testProvider, uploadToProvider } from '../src/main/services/imageHost/providers.js'
import { validateConfig } from '../src/main/services/configValidation.js'

const servers = []

async function startServer(requestHandler) {
  const server = createServer(requestHandler)
  servers.push(server)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return { server, base: `http://127.0.0.1:${server.address().port}` }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(chunk))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.closeAllConnections?.()
          server.close(resolve)
        })
    )
  )
})

describe('image host settings', () => {
  it('creates defaults for every provider', () => {
    const settings = createDefaultImageHostSettings()
    expect(settings.active).toBe('github')
    expect(settings.rename).toBe(true)
    expect(settings.historyLimit).toBe(100)
    expect(settings.maxFileMb).toBe(30)
    expect(Object.keys(settings.providers)).toEqual(IMAGE_HOST_PROVIDERS.map((provider) => provider.id))
    expect(settings.providers.github.branch).toBe('main')
    expect(settings.providers.s3.forcePathStyle).toBe(true)
  })

  it('clamps history limit and max file size', () => {
    const normalized = normalizeImageHostSettings({ historyLimit: 9, maxFileMb: 999 })
    expect(normalized.historyLimit).toBe(10)
    expect(normalized.maxFileMb).toBe(200)

    const custom = normalizeImageHostSettings({ historyLimit: 200, maxFileMb: 10 })
    expect(custom.historyLimit).toBe(200)
    expect(custom.maxFileMb).toBe(10)
  })

  it('normalizes unknown and partial settings', () => {
    const normalized = normalizeImageHostSettings({
      active: 'unknown',
      linkFormat: 'bbcode',
      rename: false,
      providers: {
        github: { token: '  token  ', repo: 123, path: '/images/2026/' },
        custom: { field: ' upload ' }
      }
    })

    expect(normalized.active).toBe('github')
    expect(normalized.linkFormat).toBe('url')
    expect(normalized.rename).toBe(false)
    expect(normalized.providers.github.token).toBe('token')
    expect(normalized.providers.github.repo).toBe('')
    expect(normalized.providers.github.path).toBe('/images/2026/')
    expect(normalized.providers.custom.field).toBe('upload')
    expect(normalized.providers.gitee.branch).toBe('master')
  })

  it('normalizes history records and keeps the newest 100', () => {
    const records = Array.from({ length: 120 }, (_, index) => ({
      id: `id-${index}`,
      name: `image-${index}.png`,
      url: `https://cdn.example.com/${index}.png`,
      provider: index === 0 ? 'unknown' : 'github',
      providerName: 'GitHub',
      size: 12,
      uploadedAt: index
    }))
    records.push({ url: 'not-a-url' })
    records.push({ ...records[1] })

    const config = normalizeImageHostConfig({ history: records })
    expect(config.history).toHaveLength(100)
    expect(config.history[0].id).toBe('id-0')
    expect(config.history[0].provider).toBe('')
    expect(config.history[1].id).toBe('id-1')
    expect(config.history.some((item) => item.url === 'not-a-url')).toBe(false)
  })

  it('reports missing required fields', () => {
    const settings = createDefaultImageHostSettings()
    expect(getMissingRequiredFields('github', settings.providers.github).map((field) => field.key)).toEqual([
      'token',
      'repo'
    ])
    expect(getMissingRequiredFields('custom', settings.providers.custom).map((field) => field.key)).toEqual(['url'])
    expect(getMissingRequiredFields('webdav', settings.providers.webdav).map((field) => field.key)).toEqual(['url'])
  })

  it('validates image_hosting config shape', () => {
    const baseConfig = {
      app: {
        auto_start: true,
        shortcuts: {}
      },
      appearance: {},
      update: { auto_update: true },
      network: {},
      database: {},
      sql_generator: {
        base_path: '/tmp/scripts',
        developer: { ch_name: '张三', en_name: 'zhangsan' },
        databases: [],
        script_types: []
      },
      ai: { keys: {} },
      extensions: {},
      notifications: {},
      clipboard_history: {}
    }
    expect(validateConfig({ ...baseConfig, image_hosting: {} })).toBeNull()
    expect(validateConfig({ ...baseConfig, image_hosting: [] })).toBe('image_hosting 必须是对象')
  })
})

describe('image host helpers', () => {
  it('formats links for each copy mode', () => {
    const url = 'https://cdn.example.com/a.png'
    expect(formatImageLink(url, 'url')).toBe(url)
    expect(formatImageLink(url, 'markdown', '我的 [图]')).toBe('![我的 图](https://cdn.example.com/a.png)')
    expect(formatImageLink(url, 'html', 'a"b')).toBe('<img src="https://cdn.example.com/a.png" alt="a&quot;b" />')
  })

  it('builds safe remote file names and object keys', () => {
    const now = new Date(2026, 0, 2, 3, 4, 5)
    expect(buildRemoteFilename('/tmp/a b?.png', { rename: true, now, unique: 'abcd' })).toBe(
      'a-b-20260102030405-abcd.png'
    )
    expect(buildRemoteFilename('/tmp/photo.jpg', { rename: false })).toBe('photo.jpg')
    expect(buildRemoteFilename('/tmp/..', { rename: false })).toBe('image')

    const key = buildObjectKey('/tmp/a b?.png', { path: 'images/2026', rename: true })
    expect(key).toMatch(/^images\/2026\/a-b-\d{14}-[0-9a-f]{4}\.png$/)
  })

  it('resolves JSON paths including array indexes', () => {
    const data = { data: { images: [{ url: 'https://a/1.png' }] } }
    expect(resolveJsonPath(data, 'data.images[0].url')).toBe('https://a/1.png')
    expect(resolveJsonPath(data, '$.data.images[0].url')).toBe('https://a/1.png')
    expect(resolveJsonPath(data, 'data.missing')).toBeUndefined()
  })
})

describe('custom provider upload', () => {
  it('uploads multipart data and resolves the configured JSON path', async () => {
    let receivedBody = Buffer.alloc(0)
    let receivedType = ''
    const { base } = await startServer(async (request, response) => {
      receivedType = request.headers['content-type'] || ''
      receivedBody = await readRequestBody(request)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ data: { url: '/files/photo.png' } }))
    })

    const result = await uploadToProvider({
      providerId: 'custom',
      settings: {
        url: `${base}/upload`,
        field: 'file',
        headers: '',
        responsePath: 'data.url',
        urlPrefix: base,
        path: '',
        rename: false
      },
      file: {
        filePath: 'photo.png',
        name: 'photo.png',
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mime: 'image/png',
        size: 4
      }
    })

    expect(result.url).toBe(`${base}/files/photo.png`)
    expect(receivedType.startsWith('multipart/form-data; boundary=')).toBe(true)
    expect(receivedBody.includes(Buffer.from('filename="photo.png"'))).toBe(true)
    expect(receivedBody.includes(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBe(true)
  })

  it('supports plain text responses and reports upload errors', async () => {
    const { base } = await startServer((request, response) => {
      if (request.url === '/plain') {
        response.writeHead(200, { 'Content-Type': 'text/plain' })
        response.end('https://cdn.example.com/plain.png')
        return
      }
      request.resume()
      request.on('end', () => {
        response.writeHead(400, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ message: 'token expired' }))
      })
    })

    const file = {
      filePath: 'photo.png',
      name: 'photo.png',
      buffer: Buffer.from('image'),
      mime: 'image/png',
      size: 5
    }

    const plain = await uploadToProvider({
      providerId: 'custom',
      settings: {
        url: `${base}/plain`,
        field: 'file',
        headers: '',
        responsePath: '',
        urlPrefix: '',
        path: '',
        rename: false
      },
      file
    })
    expect(plain.url).toBe('https://cdn.example.com/plain.png')

    await expect(
      uploadToProvider({
        providerId: 'custom',
        settings: {
          url: `${base}/fail`,
          field: 'file',
          headers: '',
          responsePath: 'data.url',
          urlPrefix: '',
          path: '',
          rename: false
        },
        file
      })
    ).rejects.toThrow('token expired')

    await expect(
      testProvider({
        providerId: 'custom',
        settings: { url: `${base}/upload`, field: 'file', headers: '{bad', responsePath: 'data.url', urlPrefix: '' }
      })
    ).rejects.toThrow('请求头必须是有效的 JSON')
  })
})

describe('webdav provider upload', () => {
  it('sends basic auth and builds the public URL from the response path', async () => {
    let requestPath = ''
    let authorization = ''
    const { base } = await startServer((request, response) => {
      requestPath = request.url
      authorization = request.headers.authorization || ''
      request.resume()
      request.on('end', () => {
        response.writeHead(201)
        response.end()
      })
    })

    const result = await uploadToProvider({
      providerId: 'webdav',
      settings: {
        url: `${base}/dav`,
        username: 'user',
        password: 'pass',
        path: 'images',
        publicUrl: `${base}/public`,
        rename: false
      },
      file: {
        filePath: 'photo.png',
        name: 'photo.png',
        buffer: Buffer.from('image'),
        mime: 'image/png',
        size: 5
      }
    })

    expect(requestPath).toBe('/dav/images/photo.png')
    expect(authorization).toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`)
    expect(result.url).toBe(`${base}/public/images/photo.png`)
  })
})
