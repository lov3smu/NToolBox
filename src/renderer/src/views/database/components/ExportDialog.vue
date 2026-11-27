<template>
  <div
    v-if="exportDialog.show"
    v-modal-shell="{ onClose: closeExportDialog, closeOnOutside: false }"
    class="dialog-overlay"
  >
    <div class="dialog">
      <div class="dialog-header">
        <h3>{{ t('导出数据 ·') }} {{ exportDialog.tab?.tableName || t('查询结果') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeExportDialog">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label>{{ t('导出格式') }}</label>
          <div class="export-format-group">
            <RadioOption
              v-for="item in formats"
              :key="item.value"
              v-model="exportDialog.format"
              class="export-format-item"
              name="export-format"
              :value="item.value"
            >
              {{ item.label }}
            </RadioOption>
          </div>
        </div>
        <div v-if="exportDialog.tab?.type === 'table'" class="form-group">
          <label>{{ t('导出范围') }}</label>
          <div class="export-format-group">
            <RadioOption v-model="exportDialog.scope" class="export-format-item" name="export-scope" value="all">
              {{ t('全部数据（应用当前筛选）') }}
            </RadioOption>
            <RadioOption v-model="exportDialog.scope" class="export-format-item" name="export-scope" value="page">
              {{ t('当前页数据') }}
            </RadioOption>
          </div>
        </div>
        <div
          v-if="exportDialog.format === 'sql' && exportDialog.tab?.type === 'table' && exportDialog.scope === 'all'"
          class="form-group"
        >
          <label class="checkbox-label-inline">
            <input v-model="exportDialog.includeStructure" type="checkbox" />
            <span>{{ t('包含表结构（DROP + CREATE TABLE）') }}</span>
          </label>
        </div>
        <div class="form-group">
          <label>{{ t('数据脱敏') }}</label>
          <div class="mask-preset-group">
            <button
              v-for="preset in MASK_PRESETS"
              :key="preset.key"
              type="button"
              :class="['mask-preset-chip', { active: exportDialog.maskPresets.includes(preset.key) }]"
              :aria-pressed="exportDialog.maskPresets.includes(preset.key)"
              :disabled="exportDialog.exporting"
              @click="toggleMaskPreset(preset.key)"
            >
              {{ t(preset.label) }}
            </button>
          </div>
          <p class="export-hint">{{ t('仅影响导出文件：按字段名关键词匹配，命中的列写入掩码。') }}</p>
        </div>
        <p class="export-hint">
          {{
            exportDialog.scope === 'all' && exportDialog.tab?.type === 'table'
              ? t('将导出符合条件的全部数据，最多 100000 行，超过部分会被截断。')
              : t('将导出当前页面显示的数据。')
          }}
        </p>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" :disabled="exportDialog.exporting" @click="closeExportDialog">
          {{ t('取消') }}
        </button>
        <button class="btn btn-primary" :disabled="exportDialog.exporting" @click="executeExport">
          {{ exportDialog.exporting ? t('导出中...') : t('导出') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'
import { MASK_PRESETS } from '@shared/dataMasking'
import RadioOption from '@/components/RadioOption.vue'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const { closeExportDialog, executeExport, exportDialog } = databaseStore

const formats = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' }
]

function toggleMaskPreset(key) {
  const list = exportDialog.value.maskPresets
  const index = list.indexOf(key)
  if (index >= 0) list.splice(index, 1)
  else list.push(key)
}
</script>
