<template>
  <div
    v-if="showGroupDialog"
    v-modal-shell="{ onClose: closeGroupDialog, closeOnOutside: false }"
    class="dialog-overlay"
  >
    <div class="dialog">
      <div class="dialog-header">
        <h3>{{ editingGroup ? t('编辑分组') : t('新建分组') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeGroupDialog">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content">
        <div class="form-group">
          <label>{{ t('分组名称') }}</label>
          <AppInput v-model="newGroupName" type="text" :placeholder="t('分组名称')" />
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

import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
const databaseStore = inject('database')
const { closeGroupDialog, editingGroup, newGroupName, saveGroup, showGroupDialog } = databaseStore
</script>
