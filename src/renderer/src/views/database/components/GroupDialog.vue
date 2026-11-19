<template>
  <div v-if="showGroupDialog" class="dialog-overlay" @click.self="closeGroupDialog">
    <div class="dialog">
      <div class="dialog-header">
        <h3>{{ editingGroup ? t('编辑分组') : t('新建分组') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeGroupDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label>{{ t('分组名称') }}</label>
          <input v-model="newGroupName" type="text" class="input-field" :placeholder="t('分组名称')" />
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="closeGroupDialog">{{ t('取消') }}</button>
        <button class="btn btn-primary" @click="saveGroup">{{ t('保存') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'

const databaseStore = inject('database')
const { closeGroupDialog, editingGroup, newGroupName, saveGroup, showGroupDialog } = databaseStore
</script>
