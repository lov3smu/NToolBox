<template>
  <PageLayout tool-path="/image-hosting">
    <div class="page-body">
      <div class="image-host-grid">
        <section class="panel upload-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('上传图片') }}</span>
            <span class="panel-hint">{{ t('拖拽、粘贴或选择本地图片') }}</span>
            <div class="panel-actions upload-actions">
              <label class="provider-select">
                <span>{{ t('图床') }}</span>
                <SettingSelect
                  :model-value="settings.active"
                  :options="providerOptions"
                  :disabled="uploading || saving"
                  @update:model-value="onProviderSelect"
                />
              </label>
            </div>
          </div>
          <div class="panel-body upload-body">
            <div v-if="!activeConfigured" class="setup-callout">
              <span class="setup-icon">!</span>
              <div class="setup-text">
                <strong>{{ t('{name} 尚未配置完整', { name: activeMeta.name }) }}</strong>
                <span>{{ t('补全 {fields} 后即可上传图片。', { fields: missingLabels }) }}</span>
              </div>
              <button class="btn btn-secondary btn-sm" @click="openConfig">{{ t('前往配置') }}</button>
            </div>

            <div
              class="drop-zone"
              :class="{ dragging, uploading }"
              role="button"
              tabindex="0"
              @click="chooseFiles"
              @keydown.enter.prevent="chooseFiles"
              @keydown.space.prevent="chooseFiles"
              @dragenter.prevent="onDragEnter"
              @dragover.prevent
              @dragleave.prevent="onDragLeave"
              @drop.prevent="onDrop"
            >
              <div class="drop-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M12 16V4" />
                  <path d="m7 9 5-5 5 5" />
                  <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </div>
              <div class="drop-title">
                {{ dragging ? t('松开即可上传') : uploading ? t('正在上传图片…') : t('拖拽图片到这里，或点击选择') }}
              </div>
              <div class="drop-sub">
                {{ t('支持 PNG / JPG / GIF / WebP / SVG / AVIF，单张不超过 {size}', { size: maxSizeLabel }) }}
              </div>
              <div class="drop-actions">
                <button class="btn btn-primary" :disabled="uploading || loading" @click.stop="chooseFiles">
                  {{ t('选择图片') }}
                </button>
                <button class="btn btn-secondary" :disabled="uploading || loading" @click.stop="uploadClipboard">
                  {{ t('从剪贴板上传') }}
                </button>
              </div>
              <div class="drop-hint">{{ t('也可以直接按 Ctrl / Cmd + V 上传剪贴板中的图片') }}</div>
            </div>

            <div class="upload-options">
              <label class="option-switch" :class="{ active: settings.rename }">
                <input v-model="settings.rename" class="switch" type="checkbox" @change="onRenameChange" />
                <span>{{ t('重命名文件') }}</span>
              </label>
              <span class="option-hint">{{ t('自动追加时间戳，避免同名文件覆盖') }}</span>
            </div>

            <div v-if="tasks.length" class="task-section">
              <div class="task-header">
                <span class="task-title">{{ t('本次上传') }}</span>
                <span class="task-count">{{ tasks.length }}</span>
              </div>
              <div class="task-list">
                <div v-for="task in tasks" :key="task.id" class="task-item" :class="task.status">
                  <button
                    type="button"
                    class="task-thumb"
                    :disabled="!task.url || task.broken"
                    :title="task.url && !task.broken ? t('点击预览') : ''"
                    :aria-label="task.url && !task.broken ? t('点击预览') : undefined"
                    @click="previewImage(task.url, task.name)"
                  >
                    <img v-if="task.url && !task.broken" :src="task.url" alt="" @error="task.broken = true" />
                    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  </button>
                  <div class="task-info">
                    <span class="task-name" :title="task.name">{{ task.name }}</span>
                    <span class="task-meta" :title="task.error || task.url">
                      {{
                        task.status === 'uploading'
                          ? t('正在上传到 {name}', { name: activeMeta.name })
                          : task.status === 'success'
                            ? task.url
                            : task.error
                      }}
                    </span>
                  </div>
                  <span class="task-status" :class="task.status">
                    <span v-if="task.status === 'uploading'" class="mini-spinner" />
                    {{ taskStatusLabel(task) }}
                  </span>
                  <button
                    v-if="task.url"
                    class="btn-icon btn-sm"
                    :class="{ active: copiedId === task.id }"
                    :title="t('复制链接')"
                    @click="copyTask(task)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel history-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('上传记录') }}</span>
            <span class="history-count">{{ history.length }}</span>
            <div class="panel-actions history-actions">
              <div class="segmented link-format">
                <button
                  v-for="format in linkFormats"
                  :key="format.value"
                  type="button"
                  class="segmented-item"
                  :class="{ active: settings.linkFormat === format.value }"
                  @click="setLinkFormat(format.value)"
                >
                  {{ format.label }}
                </button>
              </div>
              <button v-if="history.length" class="btn btn-danger btn-sm" @click="requestClearHistory">
                {{ t('清空') }}
              </button>
            </div>
          </div>
          <div class="panel-body history-body">
            <div v-if="!history.length" class="panel-empty history-empty">
              <span class="empty-state-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </span>
              <span class="empty-state-title">{{ t('暂无上传记录') }}</span>
              <span class="empty-state-hint">{{ t('上传成功的图片会显示在这里，点击复制按钮即可获取链接') }}</span>
            </div>
            <div v-else class="history-list">
              <article v-for="record in history" :key="record.id" class="history-item">
                <button
                  type="button"
                  class="history-thumb"
                  :disabled="!record.url || record.broken"
                  :title="record.url && !record.broken ? t('点击预览') : ''"
                  :aria-label="record.url && !record.broken ? t('点击预览') : undefined"
                  @click="previewImage(record.url, record.name)"
                >
                  <img
                    v-if="record.url && !record.broken"
                    :src="record.url"
                    :alt="record.name"
                    loading="lazy"
                    @error="record.broken = true"
                  />
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                </button>
                <div class="history-info">
                  <span class="history-name" :title="record.name">{{ record.name }}</span>
                  <span class="history-meta">
                    {{ record.providerName || record.provider }} · {{ formatFileSize(record.size) }} ·
                    {{ record.uploadedAt ? formatRelativeTime(record.uploadedAt) : t('未知时间') }}
                  </span>
                </div>
                <div class="history-item-actions">
                  <button
                    class="btn-icon btn-sm"
                    :class="{ active: copiedId === record.id }"
                    :title="t('复制链接')"
                    @click="copyRecord(record)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button class="btn-icon btn-sm" :title="t('打开链接')" @click="openRecord(record)">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                  <button
                    class="btn-icon btn-sm btn-icon-danger"
                    :title="t('删除记录')"
                    @click="requestRemoveRecord(record)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v5M14 11v5" />
                    </svg>
                  </button>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import Toast from '@/components/Toast.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import SettingSelect from '@/components/settings/SettingSelect.vue'
import { previewImage, useToast } from '@/composables'
import { getLocale, t } from '@/i18n'
import { copyToClipboard } from '@/utils'
import { formatFileSize, formatRelativeTime } from '@/utils/format'
import {
  getPathForFile,
  imageHostClearHistory,
  imageHostRemoveHistory,
  imageHostSaveSettings,
  imageHostSelectFiles,
  imageHostState,
  imageHostUpload,
  imageHostUploadClipboard,
  openExternal,
  openSettings
} from '@/api'
import {
  IMAGE_HOST_EXTENSIONS,
  IMAGE_HOST_LINK_FORMATS,
  IMAGE_HOST_PROVIDERS,
  createDefaultImageHostSettings,
  formatImageLink,
  getMissingRequiredFields,
  getProviderMeta,
  isProviderConfigured,
  normalizeImageHostMaxFileMb,
  normalizeImageHostSettings
} from '@shared/imageHosts'

const providers = IMAGE_HOST_PROVIDERS
const linkFormats = IMAGE_HOST_LINK_FORMATS
const maxSizeLabel = computed(() => `${normalizeImageHostMaxFileMb(settings.value.maxFileMb)}MB`)
const imagePathPattern = new RegExp(`\\.(${IMAGE_HOST_EXTENSIONS.join('|')})$`, 'i')

const { toastVisible, toastMessage, toastType, showSuccess, showError, showWarning, showInfo } = useToast()

const settings = ref(createDefaultImageHostSettings())
const history = ref([])
const tasks = ref([])
const loading = ref(true)
const uploading = ref(false)
const pendingConfirm = ref(null)

const confirmVisible = computed(() => Boolean(pendingConfirm.value))
const confirmTitle = computed(() => (pendingConfirm.value?.kind === 'record' ? t('删除记录') : t('清空记录')))
const confirmMessage = computed(() => pendingConfirm.value?.message || '')
const saving = ref(false)
const dragging = ref(false)
const copiedId = ref('')

let dragDepth = 0
let taskSeq = 0
let copiedTimer = null

const activeMeta = computed(() => getProviderMeta(settings.value.active) || providers[0])
const providerOptions = computed(() =>
  providers.map((provider) => ({
    value: provider.id,
    label: `${t(provider.name)}${
      isProviderConfigured(provider.id, settings.value.providers[provider.id]) ? '' : t('（未配置）')
    }`
  }))
)
const missingFields = computed(() =>
  getMissingRequiredFields(activeMeta.value.id, settings.value.providers[activeMeta.value.id])
)
const activeConfigured = computed(() => missingFields.value.length === 0)
const missingLabels = computed(() =>
  missingFields.value.map((field) => t(field.label)).join(getLocale() === 'en-US' ? ', ' : '、')
)
const linkFormatLabel = computed(
  () => linkFormats.find((format) => format.value === settings.value.linkFormat)?.label || 'URL'
)

function fileName(filePath) {
  return (
    String(filePath || '')
      .split(/[\\/]/)
      .pop() || 'image'
  )
}

function taskStatusLabel(task) {
  if (task.status === 'uploading') return t('上传中')
  if (task.status === 'success') return t('已上传')
  return t('失败')
}

async function applySettings(next) {
  settings.value = normalizeImageHostSettings(next)
}

async function loadState() {
  const state = await imageHostState()
  if (state?.settings) await applySettings(state.settings)
  history.value = Array.isArray(state?.history) ? state.history : []
}

function updateTask(id, patch) {
  const index = tasks.value.findIndex((task) => task.id === id)
  if (index !== -1) tasks.value[index] = { ...tasks.value[index], ...patch }
}

function createTask(name) {
  taskSeq += 1
  return {
    id: `task-${taskSeq}`,
    name,
    status: 'uploading',
    url: '',
    error: '',
    broken: false
  }
}

async function persistSettings(options = {}) {
  if (saving.value) return false
  saving.value = true
  let response
  try {
    response = await imageHostSaveSettings(JSON.parse(JSON.stringify(settings.value)))
  } finally {
    saving.value = false
  }

  if (response?.success) {
    await applySettings(response.settings)
    if (Array.isArray(response.history)) history.value = response.history
    if (options.successMessage) showInfo(options.successMessage)
    return true
  }

  const state = await imageHostState()
  if (state?.settings) await applySettings(state.settings)
  showError(t('保存图床配置失败'))
  return false
}

async function onProviderSelect(value) {
  if (!value || value === settings.value.active) return
  settings.value.active = value
  await persistSettings({ successMessage: t('上传图床已切换为 {name}', { name: activeMeta.value.name }) })
}

async function setLinkFormat(format) {
  if (format === settings.value.linkFormat) return
  settings.value.linkFormat = format
  const label = linkFormats.find((item) => item.value === format)?.label || format
  await persistSettings({ successMessage: t('复制格式已切换为 {format}', { format: label }) })
}

async function onRenameChange() {
  await persistSettings()
}

function openConfig() {
  openSettings('image-hosting')
}

function markCopied(id) {
  copiedId.value = id
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copiedId.value = ''
    copiedTimer = null
  }, 1200)
}

async function copyText(text, id, label = linkFormatLabel.value) {
  if (!text) return
  const success = await copyToClipboard(text)
  if (!success) {
    showError(t('复制失败'))
    return
  }
  markCopied(id)
  showInfo(t('已复制 {label}', { label }))
}

function copyTask(task) {
  if (!task.url) return
  copyText(formatImageLink(task.url, settings.value.linkFormat, task.name), task.id)
}

function copyRecord(record) {
  copyText(formatImageLink(record.url, settings.value.linkFormat, record.name), record.id)
}

function openRecord(record) {
  if (record.url) openExternal(record.url)
}

function requestRemoveRecord(record) {
  pendingConfirm.value = {
    kind: 'record',
    id: record.id,
    message: t('确定删除「{name}」这条上传记录吗？图床上的图片不会被删除。', { name: record.name })
  }
}

async function removeRecord(id) {
  const response = await imageHostRemoveHistory(id)
  if (response?.success) {
    history.value = response.history
    showInfo(t('已删除该条上传记录'))
  } else {
    showError(t('删除记录失败'))
  }
}

function requestClearHistory() {
  if (!history.value.length) return
  pendingConfirm.value = {
    kind: 'clear',
    message: t('确定要清空全部上传记录吗？该操作不会删除图床上的图片。')
  }
}

async function clearHistory() {
  const response = await imageHostClearHistory()
  if (response?.success) {
    history.value = response.history
    showInfo(t('已清空上传记录'))
  } else {
    showError(t('清空记录失败'))
  }
}

async function handleConfirm() {
  const action = pendingConfirm.value
  pendingConfirm.value = null
  if (!action) return
  if (action.kind === 'record') await removeRecord(action.id)
  else if (action.kind === 'clear') await clearHistory()
}

async function startUpload(paths) {
  if (loading.value) return
  const candidates = [...new Set((paths || []).filter((item) => typeof item === 'string' && item))]
  if (!candidates.length) return
  if (uploading.value) {
    showWarning(t('已有上传任务正在进行'))
    return
  }
  if (!activeConfigured.value) {
    showWarning(t('请先完善 {name} 配置：{fields}', { name: activeMeta.value.name, fields: missingLabels.value }))
    return
  }

  const selected = candidates.slice(0, 20)
  if (candidates.length > 20) showWarning(t('单次最多上传 20 张图片，已选择前 20 张'))

  uploading.value = true
  const created = selected.map((filePath) => createTask(fileName(filePath)))
  tasks.value = [...created, ...tasks.value].slice(0, 30)

  try {
    const response = await imageHostUpload(selected)
    const results = Array.isArray(response?.results) ? response.results : []

    created.forEach((task, index) => {
      const result = results[index]
      if (!result) {
        updateTask(task.id, { status: 'error', error: response?.error || t('未返回上传结果') })
        return
      }
      if (result.success) {
        updateTask(task.id, {
          status: 'success',
          url: result.url,
          name: result.name || task.name
        })
      } else {
        updateTask(task.id, { status: 'error', error: result.error || t('上传失败') })
      }
    })

    if (Array.isArray(response?.history)) history.value = response.history

    const successCount = results.filter((result) => result?.success).length
    if (successCount > 0) {
      showSuccess(t('已上传 {count} 张图片', { count: successCount }))
    } else {
      showError(response?.error || results.find((result) => result?.error)?.error || t('上传失败'))
    }
  } catch (error) {
    created.forEach((task) => updateTask(task.id, { status: 'error', error: error?.message || t('上传失败') }))
    showError(error?.message || t('上传失败'))
  } finally {
    uploading.value = false
  }
}

async function uploadClipboard() {
  if (loading.value || uploading.value) return
  if (!activeConfigured.value) {
    showWarning(t('请先完善 {name} 配置：{fields}', { name: activeMeta.value.name, fields: missingLabels.value }))
    return
  }

  uploading.value = true
  const task = createTask(t('剪贴板图片'))
  tasks.value = [task, ...tasks.value].slice(0, 30)

  try {
    const response = await imageHostUploadClipboard()
    const result = response?.results?.[0]

    if (result?.success) {
      updateTask(task.id, { status: 'success', url: result.url, name: result.name || task.name })
      showSuccess(t('剪贴板图片已上传'))
    } else {
      updateTask(task.id, { status: 'error', error: response?.error || t('上传失败') })
      if (response?.error === t('剪贴板中没有图片')) {
        showWarning(t('剪贴板中没有图片'))
      } else {
        showError(response?.error || t('上传失败'))
      }
    }

    if (Array.isArray(response?.history)) history.value = response.history
  } catch (error) {
    updateTask(task.id, { status: 'error', error: error?.message || t('上传失败') })
    showError(error?.message || t('上传失败'))
  } finally {
    uploading.value = false
  }
}

async function chooseFiles() {
  if (loading.value || uploading.value) return
  const response = await imageHostSelectFiles()
  if (!response || response.canceled) return
  await startUpload(response.paths || [])
}

function onDragEnter() {
  dragDepth += 1
  dragging.value = true
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}

function onDrop(event) {
  dragDepth = 0
  dragging.value = false
  const paths = [...(event.dataTransfer?.files || [])].map((file) => getPathForFile(file)).filter(Boolean)
  const imagePaths = paths.filter((filePath) => imagePathPattern.test(filePath))
  if (!imagePaths.length) {
    showWarning(t('未找到可上传的图片文件'))
    return
  }
  startUpload(imagePaths)
}

function handlePaste(event) {
  const files = [...(event.clipboardData?.files || [])]
  const itemFiles = [...(event.clipboardData?.items || [])]
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)
  const clipboardFiles = [...files, ...itemFiles]
  if (!clipboardFiles.length) return

  event.preventDefault()
  const paths = [...new Set(clipboardFiles.map((file) => getPathForFile(file)).filter(Boolean))]
  if (paths.length) {
    startUpload(paths)
  } else {
    uploadClipboard()
  }
}

onMounted(async () => {
  window.addEventListener('paste', handlePaste)
  await loadState()
  loading.value = false
})

onUnmounted(() => {
  window.removeEventListener('paste', handlePaste)
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style scoped>
.page-body {
  width: 100%;
}

.image-host-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(340px, 1fr);
  grid-template-areas: 'upload history';
  gap: 14px;
  align-items: stretch;
}

.image-host-grid > .panel {
  margin-top: 0;
  min-width: 0;
}

.upload-panel {
  grid-area: upload;
  display: flex;
  flex-direction: column;
}

.history-panel {
  grid-area: history;
  display: flex;
  flex-direction: column;
  max-height: 620px;
}

.upload-panel .panel-header {
  flex-wrap: wrap;
  row-gap: 6px;
}

.upload-panel .panel-title {
  flex-shrink: 0;
  white-space: nowrap;
}

.upload-panel .panel-hint {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upload-actions,
.history-actions {
  flex-wrap: wrap;
  row-gap: 6px;
}

.upload-actions {
  flex-shrink: 0;
}

.provider-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.provider-select .setting-select {
  width: 220px;
  flex: none;
}

.provider-select :deep(.setting-select-trigger) {
  height: var(--control-height-sm);
  font-size: var(--font-size-sm);
}

.upload-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setup-callout {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: var(--radius-md);
  background: rgba(var(--warning-rgb), 0.08);
}

.setup-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(var(--warning-rgb), 0.18);
  color: var(--warning-dark);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.setup-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.setup-text strong {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 216px;
  padding: 24px 20px;
  border: 1.5px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  cursor: pointer;
  text-align: center;
  outline: none;
  transition:
    border-color var(--motion-fast) var(--motion-ease),
    background var(--motion-fast) var(--motion-ease),
    box-shadow var(--motion-fast) var(--motion-ease);
}

.drop-zone:hover,
.drop-zone:focus-visible,
.drop-zone.dragging {
  border-color: rgba(var(--accent-rgb), 0.6);
  background: rgba(var(--accent-rgb), 0.05);
  box-shadow: var(--shadow-glow);
}

.drop-zone.uploading {
  cursor: progress;
}

.drop-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 14px;
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
}

.drop-icon svg {
  width: 26px;
  height: 26px;
}

.drop-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
}

.drop-sub {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.drop-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.drop-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.upload-options {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.option-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 9px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  user-select: none;
  transition: var(--transition-fast);
  width: fit-content;
}

.option-switch:hover {
  border-color: var(--border-strong);
}

.option-switch.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: rgba(var(--accent-rgb), 0.07);
  color: var(--text-primary);
}

.option-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.task-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.task-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.task-count,
.history-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.task-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.task-item.error {
  border-color: rgba(var(--error-rgb), 0.25);
}

.task-thumb,
.history-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--text-tertiary);
}

.task-thumb {
  width: 38px;
  height: 38px;
}

.task-thumb img,
.history-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.task-thumb svg,
.history-thumb svg {
  width: 16px;
  height: 16px;
}

button.task-thumb,
button.history-thumb {
  padding: 0;
  border: none;
  font: inherit;
  cursor: zoom-in;
  transition: box-shadow var(--motion-fast) var(--motion-ease);
}

button.task-thumb:disabled,
button.history-thumb:disabled {
  cursor: default;
}

button.task-thumb:not(:disabled):hover,
button.history-thumb:not(:disabled):hover {
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.45);
}

button.task-thumb:focus-visible,
button.history-thumb:focus-visible {
  outline: 2px solid rgba(var(--accent-rgb), 0.55);
  outline-offset: 2px;
}

.task-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.task-name,
.history-name {
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-meta,
.history-meta {
  overflow: hidden;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-item.error .task-meta {
  color: var(--error-dark);
}

.task-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.task-status.uploading {
  background: rgba(var(--warning-rgb), 0.12);
  color: var(--warning-dark);
}

.task-status.success {
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
}

.task-status.error {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.mini-spinner {
  width: 10px;
  height: 10px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: task-spin 0.7s linear infinite;
}

@keyframes task-spin {
  to {
    transform: rotate(360deg);
  }
}

.history-body {
  flex: 1;
  min-height: 180px;
  overflow-y: auto;
}

.link-format .segmented-item {
  height: 20px;
  padding: 0 8px;
  font-size: var(--font-size-xs);
}

.history-empty {
  min-height: 220px;
}

.history-empty .empty-state-hint {
  max-width: 240px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  transition: border-color var(--motion-fast) var(--motion-ease);
}

.history-item:hover {
  border-color: var(--border-strong);
}

.history-thumb {
  width: 44px;
  height: 44px;
}

.history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.history-item-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0.65;
  transition: opacity var(--motion-fast) var(--motion-ease);
}

.history-item:hover .history-item-actions {
  opacity: 1;
}

@media (max-width: 1100px) {
  .image-host-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'upload'
      'history';
  }

  .history-panel {
    max-height: 480px;
  }
}

@media (max-width: 760px) {
  .panel-header {
    flex-wrap: wrap;
  }

  .panel-title {
    white-space: nowrap;
  }

  .upload-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .provider-select {
    flex: 1;
    min-width: 0;
  }

  .provider-select .setting-select {
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    max-width: 300px;
  }

  .drop-zone {
    padding: 20px 14px;
  }
}

@media (max-width: 520px) {
  .drop-actions {
    flex-direction: column;
    width: 100%;
  }

  .drop-actions .btn {
    width: 100%;
  }

  .task-status {
    padding: 2px 6px;
  }

  .history-item-actions {
    opacity: 1;
  }
}
</style>
