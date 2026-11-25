import { log } from '../../utils'
import { getConfig } from '../config.js'
import { t } from '../i18n.js'
import { buildInlineAiMessages, normalizeInlineAiRequest } from '../../../shared/inlineAi.js'
import { getProvider, resolveProviderRuntimeConfig } from './index.js'
import { normalizeUsage } from './tokens.js'

const pending = new Map()

export async function runInlineAi(payload) {
  const normalized = normalizeInlineAiRequest(payload)
  if (!normalized.ok) {
    return { success: false, error: t(normalized.error, normalized.errorArgs) }
  }
  const { action, text, requestId } = normalized.value

  const config = getConfig()
  const providerType = config.ai?.provider || 'bailian'
  const provider = getProvider(providerType, resolveProviderRuntimeConfig(providerType, config))
  if (!provider) {
    return { success: false, error: t('未知的 AI Provider: {p0}', { p0: providerType }) }
  }
  const validation = provider.validateConfig()
  if (!validation.valid) {
    return { success: false, error: `${provider.name} ${validation.error}` }
  }

  const model = provider.getDefaultModel()
  const entry = { cancelled: false }
  if (requestId) pending.set(requestId, entry)

  try {
    const result = await provider.chat(buildInlineAiMessages(action, text), [], {
      model,
      max_tokens: 2048,
      temperature: 0.3,
      thinking: false,
      shouldStop: () => entry.cancelled
    })
    if (entry.cancelled) {
      return { success: false, cancelled: true, error: t('已取消') }
    }
    if (!result.success) {
      return { success: false, error: result.error || t('AI 请求失败') }
    }
    const content = typeof result.content === 'string' ? result.content.trim() : ''
    if (!content) {
      return { success: false, error: t('AI 未返回内容') }
    }
    return {
      success: true,
      content,
      model: result.model || model,
      usage: normalizeUsage(result.usage)
    }
  } catch (error) {
    log.error('就地 AI 处理失败:', error)
    return { success: false, error: error?.message || t('AI 请求失败') }
  } finally {
    if (requestId) pending.delete(requestId)
  }
}

export function cancelInlineAi(requestId) {
  if (typeof requestId !== 'string' || !requestId) return false
  const entry = pending.get(requestId)
  if (!entry) return false
  entry.cancelled = true
  return true
}
