<template>
  <PageLayout tool-path="/clipboard">
    <template #actions>
      <button class="btn btn-secondary btn-sm" @click="togglePause">
        <AppIcon :name="paused ? 'play' : 'pause'" />
        {{ paused ? t('恢复记录') : t('暂停记录') }}
      </button>
      <button class="btn btn-danger btn-sm" :disabled="entries.length === 0" @click="clearVisible = true">
        <AppIcon name="trash" />
        {{ t('清空历史') }}
      </button>
    </template>

    <div class="page-body clipboard-page">
      <div v-if="paused" class="clipboard-banner">
        <AppIcon name="info" />
        {{ t('剪贴板记录已暂停，恢复后才会记录新的复制内容。') }}
      </div>

      <div class="clipboard-toolbar">
        <div class="clipboard-search">
          <AppIcon name="search" />
          <input v-model="query" type="text" :placeholder="t('搜索剪贴板内容')" spellcheck="false" />
          <button v-if="query" type="button" class="clipboard-search-clear" :title="t('清除搜索')" @click="query = ''">
            <AppIcon name="close" />
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
            {{ t(item.label) }}
            <span class="filter-count">{{ countFor(item.id) }}</span>
          </button>
        </div>

        <span class="clipboard-summary">{{ t('共 {count} 条', { count: entries.length }) }}</span>
      </div>

      <section class="clipboard-snippets">
        <div class="snippet-head">
          <span class="snippet-title">{{ t('片段') }}</span>
          <span class="snippet-count">{{ snippets.length }}/{{ SNIPPET_LIMITS.max }}</span>
          <span class="snippet-hint">{{ t('固定常用文本，点击复制，或发送到任意工具') }}</span>
          <span class="snippet-spacer" />
          <button type="button" class="btn btn-secondary btn-sm" @click="openSnippetEditor(null)">
            <AppIcon name="plus" />
            {{ t('新建片段') }}
          </button>
        </div>

        <div v-if="editorVisible" class="snippet-editor">
          <div class="snippet-editor-row">
            <AppInput
              v-model="editorName"
              class="snippet-editor-name"
              :placeholder="t('片段名称（默认取首行）')"
              spellcheck="false"
            />
            <span class="snippet-spacer" />
            <button type="button" class="btn btn-secondary btn-sm" @click="closeSnippetEditor">{{ t('取消') }}</button>
            <button type="button" class="btn btn-primary btn-sm" :disabled="!editorText.trim()" @click="saveSnippet">
              {{ editingId ? t('保存修改') : t('保存片段') }}
            </button>
          </div>
          <AppTextarea
            v-model="editorText"
            class="snippet-editor-text"
            :placeholder="t('片段内容')"
            spellcheck="false"
          />
        </div>

        <div v-if="visibleSnippets.length" class="snippet-list">
          <article
            v-for="snippet in visibleSnippets"
            :key="snippet.id"
            class="snippet-card"
            role="button"
            tabindex="0"
            :title="t('点击复制片段内容')"
            @click="copySnippet(snippet)"
            @keydown.enter.prevent="copySnippet(snippet)"
          >
            <div class="snippet-card-body">
              <span class="snippet-name">{{ snippet.name }}</span>
              <span class="snippet-text">{{ previewText(snippet.text) }}</span>
            </div>
            <div class="snippet-actions" @click.stop>
              <button type="button" :title="t('复制')" :aria-label="t('复制')" @click="copySnippet(snippet)">
                <AppIcon name="copy" />
              </button>
              <button
                type="button"
                :title="t('发送到…')"
                :aria-label="t('发送到…')"
                @click="openSendMenu($event, snippetResource(snippet))"
              >
                <AppIcon name="shuffle" />
              </button>
              <button type="button" :title="t('编辑')" :aria-label="t('编辑')" @click="openSnippetEditor(snippet)">
                <AppIcon name="edit" />
              </button>
              <button
                type="button"
                class="danger"
                :title="t('删除')"
                :aria-label="t('删除')"
                @click="removeSnippet(snippet)"
              >
                <AppIcon name="trash" />
              </button>
            </div>
          </article>
        </div>
        <p v-else-if="!editorVisible" class="snippet-empty">
          {{ query.trim() ? t('没有匹配的片段') : t('还没有片段，点「新建片段」保存常用文本') }}
        </p>
      </section>

      <div v-if="visibleEntries.length" class="clipboard-list">
        <article
          v-for="entry in visibleEntries"
          :key="entry.id"
          class="clipboard-item"
          :class="{ pinned: entry.pinned }"
          role="button"
          tabindex="0"
          :title="entry.type === 'text' ? t('点击复制此内容') : t('点击复制此图片')"
          @click="copyEntry(entry)"
          @keydown.enter.prevent="copyEntry(entry)"
        >
          <div class="clipboard-item-body">
            <div v-if="entry.type === 'image'" class="clipboard-thumb">
              <img :src="entry.image" :alt="t('剪贴板图片')" />
            </div>
            <p v-else class="clipboard-text">{{ previewText(entry.text) }}</p>
          </div>

          <div class="clipboard-meta">
            <span class="clipboard-badge">{{ entry.type === 'image' ? t('图片') : t('文本') }}</span>
            <span v-if="entry.pinned" class="clipboard-badge is-pinned">{{ t('已置顶') }}</span>
            <span class="clipboard-time">{{ relativeTime(entry.updatedAt) }}</span>
          </div>

          <div class="clipboard-actions" @click.stop>
            <button type="button" :title="t('复制')" :aria-label="t('复制')" @click="copyEntry(entry)">
              <AppIcon name="copy" />
            </button>
            <button
              v-if="entry.type === 'text'"
              type="button"
              :title="t('发送到…')"
              :aria-label="t('发送到…')"
              @click="openSendMenu($event, entryResource(entry))"
            >
              <AppIcon name="shuffle" />
            </button>
            <button
              v-if="entry.type === 'text'"
              type="button"
              :title="t('保存为片段')"
              :aria-label="t('保存为片段')"
              @click="openSnippetEditor(null, entry)"
            >
              <AppIcon name="bookmark" />
            </button>
            <button
              type="button"
              :title="entry.pinned ? t('取消置顶') : t('置顶')"
              :aria-label="entry.pinned ? t('取消置顶') : t('置顶')"
              :class="{ active: entry.pinned }"
              @click="togglePin(entry)"
            >
              <AppIcon name="pin" />
            </button>
            <button type="button" class="danger" :title="t('删除')" :aria-label="t('删除')" @click="removeEntry(entry)">
              <AppIcon name="trash" />
            </button>
          </div>
        </article>
      </div>

      <EmptyState v-else class="clipboard-empty" icon="copy" :title="emptyTitle" :description="emptyHint" />
    </div>

    <SendToMenu
      :visible="sendMenu.show"
      :x="sendMenu.x"
      :y="sendMenu.y"
      :resource="sendResource"
      exclude-path="/clipboard"
      @close="sendMenu.show = false"
      @sent="onSendDone"
    />

    <MessageDialog
      :visible="clearVisible"
      type="confirm"
      :title="t('清空剪贴板历史')"
      :message="t('将删除全部记录（包括已置顶内容），此操作无法撤销。')"
      @confirm="clearAll"
      @cancel="clearVisible = false"
      @close="clearVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import SendToMenu from '@/components/SendToMenu.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { useToast } from '@/composables'
import { formatRelativeTime } from '@/utils/format'
import { t } from '@/i18n'
import {
  clipboardHistory,
  clipboardCopy,
  clipboardRemove,
  clipboardTogglePin,
  clipboardClear,
  clipboardSetPaused,
  onClipboardChanged
} from '@/api'

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import EmptyState from '@/components/EmptyState.vue'
import { copyToClipboard } from '@/utils/clipboard'
import {
  CLIPBOARD_SNIPPET_LIMITS,
  createClipboardSnippetId,
  normalizeClipboardSnippets,
  sortClipboardSnippets
} from '@shared/clipboardSnippets'
const { showSuccess, showError, showInfo, showWarning } = useToast()

const SNIPPETS_KEY = 'ntb_clipboard_snippets'
const SNIPPET_LIMITS = CLIPBOARD_SNIPPET_LIMITS

const entries = ref([])
const paused = ref(false)
const query = ref('')
const filter = ref('all')
const clearVisible = ref(false)
const now = ref(Date.now())
const sendMenu = ref({ show: false, x: 0, y: 0 })
const sendResource = ref(null)
const snippets = ref(loadSnippets())
const editorVisible = ref(false)
const editingId = ref('')
const editorName = ref('')
const editorText = ref('')

const visibleSnippets = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return snippets.value
  return snippets.value.filter(
    (snippet) => snippet.name.toLowerCase().includes(keyword) || snippet.text.toLowerCase().includes(keyword)
  )
})

function entryResource(entry) {
  if (!entry || entry.type !== 'text') return null
  return { kind: 'text', title: t('剪贴板文本'), text: entry.text }
}

function snippetResource(snippet) {
  return { kind: 'text', title: snippet.name, text: snippet.text }
}

function openSendMenu(event, resource) {
  if (!resource) return
  sendResource.value = resource
  const rect = event.currentTarget.getBoundingClientRect()
  sendMenu.value = { show: true, x: rect.right - 252, y: rect.bottom + 6 }
}

function loadSnippets() {
  try {
    return sortClipboardSnippets(normalizeClipboardSnippets(JSON.parse(localStorage.getItem(SNIPPETS_KEY) || '[]')))
  } catch {
    return []
  }
}

function persistSnippets() {
  try {
    localStorage.setItem(SNIPPETS_KEY, JSON.stringify(snippets.value))
  } catch {
    // 存储不可用时仅保留内存中的片段
  }
}

function openSnippetEditor(snippet, entry = null) {
  editingId.value = snippet?.id || ''
  editorName.value = snippet?.name || ''
  editorText.value = snippet?.text || entry?.text || ''
  editorVisible.value = true
}

function closeSnippetEditor() {
  editorVisible.value = false
  editingId.value = ''
  editorName.value = ''
  editorText.value = ''
}

function saveSnippet() {
  const text = editorText.value.slice(0, SNIPPET_LIMITS.textLength)
  if (!text.trim()) {
    showWarning(t('请填写片段内容'))
    return
  }
  const name =
    editorName.value.trim().slice(0, SNIPPET_LIMITS.nameLength) ||
    text.trim().split('\n')[0].slice(0, SNIPPET_LIMITS.nameLength)
  if (editingId.value) {
    const target = snippets.value.find((snippet) => snippet.id === editingId.value)
    if (target) Object.assign(target, { name, text, updatedAt: Date.now() })
  } else {
    if (snippets.value.length >= SNIPPET_LIMITS.max) {
      showWarning(t('最多保存 {p0} 个片段', { p0: SNIPPET_LIMITS.max }))
      return
    }
    snippets.value.push({ id: createClipboardSnippetId(), name, text, updatedAt: Date.now() })
  }
  snippets.value = sortClipboardSnippets(snippets.value)
  persistSnippets()
  closeSnippetEditor()
  showSuccess(t('片段已保存'))
}

function removeSnippet(snippet) {
  snippets.value = snippets.value.filter((item) => item.id !== snippet.id)
  persistSnippets()
  showInfo(t('已删除片段「{p0}」', { p0: snippet.name }))
}

async function copySnippet(snippet) {
  const ok = await copyToClipboard(snippet.text)
  if (ok) showSuccess(t('已复制片段「{p0}」', { p0: snippet.name }))
  else showError(t('复制失败'))
}

function onSendDone(target) {
  showSuccess(t('已发送到 {name}', { name: t(target.name) }))
}

const filters = [
  {
    id: 'all',
    get label() {
      return t('全部')
    }
  },
  {
    id: 'text',
    get label() {
      return t('文本')
    }
  },
  {
    id: 'image',
    get label() {
      return t('图片')
    }
  },
  {
    id: 'pinned',
    get label() {
      return t('置顶')
    }
  }
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
  if (!entries.value.length) return paused.value ? t('剪贴板记录已暂停') : t('暂无剪贴板记录')
  return t('没有匹配的记录')
})

const emptyHint = computed(() => {
  if (!entries.value.length) {
    return paused.value
      ? t('恢复记录后复制任意文本或图片即可出现在这里。')
      : t('复制文本或图片后，记录会自动出现在这里。')
  }
  return t('试试更换搜索关键词或切换筛选条件。')
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
  if (ok) showSuccess(t('已复制到剪贴板'))
  else showError(t('复制失败'))
}

async function togglePin(entry) {
  const ok = await clipboardTogglePin(entry.id)
  if (ok) showInfo(entry.pinned ? t('已取消置顶') : t('已置顶'))
  else showError(t('操作失败'))
}

async function removeEntry(entry) {
  const ok = await clipboardRemove(entry.id)
  if (ok) showSuccess(t('已删除该记录'))
  else showError(t('删除失败'))
}

async function clearAll() {
  clearVisible.value = false
  const ok = await clipboardClear()
  if (ok) showSuccess(t('已清空剪贴板历史'))
  else showError(t('清空失败'))
}

async function togglePause() {
  const next = await clipboardSetPaused(!paused.value)
  if (typeof next === 'boolean') {
    paused.value = next
    showInfo(next ? t('已暂停记录剪贴板') : t('已恢复记录剪贴板'))
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
  box-shadow: var(--shadow-glow);
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
}

.clipboard-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
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
  border-radius: var(--radius-pill);
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

.clipboard-snippets {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.snippet-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.snippet-title {
  font-size: var(--font-size-dense);
  font-weight: 600;
  color: var(--text-primary);
}

.snippet-count {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.snippet-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.snippet-spacer {
  flex: 1;
}

.snippet-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.snippet-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.snippet-editor-name {
  flex: 1 1 220px;
}

.snippet-editor-text {
  min-height: 90px;
  font-family: var(--font-mono);
}

.snippet-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
  max-height: 210px;
  overflow-y: auto;
}

.snippet-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  transition: var(--transition-fast);
}

.snippet-card:hover,
.snippet-card:focus-visible {
  border-color: var(--accent-color);
}

.snippet-card-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.snippet-name {
  overflow: hidden;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet-text {
  overflow: hidden;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0.35;
  transition: opacity 0.15s ease;
}

.snippet-card:hover .snippet-actions,
.snippet-card:focus-within .snippet-actions {
  opacity: 1;
}

.snippet-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.snippet-actions button svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.snippet-actions button:hover {
  border-color: var(--border-color);
  background: var(--surface-hover);
  color: var(--accent-color);
}

.snippet-actions button.danger:hover {
  border-color: rgba(var(--error-rgb), 0.4);
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.snippet-empty {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.clipboard-empty {
  flex: 1;
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
