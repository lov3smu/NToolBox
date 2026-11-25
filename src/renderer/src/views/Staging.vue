<template>
  <PageLayout tool-path="/staging">
    <template #actions>
      <button class="btn btn-secondary btn-sm" @click="openEditor(null)">
        <AppIcon name="plus" />
        {{ t('新建条目') }}
      </button>
      <button class="btn btn-danger btn-sm" :disabled="items.length === 0" @click="clearVisible = true">
        <AppIcon name="trash" />
        {{ t('清空暂存架') }}
      </button>
    </template>

    <div class="page-body staging-page">
      <div class="staging-toolbar">
        <div class="staging-search">
          <AppIcon name="search" />
          <input v-model="query" type="text" :placeholder="t('搜索暂存内容')" spellcheck="false" />
          <button v-if="query" type="button" class="staging-search-clear" :title="t('清除搜索')" @click="query = ''">
            <AppIcon name="close" />
          </button>
        </div>
        <span class="staging-summary">{{ items.length }}/{{ STAGING_LIMITS.max }}</span>
      </div>

      <div v-if="editorVisible" class="staging-editor">
        <div class="staging-editor-row">
          <AppInput
            v-model="editorTitle"
            class="staging-editor-name"
            :placeholder="t('条目名称（默认取首行）')"
            spellcheck="false"
          />
          <button type="button" class="btn btn-secondary btn-sm" @click="closeEditor">{{ t('取消') }}</button>
          <button type="button" class="btn btn-primary btn-sm" :disabled="!editorText.trim()" @click="saveEntry">
            {{ editingId ? t('保存修改') : t('暂存') }}
          </button>
        </div>
        <AppTextarea v-model="editorText" class="staging-editor-text" :placeholder="t('暂存内容')" spellcheck="false" />
      </div>

      <div v-if="visibleItems.length" class="staging-list">
        <article
          v-for="item in visibleItems"
          :key="item.id"
          class="staging-item"
          :class="{ pinned: item.pinned }"
          role="button"
          tabindex="0"
          :title="t('点击复制内容')"
          @click="copyItem(item)"
          @keydown.enter.prevent="copyItem(item)"
        >
          <div class="staging-item-main">
            <div class="staging-item-meta">
              <span class="staging-name">{{ item.title }}</span>
              <span v-if="item.pinned" class="staging-badge">{{ t('已置顶') }}</span>
              <span class="staging-time">{{ relativeTime(item.updatedAt) }}</span>
            </div>
            <pre class="staging-text">{{ previewText(item.text) }}</pre>
          </div>

          <div class="staging-actions" @click.stop>
            <button type="button" :title="t('复制')" :aria-label="t('复制')" @click="copyItem(item)">
              <AppIcon name="copy" />
            </button>
            <button
              type="button"
              :title="t('发送到…')"
              :aria-label="t('发送到…')"
              @click="openSendMenu($event, itemResource(item))"
            >
              <AppIcon name="shuffle" />
            </button>
            <button
              type="button"
              :title="item.pinned ? t('取消置顶') : t('置顶')"
              :aria-label="item.pinned ? t('取消置顶') : t('置顶')"
              :class="{ active: item.pinned }"
              @click="togglePin(item)"
            >
              <AppIcon name="pin" />
            </button>
            <button type="button" :title="t('编辑')" :aria-label="t('编辑')" @click="openEditor(item)">
              <AppIcon name="edit" />
            </button>
            <button type="button" class="danger" :title="t('删除')" :aria-label="t('删除')" @click="removeItem(item)">
              <AppIcon name="trash" />
            </button>
          </div>
        </article>
      </div>

      <EmptyState
        v-else
        class="staging-empty"
        icon="archive"
        :title="query.trim() ? t('没有匹配的条目') : t('暂存架是空的')"
        :description="
          query.trim()
            ? t('试试更换搜索关键词。')
            : t('在任意工具中通过「发送到」选择暂存架，或点击「新建条目」手动录入。')
        "
      />
    </div>

    <SendToMenu
      :visible="sendMenu.show"
      :x="sendMenu.x"
      :y="sendMenu.y"
      :resource="sendResource"
      exclude-path="/staging"
      @close="sendMenu.show = false"
      @sent="onSendDone"
    />

    <MessageDialog
      :visible="clearVisible"
      type="confirm"
      :title="t('清空暂存架')"
      :message="t('将删除全部暂存条目（包括已置顶内容），此操作无法撤销。')"
      @confirm="clearAll"
      @cancel="clearVisible = false"
      @close="clearVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import SendToMenu from '@/components/SendToMenu.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import EmptyState from '@/components/EmptyState.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import { takeSendResource, useToast } from '@/composables'
import { formatRelativeTime } from '@/utils/format'
import { copyToClipboard } from '@/utils/clipboard'
import { t } from '@/i18n'
import {
  normalizeStagingItems,
  removeStagingItem,
  sortStagingItems,
  STAGING_LIMITS,
  STAGING_STORAGE_KEY,
  toggleStagingPin,
  updateStagingItem,
  upsertStagingItem
} from '@shared/staging'

const { showSuccess, showError, showInfo, showWarning } = useToast()

const items = ref(loadItems())
const query = ref('')
const editorVisible = ref(false)
const editingId = ref('')
const editorTitle = ref('')
const editorText = ref('')
const clearVisible = ref(false)
const sendMenu = ref({ show: false, x: 0, y: 0 })
const sendResource = ref(null)

const visibleItems = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  const sorted = sortStagingItems(items.value)
  if (!keyword) return sorted
  return sorted.filter(
    (item) => item.title.toLowerCase().includes(keyword) || item.text.toLowerCase().includes(keyword)
  )
})

function loadItems() {
  try {
    return normalizeStagingItems(JSON.parse(localStorage.getItem(STAGING_STORAGE_KEY) || '[]'))
  } catch {
    return []
  }
}

function persistItems() {
  try {
    localStorage.setItem(STAGING_STORAGE_KEY, JSON.stringify(items.value))
  } catch {
    // 存储不可用时仅保留内存中的暂存内容
  }
}

function previewText(text) {
  if (!text) return ''
  return text.length > 800 ? `${text.slice(0, 800)}…` : text
}

function relativeTime(timestamp) {
  return formatRelativeTime(timestamp)
}

function itemResource(item) {
  return { kind: 'text', title: item.title, text: item.text }
}

function openSendMenu(event, resource) {
  sendResource.value = resource
  const rect = event.currentTarget.getBoundingClientRect()
  sendMenu.value = { show: true, x: rect.right - 252, y: rect.bottom + 6 }
}

function onSendDone(target) {
  showSuccess(t('已发送到 {name}', { name: t(target.name) }))
}

function openEditor(item = null) {
  editingId.value = item?.id || ''
  editorTitle.value = item?.title || ''
  editorText.value = item?.text || ''
  editorVisible.value = true
}

function closeEditor() {
  editorVisible.value = false
  editingId.value = ''
  editorTitle.value = ''
  editorText.value = ''
}

function saveEntry() {
  if (!editorText.value.trim()) {
    showWarning(t('请填写暂存内容'))
    return
  }
  if (editingId.value) {
    items.value = updateStagingItem(items.value, editingId.value, {
      title: editorTitle.value,
      text: editorText.value
    })
    persistItems()
    closeEditor()
    showSuccess(t('已保存暂存条目'))
    return
  }
  const result = upsertStagingItem(items.value, { title: editorTitle.value, text: editorText.value })
  if (!result.item) {
    showWarning(t('最多暂存 {p0} 条，请先删除不需要的条目', { p0: STAGING_LIMITS.max }))
    return
  }
  items.value = result.items
  persistItems()
  closeEditor()
  showSuccess(
    result.created
      ? t('已暂存「{p0}」', { p0: result.item.title })
      : t('已更新暂存条目「{p0}」', { p0: result.item.title })
  )
}

function addIncoming(resource) {
  const truncated = resource.text.length > STAGING_LIMITS.textLength
  const result = upsertStagingItem(items.value, { title: resource.title, text: resource.text })
  if (!result.item) {
    showWarning(t('最多暂存 {p0} 条，请先删除不需要的条目', { p0: STAGING_LIMITS.max }))
    return
  }
  items.value = result.items
  persistItems()
  if (truncated) {
    showWarning(t('内容过长，已截断到 {p0} 字符', { p0: STAGING_LIMITS.textLength }))
  } else if (result.created) {
    showSuccess(t('已暂存「{p0}」', { p0: result.item.title }))
  } else {
    showInfo(t('已更新暂存条目「{p0}」', { p0: result.item.title }))
  }
}

async function copyItem(item) {
  const ok = await copyToClipboard(item.text)
  if (ok) showSuccess(t('已复制「{p0}」', { p0: item.title }))
  else showError(t('复制失败'))
}

function togglePin(item) {
  items.value = toggleStagingPin(items.value, item.id)
  persistItems()
  showInfo(item.pinned ? t('已取消置顶') : t('已置顶'))
}

function removeItem(item) {
  items.value = removeStagingItem(items.value, item.id)
  persistItems()
  showInfo(t('已删除暂存条目「{p0}」', { p0: item.title }))
}

function clearAll() {
  clearVisible.value = false
  items.value = []
  persistItems()
  showSuccess(t('已清空暂存架'))
}

onMounted(() => {
  const incoming = takeSendResource('/staging')
  if (incoming?.kind === 'text') addIncoming(incoming)
})
</script>

<style scoped>
.staging-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.staging-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.staging-search {
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

.staging-search:focus-within {
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.staging-search > svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.staging-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-dense);
}

.staging-search-clear {
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

.staging-search-clear svg {
  width: 12px;
  height: 12px;
}

.staging-summary {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

.staging-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.staging-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.staging-editor-name {
  flex: 1;
  min-width: 0;
}

.staging-editor-text {
  min-height: 120px;
  font-family: var(--font-mono);
}

.staging-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.staging-item {
  display: flex;
  align-items: flex-start;
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

.staging-item:hover,
.staging-item:focus-visible {
  border-color: var(--accent-color);
  background: var(--surface-hover);
}

.staging-item:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.staging-item.pinned {
  border-color: rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.04);
}

.staging-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.staging-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.staging-name {
  font-size: var(--font-size-dense);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staging-badge {
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(var(--accent-rgb), 0.35);
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.staging-time {
  margin-left: auto;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.staging-text {
  margin: 0;
  max-height: 96px;
  overflow: hidden;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.staging-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0.35;
  transition: opacity 0.15s ease;
}

.staging-item:hover .staging-actions,
.staging-item:focus-within .staging-actions {
  opacity: 1;
}

.staging-actions button {
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

.staging-actions button svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.staging-actions button:hover,
.staging-actions button.active {
  border-color: var(--border-color);
  background: var(--surface-hover);
  color: var(--accent-color);
}

.staging-actions button.danger:hover {
  border-color: rgba(var(--error-rgb), 0.4);
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.staging-empty {
  flex: 1;
}

@media (max-width: 720px) {
  .staging-summary {
    display: none;
  }

  .staging-search {
    width: 100%;
  }
}
</style>
