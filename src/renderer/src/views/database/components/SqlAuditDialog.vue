<template>
  <div
    v-if="sqlAuditDialog.show"
    v-modal-shell="() => closeSqlAuditDialog(false)"
    class="dialog-overlay"
    @click.self="closeSqlAuditDialog(false)"
  >
    <div class="dialog dialog-wide">
      <div class="dialog-header">
        <h3>{{ t('SQL 审核') }}</h3>
        <div class="audit-summary">
          <span v-if="errorCount" class="audit-level error">{{ t('错误') }} {{ errorCount }}</span>
          <span v-if="warnCount" class="audit-level warn">{{ t('警告') }} {{ warnCount }}</span>
        </div>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeSqlAuditDialog(false)">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content">
        <div class="audit-issues">
          <div v-for="(issue, index) in sqlAuditDialog.issues" :key="index" class="audit-issue">
            <span :class="['audit-level', issue.level]">{{ issue.level === 'error' ? t('错误') : t('警告') }}</span>
            <div class="audit-issue-body">
              <div class="audit-rule">{{ issue.label }}</div>
              <div class="audit-message">{{ issue.message }}</div>
              <code class="audit-sql">{{ issue.sql }}</code>
            </div>
          </div>
        </div>
        <div v-if="sqlAuditDialog.blocking" class="audit-blocking-hint">
          {{ t('严格模式已阻止执行：请修复错误级问题后重试，或在设置中调整审核规则。') }}
        </div>
      </div>
      <div class="dialog-footer">
        <template v-if="!sqlAuditDialog.blocking">
          <button class="btn btn-secondary" @click="closeSqlAuditDialog(false)">{{ t('取消') }}</button>
          <button class="btn btn-primary" @click="closeSqlAuditDialog(true)">{{ t('仍然执行') }}</button>
        </template>
        <button v-else class="btn btn-primary" @click="closeSqlAuditDialog(false)">{{ t('返回修改') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const { closeSqlAuditDialog, sqlAuditDialog } = databaseStore

const errorCount = computed(() => (sqlAuditDialog.value.issues || []).filter((issue) => issue.level === 'error').length)
const warnCount = computed(() => (sqlAuditDialog.value.issues || []).filter((issue) => issue.level === 'warn').length)
</script>
