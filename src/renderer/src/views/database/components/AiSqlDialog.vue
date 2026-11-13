<template>
  <div v-if="aiDialog.show" class="dialog-overlay" @click.self="closeAiDialog">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>AI 生成 SQL</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeAiDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content ai-dialog-content">
        <div class="form-group">
          <label>需求描述</label>
          <textarea
            v-model="aiDialog.prompt"
            class="ai-prompt-input"
            rows="3"
            placeholder="例如：统计最近 7 天每天的订单数量，按日期升序"
            @keydown.ctrl.enter="generateSqlForTab(aiDialog.tab)"
          />
        </div>
        <div v-if="aiDialog.error" class="dialog-alert error">{{ aiDialog.error }}</div>
        <div v-if="aiDialog.loading" class="ai-loading">正在生成 SQL...</div>
        <div v-else-if="aiDialog.result" class="ai-result">
          <div class="ai-result-title">生成结果</div>
          <pre class="sql-preview-block">{{ aiDialog.result }}</pre>
        </div>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <button class="btn btn-secondary" :disabled="!aiDialog.result" @click="copySql(aiDialog.result)">复制</button>
        </div>
        <button class="btn btn-secondary" :disabled="aiDialog.loading" @click="closeAiDialog">关闭</button>
        <button
          class="btn btn-secondary"
          :disabled="aiDialog.loading || !aiDialog.prompt"
          @click="generateSqlForTab(aiDialog.tab)"
        >
          {{ aiDialog.result ? '重新生成' : '生成 SQL' }}
        </button>
        <button class="btn btn-primary" :disabled="!aiDialog.result" @click="applyAiResultToTab">插入编辑器</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { aiDialog, applyAiResultToTab, closeAiDialog, copySql, generateSqlForTab } = databaseStore
</script>
