<template>
  <div v-if="sqlAuditDialog.show" class="dialog-overlay" @click.self="closeSqlAuditDialog(false)">
    <div class="dialog sql-audit-dialog">
      <div class="dialog-header">
        <h3>SQL 审核</h3>
        <div class="audit-summary">
          <span v-if="errorCount" class="audit-level error">错误 {{ errorCount }}</span>
          <span v-if="warnCount" class="audit-level warn">警告 {{ warnCount }}</span>
        </div>
        <button class="btn-icon btn-sm" title="关闭" @click="closeSqlAuditDialog(false)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <div class="audit-issues">
          <div v-for="(issue, index) in sqlAuditDialog.issues" :key="index" class="audit-issue">
            <span :class="['audit-level', issue.level]">{{ issue.level === 'error' ? '错误' : '警告' }}</span>
            <div class="audit-issue-body">
              <div class="audit-rule">{{ issue.label }}</div>
              <div class="audit-message">{{ issue.message }}</div>
              <code class="audit-sql">{{ issue.sql }}</code>
            </div>
          </div>
        </div>
        <div v-if="sqlAuditDialog.blocking" class="audit-blocking-hint">
          严格模式已阻止执行：请修复错误级问题后重试，或在设置中调整审核规则。
        </div>
      </div>
      <div class="dialog-footer">
        <template v-if="!sqlAuditDialog.blocking">
          <button class="btn btn-secondary" @click="closeSqlAuditDialog(false)">取消</button>
          <button class="btn btn-primary" @click="closeSqlAuditDialog(true)">仍然执行</button>
        </template>
        <button v-else class="btn btn-primary" @click="closeSqlAuditDialog(false)">返回修改</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const { closeSqlAuditDialog, sqlAuditDialog } = databaseStore

const errorCount = computed(() => (sqlAuditDialog.value.issues || []).filter((issue) => issue.level === 'error').length)
const warnCount = computed(() => (sqlAuditDialog.value.issues || []).filter((issue) => issue.level === 'warn').length)
</script>
