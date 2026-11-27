<template>
  <textarea
    ref="textareaRef"
    class="app-textarea"
    :class="[`is-${sizeClass}`, { 'is-invalid': invalid, 'is-mono': mono, 'is-auto-grow': autoGrow }]"
    :aria-invalid="invalid || undefined"
    :value="modelValue"
    @input="onInput"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
  />
</template>

<script setup>
import { computed, ref } from 'vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  modelModifiers: { type: Object, default: () => ({}) },
  size: { type: String, default: 'md' },
  invalid: { type: Boolean, default: false },
  mono: { type: Boolean, default: false },
  autoGrow: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))
const textareaRef = ref(null)
const composing = ref(false)

function onInput(event) {
  if (composing.value) return
  emit('update:modelValue', normalize(event.target.value))
}

function onCompositionStart() {
  composing.value = true
}

function onCompositionEnd(event) {
  composing.value = false
  emit('update:modelValue', normalize(event.target.value))
}

function normalize(value) {
  return props.modelModifiers?.trim ? value.trim() : value
}

defineExpose({
  focus: () => textareaRef.value?.focus(),
  blur: () => textareaRef.value?.blur(),
  select: () => textareaRef.value?.select(),
  el: textareaRef
})
</script>

<style scoped>
.app-textarea.is-xl {
  min-height: 120px;
  padding: 10px 12px;
  font-size: var(--font-size-base);
}

.app-textarea.is-lg {
  min-height: 104px;
  padding: 9px 11px;
  font-size: var(--font-size-base);
}

.app-textarea.is-sm {
  min-height: 72px;
  padding: 6px 8px;
  font-size: var(--font-size-sm);
}

.app-textarea.is-xs {
  min-height: 60px;
  padding: 6px 8px;
  font-size: var(--font-size-xs);
}

.app-textarea.is-mono {
  font-family: var(--font-mono);
}

.app-textarea.is-auto-grow {
  field-sizing: content;
  resize: none;
}
</style>
