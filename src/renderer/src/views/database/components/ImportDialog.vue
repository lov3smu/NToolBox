<template>
  <div v-if="importDialog.show" class="dialog-overlay" @click.self="closeImportDialog">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>导入数据 · {{ importDialog.tab?.tableName }}</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeImportDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
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
            选择 {{ importDialog.format.toUpperCase() }} 文件
          </button>
          <span class="import-file-name" :title="importDialog.filePath">
            {{ importDialog.fileName || '尚未选择文件' }}
          </span>
        </div>
        <div v-if="importDialog.error" class="dialog-alert error">{{ importDialog.error }}</div>
        <template v-if="importDialog.rows.length">
          <div class="import-summary">
            共 {{ importDialog.rows.length }} 行数据， {{ matchedInfo.matched }} /
            {{ importDialog.headers.length }} 列已映射
            <span v-if="matchedInfo.unmatched" class="import-summary-hint">
              （{{ matchedInfo.unmatched }} 列未匹配将被忽略）
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
                <option value="">忽略此列</option>
                <option v-for="column in importDialog.tab?.columns || []" :key="column.name" :value="column.name">
                  {{ column.name }}
                </option>
              </select>
            </div>
          </div>
          <div class="import-preview">
            <div class="import-preview-title">数据预览（前 {{ previewRows.length }} 行）</div>
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
        <button class="btn btn-secondary" :disabled="importDialog.importing" @click="closeImportDialog">取消</button>
        <button
          class="btn btn-primary"
          :disabled="importDialog.importing || !importDialog.rows.length"
          @click="executeImport"
        >
          {{ importDialog.importing ? '导入中...' : '开始导入' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

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
