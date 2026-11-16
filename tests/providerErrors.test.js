import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ responses: [] }))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('https', async (importOriginal) => {
  const actual = await importOriginal()
  const base = actual.default || actual
  return {
    ...actual,
    default: {
      ...base,
      request: (_options, onResponse) => {
        const entry = state.responses.shift()
        const req = new EventEmitter()
        const res = new EventEmitter()
        res.statusCode = entry.statusCode ?? 200

        req.write = vi.fn()
        req.destroy = vi.fn()
        req.end = () => {
          setImmediate(() => {
            onResponse(res)
            for (const chunk of entry.chunks) res.emit('data', chunk)
            res.emit('end')
          })
        }
        return req
      }
    }
  }
})

import BaseProvider from '../src/main/services/ai/providers/BaseProvider.js'

function enqueue(body, statusCode) {
  state.responses.push({ statusCode, chunks: [Buffer.from(body, 'utf8')] })
}

function createProvider() {
  return new BaseProvider({
    name: '测试平台',
    apiKey: 'bad-key',
    hostname: 'example.com',
    path: '/v1/chat/completions',
    modelsPath: '/v1/models',
    defaultModel: 'test-model'
  })
}

const messages = [{ role: 'user', content: 'hi' }]

describe('provider error messages', () => {
  it('captures the JSON error body from a non-200 stream response', async () => {
    enqueue(JSON.stringify({ error: { message: 'Invalid credential' } }), 401)

    const result = await createProvider().chatStream(messages, [], { model: 'test-model' })

    expect(result.success).toBe(false)
    expect(result.status).toBe(401)
    expect(result.error).toBe('Invalid credential')
  })

  it('falls back to the raw body when a stream error is not JSON', async () => {
    enqueue('<html><body>upstream unavailable</body></html>', 400)

    const result = await createProvider().chatStream(messages, [], { model: 'test-model' })

    expect(result.success).toBe(false)
    expect(result.status).toBe(400)
    expect(result.error).toContain('upstream unavailable')
  })

  it('returns structured validation results for rejected keys', async () => {
    enqueue(JSON.stringify({ error: { message: 'Invalid API key' } }), 401)

    await expect(createProvider().validateApiKey()).resolves.toEqual({
      valid: false,
      status: 401,
      error: 'Invalid API key'
    })
  })

  it('returns a structured success result', async () => {
    enqueue(JSON.stringify({ data: [{ id: 'test-model' }] }), 200)

    await expect(createProvider().validateApiKey()).resolves.toEqual({
      valid: true,
      status: 200,
      error: ''
    })
  })
})
