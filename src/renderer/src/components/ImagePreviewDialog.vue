<template>
  <Teleport to="body">
    <div v-if="state.visible" class="image-preview-overlay" role="dialog" aria-modal="true" :aria-label="t('图片预览')">
      <div v-if="state.name" class="preview-caption" :title="state.name">{{ state.name }}</div>

      <button class="preview-close" type="button" :title="t('关闭预览')" :aria-label="t('关闭预览')" @click="close">
        <AppIcon name="close" />
      </button>

      <div ref="stageRef" class="preview-stage" @wheel.prevent="onWheel">
        <img
          v-if="!failed"
          ref="imgRef"
          :src="state.src"
          :alt="state.name || t('图片预览')"
          :style="imageStyle"
          :class="{ 'is-loading': loading }"
          draggable="false"
          @load="onLoad"
          @error="onError"
          @dblclick="toggleActualSize"
        />
        <div v-else class="preview-error">{{ t('图片加载失败') }}</div>
        <span v-if="loading" class="preview-spinner" aria-hidden="true" />
      </div>

      <div class="preview-toolbar" role="toolbar" :aria-label="t('图片预览')">
        <button
          type="button"
          class="preview-tool"
          :title="t('缩小')"
          :aria-label="t('缩小')"
          :disabled="zoom <= MIN_ZOOM + 0.001"
          @click="zoomStep(1 / ZOOM_STEP)"
        >
          <AppIcon name="zoom-out" />
        </button>
        <button type="button" class="preview-tool preview-zoom-value" :title="t('重置缩放')" @click="resetZoom">
          {{ zoomPercent }}%
        </button>
        <button
          type="button"
          class="preview-tool"
          :title="t('放大')"
          :aria-label="t('放大')"
          :disabled="zoom >= MAX_ZOOM - 0.001"
          @click="zoomStep(ZOOM_STEP)"
        >
          <AppIcon name="zoom-in" />
        </button>
        <span class="preview-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          class="preview-tool"
          :title="t('下载图片')"
          :aria-label="t('下载图片')"
          :disabled="downloading"
          @click="onDownload"
        >
          <AppIcon name="download" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import { imageDownload } from '@/api'
import { imagePreviewState as state, closeImagePreview, useToast } from '@/composables'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 8
const ZOOM_STEP = 1.25

const stageRef = ref(null)
const imgRef = ref(null)
const loading = ref(false)
const failed = ref(false)
const downloading = ref(false)
const zoom = ref(1)
const fitScale = ref(1)
const natural = ref({ width: 0, height: 0 })
const { showSuccess, showError } = useToast()
let resizeObserver = null

const zoomPercent = computed(() => Math.round(zoom.value * 100))
const imageStyle = computed(() => {
  if (!natural.value.width) return {}
  const width = Math.round(natural.value.width * fitScale.value * zoom.value)
  return { width: `${Math.max(width, 1)}px`, height: 'auto' }
})

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

function close() {
  closeImagePreview()
}

function onError() {
  loading.value = false
  failed.value = true
}

function computeFit() {
  const stage = stageRef.value
  if (!stage || !natural.value.width || !natural.value.height) return
  fitScale.value = Math.min(1, stage.clientWidth / natural.value.width, stage.clientHeight / natural.value.height)
}

function onLoad() {
  loading.value = false
  const img = imgRef.value
  if (!img) return
  natural.value = { width: img.naturalWidth || 0, height: img.naturalHeight || 0 }
  computeFit()
  zoom.value = 1
}

function centerStage() {
  const stage = stageRef.value
  if (!stage) return
  stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2
  stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2
}

async function applyZoom(next) {
  zoom.value = clampZoom(next)
  await nextTick()
  centerStage()
}

function zoomStep(factor) {
  applyZoom(zoom.value * factor)
}

function resetZoom() {
  applyZoom(1)
}

function toggleActualSize() {
  if (!natural.value.width || !fitScale.value) return
  const actual = Math.min(1 / fitScale.value, MAX_ZOOM)
  applyZoom(zoom.value > 1.05 ? 1 : actual)
}

function onWheel(event) {
  if (!natural.value.width) return
  const stage = stageRef.value
  if (!stage) return

  const rect = stage.getBoundingClientRect()
  const offsetX = event.clientX - rect.left
  const offsetY = event.clientY - rect.top
  const contentX = offsetX + stage.scrollLeft
  const contentY = offsetY + stage.scrollTop
  const next = clampZoom(zoom.value * (event.deltaY < 0 ? 1.12 : 1 / 1.12))
  if (next === zoom.value) return

  const ratio = next / zoom.value
  zoom.value = next
  nextTick(() => {
    stage.scrollLeft = contentX * ratio - offsetX
    stage.scrollTop = contentY * ratio - offsetY
  })
}

function anchorDownload(src, name) {
  const link = document.createElement('a')
  link.href = src
  link.download = name || 'image.png'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function onDownload() {
  if (downloading.value || !state.src) return
  downloading.value = true
  try {
    const res = await imageDownload({ src: state.src, name: state.name })
    if (res?.canceled) return
    if (res?.success) {
      showSuccess(t('已保存图片'))
      return
    }
    if (res?.error === 'API not available' && /^(data:|blob:)/i.test(state.src)) {
      anchorDownload(state.src, state.name)
      showSuccess(t('已保存图片'))
      return
    }
    showError(t('下载失败'))
  } catch {
    showError(t('下载失败'))
  } finally {
    downloading.value = false
  }
}

function reset() {
  loading.value = Boolean(state.src)
  failed.value = false
  downloading.value = false
  zoom.value = 1
  fitScale.value = 1
  natural.value = { width: 0, height: 0 }
  nextTick(() => {
    computeFit()
    centerStage()
    const stage = stageRef.value
    const ObserverImpl = globalThis.ResizeObserver
    if (stage && typeof ObserverImpl !== 'undefined') {
      resizeObserver?.disconnect()
      resizeObserver = new ObserverImpl(() => computeFit())
      resizeObserver.observe(stage)
    }
  })
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  close()
}

watch(
  () => state.visible,
  (visible) => {
    if (visible) {
      reset()
      window.addEventListener('keydown', handleKeydown, true)
    } else {
      window.removeEventListener('keydown', handleKeydown, true)
      resizeObserver?.disconnect()
      resizeObserver = null
    }
  }
)

watch(
  () => state.src,
  () => {
    if (state.visible) reset()
  }
)

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped>
/* 图片灯箱固定使用深色方案，与主题无关 */
.image-preview-overlay {
  --preview-scrim: rgba(8, 9, 12, 0.78);
  --preview-chip-bg: rgba(20, 22, 28, 0.7);
  --preview-chip-hover-bg: rgba(40, 43, 52, 0.8);
  --preview-chip-border: rgba(255, 255, 255, 0.14);
  --preview-chip-border-strong: rgba(255, 255, 255, 0.45);
  --preview-close-border: rgba(255, 255, 255, 0.22);
  --preview-text: rgba(255, 255, 255, 0.92);
  --preview-text-muted: rgba(255, 255, 255, 0.85);
  --preview-text-strong: #ffffff;
  --preview-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  --preview-spinner-track: rgba(255, 255, 255, 0.25);
  --preview-spinner-head: rgba(255, 255, 255, 0.9);

  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 64px 64px;
  background: var(--preview-scrim);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: image-preview-in var(--motion-base) var(--motion-ease);
}

.preview-stage {
  display: flex;
  align-items: safe center;
  justify-content: safe center;
  width: 100%;
  height: 100%;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
}

.preview-stage img {
  display: block;
  flex: none;
  max-width: none;
  max-height: none;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: var(--preview-shadow);
  user-select: none;
  cursor: zoom-in;
  transition: opacity var(--motion-fast) var(--motion-ease);
}

.preview-stage img.is-loading {
  opacity: 0;
}

.preview-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid var(--preview-close-border);
  border-radius: 50%;
  background: var(--preview-chip-bg);
  color: var(--preview-text-strong);
  cursor: pointer;
  transition: var(--transition-fast);
}

.preview-close svg {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.preview-close:hover {
  border-color: var(--preview-chip-border-strong);
  background: var(--preview-chip-hover-bg);
}

.preview-close:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}

.preview-caption {
  position: absolute;
  top: 20px;
  left: 20px;
  max-width: min(480px, calc(100vw - 160px));
  overflow: hidden;
  padding: 5px 14px;
  border: 1px solid var(--preview-chip-border);
  border-radius: var(--radius-pill);
  background: var(--preview-chip-bg);
  color: var(--preview-text);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-toolbar {
  position: absolute;
  bottom: 18px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  border: 1px solid var(--preview-chip-border);
  border-radius: var(--radius-pill);
  background: var(--preview-chip-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transform: translateX(-50%);
}

.preview-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--preview-text);
  cursor: pointer;
  transition: var(--transition-fast);
}

.preview-tool svg {
  width: 16px;
  height: 16px;
}

.preview-tool:hover:not(:disabled) {
  background: var(--preview-chip-hover-bg);
  color: var(--preview-text-strong);
}

.preview-tool:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.preview-tool:disabled {
  opacity: 0.4;
  cursor: default;
}

.preview-zoom-value {
  width: auto;
  min-width: 52px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.preview-toolbar-divider {
  width: 1px;
  height: 18px;
  margin: 0 2px;
  background: var(--preview-chip-border);
}

.preview-error {
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background: var(--preview-chip-bg);
  color: var(--preview-text-muted);
  font-size: var(--font-size-sm);
}

.preview-spinner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 2px solid var(--preview-spinner-track);
  border-top-color: var(--preview-spinner-head);
  border-radius: 50%;
  animation: preview-spin 0.8s linear infinite;
  pointer-events: none;
}

@keyframes preview-spin {
  to {
    transform: rotate(360deg);
  }
}

/* 入场动画不使用 Transition：动画帧被节流时遮罩仍保持可见，不会留下不可见却拦截点击的全屏层 */
@keyframes image-preview-in {
  from {
    opacity: 0.85;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image-preview-overlay {
    animation: none;
  }
}

@media (max-width: 720px) {
  .image-preview-overlay {
    padding: 44px 16px 64px;
  }

  .preview-caption {
    max-width: calc(100vw - 120px);
  }
}
</style>
