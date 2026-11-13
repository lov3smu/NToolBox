<template>
  <div v-if="explainDialog.show" class="dialog-overlay" @click.self="closeExplainDialog">
    <div class="dialog dialog-wide">
      <div class="dialog-header">
        <h3>执行计划</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeExplainDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content explain-dialog-content">
        <div v-if="explainDialog.loading" class="explain-loading">正在分析执行计划...</div>
        <div v-else-if="!explainDialog.result" class="explain-empty">没有执行计划数据</div>
        <template v-else>
          <div v-if="!explainDialog.result.success" class="dialog-alert error">
            {{ explainDialog.result.error }}
          </div>
          <template v-else>
            <div v-if="explainRows.length" class="explain-table-scroll">
              <table class="result-table explain-table">
                <thead>
                  <tr>
                    <th v-for="field in explainFields" :key="field">{{ field }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in explainRows" :key="index">
                    <td v-for="field in explainFields" :key="field">{{ formatValue(row[field]) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <details v-if="explainDialog.result.json" class="explain-json">
              <summary>JSON 执行计划</summary>
              <pre class="sql-preview-block">{{ formatJson(explainDialog.result.json) }}</pre>
            </details>
          </template>
        </template>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <button
            class="btn btn-secondary"
            :disabled="!explainDialog.result?.success"
            @click="copySql(explainDialog.result?.json ? formatJson(explainDialog.result.json) : '')"
          >
            复制 JSON
          </button>
        </div>
        <button class="btn btn-primary" @click="closeExplainDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const { closeExplainDialog, copySql, explainDialog } = databaseStore

const explainRows = computed(() => explainDialog.value.result?.rows || [])

const explainFields = computed(() => {
  const first = explainRows.value[0]
  return first ? Object.keys(first) : []
})

function formatJson(value) {
  return JSON.stringify(value, null, 2)
}

function formatValue(value) {
  if (value === null || value === undefined) return 'NULL'
  return String(value)
}
</script>
