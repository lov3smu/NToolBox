<template>
  <div class="help-section">
    <div
      v-if="title"
      class="help-title"
    >
      {{ title }}
    </div>
    <div class="help-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  title: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.help-section {
  background: rgba(248, 249, 250, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
}

.help-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.help-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.help-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 4px;
}

.help-content code {
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}
</style>