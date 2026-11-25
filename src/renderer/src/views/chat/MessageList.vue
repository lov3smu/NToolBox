<template>
  <div
    ref="messagesContainer"
    class="messages-container"
    :class="{ 'is-motion': animateEntry }"
    role="log"
    aria-live="polite"
    aria-relevant="additions text"
    :aria-label="t('对话消息')"
    @scroll="$emit('scroll')"
  >
    <div v-if="messages.length === 0" class="messages-empty">
      <div class="empty-orb" aria-hidden="true">
        <AppIcon name="sparkles" :stroke-width="1.6" />
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
    <div
      v-for="(msg, index) in messages"
      :key="msg.id || index"
      class="message"
      :class="[msg.role, { 'is-enter': animateEntry && Boolean(enterMessageId) && msg.id === enterMessageId }]"
      :data-message-index="index"
    >
      <div class="message-avatar">
        <span v-if="msg.role === 'user'">{{ t('你') }}</span>
        <span v-else>AI</span>
      </div>
      <div class="chat-message-content">
        <div
          v-if="hasThoughtChain(msg)"
          class="thought-chain"
          :class="{
            streaming: msg.isStreaming,
            collapsed: !isThoughtExpanded(index, msg),
            'is-done': !msg.isStreaming,
            'is-open': isThoughtExpanded(index, msg)
          }"
        >
          <button type="button" class="thought-chain-head" @click="toggleThought(index, msg)">
            <span class="thought-chain-icon">
              <AppIcon name="network" />
            </span>
            <span class="thought-chain-copy">
              <span class="thought-chain-title">{{ t('思维链') }}</span>
              <span class="thought-chain-summary">{{ thoughtSummary(msg) }}</span>
            </span>
            <span v-if="msg.isStreaming" class="thought-live"><span />{{ t('实时') }}</span>
            <AppIcon
              name="chevron-down"
              class="thought-chain-chevron"
              :class="{ expanded: isThoughtExpanded(index, msg) }"
            />
          </button>
          <div v-show="isThoughtExpanded(index, msg)" class="thought-chain-body">
            <div v-if="msg.plan && msg.plan.steps && msg.plan.steps.length" class="agent-plan">
              <div class="agent-plan-head">
                <span class="agent-plan-badge">{{ t('计划') }}</span>
                <span class="agent-plan-goal">{{ msg.plan.goal }}</span>
              </div>
              <ol class="agent-plan-list">
                <li v-for="(step, stepIndex) in msg.plan.steps" :key="stepIndex" class="plan-reveal">
                  <div class="agent-plan-step" :class="`is-${planStepState(step)}`">
                    <span class="agent-plan-index">
                      <Transition name="dot-swap" mode="out-in">
                        <span v-if="planStepState(step) === 'running'" key="running" class="chat-mini-spinner" />
                        <span v-else-if="planStepState(step) === 'done'" key="done">✓</span>
                        <span v-else-if="planStepState(step) === 'failed'" key="failed">!</span>
                        <span v-else key="idle">{{ stepIndex + 1 }}</span>
                      </Transition>
                    </span>
                    <span class="agent-plan-text">{{ planStepText(step) }}</span>
                  </div>
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
                  <AppIcon
                    name="chevron-down"
                    :size="12"
                    class="steps-more-chevron"
                    :class="{ expanded: isStepsExpanded(index) }"
                  />
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
                  class="step-reveal"
                >
                  <div class="agent-step" :class="step.status">
                    <div class="agent-step-rail">
                      <span class="agent-step-dot">
                        <Transition name="dot-swap" mode="out-in">
                          <span v-if="step.status === 'running'" key="running" class="chat-mini-spinner" />
                          <AppIcon
                            v-else-if="step.status === 'success'"
                            key="success"
                            name="check"
                            :size="11"
                            :stroke-width="3"
                          />
                          <AppIcon v-else key="error" name="close" :size="11" :stroke-width="3" />
                        </Transition>
                      </span>
                    </div>
                    <div class="agent-step-main">
                      <button type="button" class="agent-step-head" @click="toggleStep(index, step)">
                        <span class="agent-step-name">{{ step.name }}</span>
                        <span class="agent-step-status">{{ step.statusText }}</span>
                        <span v-if="step.duration" class="agent-step-duration">{{
                          formatDurationMs(step.duration)
                        }}</span>
                        <span v-if="step.truncated" class="agent-step-truncated">{{ t('已截断') }}</span>
                        <span v-if="step.untrusted" class="agent-step-tag">{{ t('不可信') }}</span>
                        <span v-if="step.injectionSuspected" class="agent-step-tag warning">{{ t('疑似注入') }}</span>
                        <AppIcon
                          name="chevron-down"
                          :size="12"
                          class="agent-step-chevron"
                          :class="{ expanded: isStepExpanded(index, step) }"
                        />
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
                        <ChatResultCard v-if="step.metadata" :metadata="step.metadata" />
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
                        <div v-if="step.status === 'error' && !msg.isStreaming" class="step-retry-row">
                          <button
                            type="button"
                            class="step-retry"
                            :disabled="busy"
                            @click="$emit('retry-step', { index, message: msg, step })"
                          >
                            {{ t('重试此步骤') }}
                          </button>
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
                class="reflection-reveal"
              >
                <div class="agent-reflection" :class="reflection.status">
                  <span class="agent-reflection-icon" aria-hidden="true">
                    <AppIcon v-if="reflection.status === 'error'" name="close" :size="11" :stroke-width="3" />
                    <AppIcon v-else name="alert-circle" :size="11" :stroke-width="3" />
                  </span>
                  <span class="agent-reflection-text">{{ reflection.text }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          v-if="handledApprovals(msg).length"
          class="approval-history"
          :class="{ 'is-open': isApprovalsOpen(index) }"
        >
          <button
            type="button"
            class="approval-history-head"
            :aria-expanded="isApprovalsOpen(index)"
            @click="toggleApprovals(index)"
          >
            <span class="approval-history-icon">
              <AppIcon name="lock" :size="13" />
            </span>
            <span class="approval-history-copy">
              <span class="approval-history-title">{{ t('授权记录') }}</span>
              <span class="approval-history-summary">{{ approvalHistorySummary(msg) }}</span>
            </span>
            <AppIcon
              name="chevron-down"
              :size="13"
              class="approval-history-chevron"
              :class="{ expanded: isApprovalsOpen(index) }"
            />
          </button>
          <TransitionGroup v-show="isApprovalsOpen(index)" name="approval-item" tag="div" class="approval-list">
            <div v-for="approval in handledApprovals(msg)" :key="approval.approvalId" class="approval-reveal">
              <ChatApprovalCard :approval="approval" compact @respond="$emit('respond-approval', $event)" />
            </div>
          </TransitionGroup>
        </div>
        <div v-if="msg.contextNote" class="agent-context-note">
          <AppIcon name="rotate-ccw" :size="12" />
          <span>{{ msg.contextNote }}</span>
        </div>
        <div v-if="msg.notices && msg.notices.length" class="agent-notices">
          <div v-for="(note, noteIndex) in msg.notices" :key="noteIndex">{{ note }}</div>
        </div>
        <div v-if="msg.attachments && msg.attachments.length" class="message-attachments">
          <template v-for="att in msg.attachments" :key="att.id || att.name">
            <button
              v-if="att.kind === 'image'"
              type="button"
              class="message-image-btn"
              :title="att.name"
              :aria-label="t('图片预览')"
              @click="previewImage(att.dataUrl, att.name)"
            >
              <img :src="att.dataUrl" :alt="att.name" class="message-image" />
            </button>
            <div v-else class="message-file">
              <AppIcon name="file" :size="13" />
              <span>{{ att.name }}</span>
            </div>
          </template>
        </div>
        <div v-if="msg.content || (msg.isStreaming && !hasThoughtChain(msg))" class="message-bubble">
          <div
            v-if="msg.content"
            class="chat-message-text"
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
            class="chat-copy-btn"
            :title="t('复制')"
            @click="$emit('copy', msg.content)"
          >
            <AppIcon name="copy" :size="14" />
          </button>
        </div>
        <div v-if="msg.role === 'user' && !msg.isStreaming" class="user-message-actions">
          <span v-if="msg.createdAt" class="message-action-time">{{ formatDateTime(msg.createdAt, 'datetime') }}</span>
          <button
            v-if="msg.content"
            type="button"
            class="message-action-btn"
            :title="t('复制')"
            :aria-label="t('复制')"
            @click="$emit('copy', msg.content)"
          >
            <AppIcon name="copy" :size="12" />
          </button>
          <button
            type="button"
            class="message-action-btn"
            :title="t('编辑')"
            :aria-label="t('编辑')"
            :disabled="busy"
            @click="$emit('edit', { index, message: msg })"
          >
            <AppIcon name="edit" :size="12" />
          </button>
        </div>
        <div v-if="msg.summary" class="agent-summary" :class="{ 'is-open': isSummaryOpen(index) }">
          <div class="agent-summary-head">
            <button
              type="button"
              class="agent-summary-toggle"
              :aria-expanded="isSummaryOpen(index)"
              @click="toggleSummary(index)"
            >
              <span class="agent-summary-title">{{ t('执行摘要') }}</span>
              <span class="agent-summary-badge" :class="msg.summary.termination">
                {{ msg.summary.terminationText }}
              </span>
              <span class="agent-summary-overview">{{ summaryOverview(msg.summary) }}</span>
              <AppIcon
                name="chevron-down"
                :size="13"
                class="agent-summary-chevron"
                :class="{ expanded: isSummaryOpen(index) }"
              />
            </button>
            <button
              v-if="msg.summary.canContinue"
              type="button"
              class="agent-summary-continue"
              :disabled="busy"
              @click="$emit('continue', msg)"
            >
              {{ t('继续 {count} 步', { count: msg.summary.remainingSteps.length }) }}
            </button>
            <button type="button" class="agent-summary-trace" @click="$emit('open-trace', msg)">
              {{ t('运行轨迹') }}
            </button>
          </div>
          <div v-show="isSummaryOpen(index)" class="agent-summary-body">
            <div class="agent-summary-metrics">
              <span v-if="msg.summary.iterationBudget">{{
                t('轮次 {used}/{budget}', {
                  used: msg.summary.iterations,
                  budget: msg.summary.iterationBudget
                })
              }}</span>
              <span v-else>{{ t('轮次 {count}', { count: msg.summary.iterations }) }}</span>
              <span>{{ t('工具 {count} 次', { count: msg.summary.toolCalls }) }}</span>
              <span>{{
                t('成功 {success} / 失败 {failed}', {
                  success: msg.summary.toolSuccess,
                  failed: msg.summary.toolFailed
                })
              }}</span>
              <span>{{ t('耗时 {duration}', { duration: formatDurationMs(msg.summary.duration) || '0ms' }) }}</span>
            </div>
            <div v-if="msg.summary.tools && msg.summary.tools.length" class="agent-summary-tools">
              {{ t('使用工具：{tools}', { tools: msg.summary.tools.join(t('、')) }) }}
            </div>
            <ul v-if="msg.summary.limitations && msg.summary.limitations.length" class="agent-summary-limitations">
              <li v-for="(item, itemIndex) in msg.summary.limitations" :key="itemIndex">{{ item }}</li>
            </ul>
            <div v-if="msg.summary.canContinue" class="agent-summary-remaining">
              <div class="agent-summary-remaining-title">{{ t('未完成的步骤') }}</div>
              <ol>
                <li v-for="(stepText, stepIndex) in msg.summary.remainingSteps" :key="stepIndex">
                  {{ stepText }}
                </li>
              </ol>
            </div>
          </div>
        </div>
        <div v-if="msg.fileChanges && msg.fileChanges.length" class="run-changes">
          <AppIcon name="rotate-ccw" :size="14" />
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
import { ref, watch } from 'vue'
import { t } from '@/i18n'
import { formatDurationMs } from '@shared/format'
import { formatDateTime } from '@/utils/format'
import { renderMarkdown } from '@/utils/markdown'
import ChatApprovalCard from './components/ChatApprovalCard.vue'
import { previewImage } from '@/composables'
import ChatResultCard from './ChatResultCard.vue'

import AppIcon from '@/components/AppIcon.vue'
const props = defineProps({
  messages: { type: Array, default: () => [] },
  starterPrompts: { type: Array, default: () => [] },
  emptyLabel: { type: String, default: '' },
  rollbackBusy: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  animateEntry: { type: Boolean, default: true },
  formatTokens: { type: Function, required: true }
})

const emit = defineEmits([
  'use-starter',
  'respond-approval',
  'open-trace',
  'copy',
  'edit',
  'rollback',
  'continue',
  'retry-step',
  'scroll'
])

const messagesContainer = ref(null)
const enterMessageId = ref('')
let previousMessageList = null
let previousMessageCount = 0
let previousTailId = ''

watch(
  () => [props.messages.length, props.messages[props.messages.length - 1]?.id],
  ([count, tailId]) => {
    const appended =
      props.messages === previousMessageList &&
      count === previousMessageCount + 1 &&
      Boolean(tailId) &&
      tailId !== previousTailId
    if (appended) enterMessageId.value = tailId
    else if (props.messages !== previousMessageList) enterMessageId.value = ''
    previousMessageList = props.messages
    previousMessageCount = count
    previousTailId = tailId || ''
  },
  { immediate: true, flush: 'sync' }
)

watch(
  () => props.animateEntry,
  (value) => {
    if (!value) enterMessageId.value = ''
  }
)
const expandedSteps = ref({})
const thoughtExpanded = ref({})
const moreStepsExpanded = ref({})
const thinkingExpanded = ref({})
const contentExpanded = ref({})
const approvalsExpanded = ref({})
const summaryExpanded = ref({})

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

function isApprovalsOpen(index) {
  return Boolean(approvalsExpanded.value[index])
}

function toggleApprovals(index) {
  approvalsExpanded.value = { ...approvalsExpanded.value, [index]: !isApprovalsOpen(index) }
}

function approvalHistorySummary(message) {
  const list = handledApprovals(message)
  const allowed = list.filter((approval) => approval.status === 'allowed' || approval.status === 'always').length
  const denied = list.filter((approval) => approval.status === 'denied').length
  const expired = list.filter((approval) => approval.status === 'expired').length
  const parts = [t('{count} 项已处理', { count: list.length })]
  if (allowed) parts.push(t('允许 {count}', { count: allowed }))
  if (denied) parts.push(t('拒绝 {count}', { count: denied }))
  if (expired) parts.push(t('失效 {count}', { count: expired }))
  return parts.join(' · ')
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

function isSummaryOpen(index) {
  return Boolean(summaryExpanded.value[index])
}

function toggleSummary(index) {
  summaryExpanded.value = { ...summaryExpanded.value, [index]: !isSummaryOpen(index) }
}

function summaryOverview(summary) {
  return [
    t('轮次 {count}', { count: summary.iterations }),
    t('工具 {count} 次', { count: summary.toolCalls }),
    t('耗时 {duration}', { duration: formatDurationMs(summary.duration) || '0ms' })
  ].join(' · ')
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
    if (message.progress?.maxIterations) {
      parts.push(
        t('轮次 {used}/{budget}', {
          used: message.progress.iteration,
          budget: message.progress.maxIterations
        })
      )
    }
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
const htmlCache = new WeakMap()

function messageHtml(msg) {
  let html = ''
  if (msg.content) {
    const cached = htmlCache.get(msg)
    if (cached && cached.content === msg.content) {
      html = cached.html
    } else {
      html = renderMarkdown(msg.content)
      htmlCache.set(msg, { content: msg.content, html })
    }
  }
  if (!msg.isStreaming || msg.role !== 'assistant' || !html) return html
  return html.endsWith('<br>') ? `${html.slice(0, -4)}${STREAM_CARET}<br>` : `${html}${STREAM_CARET}`
}
</script>
