<template>
  <div v-if="exportDialog.show" class="dialog-overlay" @click.self="closeExportDialog">
    <div class="dialog">
      <div class="dialog-header">
        <h3>导出数据 · {{ exportDialog.tab?.tableName || '查询结果' }}</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeExportDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label>导出格式</label>
          <div class="export-format-group">
            <label v-for="item in formats" :key="item.value" class="export-format-item">
              <input v-model="exportDialog.format" type="radio" :value="item.value" />
              <span>{{ item.label }}</span>
            </label>
          </div>
        </div>
        <div v-if="exportDialog.tab?.type === 'table'" class="form-group">
          <label>导出范围</label>
          <div class="export-format-group">
            <label class="export-format-item">
              <input v-model="exportDialog.scope" type="radio" value="all" />
              <span>全部数据（应用当前筛选）</span>
            </label>
            <label class="export-format-item">
              <input v-model="exportDialog.scope" type="radio" value="page" />
              <span>当前页数据</span>
            </label>
          </div>
        </div>
        <div
          v-if="exportDialog.format === 'sql' && exportDialog.tab?.type === 'table' && exportDialog.scope === 'all'"
          class="form-group"
        >
          <label class="checkbox-label-inline">
            <input v-model="exportDialog.includeStructure" type="checkbox" />
            <span>包含表结构（DROP + CREATE TABLE）</span>
          </label>
        </div>
        <p class="export-hint">
          {{
            exportDialog.scope === 'all' && exportDialog.tab?.type === 'table'
              ? '将导出符合条件的全部数据，最多 100000 行，超过部分会被截断。'
              : '将导出当前页面显示的数据。'
          }}
        </p>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" :disabled="exportDialog.exporting" @click="closeExportDialog">取消</button>
        <button class="btn btn-primary" :disabled="exportDialog.exporting" @click="executeExport">
          {{ exportDialog.exporting ? '导出中...' : '导出' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { closeExportDialog, executeExport, exportDialog } = databaseStore

const formats = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' }
]
</script>
