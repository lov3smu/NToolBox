import { splitThinkingTags, trimPartialThinkingTag } from '@/utils/markdown'

export function createMessageId() {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function ensureMessageIds(messages) {
  for (const message of messages || []) {
    if (!message.id) message.id = createMessageId()
  }
}

export function toApiMessage(message) {
  if (message.role === 'user' && message.attachments && message.attachments.length > 0) {
    const parts = []
    if (message.content) parts.push({ type: 'text', text: message.content })
    for (const att of message.attachments) {
      if (att.kind === 'image') {
        parts.push({ type: 'image_url', image_url: { url: att.dataUrl } })
      } else {
        parts.push({ type: 'text', text: `\n\n[附件 ${att.name}]\n${att.content || ''}` })
      }
    }
    return { role: 'user', content: parts }
  }
  return { role: message.role, content: message.content || '' }
}

export function applyStreamingContent(message) {
  const parsed = splitThinkingTags(message.rawContent)
  message.content = trimPartialThinkingTag(parsed.content)
  message.thinking = [message.nativeThinking, parsed.thinking].filter(Boolean).join('\n')
}

export function finalizeContent(message) {
  const parsed = splitThinkingTags(message.rawContent ?? message.content)
  message.content = trimPartialThinkingTag(parsed.content).trim()
  message.thinking = [message.nativeThinking, parsed.thinking].filter(Boolean).join('\n')
  delete message.rawContent
  delete message.nativeThinking
}

export function normalizeLegacyThinking(message) {
  if (message.role !== 'assistant' || typeof message.content !== 'string') return
  if (!message.content.includes('thinking')) return
  const parsed = splitThinkingTags(message.content)
  if (parsed.content === message.content) return
  message.thinking = [message.thinking, parsed.thinking].filter(Boolean).join('\n')
  message.content = parsed.content
}
