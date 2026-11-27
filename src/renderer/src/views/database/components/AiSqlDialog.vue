<template>
  <div v-if="aiDialog.show" v-modal-shell="{ onClose: closeAiDialog, closeOnOutside: false }" class="dialog-overlay">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>{{ t('AI 生成 SQL') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeAiDialog">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content ai-dialog-content">
        <div class="form-group">
          <label>{{ t('需求描述') }}</label>
          <div v-if="aiDialog.database" class="ai-dialog-target">
            {{ t('目标数据库：{p0}', { p0: aiDialog.database }) }}
          </div>
          <AppTextarea
            v-model="aiDialog.prompt"
            class="ai-prompt-input"
            rows="3"
            :placeholder="t('例如：统计最近 7 天每天的订单数量，按日期升序')"
            @keydown.ctrl.enter="generateSqlForTab(aiDialog.tab)"
          />
        </div>
        <div v-if="aiDialog.error" class="dialog-alert error">{{ aiDialog.error }}</div>
        <div v-if="aiDialog.loading" class="ai-loading">{{ t('正在分析表结构并生成 SQL...') }}</div>
        <div v-else-if="aiDialog.result" class="ai-result">
          <div class="ai-result-title">{{ t('生成结果') }}</div>
          <pre class="sql-preview-block">{{ aiDialog.result }}</pre>
        </div>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <button class="btn btn-secondary" :disabled="!aiDialog.result" @click="copySql(aiDialog.result)">
            {{ t('复制') }}
          </button>
        </div>
        <button class="btn btn-secondary" :disabled="aiDialog.loading" @click="closeAiDialog">{{ t('关闭') }}</button>
        <button
          class="btn btn-secondary"
          :disabled="aiDialog.loading || !aiDialog.prompt"
          @click="generateSqlForTab(aiDialog.tab)"
        >
          {{ aiDialog.result ? t('重新生成') : t('生成 SQL') }}
        </button>
        <button class="btn btn-primary" :disabled="!aiDialog.result" @click="applyAiResultToTab">
          {{ t('插入编辑器') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import AppTextarea from '@/components/AppTextarea.vue'
const databaseStore = inject('database')
const { aiDialog, applyAiResultToTab, closeAiDialog, copySql, generateSqlForTab } = databaseStore
</script>
