<template>
  <div v-if="cellViewer.show" class="dialog-overlay" @click.self="closeCellViewer">
    <div class="dialog dialog-large cell-viewer-dialog">
      <div class="dialog-header">
        <h3>{{ cellViewer.field || t('单元格') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeCellViewer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
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
        <button
          class="btn btn-secondary"
          :disabled="isNull || cellViewer.loading || Boolean(cellViewer.error)"
          @click="copyValue"
        >
          {{ t('复制内容') }}
        </button>
        <button class="btn btn-primary" @click="closeCellViewer">{{ t('关闭') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'
import { copyToClipboard } from '@/utils/clipboard'
import { binaryByteLength, formatBytes, formatCellViewerText, isBinaryValue } from '../cellFormat'

const databaseStore = inject('database')
const { cellViewer, closeCellViewer, showMessage } = databaseStore

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

async function copyValue() {
  const copied = await copyToClipboard(displayValue.value)
  await showMessage(copied ? t('已复制单元格内容') : t('复制失败'), copied ? 'success' : 'error')
}
</script>
