import { describe, it, expect } from 'vitest'
import {
  TOOL_POLICY_OPTIONS,
  TOOL_POLICIES,
  SCENARIO_MODEL_KEYS,
  DEFAULT_AI_PERSONA_MAX_CHARS,
  AI_TIMEOUT_DEFAULT,
  AI_TIMEOUT_OPTIONS,
  AI_COMPRESS_THRESHOLD_OPTIONS,
  AI_COMPRESS_KEEP_RECENT_DEFAULT,
  AI_MAX_ATTACHMENTS_DEFAULT,
  AI_MAX_IMAGE_MB_DEFAULT,
  AI_MAX_TEXT_KB_DEFAULT,
  normalizeToolPolicy,
  needsApprovalForPolicy,
  normalizeAiPersona,
  normalizeAiTemperature,
  normalizeAiTimeout,
  normalizeAiCompressThreshold,
  normalizeAiCompressKeepRecent,
  normalizeAiMaxAttachments,
  normalizeAiMaxImageMb,
  normalizeAiMaxTextKb,
  normalizeAiRuntimeLimits,
  AI_AGENT_MAX_ITERATIONS_OPTIONS,
  AI_AGENT_TIMEOUT_MIN_OPTIONS,
  AI_AGENT_PLAN_STEPS_OPTIONS,
  AI_AGENT_PARALLEL_TOOLS_OPTIONS,
  AI_TOOL_RESULT_MAX_KB_OPTIONS,
  AI_TOOL_RESULT_RUN_KB_OPTIONS,
  AI_TOOL_RESULT_RETENTION_OPTIONS,
  AI_PRESETS,
  normalizeAiAgentMaxIterations,
  normalizeAiAgentTimeoutMin,
  normalizeAiAgentPlanSteps,
  normalizeAiAgentParallelTools,
  normalizeAiToolResultMaxKb,
  normalizeAiToolResultRunKb,
  normalizeAiToolResultRetentionDays,
  normalizeAiAgentRuntime,
  normalizeAiToolResultBudget,
  parseScenarioModel,
  normalizeScenarioModels
} from '../src/shared/aiBehavior.js'

describe('tool policy', () => {
  it('exposes the three policy options', () => {
    expect(TOOL_POLICIES).toEqual(['all', 'high-risk', 'auto'])
    expect(TOOL_POLICY_OPTIONS).toHaveLength(3)
  })

  it('maps the legacy ask value to all', () => {
    expect(normalizeToolPolicy('ask')).toBe('all')
  })

  it('falls back on unknown or empty input', () => {
    expect(normalizeToolPolicy('nope')).toBe('all')
    expect(normalizeToolPolicy(undefined)).toBe('all')
    expect(normalizeToolPolicy('', 'high-risk')).toBe('high-risk')
  })

  it('trims valid values', () => {
    expect(normalizeToolPolicy(' auto ')).toBe('auto')
  })
})

describe('needsApprovalForPolicy', () => {
  it('asks for writes and destructive actions under all', () => {
    expect(needsApprovalForPolicy('read', 'all')).toBe(false)
    expect(needsApprovalForPolicy('write', 'all')).toBe(true)
    expect(needsApprovalForPolicy('destructive', 'all')).toBe(true)
  })

  it('only asks for destructive actions under high-risk', () => {
    expect(needsApprovalForPolicy('read', 'high-risk')).toBe(false)
    expect(needsApprovalForPolicy('write', 'high-risk')).toBe(false)
    expect(needsApprovalForPolicy('destructive', 'high-risk')).toBe(true)
  })

  it('never asks under auto', () => {
    expect(needsApprovalForPolicy('read', 'auto')).toBe(false)
    expect(needsApprovalForPolicy('write', 'auto')).toBe(false)
    expect(needsApprovalForPolicy('destructive', 'auto')).toBe(false)
  })
})

describe('normalizeAiPersona', () => {
  it('returns empty string for non-strings', () => {
    expect(normalizeAiPersona(undefined)).toBe('')
    expect(normalizeAiPersona(42)).toBe('')
  })

  it('trims and caps the persona length', () => {
    expect(normalizeAiPersona('  你是后端专家  ')).toBe('你是后端专家')
    const long = 'a'.repeat(DEFAULT_AI_PERSONA_MAX_CHARS + 100)
    expect(normalizeAiPersona(long)).toHaveLength(DEFAULT_AI_PERSONA_MAX_CHARS)
  })
})

describe('normalizeAiTemperature', () => {
  it('returns null for empty or invalid values', () => {
    expect(normalizeAiTemperature(null)).toBeNull()
    expect(normalizeAiTemperature('')).toBeNull()
    expect(normalizeAiTemperature(undefined)).toBeNull()
    expect(normalizeAiTemperature('abc')).toBeNull()
    expect(normalizeAiTemperature(Infinity)).toBeNull()
  })

  it('clamps to 0..2 and rounds to two decimals', () => {
    expect(normalizeAiTemperature(0.7)).toBe(0.7)
    expect(normalizeAiTemperature('0.333')).toBe(0.33)
    expect(normalizeAiTemperature(-1)).toBe(0)
    expect(normalizeAiTemperature(5)).toBe(2)
  })
})

describe('runtime limits', () => {
  it('clamps the request timeout to 10–600 seconds', () => {
    expect(AI_TIMEOUT_OPTIONS.some((option) => option.value === AI_TIMEOUT_DEFAULT)).toBe(true)
    expect(normalizeAiTimeout(60)).toBe(60)
    expect(normalizeAiTimeout('120')).toBe(120)
    expect(normalizeAiTimeout(5)).toBe(10)
    expect(normalizeAiTimeout(9999)).toBe(600)
    expect(normalizeAiTimeout('abc')).toBe(AI_TIMEOUT_DEFAULT)
  })

  it('clamps compression settings and defaults to 70% / 6 messages', () => {
    expect(AI_COMPRESS_THRESHOLD_OPTIONS.some((option) => option.value === 70)).toBe(true)
    expect(normalizeAiCompressThreshold(80)).toBe(80)
    expect(normalizeAiCompressThreshold(10)).toBe(50)
    expect(normalizeAiCompressThreshold(100)).toBe(90)
    expect(normalizeAiCompressKeepRecent(undefined)).toBe(AI_COMPRESS_KEEP_RECENT_DEFAULT)
    expect(normalizeAiCompressKeepRecent(3)).toBe(4)
    expect(normalizeAiCompressKeepRecent(99)).toBe(12)
  })

  it('clamps attachment limits to the supported ranges', () => {
    expect(normalizeAiMaxAttachments(undefined)).toBe(AI_MAX_ATTACHMENTS_DEFAULT)
    expect(normalizeAiMaxAttachments(0)).toBe(1)
    expect(normalizeAiMaxAttachments(30)).toBe(20)
    expect(normalizeAiMaxImageMb(undefined)).toBe(AI_MAX_IMAGE_MB_DEFAULT)
    expect(normalizeAiMaxImageMb(0)).toBe(1)
    expect(normalizeAiMaxImageMb(80)).toBe(50)
    expect(normalizeAiMaxTextKb(undefined)).toBe(AI_MAX_TEXT_KB_DEFAULT)
    expect(normalizeAiMaxTextKb(1)).toBe(32)
    expect(normalizeAiMaxTextKb(9999)).toBe(4096)
  })

  it('normalizes a grouped runtime limit payload', () => {
    expect(normalizeAiRuntimeLimits(null)).toEqual({
      compressThreshold: 70,
      compressKeepRecent: 6,
      maxAttachments: 6,
      maxImageMb: 10,
      maxTextKb: 256
    })
    expect(
      normalizeAiRuntimeLimits({
        compressThreshold: 90,
        compressKeepRecent: 10,
        maxAttachments: 12,
        maxImageMb: 20,
        maxTextKb: 512
      })
    ).toEqual({ compressThreshold: 90, compressKeepRecent: 10, maxAttachments: 12, maxImageMb: 20, maxTextKb: 512 })
  })
})

describe('agent runtime limits', () => {
  it('clamps loop, timeout, plan and concurrency settings', () => {
    expect(normalizeAiAgentMaxIterations(undefined)).toBe(20)
    expect(normalizeAiAgentMaxIterations(2)).toBe(3)
    expect(normalizeAiAgentMaxIterations(99)).toBe(30)
    expect(normalizeAiAgentTimeoutMin(undefined)).toBe(5)
    expect(normalizeAiAgentTimeoutMin(0)).toBe(1)
    expect(normalizeAiAgentTimeoutMin(99)).toBe(30)
    expect(normalizeAiAgentPlanSteps(undefined)).toBe(8)
    expect(normalizeAiAgentPlanSteps(2)).toBe(3)
    expect(normalizeAiAgentPlanSteps(99)).toBe(12)
    expect(normalizeAiAgentParallelTools(undefined)).toBe(4)
    expect(normalizeAiAgentParallelTools(0)).toBe(1)
    expect(normalizeAiAgentParallelTools(99)).toBe(8)
  })

  it('clamps tool result budget and retention', () => {
    expect(normalizeAiToolResultMaxKb(undefined)).toBe(24)
    expect(normalizeAiToolResultMaxKb(1)).toBe(4)
    expect(normalizeAiToolResultMaxKb(999)).toBe(64)
    expect(normalizeAiToolResultRunKb(undefined)).toBe(160)
    expect(normalizeAiToolResultRunKb(1)).toBe(32)
    expect(normalizeAiToolResultRunKb(9999)).toBe(512)
    expect(normalizeAiToolResultRetentionDays(undefined)).toBe(7)
    expect(normalizeAiToolResultRetentionDays(0)).toBe(1)
    expect(normalizeAiToolResultRetentionDays(99)).toBe(30)
  })

  it('normalizes grouped agent payloads with defaults', () => {
    expect(normalizeAiAgentRuntime(null)).toEqual({
      maxIterations: 20,
      timeoutMin: 5,
      planSteps: 8,
      parallelTools: 4
    })
    expect(normalizeAiToolResultBudget(null)).toEqual({ maxKb: 24, runKb: 160, retentionDays: 7 })
  })

  it('keeps every preset value inside its select options', () => {
    expect(AI_PRESETS.map((preset) => preset.id)).toEqual(['thrifty', 'long-run', 'strict'])
    const optionValues = (options) => options.map((option) => option.value)
    for (const preset of AI_PRESETS) {
      const values = preset.values
      expect(optionValues(AI_AGENT_MAX_ITERATIONS_OPTIONS)).toContain(values.ai_agent_max_iterations)
      expect(optionValues(AI_AGENT_TIMEOUT_MIN_OPTIONS)).toContain(values.ai_agent_timeout_min)
      expect(optionValues(AI_AGENT_PLAN_STEPS_OPTIONS)).toContain(values.ai_agent_plan_steps)
      expect(optionValues(AI_AGENT_PARALLEL_TOOLS_OPTIONS)).toContain(values.ai_agent_parallel_tools)
      expect(optionValues(AI_TOOL_RESULT_MAX_KB_OPTIONS)).toContain(values.ai_tool_result_max_kb)
      expect(optionValues(AI_TOOL_RESULT_RUN_KB_OPTIONS)).toContain(values.ai_tool_result_run_kb)
      expect(optionValues(AI_TOOL_RESULT_RETENTION_OPTIONS)).toContain(values.ai_tool_result_retention_days)
      expect(normalizeAiCompressThreshold(values.ai_compress_threshold)).toBe(values.ai_compress_threshold)
      expect(normalizeAiCompressKeepRecent(values.ai_compress_keep_recent)).toBe(values.ai_compress_keep_recent)
    }
    const strict = AI_PRESETS.find((preset) => preset.id === 'strict')
    expect(strict.values.ai_tool_policy).toBe('all')
  })
})

describe('scenario models', () => {
  it('parses provider:model strings', () => {
    expect(parseScenarioModel('bailian:qwen3.8-flash')).toEqual({
      provider: 'bailian',
      model: 'qwen3.8-flash'
    })
    expect(parseScenarioModel('  zhipu : glm-4.7-flash ')).toEqual({
      provider: 'zhipu',
      model: 'glm-4.7-flash'
    })
  })

  it('rejects malformed values', () => {
    expect(parseScenarioModel('')).toBeNull()
    expect(parseScenarioModel('bailian')).toBeNull()
    expect(parseScenarioModel(':model')).toBeNull()
    expect(parseScenarioModel('bailian:')).toBeNull()
    expect(parseScenarioModel('bai lian:model')).toBeNull()
    expect(parseScenarioModel(42)).toBeNull()
  })

  it('normalizes all scenario keys and drops invalid entries', () => {
    const result = normalizeScenarioModels({
      planner: ' bailian:qwen3.8-flash ',
      compression: 'invalid',
      other: 'x:y'
    })
    expect(result).toEqual({ planner: 'bailian:qwen3.8-flash', compression: '' })
    expect(Object.keys(result)).toEqual([...SCENARIO_MODEL_KEYS])
  })

  it('returns empty defaults for non-object input', () => {
    expect(normalizeScenarioModels(null)).toEqual({ planner: '', compression: '' })
    expect(normalizeScenarioModels([])).toEqual({ planner: '', compression: '' })
  })
})
