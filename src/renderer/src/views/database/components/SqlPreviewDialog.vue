<template>
  <div v-if="sqlPreviewDialog.show" class="dialog-overlay" @click.self="closeSqlPreview">
    <div class="dialog dialog-wide">
      <div class="dialog-header">
        <h3>{{ sqlPreviewDialog.title }}</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeSqlPreview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <pre class="sql-preview-block">{{ sqlPreviewDialog.sql }}</pre>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="copySql(sqlPreviewDialog.sql)">复制 SQL</button>
        <button class="btn btn-primary" @click="closeSqlPreview">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { closeSqlPreview, copySql, sqlPreviewDialog } = databaseStore
</script>
