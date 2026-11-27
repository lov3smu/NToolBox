<template>
  <div v-if="cellViewer.show" v-modal-shell="closeCellViewer" class="dialog-overlay" @click.self="closeCellViewer">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>{{ cellViewer.field || t('单元格') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeCellViewer">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content">
        <div class="cell-viewer-meta">
          <span v-if="cellViewer.columnType" class="cell-viewer-type">{{ cellViewer.columnType }}</span>
          <span class="cell-viewer-size">{{ sizeLabel }}</span>
          <span v-if="isNull" class="cell-viewer-null">NULL</span>
          <span v-else-if="isBinary" class="cell-viewer-badge">{{ t('二进制') }}</span>
        </div>
        <pre class="cell-viewer-content" :class="{ 'is-binary': isBinary }">{{ displayValue }}</pre>
      </div>
      <div class="dialog-footer">
        <CopyButton
          :text="displayValue"
          :label="t('复制内容')"
          :success-message="t('已复制单元格内容')"
          :disabled="isNull || cellViewer.loading || Boolean(cellViewer.error)"
          variant="secondary"
        />
        <button class="btn btn-primary" @click="closeCellViewer">{{ t('关闭') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'
import { binaryByteLength, formatBytes, formatCellViewerText, isBinaryValue } from '../cellFormat'

import AppIcon from '@/components/AppIcon.vue'
import CopyButton from '@/components/CopyButton.vue'
const databaseStore = inject('database')
const { cellViewer, closeCellViewer } = databaseStore

const isNull = computed(
  () => !cellViewer.value.loading && (cellViewer.value.value === null || cellViewer.value.value === undefined)
)
const isBinary = computed(
  () => isBinaryValue(cellViewer.value.value) || (cellViewer.value.loading && cellViewer.value.byteLength > 0)
)

const displayValue = computed(() => {
  if (cellViewer.value.loading) return t('正在读取完整内容…')
  if (cellViewer.value.error) return cellViewer.value.error
  return formatCellViewerText(cellViewer.value.value)
})

const sizeLabel = computed(() => {
  if (cellViewer.value.loading) return t('二进制 · {p0}', { p0: formatBytes(cellViewer.value.byteLength) })
  if (isBinary.value) return t('二进制 · {p0}', { p0: formatBytes(binaryByteLength(cellViewer.value.value)) })
  return t('{p0} 字符', { p0: displayValue.value.length })
})
</script>
