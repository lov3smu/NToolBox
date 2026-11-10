<template>
  <PageLayout tool-path="/clipboard">
    <template #actions>
      <button class="btn btn-secondary btn-sm" @click="togglePause">
        <svg v-if="paused" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M8 5v14l11-7z" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
        </svg>
        {{ paused ? '恢复记录' : '暂停记录' }}
      </button>
      <button class="btn btn-secondary btn-sm" :disabled="entries.length === 0" @click="clearVisible = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
        清空历史
      </button>
    </template>

    <div class="clipboard-page">
      <div v-if="paused" class="clipboard-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        剪贴板记录已暂停，恢复后才会记录新的复制内容。
      </div>

      <div class="clipboard-toolbar">
        <div class="clipboard-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input v-model="query" type="text" placeholder="搜索剪贴板内容" spellcheck="false" />
          <button v-if="query" type="button" class="clipboard-search-clear" title="清除搜索" @click="query = ''">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="segmented clipboard-filter">
          <button
            v-for="item in filters"
            :key="item.id"
            type="button"
            class="segmented-item"
            :class="{ active: filter === item.id }"
            @click="filter = item.id"
          >
            {{ item.label }}
            <span class="filter-count">{{ countFor(item.id) }}</span>
          </button>
        </div>

        <span class="clipboard-summary">共 {{ entries.length }} 条</span>
      </div>

      <div v-if="visibleEntries.length" class="clipboard-list">
        <article
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="clipboard-item"
          :class="{ pinned: entry.pinned }"
          role="button"
          tabindex="0"
          :title="entry.type === 'text' ? '点击复制此内容' : '点击复制此图片'"
          @click="copyEntry(entry)"
          @keydown.enter.prevent="copyEntry(entry)"
        >
          <div class="clipboard-item-body">
            <div v-if="entry.type === 'image'" class="clipboard-thumb">
              <img :src="entry.image" alt="剪贴板图片" />
            </div>
            <p v-else class="clipboard-text">{{ previewText(entry.text) }}</p>
          </div>

          <div class="clipboard-meta">
            <span class="clipboard-badge">{{ entry.type === 'image' ? '图片' : '文本' }}</span>
            <span v-if="entry.pinned" class="clipboard-badge is-pinned">已置顶</span>
            <span class="clipboard-time">{{ relativeTime(entry.updatedAt) }}</span>
          </div>

          <div class="clipboard-actions" @click.stop>
            <button type="button" title="复制" aria-label="复制" @click="copyEntry(entry)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
            <button
              type="button"
              :title="entry.pinned ? '取消置顶' : '置顶'"
              :aria-label="entry.pinned ? '取消置顶' : '置顶'"
              :class="{ active: entry.pinned }"
              @click="togglePin(entry)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 17v5M9 3h6l-1 7 3 3v2H7v-2l3-3z" />
              </svg>
            </button>
            <button type="button" class="danger" title="删除" aria-label="删除" @click="removeEntry(entry)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5" />
              </svg>
            </button>
          </div>
        </article>
      </div>

      <div v-else class="clipboard-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <p class="clipboard-empty-title">{{ emptyTitle }}</p>
        <p class="clipboard-empty-hint">{{ emptyHint }}</p>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />

    <MessageDialog
      :visible="clearVisible"
      type="confirm"
      title="清空剪贴板历史"
      message="将删除全部记录（包括已置顶内容），此操作无法撤销。"
      @confirm="clearAll"
      @cancel="clearVisible = false"
      @close="clearVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { useToast } from '@/composables'
import { formatRelativeTime } from '@/utils/format'
import {
  clipboardHistory,
  clipboardCopy,
  clipboardRemove,
  clipboardTogglePin,
  clipboardClear,
  clipboardSetPaused,
  onClipboardChanged
} from '@/api'

const { toastVisible, toastMessage, toastType, showSuccess, showError, showInfo } = useToast()

const entries = ref([])
const paused = ref(false)
const query = ref('')
const filter = ref('all')
const clearVisible = ref(false)
const now = ref(Date.now())

const filters = [
  { id: 'all', label: '全部' },
  { id: 'text', label: '文本' },
  { id: 'image', label: '图片' },
  { id: 'pinned', label: '置顶' }
]

const visibleEntries = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return entries.value
    .filter((entry) => {
      if (filter.value === 'text' && entry.type !== 'text') return false
      if (filter.value === 'image' && entry.type !== 'image') return false
      if (filter.value === 'pinned' && !entry.pinned) return false
      if (!keyword) return true
      return entry.type === 'text' && entry.text.toLowerCase().includes(keyword)
    })
    .slice()
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt)
})

const emptyTitle = computed(() => {
  if (!entries.value.length) return paused.value ? '剪贴板记录已暂停' : '暂无剪贴板记录'
  return '没有匹配的记录'
})

const emptyHint = computed(() => {
  if (!entries.value.length) {
    return paused.value ? '恢复记录后复制任意文本或图片即可出现在这里。' : '复制文本或图片后，记录会自动出现在这里。'
  }
  return '试试更换搜索关键词或切换筛选条件。'
})

function applyState(state) {
  if (!state || !Array.isArray(state.entries)) return
  entries.value = state.entries
  paused.value = state.paused === true
}

function countFor(id) {
  if (id === 'text') return entries.value.filter((entry) => entry.type === 'text').length
  if (id === 'image') return entries.value.filter((entry) => entry.type === 'image').length
  if (id === 'pinned') return entries.value.filter((entry) => entry.pinned).length
  return entries.value.length
}

function previewText(text) {
  if (!text) return ''
  return text.length > 600 ? `${text.slice(0, 600)}…` : text
}

function relativeTime(timestamp) {
  void now.value
  return formatRelativeTime(timestamp)
}

async function copyEntry(entry) {
  const ok = await clipboardCopy(entry.id)
  if (ok) showSuccess('已复制到剪贴板')
  else showError('复制失败')
}

async function togglePin(entry) {
  const ok = await clipboardTogglePin(entry.id)
  if (ok) showInfo(entry.pinned ? '已取消置顶' : '已置顶')
  else showError('操作失败')
}

async function removeEntry(entry) {
  const ok = await clipboardRemove(entry.id)
  if (ok) showSuccess('已删除该记录')
  else showError('删除失败')
}

async function clearAll() {
  clearVisible.value = false
  const ok = await clipboardClear()
  if (ok) showSuccess('已清空剪贴板历史')
  else showError('清空失败')
}

async function togglePause() {
  const next = await clipboardSetPaused(!paused.value)
  if (typeof next === 'boolean') {
    paused.value = next
    showInfo(next ? '已暂停记录剪贴板' : '已恢复记录剪贴板')
  }
}

let removeClipboardListener = null
let clockTimer = null

onMounted(async () => {
  applyState(await clipboardHistory())
  removeClipboardListener = onClipboardChanged(applyState)
  clockTimer = setInterval(() => {
    now.value = Date.now()
  }, 30000)
})

onUnmounted(() => {
  removeClipboardListener?.()
  clearInterval(clockTimer)
})
</script>

<style scoped>
.clipboard-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 20px 20px;
}

.clipboard-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: var(--radius-md);
  background: rgba(var(--warning-rgb), 0.1);
  color: var(--warning-darker);
  font-size: var(--font-size-dense);
}

.clipboard-banner svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  flex-shrink: 0;
}

.clipboard-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.clipboard-search {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 320px;
  max-width: 100%;
  padding: 0 10px;
  height: 32px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  transition: var(--transition-fast);
}

.clipboard-search:focus-within {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.12);
}

.clipboard-search > svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.clipboard-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-dense);
}

.clipboard-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.clipboard-search-clear svg {
  width: 12px;
  height: 12px;
}

.clipboard-filter .segmented-item {
  height: 24px;
  padding: 0 10px;
  font-size: var(--font-size-xs);
}

.filter-count {
  margin-left: 4px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.segmented-item.active .filter-count {
  color: var(--accent-color);
}

.clipboard-summary {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.clipboard-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.clipboard-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.clipboard-item:hover,
.clipboard-item:focus-visible {
  border-color: var(--accent-color);
  background: var(--surface-hover);
  outline: none;
}

.clipboard-item.pinned {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.04);
}

.clipboard-item-body {
  flex: 1;
  min-width: 0;
}

.clipboard-text {
  margin: 0;
  max-height: 66px;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-dense);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.clipboard-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  max-width: 100%;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.clipboard-thumb img {
  display: block;
  max-width: 220px;
  max-height: 72px;
  object-fit: contain;
}

.clipboard-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.clipboard-badge {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.clipboard-badge.is-pinned {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
}

.clipboard-time {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.clipboard-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0.35;
  transition: opacity 0.15s ease;
}

.clipboard-item:hover .clipboard-actions,
.clipboard-item:focus-within .clipboard-actions {
  opacity: 1;
}

.clipboard-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.clipboard-actions button svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.clipboard-actions button:hover,
.clipboard-actions button.active {
  border-color: var(--border-color);
  background: var(--surface-hover);
  color: var(--accent-color);
}

.clipboard-actions button.danger:hover {
  border-color: rgba(var(--error-rgb), 0.4);
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.clipboard-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-tertiary);
  text-align: center;
}

.clipboard-empty > svg {
  width: 44px;
  height: 44px;
  color: var(--border-strong);
}

.clipboard-empty-title {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-secondary);
}

.clipboard-empty-hint {
  margin: 0;
  font-size: var(--font-size-sm);
}

@media (max-width: 720px) {
  .clipboard-summary {
    display: none;
  }

  .clipboard-search {
    width: 100%;
  }

  .clipboard-meta {
    display: none;
  }
}
</style>
