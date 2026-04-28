<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="toast show"
      :class="type"
    >
      <span class="toast-icon">{{ icon }}</span>
      <span class="toast-message">{{ message }}</span>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'success'
  }
})

const icon = computed(() => {
  switch (props.type) {
    case 'error':
      return '✗'
    case 'warning':
      return '⚠'
    default:
      return '✓'
  }
})
</script>