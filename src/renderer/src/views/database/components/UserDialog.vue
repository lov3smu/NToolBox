<template>
  <div v-if="userDialog.show" class="dialog-overlay" @click.self="closeUserDialog">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>数据库用户</h3>
        <div class="dialog-header-actions">
          <button class="btn btn-sm btn-secondary" :disabled="userDialog.loading" @click="loadUsers">刷新</button>
          <button class="btn-icon btn-sm" title="关闭" @click="closeUserDialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="dialog-content user-dialog-content">
        <div class="user-session">
          <span class="user-session-label">当前会话</span>
          <span class="user-session-value">{{ userDialog.sessionUser || '-' }}</span>
          <span class="user-session-label">认证用户</span>
          <span class="user-session-value">{{ userDialog.currentUser || '-' }}</span>
        </div>
        <input v-model="userDialog.keyword" type="text" class="input-field" placeholder="筛选用户名或主机" autofocus />
        <div v-if="userDialog.error" class="dialog-alert error">{{ userDialog.error }}</div>
        <div v-else-if="userDialog.loading" class="user-list-empty">加载中...</div>
        <div v-else-if="filteredUsers.length === 0" class="user-list-empty">
          {{ userDialog.keyword ? '没有匹配的用户' : '暂无用户' }}
        </div>
        <div v-else class="user-list">
          <div class="user-list-header">
            <span class="user-col-name">用户</span>
            <span class="user-col-host">主机</span>
            <span class="user-col-actions">操作</span>
          </div>
          <div v-for="user in filteredUsers" :key="`${user.user}@${user.host}`" class="user-row">
            <span class="user-col-name" :title="user.user">{{ user.user || '(匿名)' }}</span>
            <span class="user-col-host" :title="user.host">{{ user.host || '-' }}</span>
            <span class="user-col-actions">
              <button class="btn btn-xs btn-secondary" @click="copyUserAccount(user)">复制账户</button>
            </span>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <span class="dialog-footer-hint">
          共 {{ userDialog.users.length }} 个用户
          <span v-if="userDialog.source === 'information_schema'">· 数据来自 information_schema</span>
        </span>
        <button class="btn btn-primary" @click="closeUserDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const { closeUserDialog, copyUserAccount, loadUsers, userDialog } = databaseStore

const filteredUsers = computed(() => {
  const keyword = userDialog.value.keyword.trim().toLowerCase()
  if (!keyword) return userDialog.value.users
  return userDialog.value.users.filter(
    (user) =>
      String(user.user || '')
        .toLowerCase()
        .includes(keyword) ||
      String(user.host || '')
        .toLowerCase()
        .includes(keyword)
  )
})
</script>
