<template>
  <button
    type="button"
    class="copy-button"
    :class="[
      `is-${sizeClass}`,
      `is-${variantClass}`,
      { 'is-copied': state === 'copied', 'is-failed': state === 'failed' }
    ]"
    :title="resolvedTitle"
    :aria-label="resolvedTitle"
    :disabled="disabled || !text"
    @click="handleCopy"
  >
    <AppIcon :name="state === 'copied' ? 'check' : icon" :size="iconSize" />
    <span v-if="label" class="copy-button-label">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { t } from '@/i18n'
import AppIcon from '@/components/AppIcon.vue'
import { useToast } from '@/composables'
import { copyToClipboard } from '@/utils/clipboard'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']
const VARIANTS = ['icon', 'primary', 'secondary', 'ghost']
const ICON_SIZES = { xl: 20, lg: 20, md: 16, sm: 16, xs: 14 }

const props = defineProps({
  text: { type: String, default: '' },
  label: { type: String, default: '' },
  title: { type: String, default: '' },
  icon: { type: String, default: 'copy' },
  variant: { type: String, default: 'icon' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
  notify: { type: Boolean, default: true },
  successMessage: { type: String, default: '' },
  errorMessage: { type: String, default: '' }
})

const emit = defineEmits(['copied', 'failed'])
const { showSuccess, showError } = useToast()

const state = ref('')
const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))
const variantClass = computed(() => (VARIANTS.includes(props.variant) ? props.variant : 'icon'))
const iconSize = computed(() => ICON_SIZES[sizeClass.value])
const resolvedTitle = computed(() => props.title || t('复制'))

let stateTimer = null

function flash(next) {
  state.value = next
  if (stateTimer) clearTimeout(stateTimer)
  stateTimer = setTimeout(() => {
    state.value = ''
    stateTimer = null
  }, 1500)
}

async function handleCopy() {
  if (props.disabled || !props.text) return
  const ok = await copyToClipboard(props.text)
  flash(ok ? 'copied' : 'failed')
  if (ok) {
    emit('copied')
    if (props.notify) showSuccess(props.successMessage || t('已复制到剪贴板'))
  } else {
    emit('failed')
    if (props.notify) showError(props.errorMessage || t('复制失败'))
  }
}

onBeforeUnmount(() => {
  if (stateTimer) clearTimeout(stateTimer)
})
</script>

<style scoped>
.copy-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: var(--control-height);
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: var(--transition-fast);
}

.copy-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.copy-button.is-xl {
  height: var(--control-height-xl);
  padding: 0 16px;
  font-size: var(--font-size-base);
}

.copy-button.is-lg {
  height: var(--control-height-lg);
  padding: 0 16px;
  font-size: var(--font-size-base);
}

.copy-button.is-sm {
  height: var(--control-height-sm);
  padding: 0 10px;
}

.copy-button.is-xs {
  height: var(--control-height-xs);
  padding: 0 8px;
  font-size: var(--font-size-xs);
}

.copy-button.is-icon {
  width: var(--control-height);
  padding: 0;
  border-color: var(--border-color);
  background: var(--surface);
  color: var(--text-secondary);
}

.copy-button.is-icon.is-xl {
  width: var(--control-height-xl);
}

.copy-button.is-icon.is-lg {
  width: var(--control-height-lg);
}

.copy-button.is-icon.is-sm {
  width: var(--control-height-sm);
}

.copy-button.is-icon.is-xs {
  width: var(--control-height-xs);
}

.copy-button.is-icon:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--surface-hover);
  color: var(--text-primary);
}

.copy-button.is-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

.copy-button.is-primary:hover:not(:disabled) {
  background: var(--btn-primary-bg-hover);
}

.copy-button.is-secondary {
  border-color: var(--border-color);
  background: var(--surface);
  color: var(--text-primary);
}

.copy-button.is-secondary:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.copy-button.is-ghost {
  color: var(--text-secondary);
}

.copy-button.is-ghost:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.copy-button.is-copied {
  border-color: rgba(var(--accent-rgb), 0.45);
  color: var(--accent-color);
}

.copy-button.is-failed {
  border-color: rgba(var(--error-rgb), 0.45);
  color: var(--error-dark);
}
</style>
