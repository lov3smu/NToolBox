<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="toast" :class="type">
        <span class="toast-icon">{{ icon }}</span>
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
  background: var(--primary-gradient);
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 10000;
  box-shadow: 0 4px 20px rgba(var(--primary-rgb), 0.4);
}

.toast.error {
  background: linear-gradient(135deg, var(--error-dark) 0%, var(--error-darker) 100%);
  box-shadow: 0 4px 20px rgba(var(--error-rgb), 0.4);
}

.toast.warning {
  background: var(--warning-gradient);
  box-shadow: 0 4px 20px rgba(var(--warning-rgb), 0.4);
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
    opacity 0.3s ease,
    transform 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
