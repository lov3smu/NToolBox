import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { getAvailableProviders, createProvider, PROVIDER_TYPES } from '../src/main/services/ai/index.js'

describe('AI provider catalog', () => {
  const providers = Object.fromEntries(getAvailableProviders().map((provider) => [provider.type, provider]))

  it('registers Xiaomi MiMo, OpenCode and OpenCode Go', () => {
    expect(Object.keys(providers)).toEqual(expect.arrayContaining(['mimo', 'opencode', 'opencode_go']))
    expect(providers.mimo.name).toBe('小米 MiMo')
    expect(providers.mimo.defaultBaseUrl).toBe('https://api.xiaomimimo.com/v1')
    expect(providers.opencode.defaultBaseUrl).toBe('https://opencode.ai/inference/openai/v1')
    expect(providers.opencode_go.defaultBaseUrl).toBe('https://opencode.ai/inference/go/openai/v1')
    expect(PROVIDER_TYPES.OPENCODE_GO).toBe('opencode_go')
  })

  it('registers OpenAI, Google and Anthropic', () => {
    expect(Object.keys(providers)).toEqual(expect.arrayContaining(['openai', 'google', 'anthropic']))
    expect(providers.openai.name).toBe('OpenAI')
    expect(providers.openai.defaultBaseUrl).toBe('https://api.openai.com/v1')
    expect(providers.openai.envKey).toBe('OPENAI_API_KEY')
    expect(providers.openai.defaultModel).toBe('gpt-6-sol')
    expect(providers.google.defaultBaseUrl).toBe('https://generativelanguage.googleapis.com/v1beta/openai')
    expect(providers.google.envKey).toBe('GEMINI_API_KEY')
    expect(providers.anthropic.defaultBaseUrl).toBe('https://api.anthropic.com/v1')
    expect(providers.anthropic.envKey).toBe('ANTHROPIC_API_KEY')
    expect(PROVIDER_TYPES.ANTHROPIC).toBe('anthropic')
  })

  it('advertises image input and context for the new providers', () => {
    for (const type of ['openai', 'google', 'anthropic']) {
      expect(providers[type].models.length).toBeGreaterThan(0)
      expect(providers[type].models.every((model) => model.contextWindow > 0)).toBe(true)
      expect(providers[type].models.every((model) => model.inputTypes.includes('image'))).toBe(true)
    }
  })

  it('exposes thinking flags and context windows for the new providers', () => {
    const mimo = providers.mimo.models.find((model) => model.id === 'mimo-v2.6-pro')
    expect(mimo.thinking).toBe(true)
    expect(mimo.contextWindow).toBe(1048576)

    const zen = providers.opencode.models.find((model) => model.id === 'kimi-k3')
    expect(zen.contextWindow).toBe(1048576)
    expect(zen.inputTypes).toEqual(['text', 'image'])
    expect(providers.opencode.models.every((model) => model.contextWindow > 0)).toBe(true)
    expect(providers.opencode_go.models.find((model) => model.id === 'glm-5.3').thinking).toBe(false)
  })

  it('registers local Ollama and LM Studio providers without API keys', () => {
    expect(Object.keys(providers)).toEqual(expect.arrayContaining(['ollama', 'lmstudio']))
    expect(providers.ollama.defaultBaseUrl).toBe('http://127.0.0.1:11434/v1')
    expect(providers.ollama.requiresApiKey).toBe(false)
    expect(providers.ollama.envKey).toBe('')
    expect(providers.lmstudio.defaultBaseUrl).toBe('http://127.0.0.1:1234/v1')
    expect(providers.lmstudio.requiresApiKey).toBe(false)
    expect(providers.openai.requiresApiKey).toBe(true)
    expect(PROVIDER_TYPES.OLLAMA).toBe('ollama')
  })

  it('treats local providers as configured only after models or address are saved', () => {
    const pick = (config) => getAvailableProviders(config).find((provider) => provider.type === 'ollama')
    expect(pick({ ai: { keys: {}, base_urls: {}, models: {} } }).hasApiKey).toBe(false)
    expect(pick({ ai: { keys: {}, base_urls: { ollama: 'http://127.0.0.1:11434/v1' }, models: {} } }).hasApiKey).toBe(
      true
    )

    const saved = pick({
      ai: {
        keys: {},
        base_urls: {},
        models: { ollama: { default: 'llama3.2', models: [{ id: 'llama3.2', name: 'Llama 3.2' }] } }
      }
    })
    expect(saved.hasApiKey).toBe(true)
    expect(saved.models[0].id).toBe('llama3.2')
    expect(saved.defaultModel).toBe('llama3.2')
  })

  it('accepts local providers without an api key and omits the auth header', () => {
    const provider = createProvider('ollama', { apiKey: '' })
    expect(provider.validateConfig()).toEqual({ valid: true })
    expect(provider.getHeaders()).not.toHaveProperty('Authorization')
    expect(createProvider('ollama', { apiKey: 'abc' }).getHeaders().Authorization).toBe('Bearer abc')
    expect(createProvider('openai', { apiKey: '' }).getHeaders()).not.toHaveProperty('Authorization')
  })
})
