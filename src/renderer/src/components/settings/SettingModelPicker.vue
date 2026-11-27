<template>
  <div ref="rootRef" class="setting-combo" :class="[`is-${sizeClass}`, { 'is-open': open }]">
    <div class="setting-combo-control">
      <AppInput
        ref="inputRef"
        :value="modelValue"
        class="setting-combo-input"
        type="text"
        spellcheck="false"
        :placeholder="t(placeholder)"
        @focus="openPanel"
        @input="onInput"
        @keydown="onKeydown"
        @mousedown="onInputMousedown"
      />
      <button
        type="button"
        class="setting-combo-toggle"
        tabindex="-1"
        aria-haspopup="listbox"
        :aria-expanded="open"
        @mousedown.prevent
        @click="togglePanel"
      >
        <AppIcon name="chevron-down" class="setting-combo-chevron" :class="{ open }" />
      </button>
    </div>
    <Teleport to="body">
      <div v-if="open" ref="panelRef" class="setting-combo-panel" role="listbox" :style="panelStyle" @mousedown.prevent>
        <button
          v-for="(option, index) in visibleOptions"
          :key="option.value"
          type="button"
          class="setting-combo-option"
          :class="{ 'is-active': option.value === modelValue, 'is-highlighted': index === highlighted }"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="pick(option)"
          @mousemove="highlighted = index"
        >
          <span class="setting-combo-option-label">{{ t(option.label) }}</span>
          <AppIcon v-if="option.value === modelValue" name="check" :stroke-width="2.4" class="setting-combo-check" />
        </button>
        <div v-if="!visibleOptions.length" class="setting-combo-empty">
          {{ t('没有匹配的模型，可直接输入 provider:model') }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { t } from '@/i18n'

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  size: { type: String, default: 'md' }
})

const emit = defineEmits(['update:modelValue', 'change'])

const rootRef = ref(null)
const inputRef = ref(null)
const panelRef = ref(null)
const open = ref(false)
const query = ref('')
const highlighted = ref(0)
const panelStyle = ref({})
const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const visibleOptions = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return props.options
  return props.options.filter(
    (option) =>
      String(option.value).toLowerCase().includes(keyword) || String(option.label).toLowerCase().includes(keyword)
  )
})

watch(
  () => props.modelValue,
  () => {
    if (!open.value) query.value = ''
  }
)

function measure() {
  const trigger = rootRef.value?.getBoundingClientRect()
  const panel = panelRef.value?.getBoundingClientRect()
  if (!trigger || !panel) return
  const gap = 6
  const margin = 8
  const width = Math.min(Math.max(trigger.width, 240), 420, window.innerWidth - margin * 2)
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
  if (open.value) return
  open.value = true
  query.value = ''
  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue)
  highlighted.value = Math.max(0, selectedIndex)
  await nextTick()
  measure()
  window.addEventListener('pointerdown', onWindowPointerdown, true)
  window.addEventListener('resize', closePanel)
}

function closePanel() {
  if (!open.value) return
  open.value = false
  query.value = ''
  window.removeEventListener('pointerdown', onWindowPointerdown, true)
  window.removeEventListener('resize', closePanel)
}

function togglePanel() {
  if (open.value) closePanel()
  else {
    inputRef.value?.focus()
    openPanel()
  }
}

function onInputMousedown() {
  if (!open.value) openPanel()
}

function onWindowPointerdown(event) {
  if (rootRef.value?.contains(event.target)) return
  if (panelRef.value?.contains(event.target)) return
  closePanel()
}

function onInput(event) {
  const value = event.target.value
  emit('update:modelValue', value)
  emit('change', value)
  query.value = value
  highlighted.value = 0
  if (!open.value) openPanel()
  else nextTick(measure)
}

function pick(option) {
  if (option.value !== props.modelValue) {
    emit('update:modelValue', option.value)
    emit('change', option.value)
  }
  closePanel()
  inputRef.value?.focus()
}

function moveHighlight(step) {
  const total = visibleOptions.value.length
  if (!total) return
  highlighted.value = (highlighted.value + step + total) % total
  panelRef.value?.querySelectorAll('.setting-combo-option')?.[highlighted.value]?.scrollIntoView({ block: 'nearest' })
}

function onKeydown(event) {
  if (event.key === 'Escape') {
    if (!open.value) return
    event.preventDefault()
    closePanel()
    return
  }
  if (event.key === 'Tab') {
    closePanel()
    return
  }
  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openPanel()
    }
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveHighlight(event.key === 'ArrowDown' ? 1 : -1)
  } else if (event.key === 'Enter') {
    const option = visibleOptions.value[highlighted.value]
    if (option) {
      event.preventDefault()
      pick(option)
    }
  }
}

onBeforeUnmount(closePanel)
</script>

<style scoped>
.setting-combo {
  position: relative;
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}

.setting-combo.is-xl {
  --control-height: var(--control-height-xl);
  --combo-font: var(--font-size-base);
  --combo-toggle-width: 34px;
  --combo-chevron: var(--icon-size-sm);
  --combo-option-pad-y: 9px;
  --combo-option-pad-x: 10px;
  --combo-option-font: var(--font-size-base);
}

.setting-combo.is-lg {
  --control-height: var(--control-height-lg);
  --combo-font: var(--font-size-base);
  --combo-toggle-width: 32px;
  --combo-chevron: var(--icon-size-xs);
  --combo-option-pad-y: 8px;
  --combo-option-pad-x: 9px;
  --combo-option-font: var(--font-size-base);
}

.setting-combo.is-sm {
  --control-height: var(--control-height-sm);
  --combo-toggle-width: 26px;
  --combo-option-pad-y: 6px;
}

.setting-combo.is-xs {
  --control-height: var(--control-height-xs);
  --combo-font: var(--font-size-xs);
  --combo-toggle-width: 22px;
  --combo-chevron: var(--icon-size-2xs);
  --combo-option-pad-y: 5px;
  --combo-option-pad-x: 6px;
  --combo-option-font: var(--font-size-xs);
}

.setting-combo-control {
  position: relative;
  display: flex;
  align-items: center;
}

.setting-combo-input {
  font-size: var(--combo-font, var(--font-size-sm));
  padding-right: var(--combo-toggle-width, 30px);
}

.setting-combo.is-open .setting-combo-input {
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.setting-combo-toggle {
  position: absolute;
  right: 1px;
  top: 1px;
  bottom: 1px;
  width: var(--combo-toggle-width, 28px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.setting-combo-toggle:hover {
  color: var(--text-secondary);
}

.setting-combo-chevron {
  width: var(--combo-chevron, var(--icon-size-2xs));
  height: var(--combo-chevron, var(--icon-size-2xs));
  transition: transform 0.15s ease;
}

.setting-combo-chevron.open {
  transform: rotate(180deg);
}

.setting-combo-panel {
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

.setting-combo-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: var(--combo-option-pad-y, 7px) var(--combo-option-pad-x, 8px);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  font-size: var(--combo-option-font, var(--font-size-sm));
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.setting-combo-option.is-highlighted {
  background: var(--surface-hover);
}

.setting-combo-option.is-active {
  color: var(--accent-color);
}

.setting-combo-option-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-combo-check {
  width: var(--combo-chevron, var(--icon-size-2xs));
  height: var(--combo-chevron, var(--icon-size-2xs));
  flex-shrink: 0;
  color: var(--accent-color);
}

.setting-combo-empty {
  padding: 10px 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
</style>
