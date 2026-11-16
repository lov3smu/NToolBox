<template>
  <div v-if="userDialog.show" class="dialog-overlay" @click.self="closeUserDialog">
    <div class="dialog dialog-wide user-dialog">
      <div class="dialog-header">
        <h3>
          数据库用户 ·
          <span class="user-connection">{{ userDialog.connectionName }}</span>
        </h3>
        <div class="dialog-header-actions">
          <span v-if="userDialog.loading" class="user-hint">刷新中…</span>
          <button class="btn btn-sm btn-secondary" :disabled="userDialog.loading" @click="loadUsers">刷新</button>
          <button class="btn btn-sm btn-primary" :disabled="userDialog.actionLoading" @click="openUserForm('create')">
            新建用户
          </button>
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
        <div v-if="userDialog.error" class="dialog-alert error">{{ userDialog.error }}</div>
        <div class="user-dialog-body">
          <div class="user-pane">
            <input
              v-model="userDialog.keyword"
              type="text"
              class="input-field user-search"
              placeholder="筛选用户名或主机"
              autofocus
            />
            <div v-if="userDialog.loading" class="user-list-empty">加载中...</div>
            <div v-else-if="filteredUsers.length === 0" class="user-list-empty">
              {{ userDialog.keyword ? '没有匹配的用户' : '暂无用户' }}
            </div>
            <div v-else class="user-list">
              <button
                v-for="user in filteredUsers"
                :key="`${user.user}@${user.host}`"
                :class="['user-row', 'user-row-button', { active: isSelected(user) }]"
                @click="selectUser(user)"
              >
                <span class="user-col-name" :title="user.user">{{ user.user || '(匿名)' }}</span>
                <span class="user-col-host" :title="user.host">{{ user.host || '-' }}</span>
                <span v-if="isSelf(user)" class="user-self-badge">当前</span>
              </button>
            </div>
          </div>

          <div class="user-detail">
            <div v-if="!userDialog.selected" class="user-list-empty user-detail-empty">选择左侧用户查看权限并编辑</div>
            <template v-else>
              <div class="user-detail-header">
                <div class="user-detail-title" :title="accountLabel">{{ accountLabel }}</div>
                <div class="user-detail-actions">
                  <button
                    class="btn btn-xs btn-secondary"
                    :disabled="userDialog.actionLoading"
                    @click="openUserForm('grant')"
                  >
                    授权
                  </button>
                  <button
                    class="btn btn-xs btn-secondary"
                    :disabled="userDialog.actionLoading"
                    @click="openUserForm('password')"
                  >
                    修改密码
                  </button>
                  <button
                    class="btn btn-xs btn-secondary"
                    :disabled="userDialog.actionLoading"
                    @click="copyUserAccount(userDialog.selected)"
                  >
                    复制账户
                  </button>
                  <button
                    class="btn btn-xs btn-secondary danger"
                    :disabled="userDialog.actionLoading"
                    @click="deleteSelectedUser"
                  >
                    删除
                  </button>
                </div>
              </div>

              <div v-if="userDialog.form.mode" class="user-form">
                <div v-if="userDialog.form.mode === 'create'" class="user-form-grid">
                  <label class="user-form-field">
                    <span>用户名</span>
                    <input v-model="userDialog.form.user" type="text" class="input-field" placeholder="如 app_user" />
                  </label>
                  <label class="user-form-field">
                    <span>主机</span>
                    <input v-model="userDialog.form.host" type="text" class="input-field" placeholder="%" />
                  </label>
                  <label class="user-form-field">
                    <span>密码</span>
                    <input
                      v-model="userDialog.form.password"
                      type="password"
                      class="input-field"
                      autocomplete="new-password"
                    />
                  </label>
                </div>

                <div v-else-if="userDialog.form.mode === 'password'" class="user-form-grid">
                  <label class="user-form-field">
                    <span>新密码</span>
                    <input
                      v-model="userDialog.form.password"
                      type="password"
                      class="input-field"
                      autocomplete="new-password"
                    />
                  </label>
                </div>

                <div v-else class="user-form-grant">
                  <div class="user-form-grid">
                    <label class="user-form-field">
                      <span>范围</span>
                      <select v-model="userDialog.form.scope" class="select-field">
                        <option value="global">全局 (*.*)</option>
                        <option value="database">数据库 (db.*)</option>
                        <option value="table">表 (db.table)</option>
                      </select>
                    </label>
                    <label v-if="userDialog.form.scope !== 'global'" class="user-form-field">
                      <span>数据库</span>
                      <input
                        v-model="userDialog.form.database"
                        type="text"
                        class="input-field"
                        list="user-db-options"
                        placeholder="数据库名"
                      />
                    </label>
                    <label v-if="userDialog.form.scope === 'table'" class="user-form-field">
                      <span>表</span>
                      <input v-model="userDialog.form.table" type="text" class="input-field" placeholder="表名" />
                    </label>
                  </div>
                  <div class="user-privilege-grid">
                    <button
                      v-for="privilege in privileges"
                      :key="privilege"
                      :class="['privilege-chip', { active: hasPrivilege(privilege) }]"
                      @click="toggleUserPrivilege(privilege)"
                    >
                      {{ privilege }}
                    </button>
                  </div>
                </div>

                <div class="user-form-actions">
                  <template v-if="userDialog.form.mode === 'grant'">
                    <button
                      class="btn btn-sm btn-primary"
                      :disabled="userDialog.actionLoading"
                      @click="submitUserForm('grant')"
                    >
                      授予
                    </button>
                    <button
                      class="btn btn-sm btn-secondary"
                      :disabled="userDialog.actionLoading"
                      @click="submitUserForm('revoke')"
                    >
                      撤销
                    </button>
                  </template>
                  <button
                    v-else
                    class="btn btn-sm btn-primary"
                    :disabled="userDialog.actionLoading"
                    @click="submitUserForm()"
                  >
                    {{ userDialog.form.mode === 'create' ? '创建' : '保存' }}
                  </button>
                  <button class="btn btn-sm btn-secondary" :disabled="userDialog.actionLoading" @click="closeUserForm">
                    取消
                  </button>
                </div>
                <datalist id="user-db-options">
                  <option v-for="database in databases" :key="database" :value="database" />
                </datalist>
              </div>

              <div class="user-grants">
                <div class="user-grants-title">权限（SHOW GRANTS）</div>
                <div v-if="userDialog.grantsLoading" class="user-list-empty">加载中...</div>
                <div v-else-if="userDialog.grantsError" class="dialog-alert error">{{ userDialog.grantsError }}</div>
                <div v-else-if="userDialog.grants.length === 0" class="user-list-empty">没有查询到权限</div>
                <code v-for="(grant, index) in userDialog.grants" :key="index" class="user-grant-line">
                  {{ grant }}
                </code>
              </div>
            </template>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <span class="dialog-footer-hint">
          共 {{ userDialog.users.length }} 个用户
          <span v-if="userDialog.source === 'information_schema'">
            · 数据来自 information_schema（缺少 mysql.user 读取权限）
          </span>
        </span>
        <button class="btn btn-primary" @click="closeUserDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const {
  userDialog,
  databases,
  closeUserDialog,
  copyUserAccount,
  loadUsers,
  selectUser,
  openUserForm,
  closeUserForm,
  toggleUserPrivilege,
  submitUserForm,
  deleteSelectedUser
} = databaseStore

const privileges = [
  'ALL PRIVILEGES',
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'DROP',
  'ALTER',
  'INDEX',
  'CREATE VIEW',
  'SHOW VIEW',
  'TRIGGER',
  'EXECUTE',
  'REFERENCES',
  'CREATE ROUTINE',
  'ALTER ROUTINE'
]

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

const accountLabel = computed(() => {
  const user = userDialog.value.selected
  return user ? `'${user.user}'@'${user.host}'` : ''
})

function isSelected(user) {
  const selected = userDialog.value.selected
  return Boolean(selected && selected.user === user.user && selected.host === user.host)
}

function isSelf(user) {
  return userDialog.value.currentUser === `${user.user}@${user.host}`
}

function hasPrivilege(privilege) {
  return userDialog.value.form.privileges.includes(privilege)
}
</script>
