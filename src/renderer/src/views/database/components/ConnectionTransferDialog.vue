<template>
  <div
    v-if="connectionTransferDialog.show"
    v-modal-shell="{ onClose: closeConnectionTransferDialog, closeOnOutside: false }"
    class="dialog-overlay"
  >
    <div class="dialog">
      <div class="dialog-header">
        <h3>{{ isExport ? t('导出连接配置') : t('导入连接配置') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeConnectionTransferDialog">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content">
        <template v-if="isExport">
          <p class="transfer-hint">
            {{ t('将当前') }} {{ connections.length }} {{ t('个连接导出为 JSON 配置文件，可在其他设备导入。') }}
          </p>
          <label class="checkbox-label-inline transfer-option">
            <input v-model="connectionTransferDialog.includePasswords" type="checkbox" />
            <span>{{ t('包含密码（明文保存，请注意文件安全）') }}</span>
          </label>
        </template>
        <template v-else>
          <div class="import-file-row">
            <button class="btn btn-sm btn-secondary" @click="selectConnectionImportFile">
              {{ t('选择配置文件') }}
            </button>
            <span class="import-file-name" :title="connectionTransferDialog.fileName">
              {{ connectionTransferDialog.fileName || t('尚未选择文件') }}
            </span>
          </div>
          <p v-if="connectionTransferDialog.previewCount" class="transfer-hint">
            {{ t('文件中包含') }} {{ connectionTransferDialog.previewCount }}
            {{ t('个连接，同名的连接将自动重命名。') }}
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
          {{ t('取消') }}
        </button>
        <button
          v-if="isExport"
          class="btn btn-primary"
          :disabled="connections.length === 0"
          @click="executeConnectionExport"
        >
          {{ t('导出') }}
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="connectionTransferDialog.importing || !connectionTransferDialog.content"
          @click="executeConnectionImport"
        >
          {{ connectionTransferDialog.importing ? t('导入中...') : t('导入') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
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
