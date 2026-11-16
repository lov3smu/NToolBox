import { computed, ref } from 'vue'

const DEFAULT_CONTEXT_WINDOW = 131072

export function formatTokens(value) {
  const tokens = Number(value) || 0
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(tokens >= 10000000 ? 0 : 1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}k`
  return String(tokens)
}

export function useChatUsage({ currentSession, selectedModelInfo }) {
  const usageDetail = ref('')
  const sessionUsage = computed(() => currentSession.value?.usage || null)
  const sessionTokenTotal = computed(() => Number(sessionUsage.value?.total_tokens) || 0)
  const sessionUsageEstimated = computed(() => Boolean(sessionUsage.value?.estimated))
  const contextWindowSize = computed(
    () =>
      Number(currentSession.value?.contextUsage?.window) ||
      Number(selectedModelInfo.value?.contextWindow) ||
      DEFAULT_CONTEXT_WINDOW
  )
  const contextTokens = computed(() => Number(currentSession.value?.contextUsage?.tokens) || 0)
  const contextPercent = computed(() => {
    if (!contextTokens.value || !contextWindowSize.value) return 0
    return Math.min(100, Math.round((contextTokens.value / contextWindowSize.value) * 100))
  })
  const contextState = computed(() => {
    if (contextPercent.value >= 90) return 'danger'
    if (contextPercent.value >= 70) return 'warn'
    return 'ok'
  })
  const remainingContextTokens = computed(() => Math.max(0, contextWindowSize.value - contextTokens.value))
  const contextRingStyle = computed(() => {
    const circumference = 2 * Math.PI * 9
    return { strokeDasharray: `${(contextPercent.value / 100) * circumference} ${circumference}` }
  })
  const sessionPromptTokens = computed(() => Number(sessionUsage.value?.prompt_tokens) || 0)
  const sessionCompletionTokens = computed(() => Number(sessionUsage.value?.completion_tokens) || 0)
  const sessionCachedTokens = computed(() => Number(sessionUsage.value?.cached_tokens) || 0)
  const sessionCallCount = computed(() => Number(sessionUsage.value?.calls) || 0)
  const unCachedTokens = computed(() => Math.max(0, sessionPromptTokens.value - sessionCachedTokens.value))
  const cacheHitPercent = computed(() => {
    const prompt = sessionPromptTokens.value
    if (!prompt || !sessionCachedTokens.value) return 0
    return Math.min(100, Math.round((sessionCachedTokens.value / prompt) * 100))
  })
  const generationMs = computed(() => {
    let total = 0
    for (const message of currentSession.value?.messages || []) {
      total += Number(message.duration) || 0
    }
    return total
  })
  const sessionTokenRate = computed(() => {
    if (!generationMs.value) return 0
    return Math.round((sessionCompletionTokens.value / generationMs.value) * 1000)
  })
  const hasUsageData = computed(() => sessionCallCount.value > 0 || sessionTokenTotal.value > 0)
  const hasRateData = computed(() => generationMs.value > 0 && sessionCompletionTokens.value > 0)
  const hasCacheData = computed(() => sessionPromptTokens.value > 0)
  const rateDisplay = computed(() => (hasRateData.value ? `${sessionTokenRate.value} t/s` : '--'))
  const totalDisplay = computed(() => (hasUsageData.value ? `${formatTokens(sessionTokenTotal.value)} tokens` : '--'))
  const cacheDisplay = computed(() => (hasCacheData.value ? `${cacheHitPercent.value}%` : '--'))

  function toggleUsageDetail(type) {
    usageDetail.value = usageDetail.value === type ? '' : type
  }

  return {
    usageDetail,
    sessionUsage,
    sessionTokenTotal,
    sessionUsageEstimated,
    contextWindowSize,
    contextTokens,
    contextPercent,
    contextState,
    remainingContextTokens,
    contextRingStyle,
    sessionPromptTokens,
    sessionCompletionTokens,
    sessionCachedTokens,
    sessionCallCount,
    unCachedTokens,
    cacheHitPercent,
    generationMs,
    sessionTokenRate,
    hasUsageData,
    hasRateData,
    hasCacheData,
    rateDisplay,
    totalDisplay,
    cacheDisplay,
    toggleUsageDetail,
    formatTokens
  }
}
