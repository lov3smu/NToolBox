<template>
  <div ref="rootRef" class="setting-select" :class="[`is-${sizeClass}`, { 'is-open': open, 'is-disabled': disabled }]">
    <button
      type="button"
      class="setting-select-trigger"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="setting-select-value" :class="{ placeholder: !selectedOption }">
        {{ selectedOption ? t(selectedOption.label, { p0: selectedOption.value }) : t(placeholder) }}
      </span>
      <AppIcon name="chevron-down" class="setting-select-chevron" :class="{ open }" />
    </button>
    <Teleport to="body">
      <div v-if="open" ref="panelRef" class="setting-select-panel" role="listbox" :style="panelStyle">
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          class="setting-select-option"
          :class="{ 'is-active': option.value === modelValue, 'is-highlighted': index === highlighted }"
          role="option"
          :aria-selected="option.value === modelValue"
          @mousedown.prevent
          @click="pick(option)"
          @mousemove="highlighted = index"
        >
          <span class="setting-select-option-main">
            <span class="setting-select-option-label">{{ t(option.label, { p0: option.value }) }}</span>
            <span v-if="option.hint" class="setting-select-option-hint">
              {{ t(option.hint, { p0: option.value }) }}
            </span>
          </span>
          <AppIcon v-if="option.value === modelValue" name="check" :stroke-width="2.4" class="setting-select-check" />
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { t } from '@/i18n'

import AppIcon from '@/components/AppIcon.vue'
const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  size: { type: String, default: 'md' },
  placeholder: {
    type: String,
    get default() {
      return t('请选择')
    }
  },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const panelRef = ref(null)
const open = ref(false)
const highlighted = ref(-1)
const panelStyle = ref({})

const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue))
const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

function measure() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const panel = panelRef.value?.getBoundingClientRect()
  if (!trigger || !panel) return
  const gap = 6
  const margin = 8
  const width = Math.min(Math.max(trigger.width, 200), window.innerWidth - margin * 2)
  const left = Math.min(Math.max(margin, trigger.left), window.innerWidth - width - margin)
  const spaceBelow = window.innerHeight - trigger.bottom - gap - margin
  const spaceAbove = trigger.top - gap - margin
  const flipUp = spaceBelow < panel.height && spaceAbove > spaceBelow
  const top = flipUp ? Math.max(margin, trigger.top - panel.height - gap) : trigger.bottom + gap
  panelStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(Math.max(140, Math.min(300, flipUp ? spaceAbove : spaceBelow)))}px`
  }
}

async function openPanel() {
  if (props.disabled || open.value) return
  open.value = true
  highlighted.value = Math.max(
    0,
    props.options.findIndex((option) => option.value === props.modelValue)
  )
  await nextTick()
  measure()
  window.addEventListener('pointerdown', onWindowPointerdown, true)
  window.addEventListener('scroll', onWindowScroll, { capture: true, passive: true })
  window.addEventListener('resize', closePanel)
}

function closePanel() {
  if (!open.value) return
  open.value = false
  window.removeEventListener('pointerdown', onWindowPointerdown, true)
  window.removeEventListener('scroll', onWindowScroll, true)
  window.removeEventListener('resize', closePanel)
}

function toggle() {
  if (open.value) closePanel()
  else openPanel()
}

function onWindowPointerdown(event) {
  if (rootRef.value?.contains(event.target)) return
  if (panelRef.value?.contains(event.target)) return
  closePanel()
}

function onWindowScroll(event) {
  const target = event.target
  if (target && target.nodeType && panelRef.value?.contains(target)) return
  closePanel()
}

function pick(option) {
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value)
    emit('change', option.value)
  }
  closePanel()
  rootRef.value?.querySelector('.setting-select-trigger')?.focus()
}

function onTriggerKeydown(event) {
  if (props.disabled) return
  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPanel()
    }
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closePanel()
  } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    const total = props.options.length
    if (!total) return
    highlighted.value = (highlighted.value + step + total) % total
    panelRef.value
      ?.querySelectorAll('.setting-select-option')
      ?.[highlighted.value]?.scrollIntoView({ block: 'nearest' })
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const option = props.options[highlighted.value]
    if (option) pick(option)
  }
}

onBeforeUnmount(closePanel)
</script>

<style scoped>
.setting-select {
  --select-height: var(--control-height);
  --select-font: var(--font-size-sm);
  --select-pad-left: 10px;
  --select-pad-right: 30px;
  --select-chevron: var(--icon-size-2xs);
  --select-option-pad-y: 7px;
  --select-option-pad-x: 8px;
  --select-option-font: var(--font-size-sm);
  --select-hint-font: var(--font-size-xs);
  position: relative;
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}

.setting-select.is-xl {
  --select-height: var(--control-height-xl);
  --select-font: var(--font-size-base);
  --select-pad-left: 12px;
  --select-pad-right: 34px;
  --select-chevron: var(--icon-size-sm);
  --select-option-pad-y: 9px;
  --select-option-pad-x: 10px;
  --select-option-font: var(--font-size-base);
  --select-hint-font: var(--font-size-sm);
}

.setting-select.is-lg {
  --select-height: var(--control-height-lg);
  --select-font: var(--font-size-base);
  --select-pad-left: 12px;
  --select-pad-right: 32px;
  --select-chevron: var(--icon-size-xs);
  --select-option-pad-y: 8px;
  --select-option-pad-x: 9px;
  --select-option-font: var(--font-size-base);
  --select-hint-font: var(--font-size-sm);
}

.setting-select.is-sm {
  --select-height: var(--control-height-sm);
  --select-pad-right: 28px;
  --select-option-pad-y: 6px;
}

.setting-select.is-xs {
  --select-height: var(--control-height-xs);
  --select-font: var(--font-size-xs);
  --select-pad-left: 8px;
  --select-pad-right: 24px;
  --select-option-pad-y: 5px;
  --select-option-pad-x: 6px;
  --select-option-font: var(--font-size-xs);
}

.setting-select-trigger {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--select-height);
  padding: 0 var(--select-pad-right) 0 var(--select-pad-left);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text-primary);
  font-size: var(--select-font);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.setting-select-trigger:hover {
  border-color: var(--border-strong);
}

.setting-select.is-open .setting-select-trigger,
.setting-select-trigger:focus-visible {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.setting-select.is-disabled .setting-select-trigger {
  cursor: not-allowed;
  opacity: 0.6;
}

.setting-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-select-value.placeholder {
  color: var(--text-tertiary);
}

.setting-select-chevron {
  position: absolute;
  right: 9px;
  top: 50%;
  width: var(--select-chevron);
  height: var(--select-chevron);
  transform: translateY(-50%);
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.setting-select-chevron.open {
  transform: translateY(-50%) rotate(180deg);
}

.setting-select-panel {
  position: fixed;
  z-index: 1200;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overscroll-behavior: contain;
}

.setting-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: var(--select-option-pad-y, 7px) var(--select-option-pad-x, 8px);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--select-option-font, var(--font-size-sm));
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.setting-select-option.is-highlighted {
  background: var(--surface-hover);
}

.setting-select-option.is-active {
  color: var(--accent-color);
}

.setting-select-option-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.setting-select-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-select-option-hint {
  font-size: var(--select-hint-font, var(--font-size-xs));
  color: var(--text-tertiary);
  white-space: normal;
}

.setting-select-check {
  width: var(--select-chevron, var(--icon-size-2xs));
  height: var(--select-chevron, var(--icon-size-2xs));
  flex-shrink: 0;
  color: var(--accent-color);
}
</style>
