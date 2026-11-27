<template>
  <div class="approval-card" :class="[approval.risk, approval.status, { compact }]">
    <div class="approval-head">
      <span class="approval-risk" :class="approval.risk">{{ riskLabel(approval.risk) }}</span>
      <span class="approval-title">{{ approval.tool }}</span>
      <button
        v-if="compact && (hasApprovalArgs(approval) || approval.preview)"
        type="button"
        class="approval-toggle"
        @click="detailsOpen = !detailsOpen"
      >
        {{ detailsOpen ? t('收起明细') : t('查看明细') }}
        <AppIcon name="chevron-down" class="approval-toggle-chevron" :class="{ expanded: detailsOpen }" />
      </button>
      <span v-if="approval.status !== 'pending'" class="approval-status" :class="approval.status">
        {{ approvalStatusText(approval.status) }}
      </span>
    </div>
    <div class="approval-summary">{{ approval.summary || t('等待确认的操作') }}</div>
    <div v-if="hasApprovalArgs(approval) && (!compact || detailsOpen)" class="approval-args">
      <pre>{{ pretty(approval.arguments) }}</pre>
    </div>
    <div v-if="approval.preview && (!compact || detailsOpen)" class="approval-preview">
      <template v-if="approval.preview.kind === 'diff'">
        <div class="preview-head">
          <span class="preview-path">{{ approval.preview.path }}</span>
          <span class="preview-stat">
            <i class="add">+{{ approval.preview.added }}</i>
            <i class="del">-{{ approval.preview.removed }}</i>
          </span>
        </div>
        <div v-if="approval.preview.approximate" class="preview-note">{{ t('文件差异过大，仅显示增删统计') }}</div>
        <div v-else class="preview-lines">
          <div
            v-for="(line, lineIndex) in approval.preview.lines"
            :key="lineIndex"
            class="preview-line"
            :class="line.type"
          >
            <span class="preview-sign">{{ line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ' }}</span>
            <span class="preview-text">{{ line.text || ' ' }}</span>
          </div>
          <div v-if="approval.preview.truncated" class="preview-note">{{ t('预览已截断') }}</div>
        </div>
      </template>
      <template v-else-if="approval.preview.kind === 'delete'">
        <div class="preview-head">
          <span class="preview-path">{{ approval.preview.path }}</span>
          <span class="preview-stat">{{
            t('{count} 项 · {size}', {
              count: approval.preview.total,
              size: formatBytes(approval.preview.totalSize, { decimals: 1, trimZeros: true })
            })
          }}</span>
        </div>
        <ul class="preview-items">
          <li v-for="(item, itemIndex) in approval.preview.items" :key="itemIndex">{{ item.path }}</li>
        </ul>
        <div v-if="approval.preview.truncated" class="preview-note">
          {{ t('仅列出前 {count} 项', { count: approval.preview.items.length }) }}
        </div>
      </template>
      <template v-else-if="approval.preview.kind === 'transfer'">
        <div class="preview-head">
          <span class="preview-path">{{ approval.preview.mode === 'move' ? t('移动') : t('复制') }}</span>
        </div>
        <div class="preview-transfer">
          <span>{{ approval.preview.from }}</span>
          <span class="preview-arrow">→</span>
          <span>{{ approval.preview.to }}</span>
        </div>
        <div v-if="approval.preview.overwrite" class="preview-note warning">{{ t('目标已存在，将被覆盖') }}</div>
      </template>
      <div v-else-if="approval.preview.text" class="preview-note">{{ approval.preview.text }}</div>
    </div>
    <div v-if="approval.status === 'pending'" class="approval-actions">
      <button type="button" class="ghost" @click="emit('respond', approval, 'deny')">{{ t('拒绝') }}</button>
      <button
        v-if="approval.allowRemember !== false"
        type="button"
        class="ghost"
        @click="emit('respond', approval, 'allow_always')"
      >
        {{ t('总是允许') }}
      </button>
      <button type="button" class="primary" @click="emit('respond', approval, 'allow_once')">{{ t('允许') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { t } from '@/i18n'
import { formatBytes } from '@shared/format'

import AppIcon from '@/components/AppIcon.vue'
const RISK_LABELS = {
  get read() {
    return t('只读')
  },
  get write() {
    return t('写入')
  },
  get destructive() {
    return t('破坏性')
  }
}
const STATUS_LABELS = {
  get allowed() {
    return t('已允许')
  },
  get always() {
    return t('已允许')
  },
  get denied() {
    return t('已拒绝')
  },
  get expired() {
    return t('已失效')
  }
}

defineProps({
  approval: {
    type: Object,
    required: true
  },
  compact: {
    type: Boolean,
    default: false
  }
})

const detailsOpen = ref(false)

const emit = defineEmits(['respond'])

function riskLabel(risk) {
  return t(RISK_LABELS[risk] || t('操作'))
}

function approvalStatusText(status) {
  return STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : ''
}

function hasApprovalArgs(approval) {
  const args = approval?.arguments
  return Boolean(args && typeof args === 'object' && Object.keys(args).length)
}

function pretty(value) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  const text = value.trim()
  if (!text) return ''
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
</script>

<style scoped>
.approval-card {
  border: 1px solid rgba(var(--warning-rgb), 0.35);
  border-radius: var(--radius-lg);
  background: var(--surface);
  overflow: hidden;
  animation: step-in var(--motion-fast) var(--motion-ease);
}

.approval-card.destructive {
  border-color: rgba(var(--error-rgb), 0.4);
}

.approval-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border-bottom: 1px solid var(--border-color);
}

.approval-risk {
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  background: rgba(var(--warning-rgb), 0.14);
  color: var(--warning-darker);
  font-size: calc(11px * var(--font-scale));
  font-weight: 600;
}

.approval-risk.read {
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
}

.approval-risk.destructive {
  background: rgba(var(--error-rgb), 0.12);
  color: var(--error-dark);
}

.approval-title {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--text-primary);
}

.approval-status {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.approval-status.allowed,
.approval-status.always {
  color: var(--success-dark);
}

.approval-status.denied {
  color: var(--error-dark);
}

.approval-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-tertiary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.approval-toggle:hover {
  color: var(--text-primary);
}

.approval-toggle-chevron {
  width: 12px;
  height: 12px;
  transition: transform var(--motion-fast) var(--motion-ease);
}

.approval-toggle-chevron.expanded {
  transform: rotate(180deg);
}

.approval-card.compact .approval-head {
  padding: 6px 10px;
  border-bottom: 0;
}

.approval-card.compact .approval-summary {
  padding: 0 10px 7px;
  font-size: var(--font-size-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.approval-card.compact .approval-args {
  padding: 0 10px 7px;
}

.approval-card.compact .approval-preview {
  margin: 0 10px 7px;
}

.approval-card.compact .approval-actions {
  padding: 6px 10px;
  border-top: 1px dashed var(--border-color);
}

.approval-summary {
  padding: 8px 11px 6px;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: var(--text-secondary);
}

.approval-args {
  padding: 0 11px 8px;
}

.approval-args pre {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 160px;
  overflow: auto;
}

.approval-preview {
  margin: 0 11px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  overflow: hidden;
}

.preview-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border-color);
  font-size: var(--font-size-xs);
}

.preview-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-family: var(--font-mono);
}

.preview-stat {
  display: flex;
  gap: 6px;
  white-space: nowrap;
  color: var(--text-tertiary);
}

.preview-stat i {
  font-style: normal;
}

.preview-stat .add {
  color: var(--success-dark);
}

.preview-stat .del {
  color: var(--error-dark);
}

.preview-lines {
  max-height: 220px;
  overflow: auto;
  padding: 4px 0;
  font-family: var(--font-mono);
  font-size: calc(11px * var(--font-scale));
  line-height: 1.55;
}

.preview-line {
  display: flex;
  gap: 6px;
  padding: 0 10px;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-line.add {
  background: rgba(var(--success-rgb), 0.1);
  color: var(--success-dark);
}

.preview-line.del {
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.preview-sign {
  flex-shrink: 0;
  width: 8px;
  text-align: center;
  opacity: 0.8;
}

.preview-text {
  flex: 1;
  min-width: 0;
}

.preview-items {
  margin: 0;
  padding: 6px 10px 8px 24px;
  max-height: 160px;
  overflow: auto;
  font-size: var(--font-size-xs);
  line-height: 1.6;
  color: var(--text-secondary);
}

.preview-items li {
  word-break: break-all;
}

.preview-transfer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 10px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  word-break: break-all;
}

.preview-arrow {
  color: var(--text-tertiary);
}

.preview-note {
  padding: 6px 10px;
  border-top: 1px dashed var(--border-color);
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.preview-note.warning {
  color: var(--warning-darker);
}

.approval-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 11px 10px;
  border-top: 1px solid var(--border-color);
}

.approval-actions button {
  padding: 4px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: var(--transition-fast);
}

.approval-actions button:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.approval-actions button.primary {
  border-color: var(--btn-primary-bg);
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
}

.approval-actions button.primary:hover {
  background: var(--btn-primary-bg-hover);
  border-color: var(--btn-primary-bg-hover);
  color: var(--btn-primary-text);
}

@keyframes step-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
</style>
