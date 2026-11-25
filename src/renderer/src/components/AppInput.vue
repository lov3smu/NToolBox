<template>
  <span
    v-if="hasAffix"
    ref="wrapperRef"
    class="app-input"
    :class="[`is-${sizeClass}`, fieldClass, { 'has-prefix': showPrefix, 'has-suffix': showSuffix }]"
  >
    <span v-if="showPrefix" ref="prefixRef" class="app-input-affix is-prefix" aria-hidden="true">
      <slot name="prefix">
        <AppIcon v-if="prefixIcon" :name="prefixIcon" :size="affixIconSize" />
      </slot>
    </span>
    <input
      ref="inputRef"
      v-bind="$attrs"
      class="input-field"
      :class="[`is-${sizeClass}`, alignClass, { 'is-invalid': invalid, 'is-mono': mono }]"
      :aria-invalid="invalid || undefined"
      :value="modelValue"
      @input="onInput"
      @change="onChange"
      @compositionstart="onCompositionStart"
      @compositionend="onCompositionEnd"
    />
    <span v-if="showSuffix" ref="suffixRef" class="app-input-affix is-suffix">
      <button
        v-if="showClear"
        type="button"
        class="app-input-clear"
        tabindex="-1"
        :title="t('清除')"
        :aria-label="t('清除')"
        @mousedown.prevent
        @click="clearValue"
      >
        <AppIcon name="close" :size="affixIconSize" />
      </button>
      <slot name="suffix">
        <AppIcon v-if="suffixIcon" :name="suffixIcon" :size="affixIconSize" />
      </slot>
    </span>
  </span>
  <input
    v-else
    ref="inputRef"
    v-bind="$attrs"
    class="input-field"
    :class="[`is-${sizeClass}`, alignClass, { 'is-invalid': invalid, 'is-mono': mono }]"
    :aria-invalid="invalid || undefined"
    :value="modelValue"
    @input="onInput"
    @change="onChange"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
  />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useSlots } from 'vue'
import { t } from '@/i18n'

import AppIcon from '@/components/AppIcon.vue'

defineOptions({ inheritAttrs: false })

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']
const ALIGNS = ['left', 'center', 'right']
const AFFIX_ICON_SIZES = { xl: 20, lg: 20, md: 16, sm: 16, xs: 14 }

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  modelModifiers: { type: Object, default: () => ({}) },
  size: { type: String, default: 'md' },
  invalid: { type: Boolean, default: false },
  prefixIcon: { type: String, default: '' },
  suffixIcon: { type: String, default: '' },
  clearable: { type: Boolean, default: false },
  mono: { type: Boolean, default: false },
  align: { type: String, default: 'left' },
  fieldClass: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'clear'])

const slots = useSlots()
const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))
const alignClass = computed(() => (ALIGNS.includes(props.align) && props.align !== 'left' ? `is-${props.align}` : ''))
const affixIconSize = computed(() => AFFIX_ICON_SIZES[sizeClass.value])
const showPrefix = computed(() => Boolean(props.prefixIcon) || Boolean(slots.prefix))
const showSuffix = computed(() => Boolean(props.suffixIcon) || props.clearable || Boolean(slots.suffix))
const hasAffix = computed(() => showPrefix.value || showSuffix.value)
const showClear = computed(() => props.clearable && String(props.modelValue ?? '').length > 0)

const inputRef = ref(null)
const wrapperRef = ref(null)
const prefixRef = ref(null)
const suffixRef = ref(null)
const composing = ref(false)
let affixObserver = null

// 插槽/图标前后缀宽度不可预知，实测宽度写入 CSS 变量，避免固定预留压住输入文字
function applyAffixWidths() {
  const wrapper = wrapperRef.value
  if (!wrapper) return
  wrapper.style.setProperty('--app-input-prefix-size', prefixRef.value ? `${prefixRef.value.offsetWidth}px` : '0px')
  wrapper.style.setProperty('--app-input-suffix-size', suffixRef.value ? `${suffixRef.value.offsetWidth}px` : '0px')
}

onMounted(() => {
  const Observer = globalThis.ResizeObserver
  if (!Observer) {
    applyAffixWidths()
    return
  }
  affixObserver = new Observer(applyAffixWidths)
  if (prefixRef.value) affixObserver.observe(prefixRef.value)
  if (suffixRef.value) affixObserver.observe(suffixRef.value)
  applyAffixWidths()
})

onBeforeUnmount(() => {
  affixObserver?.disconnect()
})

function normalize(value) {
  let next = value
  if (props.modelModifiers?.trim) next = next.trim()
  if (props.modelModifiers?.number) {
    const parsed = Number.parseFloat(next)
    next = Number.isNaN(parsed) ? next : parsed
  }
  return next
}

function onInput(event) {
  if (composing.value || props.modelModifiers?.lazy) return
  emit('update:modelValue', normalize(event.target.value))
}

function onChange(event) {
  if (composing.value) return
  if (props.modelModifiers?.lazy) emit('update:modelValue', normalize(event.target.value))
}

function onCompositionStart() {
  composing.value = true
}

function onCompositionEnd(event) {
  composing.value = false
  if (props.modelModifiers?.lazy) return
  emit('update:modelValue', normalize(event.target.value))
}

function clearValue() {
  emit('update:modelValue', '')
  emit('clear')
  nextTick(() => inputRef.value?.focus())
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select(),
  el: inputRef
})
</script>

<style scoped>
.app-input {
  --app-input-pad-x: 10px;
  --app-input-affix-size: 16px;
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.app-input .input-field {
  flex: 1 1 auto;
  min-width: 0;
}

.app-input.is-xl {
  --app-input-pad-x: 12px;
  --app-input-affix-size: 20px;
}

.app-input.is-lg {
  --app-input-pad-x: 11px;
  --app-input-affix-size: 20px;
}

.app-input.is-sm {
  --app-input-pad-x: 8px;
  --app-input-affix-size: 16px;
}

.app-input.is-xs {
  --app-input-pad-x: 7px;
  --app-input-affix-size: 14px;
}

.app-input.has-prefix .input-field {
  padding-left: calc(var(--app-input-pad-x) + var(--app-input-prefix-size, var(--app-input-affix-size)) + 4px);
}

.app-input.has-suffix .input-field {
  padding-right: calc(var(--app-input-pad-x) + var(--app-input-suffix-size, var(--app-input-affix-size)) + 4px);
}

.app-input-affix {
  position: absolute;
  display: flex;
  align-items: center;
  color: var(--text-tertiary);
}

.app-input-affix.is-prefix {
  left: var(--app-input-pad-x);
  pointer-events: none;
}

.app-input-affix.is-suffix {
  right: var(--app-input-pad-x);
}

.app-input-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.app-input-clear:hover {
  color: var(--text-primary);
  background: var(--surface-hover);
}

.app-input-clear:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.35);
}

.input-field.is-xl {
  height: var(--control-height-xl);
  padding: 0 12px;
  font-size: var(--font-size-base);
}

.input-field.is-lg {
  height: var(--control-height-lg);
  padding: 0 11px;
  font-size: var(--font-size-base);
}

.input-field.is-sm {
  height: var(--control-height-sm);
  padding: 0 8px;
  font-size: var(--font-size-sm);
}

.input-field.is-xs {
  height: var(--control-height-xs);
  padding: 0 7px;
  font-size: var(--font-size-xs);
}

.input-field.is-mono {
  font-family: var(--font-mono);
}

.input-field.is-center {
  text-align: center;
}

.input-field.is-right {
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .app-input-clear {
    transition: none;
  }
}
</style>
