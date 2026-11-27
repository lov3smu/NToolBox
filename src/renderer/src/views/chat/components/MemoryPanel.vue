<template>
  <section class="memory-panel">
    <div class="memory-panel-toolbar">
      <div class="memory-segment" role="tablist" :aria-label="t('记忆范围切换')">
        <button
          v-for="item in tabs"
          :key="item.key"
          type="button"
          role="tab"
          class="memory-segment-btn"
          :class="{ active: tab === item.key }"
          :aria-selected="tab === item.key"
          @click="tab = item.key"
        >
          {{ t(item.label) }}
          <span class="memory-count">{{ counts[item.key] }}</span>
        </button>
      </div>
      <div class="memory-panel-actions">
        <span v-if="tab === 'project' && workspace" class="memory-workspace" :title="workspace">
          <AppIcon name="folder" />
          <span>{{ workspaceName }}</span>
        </span>
        <button
          class="memory-auto"
          :class="{ active: autoCapture }"
          :title="autoCapture ? t('AI 可主动保存稳定偏好与项目决策') : t('仅在你明确要求时保存记忆')"
          @click="toggleAutoCapture"
        >
          <span class="memory-auto-dot" />
          {{ t('自动记忆') }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="emit('open-knowledge')">{{ t('外挂知识库') }}</button>
      </div>
    </div>

    <div class="memory-panel-body">
      <div v-if="loading" class="memory-empty">{{ t('正在读取记忆...') }}</div>

      <div v-else-if="tab === 'project' && !workspace" class="memory-empty">
        <p>{{ t('尚未绑定工作区') }}</p>
        <span>{{ t('项目记忆保存在工作区目录中，绑定后可查看与清理') }}</span>
        <button class="btn btn-secondary btn-sm" @click="emit('bind-workspace')">{{ t('绑定工作区') }}</button>
      </div>

      <div v-else-if="entries.length === 0" class="memory-empty">
        <AppIcon name="brain" :stroke-width="1.6" />
        <p>{{ t('暂无记忆') }}</p>
        <span>{{ t('记忆会在对话中自动生成，并持续更新与升级') }}</span>
      </div>

      <template v-else>
        <div class="memory-list-head">
          <span class="memory-list-count">{{ t('{count} 条', { count: entries.length }) }}</span>
          <span class="memory-store-path" :title="storePath">{{ storePath }}</span>
          <button class="btn btn-ghost btn-sm" @click="requestClear">{{ t('清空') }}</button>
        </div>
        <div class="memory-list">
          <article v-for="entry in entries" :key="entry.id" class="memory-entry">
            <div class="memory-entry-head">
              <span v-for="tag in entry.tags" :key="tag" class="memory-tag">{{ tag }}</span>
              <span class="memory-entry-source" :class="{ ai: entry.source === 'ai' }">
                {{ entry.source === 'ai' ? t('AI 保存') : t('手动保存') }}
              </span>
              <span class="memory-entry-time">{{ formatTime(entry.updatedAt) }}</span>
              <button class="btn btn-ghost btn-xs memory-danger memory-entry-delete" @click="requestRemoveEntry(entry)">
                {{ t('删除') }}
              </button>
            </div>
            <p class="memory-entry-content">{{ entry.content }}</p>
          </article>
        </div>
      </template>
    </div>

    <MessageDialog
      :visible="confirmVisible"
      type="confirm"
      :title="confirmTitle"
      :message="confirmMessage"
      @confirm="handleConfirm"
      @cancel="pendingConfirm = null"
      @close="pendingConfirm = null"
    />
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { memoryClear, memoryOverview, memoryRemove, patchConfig } from '@/api'
import { useConfig, useToast } from '@/composables'
import MessageDialog from '@/components/MessageDialog.vue'
import { t } from '@/i18n'

import AppIcon from '@/components/AppIcon.vue'
const props = defineProps({
  workspace: { type: String, default: '' }
})
const emit = defineEmits(['bind-workspace', 'open-knowledge'])

const TABS = [
  { key: 'global', label: '全局记忆' },
  { key: 'project', label: '项目记忆' }
]

const { config } = useConfig()
const { showSuccess, showError } = useToast()

const tabs = TABS
const tab = ref('global')
const overview = ref(null)
const loading = ref(false)
const autoCapture = ref(true)
const pendingConfirm = ref(null)

const confirmVisible = computed(() => Boolean(pendingConfirm.value))
const confirmTitle = computed(() => (pendingConfirm.value?.kind === 'clear' ? t('清空记忆') : t('删除记忆')))
const confirmMessage = computed(() => pendingConfirm.value?.message || '')

const counts = computed(() => ({
  global: overview.value?.global?.length || 0,
  project: overview.value?.project?.length || 0
}))
const entries = computed(() => {
  if (tab.value === 'project') return overview.value?.project || []
  return overview.value?.global || []
})
const storePath = computed(() => {
  if (tab.value === 'project') return overview.value?.projectDir || ''
  return overview.value?.globalDir || ''
})
const workspaceName = computed(() => {
  const parts = String(props.workspace || '')
    .split(/[\\/]/)
    .filter(Boolean)
  return parts[parts.length - 1] || props.workspace
})

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

async function loadOverview() {
  loading.value = true
  const result = await memoryOverview(props.workspace)
  loading.value = false
  overview.value = result?.success ? result : null
}

function requestRemoveEntry(entry) {
  pendingConfirm.value = {
    kind: 'entry',
    id: entry.id,
    message: t('确定删除这条记忆吗？此操作无法撤销。')
  }
}

function requestClear() {
  pendingConfirm.value = {
    kind: 'clear',
    message: t('确定清空{scope}记忆吗？此操作无法撤销。', {
      scope: tab.value === 'project' ? t('项目') : t('全局')
    })
  }
}

async function removeEntry(id) {
  const result = await memoryRemove({ scope: tab.value, workspacePath: props.workspace, id })
  if (!result?.success) {
    showError(result?.error || t('删除失败'))
    return
  }
  showSuccess(t('记忆已删除'))
  await loadOverview()
}

async function clearEntries() {
  const result = await memoryClear({ scope: tab.value, workspacePath: props.workspace })
  if (!result?.success) {
    showError(result?.error || t('清空失败'))
    return
  }
  showSuccess(t('记忆已清空'))
  await loadOverview()
}

async function handleConfirm() {
  const action = pendingConfirm.value
  pendingConfirm.value = null
  if (!action) return
  if (action.kind === 'entry') await removeEntry(action.id)
  else if (action.kind === 'clear') await clearEntries()
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

watch(
  () => props.workspace,
  () => loadOverview()
)

watch(config, (value) => {
  if (value) autoCapture.value = value.memory?.auto_capture !== false
})

onMounted(() => {
  autoCapture.value = config.value?.memory.auto_capture !== false
  loadOverview()
})
</script>

<style scoped>
.memory-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 20px 16px;
  overflow: hidden;
}

.memory-panel-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
  margin-bottom: 12px;
}

.memory-segment {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
}

.memory-segment-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-family: inherit;
  cursor: pointer;
  transition: var(--transition-fast);
}

.memory-segment-btn:hover {
  color: var(--text-primary);
}

.memory-segment-btn.active {
  background: var(--surface);
  color: var(--text-primary);
  font-weight: 600;
  box-shadow: var(--shadow-sm);
}

.memory-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: var(--radius-pill);
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  line-height: 16px;
  text-align: center;
}

.memory-panel-actions {
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
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-family: inherit;
}

.memory-workspace {
  max-width: 220px;
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

.memory-auto {
  cursor: pointer;
  transition: var(--transition-fast);
}

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

.memory-panel-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.memory-list-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 1px dashed var(--border-color);
}

.memory-list-count {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.memory-store-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.memory-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}

.memory-empty {
  display: flex;
  flex: 1;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
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
  max-width: 360px;
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
  border-radius: var(--radius-md);
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
  border-radius: var(--radius-pill);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
}

.memory-entry-source {
  padding: 1px 7px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
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

@media (max-width: 900px) {
  .memory-panel-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
