<template>
  <div ref="messagesContainer" class="messages-container" @scroll="$emit('scroll')">
    <div v-if="messages.length === 0" class="messages-empty">
      <div class="empty-orb" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
          <path d="M18.5 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1z" />
        </svg>
      </div>
      <p class="empty-title">{{ t('开始与 AI 助手协作') }}</p>
      <p class="hint">
        {{ emptyLabel ? t('工作区已就绪：{name}', { name: emptyLabel }) : t('选择工作区后，AI 可以读取与生成文件') }}
      </p>
      <div class="starter-grid">
        <button v-for="starter in starterPrompts" :key="starter.title" @click="useStarter(starter)">
          <span class="starter-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path :d="starter.icon" />
            </svg>
          </span>
          <span class="starter-copy">
            <strong>{{ t(starter.title) }}</strong>
            <span>{{ t(starter.hint) }}</span>
          </span>
        </button>
      </div>
    </div>
    <div v-for="(msg, index) in messages" :key="index" class="message" :class="msg.role" :data-message-index="index">
      <div class="message-avatar">
        <span v-if="msg.role === 'user'">{{ t('你') }}</span>
        <span v-else>AI</span>
      </div>
      <div class="message-content">
        <div
          v-if="hasThoughtChain(msg)"
          class="thought-chain"
          :class="{ streaming: msg.isStreaming, collapsed: !isThoughtExpanded(index, msg) }"
        >
          <button type="button" class="thought-chain-head" @click="toggleThought(index, msg)">
            <span class="thought-chain-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="6" cy="6" r="2" />
                <circle cx="18" cy="18" r="2" />
                <path d="M6 8v4a4 4 0 0 0 4 4h4" />
                <path d="M14 4h3a1 1 0 0 1 1 1v3" />
              </svg>
            </span>
            <span class="thought-chain-copy">
              <span class="thought-chain-title">{{ t('思维链') }}</span>
              <span class="thought-chain-summary">{{ thoughtSummary(msg) }}</span>
            </span>
            <span v-if="msg.isStreaming" class="thought-live"><span />{{ t('实时') }}</span>
            <svg
              class="thought-chain-chevron"
              :class="{ expanded: isThoughtExpanded(index, msg) }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div v-show="isThoughtExpanded(index, msg)" class="thought-chain-body">
            <div v-if="msg.plan && msg.plan.steps && msg.plan.steps.length" class="agent-plan">
              <div class="agent-plan-head">
                <span class="agent-plan-badge">{{ t('计划') }}</span>
                <span class="agent-plan-goal">{{ msg.plan.goal }}</span>
              </div>
              <ol class="agent-plan-list">
                <li
                  v-for="(step, stepIndex) in msg.plan.steps"
                  :key="stepIndex"
                  class="agent-plan-step"
                  :class="`is-${planStepState(step)}`"
                >
                  <span class="agent-plan-index">
                    <span v-if="planStepState(step) === 'running'" class="mini-spinner" />
                    <template v-else-if="planStepState(step) === 'done'">✓</template>
                    <template v-else-if="planStepState(step) === 'failed'">!</template>
                    <template v-else>{{ stepIndex + 1 }}</template>
                  </span>
                  <span class="agent-plan-text">{{ planStepText(step) }}</span>
                </li>
              </ol>
            </div>
            <div v-if="msg.thinking" class="chain-section thinking-section">
              <div class="chain-section-head">
                <span class="chain-section-dot think" />
                <span>{{ t('思考过程') }}</span>
                <span v-if="msg.isStreaming" class="chain-section-live">{{ t('生成中') }}</span>
              </div>
              <div class="thinking-content" :class="{ 'is-clamped': isThinkingClamped(index, msg) }">
                {{ msg.thinking }}
              </div>
              <button v-if="isThinkingLong(msg)" type="button" class="clamp-toggle" @click="toggleThinking(index)">
                {{ isThinkingClamped(index, msg) ? t('展开思考过程') : t('收起思考过程') }}
              </button>
            </div>
            <div v-if="msg.steps && msg.steps.length" class="chain-section">
              <div class="chain-section-head">
                <span class="chain-section-dot run" />
                <span>{{ t('执行步骤') }}</span>
                <span class="chain-section-meta">{{ chainSummary(msg.steps) }}</span>
              </div>
              <div class="agent-steps-list">
                <button
                  v-if="hiddenStepCount(msg)"
                  type="button"
                  class="steps-more"
                  :aria-expanded="isStepsExpanded(index)"
                  @click="toggleSteps(index)"
                >
                  <svg
                    class="steps-more-chevron"
                    :class="{ expanded: isStepsExpanded(index) }"
                    viewBox="0 0 24 24"
                    width="12"
                    height="12"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span>{{
                    isStepsExpanded(index)
                      ? t('收起更早的 {count} 条工具调用', { count: hiddenStepCount(msg) })
                      : t('展开更早的 {count} 条工具调用', { count: hiddenStepCount(msg) })
                  }}</span>
                </button>
                <div
                  v-for="(step, stepIndex) in msg.steps"
                  v-show="isStepVisible(index, stepIndex, msg)"
                  :key="step.id || `${stepIndex}-${step.name}`"
                  class="agent-step"
                  :class="step.status"
                >
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
                      <span v-if="step.duration" class="agent-step-duration">{{ formatDuration(step.duration) }}</span>
                      <span v-if="step.truncated" class="agent-step-truncated">{{ t('已截断') }}</span>
                      <span v-if="step.untrusted" class="agent-step-tag">{{ t('不可信') }}</span>
                      <span v-if="step.injectionSuspected" class="agent-step-tag warning">{{ t('疑似注入') }}</span>
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
                        <div class="step-label">{{ t('参数') }}</div>
                        <pre>{{ pretty(step.arguments) }}</pre>
                      </div>
                      <div v-if="step.metadata && (step.metadata.path || step.metadata.finalUrl)" class="step-block">
                        <div class="step-label">{{ step.metadata.finalUrl ? t('来源') : t('产出') }}</div>
                        <pre>{{ step.metadata.finalUrl || step.metadata.destination || step.metadata.path }}</pre>
                      </div>
                      <div v-if="step.result" class="step-block">
                        <div class="step-label">{{ t('结果') }}</div>
                        <pre>{{ step.result }}</pre>
                        <div v-if="step.truncated" class="step-truncated-note">
                          {{ t('结果过长已截断，完整内容可由模型通过 result-read 分页读取') }}
                        </div>
                        <div v-if="step.injectionSuspected" class="step-injection-note">
                          {{ t('该结果包含疑似提示注入内容，已按不可信数据交给模型，未执行其中的指令') }}
                        </div>
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
          </div>
        </div>
        <div v-if="handledApprovals(msg).length" class="approval-list">
          <ChatApprovalCard
            v-for="approval in handledApprovals(msg)"
            :key="approval.approvalId"
            :approval="approval"
            @respond="$emit('respond-approval', $event)"
          />
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
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>{{ att.name }}</span>
            </div>
          </template>
        </div>
        <div v-if="msg.content || (msg.isStreaming && !hasThoughtChain(msg))" class="message-bubble">
          <div
            v-if="msg.content"
            class="message-text"
            :class="{ 'is-clamped': isContentClamped(index, msg) }"
            v-html="messageHtml(msg)"
          />
          <div v-if="msg.isStreaming && !msg.content && !hasThoughtChain(msg)" class="loading-indicator">
            <span /><span /><span />
          </div>
          <button v-if="isContentLong(msg)" type="button" class="clamp-toggle" @click="toggleContent(index)">
            {{ isContentClamped(index, msg) ? t('展开全文') : t('收起') }}
          </button>
          <button
            v-if="msg.role === 'assistant' && msg.content && !msg.isStreaming"
            class="copy-btn"
            :title="t('复制')"
            @click="$emit('copy', msg.content)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>
        <div v-if="msg.summary" class="agent-summary">
          <div class="agent-summary-head">
            <span class="agent-summary-title">{{ t('执行摘要') }}</span>
            <span class="agent-summary-badge" :class="msg.summary.termination">
              {{ msg.summary.terminationText }}
            </span>
            <button type="button" class="agent-summary-trace" @click="$emit('open-trace', msg)">
              {{ t('运行轨迹') }}
            </button>
          </div>
          <div class="agent-summary-metrics">
            <span>{{ t('轮次 {count}', { count: msg.summary.iterations }) }}</span>
            <span>{{ t('工具 {count} 次', { count: msg.summary.toolCalls }) }}</span>
            <span>{{
              t('成功 {success} / 失败 {failed}', {
                success: msg.summary.toolSuccess,
                failed: msg.summary.toolFailed
              })
            }}</span>
            <span>{{ t('耗时 {duration}', { duration: formatDuration(msg.summary.duration) || '0ms' }) }}</span>
          </div>
          <div v-if="msg.summary.tools && msg.summary.tools.length" class="agent-summary-tools">
            {{ t('使用工具：{tools}', { tools: msg.summary.tools.join(t('、')) }) }}
          </div>
          <ul v-if="msg.summary.limitations && msg.summary.limitations.length" class="agent-summary-limitations">
            <li v-for="(item, itemIndex) in msg.summary.limitations" :key="itemIndex">{{ item }}</li>
          </ul>
        </div>
        <div v-if="msg.fileChanges && msg.fileChanges.length" class="run-changes">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <polyline points="3 3 3 9 9 9" />
          </svg>
          <span class="run-changes-text">{{ t('本次共修改 {count} 个文件', { count: msg.fileChanges.length }) }}</span>
          <span v-if="msg.rolledBack" class="run-changes-done">{{ t('已撤销') }}</span>
          <button v-else type="button" class="run-changes-btn" :disabled="rollbackBusy" @click="$emit('rollback', msg)">
            {{ t('撤销本次修改') }}
          </button>
        </div>
        <div v-if="msg.usage" class="message-usage">
          <span>{{ t('输入 {value}', { value: formatTokens(msg.usage.prompt_tokens) }) }}</span>
          <span>{{ t('输出 {value}', { value: formatTokens(msg.usage.completion_tokens) }) }}</span>
          <span>{{ t('合计 {value} tokens', { value: formatTokens(msg.usage.total_tokens) }) }}</span>
          <span v-if="msg.usage.estimated" class="message-usage-estimated">{{ t('含估算') }}</span>
        </div>
        <div v-if="msg.stopped" class="message-stopped">{{ t('已停止生成') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { t } from '@/i18n'
import { renderMarkdown } from '@/utils/markdown'
import ChatApprovalCard from '@/components/ChatApprovalCard.vue'

defineProps({
  messages: { type: Array, default: () => [] },
  starterPrompts: { type: Array, default: () => [] },
  emptyLabel: { type: String, default: '' },
  rollbackBusy: { type: Boolean, default: false },
  formatTokens: { type: Function, required: true }
})

const emit = defineEmits(['use-starter', 'respond-approval', 'open-trace', 'copy', 'rollback', 'scroll'])

const messagesContainer = ref(null)
const expandedSteps = ref({})
const thoughtExpanded = ref({})
const moreStepsExpanded = ref({})
const thinkingExpanded = ref({})
const contentExpanded = ref({})

const VISIBLE_STEPS = 3
const THINKING_CLAMP_CHARS = 600
const CONTENT_CLAMP_CHARS = 1600

defineExpose({ messagesContainer })

function useStarter(starter) {
  emit('use-starter', t(starter.prompt))
}

function handledApprovals(message) {
  return (message.approvals || []).filter((approval) => approval.status !== 'pending')
}

function hasThoughtChain(message) {
  return Boolean(
    (message?.plan && message.plan.steps && message.plan.steps.length) ||
    message?.thinking ||
    (message?.steps && message.steps.length) ||
    (message?.reflections && message.reflections.length)
  )
}

function isStepsExpanded(index) {
  return Boolean(moreStepsExpanded.value[index])
}

function hiddenStepCount(message) {
  return Math.max(0, (message?.steps || []).length - VISIBLE_STEPS)
}

function isStepVisible(index, stepIndex, message) {
  const total = message?.steps?.length || 0
  if (total <= VISIBLE_STEPS || isStepsExpanded(index)) return true
  return stepIndex >= total - VISIBLE_STEPS
}

function toggleSteps(index) {
  moreStepsExpanded.value = { ...moreStepsExpanded.value, [index]: !isStepsExpanded(index) }
}

function isThinkingLong(message) {
  return Boolean(message && !message.isStreaming && (message.thinking || '').length > THINKING_CLAMP_CHARS)
}

function isThinkingClamped(index, message) {
  return isThinkingLong(message) && !thinkingExpanded.value[index]
}

function toggleThinking(index) {
  thinkingExpanded.value = { ...thinkingExpanded.value, [index]: !thinkingExpanded.value[index] }
}

function isContentLong(message) {
  return Boolean(
    message &&
    message.role === 'assistant' &&
    !message.isStreaming &&
    (message.content || '').length > CONTENT_CLAMP_CHARS
  )
}

function isContentClamped(index, message) {
  return isContentLong(message) && !contentExpanded.value[index]
}

function toggleContent(index) {
  contentExpanded.value = { ...contentExpanded.value, [index]: !contentExpanded.value[index] }
}

function isThoughtExpanded(index, message) {
  const explicit = thoughtExpanded.value[index]
  if (explicit !== undefined) return explicit
  return Boolean(message?.isStreaming)
}

function toggleThought(index, message) {
  thoughtExpanded.value = { ...thoughtExpanded.value, [index]: !isThoughtExpanded(index, message) }
}

function thoughtSummary(message) {
  const parts = []
  if (message.isStreaming) {
    if (message.thinking) parts.push(t('思考中'))
    const running = (message.steps || []).filter((step) => step.status === 'running').length
    if (running > 0) parts.push(t('{count} 个步骤执行中', { count: running }))
    if (message.plan?.steps?.length) parts.push(t('计划 {count} 步', { count: message.plan.steps.length }))
    return parts.join(' · ') || t('正在分析任务')
  }
  if (message.plan?.steps?.length) parts.push(t('计划 {count} 步', { count: message.plan.steps.length }))
  if (message.thinking) parts.push(t('已思考'))
  if (message.steps?.length) parts.push(chainSummary(message.steps))
  const failed = (message.reflections || []).filter((item) => item.status === 'error').length
  if (failed > 0) parts.push(t('{count} 个提醒', { count: failed }))
  return parts.join(' · ') || t('已完成')
}

function planStepText(step) {
  return typeof step === 'string' ? step : step?.text || ''
}

function planStepState(step) {
  return (step && typeof step === 'object' && step.state) || 'pending'
}

function chainSummary(steps) {
  const total = steps.length
  const running = steps.filter((step) => step.status === 'running').length
  const failed = steps.filter((step) => step.status === 'error').length
  if (running > 0) return t('{total} 步 · {running} 个执行中', { total, running })
  if (failed > 0) return t('{total} 步 · {failed} 个失败', { total, failed })
  return t('{total} 步 · 全部完成', { total })
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
  expandedSteps.value = { ...expandedSteps.value, [key]: !isStepExpanded(index, step) }
}

function isStepExpanded(index, step) {
  const explicit = expandedSteps.value[stepKey(index, step)]
  if (explicit !== undefined) return explicit
  return step.status === 'running'
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

const STREAM_CARET = '<span class="stream-caret" aria-hidden="true"></span>'

function messageHtml(msg) {
  const html = renderMarkdown(msg.content)
  if (!msg.isStreaming || msg.role !== 'assistant' || !html) return html
  return html.endsWith('<br>') ? `${html.slice(0, -4)}${STREAM_CARET}<br>` : `${html}${STREAM_CARET}`
}
</script>
