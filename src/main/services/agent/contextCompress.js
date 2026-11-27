import { log } from '../../utils'
import { getProvider } from '../ai/index.js'
import { estimateMessagesTokens, estimateTextTokens, normalizeUsage } from '../ai/tokens.js'
import { getProviderConfig, resolveScenarioRoute } from './providerRoutes.js'

const COMPRESSION_DEFAULT_KEEP = 6
const COMPRESSION_MAX_SUMMARY_CHARS = 8000
const COMPRESSION_MAX_INPUT_CHARS = 30000

const COMPRESSION_SYSTEM_PROMPT = `你是对话上下文压缩器。请把历史对话压缩成一段结构化摘要，供后续对话继续使用。
要求：
- 保留用户目标、已确认的事实与数据、已执行的操作与结果、未解决的问题
- 保留关键参数：数据库连接名、库名、表名、文件路径、配置项等
- 使用简洁的 Markdown 列表，合并重复信息
- 不编造对话中不存在的结论或数据
- 只输出摘要正文，不要额外解释，控制在 800 字以内`

const SUMMARY_ROLE_LABELS = {
  system: '系统',
  user: '用户',
  assistant: '助手',
  tool: '工具结果'
}

function flattenMessageText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      if (part.type === 'text') return part.text || ''
      if (part.type === 'image_url') return '[图片]'
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function formatMessageForSummary(message) {
  if (!message || typeof message !== 'object') return ''
  const label = SUMMARY_ROLE_LABELS[message.role] || message.role || '消息'
  const parts = []
  const text = flattenMessageText(message.content).trim()
  if (text) parts.push(text.slice(0, 2000))
  if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
    const names = message.tool_calls.map((call) => call?.function?.name || '').filter(Boolean)
    if (names.length > 0) parts.push(`调用工具：${names.join(', ')}`)
  }
  if (parts.length === 0) return ''
  return `${label}：${parts.join(' ')}`
}

export async function compressChatContext(messages, options = {}) {
  const { providerType, providerConfig } = getProviderConfig(options.provider)
  const provider = getProvider(providerType, providerConfig)

  if (!provider) {
    return { success: false, error: `未知的 AI Provider: ${providerType}` }
  }

  const validation = provider.validateConfig()
  if (!validation.valid) {
    return { success: false, error: `${provider.name} ${validation.error}，请在设置中配置` }
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { success: false, error: '没有可压缩的对话历史' }
  }

  const rawKeep = Number(options.keepRecent)
  const keepRecent = Math.min(
    20,
    Math.max(2, Number.isFinite(rawKeep) ? Math.round(rawKeep) : COMPRESSION_DEFAULT_KEEP)
  )

  if (messages.length <= keepRecent + 1) {
    return { success: false, error: '历史消息较少，无需压缩' }
  }

  const compressible = messages.slice(0, -keepRecent)
  const kept = messages.slice(-keepRecent)
  const priorSummary = typeof options.contextSummary === 'string' ? options.contextSummary.trim() : ''

  const transcript = compressible
    .map(formatMessageForSummary)
    .filter(Boolean)
    .join('\n')
    .slice(0, COMPRESSION_MAX_INPUT_CHARS)

  if (!transcript && !priorSummary) {
    return { success: false, error: '没有可压缩的对话内容' }
  }

  const userContent = [
    priorSummary ? `已有摘要：\n${priorSummary}` : '',
    `待压缩的历史对话：\n${transcript || '（无新增历史）'}`
  ]
    .filter(Boolean)
    .join('\n\n')

  const compressionRoute = resolveScenarioRoute('compression')
  const activeProvider = compressionRoute?.provider || provider
  const activeModel = compressionRoute?.model || options.model

  try {
    const result = await activeProvider.chat(
      [
        { role: 'system', content: COMPRESSION_SYSTEM_PROMPT },
        { role: 'user', content: userContent }
      ],
      [],
      { model: activeModel, max_tokens: 1500, temperature: 0.2 }
    )

    if (!result?.success) {
      return { success: false, error: result?.error || '上下文压缩失败' }
    }

    const summary = String(result.content || '')
      .trim()
      .slice(0, COMPRESSION_MAX_SUMMARY_CHARS)
    if (!summary) {
      return { success: false, error: '上下文压缩返回为空' }
    }

    return {
      success: true,
      summary,
      compressedCount: compressible.length,
      keptCount: kept.length,
      beforeTokens: estimateTextTokens(priorSummary) + estimateMessagesTokens(compressible),
      afterTokens: estimateTextTokens(summary) + estimateMessagesTokens(kept),
      usage: normalizeUsage(result.usage),
      error: null
    }
  } catch (error) {
    log.warn('上下文压缩异常:', error.message)
    return { success: false, error: error.message }
  }
}
