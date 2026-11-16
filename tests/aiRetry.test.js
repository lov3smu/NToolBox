import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import BaseProvider from '../src/main/services/ai/providers/BaseProvider.js'
import { computeRetryDelay, isRetryableNetworkCode, isRetryableStatus, withRetry } from '../src/main/services/ai/retry.js'
import {
  createFallbackProviders,
  normalizeFallbackTarget,
  resolveFallbackTargets
} from '../src/main/services/ai/fallback.js'

function createProvider() {
  return new BaseProvider({
    apiKey: 'test-key',
    name: 'Test',
    hostname: 'api.example.com',
    path: '/v1/chat/completions',
    models: [{ id: 'test-model' }],
    defaultModel: 'test-model'
  })
}

describe('retry policy', () => {
  it('recognizes retryable statuses and network errors', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) expect(isRetryableStatus(status)).toBe(true)
    for (const status of [400, 401, 403, 404, 422]) expect(isRetryableStatus(status)).toBe(false)
    expect(isRetryableNetworkCode('ETIMEDOUT')).toBe(true)
    expect(isRetryableNetworkCode('ECONNRESET')).toBe(true)
    expect(isRetryableNetworkCode('ENOTFOUND')).toBe(false)
    expect(isRetryableNetworkCode('ECONNREFUSED')).toBe(false)
  })

  it('uses exponential backoff capped by max delay', () => {
    expect(computeRetryDelay(1, 800, 8000)).toBe(800)
    expect(computeRetryDelay(2, 800, 8000)).toBe(1600)
    expect(computeRetryDelay(6, 800, 8000)).toBe(8000)
  })

  it('retries retryable results until success', async () => {
    const task = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: '429', retryable: true })
      .mockResolvedValueOnce({ success: false, error: '502', retryable: true })
      .mockResolvedValueOnce({ success: true })
    const onRetry = vi.fn()

    const result = await withRetry(task, { retries: 2, baseDelay: 1, maxDelay: 1, onRetry })

    expect(result.success).toBe(true)
    expect(task).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(2)
    expect(onRetry.mock.calls[0][0].attempt).toBe(1)
  })

  it('does not retry non-retryable results', async () => {
    const task = vi.fn().mockResolvedValue({ success: false, error: '401', retryable: false })
    const result = await withRetry(task, { retries: 3, baseDelay: 1, maxDelay: 1 })
    expect(result.success).toBe(false)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('stops retrying when cancelled', async () => {
    const task = vi.fn().mockResolvedValue({ success: false, error: 'timeout', retryable: true })
    const result = await withRetry(task, {
      retries: 3,
      baseDelay: 1000,
      maxDelay: 1000,
      shouldStop: () => true
    })
    expect(result.cancelled).toBe(true)
    expect(task).not.toHaveBeenCalled()
  })
})

describe('provider request retry', () => {
  it('retries chat requests through makeRequest', async () => {
    const provider = createProvider()
    provider.makeRequestOnce = vi
      .fn()
      .mockResolvedValueOnce({ success: false, error: '请求失败: 429', status: 429, retryable: true })
      .mockResolvedValueOnce({
        success: true,
        data: { choices: [{ message: { content: 'ok' } }], model: 'test-model' }
      })

    const result = await provider.chat([{ role: 'user', content: 'hi' }], [], {
      retries: 1,
      retryBaseDelay: 1,
      retryMaxDelay: 1
    })

    expect(result.success).toBe(true)
    expect(result.content).toBe('ok')
    expect(provider.makeRequestOnce).toHaveBeenCalledTimes(2)
  })

  it('retries streaming when nothing was emitted', async () => {
    const provider = createProvider()
    provider.chatStreamOnce = vi
      .fn()
      .mockRejectedValueOnce({ success: false, error: '请求失败: 503', status: 503, retryable: true, content: '' })
      .mockResolvedValueOnce({ success: true, content: 'done', thinking: '' })

    const events = []
    const result = await provider.chatStream([], [], { retries: 1, retryBaseDelay: 1, retryMaxDelay: 1 }, (event) =>
      events.push(event)
    )

    expect(result.success).toBe(true)
    expect(result.content).toBe('done')
    expect(provider.chatStreamOnce).toHaveBeenCalledTimes(2)
    expect(events.some((event) => event.kind === 'status')).toBe(true)
  })

  it('does not retry streaming after content was emitted', async () => {
    const provider = createProvider()
    provider.chatStreamOnce = vi.fn(async (messages, tools, options, onChunk) => {
      onChunk({ kind: 'content', text: 'partial' })
      throw { success: false, error: '连接中断', retryable: true, content: 'partial' }
    })

    const result = await provider.chatStream([], [], { retries: 3, retryBaseDelay: 1, retryMaxDelay: 1 }, () => {})

    expect(result.success).toBe(false)
    expect(result.emitted).toBe(true)
    expect(provider.chatStreamOnce).toHaveBeenCalledTimes(1)
  })
})

describe('fallback targets', () => {
  it('normalizes provider:model entries', () => {
    expect(normalizeFallbackTarget('deepseek:deepseek-chat')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat'
    })
    expect(normalizeFallbackTarget('DeepSeek:deepseek-chat')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat'
    })
    expect(normalizeFallbackTarget('deepseek')).toBeNull()
    expect(normalizeFallbackTarget('deepseek:')).toBeNull()
    expect(normalizeFallbackTarget(42)).toBeNull()
  })

  it('uses configured fallback models and skips the primary model', () => {
    const config = {
      ai_fallback_models: ['deepseek:deepseek-chat', 'bailian:qwen-max'],
      ai_api_keys: {}
    }
    expect(resolveFallbackTargets(config, 'bailian', 'qwen-max')).toEqual([
      { provider: 'deepseek', model: 'deepseek-chat' }
    ])
  })

  it('derives fallbacks from other configured providers when the list is empty', () => {
    const config = {
      ai_fallback_models: [],
      ai_api_keys: { deepseek: 'k' },
      ai_models: { deepseek: { default: 'deepseek-chat' } }
    }
    const targets = resolveFallbackTargets(config, 'bailian', 'qwen-max')
    expect(targets[0]).toEqual({ provider: 'deepseek', model: 'deepseek-chat' })
  })

  it('can be disabled', () => {
    const config = {
      ai_fallback_enabled: false,
      ai_fallback_models: ['deepseek:deepseek-chat'],
      ai_api_keys: { deepseek: 'k' }
    }
    expect(resolveFallbackTargets(config, 'bailian', 'qwen-max')).toEqual([])
    expect(createFallbackProviders(config, 'bailian', 'qwen-max')).toEqual([])
  })

  it('creates providers only for configured credentials', () => {
    const config = {
      ai_fallback_models: ['deepseek:deepseek-chat', 'openai:gpt-4o'],
      ai_api_keys: { deepseek: 'k', openai: '' }
    }
    const providers = createFallbackProviders(config, 'bailian', 'qwen-max')
    expect(providers).toHaveLength(1)
    expect(providers[0].type).toBe('deepseek')
    expect(providers[0].model).toBe('deepseek-chat')
    expect(providers[0].provider.validateConfig().valid).toBe(true)
  })
})
