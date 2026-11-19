<template>
  <div class="runs-panel">
    <div class="runs-toolbar">
      <label class="runs-search">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input v-model="keyword" type="text" :placeholder="t('筛选目标、模型或终止原因')" />
      </label>
      <span class="runs-count">{{ filteredRuns.length }} / {{ runs.length }}</span>
      <div class="runs-toolbar-actions">
        <button type="button" class="runs-btn" :disabled="loading" @click="loadRuns()">{{ t('刷新') }}</button>
        <button type="button" class="runs-btn" :disabled="!selectedId || exporting" @click="handleExport">
          {{ exporting ? t('导出中…') : t('导出 JSON') }}
        </button>
      </div>
    </div>

    <div class="runs-body">
      <div class="runs-list">
        <div class="runs-list-body">
          <div v-if="loading" class="runs-hint">{{ t('加载中…') }}</div>
          <div v-else-if="listError" class="runs-hint error">{{ listError }}</div>
          <div v-else-if="!filteredRuns.length" class="runs-hint">
            {{ t('暂无运行轨迹，在 AI 助手中执行一次任务后再查看') }}
          </div>
          <button
            v-for="run in filteredRuns"
            :key="run.id"
            type="button"
            class="run-item"
            :class="{ active: run.id === selectedId }"
            @click="selectRun(run.id)"
          >
            <div class="run-item-top">
              <span class="run-item-time">{{ formatTime(run.startedAt) }}</span>
              <span class="run-badge" :class="run.termination || run.status">
                {{ terminationLabel(run.termination || run.status) }}
              </span>
            </div>
            <div class="run-item-goal">{{ run.goal || t('未记录目标') }}</div>
            <div class="run-item-meta">
              <span>{{ formatDuration(run.durationMs) }}</span>
              <span>{{ t('{count} 次工具', { count: run.toolCalls }) }}</span>
              <span v-if="run.model">{{ run.model }}</span>
            </div>
          </button>
        </div>
      </div>

      <section class="runs-detail">
        <div v-if="exportNote" class="runs-note">{{ exportNote }}</div>
        <div v-if="detailLoading" class="runs-hint">{{ t('读取中…') }}</div>
        <div v-else-if="detailError" class="runs-hint error">{{ detailError }}</div>
        <div v-else-if="!trace" class="runs-hint">{{ t('选择左侧的运行记录查看详情') }}</div>
        <div v-else class="runs-detail-body">
          <header class="run-detail-head">
            <div class="run-detail-title">
              <h2>{{ trace.plan?.goal || trace.summary?.goal || t('未记录目标') }}</h2>
              <span class="run-badge" :class="trace.termination || trace.status">
                {{ terminationLabel(trace.termination || trace.status) }}
              </span>
            </div>
            <div class="run-detail-meta">
              <span>{{ trace.meta?.provider || t('未知平台') }} · {{ trace.meta?.model || t('默认模型') }}</span>
              <span>{{ t('审批：{policy}', { policy: approvalLabel(trace.meta?.approvalPolicy) }) }}</span>
              <span>{{ formatTime(trace.startedAt) }}</span>
              <span>{{ t('耗时 {duration}', { duration: formatDuration(trace.durationMs) }) }}</span>
            </div>
          </header>

          <div class="run-stats">
            <div class="run-stat">
              <span class="run-stat-label">{{ t('轮次') }}</span>
              <strong>{{ trace.summary?.iterations ?? '—' }}</strong>
            </div>
            <div class="run-stat">
              <span class="run-stat-label">{{ t('工具调用') }}</span>
              <strong>{{ trace.summary?.toolCalls ?? trace.steps?.length ?? 0 }}</strong>
            </div>
            <div class="run-stat">
              <span class="run-stat-label">{{ t('成功 / 失败') }}</span>
              <strong>{{ successCount }} / {{ failCount }}</strong>
            </div>
            <div class="run-stat">
              <span class="run-stat-label">Token</span>
              <strong>{{ trace.usage?.total_tokens ?? '—' }}</strong>
            </div>
            <div class="run-stat">
              <span class="run-stat-label">{{ t('步骤耗时峰值') }}</span>
              <strong>{{ formatDuration(longestStep) || '—' }}</strong>
            </div>
          </div>

          <section v-if="trace.plan?.steps?.length" class="run-section">
            <div class="run-section-title">{{ t('执行计划') }}</div>
            <ol class="run-plan">
              <li v-for="(step, index) in trace.plan.steps" :key="index" :class="planState(step)">
                <span class="run-plan-index">{{ index + 1 }}</span>
                <span class="run-plan-text">{{ planText(step) }}</span>
                <span class="run-plan-state">{{ planStateLabel(step) }}</span>
              </li>
            </ol>
          </section>

          <section class="run-section">
            <div class="run-section-title">{{ t('工具时间线（{count}）', { count: trace.steps?.length || 0 }) }}</div>
            <ol v-if="trace.steps?.length" class="run-timeline">
              <li
                v-for="step in trace.steps"
                :key="step.index"
                class="run-step"
                :class="{ fail: step.success === false }"
              >
                <div class="run-step-rail">
                  <span class="run-step-dot" :class="step.success ? 'ok' : 'fail'">{{ step.index }}</span>
                </div>
                <div class="run-step-main">
                  <div class="run-step-head">
                    <strong class="run-step-tool">{{ step.tool || t('未知工具') }}</strong>
                    <span class="run-step-args" :title="step.arguments">{{ step.arguments || '—' }}</span>
                    <span class="run-step-duration">{{ formatDuration(step.duration) }}</span>
                  </div>
                  <div class="run-step-bar">
                    <span class="run-step-bar-fill" :style="{ width: stepBarWidth(step) }" />
                  </div>
                  <div class="run-step-tags">
                    <span v-if="step.risk && step.risk !== 'read'" class="run-tag" :class="step.risk">
                      {{ riskLabel(step.risk) }}
                    </span>
                    <span v-if="step.approval === 'denied'" class="run-tag denied">{{ t('已拒绝') }}</span>
                    <span v-else-if="step.approval === 'remembered'" class="run-tag">{{ t('白名单') }}</span>
                    <span class="run-tag" :class="step.success ? 'ok' : 'fail'">{{
                      step.success ? t('成功') : t('失败')
                    }}</span>
                    <span v-if="step.approvalMs" class="run-tag">
                      {{ t('审批 {duration}', { duration: formatDuration(step.approvalMs) }) }}
                    </span>
                    <span v-if="step.truncated" class="run-tag">{{ t('结果已截断') }}</span>
                    <span v-if="step.untrusted" class="run-tag">{{ t('不可信来源') }}</span>
                    <span v-if="step.injectionSuspected" class="run-tag fail">{{ t('疑似提示注入') }}</span>
                    <span class="run-tag muted">{{ formatTime(step.at) }}</span>
                  </div>
                  <details v-if="step.result" class="run-step-result">
                    <summary>{{ t('结果摘要') }}</summary>
                    <pre>{{ step.result }}</pre>
                    <p v-if="step.injectionSnippet" class="run-injection">
                      {{ t('注入特征：{snippet}', { snippet: step.injectionSnippet }) }}
                    </p>
                  </details>
                </div>
              </li>
            </ol>
            <div v-else class="runs-hint">{{ t('本次运行未调用工具') }}</div>
          </section>

          <section v-if="trace.reflections?.length" class="run-section">
            <div class="run-section-title">{{ t('反思记录') }}</div>
            <ul class="run-reflections">
              <li v-for="(item, index) in trace.reflections" :key="index" :class="item.status">
                <strong>{{ item.name }}</strong>
                <span>{{ item.text }}</span>
              </li>
            </ul>
          </section>

          <section v-if="trace.summary?.limitations?.length" class="run-section">
            <div class="run-section-title">{{ t('执行限制') }}</div>
            <ul class="run-limitations">
              <li v-for="(item, index) in trace.summary.limitations" :key="index">{{ item }}</li>
            </ul>
          </section>

          <section v-if="trace.contentPreview" class="run-section">
            <details class="run-preview">
              <summary>{{ t('最终输出（前 2000 字）') }}</summary>
              <pre>{{ trace.contentPreview }}</pre>
            </details>
          </section>

          <p v-if="trace.error" class="run-error">{{ t('终止原因：{reason}', { reason: trace.error }) }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { listRunTraces, readRunTrace, exportRunTrace } from '@/api'

const props = defineProps({
  focusRunId: {
    type: String,
    default: ''
  }
})

const TERMINATION_LABELS = {
  get goal_reached() {
    return t('目标完成')
  },
  get cancelled() {
    return t('用户停止')
  },
  get max_steps() {
    return t('达到最大轮次')
  },
  get timeout() {
    return t('执行超时')
  },
  get error() {
    return t('执行异常')
  },
  get running() {
    return t('进行中')
  },
  get ended() {
    return t('已结束')
  }
}
const APPROVAL_LABELS = {
  get ask() {
    return t('写操作前询问')
  },
  get auto() {
    return t('自动执行')
  },
  get chat() {
    return t('仅对话')
  }
}
const RISK_LABELS = {
  get read() {
    return t('只读')
  },
  get write() {
    return t('写入')
  },
  get destructive() {
    return t('破坏性')
  }
}
const PLAN_STATE_LABELS = {
  get pending() {
    return t('未开始')
  },
  get running() {
    return t('进行中')
  },
  get done() {
    return t('已完成')
  },
  get failed() {
    return t('失败')
  },
  get skipped() {
    return t('未执行')
  }
}

const runs = ref([])
const selectedId = ref('')
const trace = ref(null)
const keyword = ref('')
const loading = ref(false)
const detailLoading = ref(false)
const exporting = ref(false)
const listError = ref('')
const detailError = ref('')
const exportNote = ref('')

const filteredRuns = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  if (!query) return runs.value
  return runs.value.filter((run) =>
    [run.goal, run.model, run.provider, terminationLabel(run.termination || run.status)].some((value) =>
      String(value || '')
        .toLowerCase()
        .includes(query)
    )
  )
})
const successCount = computed(() => (trace.value?.steps || []).filter((step) => step.success).length)
const failCount = computed(() => (trace.value?.steps || []).filter((step) => step.success === false).length)
const longestStep = computed(() => Math.max(0, ...(trace.value?.steps || []).map((step) => Number(step.duration) || 0)))

function terminationLabel(value) {
  return t(TERMINATION_LABELS[value] || t('已结束'))
}

function approvalLabel(value) {
  return t(APPROVAL_LABELS[value] || t('未记录'))
}

function riskLabel(value) {
  return RISK_LABELS[value] ? t(RISK_LABELS[value]) : value
}

function planText(step) {
  return typeof step === 'string' ? step : step?.text || ''
}

function planState(step) {
  return (step && typeof step === 'object' && step.state) || 'pending'
}

function planStateLabel(step) {
  const state = planState(step)
  return PLAN_STATE_LABELS[state] ? t(PLAN_STATE_LABELS[state]) : state
}

function formatDuration(ms) {
  const value = Number(ms) || 0
  if (value < 1000) return `${value}ms`
  if (value < 60000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.floor(value / 60000)}m${Math.round((value % 60000) / 1000)}s`
}

function formatTime(timestamp) {
  const value = Number(timestamp) || 0
  if (!value) return '—'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function stepBarWidth(step) {
  const max = longestStep.value
  const value = Number(step.duration) || 0
  if (!max || !value) return '4px'
  return `${Math.max(4, Math.round((value / max) * 100))}%`
}

async function loadTrace(id) {
  if (!id) {
    trace.value = null
    return
  }
  detailLoading.value = true
  detailError.value = ''
  exportNote.value = ''
  try {
    const result = await readRunTrace(id)
    if (result?.success) {
      trace.value = result.trace
    } else {
      trace.value = null
      detailError.value = result?.error || t('读取运行轨迹失败')
    }
  } catch (error) {
    trace.value = null
    detailError.value = error?.message || t('读取运行轨迹失败')
  } finally {
    detailLoading.value = false
  }
}

async function loadRuns(preferredId) {
  loading.value = true
  listError.value = ''
  try {
    const list = await listRunTraces(30)
    runs.value = Array.isArray(list) ? list : []
    const target =
      runs.value.find((item) => item.id === (preferredId || selectedId.value))?.id ||
      preferredId ||
      runs.value[0]?.id ||
      ''
    selectedId.value = target
    if (!target && !detailLoading.value) trace.value = null
  } catch (error) {
    runs.value = []
    listError.value = error?.message || t('加载运行轨迹失败')
  } finally {
    loading.value = false
  }
  if (selectedId.value) await loadTrace(selectedId.value)
}

function selectRun(id) {
  selectedId.value = id
  loadTrace(id)
}

async function handleExport() {
  if (!selectedId.value || exporting.value) return
  exporting.value = true
  detailError.value = ''
  exportNote.value = ''
  try {
    const result = await exportRunTrace(selectedId.value)
    if (result?.canceled) return
    if (result?.success) exportNote.value = t('已导出到 {path}', { path: result.filePath })
    else detailError.value = result?.error || t('导出失败')
  } catch (error) {
    detailError.value = error?.message || t('导出失败')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  loadRuns(props.focusRunId)
})
</script>

<style scoped>
.runs-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--surface);
}

.runs-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px dashed var(--border-color);
}

.runs-search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--control-height);
  padding: 0 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-tertiary);
}

.runs-search input {
  width: 220px;
  max-width: 30vw;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
}

.runs-count {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.runs-toolbar-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.runs-btn {
  height: var(--control-height);
  padding: 0 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.runs-btn:hover:not(:disabled) {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.runs-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.runs-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(200px, 280px) minmax(0, 1fr);
  gap: 12px;
  padding: 10px 14px 14px;
}

.runs-list,
.runs-detail {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.runs-list-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
}

.run-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.run-item:hover {
  background: var(--surface-hover);
}

.run-item.active {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.08);
}

.run-item-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.run-item-time {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.run-item-goal {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.run-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.run-badge {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

.run-badge.goal_reached {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
}

.run-badge.error,
.run-badge.timeout,
.run-badge.max_steps {
  background: rgba(var(--warning-rgb), 0.14);
  color: var(--warning-darker);
}

.run-badge.cancelled,
.run-badge.running {
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.runs-detail-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.run-detail-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.run-detail-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.run-detail-title h2 {
  margin: 0;
  font-size: var(--font-size-md);
  color: var(--text-primary);
  word-break: break-word;
}

.run-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.run-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}

.run-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.run-stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.run-stat strong {
  font-size: var(--font-size-md);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.run-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.run-section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text-secondary);
}

.run-plan {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.run-plan li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.run-plan-index {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-muted);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.run-plan li.done .run-plan-index {
  background: rgba(var(--success-rgb), 0.14);
  color: var(--success-dark);
}

.run-plan li.failed .run-plan-index {
  background: rgba(var(--error-rgb), 0.14);
  color: var(--error-dark);
}

.run-plan li.running .run-plan-index {
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent-color);
}

.run-plan-text {
  flex: 1;
  min-width: 0;
}

.run-plan-state {
  flex-shrink: 0;
  padding: 0 7px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.run-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.run-step {
  display: flex;
  gap: 10px;
}

.run-step-rail {
  position: relative;
  flex-shrink: 0;
  width: 22px;
  display: flex;
  justify-content: center;
}

.run-step-rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-color);
}

.run-step:first-child .run-step-rail::before {
  top: 12px;
}

.run-step:last-child .run-step-rail::before {
  bottom: calc(100% - 24px);
}

.run-step-dot {
  position: relative;
  z-index: 1;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background: var(--surface);
  font-size: 11px;
  color: var(--text-secondary);
}

.run-step-dot.ok {
  border-color: rgba(var(--success-rgb), 0.4);
  color: var(--success-dark);
}

.run-step-dot.fail {
  border-color: rgba(var(--error-rgb), 0.4);
  color: var(--error-dark);
}

.run-step-main {
  flex: 1;
  min-width: 0;
  margin-bottom: 10px;
  padding: 9px 11px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.run-step-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.run-step-tool {
  flex-shrink: 0;
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.run-step-args {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.run-step-duration {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.run-step-bar {
  height: 3px;
  margin: 6px 0;
  border-radius: 999px;
  background: var(--border-color);
  overflow: hidden;
}

.run-step-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent-color);
}

.run-step.fail .run-step-bar-fill {
  background: var(--error-dark);
}

.run-step-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.run-tag {
  padding: 1px 7px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.run-tag.write {
  border-color: rgba(var(--warning-rgb), 0.35);
  color: var(--warning-darker);
}

.run-tag.destructive,
.run-tag.denied,
.run-tag.fail {
  border-color: rgba(var(--error-rgb), 0.35);
  color: var(--error-dark);
}

.run-tag.ok {
  border-color: rgba(var(--success-rgb), 0.35);
  color: var(--success-dark);
}

.run-tag.muted {
  color: var(--text-tertiary);
}

.run-step-result summary,
.run-preview summary {
  margin-top: 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  cursor: pointer;
}

.run-step-result pre,
.run-preview pre {
  margin: 6px 0 0;
  max-height: 240px;
  overflow: auto;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.run-preview pre {
  max-height: 320px;
}

.run-injection {
  margin: 6px 0 0;
  font-size: var(--font-size-xs);
  color: var(--warning-darker);
}

.run-reflections,
.run-limitations {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.run-reflections li {
  display: flex;
  gap: 6px;
}

.run-reflections li.error strong {
  color: var(--error-dark);
}

.run-reflections li.warning strong {
  color: var(--warning-darker);
}

.run-error {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--error-dark);
}

.runs-note {
  flex-shrink: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-size-xs);
  color: var(--success-dark);
}

.runs-hint {
  padding: 24px 16px;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.runs-hint.error {
  color: var(--error-dark);
}

@media (max-width: 900px) {
  .runs-body {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(140px, 30%) minmax(0, 1fr);
  }

  .runs-search input {
    width: 150px;
  }
}
</style>
