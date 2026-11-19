export const TOOL_POLICY_OPTIONS = Object.freeze([
  { value: 'all', label: '写操作前询问', hint: '写入与破坏性操作都需要确认' },
  { value: 'high-risk', label: '仅高危操作询问', hint: '仅删除、移动等破坏性操作需要确认' },
  { value: 'auto', label: '自动执行', hint: '不打断，自动执行所有工具调用' }
])

export const TOOL_POLICIES = TOOL_POLICY_OPTIONS.map((option) => option.value)

export const SCENARIO_MODEL_KEYS = Object.freeze(['planner', 'compression'])

export const DEFAULT_AI_PERSONA_MAX_CHARS = 4000

const LEGACY_TOOL_POLICIES = {
  ask: 'all',
  auto: 'auto'
}

export function normalizeToolPolicy(value, fallback = 'all') {
  const raw = typeof value === 'string' ? value.trim() : ''
  const aliased = LEGACY_TOOL_POLICIES[raw] || raw
  if (TOOL_POLICIES.includes(aliased)) return aliased
  return fallback
}

export function needsApprovalForPolicy(level, policy) {
  const mode = normalizeToolPolicy(policy)
  if (mode === 'auto') return false
  if (mode === 'high-risk') return level === 'destructive'
  return level === 'write' || level === 'destructive'
}

export function normalizeAiPersona(value) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, DEFAULT_AI_PERSONA_MAX_CHARS)
}

export function normalizeAiTemperature(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  const clamped = Math.min(2, Math.max(0, num))
  return Math.round(clamped * 100) / 100
}

export function parseScenarioModel(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return null
  const separator = raw.indexOf(':')
  if (separator <= 0 || separator === raw.length - 1) return null
  const provider = raw.slice(0, separator).trim()
  const model = raw.slice(separator + 1).trim()
  if (!provider || !model || /\s/.test(provider)) return null
  return { provider, model }
}

export function normalizeScenarioModels(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const result = {}
  for (const key of SCENARIO_MODEL_KEYS) {
    const parsed = parseScenarioModel(source[key])
    result[key] = parsed ? `${parsed.provider}:${parsed.model}` : ''
  }
  return result
}

export const AI_TIMEOUT_MIN = 10
export const AI_TIMEOUT_MAX = 600
export const AI_TIMEOUT_DEFAULT = 60

export const AI_TIMEOUT_OPTIONS = Object.freeze([
  { value: 30, label: '30 秒', hint: '适合响应较快的模型，超时会中断请求' },
  { value: 60, label: '60 秒（默认）', hint: '常规对话与工具调用的等待上限' },
  { value: 120, label: '120 秒', hint: '长回答或需要思考的模型' },
  { value: 300, label: '300 秒', hint: '超大上下文或慢速服务商' }
])

export const AI_COMPRESS_THRESHOLD_OPTIONS = Object.freeze([
  { value: 50, label: '50%', hint: '更早压缩，节省更多 token，历史细节保留更少' },
  { value: 60, label: '60%', hint: '较早压缩' },
  { value: 70, label: '70%（默认）', hint: '剩余约三成空间时压缩历史' },
  { value: 80, label: '80%', hint: '接近上限时才压缩，保留更多原始对话' },
  { value: 90, label: '90%', hint: '极限压缩，容易出现较长等待' }
])

export const AI_COMPRESS_THRESHOLD_MIN = 50
export const AI_COMPRESS_THRESHOLD_MAX = 90
export const AI_COMPRESS_THRESHOLD_DEFAULT = 70

export const AI_COMPRESS_KEEP_RECENT_OPTIONS = Object.freeze(
  [4, 6, 8, 10, 12].map((value) => ({ value, label: '{p0} 条', hint: '压缩后保留最近 {p0} 条消息原文' }))
)

export const AI_COMPRESS_KEEP_RECENT_MIN = 4
export const AI_COMPRESS_KEEP_RECENT_MAX = 12
export const AI_COMPRESS_KEEP_RECENT_DEFAULT = 6

export const AI_MAX_ATTACHMENT_OPTIONS = Object.freeze(
  [3, 6, 10, 15, 20].map((value) => ({ value, label: '{p0} 个', hint: '单条消息最多携带 {p0} 个附件' }))
)

export const AI_MAX_ATTACHMENTS_MIN = 1
export const AI_MAX_ATTACHMENTS_MAX = 20
export const AI_MAX_ATTACHMENTS_DEFAULT = 6

export const AI_MAX_IMAGE_MB_OPTIONS = Object.freeze(
  [5, 10, 20, 30, 50].map((value) => ({ value, label: '{p0} MB', hint: '单张图片不超过 {p0} MB' }))
)

export const AI_MAX_IMAGE_MB_MIN = 1
export const AI_MAX_IMAGE_MB_MAX = 50
export const AI_MAX_IMAGE_MB_DEFAULT = 10

export const AI_MAX_TEXT_KB_OPTIONS = Object.freeze(
  [128, 256, 512, 1024].map((value) => ({ value, label: '{p0} KB', hint: '单个文本附件不超过 {p0} KB' }))
)

export const AI_MAX_TEXT_KB_MIN = 32
export const AI_MAX_TEXT_KB_MAX = 4096
export const AI_MAX_TEXT_KB_DEFAULT = 256

function clampInt(value, min, max, fallback) {
  if (value === null || value === undefined || value === '') return fallback
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, Math.round(num)))
}

export function normalizeAiTimeout(value) {
  return clampInt(value, AI_TIMEOUT_MIN, AI_TIMEOUT_MAX, AI_TIMEOUT_DEFAULT)
}

export function normalizeAiCompressThreshold(value) {
  return clampInt(value, AI_COMPRESS_THRESHOLD_MIN, AI_COMPRESS_THRESHOLD_MAX, AI_COMPRESS_THRESHOLD_DEFAULT)
}

export function normalizeAiCompressKeepRecent(value) {
  return clampInt(value, AI_COMPRESS_KEEP_RECENT_MIN, AI_COMPRESS_KEEP_RECENT_MAX, AI_COMPRESS_KEEP_RECENT_DEFAULT)
}

export function normalizeAiMaxAttachments(value) {
  return clampInt(value, AI_MAX_ATTACHMENTS_MIN, AI_MAX_ATTACHMENTS_MAX, AI_MAX_ATTACHMENTS_DEFAULT)
}

export function normalizeAiMaxImageMb(value) {
  return clampInt(value, AI_MAX_IMAGE_MB_MIN, AI_MAX_IMAGE_MB_MAX, AI_MAX_IMAGE_MB_DEFAULT)
}

export function normalizeAiMaxTextKb(value) {
  return clampInt(value, AI_MAX_TEXT_KB_MIN, AI_MAX_TEXT_KB_MAX, AI_MAX_TEXT_KB_DEFAULT)
}

export function normalizeAiRuntimeLimits(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    compressThreshold: normalizeAiCompressThreshold(source.compressThreshold),
    compressKeepRecent: normalizeAiCompressKeepRecent(source.compressKeepRecent),
    maxAttachments: normalizeAiMaxAttachments(source.maxAttachments),
    maxImageMb: normalizeAiMaxImageMb(source.maxImageMb),
    maxTextKb: normalizeAiMaxTextKb(source.maxTextKb)
  }
}

export const AI_AGENT_MAX_ITERATIONS_OPTIONS = Object.freeze(
  [5, 10, 15, 20, 30].map((value) => ({
    value,
    label: '{p0} 轮',
    hint: value === 20 ? '默认值，适合多步骤代码修改与排查任务' : '单次任务最多执行 {p0} 轮工具调用'
  }))
)

export const AI_AGENT_MAX_ITERATIONS_MIN = 3
export const AI_AGENT_MAX_ITERATIONS_MAX = 30
export const AI_AGENT_MAX_ITERATIONS_DEFAULT = 20

export const AI_AGENT_TIMEOUT_MIN_OPTIONS = Object.freeze(
  [1, 3, 5, 10, 20, 30].map((value) => ({
    value,
    label: '{p0} 分钟',
    hint: value === 5 ? '默认值，超时后停止本轮任务并给出提示' : '单次任务最长运行 {p0} 分钟'
  }))
)

export const AI_AGENT_TIMEOUT_MIN_MIN = 1
export const AI_AGENT_TIMEOUT_MIN_MAX = 30
export const AI_AGENT_TIMEOUT_MIN_DEFAULT = 5

export const AI_AGENT_PLAN_STEPS_OPTIONS = Object.freeze(
  [4, 6, 8, 10, 12].map((value) => ({
    value,
    label: '{p0} 步',
    hint: '规划器最多拆分 {p0} 个步骤，步骤越多计划越细'
  }))
)

export const AI_AGENT_PLAN_STEPS_MIN = 3
export const AI_AGENT_PLAN_STEPS_MAX = 12
export const AI_AGENT_PLAN_STEPS_DEFAULT = 8

export const AI_AGENT_PARALLEL_TOOLS_OPTIONS = Object.freeze(
  [1, 2, 4, 6, 8].map((value) => ({
    value,
    label: '{p0} 个',
    hint: value === 1 ? '逐个执行工具调用' : '同一轮最多并行执行 {p0} 个工具调用'
  }))
)

export const AI_AGENT_PARALLEL_TOOLS_MIN = 1
export const AI_AGENT_PARALLEL_TOOLS_MAX = 8
export const AI_AGENT_PARALLEL_TOOLS_DEFAULT = 4

export const AI_TOOL_RESULT_MAX_KB_OPTIONS = Object.freeze(
  [8, 16, 24, 32, 48].map((value) => ({
    value,
    label: '{p0} KB',
    hint: '单个工具结果超过 {p0} KB 时截断，完整内容可落盘分页读取'
  }))
)

export const AI_TOOL_RESULT_MAX_KB_MIN = 4
export const AI_TOOL_RESULT_MAX_KB_MAX = 64
export const AI_TOOL_RESULT_MAX_KB_DEFAULT = 24

export const AI_TOOL_RESULT_RUN_KB_OPTIONS = Object.freeze(
  [80, 160, 240, 320].map((value) => ({
    value,
    label: '{p0} KB',
    hint: '单次任务累计工具输出超过 {p0} KB 后，后续结果都会被截断'
  }))
)

export const AI_TOOL_RESULT_RUN_KB_MIN = 32
export const AI_TOOL_RESULT_RUN_KB_MAX = 512
export const AI_TOOL_RESULT_RUN_KB_DEFAULT = 160

export const AI_TOOL_RESULT_RETENTION_OPTIONS = Object.freeze(
  [1, 3, 7, 14, 30].map((value) => ({
    value,
    label: '{p0} 天',
    hint: '落盘的完整工具结果保留 {p0} 天后自动清理'
  }))
)

export const AI_TOOL_RESULT_RETENTION_MIN = 1
export const AI_TOOL_RESULT_RETENTION_MAX = 30
export const AI_TOOL_RESULT_RETENTION_DEFAULT = 7

export function normalizeAiAgentMaxIterations(value) {
  return clampInt(value, AI_AGENT_MAX_ITERATIONS_MIN, AI_AGENT_MAX_ITERATIONS_MAX, AI_AGENT_MAX_ITERATIONS_DEFAULT)
}

export function normalizeAiAgentTimeoutMin(value) {
  return clampInt(value, AI_AGENT_TIMEOUT_MIN_MIN, AI_AGENT_TIMEOUT_MIN_MAX, AI_AGENT_TIMEOUT_MIN_DEFAULT)
}

export function normalizeAiAgentPlanSteps(value) {
  return clampInt(value, AI_AGENT_PLAN_STEPS_MIN, AI_AGENT_PLAN_STEPS_MAX, AI_AGENT_PLAN_STEPS_DEFAULT)
}

export function normalizeAiAgentParallelTools(value) {
  return clampInt(value, AI_AGENT_PARALLEL_TOOLS_MIN, AI_AGENT_PARALLEL_TOOLS_MAX, AI_AGENT_PARALLEL_TOOLS_DEFAULT)
}

export function normalizeAiToolResultMaxKb(value) {
  return clampInt(value, AI_TOOL_RESULT_MAX_KB_MIN, AI_TOOL_RESULT_MAX_KB_MAX, AI_TOOL_RESULT_MAX_KB_DEFAULT)
}

export function normalizeAiToolResultRunKb(value) {
  return clampInt(value, AI_TOOL_RESULT_RUN_KB_MIN, AI_TOOL_RESULT_RUN_KB_MAX, AI_TOOL_RESULT_RUN_KB_DEFAULT)
}

export function normalizeAiToolResultRetentionDays(value) {
  return clampInt(value, AI_TOOL_RESULT_RETENTION_MIN, AI_TOOL_RESULT_RETENTION_MAX, AI_TOOL_RESULT_RETENTION_DEFAULT)
}

export function normalizeAiAgentRuntime(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    maxIterations: normalizeAiAgentMaxIterations(source.maxIterations),
    timeoutMin: normalizeAiAgentTimeoutMin(source.timeoutMin),
    planSteps: normalizeAiAgentPlanSteps(source.planSteps),
    parallelTools: normalizeAiAgentParallelTools(source.parallelTools)
  }
}

export function normalizeAiToolResultBudget(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    maxKb: normalizeAiToolResultMaxKb(source.maxKb),
    runKb: normalizeAiToolResultRunKb(source.runKb),
    retentionDays: normalizeAiToolResultRetentionDays(source.retentionDays)
  }
}

export const AI_PRESETS = Object.freeze([
  Object.freeze({
    id: 'thrifty',
    name: '省钱模式',
    description: '更早压缩历史，收紧轮次、时长与工具输出，优先控制 token 消耗',
    values: Object.freeze({
      temperature: 0.3,
      context: { compress_threshold: 60, keep_recent: 4 },
      agent: { max_iterations: 5, timeout_min: 3, max_plan_steps: 6, max_parallel_tools: 2 },
      tool_result: { max_kb: 16, run_kb: 80, retention_days: 7 }
    })
  }),
  Object.freeze({
    id: 'long-run',
    name: '长任务模式',
    description: '放宽轮次与时长、保留更多上下文，适合多步骤重构与排查',
    values: Object.freeze({
      temperature: null,
      context: { compress_threshold: 80, keep_recent: 10 },
      agent: { max_iterations: 20, timeout_min: 20, max_plan_steps: 12, max_parallel_tools: 6 },
      tool_result: { max_kb: 32, run_kb: 320, retention_days: 14 }
    })
  }),
  Object.freeze({
    id: 'strict',
    name: '严格审批',
    description: '所有写操作与破坏性操作执行前确认，并收紧并行与预算；适合生产库',
    values: Object.freeze({
      temperature: null,
      context: { compress_threshold: 70, keep_recent: 6 },
      agent: { max_iterations: 10, timeout_min: 5, max_plan_steps: 8, max_parallel_tools: 2, tool_policy: 'all' },
      tool_result: { max_kb: 24, run_kb: 160, retention_days: 7 }
    })
  })
])
