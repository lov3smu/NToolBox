<script setup>
const props = defineProps({
  modelValue: { type: [String, Number, Boolean], default: undefined },
  value: { type: [String, Number, Boolean], required: true },
  name: { type: String, default: '' },
  variant: { type: String, default: 'default' },
  disabled: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

function handleChange(event) {
  emit('update:modelValue', props.value)
  emit('change', props.value, event)
}
</script>

<template>
  <label
    class="radio-option"
    :class="[`radio-option-${variant}`, { 'is-checked': modelValue === value, 'is-disabled': disabled }]"
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
