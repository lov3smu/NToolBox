<template>
  <PageLayout tool-path="/chat">
    <div class="chat-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <button class="btn btn-primary new-chat-btn" @click="createNewChat">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
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
              <div v-if="editingSessionId !== session.id" class="session-title">
                {{ session.title || '新会话' }}
              </div>
              <input
                v-else
                v-model="editingTitle"
                class="session-edit-input"
                @keydown.enter="saveEditTitle(session.id, $event)"
                @keydown.escape="cancelEditTitle"
                @blur="saveEditTitle(session.id)"
              />
              <div class="session-time">
                {{ formatTime(session.updatedAt) }}
              </div>
            </div>
            <div class="session-actions">
              <button class="session-edit" title="重命名" @click.stop="startEditTitle(session.id, session.title)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="session-delete" title="删除" @click.stop="deleteSession(session.id)">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
            </div>
          </div>
          <div v-if="sessions.length === 0" class="session-empty">
            <p>暂无会话</p>
            <p class="hint">点击上方按钮创建新会话</p>
          </div>
        </div>
      </aside>
      <main class="chat-main">
        <div v-if="showKeyWarning" class="api-key-banner">
          <span>{{ currentProvider?.name || '当前平台' }} 尚未配置 API Key，AI 助手暂不可用</span>
          <button class="btn btn-secondary btn-sm" @click="openSettings('api')">去设置</button>
        </div>
        <div class="chat-header">
          <h2>{{ currentSession?.title || '新会话' }}</h2>
          <div class="model-selector">
            <label>平台：</label>
            <select v-model="selectedProvider" class="model-select provider-select" @change="onProviderChange">
              <option v-for="provider in providers" :key="provider.type" :value="provider.type">
                {{ provider.name }}
              </option>
            </select>
          </div>
          <div class="model-selector">
            <label>模型：</label>
            <select v-model="selectedModel" class="model-select">
              <option v-for="model in models" :key="model.id" :value="model.id">
                {{ model.name }}
              </option>
            </select>
          </div>
        </div>
        <div class="messages-wrap">
          <div ref="messagesContainer" class="messages-container" @scroll="handleMessagesScroll">
            <div v-if="currentMessages.length === 0" class="messages-empty">
              <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                <path d="M12 11v4M12 7h.01" />
              </svg>
              <p>开始与 AI 助手对话吧</p>
              <p class="hint">支持图片与文件输入、工具调用、思考过程与执行链路展示</p>
            </div>
            <div
              v-for="(msg, index) in currentMessages"
              :key="index"
              class="message"
              :class="msg.role"
              :data-message-index="index"
            >
              <div class="message-avatar">
                <span v-if="msg.role === 'user'">你</span>
                <span v-else>AI</span>
              </div>
              <div class="message-content">
                <div v-if="msg.plan && msg.plan.steps && msg.plan.steps.length" class="agent-plan">
                  <div class="agent-plan-head">
                    <span class="agent-plan-badge">计划</span>
                    <span class="agent-plan-goal">{{ msg.plan.goal }}</span>
                  </div>
                  <ol class="agent-plan-list">
                    <li v-for="(step, stepIndex) in msg.plan.steps" :key="stepIndex" class="agent-plan-step">
                      <span class="agent-plan-index">{{ stepIndex + 1 }}</span>
                      <span class="agent-plan-text">{{ step }}</span>
                    </li>
                  </ol>
                </div>
                <div v-if="msg.thinking" class="thinking-block">
                  <div class="thinking-header" @click="toggleThinking(index)">
                    <svg
                      class="thinking-icon"
                      :class="{ expanded: expandedThinking[index] }"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span v-if="msg.isStreaming" class="thinking-pulse" aria-hidden="true" />
                    <span class="thinking-title">
                      {{ msg.isStreaming ? '正在思考...' : '已思考' }}
                    </span>
                    <span class="thinking-duration">点击展开</span>
                  </div>
                  <div v-show="expandedThinking[index]" class="thinking-content">
                    {{ msg.thinking }}
                  </div>
                </div>
                <div v-if="msg.steps && msg.steps.length" class="agent-steps">
                  <button type="button" class="agent-steps-header" @click="toggleChain(index)">
                    <span class="agent-steps-icon">
                      <svg
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <circle cx="6" cy="6" r="2" />
                        <circle cx="18" cy="18" r="2" />
                        <path d="M6 8v4a4 4 0 0 0 4 4h4" />
                      </svg>
                    </span>
                    <span class="agent-steps-title">执行链路</span>
                    <span class="agent-steps-summary">{{ chainSummary(msg.steps) }}</span>
                    <svg
                      class="agent-steps-chevron"
                      :class="{ expanded: !isChainCollapsed(index) }"
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div v-show="!isChainCollapsed(index)" class="agent-steps-list">
                    <div v-for="step in msg.steps" :key="step.id || step.name" class="agent-step" :class="step.status">
                      <div class="agent-step-rail">
                        <span class="agent-step-dot">
                          <span v-if="step.status === 'running'" class="mini-spinner" />
                          <svg
                            v-else-if="step.status === 'success'"
                            viewBox="0 0 24 24"
                            width="11"
                            height="11"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <svg
                            v-else
                            viewBox="0 0 24 24"
                            width="11"
                            height="11"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </span>
                      </div>
                      <div class="agent-step-main">
                        <button type="button" class="agent-step-head" @click="toggleStep(index, step)">
                          <span class="agent-step-name">{{ step.name }}</span>
                          <span class="agent-step-status">{{ step.statusText }}</span>
                          <span v-if="step.duration" class="agent-step-duration">{{
                            formatDuration(step.duration)
                          }}</span>
                          <svg
                            class="agent-step-chevron"
                            :class="{ expanded: isStepExpanded(index, step) }"
                            viewBox="0 0 24 24"
                            width="12"
                            height="12"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                        <div v-if="isStepExpanded(index, step)" class="agent-step-body">
                          <div v-if="step.arguments" class="step-block">
                            <div class="step-label">参数</div>
                            <pre>{{ pretty(step.arguments) }}</pre>
                          </div>
                          <div v-if="step.result" class="step-block">
                            <div class="step-label">结果</div>
                            <pre>{{ step.result }}</pre>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-if="msg.reflections && msg.reflections.length" class="agent-reflections">
                  <div
                    v-for="(reflection, reflectionIndex) in msg.reflections"
                    :key="reflectionIndex"
                    class="agent-reflection"
                    :class="reflection.status"
                  >
                    <span class="agent-reflection-icon" aria-hidden="true">
                      <svg
                        v-if="reflection.status === 'error'"
                        viewBox="0 0 24 24"
                        width="11"
                        height="11"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <svg
                        v-else
                        viewBox="0 0 24 24"
                        width="11"
                        height="11"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                      >
                        <line x1="12" y1="5" x2="12" y2="13" />
                        <line x1="12" y1="18" x2="12.01" y2="18" />
                      </svg>
                    </span>
                    <span class="agent-reflection-text">{{ reflection.text }}</span>
                  </div>
                </div>
                <div v-if="msg.contextNote" class="agent-context-note">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 1 1-3-6.7" />
                    <polyline points="21 3 21 9 15 9" />
                  </svg>
                  <span>{{ msg.contextNote }}</span>
                </div>
                <div v-if="msg.notices && msg.notices.length" class="agent-notices">
                  <div v-for="(note, noteIndex) in msg.notices" :key="noteIndex">{{ note }}</div>
                </div>
                <div v-if="msg.attachments && msg.attachments.length" class="message-attachments">
                  <template v-for="att in msg.attachments" :key="att.id || att.name">
                    <img v-if="att.kind === 'image'" :src="att.dataUrl" :alt="att.name" class="message-image" />
                    <div v-else class="message-file">
                      <svg
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>{{ att.name }}</span>
                    </div>
                  </template>
                </div>
                <div
                  v-if="msg.content || (msg.isStreaming && !msg.thinking && !(msg.steps && msg.steps.length))"
                  class="message-bubble"
                >
                  <div v-if="msg.content" class="message-text" v-html="messageHtml(msg)" />
                  <div
                    v-if="msg.isStreaming && !msg.content && !msg.thinking && !(msg.steps && msg.steps.length)"
                    class="loading-indicator"
                  >
                    <span /><span /><span />
                  </div>
                  <button
                    v-if="msg.role === 'assistant' && msg.content && !msg.isStreaming"
                    class="copy-btn"
                    title="复制"
                    @click="copyMessage(msg.content)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
                <div v-if="msg.summary" class="agent-summary">
                  <div class="agent-summary-head">
                    <span class="agent-summary-title">执行摘要</span>
                    <span class="agent-summary-badge" :class="msg.summary.termination">
                      {{ msg.summary.terminationText }}
                    </span>
                  </div>
                  <div class="agent-summary-metrics">
                    <span>轮次 {{ msg.summary.iterations }}</span>
                    <span>工具 {{ msg.summary.toolCalls }} 次</span>
                    <span>成功 {{ msg.summary.toolSuccess }} / 失败 {{ msg.summary.toolFailed }}</span>
                    <span>耗时 {{ formatDuration(msg.summary.duration) || '0ms' }}</span>
                  </div>
                  <div v-if="msg.summary.tools && msg.summary.tools.length" class="agent-summary-tools">
                    使用工具：{{ msg.summary.tools.join('、') }}
                  </div>
                  <ul
                    v-if="msg.summary.limitations && msg.summary.limitations.length"
                    class="agent-summary-limitations"
                  >
                    <li v-for="(item, itemIndex) in msg.summary.limitations" :key="itemIndex">{{ item }}</li>
                  </ul>
                </div>
                <div v-if="msg.usage" class="message-usage">
                  <span>输入 {{ formatTokens(msg.usage.prompt_tokens) }}</span>
                  <span>输出 {{ formatTokens(msg.usage.completion_tokens) }}</span>
                  <span>合计 {{ formatTokens(msg.usage.total_tokens) }} tokens</span>
                  <span v-if="msg.usage.estimated" class="message-usage-estimated">含估算</span>
                </div>
                <div v-if="msg.stopped" class="message-stopped">已停止生成</div>
              </div>
            </div>
          </div>
          <aside v-if="currentMessages.length" ref="questionRail" class="question-rail">
            <div ref="questionList" class="question-list">
              <button
                v-for="question in questions"
                :key="question.index"
                type="button"
                class="question-mark"
                :aria-label="question.text"
                @click="jumpToQuestion(question.index)"
                @mouseenter="showQuestionTip(question, $event)"
                @mouseleave="hideQuestionTip"
                @focus="showQuestionTip(question, $event)"
                @blur="hideQuestionTip"
              />
            </div>
            <div v-if="hoveredQuestion" class="question-tip" :style="{ top: `${questionTipTop}px` }">
              {{ hoveredQuestion.text }}
            </div>
            <button
              type="button"
              class="scroll-latest"
              :class="{ active: !atBottom }"
              :disabled="atBottom"
              title="滚到最后"
              aria-label="滚到最后"
              @click="scrollToLatest"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="6 13 12 19 18 13" />
              </svg>
            </button>
          </aside>
        </div>
        <div class="composer-area">
          <div v-if="currentMessages.length" class="chat-usage">
            <div class="usage-context">
              <span class="usage-label">上下文</span>
              <div class="usage-track">
                <div
                  class="usage-fill"
                  :class="contextState"
                  :style="{ width: `${contextPercent}%` }"
                  role="progressbar"
                  :aria-valuenow="contextPercent"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-label="上下文使用量"
                />
              </div>
              <span class="usage-value">
                {{ formatTokens(contextTokens) }} / {{ formatTokens(contextWindowSize) }}
              </span>
              <span class="usage-percent" :class="contextState">{{ contextPercent }}%</span>
            </div>
            <div class="usage-meta">
              <span v-if="currentSession?.context" class="usage-chip" title="已压缩的历史上下文">
                已压缩 {{ formatTokens(currentSession.context.beforeTokens) }} →
                {{ formatTokens(currentSession.context.afterTokens) }}
              </span>
              <span class="usage-chip">累计 {{ formatTokens(sessionTokenTotal) }} tokens</span>
              <span v-if="sessionUsageEstimated" class="usage-chip muted">含估算</span>
            </div>
          </div>
          <div class="composer">
            <div v-if="attachments.length" class="composer-attachments">
              <div v-for="att in attachments" :key="att.id" class="attachment-chip">
                <img v-if="att.kind === 'image'" :src="att.dataUrl" :alt="att.name" />
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span class="attachment-name">{{ att.name }}</span>
                <button class="attachment-remove" title="移除" @click="removeAttachment(att.id)">×</button>
              </div>
            </div>
            <textarea
              ref="inputRef"
              v-model="inputText"
              class="composer-input"
              placeholder="给 AI 助手发送消息，支持图片与文件..."
              :disabled="!hasCurrentApiKey"
              @input="resizeInput"
              @keydown.enter.exact="sendMessage"
            />
            <div class="composer-toolbar">
              <div class="toolbar-left">
                <div class="plus-wrap">
                  <button
                    class="composer-icon-btn plus-btn"
                    title="添加附件"
                    @click.stop="plusMenuOpen = !plusMenuOpen"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                  <div v-if="plusMenuOpen" class="plus-menu">
                    <button @click="chooseImages">添加图片</button>
                    <button @click="chooseFiles">添加文件</button>
                  </div>
                </div>
                <button class="composer-icon-btn" title="添加文件" @click="chooseFiles">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path
                      d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"
                    />
                  </svg>
                </button>
                <label class="composer-select" title="工具审批模式">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="8 12 11 15 16 9" />
                  </svg>
                  <select v-model="approvalMode">
                    <option value="auto">自动审批</option>
                    <option value="chat">仅对话</option>
                  </select>
                  <svg
                    class="chevron"
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </label>
              </div>
              <div class="toolbar-right">
                <label
                  class="composer-select"
                  :class="{ disabled: !modelSupportsThinking }"
                  :title="modelSupportsThinking ? '思考模式' : '当前模型不支持思考开关'"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z" />
                  </svg>
                  <select v-model="thinkingMode" :disabled="!modelSupportsThinking">
                    <option value="auto">Auto</option>
                    <option value="on">思考</option>
                    <option value="off">快速</option>
                  </select>
                  <svg
                    class="chevron"
                    viewBox="0 0 24 24"
                    width="11"
                    height="11"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </label>
                <button
                  class="composer-icon-btn"
                  :class="{ recording: isRecording }"
                  :title="isRecording ? '停止语音输入' : '语音输入'"
                  @click="toggleVoiceInput"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                </button>
                <button v-if="!loading" class="send-circle" :disabled="!canSend" title="发送" @click="sendMessage">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="6 11 12 5 18 11" />
                  </svg>
                </button>
                <button v-else class="send-circle stop" title="停止" @click="stopResponse">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="composer-hint">Enter 发送 · Shift+Enter 换行 · 支持图片与文本文件</div>
        </div>
        <input ref="imageInput" type="file" accept="image/*" multiple class="hidden-file" @change="onImagePicked" />
        <input ref="fileInput" type="file" multiple class="hidden-file" @change="onFilePicked" />
      </main>
    </div>
    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import {
  chatStream,
  cancelChatStream,
  isChatStreamActive,
  compressChatContext,
  openSettings,
  getAiProviders,
  onChatStreamChunk,
  onChatStreamEnd
} from '@/api'
import { useConfig, useToast } from '@/composables'
import { copyToClipboard } from '@/utils'
import { renderMarkdown, splitThinkingTags, trimPartialThinkingTag } from '@/utils/markdown'
import Toast from '@/components/Toast.vue'
import PageLayout from '@/layouts/PageLayout.vue'

const THINKING_PREFS_KEY = 'chat_thinking_prefs'
const VIEW_STATE_KEY = 'chat_view_state'
const PENDING_STREAM_KEY = 'chat_pending_stream'
const DRAFT_SAVE_DELAY = 300
const SCROLL_SAVE_DELAY = 250
const MAX_ATTACHMENTS = 6
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_TEXT_FILE_BYTES = 256 * 1024
const DEFAULT_CONTEXT_WINDOW = 131072
const CONTEXT_COMPRESS_THRESHOLD = 0.7
const CONTEXT_KEEP_RECENT = 6

const { config } = useConfig()
const { toastVisible, toastMessage, toastType, showSuccess, showError } = useToast()

const sessions = ref([])
const currentSessionId = ref('')
const inputText = ref('')
const loading = ref(false)
const messagesContainer = ref(null)
const questionRail = ref(null)
const questionList = ref(null)
const atBottom = ref(true)
const hoveredQuestion = ref(null)
const questionTipTop = ref(0)
const inputRef = ref(null)
const imageInput = ref(null)
const fileInput = ref(null)
const providers = ref([])
const selectedProvider = ref('')
const selectedModel = ref('')
const editingSessionId = ref('')
const editingTitle = ref('')
const models = ref([])
const expandedThinking = ref({})
const expandedSteps = ref({})
const collapsedChains = ref({})
const attachments = ref([])
const plusMenuOpen = ref(false)
const approvalMode = ref('auto')
const thinkingMode = ref('auto')
const thinkingPrefs = ref(loadThinkingPrefs())
const isRecording = ref(false)
let recognition = null
let currentRequestId = ''
let removeChunkListener = null
let removeEndListener = null
let viewState = { activeSessionId: '', drafts: {}, scrolls: {} }
let pendingStream = null
let suppressAutoScroll = false
let draftTimer = null
let scrollTimer = null

const currentSession = computed(() => sessions.value.find((s) => s.id === currentSessionId.value))
const currentMessages = computed(() => currentSession?.value?.messages || [])
const questions = computed(() =>
  currentMessages.value.reduce((list, message, index) => {
    if (message.role === 'user') {
      list.push({ index, text: questionText(message) })
    }
    return list
  }, [])
)
const currentProvider = computed(() => providers.value.find((p) => p.type === selectedProvider.value))
const hasCurrentApiKey = computed(() => Boolean(currentProvider.value?.hasApiKey))
const showKeyWarning = computed(() => providers.value.length > 0 && !hasCurrentApiKey.value)
const selectedModelInfo = computed(() => models.value.find((model) => model.id === selectedModel.value))
const modelSupportsThinking = computed(() => Boolean(selectedModelInfo.value?.thinking))
const canSend = computed(
  () => !loading.value && hasCurrentApiKey.value && (Boolean(inputText.value.trim()) || attachments.value.length > 0)
)
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

function loadThinkingPrefs() {
  try {
    return JSON.parse(localStorage.getItem(THINKING_PREFS_KEY)) || {}
  } catch {
    return {}
  }
}

function applyProviderModels(type, preferredModel = '') {
  const provider = providers.value.find((p) => p.type === type)
  if (!provider) {
    models.value = []
    selectedModel.value = ''
    return
  }

  models.value = provider.models || []
  const hasPreferred = models.value.some((model) => model.id === preferredModel)
  selectedModel.value = hasPreferred ? preferredModel : provider.defaultModel || models.value[0]?.id || ''
}

async function loadProviders() {
  const catalog = await getAiProviders()
  providers.value = catalog || []
  if (providers.value.length === 0) {
    models.value = []
    selectedModel.value = ''
    return
  }

  const session = currentSession.value
  const explicitType = selectedProvider.value
  const defaultType = config.value?.ai_provider || providers.value[0].type
  const defaultProvider = providers.value.find((p) => p.type === defaultType)
  const keyedProvider = providers.value.find((p) => p.hasApiKey)
  const preferredType =
    explicitType || session?.provider || (defaultProvider?.hasApiKey ? defaultType : keyedProvider?.type || defaultType)
  const provider = providers.value.find((p) => p.type === preferredType) || providers.value[0]
  selectedProvider.value = provider.type

  let preferredModel = ''
  if (explicitType) {
    preferredModel = selectedModel.value
  } else if (session?.model) {
    preferredModel = session.model
  }
  applyProviderModels(provider.type, preferredModel)
}

function onProviderChange() {
  applyProviderModels(selectedProvider.value)
}

function loadViewState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(VIEW_STATE_KEY))
    if (parsed && typeof parsed === 'object') {
      viewState = {
        activeSessionId: typeof parsed.activeSessionId === 'string' ? parsed.activeSessionId : '',
        drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
        scrolls: parsed.scrolls && typeof parsed.scrolls === 'object' ? parsed.scrolls : {}
      }
    }
  } catch {
    viewState = { activeSessionId: '', drafts: {}, scrolls: {} }
  }
}

function persistViewState() {
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(viewState))
  } catch {
    // 本地存储不可用时仅保留当前会话内的状态
  }
}

function saveDraft() {
  const id = currentSessionId.value
  if (!id) return
  const text = inputText.value
  if (text) viewState.drafts[id] = text
  else delete viewState.drafts[id]
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
  inputText.value = (id && viewState.drafts[id]) || ''
  nextTick(resizeInput)
}

function saveScroll() {
  const container = messagesContainer.value
  const id = currentSessionId.value
  if (!container || !id) return
  if (atBottom.value) delete viewState.scrolls[id]
  else viewState.scrolls[id] = Math.round(container.scrollTop)
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
    const saved = viewState.scrolls[currentSessionId.value]
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
      pendingStream = parsed
    }
  } catch {
    pendingStream = null
  }
}

function persistPendingStream(value) {
  pendingStream = value
  try {
    if (value) localStorage.setItem(PENDING_STREAM_KEY, JSON.stringify(value))
    else localStorage.removeItem(PENDING_STREAM_KEY)
  } catch {
    // 本地存储不可用时只影响跨页面恢复
  }
}

function loadSessions() {
  try {
    const saved = localStorage.getItem('chat_sessions')
    if (saved) {
      sessions.value = JSON.parse(saved)
      for (const session of sessions.value) {
        for (const message of session.messages || []) normalizeLegacyThinking(message)
      }
    }
  } catch {
    sessions.value = []
  }
  const savedId = viewState.activeSessionId
  const active = sessions.value.find((session) => session.id === savedId) || sessions.value[0]
  currentSessionId.value = active?.id || ''
  viewState.activeSessionId = currentSessionId.value
}

function saveSessions() {
  try {
    localStorage.setItem('chat_sessions', JSON.stringify(sessions.value))
  } catch {
    showError('会话保存失败：附件体积过大，请删除部分图片后重试')
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

function markStreamInterrupted(message) {
  message.isStreaming = false
  finalizeContent(message)
  message.stopped = true
  if (!message.notices) message.notices = []
  if (!message.notices.includes('生成已中断')) message.notices.push('生成已中断')
}

function recoverStreamState() {
  loadPendingStream()
  let changed = false
  for (const session of sessions.value) {
    const streamingMessages = (session.messages || []).filter((message) => message.isStreaming)
    if (streamingMessages.length === 0) continue
    const resumable = pendingStream && pendingStream.sessionId === session.id
    if (resumable) continue
    for (const message of streamingMessages) markStreamInterrupted(message)
    changed = true
  }
  if (changed) saveSessions()
}

function createNewChat() {
  saveDraft()
  saveScroll()
  const newSession = {
    id: generateId(),
    title: '新会话',
    messages: [],
    provider: selectedProvider.value,
    model: selectedModel.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
  sessions.value.unshift(newSession)
  delete viewState.scrolls[newSession.id]
  delete viewState.drafts[newSession.id]
  viewState.activeSessionId = newSession.id
  currentSessionId.value = newSession.id
  applyDraft(newSession.id)
  saveSessions()
}

function selectSession(id) {
  if (id === currentSessionId.value) return
  saveDraft()
  saveScroll()
  viewState.activeSessionId = id
  persistViewState()
  suppressAutoScroll = true
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
    suppressAutoScroll = false
  })
}

function deleteSession(id) {
  const index = sessions.value.findIndex((s) => s.id === id)
  if (index === -1) return
  saveDraft()
  saveScroll()
  sessions.value.splice(index, 1)
  delete viewState.drafts[id]
  delete viewState.scrolls[id]
  if (currentSessionId.value === id) {
    const nextSession = sessions.value[0]
    viewState.activeSessionId = nextSession?.id || ''
    suppressAutoScroll = true
    currentSessionId.value = nextSession?.id || ''
    applyDraft(viewState.activeSessionId)
    nextTick(() => {
      restoreScroll()
      suppressAutoScroll = false
    })
  } else if (currentSessionId.value) {
    viewState.activeSessionId = currentSessionId.value
  }
  persistViewState()
  saveSessions()
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

function formatTokens(value) {
  const tokens = Number(value) || 0
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(tokens >= 10000000 ? 0 : 1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(tokens >= 10000 ? 0 : 1)}k`
  return String(tokens)
}

function mergeUsage(session, usage) {
  if (!session || !usage) return
  if (!session.usage) {
    session.usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      calls: 0,
      estimated: false
    }
  }
  const target = session.usage
  target.prompt_tokens += Number(usage.prompt_tokens) || 0
  target.completion_tokens += Number(usage.completion_tokens) || 0
  target.total_tokens += Number(usage.total_tokens) || 0
  target.calls += Number(usage.calls) || 0
  if (usage.estimated) target.estimated = true
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
  const session = sessions.value.find((s) => s.id === sessionId)
  if (session && session.title === '新会话' && firstMessage) {
    session.title = firstMessage.slice(0, 20) + (firstMessage.length > 20 ? '...' : '')
  }
}

function toApiMessage(message) {
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

function applyStreamingContent(message) {
  const parsed = splitThinkingTags(message.rawContent)
  message.content = trimPartialThinkingTag(parsed.content)
  message.thinking = [message.nativeThinking, parsed.thinking].filter(Boolean).join('\n')
}

function finalizeContent(message) {
  const parsed = splitThinkingTags(message.rawContent ?? message.content)
  message.content = trimPartialThinkingTag(parsed.content).trim()
  message.thinking = [message.nativeThinking, parsed.thinking].filter(Boolean).join('\n')
  delete message.rawContent
  delete message.nativeThinking
}

function normalizeLegacyThinking(message) {
  if (message.role !== 'assistant' || typeof message.content !== 'string') return
  if (!message.content.includes('thinking')) return
  const parsed = splitThinkingTags(message.content)
  if (parsed.content === message.content) return
  message.thinking = [message.thinking, parsed.thinking].filter(Boolean).join('\n')
  message.content = parsed.content
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
      name: event.name || '工具',
      arguments: event.arguments || '',
      status: 'running',
      statusText: '执行中'
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
    if (step) {
      step.status = event.success ? 'success' : 'error'
      step.statusText = event.success ? '完成' : '失败'
      step.duration = event.duration
      step.result = event.result || ''
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

function attachStreamListeners(session, assistantMessage, requestId) {
  if (removeChunkListener) removeChunkListener()
  if (removeEndListener) removeEndListener()

  removeChunkListener = onChatStreamChunk((payload) => {
    if (!payload || payload.requestId !== requestId) return
    handleStreamChunk(assistantMessage, payload, session.id)
  })

  removeEndListener = onChatStreamEnd((result) => {
    if (!result || result.requestId !== requestId) return
    currentRequestId = ''
    loading.value = false
    assistantMessage.isStreaming = false
    finalizeContent(assistantMessage)

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
      assistantMessage.notices.push('已停止生成')
    } else if (!result.success) {
      const prefix = assistantMessage.content ? `${assistantMessage.content}\n\n` : ''
      assistantMessage.content = `${prefix}错误: ${result.error}`
    }

    session.updatedAt = Date.now()
    persistPendingStream(null)
    saveSessions()
    if (currentSessionId.value === session.id) scrollToBottom()
  })
}

async function resumePendingStream() {
  if (!pendingStream) return
  const { requestId, sessionId } = pendingStream
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

  currentRequestId = requestId
  if (currentSessionId.value === session.id) loading.value = true
  attachStreamListeners(session, assistantMessage, requestId)

  const active = await isChatStreamActive(requestId)
  if (active || currentRequestId !== requestId) return

  currentRequestId = ''
  loading.value = false
  markStreamInterrupted(assistantMessage)
  persistPendingStream(null)
  saveSessions()
  if (currentSessionId.value === session.id) scrollToBottom()
}

async function maybeCompressContext(session, assistantMessage, requestId) {
  const window = contextWindowSize.value
  const used = Number(session.contextUsage?.tokens) || 0
  if (!used || used < window * CONTEXT_COMPRESS_THRESHOLD) return

  const history = session.messages.slice(0, -1)
  const upToIndex = Number(session.context?.upToIndex) || 0
  if (history.length - upToIndex <= CONTEXT_KEEP_RECENT + 2) return

  assistantMessage.contextNote = '上下文较长，正在压缩历史…'
  if (currentSessionId.value === session.id) scrollToBottom()

  try {
    const result = await compressChatContext(history.slice(upToIndex).map(toApiMessage), {
      provider: session.provider || selectedProvider.value,
      model: session.model || selectedModel.value,
      contextSummary: session.context?.summary || '',
      keepRecent: CONTEXT_KEEP_RECENT
    })

    if (currentRequestId !== requestId) return

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
      assistantMessage.contextNote = `上下文已压缩：${formatTokens(result.beforeTokens)} → ${formatTokens(
        result.afterTokens
      )} tokens（保留最近 ${result.keptCount} 条消息）`
      saveSessions()
    } else {
      assistantMessage.contextNote = `上下文压缩失败：${result?.error || '未知错误'}，本轮继续使用完整历史`
    }
  } catch (error) {
    if (currentRequestId === requestId) {
      assistantMessage.contextNote = `上下文压缩失败：${error.message}，本轮继续使用完整历史`
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
    showError(`请先在设置中配置 ${currentProvider.value?.name || '当前平台'} API Key`)
    return
  }
  if (!currentSessionId.value) createNewChat()

  const session = sessions.value.find((s) => s.id === currentSessionId.value)
  if (!session) return

  inputText.value = ''
  attachments.value = []
  delete viewState.drafts[session.id]
  persistViewState()
  await nextTick()
  resizeInput()

  session.provider = selectedProvider.value
  session.model = selectedModel.value
  session.messages.push({ role: 'user', content: text, attachments: files })
  session.updatedAt = Date.now()
  updateSessionTitle(currentSessionId.value, text || files[0]?.name || '附件消息')
  saveSessions()

  const requestId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  currentRequestId = requestId
  loading.value = true
  scrollToBottom()

  session.messages.push({ role: 'assistant', content: '', thinking: '', steps: [], notices: [] })
  const assistantMessage = session.messages[session.messages.length - 1]
  assistantMessage.isStreaming = true

  persistPendingStream({ requestId, sessionId: session.id })
  attachStreamListeners(session, assistantMessage, requestId)

  try {
    await maybeCompressContext(session, assistantMessage, requestId)
    if (currentRequestId !== requestId) {
      assistantMessage.isStreaming = false
      assistantMessage.stopped = true
      delete assistantMessage.contextNote
      finalizeContent(assistantMessage)
      persistPendingStream(null)
      saveSessions()
      return
    }

    const history = session.messages.slice(0, -1)
    const startIndex = Math.min(Number(session.context?.upToIndex) || 0, history.length)
    const chatMessages = history.slice(startIndex).map(toApiMessage)
    const thinking = thinkingMode.value === 'auto' ? undefined : thinkingMode.value === 'on'
    await chatStream(chatMessages, {
      provider: selectedProvider.value,
      model: selectedModel.value,
      requestId,
      toolsEnabled: approvalMode.value === 'auto',
      thinking,
      contextSummary: session.context?.summary || ''
    })
  } catch (error) {
    currentRequestId = ''
    loading.value = false
    assistantMessage.isStreaming = false
    assistantMessage.content = `请求失败: ${error.message}`
    persistPendingStream(null)
    saveSessions()
    scrollToBottom()
  }
}

async function stopResponse() {
  if (!currentRequestId) return
  const stopped = await cancelChatStream(currentRequestId)
  if (!stopped) {
    loading.value = false
    currentRequestId = ''
    persistPendingStream(null)
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

function questionText(message) {
  const text = (message.content || '').trim()
  if (text) return text
  const attachments = message.attachments || []
  if (attachments.length === 0) return '空消息'
  return attachments
    .map((attachment) => (attachment.kind === 'image' ? `[图片] ${attachment.name}` : `[文件] ${attachment.name}`))
    .join('\n')
}

function handleMessagesScroll() {
  const container = messagesContainer.value
  if (!container) return
  atBottom.value = container.scrollHeight - container.scrollTop - container.clientHeight < 32
  scheduleScrollSave()
}

function jumpToQuestion(index) {
  const container = messagesContainer.value
  if (!container) return
  const target = container.querySelector(`[data-message-index="${index}"]`)
  if (!target) return
  const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 8
  container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
}

function scrollToLatest() {
  const container = messagesContainer.value
  if (!container) return
  container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
}

function showQuestionTip(question, event) {
  const rail = questionRail.value
  if (!rail) return
  const railRect = rail.getBoundingClientRect()
  const markerRect = event.currentTarget.getBoundingClientRect()
  const center = markerRect.top - railRect.top + markerRect.height / 2
  hoveredQuestion.value = question
  questionTipTop.value = Math.round(Math.min(Math.max(center, 44), railRect.height - 44))
}

function hideQuestionTip() {
  hoveredQuestion.value = null
}

function toggleThinking(index) {
  expandedThinking.value[index] = !expandedThinking.value[index]
}

function toggleChain(index) {
  collapsedChains.value = { ...collapsedChains.value, [index]: !collapsedChains.value[index] }
}

function isChainCollapsed(index) {
  return Boolean(collapsedChains.value[index])
}

function chainSummary(steps) {
  const total = steps.length
  const running = steps.filter((step) => step.status === 'running').length
  const failed = steps.filter((step) => step.status === 'error').length
  if (running > 0) return `${total} 步 · ${running} 个执行中`
  if (failed > 0) return `${total} 步 · ${failed} 个失败`
  return `${total} 步 · 全部完成`
}

function formatDuration(ms) {
  if (!ms) return ''
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function stepKey(index, step) {
  return `${index}:${step.id || step.name}`
}

function toggleStep(index, step) {
  const key = stepKey(index, step)
  expandedSteps.value = { ...expandedSteps.value, [key]: !expandedSteps.value[key] }
}

function isStepExpanded(index, step) {
  return Boolean(expandedSteps.value[stepKey(index, step)])
}

function pretty(value) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const text = value.trim()
  if (!text) return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return value
  }
}

const formatMessage = renderMarkdown

const STREAM_CARET = '<span class="stream-caret" aria-hidden="true"></span>'

function messageHtml(msg) {
  const html = formatMessage(msg.content)
  if (!msg.isStreaming || msg.role !== 'assistant' || !html) return html
  return html.endsWith('<br>') ? `${html.slice(0, -4)}${STREAM_CARET}<br>` : `${html}${STREAM_CARET}`
}

async function copyMessage(content) {
  const success = await copyToClipboard(content)
  if (success) {
    showSuccess('已复制到剪贴板')
  } else {
    showError('复制失败')
  }
}

function resizeInput() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 180)}px`
}

function chooseImages() {
  plusMenuOpen.value = false
  imageInput.value?.click()
}

function chooseFiles() {
  plusMenuOpen.value = false
  fileInput.value?.click()
}

function onImagePicked(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  addFiles(files, 'image')
}

function onFilePicked(e) {
  const files = Array.from(e.target.files || [])
  e.target.value = ''
  addFiles(files, 'file')
}

function removeAttachment(id) {
  attachments.value = attachments.value.filter((att) => att.id !== id)
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error || new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

async function prepareImage(file) {
  const dataUrl = await readAsDataUrl(file)
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return dataUrl

  const image = await loadImage(dataUrl)
  const maxEdge = 1024
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height))
  if (scale === 1 && file.size <= 1024 * 1024) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.82)
}

async function addFiles(files, kindHint) {
  for (const file of files) {
    if (attachments.value.length >= MAX_ATTACHMENTS) {
      showError(`最多添加 ${MAX_ATTACHMENTS} 个附件`)
      break
    }

    const isImage = kindHint === 'image' || file.type.startsWith('image/')
    if (isImage) {
      if (file.size > MAX_IMAGE_BYTES) {
        showError(`${file.name} 超过 10MB，已跳过`)
        continue
      }
      try {
        const dataUrl = await prepareImage(file)
        attachments.value.push({ id: generateId(), kind: 'image', name: file.name, size: file.size, dataUrl })
      } catch {
        showError(`无法读取图片 ${file.name}`)
      }
    } else {
      if (file.size > MAX_TEXT_FILE_BYTES) {
        showError(`${file.name} 超过 256KB，已跳过`)
        continue
      }
      try {
        const content = await file.text()
        attachments.value.push({ id: generateId(), kind: 'file', name: file.name, size: file.size, content })
      } catch {
        showError(`无法读取文件 ${file.name}`)
      }
    }
  }
  await nextTick()
  resizeInput()
}

function toggleVoiceInput() {
  if (isRecording.value) {
    recognition?.stop()
    return
  }

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Recognition) {
    showError('当前环境不支持语音输入')
    return
  }

  const base = inputText.value.trim()
  const instance = new Recognition()
  instance.lang = 'zh-CN'
  instance.interimResults = true
  instance.continuous = false
  instance.onresult = (event) => {
    let transcript = ''
    for (let i = 0; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript
    }
    inputText.value = base ? `${base} ${transcript}` : transcript
    resizeInput()
  }
  instance.onerror = (event) => {
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      showError(`语音识别失败: ${event.error}`)
    }
  }
  instance.onend = () => {
    isRecording.value = false
    recognition = null
  }

  try {
    instance.start()
    recognition = instance
    isRecording.value = true
  } catch (error) {
    showError(`无法启动语音识别: ${error.message}`)
  }
}

function closePlusMenu() {
  plusMenuOpen.value = false
}

onMounted(async () => {
  loadViewState()
  loadSessions()
  recoverStreamState()
  applyDraft(currentSessionId.value)
  suppressAutoScroll = true
  loadProviders()
  document.addEventListener('click', closePlusMenu)
  await nextTick()
  restoreScroll()
  suppressAutoScroll = false
  resizeInput()
  resumePendingStream()
})

watch(
  () => [config.value?.ai_provider, config.value?.ai_api_keys, config.value?.ai_models],
  () => loadProviders(),
  { deep: true }
)

watch(selectedModel, (model) => {
  thinkingMode.value = thinkingPrefs.value[model] || 'auto'
})

watch(thinkingMode, (mode) => {
  if (!selectedModel.value) return
  thinkingPrefs.value = { ...thinkingPrefs.value, [selectedModel.value]: mode }
  try {
    localStorage.setItem(THINKING_PREFS_KEY, JSON.stringify(thinkingPrefs.value))
  } catch {
    // 本地存储不可用时仅保留当前会话内的选择
  }
})

onUnmounted(() => {
  if (draftTimer) clearTimeout(draftTimer)
  if (scrollTimer) clearTimeout(scrollTimer)
  saveDraft()
  saveScroll()
  if (currentRequestId) saveSessions()
  if (removeChunkListener) removeChunkListener()
  if (removeEndListener) removeEndListener()
  document.removeEventListener('click', closePlusMenu)
  recognition?.stop()
  recognition = null
})

watch(
  currentMessages,
  () => {
    if (suppressAutoScroll) return
    scrollToBottom()
  },
  { deep: true }
)

watch(inputText, () => {
  scheduleDraftSave()
})

watch(currentSessionId, (id) => {
  hoveredQuestion.value = null
  atBottom.value = true
  if (id) {
    viewState.activeSessionId = id
    persistViewState()
  }
})

watch(
  () => questions.value.length,
  () => {
    nextTick(() => {
      if (questionList.value) questionList.value.scrollTop = questionList.value.scrollHeight
    })
  }
)
</script>

<style scoped>
.api-key-banner {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 16px;
  border-bottom: 1px solid rgba(var(--warning-rgb), 0.35);
  background: rgba(var(--warning-rgb), 0.1);
  color: var(--warning-darker);
  font-size: var(--font-size-sm);
}

.chat-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar {
  width: 240px;
  background: var(--surface-muted);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 10px;
  border-bottom: 1px solid var(--border-color);
}

.new-chat-btn {
  width: 100%;
  justify-content: center;
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.session-item {
  padding: 8px 10px;
  margin-bottom: 2px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.15s;
  position: relative;
}

.session-item:hover {
  background: var(--surface-hover);
}

.session-item.active {
  background: var(--surface);
  border-color: var(--border-color);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: var(--font-size-dense);
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-edit-input {
  font-size: var(--font-size-dense);
  color: var(--text-primary);
  font-weight: 500;
  width: 100%;
  padding: 3px 6px;
  border: 1px solid var(--accent-color);
  border-radius: 4px;
  background: var(--surface);
  outline: none;
}

.session-time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-top: 2px;
}

.session-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.session-item:hover .session-actions,
.session-item.active .session-actions {
  opacity: 1;
}

.session-edit,
.session-delete {
  padding: 4px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-tertiary);
  display: inline-flex;
  transition: background 0.15s;
}

.session-edit:hover {
  background: var(--surface-muted);
  color: var(--text-primary);
}

.session-delete:hover {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.session-empty {
  padding: 32px 12px;
  text-align: center;
  color: var(--text-tertiary);
}

.session-empty p {
  font-size: var(--font-size-sm);
  margin-bottom: 4px;
}

.session-empty .hint {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--surface);
}

.chat-header {
  padding: 7px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 12px;
  min-height: 46px;
}

.chat-header h2 {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  margin: 0;
}

.model-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  white-space: nowrap;
}

.model-selector label {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.model-select {
  height: var(--control-height-sm);
  padding: 0 28px 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: inherit;
  background-color: var(--surface);
  color: var(--text-primary);
  cursor: pointer;
  width: 190px;
  flex-shrink: 0;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.model-select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.12);
}

.provider-select {
  width: 120px;
}

.messages-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
}

.messages-container {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 18px 54px 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.question-rail {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 10;
}

.question-list {
  max-height: min(60vh, 420px);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  overflow-y: auto;
  scrollbar-width: none;
}

.question-list::-webkit-scrollbar {
  display: none;
}

.question-mark {
  width: 22px;
  height: 12px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.question-mark::before {
  content: '';
  width: 14px;
  height: 2px;
  border-radius: 999px;
  background: var(--text-tertiary);
  transition: var(--transition-fast);
}

.question-mark:hover::before,
.question-mark:focus-visible::before {
  width: 20px;
  background: var(--accent-color);
}

.question-mark:focus-visible {
  outline: none;
}

.question-tip {
  position: absolute;
  right: calc(100% + 10px);
  transform: translateY(-50%);
  width: max-content;
  max-width: 260px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-primary);
  box-shadow: var(--shadow-md);
  font-size: calc(12px * var(--font-scale));
  line-height: 1.5;
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  overflow: hidden;
  pointer-events: none;
  z-index: 30;
}

.scroll-latest {
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.scroll-latest:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.scroll-latest.active {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.scroll-latest:disabled {
  opacity: 0.45;
  cursor: default;
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
  opacity: 0.3;
  margin-bottom: 12px;
}

.messages-empty p {
  font-size: var(--font-size-dense);
  margin-bottom: 4px;
}

.messages-empty .hint {
  font-size: var(--font-size-sm);
  opacity: 0.8;
}

.message {
  display: flex;
  gap: 10px;
  max-width: min(820px, 88%);
  min-width: 0;
  animation: message-in var(--motion-base) var(--motion-ease);
}

@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(3px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.message.user {
  --bubble-bg: var(--accent-gradient);
  --bubble-fg: var(--btn-primary-text);
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message.assistant {
  align-self: flex-start;
  width: min(760px, 88%);
}

.message-avatar {
  width: 30px;
  height: 30px;
  margin-top: 2px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: var(--bubble-bg);
  color: var(--bubble-fg);
}

.message.assistant .message-avatar {
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.message-content {
  flex: 1;
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.message-bubble {
  position: relative;
  max-width: 100%;
  padding: 10px 14px;
  border: 1px solid transparent;
  font-size: var(--font-size-base);
  line-height: 1.72;
  word-break: break-word;
  overflow-wrap: anywhere;
  box-shadow: var(--shadow-sm);
}

.message.user .message-bubble {
  align-self: flex-end;
  background: var(--bubble-bg);
  border-radius: 16px 16px 6px 16px;
  color: var(--bubble-fg);
}

.message.assistant .message-bubble {
  background: var(--surface-muted);
  border-color: var(--border-color);
  border-radius: 16px 16px 16px 6px;
  color: var(--text-primary);
}

:root[data-theme='dark'] .message.user {
  --bubble-bg: var(--accent-gradient);
  --bubble-fg: var(--btn-primary-text);
}

.thinking-block {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 11px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.thinking-header:hover {
  background: var(--surface-hover);
}

.thinking-icon {
  color: var(--accent-color);
  transition: transform 0.2s;
}

.thinking-icon.expanded {
  transform: rotate(90deg);
}

.thinking-pulse {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--accent-color);
  animation: thinking-breathe 1.6s ease-in-out infinite;
}

@keyframes thinking-breathe {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.75);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }
}

.thinking-title {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-secondary);
}

.thinking-duration {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-left: auto;
}

.thinking-content {
  padding: 10px 12px;
  font-size: calc(12.5px * var(--font-scale));
  line-height: 1.72;
  color: var(--text-secondary);
  background: var(--surface);
  border-top: 1px solid var(--border-color);
  white-space: pre-wrap;
  font-family: 'Consolas', 'Monaco', monospace;
}

.agent-steps {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
}

.agent-steps-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.agent-steps-header:hover {
  background: var(--surface-hover);
}

.agent-steps-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  flex-shrink: 0;
}

.agent-steps-title {
  font-size: var(--font-size-sm);
}

.agent-steps-summary {
  margin-left: auto;
  font-size: var(--font-size-xs);
  font-weight: 400;
  color: var(--text-tertiary);
}

.agent-steps-chevron {
  color: var(--text-tertiary);
  transition: transform 0.2s;
}

.agent-steps-chevron:not(.expanded) {
  transform: rotate(-90deg);
}

.agent-steps-list {
  padding: 4px 0;
  border-top: 1px solid var(--border-color);
}

.agent-step {
  display: flex;
  padding: 0 11px;
  animation: step-in var(--motion-fast) var(--motion-ease);
}

@keyframes step-in {
  from {
    opacity: 0;
    transform: translateY(2px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.agent-step-rail {
  position: relative;
  width: 24px;
  padding-top: 11px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.agent-step:not(:last-child) .agent-step-rail::after {
  content: '';
  position: absolute;
  top: 28px;
  bottom: -6px;
  left: 50%;
  width: 1px;
  background: var(--border-strong);
  transform: translateX(-50%);
}

.agent-step-dot {
  position: relative;
  z-index: 1;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.agent-step.running .agent-step-dot {
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
}

.agent-step.success .agent-step-dot {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
}

.agent-step.error .agent-step-dot {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.mini-spinner {
  width: var(--spinner-xs);
  height: var(--spinner-xs);
  border: 2px solid rgba(var(--accent-rgb), 0.25);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin var(--spinner-duration) linear infinite;
}

.agent-step-main {
  flex: 1;
  min-width: 0;
  padding: 3px 0 5px;
  border-bottom: 1px solid var(--border-color);
}

.agent-step:last-child .agent-step-main {
  border-bottom: none;
}

.agent-step-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.agent-step-head:hover .agent-step-name {
  color: var(--accent-color);
}

.agent-step-name {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: calc(12.5px * var(--font-scale));
  font-weight: 500;
  color: var(--text-primary);
  transition: color 0.15s;
}

.agent-step-status {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: calc(11px * var(--font-scale));
  white-space: nowrap;
}

.agent-step.running .agent-step-status {
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.agent-step.success .agent-step-status {
  background: rgba(var(--success-rgb), 0.1);
  color: var(--success-dark);
}

.agent-step.error .agent-step-status {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.agent-step-duration {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.agent-step-chevron {
  transition: transform 0.2s;
  opacity: 0.6;
  flex-shrink: 0;
}

.agent-step-chevron.expanded {
  transform: rotate(180deg);
}

.agent-step-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 0 6px;
}

.step-label {
  font-size: calc(11px * var(--font-scale));
  color: var(--text-tertiary);
  margin-bottom: 3px;
}

.agent-step-body pre {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: calc(11.5px * var(--font-scale));
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow: auto;
}

.agent-notices {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid rgba(var(--warning-rgb), 0.3);
  border-radius: 10px;
  background: rgba(var(--warning-rgb), 0.1);
  color: var(--warning-darker);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.agent-context-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid rgba(var(--accent-rgb), 0.24);
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.agent-context-note svg {
  flex-shrink: 0;
  color: var(--accent-color);
}

.agent-plan {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface);
  overflow: hidden;
  animation: step-in var(--motion-fast) var(--motion-ease);
}

.agent-plan-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border-bottom: 1px solid var(--border-color);
}

.agent-plan-badge {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-size: calc(11px * var(--font-scale));
  font-weight: 600;
  flex-shrink: 0;
}

.agent-plan-goal {
  min-width: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-plan-list {
  margin: 0;
  padding: 6px 11px 8px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-plan-step {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.55;
}

.agent-plan-index {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: calc(10px * var(--font-scale));
  font-variant-numeric: tabular-nums;
  transform: translateY(2px);
}

.agent-plan-text {
  min-width: 0;
  word-break: break-word;
}

.agent-reflections {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agent-reflection {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.55;
  animation: step-in var(--motion-fast) var(--motion-ease);
}

.agent-reflection.error {
  border-color: rgba(var(--error-rgb), 0.3);
  background: rgba(var(--error-rgb), 0.06);
  color: var(--error-dark);
}

.agent-reflection.warning {
  border-color: rgba(var(--warning-rgb), 0.3);
  background: rgba(var(--warning-rgb), 0.08);
  color: var(--warning-darker);
}

.agent-reflection-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 1px;
}

.agent-reflection-text {
  min-width: 0;
  word-break: break-word;
}

.agent-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: var(--surface-muted);
  animation: step-in var(--motion-fast) var(--motion-ease);
}

.agent-summary-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.agent-summary-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.agent-summary-badge {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
  font-size: calc(11px * var(--font-scale));
  font-weight: 500;
}

.agent-summary-badge.cancelled,
.agent-summary-badge.timeout,
.agent-summary-badge.max_steps {
  background: rgba(var(--warning-rgb), 0.14);
  color: var(--warning-darker);
}

.agent-summary-badge.error {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.agent-summary-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.agent-summary-tools {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  word-break: break-word;
}

.agent-summary-limitations {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--font-size-xs);
  line-height: 1.55;
  color: var(--warning-darker);
}

.message-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.message.user .message-attachments {
  justify-content: flex-end;
}

.message-image {
  max-width: 220px;
  max-height: 160px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  object-fit: cover;
}

.message-file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface-muted);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.message-text {
  font-size: var(--font-size-base);
  line-height: 1.72;
  word-wrap: break-word;
}

.message-text :deep(.stream-caret) {
  display: inline-block;
  width: 2px;
  height: 1.02em;
  margin-left: 2px;
  vertical-align: -0.16em;
  border-radius: 1px;
  background: var(--accent-color);
  animation: stream-caret 1.1s steps(1, end) infinite;
}

@keyframes stream-caret {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

.message-text :deep(h1),
.message-text :deep(h2),
.message-text :deep(h3),
.message-text :deep(h4),
.message-text :deep(h5),
.message-text :deep(h6) {
  margin: 14px 0 6px;
  font-weight: 600;
  line-height: 1.35;
  color: inherit;
}

.message-text :deep(h1:first-child),
.message-text :deep(h2:first-child),
.message-text :deep(h3:first-child),
.message-text :deep(h4:first-child),
.message-text :deep(h5:first-child),
.message-text :deep(h6:first-child) {
  margin-top: 0;
}

.message-text :deep(h1) {
  font-size: calc(18px * var(--font-scale));
}

.message-text :deep(h2) {
  font-size: calc(17px * var(--font-scale));
}

.message-text :deep(h3) {
  font-size: calc(15px * var(--font-scale));
}

.message-text :deep(h4),
.message-text :deep(h5),
.message-text :deep(h6) {
  font-size: calc(14px * var(--font-scale));
}

.message-text :deep(ul),
.message-text :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.message-text :deep(li) {
  margin: 3px 0;
}

.message-text :deep(blockquote) {
  margin: 10px 0;
  padding: 6px 12px;
  border-left: 3px solid var(--accent-color);
  border-radius: 0 8px 8px 0;
  background: rgba(var(--accent-rgb), 0.07);
  color: var(--text-secondary);
}

.message.user .message-text :deep(blockquote) {
  color: inherit;
  background: rgba(255, 255, 255, 0.12);
}

.message-text :deep(hr) {
  margin: 12px 0;
  border: none;
  border-top: 1px solid var(--border-color);
}

.message-text :deep(a) {
  color: var(--accent-color);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.message.user .message-text :deep(a) {
  color: inherit;
}

.message-stopped {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.message-usage {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.message-usage span:not(:first-child)::before {
  content: '·';
  margin: 0 8px;
  color: var(--border-color);
}

.message-usage-estimated {
  color: var(--warning-dark);
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 5px;
  border: 1px solid var(--border-color);
  background: var(--surface);
  border-radius: 6px;
  color: var(--text-tertiary);
  cursor: pointer;
  opacity: 0;
  display: inline-flex;
  box-shadow: var(--shadow-sm);
  transition:
    opacity 0.15s,
    background 0.15s,
    color 0.15s;
}

.message-content:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

:deep(.code-block) {
  display: block;
  background: var(--code-bg);
  border: 1px solid var(--border-color);
  color: var(--code-text);
  padding: 12px 14px;
  border-radius: 10px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: calc(12.5px * var(--font-scale));
  line-height: 1.65;
  overflow-x: auto;
  margin: 10px 0;
  white-space: pre-wrap;
}

:deep(.inline-code) {
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 1px 5px;
  border-radius: 5px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: calc(12.5px * var(--font-scale));
}

.loading-indicator {
  display: flex;
  gap: 4px;
  padding: 2px 4px;
}

.loading-indicator span {
  width: 6px;
  height: 6px;
  background: var(--text-tertiary);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.loading-indicator span:nth-child(1) {
  animation-delay: -0.32s;
}
.loading-indicator span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.composer-area {
  flex-shrink: 0;
  padding: 10px 16px 8px;
  border-top: 1px solid var(--border-color);
  background: var(--surface);
}

.chat-usage {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 6px 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.usage-context {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.usage-label {
  flex-shrink: 0;
  color: var(--text-secondary);
}

.usage-track {
  position: relative;
  flex: 1;
  min-width: 60px;
  max-width: 200px;
  height: 4px;
  border-radius: 999px;
  background: var(--surface-muted);
  overflow: hidden;
}

.usage-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent-color);
  transition:
    width var(--motion-base) var(--motion-ease),
    background-color var(--motion-fast) var(--motion-ease);
}

.usage-fill.warn {
  background: var(--warning-color);
}

.usage-fill.danger {
  background: var(--error-color);
}

.usage-value {
  white-space: nowrap;
  color: var(--text-secondary);
}

.usage-percent {
  min-width: 34px;
  text-align: right;
}

.usage-percent.warn {
  color: var(--warning-dark);
}

.usage-percent.danger {
  color: var(--error-dark);
}

.usage-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.usage-chip {
  padding: 1px 8px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-muted);
  white-space: nowrap;
}

.usage-chip.muted {
  color: var(--text-tertiary);
}

.composer {
  padding: 10px 10px 8px;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.composer:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.1);
}

.composer-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 6px 8px;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 220px;
  padding: 4px 6px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface-muted);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.attachment-chip img {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  object-fit: cover;
}

.attachment-name {
  max-width: 140px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.attachment-remove {
  padding: 0 2px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: calc(14px * var(--font-scale));
  line-height: 1;
  cursor: pointer;
}

.attachment-remove:hover {
  color: var(--error-dark);
}

.composer-input {
  width: 100%;
  min-height: 40px;
  max-height: 180px;
  padding: 4px 8px 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-dense);
  line-height: 1.6;
  resize: none;
}

.composer-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.composer-input::placeholder {
  color: var(--text-tertiary);
}

.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-color);
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.composer-icon-btn {
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}

.composer-icon-btn:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.plus-btn {
  border: 1px solid var(--border-color);
  background: var(--surface);
}

.composer-icon-btn.recording {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.plus-wrap {
  position: relative;
}

.plus-menu {
  position: absolute;
  left: 0;
  bottom: 38px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  min-width: 132px;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}

.plus-menu button {
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
}

.plus-menu button:hover {
  background: var(--surface-hover);
}

.composer-select {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.composer-select:hover {
  background: var(--surface-hover);
}

.composer-select select {
  padding-right: 2px;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  appearance: none;
}

.composer-select .chevron {
  opacity: 0.6;
}

.composer-select.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.composer-select.disabled select {
  cursor: not-allowed;
}

.send-circle {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  cursor: pointer;
  transition:
    background 0.15s,
    opacity 0.15s;
}

.send-circle:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
}

.send-circle:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.send-circle.stop {
  background: var(--error-dark);
  color: #fff;
}

.send-circle.stop:hover {
  background: var(--error-darker, var(--error-dark));
}

.composer-hint {
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  text-align: center;
}

.hidden-file {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .message-text :deep(.stream-caret),
  .thinking-pulse {
    animation: none;
  }

  .thinking-pulse {
    opacity: 1;
    transform: none;
  }
}

@media (max-width: 960px) {
  .sidebar {
    width: 200px;
  }
}

@media (max-width: 760px) {
  .sidebar {
    width: 168px;
  }

  .chat-header {
    padding: 6px 12px;
  }

  .messages-container {
    padding: 12px;
  }

  .composer-area {
    padding: 8px 12px 6px;
  }

  .chat-usage {
    flex-wrap: wrap;
    gap: 6px;
  }

  .usage-meta {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
