import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import BaseProvider from '../src/main/services/ai/providers/BaseProvider.js'
import MoonshotProvider from '../src/main/services/ai/providers/MoonshotProvider.js'
import MinimaxProvider from '../src/main/services/ai/providers/MinimaxProvider.js'
import ZhipuProvider from '../src/main/services/ai/providers/ZhipuProvider.js'
import DeepSeekProvider from '../src/main/services/ai/providers/DeepSeekProvider.js'

function createProvider(baseUrl) {
  return new BaseProvider({
    apiKey: 'test-key',
    name: 'Test',
    hostname: 'api.example.com',
    path: '/v1/chat/completions',
    modelsPath: '/v1/models',
    models: [],
    defaultModel: 'test-model',
    baseUrl
  })
}

describe('BaseProvider base URL', () => {
  it('uses provider defaults when no base URL is set', () => {
    const provider = createProvider('')
    expect(provider.hostname).toBe('api.example.com')
    expect(provider.protocol).toBe('https:')
    expect(provider.port).toBe(443)
    expect(provider.path).toBe('/v1/chat/completions')
    expect(provider.modelsPath).toBe('/v1/models')
  })

  it('derives host, port and paths from a custom base URL', () => {
    const provider = createProvider('http://10.0.0.2:8080/custom/v1/')
    expect(provider.hostname).toBe('10.0.0.2')
    expect(provider.protocol).toBe('http:')
    expect(provider.port).toBe(8080)
    expect(provider.path).toBe('/custom/v1/chat/completions')
    expect(provider.modelsPath).toBe('/custom/v1/models')
  })

  it('falls back to provider defaults for invalid base URLs', () => {
    for (const baseUrl of ['not-a-url', 'ftp://api.example.com/v1']) {
      const provider = createProvider(baseUrl)
      expect(provider.hostname).toBe('api.example.com')
      expect(provider.protocol).toBe('https:')
      expect(provider.port).toBe(443)
      expect(provider.path).toBe('/v1/chat/completions')
      expect(provider.modelsPath).toBe('/v1/models')
    }
  })
})

describe('provider thinking options', () => {
  const messages = [{ role: 'user', content: 'hi' }]

  it('uses reasoning_effort and omits temperature for Kimi K3', () => {
    const provider = new MoonshotProvider('key')
    const high = provider.buildRequestBody(messages, [], {
      model: 'kimi-k3',
      thinking: true,
      temperature: 0.2
    })
    expect(high.reasoning_effort).toBe('high')
    expect(high.thinking).toBeUndefined()
    expect(high.temperature).toBeUndefined()

    const low = provider.buildRequestBody(messages, [], { model: 'kimi-k3', thinking: false })
    expect(low.reasoning_effort).toBe('low')

    const auto = provider.buildRequestBody(messages, [], { model: 'kimi-k3' })
    expect(auto.reasoning_effort).toBeUndefined()
    expect(auto.thinking).toBeUndefined()
  })

  it('uses adaptive thinking for MiniMax M3.1-Flash', () => {
    const provider = new MinimaxProvider('key')
    const low = provider.buildRequestBody(messages, [], {
      model: 'MiniMax-M3.1-Flash',
      thinking: false
    })
    expect(low.thinking).toEqual({ type: 'adaptive' })
    expect(low.reasoning_effort).toBe('low')
    expect(low.reasoning_split).toBe(true)

    const auto = provider.buildRequestBody(messages, [], { model: 'MiniMax-M3.1-Flash' })
    expect(auto.thinking).toBeUndefined()
    expect(auto.reasoning_split).toBe(true)
  })

  it('disables thinking for MiniMax M3 and leaves legacy models untouched', () => {
    const provider = new MinimaxProvider('key')
    const body = provider.buildRequestBody(messages, [], { model: 'MiniMax-M3', thinking: false })
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.reasoning_split).toBe(true)

    const legacy = provider.buildRequestBody(messages, [], { model: 'MiniMax-M2.5', thinking: false })
    expect(legacy.thinking).toBeUndefined()
    expect(legacy.reasoning_split).toBeUndefined()
  })

  it('keeps GLM-5.3 thinking enabled and maps effort', () => {
    const provider = new ZhipuProvider('key')
    const low = provider.buildRequestBody(messages, [], { model: 'glm-5.3', thinking: false })
    expect(low.thinking).toEqual({ type: 'enabled' })
    expect(low.reasoning_effort).toBe('low')

    const high = provider.buildRequestBody(messages, [], { model: 'glm-5.3', thinking: true })
    expect(high.thinking).toEqual({ type: 'enabled' })
    expect(high.reasoning_effort).toBe('high')
  })

  it('allows disabling thinking for GLM-5.2 and DeepSeek', () => {
    const zhipu = new ZhipuProvider('key')
    expect(zhipu.buildRequestBody(messages, [], { model: 'glm-5.2', thinking: false }).thinking).toEqual({
      type: 'disabled'
    })

    const deepseek = new DeepSeekProvider('key')
    expect(deepseek.buildRequestBody(messages, [], { model: 'deepseek-flash', thinking: false }).thinking).toEqual({
      type: 'disabled'
    })
  })

  it('publishes documented per-model context windows', () => {
    const windows = Object.fromEntries(
      new MoonshotProvider('key').getModels().map((model) => [model.id, model.contextWindow])
    )
    expect(windows['kimi-k3.1-pro']).toBe(1000000)

    const minimax = new MinimaxProvider('key').getModels()
    expect(minimax.find((model) => model.id === 'MiniMax-M3.1-Flash').contextWindow).toBe(1000000)
    expect(minimax.find((model) => model.id === 'MiniMax-M3').contextWindow).toBe(1000000)

    const zhipu = new ZhipuProvider('key').getModels()
    expect(zhipu.find((model) => model.id === 'glm-5.3').contextWindow).toBe(1000000)
    expect(zhipu.find((model) => model.id === 'glm-4.7').contextWindow).toBe(204800)
  })
})
