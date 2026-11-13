import { EventEmitter } from 'events'
import { describe, it, expect, vi } from 'vitest'
import BaseProvider from '../src/main/services/ai/providers/BaseProvider.js'

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
            let index = 0
            const pump = () => {
              if (index >= entry.chunks.length) {
                res.emit('end')
                return
              }
              res.emit('data', entry.chunks[index])
              index += 1
              setImmediate(pump)
            }
            pump()
          })
        }
        return req
      }
    }
  }
})

function splitOnMultibyteBoundaries(text) {
  const buffer = Buffer.from(text, 'utf8')
  const chunks = []
  let start = 0
  for (let i = 1; i < buffer.length; i += 1) {
    if ((buffer[i] & 0xc0) === 0x80 && i - start >= 4) {
      chunks.push(buffer.subarray(start, i))
      start = i
    }
  }
  chunks.push(buffer.subarray(start))
  return chunks
}

function enqueue(text, statusCode = 200) {
  state.responses.push({ chunks: splitOnMultibyteBoundaries(text), statusCode })
}

function createProvider(overrides = {}) {
  return new BaseProvider({
    name: '测试平台',
    apiKey: 'test-key',
    hostname: 'example.com',
    path: '/v1/chat/completions',
    defaultModel: 'test-model',
    modelsPath: '/v1/models',
    ...overrides
  })
}

describe('UTF-8 streaming decode', () => {
  it('keeps Chinese text intact when chunks split multibyte characters', async () => {
    const content = '你好，世界！流式中文不应出现乱码。'
    const thinking = '这是思考过程，也不能乱码。'
    enqueue(
      `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: thinking, content } }] })}\n\ndata: [DONE]\n\n`
    )

    const events = []
    const result = await createProvider().chatStream([{ role: 'user', content: 'hi' }], [], {}, (event) =>
      events.push(event)
    )

    expect(result.success).toBe(true)
    expect(result.content).toBe(content)
    expect(result.thinking).toBe(thinking)
    expect(result.content).not.toContain('\uFFFD')
    expect(result.thinking).not.toContain('\uFFFD')
    expect(events.map((event) => event.text).join('')).toContain('你好，世界')
  })

  it('keeps non-streaming responses intact when chunks split multibyte characters', async () => {
    const content = '非流式回复同样不能乱码。'
    enqueue(JSON.stringify({ choices: [{ message: { content } }] }))

    const result = await createProvider().chat([{ role: 'user', content: 'hi' }], [], {})

    expect(result.success).toBe(true)
    expect(result.content).toBe(content)
    expect(result.content).not.toContain('\uFFFD')
  })

  it('keeps remote model names intact when chunks split multibyte characters', async () => {
    enqueue(JSON.stringify({ data: [{ id: 'qwen3-max', name: '通义千问旗舰模型' }] }))

    const result = await createProvider().listRemoteModels()

    expect(result.success).toBe(true)
    expect(result.models).toEqual([{ id: 'qwen3-max', name: '通义千问旗舰模型' }])
    expect(JSON.stringify(result.models)).not.toContain('\uFFFD')
  })
})
