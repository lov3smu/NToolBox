<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="toast" :class="type" :role="type === 'error' ? 'alert' : 'status'">
        <span v-if="type === 'loading'" class="toast-spinner" aria-hidden="true"></span>
        <span v-else class="toast-icon" aria-hidden="true">{{ icon }}</span>
        <span class="toast-message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

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
  }
})

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
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--success-gradient);
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10000;
  box-shadow: 0 4px 20px rgba(var(--success-rgb), 0.35);
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
  width: var(--spinner-sm);
  height: var(--spinner-sm);
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: white;
  border-radius: 50%;
  animation: toast-spin var(--spinner-duration) linear infinite;
}

@keyframes toast-spin {
  to {
    transform: rotate(360deg);
  }
}

.toast-icon {
  font-size: var(--font-size-md);
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
