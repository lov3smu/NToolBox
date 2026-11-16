import { describe, expect, it } from 'vitest'
import { getContextWindow, supportsThinking } from '../src/main/services/ai/capabilities.js'

describe('capabilities', () => {
  it('supports thinking for DeepSeek reasoning and flash models', () => {
    expect(supportsThinking('deepseek', 'deepseek-v4-pro')).toBe(true)
    expect(supportsThinking('deepseek', 'deepseek-reasoner')).toBe(true)
    expect(supportsThinking('deepseek', 'deepseek-flash')).toBe(true)
    expect(supportsThinking('deepseek', 'DeepSeek-Flash')).toBe(true)
  })

  it('exposes reasoning controls for Kimi K3 and MiniMax M3 families', () => {
    expect(supportsThinking('moonshot', 'kimi-k3')).toBe(true)
    expect(supportsThinking('moonshot', 'kimi-k3.1-pro')).toBe(true)
    expect(supportsThinking('moonshot', 'kimi-k2')).toBe(false)
    expect(supportsThinking('minimax', 'MiniMax-M3')).toBe(true)
    expect(supportsThinking('minimax', 'MiniMax-M3.1-Flash')).toBe(true)
    expect(supportsThinking('minimax', 'MiniMax-M2.5')).toBe(false)
    expect(supportsThinking('zhipu', 'glm-5.3')).toBe(true)
    expect(supportsThinking('zhipu', 'glm-4.7-flash')).toBe(true)
    expect(supportsThinking('zhipu', 'glm-4.5')).toBe(false)
  })

  it('exposes thinking controls for Xiaomi MiMo V2.6', () => {
    expect(supportsThinking('mimo', 'mimo-v2.6-pro')).toBe(true)
    expect(supportsThinking('mimo', 'mimo-v2.6-flash')).toBe(true)
    expect(supportsThinking('mimo', 'mimo-v2.6-pro-ultraspeed')).toBe(true)
    expect(supportsThinking('mimo', 'mimo-v2.5-pro')).toBe(false)
  })

  it('rejects unknown providers and empty models', () => {
    expect(supportsThinking('unknown', 'kimi-k3')).toBe(false)
    expect(supportsThinking('deepseek', '')).toBe(false)
  })

  it('uses documented context windows', () => {
    expect(getContextWindow('bailian')).toBe(1000000)
    expect(getContextWindow('moonshot')).toBe(1000000)
    expect(getContextWindow('zhipu')).toBe(204800)
    expect(getContextWindow('minimax')).toBe(204800)
    expect(getContextWindow('volcengine')).toBe(262144)
    expect(getContextWindow('deepseek')).toBe(1000000)
    expect(getContextWindow('mimo')).toBe(1048576)
    expect(getContextWindow('openai')).toBe(1050000)
    expect(getContextWindow('google')).toBe(1000000)
    expect(getContextWindow('anthropic')).toBe(1000000)
    expect(getContextWindow('unknown')).toBe(131072)
  })
})
