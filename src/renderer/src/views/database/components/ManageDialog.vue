<template>
  <div v-if="showManageDialog" v-modal-shell="closeManageDialog" class="dialog-overlay" @click.self="closeManageDialog">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>{{ t('连接管理') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeManageDialog">
          <AppIcon name="close" />
        </button>
      </div>
      <div class="dialog-content manage-content">
        <div class="manage-list">
          <div class="manage-header">
            <span>{{ t('分组管理') }}</span>
            <button class="btn btn-primary btn-sm" @click="openNewGroupDialog">{{ t('新建分组') }}</button>
          </div>
          <div class="manage-groups">
            <div v-for="group in connectionGroups" :key="group.name" class="manage-group-item">
              <span>{{ group.name }} ({{ group.connections.length }}{{ t('个连接)') }}</span>
              <div class="manage-group-actions">
                <button class="btn-icon btn-sm" :title="t('编辑')" @click="editGroup(group)">
                  <AppIcon name="edit" />
                </button>
                <button class="btn-icon btn-sm btn-icon-danger" :title="t('删除')" @click="deleteGroup(group.name)">
                  <AppIcon name="trash" />
                </button>
              </div>
            </div>
            <div v-if="connectionGroups.length === 0" class="manage-empty">{{ t('暂无分组') }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const { closeManageDialog, connectionGroups, deleteGroup, editGroup, openNewGroupDialog, showManageDialog } =
  databaseStore
</script>
