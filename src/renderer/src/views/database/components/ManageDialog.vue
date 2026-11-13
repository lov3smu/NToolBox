<template>
  <div v-if="showManageDialog" class="dialog-overlay" @click.self="closeManageDialog">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>连接管理</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeManageDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content manage-content">
        <div class="manage-list">
          <div class="manage-header">
            <span>分组管理</span>
            <button class="btn btn-primary btn-sm" @click="openNewGroupDialog">新建分组</button>
          </div>
          <div class="manage-groups">
            <div v-for="group in connectionGroups" :key="group.name" class="manage-group-item">
              <span>{{ group.name }} ({{ group.connections.length }}个连接)</span>
              <div class="manage-group-actions">
                <button class="btn-icon btn-sm" title="编辑" @click="editGroup(group)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button class="btn-icon btn-sm btn-icon-danger" title="删除" @click="deleteGroup(group.name)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
            <div v-if="connectionGroups.length === 0" class="manage-empty">暂无分组</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { closeManageDialog, connectionGroups, deleteGroup, editGroup, openNewGroupDialog, showManageDialog } =
  databaseStore
</script>
