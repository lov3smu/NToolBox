import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useChatSessions } from '@/composables/useChatSessions'
import { useChatStream } from '@/composables/useChatStream'

const api = vi.hoisted(() => ({
  chatStream: vi.fn(),
  chatSaveSession: vi.fn(),
  chatLoadSessions: vi.fn(),
  chatImportSessions: vi.fn(),
  chatDeleteSession: vi.fn(),
  cancelChatStream: vi.fn(),
  compressChatContext: vi.fn(),
  isChatStreamActive: vi.fn(),
  respondChatApproval: vi.fn(),
  rollbackChatRun: vi.fn(),
  onChatStreamChunk: vi.fn(),
  onChatStreamEnd: vi.fn(),
  onChatApprovalRequest: vi.fn()
}))

vi.mock('@/i18n', () => ({ t: (key) => key }))

vi.mock('@/api', () => api)

function createChatSession() {
  const inputText = ref('')
  const selectedProvider = ref('bailian')
  const selectedModel = ref('qwen-max')
  const session = useChatSessions({
    inputText,
    messagesContainer: ref(null),
    atBottom: ref(true),
    selectedProvider,
    selectedModel,
    applyProviderModels: vi.fn(),
    resizeInput: vi.fn(),
    openMemoryPage: vi.fn(),
    copyToClipboard: vi.fn(async () => true),
    openWorkspacePath: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn()
  })
  const stream = useChatStream({
    sessions: session.sessions,
    currentSessionId: session.currentSessionId,
    currentSession: session.currentSession,
    inputText,
    attachments: ref([]),
    hasCurrentApiKey: ref(true),
    currentProvider: ref({ name: '百炼' }),
    selectedProvider,
    selectedModel,
    modelSupportsThinking: ref(false),
    thinkingMode: ref('auto'),
    approvalMode: ref('auto'),
    compressThreshold: ref(0.7),
    compressKeepRecent: ref(6),
    contextPanelOpen: session.contextPanelOpen,
    contextWindowSize: ref(1000000),
    pendingStream: session.pendingStream,
    persistPendingStream: session.persistPendingStream,
    saveSessions: session.saveSessions,
    markStreamInterrupted: session.markStreamInterrupted,
    clearDraft: session.clearDraft,
    createNewChat: session.createNewChat,
    finishMessageTiming: session.finishMessageTiming,
    scrollToBottom: vi.fn(),
    refreshWorkspaceInfo: vi.fn(),
    refreshRunStats: vi.fn(),
    resizeInput: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    toggleContextPanel: vi.fn()
  })
  return { inputText, session, stream }
}

describe('chat send flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const store = new Map()
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    }
    api.chatStream.mockResolvedValue({ success: true })
    api.chatSaveSession.mockResolvedValue(true)
    api.chatImportSessions.mockResolvedValue({ imported: 0 })
    api.chatLoadSessions.mockResolvedValue([])
    api.chatDeleteSession.mockResolvedValue(true)
    api.isChatStreamActive.mockResolvedValue(true)
    api.compressChatContext.mockResolvedValue({ success: false })
    api.onChatStreamChunk.mockReturnValue(vi.fn())
    api.onChatStreamEnd.mockReturnValue(vi.fn())
    api.onChatApprovalRequest.mockReturnValue(vi.fn())
  })

  it('sends the first message of a new session and streams a reply', async () => {
    const { inputText, session, stream } = createChatSession()
    session.createNewChat()
    inputText.value = '帮我介绍一下这个项目'

    await stream.sendMessage()

    expect(api.chatStream).toHaveBeenCalledTimes(1)
    const [messages, options] = api.chatStream.mock.calls[0]
    expect(messages).toEqual([{ role: 'user', content: '帮我介绍一下这个项目' }])
    expect(options.requestId).toBe(stream.currentRequestId.value)

    const current = session.currentSession.value
    expect(current.title).toBe('帮我介绍一下这个项目')
    expect(current.messages).toHaveLength(2)
    expect(current.messages[1]).toMatchObject({ role: 'assistant', isStreaming: true })
    expect(stream.loading.value).toBe(true)
  })

  it('updates tool steps from stream events without breaking on getters', async () => {
    const { inputText, session, stream } = createChatSession()
    session.createNewChat()
    inputText.value = '列出当前目录'
    await stream.sendMessage()

    const chunkListener = api.onChatStreamChunk.mock.calls.at(-1)[0]
    const requestId = stream.currentRequestId.value
    chunkListener({ requestId, kind: 'tool_start', id: 'call-1', name: 'file-ops', arguments: '{}' })
    chunkListener({ requestId, kind: 'tool_end', id: 'call-1', name: 'file-ops', success: true, result: 'ok' })

    const assistant = session.currentSession.value.messages.at(-1)
    expect(assistant.steps).toHaveLength(1)
    expect(assistant.steps[0]).toMatchObject({ status: 'success', statusText: '完成', result: 'ok' })
  })
})
