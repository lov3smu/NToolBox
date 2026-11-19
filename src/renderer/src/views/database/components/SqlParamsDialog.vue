<template>
  <div v-if="sqlParamsDialog.show" class="dialog-overlay" @click.self="cancel">
    <div class="dialog sql-params-dialog">
      <div class="dialog-header">
        <h3>{{ t('SQL 参数赋值') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="cancel">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <p class="sql-params-hint">
          {{ t('检测到') }} {{ sqlParamsDialog.params.length }}
          {{ t('个命名参数，执行时按占位符绑定传入，不会拼接进 SQL。') }}
        </p>
        <div class="sql-params-list">
          <label v-for="param in sqlParamsDialog.params" :key="param.name" class="sql-param-row">
            <span class="sql-param-name">:{{ param.name }}</span>
            <input
              v-model="param.value"
              class="input-field sql-param-input"
              type="text"
              :placeholder="t('请输入参数值')"
              @keyup.enter="submit"
            />
          </label>
        </div>
        <details class="sql-params-preview">
          <summary>{{ t('查看 SQL') }}</summary>
          <pre class="sql-params-sql">{{ sqlParamsDialog.sql }}</pre>
        </details>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="cancel">{{ t('取消') }}</button>
        <button class="btn btn-primary" @click="submit">{{ t('执行') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'

const databaseStore = inject('database')
const { sqlParamsDialog } = databaseStore

function finish(values) {
  const resolve = sqlParamsDialog.value.resolve
  sqlParamsDialog.value = { show: false, sql: '', params: [], resolve: null }
  if (resolve) resolve(values)
}

function submit() {
  const values = {}
  for (const param of sqlParamsDialog.value.params) {
    values[param.name] = param.value ?? ''
  }
  finish(values)
}

function cancel() {
  finish(null)
}
</script>
