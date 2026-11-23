<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state.visible"
        class="image-preview-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('图片预览')"
        @click.self="close"
      >
        <button class="preview-close" type="button" :title="t('关闭预览')" :aria-label="t('关闭预览')" @click="close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div
          class="preview-stage"
          :class="{ 'is-actual': actualSize }"
          :title="t('双击切换原始大小')"
          @click.self="close"
        >
          <img
            v-if="!failed"
            :src="state.src"
            :alt="state.name || t('图片预览')"
            draggable="false"
            @load="loading = false"
            @error="onError"
            @dblclick="actualSize = !actualSize"
          />
          <div v-else class="preview-error">{{ t('图片加载失败') }}</div>
          <span v-if="loading" class="preview-spinner" aria-hidden="true" />
        </div>

        <div v-if="state.name" class="preview-caption" :title="state.name">{{ state.name }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onUnmounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import { imagePreviewState as state, closeImagePreview } from '@/composables/useImagePreview'

const loading = ref(false)
const failed = ref(false)
const actualSize = ref(false)

function close() {
  closeImagePreview()
}

function onError() {
  loading.value = false
  failed.value = true
}

function reset() {
  loading.value = Boolean(state.src)
  failed.value = false
  actualSize.value = false
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
})
</script>

<style scoped>
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 64px 64px;
  background: rgba(8, 9, 12, 0.78);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.preview-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.preview-stage.is-actual {
  align-items: flex-start;
  justify-content: flex-start;
  overflow: auto;
  scrollbar-width: thin;
}

.preview-stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  user-select: none;
}

.preview-stage.is-actual img {
  max-width: none;
  max-height: none;
  margin: auto;
  border-radius: 0;
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
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: rgba(20, 22, 28, 0.6);
  color: #fff;
  cursor: pointer;
  transition: var(--transition-fast);
}

.preview-close svg {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.preview-close:hover {
  border-color: rgba(255, 255, 255, 0.45);
  background: rgba(40, 43, 52, 0.8);
}

.preview-close:focus-visible {
  outline: 2px solid rgba(var(--accent-rgb), 0.7);
  outline-offset: 2px;
}

.preview-caption {
  position: absolute;
  bottom: 18px;
  left: 50%;
  max-width: min(640px, calc(100vw - 128px));
  overflow: hidden;
  padding: 5px 14px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  background: rgba(20, 22, 28, 0.7);
  color: rgba(255, 255, 255, 0.92);
  font-size: var(--font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
  transform: translateX(-50%);
}

.preview-error {
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background: rgba(20, 22, 28, 0.7);
  color: rgba(255, 255, 255, 0.85);
  font-size: var(--font-size-sm);
}

.preview-spinner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-top-color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  animation: preview-spin 0.8s linear infinite;
  pointer-events: none;
}

@keyframes preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .image-preview-overlay {
    padding: 44px 16px 56px;
  }
}
</style>
