<template>
  <div v-if="sqlPreviewDialog.show" v-modal-shell="closeSqlPreview" class="dialog-overlay sql-preview-overlay">
    <div class="dialog dialog-wide sql-preview-dialog">
      <div class="dialog-header">
        <h3>{{ sqlPreviewDialog.title }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeSqlPreview">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content">
        <SqlHighlight class="sql-preview-block" :code="sqlPreviewDialog.sql" />
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="copySql(sqlPreviewDialog.sql)">{{ t('复制 SQL') }}</button>
        <button class="btn btn-primary" @click="closeSqlPreview">{{ t('关闭') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'
import SqlHighlight from '@/components/SqlHighlight.vue'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const { closeSqlPreview, copySql, sqlPreviewDialog } = databaseStore
</script>
