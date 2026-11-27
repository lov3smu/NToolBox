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

      <div v-if="canSplit || secondaryPane || $slots['header-extra']" class="page-extra">
        <SplitPicker v-if="canSplit" />
        <slot name="header-extra" />
        <div v-if="secondaryPane" class="pane-actions">
          <button
            type="button"
            class="pane-action"
            :title="t('左右交换')"
            :aria-label="t('左右交换')"
            @click="secondaryPane.swap()"
          >
            <AppIcon name="swap-horizontal" />
          </button>
          <button
            type="button"
            class="pane-action"
            :title="t('关闭分屏')"
            :aria-label="t('关闭分屏')"
            @click="secondaryPane.close()"
          >
            <AppIcon name="close" />
          </button>
        </div>
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
import AppIcon from '@/components/AppIcon.vue'
import { computed, inject } from 'vue'
import { getToolByPath, isSplitTool } from '@shared/navTools'
import { SPLIT_SECONDARY_KEY } from '@/composables'
import { t } from '@/i18n'
import SplitPicker from '@/components/SplitPicker.vue'

const props = defineProps({
  toolPath: { type: String, default: '' },
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  maxWidth: { type: [Number, String], default: 'none' },
  pageClass: { type: String, default: '' }
})

const secondaryPane = inject(SPLIT_SECONDARY_KEY, null)
const tool = computed(() => (props.toolPath ? getToolByPath(props.toolPath) : null))
const canSplit = computed(() => !secondaryPane && isSplitTool(props.toolPath))
const resolvedTitle = computed(() => props.title || (tool.value ? t(tool.value.name) : ''))
const resolvedSubtitle = computed(() => props.subtitle || (tool.value ? t(tool.value.description) : ''))
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
  border-radius: var(--radius-md);
  background: var(--primary-gradient);
  color: var(--text-inverse);
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

.pane-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 6px;
  padding-left: 8px;
  border-left: 1px solid var(--border-color);
}

.pane-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.pane-action:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}

.pane-action:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 1px;
}

.pane-action svg {
  width: 14px;
  height: 14px;
}

.page-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 6px 8px;
  padding: 6px 20px;
  background: var(--app-toolbar-bg);
  border-bottom: 1px solid var(--border-color);
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
