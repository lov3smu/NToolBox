<template>
  <PageLayout tool-path="/image-viewer">
    <template #actions>
      <button class="btn btn-secondary btn-sm" @click="pickFile">
        <AppIcon name="image" />
        {{ t('打开图片') }}
      </button>
      <button class="btn btn-secondary btn-sm" @click="pickFolder">
        <AppIcon name="folder-open" />
        {{ t('打开文件夹') }}
      </button>

      <span class="toolbar-sep" />

      <button class="btn-icon btn-sm" :title="t('缩小（-）')" :disabled="!current" @click="zoomBy(1 / 1.25)">
        <AppIcon name="zoom-out" />
      </button>
      <button class="zoom-value" :disabled="!current" :title="t('点击恢复 100%')" @click="setZoom(1)">
        {{ zoomLabel }}
      </button>
      <button class="btn-icon btn-sm" :title="t('放大（+）')" :disabled="!current" @click="zoomBy(1.25)">
        <AppIcon name="zoom-in" />
      </button>

      <button class="btn btn-secondary btn-sm" :title="t('适应窗口（0）')" :disabled="!current" @click="fit">
        {{ t('适应窗口') }}
      </button>
      <button class="btn btn-secondary btn-sm" :title="t('实际大小（1）')" :disabled="!current" @click="setZoom(1)">
        1:1
      </button>
      <button class="btn-icon btn-sm" :title="t('顺时针旋转 90°（R）')" :disabled="!current" @click="rotate">
        <AppIcon name="rotate-cw" />
      </button>

      <span class="toolbar-spacer" />
      <span v-if="files.length" class="toolbar-counter">{{ currentIndex + 1 }} / {{ files.length }}</span>
    </template>

    <div
      ref="viewerRef"
      class="image-viewer"
      :style="railStyle"
      @dragenter.prevent="onDragEnter"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
    >
      <aside v-if="files.length" class="thumb-rail">
        <div class="rail-header">
          <span class="rail-title" :title="dir">{{ folderName }}</span>
          <span class="rail-count">{{ files.length }}</span>
        </div>
        <div class="thumb-list">
          <ImageThumb
            v-for="file in files"
            :key="file.path"
            :file="file"
            :active="file.path === currentPath"
            @select="select(file.path)"
          />
        </div>
      </aside>
      <SplitHandle
        v-if="files.length && !isNarrow"
        orientation="vertical"
        :resizing="railResizing"
        :label="t('拖动调整缩略图栏宽度')"
        @pointerdown="startRailResize"
        @keydown="onRailKeydown"
      />

      <section class="viewer-stage">
        <div
          ref="canvasRef"
          class="stage-canvas"
          :class="{ panning }"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @wheel.prevent="onWheel"
          @dblclick="onDoubleClick"
        >
          <img
            v-if="imageUrl"
            class="viewer-image"
            :src="imageUrl"
            :style="imageStyle"
            alt=""
            draggable="false"
            @load="onImageLoad"
            @error="onImageError"
          />

          <template v-if="current">
            <button
              type="button"
              class="stage-nav-btn prev"
              :class="{ 'is-at-end': !canPrev }"
              :aria-disabled="!canPrev"
              :title="t('上一张（←）')"
              :aria-label="t('上一张')"
              @pointerdown.stop
              @dblclick.stop
              @click.stop="step(-1)"
            >
              <AppIcon name="chevron-left" />
            </button>
            <button
              type="button"
              class="stage-nav-btn next"
              :class="{ 'is-at-end': !canNext }"
              :aria-disabled="!canNext"
              :title="t('下一张（→）')"
              :aria-label="t('下一张')"
              @pointerdown.stop
              @dblclick.stop
              @click.stop="step(1)"
            >
              <AppIcon name="chevron-right" />
            </button>
          </template>

          <EmptyState
            v-if="!imageUrl"
            icon="image"
            :title="errorText || t('打开图片开始浏览')"
            :description="t('支持 PNG / JPEG / GIF / WebP / BMP / SVG / ICO / AVIF，也可以直接把图片或文件夹拖入窗口')"
          >
            <template #actions>
              <button class="btn btn-primary btn-sm" @click="pickFile">{{ t('打开图片') }}</button>
              <button class="btn btn-secondary btn-sm" @click="pickFolder">{{ t('打开文件夹') }}</button>
            </template>
          </EmptyState>

          <Transition name="fade">
            <div v-if="dragActive" class="drop-overlay">{{ t('松开以打开图片') }}</div>
          </Transition>

          <div v-if="loading" class="stage-loading">
            <span class="spinner" />
          </div>
        </div>

        <footer v-if="current" class="info-bar">
          <span class="info-name" :title="current.path">{{ current.name }}</span>
          <span class="info-meta">{{ dimensionsText }}</span>
          <span class="info-meta">{{ formatBytes(current.size) }}</span>
          <span class="info-meta">{{ modifiedText }}</span>
          <span class="info-path" :title="current.path">{{ current.path }}</span>
          <button class="btn-icon btn-sm" :title="t('复制路径')" @click.stop="copyPath">
            <AppIcon name="copy" />
          </button>
          <button class="btn-icon btn-sm" :title="t('发送到…')" :aria-label="t('发送到…')" @click.stop="openSendMenu">
            <AppIcon name="shuffle" />
          </button>
        </footer>
      </section>
    </div>

    <SendToMenu
      :visible="sendMenu.show"
      :x="sendMenu.x"
      :y="sendMenu.y"
      :resource="sendResource"
      exclude-path="/image-viewer"
      @close="sendMenu.show = false"
      @sent="onSendDone"
    />
  </PageLayout>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import SplitHandle from '@/components/SplitHandle.vue'
import ImageThumb from '@/components/ImageThumb.vue'
import SendToMenu from '@/components/SendToMenu.vue'
import { takeSendResource, usePaneResize, useToast } from '@/composables'
import { formatBytes } from '@shared/format'
import { formatDateTime } from '@/utils/format'
import { copyToClipboard as copyText } from '@/utils/clipboard'
import { getPathForFile, imageAcceptDropped, imageListDir, imageOpenDialog, imageOpenFolder, imageRead } from '@/api'
import { t } from '@/i18n'

import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
const MIN_SCALE = 0.02
const MAX_SCALE = 32
const ZOOM_STEP = 1.25

const viewerRef = ref(null)
const canvasRef = ref(null)

const files = ref([])
const dir = ref('')
const currentPath = ref('')
const imageUrl = ref('')
const naturalSize = ref(null)
const loading = ref(false)
const errorText = ref('')
const dragActive = ref(false)
const panning = ref(false)
const fitMode = ref(true)
const rotation = ref(0)
const scale = ref(1)
const offset = reactive({ x: 0, y: 0 })
const sendMenu = ref({ show: false, x: 0, y: 0 })

let objectUrl = ''
let loadToken = 0
let dragDepth = 0
let panStart = null
let resizeObserver = null

const { showToast } = useToast()

const {
  size: railWidth,
  resizing: railResizing,
  startResize: startRailResize,
  onKeydown: onRailKeydown
} = usePaneResize({
  key: 'imageViewerRailWidth',
  initial: 176,
  min: 120,
  max: 320,
  direction: 'horizontal',
  container: () => viewerRef.value
})

const railStyle = computed(() => ({ '--thumb-rail-width': `${railWidth.value}px` }))

const narrowQuery = window.matchMedia('(max-width: 1000px)')
const isNarrow = ref(narrowQuery.matches)
const syncNarrow = () => {
  isNarrow.value = narrowQuery.matches
}

const currentIndex = computed(() => files.value.findIndex((file) => file.path === currentPath.value))
const current = computed(() => (currentIndex.value >= 0 ? files.value[currentIndex.value] : null))
const canPrev = computed(() => currentIndex.value > 0)
const canNext = computed(() => currentIndex.value >= 0 && currentIndex.value < files.value.length - 1)

const folderName = computed(() => {
  const normalized = dir.value.replace(/[\\/]+$/, '')
  return normalized.split(/[\\/]/).pop() || dir.value
})

const zoomLabel = computed(() => `${Math.max(1, Math.round(scale.value * 100))}%`)

const dimensionsText = computed(() =>
  naturalSize.value ? `${naturalSize.value.width} × ${naturalSize.value.height}` : '—'
)

const modifiedText = computed(() => (current.value ? formatDateTime(current.value.modified, 'datetime') : ''))

const imageStyle = computed(() => ({
  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation.value}deg) scale(${scale.value})`
}))

function clampScale(value) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))
}

function revokeObjectUrl() {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = ''
  }
}

function clearImage() {
  loadToken += 1
  revokeObjectUrl()
  imageUrl.value = ''
  naturalSize.value = null
  loading.value = false
}

async function loadImage(filePath) {
  const token = ++loadToken
  loading.value = true
  errorText.value = ''

  try {
    const res = await imageRead(filePath)
    if (token !== loadToken) return
    if (!res?.success) throw new Error(res?.error || t('读取图片失败'))

    const url = URL.createObjectURL(new Blob([res.data], { type: res.mime || 'application/octet-stream' }))
    revokeObjectUrl()
    objectUrl = url
    imageUrl.value = url
  } catch (error) {
    if (token !== loadToken) return
    clearImage()
    errorText.value = error.message || t('读取图片失败')
    showToast(errorText.value, 'error')
  } finally {
    if (token === loadToken) loading.value = false
  }
}

async function select(filePath) {
  if (!filePath || filePath === currentPath.value) return

  currentPath.value = filePath
  rotation.value = 0
  scale.value = 1
  offset.x = 0
  offset.y = 0
  fitMode.value = true
  naturalSize.value = null
  await loadImage(filePath)
}

function step(delta) {
  const index = currentIndex.value + delta
  if (index < 0 || index >= files.value.length) {
    showToast(t('没有更多图片了'), 'info')
    return
  }
  select(files.value[index].path)
}

function fit() {
  const canvas = canvasRef.value
  const size = naturalSize.value
  if (!canvas || !size) return

  const rect = canvas.getBoundingClientRect()
  const rotated = rotation.value % 180 !== 0
  const width = rotated ? size.height : size.width
  const height = rotated ? size.width : size.height
  const availableWidth = Math.max(rect.width - 48, 40)
  const availableHeight = Math.max(rect.height - 48, 40)

  scale.value = clampScale(Math.min(availableWidth / width, availableHeight / height, 1))
  offset.x = 0
  offset.y = 0
  fitMode.value = true
}

function zoomBy(factor) {
  const canvas = canvasRef.value
  if (!canvas || !current.value) return
  const rect = canvas.getBoundingClientRect()
  zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

function zoomAt(factor, clientX, clientY) {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const next = clampScale(scale.value * factor)
  const ratio = next / scale.value
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  offset.x -= (clientX - centerX - offset.x) * (ratio - 1)
  offset.y -= (clientY - centerY - offset.y) * (ratio - 1)
  scale.value = next
  fitMode.value = false
}

function setZoom(value) {
  if (!current.value) return
  scale.value = clampScale(value)
  offset.x = 0
  offset.y = 0
  fitMode.value = false
}

function rotate() {
  if (!current.value) return
  rotation.value = (rotation.value + 90) % 360
  fit()
}

function onImageLoad(event) {
  const image = event.target
  naturalSize.value = { width: image.naturalWidth, height: image.naturalHeight }
  fit()
}

function onImageError() {
  clearImage()
  errorText.value = t('图片解码失败')
  showToast(errorText.value, 'error')
}

function onWheel(event) {
  if (!current.value) return
  zoomAt(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY)
}

function onPointerDown(event) {
  if (!current.value || event.button !== 0) return
  panning.value = true
  panStart = { x: event.clientX - offset.x, y: event.clientY - offset.y }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event) {
  if (!panning.value || !panStart) return
  fitMode.value = false
  offset.x = event.clientX - panStart.x
  offset.y = event.clientY - panStart.y
}

function onPointerUp(event) {
  if (!panning.value) return
  panning.value = false
  panStart = null
  event.currentTarget.releasePointerCapture?.(event.pointerId)
}

function onDoubleClick() {
  if (!current.value) return
  if (fitMode.value) setZoom(1)
  else fit()
}

function hasFilePayload(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files')
}

function onDragEnter(event) {
  if (!hasFilePayload(event)) return
  dragDepth += 1
  dragActive.value = true
}

function onDragOver(event) {
  if (event.dataTransfer && hasFilePayload(event)) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

function onDragLeave() {
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dragActive.value = false
}

async function onDrop(event) {
  dragDepth = 0
  dragActive.value = false

  const dropped = Array.from(event.dataTransfer?.files || [])
  const paths = dropped.map((file) => getPathForFile(file)).filter(Boolean)
  if (!paths.length) return

  const res = await imageAcceptDropped(paths)
  if (!res?.success || !res.dir) {
    showToast(res?.error || t('未找到可打开的图片'), 'error')
    return
  }
  await openDirectory(res.dir, res.filePath)
}

async function openIncomingImage(filePath) {
  const res = await imageAcceptDropped([filePath])
  if (!res?.success || !res.dir) {
    showToast(res?.error || t('未找到可打开的图片'), 'error')
    return
  }
  await openDirectory(res.dir, res.filePath)
}

async function openDirectory(dirPath, selectPath) {
  const res = await imageListDir(dirPath)
  if (!res?.success) {
    showToast(res?.error || t('读取文件夹失败'), 'error')
    return
  }

  files.value = res.files
  dir.value = res.dir || dirPath

  if (!files.value.length) {
    currentPath.value = ''
    clearImage()
    errorText.value = t('该文件夹中没有图片')
    return
  }

  const target = selectPath && files.value.some((file) => file.path === selectPath) ? selectPath : files.value[0].path
  currentPath.value = ''
  await select(target)
}

async function pickFile() {
  const res = await imageOpenDialog()
  if (!res || res.canceled) return
  if (res.error) {
    showToast(res.error, 'error')
    return
  }
  await openDirectory(res.dir, res.filePath)
}

async function pickFolder() {
  const res = await imageOpenFolder()
  if (!res || res.canceled) return
  if (res.error) {
    showToast(res.error, 'error')
    return
  }
  await openDirectory(res.dir || res.folderPath)
}

async function copyPath() {
  if (!current.value) return
  const success = await copyText(current.value.path)
  showToast(success ? t('路径已复制') : t('复制路径失败'), success ? 'success' : 'error')
}

const sendResource = computed(() =>
  currentPath.value ? { kind: 'image', title: current.value?.name || '', path: currentPath.value } : null
)

function openSendMenu(event) {
  if (!currentPath.value) return
  const rect = event.currentTarget.getBoundingClientRect()
  sendMenu.value = { show: true, x: rect.left - 208, y: rect.bottom + 6 }
}

function onSendDone(target) {
  showToast(t('已发送到 {name}', { name: t(target.name) }), 'success')
}

function onKeydown(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (!current.value) return

  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      step(-1)
      break
    case 'ArrowRight':
      event.preventDefault()
      step(1)
      break
    case '+':
    case '=':
      event.preventDefault()
      zoomBy(ZOOM_STEP)
      break
    case '-':
    case '_':
      event.preventDefault()
      zoomBy(1 / ZOOM_STEP)
      break
    case '0':
      event.preventDefault()
      fit()
      break
    case '1':
      event.preventDefault()
      setZoom(1)
      break
    case 'r':
    case 'R':
      event.preventDefault()
      rotate()
      break
  }
}

function onResize() {
  if (fitMode.value && current.value) fit()
}

onMounted(() => {
  narrowQuery.addEventListener('change', syncNarrow)
  window.addEventListener('keydown', onKeydown)

  nextTick(() => {
    const ObserverImpl = globalThis.ResizeObserver
    if (typeof ObserverImpl === 'undefined' || !canvasRef.value) return
    resizeObserver = new ObserverImpl(onResize)
    resizeObserver.observe(canvasRef.value)
  })

  const incoming = takeSendResource('/image-viewer')
  if (incoming?.kind === 'image') void openIncomingImage(incoming.path)
})

onBeforeUnmount(() => {
  narrowQuery.removeEventListener('change', syncNarrow)
  window.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
  resizeObserver = null
  revokeObjectUrl()
})
</script>

<style scoped>
.image-viewer {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.thumb-rail {
  width: var(--thumb-rail-width, 176px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface);
}

.rail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px 8px;
  border-bottom: 1px solid var(--border-color);
}

.rail-title {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-count {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.thumb-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  scrollbar-width: thin;
}

.viewer-stage {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stage-canvas {
  --stage-check: color-mix(in srgb, var(--border-color) 40%, transparent);

  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  user-select: none;
  background-color: var(--app-bg);
  background-image:
    linear-gradient(45deg, var(--stage-check) 25%, transparent 25%),
    linear-gradient(-45deg, var(--stage-check) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--stage-check) 75%),
    linear-gradient(-45deg, transparent 75%, var(--stage-check) 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}

.stage-canvas.panning {
  cursor: grabbing;
}

.viewer-image {
  max-width: none;
  max-height: none;
  transform-origin: center center;
  will-change: transform;
  pointer-events: none;
}

.stage-nav-btn {
  position: absolute;
  top: 50%;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 50%;
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--text-secondary);
  box-shadow: var(--shadow-md);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transform: translateY(-50%);
  cursor: pointer;
  transition: var(--transition-fast);
}

.stage-nav-btn svg {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.stage-nav-btn.prev {
  left: 14px;
}

.stage-nav-btn.next {
  right: 14px;
}

.stage-nav-btn:hover:not(.is-at-end) {
  border-color: rgba(var(--accent-rgb), 0.55);
  background: var(--surface-hover);
  color: var(--accent-color);
}

.stage-nav-btn:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.stage-nav-btn.is-at-end {
  opacity: 0.3;
  cursor: default;
}

.info-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px;
  border-top: 1px solid var(--border-color);
  background: var(--surface);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.info-name {
  max-width: 30%;
  flex-shrink: 0;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-meta {
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--text-tertiary);
}

.info-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-tertiary);
}

.info-bar .btn-icon {
  flex-shrink: 0;
}

.empty-state :deep(.empty-state-hint) {
  max-width: 440px;
}

.drop-overlay {
  position: absolute;
  inset: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(var(--accent-rgb), 0.55);
  border-radius: var(--radius-lg);
  background: rgba(var(--accent-rgb), 0.08);
  color: var(--accent-color);
  font-size: var(--font-size-base);
  pointer-events: none;
}

.stage-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 2px solid rgba(var(--accent-rgb), 0.25);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: image-viewer-spin 0.8s linear infinite;
}

@keyframes image-viewer-spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toolbar-spacer {
  flex: 1;
}

.toolbar-counter {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.zoom-value {
  min-width: 52px;
  height: var(--control-height-sm);
  padding: 0 6px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-secondary);
  font: inherit;
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: var(--transition-fast);
}

.zoom-value:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--surface-hover);
  color: var(--text-primary);
}

.zoom-value:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1000px) {
  .thumb-rail {
    display: none;
  }

  .stage-nav-btn {
    width: 34px;
    height: 34px;
  }

  .stage-nav-btn.prev {
    left: 8px;
  }

  .stage-nav-btn.next {
    right: 8px;
  }
}
</style>
