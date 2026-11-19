<template>
  <PageLayout tool-path="/memory" page-class="memory-page">
    <template #actions>
      <div class="memory-tabs" role="tablist">
        <button
          v-for="item in tabs"
          :key="item.key"
          class="memory-tab"
          :class="{ active: tab === item.key }"
          role="tab"
          :aria-selected="tab === item.key"
          @click="tab = item.key"
        >
          {{ t(item.label) }}
          <span class="memory-tab-count">{{ counts[item.key] }}</span>
        </button>
      </div>
      <div class="memory-toolbar-right">
        <button
          v-if="tab === 'project'"
          class="memory-workspace"
          :title="workspacePath || t('选择项目目录')"
          @click="pickWorkspace"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          <span>{{ workspacePath ? workspaceName : t('选择项目目录') }}</span>
        </button>
        <button
          class="memory-auto"
          :class="{ active: autoCapture }"
          :title="autoCapture ? t('AI 可主动保存稳定偏好与项目决策') : t('仅在你明确要求时保存记忆')"
          @click="toggleAutoCapture"
        >
          <span class="memory-auto-dot" />
          {{ t('自动记忆') }}
        </button>
      </div>
    </template>

    <div class="memory-body" :class="{ 'is-single-column': tab !== 'knowledge' }">
      <section v-if="tab === 'knowledge'" class="panel memory-editor">
        <div class="panel-header">
          <span class="panel-title">{{ t('添加知识来源') }}</span>
          <span class="panel-hint">{{ t('目录或文本文件') }}</span>
        </div>

        <div class="panel-body memory-editor-body">
          <p class="memory-note">
            {{ t('导入本地目录或文本文件作为外挂知识库，AI 会在回答相关问题时按关键词检索，并注明来源路径。') }}
          </p>
          <button class="memory-source-action" @click="addDirectory">
            <span class="memory-source-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </span>
            <span class="memory-source-copy">
              <strong>{{ t('添加目录') }}</strong>
              <small>{{ t('递归索引目录内的文本与代码文件') }}</small>
            </span>
          </button>
          <button class="memory-source-action" @click="addFiles">
            <span class="memory-source-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </span>
            <span class="memory-source-copy">
              <strong>{{ t('添加文件') }}</strong>
              <small>{{ t('支持 Markdown、文本、代码与配置等格式') }}</small>
            </span>
          </button>
          <ul class="memory-note-list">
            <li>{{ t('单个文件不超过 512 KB，自动跳过二进制文件') }}</li>
            <li>{{ t('知识内容仅在本机建立索引，检索结果会作为上下文发送给所选 AI 服务商') }}</li>
            <li>{{ t('可在右侧关闭来源并实时测试检索效果') }}</li>
          </ul>
        </div>
      </section>

      <section class="panel memory-list">
        <div class="panel-header">
          <span class="panel-title">{{ listTitle }}</span>
          <div v-if="tab !== 'knowledge'" class="panel-actions">
            <span class="memory-count">{{ t('{count} 条', { count: entries.length }) }}</span>
            <button v-if="entries.length" class="btn btn-ghost btn-sm" @click="requestClearEntries">
              {{ t('清空') }}
            </button>
          </div>
          <div v-else class="panel-actions">
            <span class="memory-count">{{ t('{count} 个来源', { count: sources.length }) }}</span>
          </div>
        </div>

        <div class="panel-body memory-list-body">
          <div v-if="loading" class="memory-empty">{{ t('正在读取记忆...') }}</div>

          <template v-else-if="tab !== 'knowledge'">
            <div v-if="tab === 'project' && !workspacePath" class="memory-empty">
              <p>{{ t('尚未绑定工作区') }}</p>
              <span>{{ t('选择项目目录后可查看该工作区的记忆') }}</span>
            </div>
            <div v-else-if="entries.length === 0" class="memory-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-1 5.8A3.5 3.5 0 0 0 8 16.5V18a3 3 0 0 0 4 2.8" />
                <path d="M12 5a3 3 0 0 1 6 0 3 3 0 0 1 1 5.8 3.5 3.5 0 0 1-3 5.7V18a3 3 0 0 1-4 2.8" />
                <path d="M12 5v16" />
              </svg>
              <p>{{ t('暂无记忆') }}</p>
              <span>{{ t('记忆会在对话中自动生成，并持续更新与升级') }}</span>
            </div>
            <template v-else>
              <article v-for="entry in entries" :key="entry.id" class="memory-entry">
                <div class="memory-entry-head">
                  <span v-for="tag in entry.tags" :key="tag" class="memory-tag">{{ tag }}</span>
                  <span class="memory-entry-source" :class="{ ai: entry.source === 'ai' }">
                    {{ entry.source === 'ai' ? t('AI 保存') : t('手动保存') }}
                  </span>
                  <span class="memory-entry-time">{{ formatTime(entry.updatedAt) }}</span>
                  <button
                    class="btn btn-ghost btn-xs memory-danger memory-entry-delete"
                    @click="requestRemoveEntry(entry)"
                  >
                    {{ t('删除') }}
                  </button>
                </div>
                <p class="memory-entry-content">{{ entry.content }}</p>
              </article>
            </template>
          </template>

          <template v-else>
            <div class="knowledge-search">
              <div class="knowledge-search-row">
                <input
                  v-model="searchQuery"
                  class="input-field"
                  :placeholder="t('输入关键词测试检索，例如：部署流程')"
                  @keyup.enter="runSearch"
                />
                <button
                  class="btn btn-secondary btn-sm"
                  :disabled="searching || !searchQuery.trim()"
                  @click="runSearch"
                >
                  {{ searching ? t('检索中') : t('检索') }}
                </button>
              </div>
              <div v-if="searchMeta" class="knowledge-search-meta">
                {{ t('扫描 {count} 个文件', { count: searchMeta.searchedFiles || 0 }) }}
                <template v-if="searchMeta.truncated"> · {{ t('已截断') }}</template>
                <template v-if="searchMeta.missingSources">
                  · {{ t('{count} 个来源路径不存在', { count: searchMeta.missingSources }) }}</template
                >
              </div>
            </div>

            <div v-if="sources.length === 0" class="memory-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <p>{{ t('暂无知识来源') }}</p>
              <span>{{ t('从左侧添加目录或文件，AI 就能引用这些资料') }}</span>
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
            <div v-else-if="searchMeta && !searching" class="memory-empty knowledge-no-result">
              {{ searchMeta.message || t('没有匹配的文档，换个关键词试试') }}
            </div>
          </template>
        </div>
      </section>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
    <MessageDialog
      :visible="confirmVisible"
      type="confirm"
      :title="confirmTitle"
      :message="confirmMessage"
      @confirm="handleConfirm"
      @cancel="pendingConfirm = null"
      @close="pendingConfirm = null"
    />
  </PageLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import {
  memoryOverview,
  memoryRemove,
  memoryClear,
  memoryKnowledgeAdd,
  memoryKnowledgeRemove,
  memoryKnowledgeToggle,
  memoryKnowledgeSearch,
  memorySelectFiles,
  selectDirectory,
  patchConfig
} from '@/api'
import { useConfig, useToast } from '@/composables'
import PageLayout from '@/layouts/PageLayout.vue'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import { t } from '@/i18n'

const TABS = [
  {
    key: 'global',
    get label() {
      return t('全局记忆')
    }
  },
  {
    key: 'project',
    get label() {
      return t('项目记忆')
    }
  },
  {
    key: 'knowledge',
    get label() {
      return t('外挂知识库')
    }
  }
]
const WORKSPACE_KEY = 'memory_workspace'

const route = useRoute()
const { config } = useConfig()
const { toastVisible, toastMessage, toastType, showSuccess, showError } = useToast()

const tabs = TABS
const tab = ref(TABS.some((item) => item.key === route.query.tab) ? route.query.tab : 'global')
const overview = ref(null)
const loading = ref(false)
const autoCapture = ref(true)
const workspacePath = ref(resolveInitialWorkspace())
const searchQuery = ref('')
const searchResults = ref([])
const searchMeta = ref(null)
const searching = ref(false)
const pendingConfirm = ref(null)

const confirmVisible = computed(() => Boolean(pendingConfirm.value))
const confirmTitle = computed(() => {
  const kind = pendingConfirm.value?.kind
  if (kind === 'entry') return t('删除记忆')
  if (kind === 'clear') return t('清空记忆')
  return t('移除知识来源')
})
const confirmMessage = computed(() => pendingConfirm.value?.message || '')

const counts = computed(() => ({
  global: overview.value?.global?.length || 0,
  project: overview.value?.project?.length || 0,
  knowledge: overview.value?.knowledge?.length || 0
}))
const entries = computed(() => {
  if (tab.value === 'project') return overview.value?.project || []
  return overview.value?.global || []
})
const sources = computed(() => overview.value?.knowledge || [])
const workspaceName = computed(() => baseName(workspacePath.value))
const listTitle = computed(() => {
  if (tab.value === 'knowledge') return t('知识来源与检索')
  return tab.value === 'project' ? t('项目记忆') : t('全局记忆')
})

function resolveInitialWorkspace() {
  const fromQuery = typeof route.query.workspace === 'string' ? route.query.workspace.trim() : ''
  if (fromQuery) return fromQuery
  const stored = localStorage.getItem(WORKSPACE_KEY)
  if (stored) return stored
  try {
    const viewState = JSON.parse(localStorage.getItem('chat_view_state') || '{}')
    if (typeof viewState.lastWorkspace === 'string') return viewState.lastWorkspace
  } catch {
    // ignore corrupted view state
  }
  return ''
}

function baseName(value) {
  const parts = String(value || '')
    .split(/[\\/]/)
    .filter(Boolean)
  return parts[parts.length - 1] || value
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

async function loadOverview() {
  loading.value = true
  const result = await memoryOverview(workspacePath.value)
  loading.value = false
  overview.value = result?.success ? result : null
}

async function pickWorkspace() {
  const directory = await selectDirectory()
  if (!directory) return
  workspacePath.value = directory
  searchResults.value = []
  searchMeta.value = null
}

function requestRemoveEntry(entry) {
  pendingConfirm.value = {
    kind: 'entry',
    id: entry.id,
    message: t('确定删除这条记忆吗？此操作无法撤销。')
  }
}

async function removeEntry(id) {
  const result = await memoryRemove({
    scope: tab.value,
    workspacePath: workspacePath.value,
    id
  })
  if (!result?.success) {
    showError(result?.error || t('删除失败'))
    return
  }
  showSuccess(t('记忆已删除'))
  await loadOverview()
}

function requestClearEntries() {
  pendingConfirm.value = {
    kind: 'clear',
    message: t('确定清空{scope}记忆吗？此操作无法撤销。', { scope: tab.value === 'project' ? t('项目') : t('全局') })
  }
}

async function clearEntries() {
  const result = await memoryClear({ scope: tab.value, workspacePath: workspacePath.value })
  if (!result?.success) {
    showError(result?.error || t('清空失败'))
    return
  }
  showSuccess(t('记忆已清空'))
  await loadOverview()
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

async function removeSource(id) {
  const result = await memoryKnowledgeRemove(id)
  if (!result?.success) {
    showError(result?.error || t('移除失败'))
    return
  }
  showSuccess(t('知识来源已移除'))
  searchResults.value = []
  searchMeta.value = null
  await loadOverview()
}

function requestRemoveSource(source) {
  pendingConfirm.value = {
    kind: 'source',
    id: source.id,
    message: t('确定从知识库移除「{label}」吗？', { label: source.label })
  }
}

async function handleConfirm() {
  const action = pendingConfirm.value
  pendingConfirm.value = null
  if (!action) return
  if (action.kind === 'entry') await removeEntry(action.id)
  else if (action.kind === 'clear') await clearEntries()
  else if (action.kind === 'source') await removeSource(action.id)
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

async function toggleAutoCapture() {
  const next = !autoCapture.value
  const saved = await patchConfig({ memory: { auto_capture: next } })
  if (!saved) {
    showError(t('设置保存失败'))
    return
  }
  autoCapture.value = next
  showSuccess(next ? t('自动记忆已开启') : t('自动记忆已关闭'))
}

watch(config, (value) => {
  if (value) autoCapture.value = value.memory?.auto_capture !== false
})

watch(workspacePath, (value) => {
  if (value) localStorage.setItem(WORKSPACE_KEY, value)
  else localStorage.removeItem(WORKSPACE_KEY)
  searchResults.value = []
  searchMeta.value = null
  loadOverview()
})

watch(tab, () => {
  searchResults.value = []
  searchMeta.value = null
})

onMounted(() => {
  autoCapture.value = config.value?.memory.auto_capture !== false
  loadOverview()
})
</script>

<style scoped>
.memory-page {
  min-height: 0;
}

.memory-tabs {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: 10px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.memory-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  cursor: pointer;
  transition: var(--transition-fast);
}

.memory-tab:hover {
  color: var(--text-primary);
}

.memory-tab.active {
  background: var(--surface);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.memory-tab-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  line-height: 16px;
  text-align: center;
}

.memory-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.memory-workspace,
.memory-auto {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-family: inherit;
  cursor: pointer;
  transition: var(--transition-fast);
}

.memory-workspace {
  max-width: 280px;
}

.memory-workspace span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memory-workspace svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--accent-color);
}

.memory-workspace:hover,
.memory-auto:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.memory-auto-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-tertiary);
  transition: var(--transition-fast);
}

.memory-auto.active {
  border-color: rgba(var(--success-rgb), 0.35);
  background: rgba(var(--success-rgb), 0.08);
  color: var(--success-dark);
}

.memory-auto.active .memory-auto-dot {
  background: var(--success-color);
  box-shadow: 0 0 0 3px rgba(var(--success-rgb), 0.16);
}

.memory-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 14px;
  padding: 14px 20px 16px;
  overflow: hidden;
}

.memory-body.is-single-column {
  grid-template-columns: minmax(0, 1fr);
}

.memory-editor,
.memory-list {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.memory-editor + .memory-list {
  margin-top: 0;
}

.memory-editor-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.memory-note {
  margin: 0 0 2px;
  font-size: var(--font-size-xs);
  line-height: 1.65;
  color: var(--text-secondary);
}

.memory-source-action {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 1px dashed var(--border-strong);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text-primary);
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  transition: var(--transition-fast);
}

.memory-source-action:hover {
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.04);
}

.memory-source-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 9px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.memory-source-icon svg {
  width: 18px;
  height: 18px;
}

.memory-source-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.memory-source-copy strong {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.memory-source-copy small {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.memory-note-list {
  margin: 4px 0 0;
  padding-left: 16px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.8;
}

.memory-count {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  padding: 0 4px;
}

.memory-list-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.memory-empty {
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

.memory-empty p {
  margin: 0;
  color: var(--text-secondary);
  font-weight: 500;
}

.memory-empty span {
  max-width: 340px;
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.memory-empty svg {
  width: 30px;
  height: 30px;
  opacity: 0.45;
}

.memory-entry {
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--surface);
  transition: var(--transition-fast);
}

.memory-entry + .memory-entry {
  margin-top: 8px;
}

.memory-entry:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}

.memory-entry-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 6px;
}

.memory-tag {
  padding: 1px 7px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
}

.memory-entry-source {
  padding: 1px 7px;
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.memory-entry-source.ai {
  border-color: rgba(var(--accent-rgb), 0.28);
  color: var(--accent-color);
}

.memory-entry-time {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.memory-entry-content {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
}

.memory-entry-delete {
  opacity: 0.65;
  transition: opacity var(--motion-fast) var(--motion-ease);
}

.memory-entry:hover .memory-entry-delete,
.memory-entry-delete:focus-visible {
  opacity: 1;
}

.memory-danger {
  color: var(--error-color);
}

.memory-danger:hover {
  background: rgba(var(--error-rgb), 0.08);
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

@media (max-width: 1080px) {
  .memory-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto;
    flex: none;
    overflow: visible;
  }

  .memory-editor,
  .memory-list {
    overflow: visible;
  }

  .memory-editor-body {
    flex: none;
    overflow: visible;
  }

  .memory-list {
    min-height: 0;
  }

  .memory-list-body {
    overflow: visible;
  }
}

@media (max-width: 720px) {
  .memory-toolbar-right {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .memory-workspace {
    max-width: 200px;
  }
}
</style>
