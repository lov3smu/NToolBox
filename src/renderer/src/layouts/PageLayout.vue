<template>
  <div class="page-layout" :class="pageClass" :style="resolvedMaxWidth ? { maxWidth: resolvedMaxWidth } : undefined">
    <header class="page-header">
      <div class="page-heading">
        <h1 class="page-title">
          <span v-if="tool" class="header-icon" v-html="tool.icon" />
          <span class="title-text">{{ resolvedTitle }}</span>
        </h1>
        <div v-if="resolvedSubtitle" class="page-subtitle">{{ resolvedSubtitle }}</div>
      </div>

      <div v-if="$slots['header-extra']" class="page-extra">
        <slot name="header-extra" />
      </div>
    </header>

    <div v-if="$slots.actions" class="page-toolbar">
      <slot name="actions" />
    </div>

    <div class="page-content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getToolByPath } from '@shared/tools'

const props = defineProps({
  toolPath: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  maxWidth: { type: [Number, String], default: 'none' },
  pageClass: { type: String, default: '' }
})

const tool = computed(() => (props.toolPath ? getToolByPath(props.toolPath) : null))
const resolvedTitle = computed(() => props.title || tool.value?.name || '')
const resolvedSubtitle = computed(() => props.subtitle || tool.value?.description || '')
const resolvedMaxWidth = computed(() => {
  if (props.maxWidth === 'none' || props.maxWidth === '') return null
  return typeof props.maxWidth === 'number' ? `${props.maxWidth}px` : props.maxWidth
})
</script>

<style scoped>
.page-layout {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: var(--app-header-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.page-heading {
  flex-shrink: 0;
  min-width: 0;
  max-width: 52%;
}

.page-title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}

.header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--primary-gradient);
  color: white;
}

.header-icon :deep(svg) {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-subtitle {
  margin-top: 1px;
  padding-left: 40px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.page-extra {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.page-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 6px 20px;
  background: var(--app-toolbar-bg);
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.page-toolbar::-webkit-scrollbar {
  height: 4px;
}

.page-toolbar::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 2px;
}

.page-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
}

@media (max-width: 900px) {
  .page-heading {
    max-width: none;
  }

  .page-header {
    padding: 10px 16px;
  }

  .page-toolbar {
    padding: 6px 16px;
  }
}
</style>
