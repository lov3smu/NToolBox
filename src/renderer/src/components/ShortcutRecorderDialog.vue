<template>
  <Teleport to="body">
    <div v-if="visible" class="recorder-overlay" @click.self="emit('cancel')">
      <section class="recorder-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-recorder-title">
        <header class="recorder-header">
          <div>
            <h2 id="shortcut-recorder-title">{{ t('修改快捷键') }}</h2>
            <span class="recorder-sub">{{ name }}</span>
          </div>
          <button type="button" class="btn-icon" :title="t('关闭')" @click="emit('cancel')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div class="recorder-body">
          <div class="recorder-current">
            <span class="recorder-label">{{ t('当前快捷键') }}</span>
            <span v-if="currentLabel" class="recorder-key">{{ currentLabel }}</span>
            <span v-else class="recorder-empty">{{ t('未设置') }}</span>
          </div>

          <div ref="captureEl" class="recorder-capture" :class="{ 'has-value': Boolean(captured) }" tabindex="0">
            <span v-if="capturedLabel" class="capture-keys">{{ capturedLabel }}</span>
            <span v-else class="capture-hint">{{ t('按下新快捷键') }}</span>
          </div>
          <p class="recorder-note">{{ t('在输入区按下新的组合键，支持字母、F1–F12 与方向键等，Esc 取消') }}</p>
        </div>

        <footer class="recorder-footer">
          <button type="button" class="btn btn-secondary" @click="emit('cancel')">{{ t('取消') }}</button>
          <button type="button" class="btn btn-primary" :disabled="!captured" @click="save">
            {{ t('保存快捷键') }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { captureAccelerator, formatAccelerator } from '@/utils/shortcut'
import { t } from '@/i18n'

const props = defineProps({
  visible: { type: Boolean, default: false },
  name: { type: String, default: '' },
  accelerator: { type: String, default: '' },
  fallback: { type: String, default: '' },
  isMac: { type: Boolean, default: false }
})

const emit = defineEmits(['cancel', 'save'])

const captured = ref('')
const captureEl = ref(null)

const capturedLabel = computed(() => {
  if (!captured.value) return ''
  return formatAccelerator(captured.value, props.isMac) || captured.value
})

const currentLabel = computed(() => {
  const value = props.accelerator || props.fallback
  if (!value) return ''
  const formatted = formatAccelerator(value, props.isMac) || value
  return props.accelerator ? formatted : t('默认：{shortcut}', { shortcut: formatted })
})

function handleKeydown(event) {
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    emit('cancel')
    return
  }
  const accelerator = captureAccelerator(event)
  if (accelerator) captured.value = accelerator
}

function save() {
  if (!captured.value) return
  emit('save', captured.value)
}

watch(
  () => props.visible,
  async (open) => {
    if (open) {
      captured.value = ''
      window.addEventListener('keydown', handleKeydown, true)
      await nextTick()
      captureEl.value?.focus()
    } else {
      window.removeEventListener('keydown', handleKeydown, true)
    }
  }
)

onUnmounted(() => window.removeEventListener('keydown', handleKeydown, true))
</script>

<style scoped>
.recorder-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.recorder-dialog {
  display: flex;
  flex-direction: column;
  width: 460px;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.recorder-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border-color);
}

.recorder-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: 600;
}

.recorder-sub {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.recorder-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px;
}

.recorder-current {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-sm);
}

.recorder-label {
  color: var(--text-secondary);
}

.recorder-key {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text-primary);
  font-family: var(--font-mono, 'Consolas', 'Monaco', monospace);
  font-size: var(--font-size-xs);
}

.recorder-empty {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.recorder-capture {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 92px;
  padding: 16px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  outline: none;
  cursor: text;
  transition: var(--transition-fast);
}

.recorder-capture:focus {
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.capture-hint {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

.capture-keys {
  color: var(--text-primary);
  font-family: var(--font-mono, 'Consolas', 'Monaco', monospace);
  font-size: var(--font-size-lg);
  font-weight: 600;
  letter-spacing: 1px;
}

.recorder-note {
  margin: 0;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

.recorder-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
}
</style>
