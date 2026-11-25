<template>
  <div ref="rootRef" class="app-select" :class="[`is-${sizeClass}`, { 'is-open': open, 'is-disabled': disabled }]">
    <button
      type="button"
      class="app-select-trigger"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
      @keydown="onTriggerKeydown"
    >
      <span class="app-select-value" :class="{ placeholder: selectedIndex < 0 }">{{ selectedLabel }}</span>
      <AppIcon name="chevron-down" class="app-select-chevron" :class="{ open }" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelRef"
        class="app-select-panel"
        :class="`is-${sizeClass}`"
        role="listbox"
        :style="panelStyle"
      >
        <button
          v-for="(option, index) in normalizedOptions"
          :key="`${option.value}`"
          type="button"
          class="app-select-option"
          :class="{ 'is-active': index === selectedIndex, 'is-highlighted': index === highlighted }"
          role="option"
          :aria-selected="index === selectedIndex"
          :aria-disabled="option.disabled || undefined"
          :disabled="option.disabled"
          @mousedown.prevent
          @click="pick(option)"
          @mousemove="highlighted = option.disabled ? highlighted : index"
        >
          <span class="app-select-option-text">
            <span class="app-select-option-label">{{ option.label }}</span>
            <span v-if="option.description" class="app-select-option-desc">{{ option.description }}</span>
          </span>
          <AppIcon v-if="index === selectedIndex" name="check" :stroke-width="2.4" class="app-select-check" />
        </button>
        <div v-if="!normalizedOptions.length" class="app-select-empty">{{ t('没有可选项') }}</div>
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
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const panelRef = ref(null)
const open = ref(false)
const highlighted = ref(-1)
const panelStyle = ref({})

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))
const normalizedOptions = computed(() =>
  props.options.map((option) =>
    option && typeof option === 'object'
      ? {
          value: option.value,
          label: option.label ?? String(option.value),
          description: option.description || '',
          disabled: option.disabled === true
        }
      : { value: option, label: String(option), description: '', disabled: false }
  )
)
const selectedIndex = computed(() => normalizedOptions.value.findIndex((option) => option.value === props.modelValue))
const selectedLabel = computed(() => {
  const index = selectedIndex.value
  if (index >= 0) return normalizedOptions.value[index].label
  return props.placeholder ? props.placeholder : t('请选择')
})

function measure() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const panel = panelRef.value?.getBoundingClientRect()
  if (!trigger || !panel) return
  const gap = 6
  const margin = 8
  const width = Math.min(Math.max(trigger.width, 140), window.innerWidth - margin * 2)
  const left = Math.min(Math.max(margin, trigger.left), window.innerWidth - width - margin)
  const spaceBelow = window.innerHeight - trigger.bottom - gap - margin
  const spaceAbove = trigger.top - gap - margin
  const flipUp = spaceBelow < panel.height && spaceAbove > spaceBelow
  const top = flipUp ? Math.max(margin, trigger.top - panel.height - gap) : trigger.bottom + gap
  panelStyle.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(width)}px`,
    maxHeight: `${Math.round(Math.max(120, Math.min(280, flipUp ? spaceAbove : spaceBelow)))}px`
  }
}

async function openPanel() {
  if (props.disabled || open.value) return
  open.value = true
  const current = selectedIndex.value >= 0 ? selectedIndex.value : 0
  highlighted.value = normalizedOptions.value[current]?.disabled ? firstEnabledIndex() : current
  await nextTick()
  measure()
  if (highlighted.value >= 0) {
    panelRef.value?.querySelectorAll('.app-select-option')?.[highlighted.value]?.scrollIntoView({ block: 'nearest' })
  }
  window.addEventListener('pointerdown', onWindowPointerdown, true)
  window.addEventListener('scroll', onWindowScroll, { capture: true, passive: true })
  window.addEventListener('resize', closePanel)
}

function firstEnabledIndex() {
  return normalizedOptions.value.findIndex((option) => !option.disabled)
}

function moveHighlight(step) {
  const total = normalizedOptions.value.length
  if (!total) return
  let index = highlighted.value
  for (let i = 0; i < total; i += 1) {
    index = (index + step + total) % total
    if (!normalizedOptions.value[index].disabled) {
      highlighted.value = index
      panelRef.value?.querySelectorAll('.app-select-option')?.[index]?.scrollIntoView({ block: 'nearest' })
      return
    }
  }
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
  if (option.disabled) return
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value)
    emit('change', option.value)
  }
  closePanel()
  rootRef.value?.querySelector('.app-select-trigger')?.focus()
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
    moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const option = normalizedOptions.value[highlighted.value]
    if (option) pick(option)
  }
}

onBeforeUnmount(closePanel)
</script>

<style scoped>
.app-select {
  --select-height: var(--control-height);
  --select-font: var(--font-size-sm);
  --select-pad-left: 10px;
  --select-pad-right: 30px;
  --select-chevron: var(--icon-size-2xs);
  --select-option-pad-y: 7px;
  --select-option-pad-x: 8px;
  --select-option-font: var(--font-size-sm);
  position: relative;
  display: inline-flex;
  min-width: 0;
  vertical-align: middle;
}

.app-select.is-xl {
  --select-height: var(--control-height-xl);
  --select-font: var(--font-size-base);
  --select-pad-left: 12px;
  --select-pad-right: 34px;
  --select-chevron: var(--icon-size-sm);
  --select-option-pad-y: 9px;
  --select-option-pad-x: 10px;
  --select-option-font: var(--font-size-base);
}

.app-select.is-lg {
  --select-height: var(--control-height-lg);
  --select-font: var(--font-size-base);
  --select-pad-left: 12px;
  --select-pad-right: 32px;
  --select-chevron: var(--icon-size-xs);
  --select-option-pad-y: 8px;
  --select-option-pad-x: 9px;
  --select-option-font: var(--font-size-base);
}

.app-select.is-sm {
  --select-height: var(--control-height-sm);
  --select-pad-right: 26px;
  --select-option-pad-y: 6px;
}

.app-select.is-xs {
  --select-height: var(--control-height-xs);
  --select-font: var(--font-size-xs);
  --select-pad-left: 8px;
  --select-pad-right: 22px;
  --select-option-pad-y: 5px;
  --select-option-pad-x: 6px;
  --select-option-font: var(--font-size-xs);
}

.app-select-trigger {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
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

.app-select-trigger:hover:not(:disabled) {
  border-color: var(--border-strong);
}

.app-select.is-open .app-select-trigger,
.app-select-trigger:focus-visible {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.app-select.is-disabled .app-select-trigger {
  cursor: not-allowed;
  opacity: 0.6;
}

.app-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-value.placeholder {
  color: var(--text-tertiary);
}

.app-select-chevron {
  position: absolute;
  right: 9px;
  top: 50%;
  width: var(--select-chevron);
  height: var(--select-chevron);
  transform: translateY(-50%);
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.app-select-chevron.open {
  transform: translateY(-50%) rotate(180deg);
}

.app-select-panel {
  --panel-option-pad-y: 7px;
  --panel-option-pad-x: 8px;
  --panel-option-font: var(--font-size-sm);
  --panel-chevron: var(--icon-size-2xs);
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

.app-select-panel.is-xl {
  --panel-option-pad-y: 9px;
  --panel-option-pad-x: 10px;
  --panel-option-font: var(--font-size-base);
  --panel-chevron: var(--icon-size-sm);
}

.app-select-panel.is-lg {
  --panel-option-pad-y: 8px;
  --panel-option-pad-x: 9px;
  --panel-option-font: var(--font-size-base);
  --panel-chevron: var(--icon-size-xs);
}

.app-select-panel.is-sm {
  --panel-option-pad-y: 6px;
}

.app-select-panel.is-xs {
  --panel-option-pad-y: 5px;
  --panel-option-pad-x: 6px;
  --panel-option-font: var(--font-size-xs);
}

.app-select-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: var(--panel-option-pad-y) var(--panel-option-pad-x);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--panel-option-font);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.app-select-option.is-highlighted {
  background: var(--surface-hover);
}

.app-select-option.is-active {
  color: var(--accent-color);
}

.app-select-option:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-select-option-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.app-select-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-option-desc {
  overflow: hidden;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-check {
  width: var(--panel-chevron);
  height: var(--panel-chevron);
  flex-shrink: 0;
  color: var(--accent-color);
}

.app-select-empty {
  padding: 10px 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
</style>
