<template>
  <div class="empty-state" :class="[`is-${sizeClass}`, { 'is-bordered': bordered }]">
    <span v-if="icon" class="empty-state-icon">
      <AppIcon :name="icon" :stroke-width="1.6" />
    </span>
    <p v-if="title" class="empty-state-title">{{ title }}</p>
    <p v-if="description" class="empty-state-hint">{{ description }}</p>
    <div v-if="$slots.actions" class="empty-state-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  icon: { type: String, default: '' },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  size: { type: String, default: 'md' },
  bordered: { type: Boolean, default: false }
})

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))
</script>

<style scoped>
.empty-state.is-xl {
  gap: 12px;
  padding: 40px 24px;
}

.empty-state.is-xl .empty-state-icon {
  width: 60px;
  height: 60px;
}

.empty-state.is-xl .empty-state-icon svg {
  width: 30px;
  height: 30px;
}

.empty-state.is-xl .empty-state-title {
  font-size: var(--font-size-lg);
}

.empty-state.is-xl .empty-state-hint {
  font-size: var(--font-size-sm);
}

.empty-state.is-lg {
  gap: 10px;
  padding: 32px 20px;
}

.empty-state.is-lg .empty-state-icon {
  width: 52px;
  height: 52px;
}

.empty-state.is-lg .empty-state-icon svg {
  width: 26px;
  height: 26px;
}

.empty-state.is-lg .empty-state-hint {
  font-size: var(--font-size-sm);
}

.empty-state.is-sm {
  gap: 6px;
  padding: 18px 14px;
}

.empty-state.is-sm .empty-state-icon {
  width: 38px;
  height: 38px;
}

.empty-state.is-sm .empty-state-icon svg {
  width: 19px;
  height: 19px;
}

.empty-state.is-sm .empty-state-title {
  font-size: var(--font-size-sm);
}

.empty-state.is-xs {
  gap: 4px;
  padding: 10px 8px;
}

.empty-state.is-xs .empty-state-icon {
  width: 30px;
  height: 30px;
}

.empty-state.is-xs .empty-state-icon svg {
  width: 15px;
  height: 15px;
}

.empty-state.is-xs .empty-state-title {
  font-size: var(--font-size-sm);
}

.empty-state.is-bordered {
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
}
</style>
