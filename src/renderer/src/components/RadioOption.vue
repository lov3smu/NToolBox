<script setup>
import { computed } from 'vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: undefined },
  value: { type: [String, Number, Boolean], required: true },
  name: { type: String, default: '' },
  variant: { type: String, default: 'default' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

function handleChange(event) {
  emit('update:modelValue', props.value)
  emit('change', props.value, event)
}
</script>

<template>
  <label
    class="radio-option"
    :class="[
      `radio-option-${variant}`,
      `is-${sizeClass}`,
      { 'is-checked': modelValue === value, 'is-disabled': disabled }
    ]"
  >
    <input
      type="radio"
      :name="name"
      :value="value"
      :checked="modelValue === value"
      :disabled="disabled"
      @change="handleChange"
    />
    <span class="radio-option-body"><slot /></span>
  </label>
</template>

<style scoped>
.radio-option.is-xl {
  font-size: var(--font-size-base);
}

.radio-option.is-lg {
  font-size: var(--font-size-dense);
}

.radio-option.is-sm {
  font-size: var(--font-size-xs);
}

.radio-option.is-xs {
  font-size: var(--font-size-xs);
  gap: 6px;
}

.radio-option-pill.is-xl {
  height: var(--control-height-lg);
  padding: 0 16px;
}

.radio-option-pill.is-lg {
  height: var(--control-height);
  padding: 0 14px;
}

.radio-option-pill.is-sm {
  height: var(--control-height-sm);
  padding: 0 10px;
}

.radio-option-pill.is-xs {
  height: var(--control-height-xs);
  padding: 0 8px;
}
</style>
