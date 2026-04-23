<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="message-overlay"
        @click.self="close"
      >
        <div
          class="message-dialog"
          :class="type"
        >
          <div class="message-icon">
            <svg
              v-if="type === 'success'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <polyline points="9 12 12 15 16 9" />
            </svg>
            <svg
              v-else-if="type === 'error'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <line
                x1="15"
                y1="9"
                x2="9"
                y2="15"
              />
              <line
                x1="9"
                y1="9"
                x2="15"
                y2="15"
              />
            </svg>
            <svg
              v-else-if="type === 'warning'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
              />
              <line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
              />
            </svg>
            <svg
              v-else-if="type === 'confirm'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
              />
              <line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
              />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <line
                x1="12"
                y1="16"
                x2="12"
                y2="12"
              />
              <line
                x1="12"
                y1="8"
                x2="12.01"
                y2="8"
              />
            </svg>
          </div>
          <div class="message-content">
            <div
              v-if="title"
              class="message-title"
            >
              {{ title }}
            </div>
            <div class="message-text">
              {{ message }}
            </div>
          </div>
          <div class="message-actions">
            <button
              v-if="type === 'confirm'"
              class="btn-message btn-cancel"
              @click="cancel"
            >
              取消
            </button>
            <button
              class="btn-message btn-confirm"
              @click="confirm"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
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
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.message-dialog {
  width: 420px;
  max-width: 90vw;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(255, 255, 255, 0.2);
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
  width: 28px;
  height: 28px;
}

.message-dialog.success .message-icon {
  background: rgba(34, 139, 34, 0.15);
  color: #228b22;
}

.message-dialog.error .message-icon {
  background: rgba(220, 53, 69, 0.15);
  color: #dc3545;
}

.message-dialog.warning .message-icon {
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
}

.message-dialog.confirm .message-icon {
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
}

.message-dialog.info .message-icon {
  background: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
}

.message-content {
  text-align: center;
}

.message-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.message-text {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.message-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;
}

.btn-message {
  padding: 8px 24px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: var(--transition-fast);
}

.btn-confirm {
  background: var(--primary-gradient);
  color: white;
}

.btn-confirm:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-cancel {
  background: rgba(128, 128, 128, 0.1);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  background: rgba(128, 128, 128, 0.2);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-active .message-dialog,
.fade-leave-active .message-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-from .message-dialog,
.fade-leave-to .message-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>