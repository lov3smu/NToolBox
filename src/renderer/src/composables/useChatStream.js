import { t } from '@/i18n'

import { nextTick, onUnmounted, ref } from 'vue'
import {
  cancelChatStream,
  chatStream,
  compressChatContext,
  isChatStreamActive,
  onChatApprovalRequest,
  onChatStreamChunk,
  onChatStreamEnd,
  respondChatApproval,
  rollbackChatRun
} from '@/api'
import { applyStreamingContent, finalizeContent, toApiMessage } from '@/utils/chatContent'
import { formatTokens } from './useChatUsage'

export function useChatStream({
  sessions,
  currentSessionId,
  currentSession,
  inputText,
  attachments,
  hasCurrentApiKey,
  currentProvider,
  selectedProvider,
  selectedModel,
  modelSupportsThinking,
  thinkingMode,
  approvalMode,
  compressThreshold,
  compressKeepRecent,
  contextPanelOpen,
  contextWindowSize,
  pendingStream,
  persistPendingStream,
  saveSessions,
  markStreamInterrupted,
  clearDraft,
  createNewChat,
  finishMessageTiming,
  scrollToBottom,
  refreshWorkspaceInfo,
  refreshRunStats,
  resizeInput,
  showSuccess,
  showError,
  toggleContextPanel
}) {
  const loading = ref(false)
  const chatTab = ref('chat')
  const traceFocusId = ref('')
  const tracePanelKey = ref(0)
  const rollbackTarget = ref(null)
  const rollbackBusy = ref(false)
  const currentRequestId = ref('')
  let removeChunkListener = null
  let removeEndListener = null
  let removeApprovalListener = null

  function updateSessionTitle(sessionId, firstMessage) {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session && session.title === t('新会话') && firstMessage) {
      session.title = firstMessage.slice(0, 20) + (firstMessage.length > 20 ? '...' : '')
    }
  }

  function mergeUsage(session, usage) {
    if (!session || !usage) return
    if (!session.usage) {
      session.usage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        cached_tokens: 0,
        calls: 0,
        estimated: false
      }
    }
    const target = session.usage
    target.prompt_tokens += Number(usage.prompt_tokens) || 0
    target.completion_tokens += Number(usage.completion_tokens) || 0
    target.total_tokens += Number(usage.total_tokens) || 0
    target.cached_tokens = (Number(target.cached_tokens) || 0) + (Number(usage.cached_tokens) || 0)
    target.calls += Number(usage.calls) || 0
    if (usage.estimated) target.estimated = true
  }

  function handleStreamChunk(message, payload, sessionId) {
    if (!payload) return
    const event = typeof payload === 'string' ? { kind: 'content', text: payload } : payload

    if (event.kind === 'thinking') {
      message.nativeThinking = (message.nativeThinking || '') + (event.text || '')
      applyStreamingContent(message)
    } else if (event.kind === 'content') {
      message.rawContent = (message.rawContent || '') + (event.text || '')
      applyStreamingContent(message)
    } else if (event.kind === 'tool_start') {
      if (!message.steps) message.steps = []
      message.steps.push({
        id: event.id || `${Date.now()}-${message.steps.length}`,
        name: event.name || t('工具'),
        arguments: event.arguments || '',
        status: 'running',
        get statusText() {
          return t('执行中')
        }
      })
    } else if (event.kind === 'tool_end') {
      const steps = message.steps || []
      let step = null
      for (let i = steps.length - 1; i >= 0; i -= 1) {
        if (steps[i].status === 'running' && (!event.id || steps[i].id === event.id)) {
          step = steps[i]
          break
        }
      }
      if (!step && event.denied) {
        if (!message.steps) message.steps = []
        message.steps.push({
          id: event.id || `${Date.now()}-${message.steps.length}`,
          name: event.name || t('工具'),
          arguments: '',
          status: 'denied',
          get statusText() {
            return t('已拒绝')
          }
        })
        step = message.steps[message.steps.length - 1]
      }
      if (step) {
        step.status = event.denied ? 'denied' : event.success ? 'success' : 'error'
        step.statusText = event.denied ? t('已拒绝') : event.success ? t('完成') : t('失败')
        step.duration = event.duration
        step.result = event.result || ''
        step.truncated = Boolean(event.truncated)
        step.resultId = event.resultId || ''
        step.untrusted = Boolean(event.untrusted)
        step.injectionSuspected = Boolean(event.injectionSuspected)
        step.metadata = event.metadata || null
      }
    } else if (event.kind === 'plan') {
      message.plan = event.plan || null
    } else if (event.kind === 'reflection') {
      if (!message.reflections) message.reflections = []
      message.reflections.push({
        name: event.name || '',
        status: event.status || 'warning',
        text: event.text || ''
      })
    } else if (event.kind === 'summary') {
      message.summary = event.summary || null
    } else if (event.kind === 'usage') {
      message.usage = event.usage || null
    } else if (event.kind === 'status') {
      if (!message.notices) message.notices = []
      message.notices.push(event.text)
    }
    if (!sessionId || currentSessionId.value === sessionId) scrollToBottom()
  }

  async function respondApproval(approval, decision) {
    if (!approval || approval.status !== 'pending') return
    approval.status = decision === 'deny' ? 'denied' : decision === 'allow_always' ? 'always' : 'allowed'
    if (decision === 'allow_always' && approval.key) {
      const session = sessions.value.find((item) =>
        (item.messages || []).some((message) => (message.approvals || []).includes(approval))
      )
      if (session) {
        const allowlist = new Set(Array.isArray(session.toolAllowlist) ? session.toolAllowlist : [])
        allowlist.add(approval.key)
        session.toolAllowlist = [...allowlist]
        saveSessions()
      }
    }
    const ok = await respondChatApproval(approval.approvalId, { decision })
    if (!ok) approval.status = 'expired'
  }

  function requestRollback(message) {
    if (!message?.runId) return
    rollbackTarget.value = message
  }

  function switchChatTab(tab) {
    chatTab.value = tab === 'traces' ? 'traces' : 'chat'
    if (chatTab.value === 'traces' && contextPanelOpen.value) toggleContextPanel()
  }

  function openRunTrace(message) {
    traceFocusId.value = message?.traceId || message?.runId || ''
    tracePanelKey.value += 1
    chatTab.value = 'traces'
  }

  async function confirmRollback() {
    const message = rollbackTarget.value
    rollbackTarget.value = null
    if (!message?.runId || rollbackBusy.value) return
    rollbackBusy.value = true
    try {
      const result = await rollbackChatRun(message.runId)
      if (result?.success) {
        message.rolledBack = true
        showSuccess(t('已撤销 {p0} 个文件的修改', { p0: result.restored || 0 }))
        saveSessions()
        if (currentSession.value?.workspace) refreshWorkspaceInfo()
      } else {
        showError(result?.error || t('撤销失败'))
      }
    } finally {
      rollbackBusy.value = false
    }
  }

  function attachStreamListeners(session, assistantMessage, requestId) {
    if (removeChunkListener) removeChunkListener()
    if (removeEndListener) removeEndListener()
    if (removeApprovalListener) removeApprovalListener()

    removeChunkListener = onChatStreamChunk((payload) => {
      if (!payload || payload.requestId !== requestId) return
      handleStreamChunk(assistantMessage, payload, session.id)
    })

    removeApprovalListener = onChatApprovalRequest((payload) => {
      if (!payload || payload.requestId !== requestId) return
      if (!assistantMessage.approvals) assistantMessage.approvals = []
      assistantMessage.approvals.push({
        approvalId: payload.approvalId,
        tool: payload.tool || t('工具'),
        risk: payload.risk || 'write',
        key: payload.key || '',
        summary: payload.summary || '',
        arguments: payload.arguments || {},
        preview: payload.preview || null,
        status: 'pending'
      })
      if (currentSessionId.value === session.id) scrollToBottom()
    })

    removeEndListener = onChatStreamEnd((result) => {
      if (!result || result.requestId !== requestId) return
      currentRequestId.value = ''
      loading.value = false
      assistantMessage.isStreaming = false
      session.unread = currentSessionId.value !== session.id
      finishMessageTiming(assistantMessage)
      finalizeContent(assistantMessage)
      if (removeApprovalListener) {
        removeApprovalListener()
        removeApprovalListener = null
      }
      for (const approval of assistantMessage.approvals || []) {
        if (approval.status === 'pending') approval.status = 'expired'
      }
      if (Array.isArray(result.fileChanges) && result.fileChanges.length) {
        assistantMessage.fileChanges = result.fileChanges
        assistantMessage.runId = requestId
      }
      assistantMessage.traceId = result.traceId || requestId

      if (result.plan && !assistantMessage.plan) assistantMessage.plan = result.plan
      if (Array.isArray(result.reflections) && result.reflections.length && !assistantMessage.reflections?.length) {
        assistantMessage.reflections = result.reflections
      }
      if (result.summary && !assistantMessage.summary) assistantMessage.summary = result.summary

      if (result.usage && Number(result.usage.calls) > 0) {
        assistantMessage.usage = result.usage
        mergeUsage(session, result.usage)
        const used = Number(result.usage.contextTokens) || Number(result.usage.prompt_tokens) || 0
        if (used > 0) {
          session.contextUsage = { tokens: used, window: result.contextWindow || contextWindowSize.value }
        }
      }

      if (result.cancelled) {
        assistantMessage.stopped = true
        if (!assistantMessage.notices) assistantMessage.notices = []
        assistantMessage.notices.push(t('已停止生成'))
      } else if (!result.success) {
        const prefix = assistantMessage.content ? `${assistantMessage.content}\n\n` : ''
        assistantMessage.content = t('{p0}错误: {p1}', { p0: prefix, p1: result.error })
      }

      session.updatedAt = Date.now()
      persistPendingStream(null)
      saveSessions()
      if (session.workspace) refreshWorkspaceInfo()
      refreshRunStats()
      if (currentSessionId.value === session.id) scrollToBottom()
    })
  }

  async function resumePendingStream() {
    if (!pendingStream.value) return
    const { requestId, sessionId } = pendingStream.value
    const session = sessions.value.find((s) => s.id === sessionId)
    const assistantMessage = session?.messages?.[session.messages.length - 1]
    if (!session || assistantMessage?.role !== 'assistant' || !assistantMessage.isStreaming) {
      persistPendingStream(null)
      return
    }

    if (typeof assistantMessage.rawContent !== 'string') assistantMessage.rawContent = assistantMessage.content || ''
    if (typeof assistantMessage.nativeThinking !== 'string') {
      assistantMessage.nativeThinking = assistantMessage.thinking || ''
    }

    currentRequestId.value = requestId
    if (currentSessionId.value === session.id) loading.value = true
    attachStreamListeners(session, assistantMessage, requestId)

    const active = await isChatStreamActive(requestId)
    if (active || currentRequestId.value !== requestId) return

    currentRequestId.value = ''
    loading.value = false
    markStreamInterrupted(assistantMessage)
    persistPendingStream(null)
    saveSessions()
    if (currentSessionId.value === session.id) scrollToBottom()
  }

  async function maybeCompressContext(session, assistantMessage, requestId) {
    const window = contextWindowSize.value
    const used = Number(session.contextUsage?.tokens) || 0
    const keepRecent = compressKeepRecent.value
    if (!used || used < window * compressThreshold.value) return

    const history = session.messages.slice(0, -1)
    const upToIndex = Number(session.context?.upToIndex) || 0
    if (history.length - upToIndex <= keepRecent + 2) return

    assistantMessage.contextNote = t('上下文较长，正在压缩历史…')
    if (currentSessionId.value === session.id) scrollToBottom()

    try {
      const result = await compressChatContext(history.slice(upToIndex).map(toApiMessage), {
        provider: session.provider || selectedProvider.value,
        model: session.model || selectedModel.value,
        contextSummary: session.context?.summary || '',
        keepRecent
      })

      if (currentRequestId.value !== requestId) return

      if (result?.success) {
        session.context = {
          summary: result.summary,
          upToIndex: history.length - result.keptCount,
          beforeTokens: result.beforeTokens,
          afterTokens: result.afterTokens,
          compressedAt: Date.now()
        }
        session.contextUsage = { tokens: result.afterTokens, window }
        if (result.usage) mergeUsage(session, { ...result.usage, calls: 1 })
        assistantMessage.contextNote = t('上下文已压缩：{p0} → {p1} tokens（保留最近 {p2} 条消息）', {
          p0: formatTokens(result.beforeTokens),
          p1: formatTokens(result.afterTokens),
          p2: result.keptCount
        })
        saveSessions()
      } else {
        assistantMessage.contextNote = t('上下文压缩失败：{p0}，本轮继续使用完整历史', {
          p0: result?.error || t('未知错误')
        })
      }
    } catch (error) {
      if (currentRequestId.value === requestId) {
        assistantMessage.contextNote = t('上下文压缩失败：{p0}，本轮继续使用完整历史', { p0: error.message })
      }
    }
    if (currentSessionId.value === session.id) scrollToBottom()
  }

  async function sendMessage(e) {
    if (e && (e.shiftKey || e.isComposing)) return
    const text = inputText.value.trim()
    const files = attachments.value.slice()
    if ((!text && files.length === 0) || loading.value) return
    if (!hasCurrentApiKey.value) {
      showError(t('请先在设置中配置 {p0} API Key', { p0: currentProvider.value?.name || t('当前服务商') }))
      return
    }
    if (!currentSessionId.value) createNewChat()

    const session = sessions.value.find((s) => s.id === currentSessionId.value)
    if (!session) return

    inputText.value = ''
    attachments.value = []
    clearDraft(session.id)
    await nextTick()
    resizeInput()

    session.provider = selectedProvider.value
    session.model = selectedModel.value
    session.unread = false
    session.messages.push({ role: 'user', content: text, attachments: files })
    session.updatedAt = Date.now()
    updateSessionTitle(currentSessionId.value, text || files[0]?.name || t('附件消息'))
    saveSessions()

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    currentRequestId.value = requestId
    loading.value = true
    scrollToBottom()

    session.messages.push({ role: 'assistant', content: '', thinking: '', steps: [], notices: [] })
    const assistantMessage = session.messages[session.messages.length - 1]
    assistantMessage.isStreaming = true
    assistantMessage.startedAt = Date.now()

    persistPendingStream({ requestId, sessionId: session.id })
    attachStreamListeners(session, assistantMessage, requestId)

    try {
      await maybeCompressContext(session, assistantMessage, requestId)
      if (currentRequestId.value !== requestId) {
        assistantMessage.isStreaming = false
        assistantMessage.stopped = true
        finishMessageTiming(assistantMessage)
        delete assistantMessage.contextNote
        finalizeContent(assistantMessage)
        persistPendingStream(null)
        saveSessions()
        return
      }

      const history = session.messages.slice(0, -1)
      const startIndex = Math.min(Number(session.context?.upToIndex) || 0, history.length)
      const chatMessages = history.slice(startIndex).map(toApiMessage)
      const thinking =
        modelSupportsThinking.value && thinkingMode.value !== 'auto' ? thinkingMode.value === 'on' : undefined
      await chatStream(chatMessages, {
        provider: selectedProvider.value,
        model: selectedModel.value,
        requestId,
        conversationId: session.id,
        toolsEnabled: approvalMode.value !== 'chat',
        approvalPolicy: approvalMode.value === 'chat' ? 'auto' : approvalMode.value,
        allowedTools: Array.isArray(session.toolAllowlist) ? session.toolAllowlist : [],
        thinking,
        workspacePath: session.workspace || '',
        contextSummary: session.context?.summary || ''
      })
    } catch (error) {
      currentRequestId.value = ''
      loading.value = false
      assistantMessage.isStreaming = false
      session.unread = currentSessionId.value !== session.id
      finishMessageTiming(assistantMessage)
      assistantMessage.content = t('请求失败: {p0}', { p0: error.message })
      persistPendingStream(null)
      saveSessions()
      scrollToBottom()
    }
  }

  async function stopResponse() {
    if (!currentRequestId.value) return
    const stopped = await cancelChatStream(currentRequestId.value)
    if (!stopped) {
      loading.value = false
      currentRequestId.value = ''
      persistPendingStream(null)
    }
  }

  onUnmounted(() => {
    if (removeChunkListener) removeChunkListener()
    if (removeEndListener) removeEndListener()
    if (removeApprovalListener) removeApprovalListener()
  })

  return {
    loading,
    chatTab,
    traceFocusId,
    tracePanelKey,
    rollbackTarget,
    rollbackBusy,
    currentRequestId,
    respondApproval,
    requestRollback,
    switchChatTab,
    openRunTrace,
    confirmRollback,
    resumePendingStream,
    sendMessage,
    stopResponse
  }
}
