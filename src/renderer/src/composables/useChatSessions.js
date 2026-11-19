import { t } from '@/i18n'

import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { finalizeContent, normalizeLegacyThinking } from '@/utils/chatContent'

const VIEW_STATE_KEY = 'chat_view_state'
const PENDING_STREAM_KEY = 'chat_pending_stream'
const DRAFT_SAVE_DELAY = 300
const SCROLL_SAVE_DELAY = 250
const SESSIONS_KEY = 'chat_sessions'

function emptyViewState() {
  return {
    activeSessionId: '',
    drafts: {},
    scrolls: {},
    contextOpen: true,
    sidebarCollapsed: false,
    showArchived: false,
    collapsedGroups: {},
    lastWorkspace: ''
  }
}

export function useChatSessions({
  inputText,
  messagesContainer,
  atBottom,
  selectedProvider,
  selectedModel,
  applyProviderModels,
  resizeInput,
  openMemoryPage,
  copyToClipboard,
  openWorkspacePath,
  showSuccess,
  showError
}) {
  const sessions = ref([])
  const currentSessionId = ref('')
  const sessionSearch = ref('')
  const sessionSearchOpen = ref(false)
  const sessionSearchInput = ref(null)
  const workspaceSectionOpen = ref(true)
  const showArchived = ref(false)
  const sessionMenu = ref(null)
  const deleteTarget = ref(null)
  const railMoreOpen = ref(false)
  const collapsedGroups = ref({})
  const chatSidebarCollapsed = ref(false)
  const contextPanelOpen = ref(true)
  const editingSessionId = ref('')
  const editingTitle = ref('')
  const pendingStream = ref(null)
  const suppressAutoScroll = ref(false)

  const viewState = ref(emptyViewState())
  let draftTimer = null
  let scrollTimer = null

  const currentSession = computed(() => sessions.value.find((s) => s.id === currentSessionId.value))
  const menuSession = computed(() => sessions.value.find((s) => s.id === sessionMenu.value?.id) || null)

  function loadViewState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(VIEW_STATE_KEY))
      if (parsed && typeof parsed === 'object') {
        viewState.value = {
          activeSessionId: typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : '',
          drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
          scrolls: parsed.scrolls && typeof parsed.scrolls === 'object' ? parsed.scrolls : {},
          contextOpen: parsed.contextOpen !== false,
          sidebarCollapsed: parsed.sidebarCollapsed === true,
          showArchived: parsed.showArchived === true,
          collapsedGroups:
            parsed.collapsedGroups && typeof parsed.collapsedGroups === 'object' ? parsed.collapsedGroups : {},
          lastWorkspace: typeof parsed.lastWorkspace === 'string' ? parsed.lastWorkspace : ''
        }
      }
    } catch {
      viewState.value = emptyViewState()
    }
    contextPanelOpen.value = viewState.value.contextOpen !== false
    chatSidebarCollapsed.value = viewState.value.sidebarCollapsed === true
    showArchived.value = viewState.value.showArchived === true
    collapsedGroups.value = { ...viewState.value.collapsedGroups }
  }

  function persistViewState() {
    try {
      viewState.value.contextOpen = contextPanelOpen.value
      viewState.value.sidebarCollapsed = chatSidebarCollapsed.value
      viewState.value.showArchived = showArchived.value
      viewState.value.collapsedGroups = { ...collapsedGroups.value }
      const workspace = currentSession.value?.workspace
      if (typeof workspace === 'string' && workspace) viewState.value.lastWorkspace = workspace
      localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState.value))
    } catch {
      // 本地存储不可用时仅保留当前会话内的状态
    }
  }

  function saveDraft() {
    const id = currentSessionId.value
    if (!id) return
    const text = inputText.value
    if (text) viewState.value.drafts[id] = text
    else delete viewState.value.drafts[id]
    persistViewState()
  }

  function scheduleDraftSave() {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      draftTimer = null
      saveDraft()
    }, DRAFT_SAVE_DELAY)
  }

  function applyDraft(id) {
    inputText.value = (id && viewState.value.drafts[id]) || ''
    nextTick(resizeInput)
  }

  function saveScroll() {
    const container = messagesContainer.value
    const id = currentSessionId.value
    if (!container || !id) return
    if (atBottom.value) delete viewState.value.scrolls[id]
    else viewState.value.scrolls[id] = Math.round(container.scrollTop)
    persistViewState()
  }

  function scheduleScrollSave() {
    if (scrollTimer) clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      scrollTimer = null
      saveScroll()
    }, SCROLL_SAVE_DELAY)
  }

  function restoreScroll() {
    nextTick(() => {
      const container = messagesContainer.value
      if (!container) return
      const saved = viewState.value.scrolls[currentSessionId.value]
      if (typeof saved === 'number') {
        container.scrollTop = Math.min(saved, container.scrollHeight)
        atBottom.value = container.scrollHeight - container.scrollTop - container.clientHeight < 32
      } else {
        container.scrollTop = container.scrollHeight
        atBottom.value = true
      }
    })
  }

  function loadPendingStream() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PENDING_STREAM_KEY))
      if (parsed && typeof parsed.requestId === 'string' && typeof parsed.sessionId === 'string') {
        pendingStream.value = parsed
      }
    } catch {
      pendingStream.value = null
    }
  }

  function persistPendingStream(value) {
    pendingStream.value = value
    try {
      if (value) localStorage.setItem(PENDING_STREAM_KEY, JSON.stringify(value))
      else localStorage.removeItem(PENDING_STREAM_KEY)
    } catch {
      // 本地存储不可用时只影响跨页面恢复
    }
  }

  function loadSessions() {
    try {
      const saved = localStorage.getItem(SESSIONS_KEY)
      if (saved) {
        sessions.value = JSON.parse(saved)
        for (const session of sessions.value) {
          if (typeof session.workspace !== 'string') session.workspace = ''
          for (const message of session.messages || []) normalizeLegacyThinking(message)
        }
      }
    } catch {
      sessions.value = []
    }
    const savedId = viewState.value.activeSessionId
    const active = sessions.value.find((session) => session.id === savedId) || sessions.value[0]
    currentSessionId.value = active?.id || ''
    viewState.value.activeSessionId = currentSessionId.value
  }

  function saveSessions() {
    try {
      localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.value))
    } catch {
      showError(t('会话保存失败：附件体积过大，请删除部分图片后重试'))
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2)
  }

  function collapseChatSidebar() {
    chatSidebarCollapsed.value = true
    persistViewState()
  }

  function expandChatSidebar() {
    chatSidebarCollapsed.value = false
    persistViewState()
  }

  function toggleSessionSearch() {
    sessionSearchOpen.value = !sessionSearchOpen.value
    if (sessionSearchOpen.value) nextTick(() => sessionSearchInput.value?.focus())
  }

  function isGroupOpen(key) {
    return collapsedGroups.value[key] !== true
  }

  function toggleGroup(key) {
    collapsedGroups.value = { ...collapsedGroups.value, [key]: isGroupOpen(key) }
  }

  function openGroupForSession(id) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session) return
    const key = session.workspace || '__none__'
    if (collapsedGroups.value[key]) {
      collapsedGroups.value = { ...collapsedGroups.value, [key]: false }
    }
  }

  function toggleSessionMenu(id, event) {
    event.stopPropagation()
    if (sessionMenu.value?.id === id) {
      sessionMenu.value = null
      return
    }
    const rect = event.currentTarget.getBoundingClientRect()
    const menuWidth = 190
    const menuHeight = 300
    const x = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8))
    const y =
      rect.bottom + menuHeight + 8 <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - menuHeight - 4)
    sessionMenu.value = { id, x, y }
  }

  function handleSessionAction(action) {
    const id = sessionMenu.value?.id
    if (!id) return
    sessionMenu.value = null
    if (action === 'pin') togglePinSession(id)
    else if (action === 'rename') {
      startEditTitle(id, sessions.value.find((session) => session.id === id)?.title)
    } else if (action === 'fork') forkSession(id)
    else if (action === 'copyId') copySessionId(id)
    else if (action === 'reveal') revealSessionWorkspace(id)
    else if (action === 'archive') toggleArchiveSession(id)
    else if (action === 'delete') requestDeleteSession(id)
  }

  function togglePinSession(id) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session) return
    session.pinned = !session.pinned
    saveSessions()
    showSuccess(t(session.pinned ? '会话已置顶' : '已取消置顶'))
  }

  function forkSession(id) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session) return
    saveDraft()
    saveScroll()
    const messages = JSON.parse(JSON.stringify(session.messages || []))
    for (const message of messages) message.isStreaming = false
    const fork = {
      id: generateId(),
      title: t('{p0} · 分叉', { p0: session.title || t('新会话') }),
      messages,
      workspace: session.workspace || '',
      provider: session.provider || '',
      model: session.model || '',
      forkedFrom: session.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    if (session.usage) fork.usage = JSON.parse(JSON.stringify(session.usage))
    if (session.contextUsage) fork.contextUsage = { ...session.contextUsage }
    if (session.context) fork.context = { ...session.context }
    const index = sessions.value.findIndex((item) => item.id === id)
    sessions.value.splice(index + 1, 0, fork)
    saveSessions()
    selectSession(fork.id)
    showSuccess(t('已创建分叉会话'))
  }

  async function copySessionId(id) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session) return
    const ok = await copyToClipboard(session.id)
    if (ok) showSuccess(t('已复制 Session ID'))
    else showError(t('复制失败'))
  }

  async function revealSessionWorkspace(id) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session?.workspace) {
      showError(t('当前会话没有关联工作区'))
      return
    }
    const result = await openWorkspacePath(session.workspace, session.workspace)
    if (result && result.success === false) showError(result.error || t('无法打开工作区文件夹'))
  }

  function toggleArchiveSession(id) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session) return
    const archiving = !session.archived
    session.archived = archiving
    session.updatedAt = Date.now()
    if (archiving && currentSessionId.value === id) {
      const next = sessions.value.find((item) => item.id !== id && !item.archived)
      if (next) selectSession(next.id)
      else {
        viewState.value.activeSessionId = ''
        currentSessionId.value = ''
        applyDraft('')
        persistViewState()
      }
    }
    saveSessions()
    showSuccess(t(archiving ? '会话已归档' : '已取消归档'))
  }

  function onRailMore(action) {
    railMoreOpen.value = false
    if (action === 'memory') openMemoryPage()
    else if (action === 'archived') showArchived.value = !showArchived.value
  }

  function finishMessageTiming(message) {
    if (!message?.startedAt) return
    message.duration = Math.max(1, Date.now() - message.startedAt)
    delete message.startedAt
  }

  function markStreamInterrupted(message) {
    message.isStreaming = false
    finishMessageTiming(message)
    finalizeContent(message)
    message.stopped = true
    if (!message.notices) message.notices = []
    if (!message.notices.includes(t('生成已中断'))) message.notices.push(t('生成已中断'))
  }

  function recoverStreamState() {
    loadPendingStream()
    let changed = false
    for (const session of sessions.value) {
      const streamingMessages = (session.messages || []).filter((message) => message.isStreaming)
      if (streamingMessages.length === 0) continue
      const resumable = pendingStream.value && pendingStream.value.sessionId === session.id
      if (resumable) continue
      for (const message of streamingMessages) markStreamInterrupted(message)
      changed = true
    }
    if (changed) saveSessions()
  }

  function createNewChat(workspace = '') {
    saveDraft()
    saveScroll()
    const newSession = {
      id: generateId(),
      get title() {
        return t('新会话')
      },
      messages: [],
      workspace: typeof workspace === 'string' ? workspace : '',
      provider: selectedProvider.value,
      model: selectedModel.value,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    sessions.value.unshift(newSession)
    delete viewState.value.scrolls[newSession.id]
    delete viewState.value.drafts[newSession.id]
    viewState.value.activeSessionId = newSession.id
    currentSessionId.value = newSession.id
    applyDraft(newSession.id)
    saveSessions()
  }

  function selectSession(id) {
    if (id === currentSessionId.value) return
    saveDraft()
    saveScroll()
    viewState.value.activeSessionId = id
    persistViewState()
    suppressAutoScroll.value = true
    currentSessionId.value = id
    applyDraft(id)
    const session = sessions.value.find((s) => s.id === id)
    if (session) {
      const providerType = session.provider || selectedProvider.value
      if (providerType) {
        selectedProvider.value = providerType
      }
      if (selectedProvider.value) {
        applyProviderModels(selectedProvider.value, session.model || '')
      }
    }
    nextTick(() => {
      restoreScroll()
      suppressAutoScroll.value = false
    })
  }

  function requestDeleteSession(id) {
    const session = sessions.value.find((item) => item.id === id)
    if (!session) return
    deleteTarget.value = { id: session.id, title: session.title || t('新会话') }
  }

  function confirmDeleteSession() {
    const target = deleteTarget.value
    deleteTarget.value = null
    if (target) deleteSession(target.id)
  }

  function deleteSession(id) {
    const index = sessions.value.findIndex((s) => s.id === id)
    if (index === -1) return
    saveDraft()
    saveScroll()
    sessions.value.splice(index, 1)
    delete viewState.value.drafts[id]
    delete viewState.value.scrolls[id]
    if (currentSessionId.value === id) {
      const nextSession = sessions.value.find((session) => !session.archived) || sessions.value[0]
      viewState.value.activeSessionId = nextSession?.id || ''
      suppressAutoScroll.value = true
      currentSessionId.value = nextSession?.id || ''
      applyDraft(viewState.value.activeSessionId)
      nextTick(() => {
        restoreScroll()
        suppressAutoScroll.value = false
      })
    } else if (currentSessionId.value) {
      viewState.value.activeSessionId = currentSessionId.value
    }
    persistViewState()
    saveSessions()
  }

  function startEditTitle(id, title) {
    editingSessionId.value = id
    editingTitle.value = title || t('新会话')
    nextTick(() => {
      const input = document.querySelector('.session-edit-input')
      if (input) {
        input.focus()
        input.select()
      }
    })
  }

  function saveEditTitle(id, e) {
    if (e && e.isComposing) return
    if (editingSessionId.value !== id) return
    const session = sessions.value.find((s) => s.id === id)
    if (session && editingTitle.value.trim()) {
      session.title = editingTitle.value.trim()
      session.updatedAt = Date.now()
      saveSessions()
    }
    editingSessionId.value = ''
    editingTitle.value = ''
  }

  function cancelEditTitle() {
    editingSessionId.value = ''
    editingTitle.value = ''
  }

  function clearDraft(id) {
    delete viewState.value.drafts[id]
    persistViewState()
  }

  watch(showArchived, persistViewState)
  watch(collapsedGroups, persistViewState, { deep: true })

  onUnmounted(() => {
    if (draftTimer) clearTimeout(draftTimer)
    if (scrollTimer) clearTimeout(scrollTimer)
  })

  return {
    sessions,
    currentSessionId,
    currentSession,
    sessionSearch,
    sessionSearchOpen,
    sessionSearchInput,
    workspaceSectionOpen,
    showArchived,
    sessionMenu,
    menuSession,
    deleteTarget,
    railMoreOpen,
    collapsedGroups,
    chatSidebarCollapsed,
    contextPanelOpen,
    editingSessionId,
    editingTitle,
    pendingStream,
    suppressAutoScroll,
    viewState,
    loadViewState,
    persistViewState,
    loadSessions,
    saveSessions,
    loadPendingStream,
    persistPendingStream,
    saveDraft,
    scheduleDraftSave,
    applyDraft,
    saveScroll,
    scheduleScrollSave,
    restoreScroll,
    generateId,
    collapseChatSidebar,
    expandChatSidebar,
    toggleSessionSearch,
    isGroupOpen,
    toggleGroup,
    openGroupForSession,
    toggleSessionMenu,
    handleSessionAction,
    togglePinSession,
    forkSession,
    copySessionId,
    revealSessionWorkspace,
    toggleArchiveSession,
    onRailMore,
    markStreamInterrupted,
    finishMessageTiming,
    recoverStreamState,
    createNewChat,
    selectSession,
    requestDeleteSession,
    confirmDeleteSession,
    deleteSession,
    startEditTitle,
    saveEditTitle,
    cancelEditTitle,
    clearDraft
  }
}
