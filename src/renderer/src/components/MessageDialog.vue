<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="message-overlay" @click.self="close">
        <div class="message-dialog" :class="type">
          <div class="message-icon">
            <svg v-if="type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 12 15 16 9" />
            </svg>
            <svg v-else-if="type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <svg v-else-if="type === 'warning'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <svg v-else-if="type === 'confirm'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </div>
          <div class="message-content">
            <div v-if="title" class="message-title">
              {{ title }}
            </div>
            <div class="message-text">
              {{ message }}
            </div>
          </div>
          <div class="message-actions">
            <button v-if="type === 'confirm'" class="btn btn-secondary" @click="cancel">取消</button>
            <button class="btn btn-primary" @click="confirm">确定</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'info'
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'confirm', 'cancel'])

function close() {
  emit('close')
}

function confirm() {
  emit('confirm')
  close()
}

function cancel() {
  emit('cancel')
  close()
}
</script>

<style scoped>
.message-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.message-dialog {
  width: 420px;
  max-width: calc(100vw - 32px);
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.message-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.message-icon svg {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
}

.message-dialog.success .message-icon {
  background: rgba(var(--success-rgb), 0.15);
  color: var(--success-dark);
}

.message-dialog.error .message-icon {
  background: rgba(var(--error-rgb), 0.15);
  color: var(--error-dark);
}

.message-dialog.warning .message-icon {
  background: rgba(var(--warning-rgb), 0.15);
  color: var(--warning-darker);
}

.message-dialog.confirm .message-icon {
  background: rgba(var(--warning-rgb), 0.15);
  color: var(--warning-darker);
}

.message-dialog.info .message-icon {
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent-color);
}

.message-content {
  text-align: center;
}

.message-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.message-text {
  font-size: var(--font-size-base);
  color: var(--text-secondary);
  line-height: 1.5;
}

.message-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  width: 100%;
  margin-top: 4px;
}

.message-actions .btn {
  min-width: 88px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease);
}

.fade-enter-active .message-dialog,
.fade-leave-active .message-dialog {
  transition:
    transform var(--motion-panel) var(--motion-ease),
    opacity var(--motion-panel) var(--motion-ease);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .message-dialog,
.fade-leave-to .message-dialog {
  transform: scale(0.97) translateY(4px);
  opacity: 0;
}
</style>
