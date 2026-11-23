<template>
  <div class="runs-panel">
    <div class="runs-toolbar">
      <label class="runs-search">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
        <input v-model="keyword" type="text" :placeholder="t('筛选目标、模型、工作区或终止原因')" />
      </label>
      <span class="runs-count">{{ runs.length }} / {{ runsTotal }}</span>
      <div v-if="conversationId" class="runs-scope" role="group" :aria-label="t('轨迹范围')">
        <button type="button" class="runs-chip" :class="{ active: scope === 'session' }" @click="setScope('session')">
          {{ t('当前会话') }}
        </button>
        <button type="button" class="runs-chip" :class="{ active: scope === 'all' }" @click="setScope('all')">
          {{ t('全部') }}
        </button>
      </div>
      <div class="runs-toolbar-actions">
        <button type="button" class="runs-btn" :disabled="loading" @click="loadRuns()">{{ t('刷新') }}</button>
        <button type="button" class="runs-btn" :disabled="!selectedId || exporting" @click="handleExport">
          {{ exporting ? t('导出中…') : t('导出 JSON') }}
        </button>
      </div>
    </div>

    <div class="runs-status-filter" role="group" :aria-label="t('按状态筛选')">
      <button
        v-for="item in STATUS_FILTERS"
        :key="item.value"
        type="button"
        class="runs-chip"
        :class="{ active: statusFilter === item.value }"
        @click="setStatusFilter(item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="runs-body">
      <div class="runs-list">
        <div class="runs-list-body">
          <div v-if="loading" class="runs-hint">{{ t('加载中…') }}</div>
          <div v-else-if="listError" class="runs-hint error">{{ listError }}</div>
          <div v-else-if="!filteredRuns.length" class="runs-hint">
            <p v-if="keyword || statusFilter !== 'all'">{{ t('暂无匹配的运行轨迹') }}</p>
            <p v-else-if="scope === 'session' && conversationId">{{ t('当前会话暂无运行轨迹') }}</p>
            <p v-else>{{ t('暂无运行轨迹，在 AI 助手中执行一次任务后再查看') }}</p>
            <button
              v-if="!keyword && statusFilter === 'all' && scope === 'session' && conversationId"
              type="button"
              class="runs-link"
              @click="setScope('all')"
            >
              {{ t('查看全部轨迹') }}
            </button>
          </div>
          <div v-for="group in groupedRuns" :key="group.key" class="runs-group">
            <div class="runs-group-label">{{ group.label }}</div>
            <button
              v-for="run in group.runs"
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
              <div v-if="run.error" class="run-item-error" :title="run.error">{{ run.error }}</div>
              <div class="run-item-meta">
                <span>{{ formatDuration(run.durationMs) }}</span>
                <span>{{ t('{count} 次工具', { count: run.toolCalls }) }}</span>
                <span v-if="workspaceName(run.workspace)" :title="run.workspace">{{
                  workspaceName(run.workspace)
                }}</span>
                <span v-if="run.model">{{ run.model }}</span>
              </div>
            </button>
          </div>
          <button
            v-if="runsHasMore"
            type="button"
            class="runs-btn runs-more"
            :disabled="loadingMore"
            @click="loadMoreRuns"
          >
            {{ loadingMore ? t('加载中…') : t('加载更多') }}
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
              <h2>{{ trace.plan?.goal || trace.goal || trace.summary?.goal || t('未记录目标') }}</h2>
              <span class="run-badge" :class="trace.termination || trace.status">
                {{ terminationLabel(trace.termination || trace.status) }}
              </span>
            </div>
            <div class="run-detail-meta">
              <span>{{ trace.meta?.provider || t('未知平台') }} · {{ trace.meta?.model || t('默认模型') }}</span>
              <span v-if="trace.meta?.workspacePath" class="run-detail-workspace" :title="trace.meta.workspacePath">
                {{ t('工作区：{path}', { path: trace.meta.workspacePath }) }}
              </span>
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import { listRunTraces, readRunTrace, exportRunTrace } from '@/api'

const props = defineProps({
  focusRunId: {
    type: String,
    default: ''
  },
  conversationId: {
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
const runsTotal = ref(0)
const runsHasMore = ref(false)
const loadingMore = ref(false)
const selectedId = ref('')
const trace = ref(null)
const keyword = ref('')
const scope = ref('session')
const statusFilter = ref('all')
const loading = ref(false)
const detailLoading = ref(false)
const exporting = ref(false)
const listError = ref('')
const detailError = ref('')
const exportNote = ref('')

const STATUS_FILTERS = [
  {
    value: 'all',
    get label() {
      return t('全部')
    }
  },
  {
    value: 'done',
    get label() {
      return t('完成')
    }
  },
  {
    value: 'error',
    get label() {
      return t('异常')
    }
  },
  {
    value: 'stopped',
    get label() {
      return t('停止')
    }
  }
]

const filteredRuns = computed(() => runs.value)

function dayStart(offset = 0) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - offset)
  return date.getTime()
}

function groupFor(timestamp) {
  const value = Number(timestamp) || 0
  if (!value) return 'earlier'
  if (value >= dayStart(0)) return 'today'
  if (value >= dayStart(1)) return 'yesterday'
  return 'earlier'
}

const groupedRuns = computed(() => {
  const order = ['today', 'yesterday', 'earlier']
  const labels = { today: t('今天'), yesterday: t('昨天'), earlier: t('更早') }
  const buckets = new Map(order.map((key) => [key, []]))
  for (const run of filteredRuns.value) buckets.get(groupFor(run.startedAt)).push(run)
  return order
    .filter((key) => buckets.get(key).length)
    .map((key) => ({ key, label: labels[key], runs: buckets.get(key) }))
})

const successCount = computed(() => (trace.value?.steps || []).filter((step) => step.success).length)
const failCount = computed(() => (trace.value?.steps || []).filter((step) => step.success === false).length)
const longestStep = computed(() => Math.max(0, ...(trace.value?.steps || []).map((step) => Number(step.duration) || 0)))

let keywordTimer = null
watch(keyword, () => {
  clearTimeout(keywordTimer)
  keywordTimer = setTimeout(() => {
    loadRuns(selectedId.value)
  }, 250)
})

onUnmounted(() => {
  clearTimeout(keywordTimer)
})

async function setScope(value) {
  const next = value === 'all' ? 'all' : 'session'
  if (scope.value === next) return
  scope.value = next
  selectedId.value = ''
  trace.value = null
  await loadRuns()
}

function setStatusFilter(value) {
  if (statusFilter.value === value) return
  statusFilter.value = value
  loadRuns(selectedId.value)
}

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

function workspaceName(value) {
  const parts = String(value || '')
    .split(/[\\/]/)
    .filter(Boolean)
  return parts[parts.length - 1] || ''
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

function runQuery({ offset = 0 } = {}) {
  const requestedScope = scope.value === 'session' && props.conversationId ? 'session' : 'all'
  return {
    limit: 30,
    offset,
    keyword: keyword.value.trim(),
    status: statusFilter.value,
    conversationId: requestedScope === 'session' ? props.conversationId : ''
  }
}

async function loadRuns(preferredId) {
  loading.value = true
  listError.value = ''
  try {
    const requestedScope = scope.value === 'session' && props.conversationId ? 'session' : 'all'
    let page = await listRunTraces(runQuery())
    let list = Array.isArray(page?.items) ? page.items : []
    if (preferredId && requestedScope === 'session' && !list.some((item) => item.id === preferredId)) {
      page = await listRunTraces({ ...runQuery(), conversationId: '' })
      list = Array.isArray(page?.items) ? page.items : []
      if (list.some((item) => item.id === preferredId)) scope.value = 'all'
    }
    runs.value = list
    runsTotal.value = Number(page?.total) || list.length
    runsHasMore.value = page?.hasMore === true
    const preferred = runs.value.find((item) => item.id === (preferredId || selectedId.value))
    const visible = filteredRuns.value
    const target = visible.some((item) => item.id === preferred?.id) ? preferred.id : visible[0]?.id || ''
    selectedId.value = target
    if (!target && !detailLoading.value) trace.value = null
  } catch (error) {
    runs.value = []
    runsTotal.value = 0
    runsHasMore.value = false
    listError.value = error?.message || t('加载运行轨迹失败')
  } finally {
    loading.value = false
  }
  if (selectedId.value) await loadTrace(selectedId.value)
}

async function loadMoreRuns() {
  if (loadingMore.value || !runsHasMore.value) return
  loadingMore.value = true
  listError.value = ''
  try {
    const page = await listRunTraces(runQuery({ offset: runs.value.length }))
    const list = Array.isArray(page?.items) ? page.items : []
    const seen = new Set(runs.value.map((item) => item.id))
    runs.value = [...runs.value, ...list.filter((item) => !seen.has(item.id))]
    runsTotal.value = Number(page?.total) || runsTotal.value
    runsHasMore.value = page?.hasMore === true
  } catch (error) {
    listError.value = error?.message || t('加载运行轨迹失败')
  } finally {
    loadingMore.value = false
  }
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

watch(
  () => props.conversationId,
  (next, prev) => {
    if (next === prev || scope.value !== 'session') return
    selectedId.value = ''
    trace.value = null
    loadRuns()
  }
)

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
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  row-gap: 6px;
  padding: 8px 14px 6px;
  border-bottom: 0;
}

.runs-scope {
  flex-shrink: 0;
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface-muted);
}

.runs-status-filter {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 14px 8px;
  border-bottom: 1px dashed var(--border-color);
}

.runs-chip {
  min-height: 22px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: var(--transition-fast);
}

.runs-chip:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.runs-chip.active {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
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

.runs-more {
  align-self: center;
  margin: 6px 0 2px;
  height: var(--control-height-sm);
  font-size: var(--font-size-xs);
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

.runs-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.runs-group + .runs-group {
  margin-top: 8px;
}

.runs-group-label {
  padding: 2px 4px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-tertiary);
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

.run-item-error {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  color: var(--error-dark);
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

.run-detail-workspace {
  max-width: 340px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--text-tertiary);
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

.runs-hint p {
  margin: 0 0 8px;
}

.runs-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent-color);
  font-family: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.runs-link:hover {
  text-decoration: underline;
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
