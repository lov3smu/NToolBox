<template>
  <div v-if="sqlParamsDialog.show" v-modal-shell="{ onClose: cancel, closeOnOutside: false }" class="dialog-overlay">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>{{ t('SQL 参数赋值') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="cancel">
          <AppIcon name="close" />
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
            <AppInput
              v-model="param.value"
              class="sql-param-input"
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

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
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
