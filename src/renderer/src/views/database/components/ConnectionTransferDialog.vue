<template>
  <div v-if="connectionTransferDialog.show" class="dialog-overlay" @click.self="closeConnectionTransferDialog">
    <div class="dialog">
      <div class="dialog-header">
        <h3>{{ isExport ? '导出连接配置' : '导入连接配置' }}</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeConnectionTransferDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <template v-if="isExport">
          <p class="transfer-hint">将当前 {{ connections.length }} 个连接导出为 JSON 配置文件，可在其他设备导入。</p>
          <label class="checkbox-label-inline transfer-option">
            <input v-model="connectionTransferDialog.includePasswords" type="checkbox" />
            <span>包含密码（明文保存，请注意文件安全）</span>
          </label>
        </template>
        <template v-else>
          <div class="import-file-row">
            <button class="btn btn-sm btn-secondary" @click="selectConnectionImportFile">选择配置文件</button>
            <span class="import-file-name" :title="connectionTransferDialog.fileName">
              {{ connectionTransferDialog.fileName || '尚未选择文件' }}
            </span>
          </div>
          <p v-if="connectionTransferDialog.previewCount" class="transfer-hint">
            文件中包含 {{ connectionTransferDialog.previewCount }} 个连接，同名的连接将自动重命名。
          </p>
          <div v-if="connectionTransferDialog.error" class="dialog-alert error">
            {{ connectionTransferDialog.error }}
          </div>
        </template>
      </div>
      <div class="dialog-footer">
        <button
          class="btn btn-secondary"
          :disabled="connectionTransferDialog.importing"
          @click="closeConnectionTransferDialog"
        >
          取消
        </button>
        <button
          v-if="isExport"
          class="btn btn-primary"
          :disabled="connections.length === 0"
          @click="executeConnectionExport"
        >
          导出
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="connectionTransferDialog.importing || !connectionTransferDialog.content"
          @click="executeConnectionImport"
        >
          {{ connectionTransferDialog.importing ? '导入中...' : '导入' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const {
  closeConnectionTransferDialog,
  connectionTransferDialog,
  connections,
  executeConnectionExport,
  executeConnectionImport,
  selectConnectionImportFile
} = databaseStore

const isExport = computed(() => connectionTransferDialog.value.mode === 'export')
</script>
