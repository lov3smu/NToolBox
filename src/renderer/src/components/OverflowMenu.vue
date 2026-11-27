<template>
  <div ref="rootRef" class="overflow-menu">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        v-clamp-viewport
        class="overflow-menu-panel"
        :class="`is-${sizeClass}`"
        role="menu"
        :style="{ left: `${position.left}px`, top: `${position.top}px` }"
        @click.stop
        @keydown="onPanelKeydown"
      >
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          role="menuitem"
          class="overflow-menu-item"
          :class="{ danger: item.danger }"
          :disabled="item.disabled"
          @click="select(item)"
        >
          <AppIcon v-if="item.icon" :name="item.icon" />
          <span>{{ item.label }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

import { focusFirstMenuItem, handleMenuKeydown } from '@/utils/menuKeyboard'
import AppIcon from './AppIcon.vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']
const SIZE_METRICS = {
  xl: { width: 220, height: 40 },
  lg: { width: 200, height: 37 },
  md: { width: 180, height: 34 },
  sm: { width: 160, height: 30 },
  xs: { width: 144, height: 26 }
}

const props = defineProps({
  items: { type: Array, default: () => [] },
  align: { type: String, default: 'end' },
  size: { type: String, default: 'md' }
})

const emit = defineEmits(['select'])

const rootRef = ref(null)
const panelRef = ref(null)
const open = ref(false)
const position = ref({ left: 0, top: 0 })

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))
const metrics = computed(() => SIZE_METRICS[sizeClass.value])

function toggle() {
  if (open.value) close()
  else show()
}

function show() {
  const rect = rootRef.value?.getBoundingClientRect()
  if (!rect) return
  const { width: panelWidth, height: itemHeight } = metrics.value
  const height = props.items.length * itemHeight + 8
  const left = props.align === 'end' ? rect.right - panelWidth : rect.left
  position.value = {
    left: Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8)),
    top: rect.bottom + height + 8 <= window.innerHeight ? rect.bottom + 4 : Math.max(8, rect.top - height - 4)
  }
  open.value = true
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', close, true)
  window.addEventListener('resize', close)
  nextTick(() => focusFirstMenuItem(panelRef.value))
}

function onPanelKeydown(event) {
  handleMenuKeydown(event, panelRef.value, close)
}

function close() {
  if (!open.value) return
  open.value = false
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
}

function onPointerDown(event) {
  if (rootRef.value?.contains(event.target) || panelRef.value?.contains(event.target)) return
  close()
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

function select(item) {
  if (item.disabled) return
  close()
  emit('select', item)
}

onBeforeUnmount(close)
</script>

<style scoped>
.overflow-menu {
  display: inline-flex;
}

.overflow-menu-panel {
  --menu-width: 180px;
  --menu-item-pad-y: 7px;
  --menu-item-pad-x: 10px;
  --menu-item-font: var(--font-size-sm);
  --menu-item-icon: var(--icon-size-sm);
  position: fixed;
  z-index: 2000;
  min-width: var(--menu-width);
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}

.overflow-menu-panel.is-xl {
  --menu-width: 220px;
  --menu-item-pad-y: 9px;
  --menu-item-pad-x: 12px;
  --menu-item-font: var(--font-size-base);
  --menu-item-icon: var(--icon-size-md);
}

.overflow-menu-panel.is-lg {
  --menu-width: 200px;
  --menu-item-pad-y: 8px;
  --menu-item-pad-x: 11px;
  --menu-item-font: var(--font-size-base);
}

.overflow-menu-panel.is-sm {
  --menu-width: 160px;
  --menu-item-pad-y: 6px;
  --menu-item-pad-x: 8px;
}

.overflow-menu-panel.is-xs {
  --menu-width: 144px;
  --menu-item-pad-y: 5px;
  --menu-item-pad-x: 7px;
  --menu-item-font: var(--font-size-xs);
  --menu-item-icon: var(--icon-size-xs);
}

.overflow-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: var(--menu-item-pad-y) var(--menu-item-pad-x);
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--menu-item-font);
  text-align: left;
  cursor: pointer;
}

.overflow-menu-item:hover:not(:disabled),
.overflow-menu-item:focus-visible {
  background: var(--surface-muted);
  outline: none;
}

.overflow-menu-item:disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.overflow-menu-item.danger {
  color: var(--error-color);
}

.overflow-menu-item.danger svg {
  color: inherit;
}

.overflow-menu-item svg {
  width: var(--menu-item-icon);
  height: var(--menu-item-icon);
  flex-shrink: 0;
  color: var(--text-secondary);
}
</style>
