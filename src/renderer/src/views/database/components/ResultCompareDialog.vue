<template>
  <div
    v-if="resultCompareDialog.show"
    v-modal-shell="closeResultCompare"
    class="dialog-overlay"
    @click.self="closeResultCompare"
  >
    <div class="dialog dialog-wide">
      <div class="dialog-header">
        <h3>{{ t('结果对比') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeResultCompare">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content result-compare-content">
        <div class="result-compare-summary">
          <span class="compare-chip">{{ t('本次') }} {{ currentRows.length }} {{ t('行') }}</span>
          <span class="compare-chip">{{ t('上次') }} {{ previousRows.length }} {{ t('行') }}</span>
          <span class="compare-chip added">{{ t('新增') }} {{ summary.added }}</span>
          <span class="compare-chip removed">{{ t('删除') }} {{ summary.removed }}</span>
          <span class="compare-chip modified">{{ t('修改') }} {{ summary.modified }}</span>
          <span class="compare-chip">{{ t('未变') }} {{ summary.unchanged }}</span>
        </div>
        <div class="result-compare-meta">
          <span v-if="matchMode === 'key'" class="compare-mode"
            >{{ t('按首列「') }}{{ keyField }}{{ t('」匹配') }}</span
          >
          <span v-else class="compare-mode">{{ t('按行号匹配（首列不唯一）') }}</span>
          <span v-if="previous?.capturedAt" class="compare-time">
            {{ t('上次执行：') }}{{ formatTime(previous.capturedAt) }}
          </span>
        </div>
        <div class="result-compare-scroll">
          <table class="result-table compare-table">
            <thead>
              <tr>
                <th class="compare-status-col">{{ t('状态') }}</th>
                <th v-for="field in fields" :key="field">{{ field }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, index) in entries" :key="index" :class="`compare-row-${entry.status}`">
                <td class="compare-status-col">
                  <span :class="['compare-status', entry.status]">{{ statusLabel(entry.status) }}</span>
                </td>
                <td
                  v-for="field in fields"
                  :key="field"
                  :class="{ 'compare-cell-changed': entry.changedFields.includes(field) }"
                >
                  {{ displayCell(entry.row, field) }}
                </td>
              </tr>
              <tr v-if="entries.length === 0" class="compare-empty-row">
                <td :colspan="fields.length + 1">{{ t('两次结果完全一致') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-primary" @click="closeResultCompare">{{ t('关闭') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const { closeResultCompare, formatCellValue, resultCompareDialog } = databaseStore

const tab = computed(() => resultCompareDialog.value.tab)
const current = computed(() => tab.value?.queryResult || null)
const previous = computed(() => tab.value?.previousResult || null)
const currentRows = computed(() => current.value?.rows || [])
const previousRows = computed(() => previous.value?.rows || [])

const fields = computed(() => {
  const list = current.value?.fields || previous.value?.fields || []
  return list.map((field) => field.name)
})

const keyField = computed(() => fields.value[0] || '')

const matchMode = computed(() => {
  if (!keyField.value) return 'index'
  const unique = (rows) => new Set(rows.map((row) => String(row[keyField.value]))).size === rows.length
  return unique(currentRows.value) && unique(previousRows.value) ? 'key' : 'index'
})

function sameValue(left, right) {
  if (left === right) return true
  if (left === null || left === undefined) return right === null || right === undefined || right === ''
  if (right === null || right === undefined) return left === ''
  return String(left) === String(right)
}

const entries = computed(() => {
  const rows = currentRows.value
  const prevRows = previousRows.value
  const columns = fields.value
  const byKey = new Map()
  if (matchMode.value === 'key') {
    prevRows.forEach((row, index) => byKey.set(String(row[keyField.value]), index))
  }
  const usedPrevious = new Set()
  const result = []

  rows.forEach((row, index) => {
    const previousIndex = matchMode.value === 'key' ? byKey.get(String(row[keyField.value])) : index
    const previousRow = previousIndex !== undefined && previousIndex < prevRows.length ? prevRows[previousIndex] : null
    if (!previousRow) {
      result.push({ status: 'added', row, changedFields: [] })
      return
    }
    usedPrevious.add(previousIndex)
    const changedFields = columns.filter((field) => !sameValue(row[field], previousRow[field]))
    result.push({
      status: changedFields.length ? 'modified' : 'unchanged',
      row,
      changedFields
    })
  })

  prevRows.forEach((row, index) => {
    if (usedPrevious.has(index)) return
    if (matchMode.value === 'index' && index < rows.length) return
    result.push({ status: 'removed', row, changedFields: [] })
  })

  return result
})

const summary = computed(() => {
  const counts = { added: 0, removed: 0, modified: 0, unchanged: 0 }
  for (const entry of entries.value) counts[entry.status] += 1
  return counts
})

function displayCell(row, field) {
  return formatCellValue(row?.[field])
}

function statusLabel(status) {
  return { added: t('新增'), removed: t('删除'), modified: t('修改'), unchanged: t('未变') }[status] || status
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}
</script>
