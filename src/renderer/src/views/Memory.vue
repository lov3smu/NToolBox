<template>
  <PageLayout tool-path="/memory" page-class="knowledge-page">
    <div class="knowledge-body">
      <section class="panel knowledge-panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('知识来源与检索') }}</span>
          <div class="panel-actions">
            <span class="knowledge-count">{{ t('{count} 个来源', { count: sources.length }) }}</span>
            <button class="btn btn-secondary btn-sm" @click="addDirectory">{{ t('添加目录') }}</button>
            <button class="btn btn-secondary btn-sm" @click="addFiles">{{ t('添加文件') }}</button>
          </div>
        </div>

        <div class="panel-body knowledge-panel-body">
          <div class="knowledge-search">
            <div class="knowledge-search-row">
              <input
                v-model="searchQuery"
                class="input-field"
                :placeholder="t('输入关键词测试检索，例如：部署流程')"
                @keyup.enter="runSearch"
              />
              <button class="btn btn-secondary btn-sm" :disabled="searching || !searchQuery.trim()" @click="runSearch">
                {{ searching ? t('检索中') : t('检索') }}
              </button>
            </div>
            <div v-if="searchMeta" class="knowledge-search-meta">
              {{ t('扫描 {count} 个文件', { count: searchMeta.searchedFiles || 0 }) }}
              <template v-if="searchMeta.truncated"> · {{ t('已截断') }}</template>
              <template v-if="searchMeta.missingSources">
                · {{ t('{count} 个来源路径不存在', { count: searchMeta.missingSources }) }}
              </template>
            </div>
          </div>

          <div v-if="loading" class="knowledge-empty">{{ t('正在读取知识库...') }}</div>

          <div v-else-if="sources.length === 0" class="knowledge-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <p>{{ t('暂无知识来源') }}</p>
            <span>{{ t('添加目录或文件后，AI 就能引用这些资料') }}</span>
          </div>

          <div v-else class="knowledge-sources">
            <div
              v-for="source in sources"
              :key="source.id"
              class="knowledge-source"
              :class="{ disabled: !source.enabled }"
            >
              <span class="knowledge-source-icon">
                <svg
                  v-if="source.type === 'directory'"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </span>
              <span class="knowledge-source-copy">
                <span class="knowledge-source-name">{{ source.label }}</span>
                <span class="knowledge-source-path" :title="source.path">{{ source.path }}</span>
              </span>
              <span class="knowledge-badge">{{ source.type === 'directory' ? t('目录') : t('文件') }}</span>
              <span v-if="!source.available" class="knowledge-missing">{{ t('路径不存在') }}</span>
              <button
                class="knowledge-toggle"
                :class="{ active: source.enabled }"
                :title="source.enabled ? t('已启用，点击停用') : t('已停用，点击启用')"
                @click="toggleSource(source)"
              >
                <span />
              </button>
              <button
                class="btn-icon btn-icon-danger btn-sm"
                :title="t('移除来源')"
                @click="requestRemoveSource(source)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          </div>

          <div v-if="searchResults.length" class="knowledge-results">
            <div class="knowledge-results-head">
              {{ t('检索结果') }}
              <span>{{ t('{count} 条', { count: searchResults.length }) }}</span>
            </div>
            <article v-for="item in searchResults" :key="`${item.sourceId}:${item.path}`" class="knowledge-result">
              <div class="knowledge-result-head">
                <span class="knowledge-result-name">{{ item.label }}</span>
                <span class="knowledge-result-score">{{ item.score }}</span>
              </div>
              <div class="knowledge-result-path" :title="item.path">{{ item.path }}</div>
              <p class="knowledge-result-excerpt">{{ item.excerpt }}</p>
            </article>
          </div>
          <div v-else-if="searchMeta && !searching" class="knowledge-empty knowledge-no-result">
            {{ searchMeta.message || t('没有匹配的文档，换个关键词试试') }}
          </div>

          <ul class="knowledge-note-list">
            <li>{{ t('单个文件不超过 512 KB，自动跳过二进制文件') }}</li>
            <li>{{ t('知识内容仅在本机建立索引，检索结果会作为上下文发送给所选 AI 服务商') }}</li>
            <li>{{ t('全局与项目记忆在 AI 助手的「记忆」标签中管理') }}</li>
          </ul>
        </div>
      </section>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
    <MessageDialog
      :visible="confirmVisible"
      type="confirm"
      :title="t('移除知识来源')"
      :message="confirmMessage"
      @confirm="handleConfirm"
      @cancel="pendingSource = null"
      @close="pendingSource = null"
    />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  memoryOverview,
  memoryKnowledgeAdd,
  memoryKnowledgeRemove,
  memoryKnowledgeToggle,
  memoryKnowledgeSearch,
  memorySelectFiles,
  selectDirectory
} from '@/api'
import { useToast } from '@/composables'
import PageLayout from '@/layouts/PageLayout.vue'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { t } from '@/i18n'

const { toastVisible, toastMessage, toastType, showSuccess, showError } = useToast()

const overview = ref(null)
const loading = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const searchMeta = ref(null)
const searching = ref(false)
const pendingSource = ref(null)

const sources = computed(() => overview.value?.knowledge || [])
const confirmVisible = computed(() => Boolean(pendingSource.value))
const confirmMessage = computed(() => pendingSource.value?.message || '')

async function loadOverview() {
  loading.value = true
  const result = await memoryOverview('')
  loading.value = false
  overview.value = result?.success ? result : null
}

async function addDirectory() {
  const directory = await selectDirectory()
  if (!directory) return
  const result = await memoryKnowledgeAdd({ type: 'directory', targetPath: directory })
  if (!result?.success) {
    showError(result?.error || t('添加目录失败'))
    return
  }
  showSuccess(result.duplicated ? t('该目录已在知识库中') : t('目录已加入知识库'))
  searchResults.value = []
  searchMeta.value = null
  await loadOverview()
}

async function addFiles() {
  const picked = await memorySelectFiles()
  if (!picked || picked.canceled || !Array.isArray(picked.paths) || picked.paths.length === 0) return
  let added = 0
  const errors = []
  for (const filePath of picked.paths) {
    const result = await memoryKnowledgeAdd({ type: 'file', targetPath: filePath })
    if (result?.success) {
      if (!result.duplicated) added += 1
    } else if (result?.error) {
      errors.push(result.error)
    }
  }
  if (added > 0) showSuccess(t('已添加 {count} 个文件到知识库', { count: added }))
  if (errors.length > 0) showError(errors[0])
  if (added === 0 && errors.length === 0) showError(t('没有新增文件（可能已在知识库中）'))
  searchResults.value = []
  searchMeta.value = null
  await loadOverview()
}

async function toggleSource(source) {
  const result = await memoryKnowledgeToggle(source.id, !source.enabled)
  if (!result?.success) {
    showError(result?.error || t('操作失败'))
    return
  }
  source.enabled = !source.enabled
  if (!source.enabled) {
    searchResults.value = []
    searchMeta.value = null
  }
}

function requestRemoveSource(source) {
  pendingSource.value = {
    id: source.id,
    message: t('确定从知识库移除「{label}」吗？', { label: source.label })
  }
}

async function handleConfirm() {
  const action = pendingSource.value
  pendingSource.value = null
  if (!action) return
  const result = await memoryKnowledgeRemove(action.id)
  if (!result?.success) {
    showError(result?.error || t('移除失败'))
    return
  }
  showSuccess(t('知识来源已移除'))
  searchResults.value = []
  searchMeta.value = null
  await loadOverview()
}

async function runSearch() {
  const query = searchQuery.value.trim()
  if (!query || searching.value) return
  searching.value = true
  searchResults.value = []
  searchMeta.value = null
  const result = await memoryKnowledgeSearch({ query, topK: 8 })
  searching.value = false
  if (!result?.success) {
    searchMeta.value = { message: result?.error || t('检索失败') }
    showError(result?.error || t('检索失败'))
    return
  }
  searchResults.value = result.results || []
  searchMeta.value = result
}

onMounted(loadOverview)
</script>

<style scoped>
.knowledge-page {
  min-height: 0;
}

.knowledge-body {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 16px;
  display: flex;
  overflow: hidden;
}

.knowledge-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.knowledge-panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.knowledge-count {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  padding: 0 4px;
}

.knowledge-search {
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px dashed var(--border-color);
}

.knowledge-search-row {
  display: flex;
  gap: 8px;
}

.knowledge-search-row .input-field {
  flex: 1;
  min-width: 0;
}

.knowledge-search-meta {
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.knowledge-empty {
  display: flex;
  flex: 1;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 28px 16px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.knowledge-empty p {
  margin: 0;
  color: var(--text-secondary);
  font-weight: 500;
}

.knowledge-empty span {
  max-width: 360px;
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.knowledge-empty svg {
  width: 30px;
  height: 30px;
  opacity: 0.45;
}

.knowledge-source {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface);
  transition: var(--transition-fast);
}

.knowledge-source + .knowledge-source {
  margin-top: 8px;
}

.knowledge-source:hover {
  border-color: var(--border-strong);
}

.knowledge-source.disabled {
  opacity: 0.62;
}

.knowledge-source-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.knowledge-source-icon svg {
  width: 16px;
  height: 16px;
}

.knowledge-source-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.knowledge-source-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.knowledge-source-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.knowledge-badge {
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

.knowledge-missing {
  color: var(--warning-dark);
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

.knowledge-toggle {
  position: relative;
  width: 34px;
  height: 20px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--border-strong);
  cursor: pointer;
  transition: background var(--motion-fast) var(--motion-ease);
}

.knowledge-toggle span {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform var(--motion-fast) var(--motion-ease);
}

.knowledge-toggle.active {
  background: var(--accent-color);
}

.knowledge-toggle.active span {
  transform: translateX(14px);
}

.knowledge-results {
  margin-top: 14px;
}

.knowledge-results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.knowledge-results-head span {
  color: var(--text-tertiary);
  font-weight: 400;
}

.knowledge-result {
  padding: 8px 10px;
  border-left: 2px solid rgba(var(--accent-rgb), 0.5);
  border-radius: 0 8px 8px 0;
  background: var(--surface-muted);
}

.knowledge-result + .knowledge-result {
  margin-top: 8px;
}

.knowledge-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.knowledge-result-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.knowledge-result-score {
  color: var(--accent-color);
  font-size: var(--font-size-xs);
}

.knowledge-result-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.knowledge-result-excerpt {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.65;
}

.knowledge-no-result {
  min-height: 120px;
}

.knowledge-note-list {
  margin: 16px 0 0;
  padding-left: 16px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.8;
}

@media (max-width: 720px) {
  .knowledge-body {
    padding: 12px;
  }

  .knowledge-panel .panel-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
