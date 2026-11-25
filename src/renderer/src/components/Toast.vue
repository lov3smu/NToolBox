<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="visible"
        class="toast"
        :class="[type, `is-${sizeClass}`]"
        :role="type === 'error' ? 'alert' : 'status'"
      >
        <span v-if="type === 'loading'" class="toast-spinner" aria-hidden="true"></span>
        <span v-else class="toast-icon" aria-hidden="true">{{ icon }}</span>
        <span class="toast-message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'success'
  },
  size: {
    type: String,
    default: 'md'
  }
})

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const icon = computed(() => {
  switch (props.type) {
    case 'error':
      return '✗'
    case 'warning':
      return '⚠'
    case 'info':
      return 'ℹ'
    case 'loading':
      return ''
    default:
      return '✓'
  }
})
</script>

<style scoped>
.toast {
  --toast-pad-y: 12px;
  --toast-pad-x: 24px;
  --toast-font: var(--font-size-base);
  --toast-icon-font: var(--font-size-md);
  --toast-spinner-size: var(--spinner-sm);
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  max-width: calc(100vw - 48px);
  box-sizing: border-box;
  background: var(--success-gradient);
  color: var(--text-inverse);
  padding: var(--toast-pad-y) var(--toast-pad-x);
  border-radius: var(--radius-md);
  font-size: var(--toast-font);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10000;
  box-shadow: 0 4px 20px rgba(var(--success-rgb), 0.35);
}

.toast.is-xl {
  --toast-pad-y: 14px;
  --toast-pad-x: 28px;
  --toast-font: var(--font-size-md);
  --toast-icon-font: var(--font-size-lg);
  --toast-spinner-size: var(--spinner-md);
}

.toast.is-lg {
  --toast-pad-y: 13px;
  --toast-pad-x: 26px;
  --toast-icon-font: var(--font-size-lg);
}

.toast.is-sm {
  --toast-pad-y: 10px;
  --toast-pad-x: 18px;
  --toast-font: var(--font-size-sm);
  --toast-icon-font: var(--font-size-base);
}

.toast.is-xs {
  --toast-pad-y: 8px;
  --toast-pad-x: 14px;
  --toast-font: var(--font-size-xs);
  --toast-icon-font: var(--font-size-sm);
  --toast-spinner-size: var(--spinner-xs);
}

.toast.error {
  background: linear-gradient(135deg, var(--danger-bg) 0%, var(--danger-bg-hover) 100%);
  box-shadow: 0 4px 20px rgba(var(--error-rgb), 0.4);
}

.toast.warning {
  background: var(--warning-gradient);
  box-shadow: 0 4px 20px rgba(var(--warning-rgb), 0.4);
}

.toast.info {
  background: var(--info-gradient);
  box-shadow: 0 4px 20px rgba(var(--info-rgb), 0.35);
}

.toast.loading {
  background: var(--neutral-gradient);
  box-shadow: 0 4px 20px rgba(var(--neutral-rgb), 0.35);
}

.toast-spinner {
  width: var(--toast-spinner-size);
  height: var(--toast-spinner-size);
  flex-shrink: 0;
  border: 2px solid var(--spinner-on-accent-track);
  border-top-color: var(--spinner-on-accent-head);
  border-radius: 50%;
  animation: toast-spin var(--spinner-duration) linear infinite;
}

@keyframes toast-spin {
  to {
    transform: rotate(360deg);
  }
}

.toast-icon {
  font-size: var(--toast-icon-font);
}

.toast-message {
  font-weight: 500;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--motion-slow) var(--motion-ease),
    transform var(--motion-slow) var(--motion-ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
