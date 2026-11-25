<template>
  <ModalLayer :visible="visible" dialog-selector=".file-properties-dialog" @close="emit('close')">
    <div class="file-properties-overlay">
      <div
        v-clamp-viewport
        :class="['file-properties-dialog', `is-${sizeClass}`]"
        :style="{ left: `${x}px`, top: `${y}px` }"
        :aria-label="info?.name || t('属性')"
      >
        <header class="file-properties-header">
          <h3 :title="info?.name">{{ info?.name }}</h3>
          <button type="button" class="btn-icon btn-sm" :title="t('关闭')" @click="emit('close')">
            <AppIcon name="close" />
          </button>
        </header>
        <div class="file-properties-content">
          <div class="file-properties-row">
            <span class="file-properties-label">{{ t('类型:') }}</span>
            <span class="file-properties-value">{{ info?.type }}</span>
          </div>
          <div class="file-properties-row">
            <span class="file-properties-label">{{ t('位置:') }}</span>
            <span class="file-properties-value location">{{ info?.location }}</span>
          </div>
          <div class="file-properties-row">
            <span class="file-properties-label">{{ t('大小:') }}</span>
            <span class="file-properties-value">{{ formatBytes(info?.size) }}</span>
          </div>
          <div v-if="isDirectory" class="file-properties-row">
            <span class="file-properties-label">{{ t('包含:') }}</span>
            <span class="file-properties-value">
              {{
                t('{dirs} 个文件夹，{files} 个文件', {
                  dirs: info?.directoryCount,
                  files: info?.fileCount
                })
              }}
            </span>
          </div>
          <div class="file-properties-row">
            <span class="file-properties-label">{{ t('创建时间:') }}</span>
            <span class="file-properties-value">{{ formatDateTime(info?.created) }}</span>
          </div>
          <div class="file-properties-row">
            <span class="file-properties-label">{{ t('修改时间:') }}</span>
            <span class="file-properties-value">{{ formatDateTime(info?.modified) }}</span>
          </div>
        </div>
      </div>
    </div>
  </ModalLayer>
</template>

<script setup>
import { computed } from 'vue'
import { t } from '@/i18n'
import { formatBytes, formatDateTime } from '@shared/format'
import AppIcon from '@/components/AppIcon.vue'
import ModalLayer from '@/components/ModalLayer.vue'

const SIZES = ['xl', 'lg', 'md', 'sm', 'xs']

const props = defineProps({
  visible: { type: Boolean, default: false },
  info: { type: Object, default: null },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  size: { type: String, default: 'md' }
})

const emit = defineEmits(['close'])

const sizeClass = computed(() => (SIZES.includes(props.size) ? props.size : 'md'))

const isDirectory = computed(() => props.info?.isDirectory === true || props.info?.type === t('文件夹'))
</script>

<style scoped>
.file-properties-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.file-properties-dialog {
  --fp-width: 400px;
  --fp-row-pad: 8px;
  --fp-title-size: var(--font-size-base);
  --fp-label-size: var(--font-size-sm);
  --fp-value-size: var(--font-size-dense);
  position: fixed;
  width: var(--fp-width);
  max-width: 90vw;
  max-height: calc(100vh - 32px);
  overflow: hidden auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  z-index: 9999;
}

.file-properties-dialog.is-xl {
  --fp-width: 460px;
  --fp-row-pad: 10px;
  --fp-title-size: var(--font-size-lg);
  --fp-label-size: var(--font-size-dense);
  --fp-value-size: var(--font-size-base);
}

.file-properties-dialog.is-lg {
  --fp-width: 430px;
  --fp-row-pad: 9px;
  --fp-title-size: var(--font-size-md);
  --fp-label-size: var(--font-size-sm);
  --fp-value-size: var(--font-size-base);
}

.file-properties-dialog.is-sm {
  --fp-width: 360px;
  --fp-row-pad: 6px;
  --fp-label-size: var(--font-size-xs);
  --fp-value-size: var(--font-size-sm);
}

.file-properties-dialog.is-xs {
  --fp-width: 320px;
  --fp-row-pad: 5px;
  --fp-title-size: var(--font-size-dense);
  --fp-label-size: var(--font-size-xs);
  --fp-value-size: var(--font-size-sm);
}

.file-properties-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.file-properties-header h3 {
  margin: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--fp-title-size);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-properties-content {
  padding: 8px 16px 12px;
}

.file-properties-row {
  display: flex;
  padding: var(--fp-row-pad) 0;
  border-bottom: 1px solid var(--border-color);
}

.file-properties-row:last-child {
  border-bottom: none;
}

.file-properties-label {
  flex-shrink: 0;
  width: 80px;
  color: var(--text-tertiary);
  font-size: var(--fp-label-size);
}

.file-properties-value {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  font-size: var(--fp-value-size);
  word-break: break-all;
}

.file-properties-value.location {
  color: var(--text-secondary);
  font-size: var(--fp-label-size);
}
</style>
