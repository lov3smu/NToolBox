<template>
  <div
    v-if="importDialog.show"
    v-modal-shell="{ onClose: closeImportDialog, closeOnOutside: false }"
    class="dialog-overlay"
  >
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>{{ t('导入数据 ·') }} {{ importDialog.tab?.tableName }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeImportDialog">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-tabs">
        <div :class="['dialog-tab', { active: importDialog.format === 'csv' }]" @click="importDialog.format = 'csv'">
          CSV
        </div>
        <div :class="['dialog-tab', { active: importDialog.format === 'json' }]" @click="importDialog.format = 'json'">
          JSON
        </div>
      </div>
      <div class="dialog-content import-dialog-content">
        <div class="import-file-row">
          <button class="btn btn-sm btn-secondary" @click="selectImportFile(importDialog.format)">
            {{ t('选择') }} {{ importDialog.format.toUpperCase() }} {{ t('文件') }}
          </button>
          <span class="import-file-name" :title="importDialog.filePath">
            {{ importDialog.fileName || t('尚未选择文件') }}
          </span>
        </div>
        <div v-if="importDialog.error" class="dialog-alert error">{{ importDialog.error }}</div>
        <template v-if="importDialog.rows.length">
          <div class="import-summary">
            {{ t('共') }} {{ importDialog.rows.length }} {{ t('行数据，') }} {{ matchedInfo.matched }} /
            {{ importDialog.headers.length }} {{ t('列已映射') }}
            <span v-if="matchedInfo.unmatched" class="import-summary-hint">
              （{{ matchedInfo.unmatched }} {{ t('列未匹配将被忽略）') }}
            </span>
          </div>
          <div class="import-mapping">
            <div v-for="(item, index) in getImportMapping()" :key="item.header" class="import-mapping-item">
              <span class="import-mapping-source" :title="item.header">{{ item.header }}</span>
              <span class="import-mapping-arrow">→</span>
              <select
                :value="item.column"
                class="filter-select import-mapping-target"
                @change="setImportMappingColumn(index, $event.target.value)"
              >
                <option value="">{{ t('忽略此列') }}</option>
                <option v-for="column in importDialog.tab?.columns || []" :key="column.name" :value="column.name">
                  {{ column.name }}
                </option>
              </select>
            </div>
          </div>
          <div class="import-preview">
            <div class="import-preview-title">{{ t('数据预览（前') }} {{ previewRows.length }} {{ t('行）') }}</div>
            <div class="import-preview-scroll">
              <table class="result-table import-preview-table">
                <thead>
                  <tr>
                    <th v-for="header in importDialog.headers" :key="header">{{ header }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in previewRows" :key="index">
                    <td v-for="header in importDialog.headers" :key="header">{{ row[header] }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" :disabled="importDialog.importing" @click="closeImportDialog">
          {{ t('取消') }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="importDialog.importing || !importDialog.rows.length"
          @click="executeImport"
        >
          {{ importDialog.importing ? t('导入中...') : t('开始导入') }}
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
const { closeImportDialog, executeImport, getImportMapping, importDialog, selectImportFile, setImportMappingColumn } =
  databaseStore

const previewRows = computed(() => importDialog.value.rows.slice(0, 5))

const matchedInfo = computed(() => {
  const mapping = getImportMapping()
  const matched = mapping.filter((item) => item.matched).length
  return { matched, unmatched: mapping.length - matched }
})
</script>
