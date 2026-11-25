<template>
  <PageLayout tool-path="/activity">
    <template #actions>
      <div class="segmented activity-range">
        <button
          v-for="option in ACTIVITY_RANGES"
          :key="option.id"
          type="button"
          class="segmented-item"
          :class="{ active: range === option.id }"
          @click="range = option.id"
        >
          {{ t(option.label) }}
        </button>
      </div>
      <button class="btn btn-secondary btn-sm" :disabled="loading" @click="load(true)">{{ t('刷新') }}</button>
    </template>

    <div class="page-body activity-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('活动时间线') }}</span>
          <span class="panel-hint">{{ t('聚合数据库查询、图床上传、备份、AI 运行与文件改动') }}</span>
        </div>
        <div class="panel-body">
          <div class="activity-filters">
            <button
              v-for="kind in ACTIVITY_KINDS"
              :key="kind"
              type="button"
              class="activity-filter"
              :class="[`is-${kind}`, { active: selectedKinds.includes(kind) }]"
              @click="toggleKind(kind)"
            >
              <span class="activity-filter-dot" />
              {{ t(KIND_LABELS[kind]) }}
            </button>
          </div>

          <div v-if="loading && !items.length" class="activity-state">
            <span class="activity-spinner" />
            <span>{{ t('正在加载活动记录…') }}</span>
          </div>

          <div v-else-if="!items.length" class="activity-state">
            <p class="activity-state-title">{{ t('当前范围内没有活动') }}</p>
            <p class="activity-state-hint">{{ t('执行查询、上传图片、运行 AI 或触发备份后，这里会自动汇总。') }}</p>
          </div>

          <ol v-else class="activity-list">
            <li v-for="item in items" :key="`${item.kind}:${item.id}`" class="activity-item" :class="`is-${item.kind}`">
              <span class="activity-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path v-for="path in ICONS[item.kind]" :key="path" :d="path" />
                </svg>
              </span>
              <div class="activity-main">
                <div class="activity-row">
                  <span class="activity-kind">{{ t(KIND_LABELS[item.kind]) }}</span>
                  <span class="activity-title">{{ titleFor(item) }}</span>
                  <span class="activity-time" :title="formatDateTime(item.ts)">{{ formatRelativeTime(item.ts) }}</span>
                </div>
                <p v-if="detailFor(item)" class="activity-detail">{{ detailFor(item) }}</p>
                <div
                  v-if="metaFor(item).length || item.kind === 'query' || item.kind === 'upload'"
                  class="activity-meta"
                >
                  <span v-for="meta in metaFor(item)" :key="meta" class="activity-chip">{{ meta }}</span>
                  <button
                    v-if="item.kind === 'query' && item.sql"
                    type="button"
                    class="activity-link"
                    @click="copyText(item.sql, t('SQL 已复制'))"
                  >
                    {{ t('复制 SQL') }}
                  </button>
                  <button
                    v-if="item.kind === 'upload' && item.url"
                    type="button"
                    class="activity-link"
                    @click="copyText(item.url, t('链接已复制'))"
                  >
                    {{ t('复制链接') }}
                  </button>
                </div>
              </div>
            </li>
          </ol>

          <div v-if="hasMore" class="activity-more">
            <button class="btn btn-secondary btn-sm" :disabled="loading" @click="load(false)">
              {{ loading ? t('正在加载…') : t('加载更多') }}
            </button>
          </div>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { t } from '@/i18n'
import { activityTimeline } from '@/api'
import { useToast } from '@/composables'
import { copyToClipboard } from '@/utils/clipboard'
import { formatDateTime, formatRelativeTime } from '@/utils/format'
import {
  ACTIVITY_DEFAULT_RANGE,
  ACTIVITY_KINDS,
  ACTIVITY_RANGES,
  activitySince,
  sortActivityItems
} from '@shared/activity'
import '@/styles/activity.css'

const { showToast } = useToast()

const KIND_LABELS = {
  query: '查询',
  upload: '上传',
  backup: '备份',
  ai_run: 'AI 运行',
  file_change: '文件改动'
}

const STATUS_LABELS = {
  success: '已完成',
  completed: '已完成',
  goal_reached: '已完成',
  cancelled: '已取消',
  max_steps: '达到轮次上限',
  timeout: '超时',
  error: '失败'
}

const ICONS = {
  query: ['M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z', 'M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6'],
  upload: ['M12 16V4', 'm7 9 5-5 5 5', 'M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2'],
  backup: ['M21 12a9 9 0 1 1-3-6.7', 'M21 3v6h-6'],
  ai_run: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z'],
  file_change: ['M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M15 3v5h5']
}

const range = ref(ACTIVITY_DEFAULT_RANGE)
const selectedKinds = ref([...ACTIVITY_KINDS])
const items = ref([])
const loading = ref(false)
const hasMore = ref(false)

let loadToken = 0

async function load(reset = true) {
  const token = ++loadToken
  loading.value = true
  const offset = reset ? 0 : items.value.length
  const result = await activityTimeline({
    since: activitySince(range.value),
    kinds: [...selectedKinds.value],
    limit: 50,
    offset
  })
  if (token !== loadToken) return
  const next = sortActivityItems(result?.items || [])
  items.value = reset ? next : sortActivityItems([...items.value, ...next])
  hasMore.value = Boolean(result?.hasMore)
  loading.value = false
}

function reload() {
  void load(true)
}

function toggleKind(kind) {
  const picked = new Set(selectedKinds.value)
  if (picked.has(kind)) {
    if (picked.size === 1) return
    picked.delete(kind)
  } else {
    picked.add(kind)
  }
  selectedKinds.value = ACTIVITY_KINDS.filter((item) => picked.has(item))
}

watch(range, reload)
watch(selectedKinds, reload, { deep: true })

onMounted(reload)

function formatBytes(size) {
  const value = Number(size) || 0
  if (!value) return ''
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms) {
  const value = Number(ms) || 0
  if (!value) return ''
  if (value < 1000) return `${value} ms`
  return `${(value / 1000).toFixed(1)} s`
}

function truncate(text, max) {
  const value = String(text || '')
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function titleFor(item) {
  if (item.kind === 'query') {
    return item.database || item.connectionName || t('数据库查询')
  }
  if (item.kind === 'upload') {
    return t('上传图片：{p0}', { p0: truncate(item.name || item.providerName, 48) })
  }
  if (item.kind === 'backup') {
    return item.title || t('数据库备份')
  }
  if (item.kind === 'ai_run') {
    return t('AI 运行：{p0}', { p0: truncate(item.goal, 60) || t('未命名任务') })
  }
  return t('AI 写入文件：{p0} 个', { p0: item.fileCount })
}

function detailFor(item) {
  if (item.kind === 'query') return truncate(String(item.sql || '').replace(/\s+/g, ' '), 180)
  if (item.kind === 'upload') return truncate(item.url, 140)
  if (item.kind === 'backup') return truncate(item.body, 160)
  if (item.kind === 'ai_run') return truncate(item.error, 160)
  return truncate(item.directory, 160)
}

function metaFor(item) {
  if (item.kind === 'query') {
    const meta = []
    if (item.connectionName) meta.push(item.connectionName)
    meta.push(item.success ? t('成功') : t('失败'))
    const duration = formatDuration(item.duration)
    if (duration) meta.push(duration)
    return meta
  }
  if (item.kind === 'upload') {
    const meta = []
    if (item.providerName) meta.push(item.providerName)
    const size = formatBytes(item.size)
    if (size) meta.push(size)
    return meta
  }
  if (item.kind === 'backup') {
    return [item.level === 'error' ? t('失败') : t('成功')]
  }
  if (item.kind === 'ai_run') {
    const meta = []
    if (item.model) meta.push(item.model)
    const status = STATUS_LABELS[item.termination] || STATUS_LABELS[item.status]
    if (status) meta.push(t(status))
    if (item.toolCalls) meta.push(t('{p0} 次工具调用', { p0: item.toolCalls }))
    const duration = formatDuration(item.durationMs)
    if (duration) meta.push(duration)
    return meta
  }
  return []
}

async function copyText(text, message) {
  if (!text) return
  const copied = await copyToClipboard(text)
  showToast(copied ? message : t('复制失败'), copied ? 'success' : 'error')
}
</script>
