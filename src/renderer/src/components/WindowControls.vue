<template>
  <div class="window-controls" role="group" aria-label="窗口控制">
    <button type="button" class="window-control" aria-label="最小化" @click="emit('minimize')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M6 12h12" />
      </svg>
      <span class="window-control-tip" aria-hidden="true">最小化</span>
    </button>

    <button
      v-if="fullscreen"
      type="button"
      class="window-control"
      aria-label="退出全屏"
      @click="emit('exit-fullscreen')"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="8" width="13" height="13" rx="2" />
        <path d="M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3" />
      </svg>
      <span class="window-control-tip" aria-hidden="true">退出全屏</span>
    </button>

    <button
      v-else
      type="button"
      class="window-control"
      :aria-label="isMaximized ? '还原窗口' : '最大化'"
      @click="emit('maximize')"
    >
      <svg
        v-if="isMaximized"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="5" y="8" width="11" height="11" rx="1.5" />
        <path d="M8 8V6.5A1.5 1.5 0 0 1 9.5 5h9A1.5 1.5 0 0 1 20 6.5v9a1.5 1.5 0 0 1-1.5 1.5H17" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="5" y="5" width="14" height="14" rx="1.5" />
      </svg>
      <span class="window-control-tip" aria-hidden="true">{{ isMaximized ? '还原窗口' : '最大化' }}</span>
    </button>

    <button type="button" class="window-control close" aria-label="关闭" @click="emit('close')">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m6 6 12 12M18 6 6 18" />
      </svg>
      <span class="window-control-tip" aria-hidden="true">关闭</span>
    </button>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onWindowMaximized, windowIsMaximized } from '@/api'

defineProps({
  fullscreen: { type: Boolean, default: false }
})

const emit = defineEmits(['minimize', 'maximize', 'exit-fullscreen', 'close'])

const isMaximized = ref(false)
let removeMaximizedListener = null

onMounted(() => {
  windowIsMaximized().then((value) => {
    isMaximized.value = Boolean(value)
  })
  removeMaximizedListener = onWindowMaximized((value) => {
    isMaximized.value = Boolean(value)
  })
})

onBeforeUnmount(() => {
  removeMaximizedListener?.()
})
</script>

<style scoped>
.window-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  align-self: stretch;
  flex-shrink: 0;
  margin-left: auto;
  padding-right: 8px;
  -webkit-app-region: no-drag;
}

.window-control {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--shell-text-muted);
  cursor: pointer;
  transition: var(--transition-fast);
}

.window-control svg {
  width: 13px;
  height: 13px;
}

.window-control:hover {
  background: var(--shell-hover-bg);
  color: var(--shell-text-strong);
}

.window-control:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.window-control.close:hover {
  background: rgba(var(--error-rgb), 0.16);
  color: var(--error-dark);
}

.window-control-tip {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  z-index: 60;
  padding: 5px 9px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: #17181c;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  color: #f5f5f7;
  font-size: var(--font-size-xs);
  line-height: 1.2;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, -3px);
  transition:
    opacity 0.1s ease,
    transform 0.1s ease,
    visibility 0s linear 0.1s;
}

.window-control:hover .window-control-tip,
.window-control:focus-visible .window-control-tip {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
  transition-delay: 0.22s, 0.22s, 0s;
}

@media (prefers-reduced-motion: reduce) {
  .window-control-tip {
    transition: none;
  }
}
</style>
