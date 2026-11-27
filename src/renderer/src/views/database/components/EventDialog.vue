<template>
  <div
    v-if="eventDialog.show"
    v-modal-shell="{ onClose: closeEventDialog, closeOnOutside: false }"
    class="dialog-overlay"
  >
    <div class="dialog dialog-wide event-dialog">
      <div class="dialog-header">
        <h3>{{ t('MySQL 事件') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" :disabled="eventDialog.saving" @click="closeEventDialog">
          <AppIcon name="close" />
        </button>
      </div>

      <div class="dialog-tabs event-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          :class="['dialog-tab', { active: eventDialog.tab === tab.key }]"
          @click="eventDialog.tab = tab.key"
        >
          {{ tab.label }}
        </div>
      </div>

      <div class="dialog-content event-content">
        <div v-if="eventDialog.loading" class="event-loading">{{ t('正在读取事件...') }}</div>

        <div v-else-if="eventDialog.tab === 'definition'" class="event-form">
          <label class="event-field">
            <span>{{ t('名称') }}</span>
            <AppInput :value="eventDialog.name" readonly />
          </label>
          <label class="event-field event-field-grow">
            <span>{{ t('定义') }}</span>
            <AppTextarea
              v-model="eventDialog.definition"
              class="event-textarea"
              spellcheck="false"
              placeholder="BEGIN&#10;  ...&#10;END"
            />
          </label>
        </div>

        <div v-else-if="eventDialog.tab === 'schedule'" class="event-form">
          <div class="event-form-grid">
            <label class="event-field">
              <span>{{ t('执行方式') }}</span>
              <select v-model="eventDialog.scheduleType" class="input-field">
                <option value="RECURRING">{{ t('重复执行') }}</option>
                <option value="ONCE">{{ t('一次性') }}</option>
              </select>
            </label>
            <label class="event-field">
              <span>{{ t('状态') }}</span>
              <select v-model="eventDialog.status" class="input-field">
                <option value="ENABLED">{{ t('启用') }}</option>
                <option value="DISABLED">{{ t('禁用') }}</option>
              </select>
            </label>

            <label v-if="eventDialog.scheduleType === 'ONCE'" class="event-field">
              <span>{{ t('执行时间') }}</span>
              <AppInput v-model="eventDialog.starts" type="datetime-local" />
            </label>
            <template v-else>
              <label class="event-field">
                <span>{{ t('间隔') }}</span>
                <div class="event-interval">
                  <AppInput v-model="eventDialog.intervalValue" type="number" min="1" />
                  <select v-model="eventDialog.intervalField" class="input-field">
                    <option v-for="field in intervalFields" :key="field.value" :value="field.value">
                      {{ field.label }}
                    </option>
                  </select>
                </div>
              </label>
              <label class="event-field">
                <span>{{ t('开始时间') }}</span>
                <AppInput v-model="eventDialog.starts" type="datetime-local" />
              </label>
              <label class="event-field">
                <span>{{ t('结束时间') }}</span>
                <AppInput v-model="eventDialog.ends" type="datetime-local" />
              </label>
            </template>

            <label class="event-field">
              <span>{{ t('完成后') }}</span>
              <select v-model="eventDialog.onCompletion" class="input-field">
                <option value="PRESERVE">{{ t('保留事件') }}</option>
                <option value="NOT PRESERVE">{{ t('删除事件') }}</option>
              </select>
            </label>
          </div>
        </div>

        <div v-else-if="eventDialog.tab === 'comment'" class="event-form">
          <label class="event-field event-field-grow">
            <span>{{ t('注释') }}</span>
            <AppTextarea v-model="eventDialog.comment" class="event-textarea" spellcheck="false" />
          </label>
        </div>

        <div v-else class="event-form">
          <SqlHighlight class="event-sql-preview" :code="eventSqlPreview" />
        </div>

        <div v-if="eventDialog.error" class="dialog-alert error">{{ eventDialog.error }}</div>
      </div>

      <div class="dialog-footer">
        <button class="btn btn-secondary" :disabled="eventDialog.saving" @click="closeEventDialog">
          {{ t('取消') }}
        </button>
        <button class="btn btn-primary" :disabled="eventDialog.loading || eventDialog.saving" @click="saveEventDialog">
          {{ eventDialog.saving ? t('保存中...') : t('保存') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'
import SqlHighlight from '@/components/SqlHighlight.vue'

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'
const databaseStore = inject('database')
const { closeEventDialog, eventDialog, eventSqlPreview, saveEventDialog } = databaseStore

const tabs = [
  { key: 'definition', label: t('定义') },
  { key: 'schedule', label: t('计划') },
  { key: 'comment', label: t('注释') },
  { key: 'sql', label: t('SQL 预览') }
]

const intervalFields = [
  { value: 'YEAR', label: t('年') },
  { value: 'QUARTER', label: t('季度') },
  { value: 'MONTH', label: t('月') },
  { value: 'WEEK', label: t('周') },
  { value: 'DAY', label: t('天') },
  { value: 'HOUR', label: t('小时') },
  { value: 'MINUTE', label: t('分钟') },
  { value: 'SECOND', label: t('秒') }
]
</script>
