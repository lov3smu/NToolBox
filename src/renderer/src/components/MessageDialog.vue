<template>
  <ModalLayer :visible="visible" :close-on-outside="!prompt" @close="close">
    <div class="message-overlay">
      <div class="message-dialog" :class="[type, `is-${sizeClass}`]">
        <div class="message-icon">
          <AppIcon v-if="type === 'success'" name="check-circle" />
          <AppIcon v-else-if="type === 'error'" name="x-circle" />
          <AppIcon v-else-if="type === 'warning'" name="alert-circle" />
          <AppIcon v-else-if="type === 'confirm'" name="alert-circle" />
          <AppIcon v-else name="info" />
        </div>
        <div class="message-content">
          <div v-if="title" class="message-title">
            {{ title }}
          </div>
          <div v-if="message" class="message-text">
            {{ message }}
          </div>
          <AppInput
            v-if="prompt"
            ref="inputRef"
            class="message-input"
            type="text"
            :placeholder="placeholder"
            :value="inputValue"
            @input="emit('update:inputValue', $event.target.value)"
            @keydown.enter.prevent="confirm"
          />
        </div>
        <div class="message-actions">
          <button v-if="prompt || type === 'confirm'" class="btn btn-secondary" @click="cancel">
            {{ t('取消') }}
          </button>
          <button class="btn btn-primary" @click="confirm">{{ t('确定') }}</button>
        </div>
      </div>
    </div>
  </ModalLayer>
</template>

<script setup>
import AppIcon from '@/components/AppIcon.vue'
import ModalLayer from '@/components/ModalLayer.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { t } from '@/i18n'
import AppInput from '@/components/AppInput.vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'md'
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
  },
  prompt: {
    type: Boolean,
    default: false
  },
  inputValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close', 'confirm', 'cancel', 'update:inputValue'])

const inputRef = ref(null)
const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

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

watch(
  () => props.visible,
  (visible) => {
    if (!visible || !props.prompt) return
    nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  },
  { immediate: true }
)
</script>

<style scoped>
.message-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.message-dialog {
  --dialog-width: 420px;
  --dialog-padding: 24px;
  --dialog-gap: 16px;
  --dialog-icon-box: 48px;
  --dialog-icon-glyph: var(--icon-size-md);
  --dialog-title-size: var(--font-size-md);
  --dialog-text-size: var(--font-size-base);
  width: var(--dialog-width);
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--dialog-padding);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--dialog-gap);
  animation: message-dialog-in var(--motion-panel) var(--motion-ease);
}

.message-dialog.is-xl {
  --dialog-width: 480px;
  --dialog-padding: 28px;
  --dialog-gap: 18px;
  --dialog-icon-box: 60px;
  --dialog-icon-glyph: var(--icon-size-lg);
  --dialog-title-size: var(--font-size-lg);
  --dialog-text-size: var(--font-size-md);
}

.message-dialog.is-lg {
  --dialog-width: 450px;
  --dialog-padding: 26px;
  --dialog-icon-box: 54px;
  --dialog-icon-glyph: var(--icon-size-lg);
}

.message-dialog.is-sm {
  --dialog-width: 380px;
  --dialog-padding: 20px;
  --dialog-gap: 14px;
  --dialog-icon-box: 40px;
  --dialog-icon-glyph: var(--icon-size-sm);
  --dialog-title-size: var(--font-size-base);
  --dialog-text-size: var(--font-size-sm);
}

.message-dialog.is-xs {
  --dialog-width: 340px;
  --dialog-padding: 16px;
  --dialog-gap: 12px;
  --dialog-icon-box: 34px;
  --dialog-icon-glyph: var(--icon-size-xs);
  --dialog-title-size: var(--font-size-sm);
  --dialog-text-size: var(--font-size-xs);
}

.message-icon {
  width: var(--dialog-icon-box);
  height: var(--dialog-icon-box);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.message-icon svg {
  width: var(--dialog-icon-glyph);
  height: var(--dialog-icon-glyph);
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
  width: 100%;
  text-align: center;
}

.message-title {
  font-size: var(--dialog-title-size);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.message-text {
  font-size: var(--dialog-text-size);
  color: var(--text-secondary);
  line-height: 1.5;
}

.message-input {
  width: 100%;
  margin-top: 12px;
  text-align: left;
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

/* 入场动画只作用于卡片：遮罩层始终不透明，即使动画帧被节流也不会留下不可见却拦截点击的全屏层 */
@keyframes message-dialog-in {
  from {
    transform: scale(0.97) translateY(4px);
    opacity: 0.85;
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-dialog {
    animation: none;
  }
}
</style>
