<template>
  <svg
    class="app-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :width="size || undefined"
    :height="size || undefined"
    aria-hidden="true"
    v-html="markup"
  />
</template>

<script setup>
import { computed } from 'vue'
import { ICON_MARKUP } from '@/icons'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 0 },
  strokeWidth: { type: [Number, String], default: 2 }
})

const markup = computed(() => ICON_MARKUP[props.name] || '')
</script>

<style scoped>
.app-icon {
  flex-shrink: 0;
}
</style>
