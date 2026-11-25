<template>
  <Teleport to="body">
    <div
      v-if="visible && resource && targets.length"
      ref="menuRef"
      v-clamp-viewport
      class="send-to-menu"
      :class="`is-${sizeClass}`"
      role="menu"
      :aria-label="t('发送到')"
      :style="{ left: `${x}px`, top: `${y}px` }"
    >
      <div class="send-to-head">
        <span class="send-to-title">{{ t('发送到') }}</span>
        <span class="send-to-subject" :title="resource.title">{{ resource.title || t('未命名内容') }}</span>
      </div>
      <button
        v-for="target in targets"
        :key="target.path"
        type="button"
        class="send-to-option"
        role="menuitem"
        @click="pick(target)"
      >
        <span class="send-to-name">{{ t(target.name) }}</span>
        <span class="send-to-hint">{{ t(target.hint) }}</span>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getSendTargets } from '@shared/sendTo'
import { getToolByPath } from '@shared/navTools'
import { sendResourceTo } from '@/composables'
import { t } from '@/i18n'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  size: { type: String, default: 'md' },
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  resource: { type: Object, default: null },
  excludePath: { type: String, default: '' }
})

const emit = defineEmits(['close', 'sent'])

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const menuRef = ref(null)

const targets = computed(() => {
  if (!props.resource) return []
  return getSendTargets(props.resource.kind, props.excludePath).map((target) => ({
    ...target,
    name: getToolByPath(target.path)?.name || target.path
  }))
})

function pick(target) {
  if (sendResourceTo(props.resource, target.path)) emit('sent', target)
  emit('close')
}

function onPointerDown(event) {
  if (!menuRef.value?.contains(event.target)) emit('close')
}

function onKeyDown(event) {
  if (event.key === 'Escape') emit('close')
}

function bind(active) {
  if (active) {
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
  } else {
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('keydown', onKeyDown)
  }
}

watch(
  () => props.visible,
  (visible) => bind(visible),
  { immediate: true }
)

onBeforeUnmount(() => bind(false))
</script>

<style scoped>
.send-to-menu {
  position: fixed;
  z-index: 1200;
  width: 252px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.send-to-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 6px 10px 8px;
  margin-bottom: 4px;
  border-bottom: 1px dashed var(--border-color);
}

.send-to-title {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--text-tertiary);
}

.send-to-subject {
  min-width: 0;
  overflow: hidden;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.send-to-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 7px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.send-to-option:hover,
.send-to-menu.is-xl {
  width: 304px;
  padding: 8px;
}

.send-to-menu.is-xl .send-to-title,
.send-to-menu.is-xl .send-to-subject {
  font-size: var(--font-size-sm);
}

.send-to-menu.is-xl .send-to-option {
  padding: 10px 12px;
  font-size: var(--font-size-base);
}

.send-to-menu.is-lg {
  width: 280px;
  padding: 7px;
}

.send-to-menu.is-lg .send-to-option {
  padding: 8px 11px;
}

.send-to-menu.is-sm {
  width: 224px;
  padding: 5px;
}

.send-to-menu.is-sm .send-to-option {
  padding: 6px 9px;
  font-size: var(--font-size-sm);
}

.send-to-menu.is-xs {
  width: 200px;
  padding: 4px;
}

.send-to-menu.is-xs .send-to-title,
.send-to-menu.is-xs .send-to-subject,
.send-to-menu.is-xs .send-to-option {
  font-size: var(--font-size-xs);
}

.send-to-menu.is-xs .send-to-option {
  padding: 5px 8px;
}

.send-to-option:focus-visible {
  background: var(--inset-bg);
}

.send-to-option:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: -1px;
}

.send-to-name {
  font-size: var(--font-size-sm);
  font-weight: 600;
}

.send-to-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
</style>
