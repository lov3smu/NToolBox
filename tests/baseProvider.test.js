import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import BaseProvider from '../src/main/services/ai/providers/BaseProvider.js'
import MoonshotProvider from '../src/main/services/ai/providers/MoonshotProvider.js'
import MinimaxProvider from '../src/main/services/ai/providers/MinimaxProvider.js'
import ZhipuProvider from '../src/main/services/ai/providers/ZhipuProvider.js'
import DeepSeekProvider from '../src/main/services/ai/providers/DeepSeekProvider.js'
import MimoProvider from '../src/main/services/ai/providers/MimoProvider.js'
import OpencodeProvider from '../src/main/services/ai/providers/OpencodeProvider.js'
import OpencodeGoProvider from '../src/main/services/ai/providers/OpencodeGoProvider.js'
import OpenAIProvider from '../src/main/services/ai/providers/OpenAIProvider.js'
import GoogleProvider from '../src/main/services/ai/providers/GoogleProvider.js'
import AnthropicProvider from '../src/main/services/ai/providers/AnthropicProvider.js'

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
    const provider = new MoonshotProvider({ apiKey: 'key' })
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
    const provider = new MinimaxProvider({ apiKey: 'key' })
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
    const provider = new MinimaxProvider({ apiKey: 'key' })
    const body = provider.buildRequestBody(messages, [], { model: 'MiniMax-M3', thinking: false })
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.reasoning_split).toBe(true)

    const legacy = provider.buildRequestBody(messages, [], { model: 'MiniMax-M2.5', thinking: false })
    expect(legacy.thinking).toBeUndefined()
    expect(legacy.reasoning_split).toBeUndefined()
  })

  it('keeps GLM-5.3 thinking enabled and maps effort', () => {
    const provider = new ZhipuProvider({ apiKey: 'key' })
    const low = provider.buildRequestBody(messages, [], { model: 'glm-5.3', thinking: false })
    expect(low.thinking).toEqual({ type: 'enabled' })
    expect(low.reasoning_effort).toBe('low')

    const high = provider.buildRequestBody(messages, [], { model: 'glm-5.3', thinking: true })
    expect(high.thinking).toEqual({ type: 'enabled' })
    expect(high.reasoning_effort).toBe('high')
  })

  it('allows disabling thinking for GLM-5.2 and DeepSeek', () => {
    const zhipu = new ZhipuProvider({ apiKey: 'key' })
    expect(zhipu.buildRequestBody(messages, [], { model: 'glm-5.2', thinking: false }).thinking).toEqual({
      type: 'disabled'
    })

    const deepseek = new DeepSeekProvider({ apiKey: 'key' })
    expect(deepseek.buildRequestBody(messages, [], { model: 'deepseek-flash', thinking: false }).thinking).toEqual({
      type: 'disabled'
    })
  })

  it('maps Xiaomi MiMo thinking and omits temperature', () => {
    const provider = new MimoProvider({ apiKey: 'key' })
    const off = provider.buildRequestBody(messages, [], {
      model: 'mimo-v2.6-pro',
      thinking: false,
      temperature: 0.2
    })
    expect(off.thinking).toEqual({ type: 'disabled' })
    expect(off.temperature).toBeUndefined()

    const on = provider.buildRequestBody(messages, [], { model: 'mimo-v2.6-pro', thinking: true })
    expect(on.thinking).toEqual({ type: 'enabled' })
  })

  it('registers OpenCode Zen and Go endpoints', () => {
    const zen = new OpencodeProvider({ apiKey: 'key' })
    expect(zen.hostname).toBe('opencode.ai')
    expect(zen.path).toBe('/inference/openai/v1/chat/completions')
    expect(zen.modelsPath).toBe('/inference/openai/v1/models')
    expect(zen.validateWithChat).toBe(true)

    const go = new OpencodeGoProvider({ apiKey: 'key' })
    expect(go.hostname).toBe('opencode.ai')
    expect(go.path).toBe('/inference/go/openai/v1/chat/completions')
    expect(go.modelsPath).toBe('/inference/go/openai/v1/models')
    expect(go.getHeaders()['x-opencode-session']).toMatch(/^ses_[0-9a-f]{32}$/)
    expect(go.getHeaders()['x-opencode-session']).toBe(go.getHeaders()['x-opencode-session'])
    expect(go.getHeaders({}, 'key', { conversationId: 'conv-1' })['x-opencode-session']).toBe('ses_conv1')
    expect(go.buildRequestBody(messages, [], { model: 'glm-5.3', thinking: true }).thinking).toBeUndefined()
  })

  it('registers OpenAI, Google and Anthropic compatible endpoints', () => {
    const openai = new OpenAIProvider({ apiKey: 'key' })
    expect(openai.hostname).toBe('api.openai.com')
    expect(openai.path).toBe('/v1/chat/completions')
    expect(openai.getHeaders().Authorization).toBe('Bearer key')

    const google = new GoogleProvider({ apiKey: 'key' })
    expect(google.hostname).toBe('generativelanguage.googleapis.com')
    expect(google.path).toBe('/v1beta/openai/chat/completions')
    expect(google.modelsPath).toBe('/v1beta/openai/models')

    const anthropic = new AnthropicProvider({ apiKey: 'key' })
    expect(anthropic.hostname).toBe('api.anthropic.com')
    expect(anthropic.path).toBe('/v1/chat/completions')
    expect(anthropic.getHeaders()).toMatchObject({
      Authorization: 'Bearer key',
      'x-api-key': 'key',
      'anthropic-version': '2023-06-01'
    })
  })

  it('forces non-reasoning mode only when GPT-6 is used with tools', () => {
    const provider = new OpenAIProvider({ apiKey: 'key' })
    const tool = { type: 'function', function: { name: 'ping', parameters: { type: 'object' } } }
    const withTools = provider.buildRequestBody(messages, [tool], { model: 'gpt-6-sol', temperature: 0.2 })
    expect(withTools.reasoning_effort).toBe('none')
    expect(withTools.temperature).toBeUndefined()
    expect(withTools.max_completion_tokens).toBe(128000)
    expect(withTools.max_tokens).toBeUndefined()

    const plain = provider.buildRequestBody(messages, [], { model: 'gpt-6-sol' })
    expect(plain.reasoning_effort).toBeUndefined()

    const luna = provider.buildRequestBody(messages, [tool], { model: 'gpt-6-luna' })
    expect(luna.reasoning_effort).toBe('none')
  })

  it('omits temperature for Claude models', () => {
    const provider = new AnthropicProvider({ apiKey: 'key' })
    const body = provider.buildRequestBody(messages, [], { model: 'claude-sonnet-5-5', temperature: 0.3 })
    expect(body.temperature).toBeUndefined()
    expect(body.max_tokens).toBe(128000)
  })

  it('publishes documented per-model context windows', () => {
    const windows = Object.fromEntries(
      new MoonshotProvider({ apiKey: 'key' }).getModels().map((model) => [model.id, model.contextWindow])
    )
    expect(windows['kimi-k3.1-pro']).toBe(1000000)

    const minimax = new MinimaxProvider({ apiKey: 'key' }).getModels()
    expect(minimax.find((model) => model.id === 'MiniMax-M3.1-Flash').contextWindow).toBe(1000000)
    expect(minimax.find((model) => model.id === 'MiniMax-M3').contextWindow).toBe(1000000)

    const zhipu = new ZhipuProvider({ apiKey: 'key' }).getModels()
    expect(zhipu.find((model) => model.id === 'glm-5.3').contextWindow).toBe(1000000)
    expect(zhipu.find((model) => model.id === 'glm-4.7').contextWindow).toBe(204800)
  })
})
