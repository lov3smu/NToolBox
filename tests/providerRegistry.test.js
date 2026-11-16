import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  AUTO_PRIORITY,
  DEFAULT_CONTEXT_WINDOW,
  PROVIDER_INFO,
  PROVIDER_REGISTRY,
  PROVIDER_TYPES,
  getContextWindow,
  getProviderEntry
} from '../src/main/services/ai/registry.js'
import { getProvider as getProviderFromIndex, resolveProviderRuntimeConfig } from '../src/main/services/ai/index.js'

describe('Provider 注册表', () => {
  it('自动降级顺序由 autoPriority 唯一决定', () => {
    expect([...AUTO_PRIORITY]).toEqual([
      'bailian',
      'deepseek',
      'moonshot',
      'zhipu',
      'volcengine',
      'minimax',
      'mimo',
      'openai',
      'google',
      'anthropic',
      'opencode',
      'opencode_go'
    ])
    const priorities = Object.values(PROVIDER_REGISTRY).map((entry) => entry.autoPriority)
    expect(new Set(priorities).size).toBe(priorities.length)
  })

  it('派生常量与注册表保持一致', () => {
    const types = Object.keys(PROVIDER_REGISTRY)
    expect(Object.keys(PROVIDER_INFO)).toEqual(types)
    expect(Object.values(PROVIDER_TYPES).sort()).toEqual([...types].sort())
    expect(Object.isFrozen(PROVIDER_INFO)).toBe(true)
    expect(Object.isFrozen(AUTO_PRIORITY)).toBe(true)
    for (const type of types) {
      const entry = getProviderEntry(type)
      expect(typeof entry.Provider).toBe('function')
      expect(entry.name).toBe(PROVIDER_INFO[type].name)
    }
    expect(getProviderEntry('unknown')).toBeNull()
  })

  it('上下文窗口回退到默认值', () => {
    expect(getContextWindow('bailian')).toBe(1000000)
    expect(getContextWindow('opencode_go')).toBe(DEFAULT_CONTEXT_WINDOW)
    expect(getContextWindow('unknown')).toBe(DEFAULT_CONTEXT_WINDOW)
  })
})

describe('Provider 实例独立性', () => {
  it('每次 getProvider 返回互不共享的实例', () => {
    const config = resolveProviderRuntimeConfig('deepseek', { ai_api_keys: { deepseek: 'sk-test' } })
    const first = getProviderFromIndex('deepseek', config)
    const second = getProviderFromIndex('deepseek', config)
    expect(first).not.toBe(second)
    expect(first.apiKey).toBe('sk-test')

    first.setBaseUrl('https://example.com/v1')
    expect(second.hostname).toBe('api.deepseek.com')
    expect(getProviderFromIndex('deepseek', config).hostname).toBe('api.deepseek.com')
  })

  it('未知类型返回 null', () => {
    expect(getProviderFromIndex('nope')).toBeNull()
  })
})
