<template>
  <header>
    <h1>
      <svg
        v-if="svgIcon"
        class="header-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        v-html="svgIcon"
      />
      <component
        :is="iconComponent"
        v-else-if="iconComponent"
        class="header-icon"
      />
      <span>{{ title }}</span>
    </h1>
    <div
      v-if="subtitle"
      class="subtitle"
    >
      {{ subtitle }}
    </div>
    <slot name="extra" />
  </header>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  subtitle: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: ''
  }
})

const svgIcon = computed(() => props.icon)
const iconComponent = computed(() => null)
</script>

<style scoped>
header {
  background: var(--primary-gradient);
  color: white;
  padding: 20px 24px 16px;
  text-align: center;
  flex-shrink: 0;
}

header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 24px;
  margin-bottom: 6px;
}

.header-icon {
  width: 28px;
  height: 28px;
}

.subtitle {
  font-size: 14px;
  opacity: 0.9;
}
</style>