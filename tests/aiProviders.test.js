import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { getAvailableProviders, PROVIDER_TYPES } from '../src/main/services/ai/index.js'

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
})
