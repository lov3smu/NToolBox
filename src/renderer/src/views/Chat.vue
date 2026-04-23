<template>
  <div class="chat-page">
    <div
      v-if="!apiKey"
      class="api-key-warning"
    >
      <svg
        viewBox="0 0 24 24"
        width="48"
        height="48"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <rect
          x="3"
          y="11"
          width="18"
          height="11"
          rx="2"
          ry="2"
        />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <p>请先在设置中配置 API Key</p>
      <button
        class="btn btn-primary"
        @click="openSettings('api')"
      >
        打开设置
      </button>
    </div>
    <div
      v-else
      class="chat-layout"
    >
      <aside class="sidebar">
        <div class="sidebar-header">
          <button
            class="new-chat-btn"
            @click="createNewChat"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line
                x1="12"
                y1="5"
                x2="12"
                y2="19"
              /><line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
              />
            </svg>
            新建会话
          </button>
        </div>
        <div class="session-list">
          <div
            v-for="session in sessions"
            :key="session.id"
            :class="['session-item', { active: currentSessionId === session.id }]"
            @click="selectSession(session.id)"
          >
            <div class="session-info">
              <div
                v-if="editingSessionId !== session.id"
                class="session-title"
              >
                {{ session.title || '新会话' }}
              </div>
              <input
                v-else
                v-model="editingTitle"
                class="session-edit-input"
                @keydown.enter="saveEditTitle(session.id)"
                @keydown.escape="cancelEditTitle"
                @blur="saveEditTitle(session.id)"
              >
              <div class="session-time">
                {{ formatTime(session.updatedAt) }}
              </div>
            </div>
            <div class="session-actions">
              <button
                class="session-edit"
                title="重命名"
                @click.stop="startEditTitle(session.id, session.title)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                class="session-delete"
                title="删除"
                @click.stop="deleteSession(session.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>
          <div
            v-if="sessions.length === 0"
            class="session-empty"
          >
            <p>暂无会话</p>
            <p class="hint">
              点击上方按钮创建新会话
            </p>
          </div>
        </div>
      </aside>
      <main class="chat-main">
        <div class="chat-header">
          <h2>{{ currentSession?.title || '新会话' }}</h2>
          <div class="model-selector">
            <label>模型：</label>
            <select
              v-model="selectedModel"
              class="model-select"
            >
              <option
                v-for="model in models"
                :key="model.id"
                :value="model.id"
              >
                {{ model.name }}
              </option>
            </select>
          </div>
        </div>
        <div
          ref="messagesContainer"
          class="messages-container"
        >
          <div
            v-if="currentMessages.length === 0"
            class="messages-empty"
          >
            <svg
              viewBox="0 0 24 24"
              width="64"
              height="64"
              fill="none"
              stroke="currentColor"
              stroke-width="1"
            >
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
              <path d="M12 11v4M12 7h.01" />
            </svg>
            <p>开始与 AI 聊天吧</p>
            <p class="hint">
              支持编程问题、代码解释、SQL 查询等
            </p>
          </div>
          <div
            v-for="(msg, index) in currentMessages"
            :key="index"
            class="message"
            :class="msg.role"
          >
            <div class="message-avatar">
              <span v-if="msg.role === 'user'">你</span>
              <span v-else>AI</span>
            </div>
            <div class="message-content">
              <div
                class="message-text"
                v-html="formatMessage(msg.content)"
              />
              <button
                v-if="msg.role === 'assistant'"
                class="copy-btn"
                title="复制"
                @click="copyMessage(msg.content)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect
                    x="9"
                    y="9"
                    width="13"
                    height="13"
                    rx="2"
                    ry="2"
                  />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
          <div
            v-if="loading"
            class="message assistant"
          >
            <div class="message-avatar">
              <span>AI</span>
            </div>
            <div class="message-content">
              <div class="loading-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        </div>
        <div class="input-area">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="chat-input"
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            :disabled="loading"
            @keydown.enter.exact="sendMessage"
          />
          <button
            class="btn btn-primary send-btn"
            :disabled="loading || !inputText.trim()"
            @click="sendMessage"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <line
                x1="22"
                y1="2"
                x2="11"
                y2="13"
              />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            发送
          </button>
        </div>
      </main>
    </div>
    <div
      class="toast"
      :class="{ show: toastVisible }"
    >
      <span class="toast-icon">✓</span>
      <span class="toast-message">{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { getConfig, chat, openSettings, onConfigChanged, getProviderModels } from '@/api'

const apiKey = ref('')
const aiProvider = ref('bailian')
const sessions = ref([])
const currentSessionId = ref('')
const inputText = ref('')
const loading = ref(false)
const messagesContainer = ref(null)
const toastVisible = ref(false)
const toastMessage = ref('')
const selectedModel = ref('')
const editingSessionId = ref('')
const editingTitle = ref('')
const models = ref([])

const currentSession = computed(() => sessions.value.find(s => s.id === currentSessionId.value))
const currentMessages = computed(() => currentSession?.value?.messages || [])

async function loadApiKey() {
  const config = await getConfig()
  const provider = config.ai_provider || 'bailian'
  const apiKeys = config.ai_api_keys || {}
  apiKey.value = apiKeys[provider] || ''
  aiProvider.value = provider
  
  if (apiKey.value) {
    const providerModels = await getProviderModels(provider)
    models.value = providerModels || []
    if (models.value.length > 0) {
      selectedModel.value = models.value[0].id
    }
  }
}

function loadSessions() {
  try {
    const saved = localStorage.getItem('chat_sessions')
    if (saved) {
      sessions.value = JSON.parse(saved)
      if (sessions.value.length > 0) {
        currentSessionId.value = sessions.value[0].id
      }
    }
  } catch (e) {
    sessions.value = []
  }
}

function saveSessions() {
  localStorage.setItem('chat_sessions', JSON.stringify(sessions.value))
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function createNewChat() {
  const newSession = {
    id: generateId(),
    title: '新会话',
    messages: [],
    model: selectedModel.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  sessions.value.unshift(newSession)
  currentSessionId.value = newSession.id
  saveSessions()
}

function selectSession(id) {
  currentSessionId.value = id
  const session = sessions.value.find(s => s.id === id)
  if (session?.model) {
    selectedModel.value = session.model
  }
}

function deleteSession(id) {
  const index = sessions.value.findIndex(s => s.id === id)
  if (index !== -1) {
    sessions.value.splice(index, 1)
    if (currentSessionId.value === id) {
      currentSessionId.value = sessions.value[0]?.id || ''
    }
    saveSessions()
  }
}

function startEditTitle(id, title) {
  editingSessionId.value = id
  editingTitle.value = title || '新会话'
  nextTick(() => {
    const input = document.querySelector('.session-edit-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function saveEditTitle(id) {
  if (editingSessionId.value !== id) return
  const session = sessions.value.find(s => s.id === id)
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

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return date.toLocaleDateString()
}

function updateSessionTitle(sessionId, firstMessage) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session && session.title === '新会话' && firstMessage) {
    session.title = firstMessage.slice(0, 20) + (firstMessage.length > 20 ? '...' : '')
  }
}

async function sendMessage(e) {
  if (e && e.shiftKey) return
  if (!inputText.value.trim() || loading.value) return
  if (!currentSessionId.value) createNewChat()
  
  const userMessage = inputText.value.trim()
  inputText.value = ''
  
  const session = sessions.value.find(s => s.id === currentSessionId.value)
  if (!session) return
  
  session.messages.push({ role: 'user', content: userMessage })
  session.updatedAt = Date.now()
  updateSessionTitle(currentSessionId.value, userMessage)
  saveSessions()
  
  loading.value = true
  scrollToBottom()
  
  try {
    const chatMessages = session.messages.map(m => ({ role: m.role, content: m.content }))
    const result = await chat(chatMessages, { model: selectedModel.value })
    
    if (result.success) {
      session.messages.push({ role: 'assistant', content: result.content })
      session.model = selectedModel.value
      session.updatedAt = Date.now()
      saveSessions()
    } else {
      session.messages.push({ role: 'assistant', content: `错误: ${result.error}` })
      saveSessions()
    }
  } catch (e) {
    session.messages.push({ role: 'assistant', content: `请求失败: ${e.message}` })
    saveSessions()
  }
  
  loading.value = false
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function formatMessage(content) {
  if (!content) return ''
  const formatted = content
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="code-block"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\n/g, '<br>')
  return formatted
}

function copyMessage(content) {
  navigator.clipboard.writeText(content).then(() => {
    showToast('已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    showToast('已复制到剪贴板')
  })
}

function showToast(msg) {
  toastMessage.value = msg
  toastVisible.value = true
  setTimeout(() => {
    toastVisible.value = false
  }, 2000)
}

let removeConfigListener = null

onMounted(async () => {
  await loadApiKey()
  loadSessions()
  removeConfigListener = onConfigChanged(async () => {
    await loadApiKey()
  })
})

onUnmounted(() => {
  if (removeConfigListener) {
    removeConfigListener()
  }
})

watch(currentMessages, () => {
  scrollToBottom()
}, { deep: true })
</script>

<style scoped>
.chat-page {
  height: 100vh;
  width: 100vw;
  display: flex;
  background: var(--glass-bg);
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}

.api-key-warning {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  color: var(--text-tertiary);
}

.api-key-warning svg {
  color: var(--text-tertiary);
  margin-bottom: 20px;
  opacity: 0.6;
}

.api-key-warning p {
  font-size: 15px;
  margin-bottom: 20px;
}

.chat-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  background: rgba(248, 249, 250, 0.95);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.new-chat-btn {
  width: 100%;
  padding: 12px 16px;
  background: var(--primary-gradient);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.new-chat-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.session-item {
  padding: 12px;
  margin-bottom: 4px;
  border-radius: var(--radius-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
  position: relative;
}

.session-item:hover {
  background: rgba(102, 126, 234, 0.08);
}

.session-item.active {
  background: rgba(102, 126, 234, 0.12);
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-edit-input {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--primary-color);
  border-radius: var(--radius-sm);
  background: white;
  outline: none;
}

.session-time {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.session-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.session-item:hover .session-actions {
  opacity: 1;
}

.session-edit,
.session-delete {
  padding: 6px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.2s;
}

.session-edit:hover {
  background: rgba(102, 126, 234, 0.1);
  color: var(--primary-color);
}

.session-delete:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.session-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
}

.session-empty p {
  font-size: 14px;
  margin-bottom: 8px;
}

.session-empty .hint {
  font-size: 12px;
  opacity: 0.7;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.4);
}

.chat-header {
  padding: 16px 20px 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 16px;
}

.chat-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.model-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  white-space: nowrap;
  margin-right: 20px;
}

.model-selector label {
  font-size: 14px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.model-select {
  padding: 8px 36px 8px 12px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 13px;
  background: var(--glass-bg);
  color: var(--text-primary);
  cursor: pointer;
  width: 200px;
  flex-shrink: 0;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23667e8a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
}

.model-select:focus {
  outline: none;
  border-color: var(--primary-color);
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.messages-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  text-align: center;
  padding: 40px;
}

.messages-empty svg {
  opacity: 0.4;
  margin-bottom: 16px;
}

.messages-empty p {
  font-size: 16px;
  margin-bottom: 8px;
}

.messages-empty .hint {
  font-size: 13px;
  opacity: 0.7;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 85%;
}

.message.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: var(--primary-gradient);
  color: white;
}

.message.assistant .message-avatar {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.message-content {
  flex: 1;
  position: relative;
}

.message-text {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
  word-wrap: break-word;
}

.message.user .message-text {
  background: var(--primary-gradient);
  color: white;
}

.message.assistant .message-text {
  background: rgba(248, 249, 250, 0.9);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 6px;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}

.message-content:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  background: white;
}

.code-block {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: var(--radius-sm);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  overflow-x: auto;
  margin: 8px 0;
  white-space: pre-wrap;
}

.inline-code {
  background: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.loading-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
}

.loading-indicator span {
  width: 8px;
  height: 8px;
  background: var(--primary-color);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-indicator span:nth-child(1) { animation-delay: -0.32s; }
.loading-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.input-area {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-family: inherit;
  background: var(--glass-bg);
  color: var(--text-primary);
  resize: none;
  min-height: 44px;
  max-height: 120px;
  line-height: 1.5;
}

.chat-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.chat-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.send-btn {
  padding: 12px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 12px 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 1000;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-icon {
  color: #22c55e;
  font-weight: bold;
}
</style>