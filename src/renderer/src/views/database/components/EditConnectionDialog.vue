<template>
  <div v-if="showEditDialog" class="dialog-overlay" @click.self="closeEditDialog">
    <div class="dialog">
      <div class="dialog-header">
        <h3>编辑连接</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeEditDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-tabs">
        <div :class="['dialog-tab', { active: editDialogTab === 'basic' }]" @click="editDialogTab = 'basic'">常规</div>
        <div :class="['dialog-tab', { active: editDialogTab === 'advanced' }]" @click="editDialogTab = 'advanced'">
          高级
        </div>
      </div>
      <div class="dialog-content">
        <template v-if="editDialogTab === 'basic'">
          <div class="form-inline-group">
            <label class="form-label-inline">连接名称</label>
            <input v-model="editingConnection.name" type="text" class="input-field-inline" placeholder="连接名称" />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">所属分组</label>
            <select v-model="editingConnection.group" class="input-field-inline">
              <option value="">不分组</option>
              <option v-for="g in groups" :key="g" :value="g">
                {{ g }}
              </option>
            </select>
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">主机地址</label>
            <input v-model="editingConnection.host" type="text" class="input-field-inline" placeholder="localhost" />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">端口</label>
            <input
              v-model="editingConnection.port"
              type="number"
              class="input-field-inline input-port"
              placeholder="3306"
            />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">用户名</label>
            <input
              v-model="editingConnection.user"
              type="text"
              class="input-field-inline input-username"
              placeholder="root"
            />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">密码</label>
            <input
              v-model="editingConnection.password"
              type="password"
              class="input-field-inline input-password"
              placeholder="密码"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="editingConnection.savePassword" type="checkbox" />
              <span>保存密码</span>
            </label>
          </div>
        </template>
        <template v-if="editDialogTab === 'advanced'">
          <div class="form-inline-group">
            <label class="form-label-inline">客户端字符集</label>
            <select v-model="editingConnection.charset" class="input-field-inline">
              <option value="">自动</option>
              <option value="utf8mb4">utf8mb4</option>
              <option value="utf8">utf8</option>
              <option value="latin1">latin1</option>
              <option value="gbk">gbk</option>
              <option value="gb2312">gb2312</option>
            </select>
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="editingConnection.enableKeepAlive" type="checkbox" />
              <span>保持连接间隔（秒）</span>
            </label>
            <input
              v-model="editingConnection.keepAliveInterval"
              type="number"
              class="input-field-inline"
              :disabled="!editingConnection.enableKeepAlive"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="editingConnection.enableConnectTimeout" type="checkbox" />
              <span>连接超时（秒）</span>
            </label>
            <input
              v-model="editingConnection.connectTimeout"
              type="number"
              class="input-field-inline"
              :disabled="!editingConnection.enableConnectTimeout"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="editingConnection.enableReadTimeout" type="checkbox" />
              <span>读取超时（秒）</span>
            </label>
            <input
              v-model="editingConnection.readTimeout"
              type="number"
              class="input-field-inline"
              :disabled="!editingConnection.enableReadTimeout"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="editingConnection.enableWriteTimeout" type="checkbox" />
              <span>写入超时（秒）</span>
            </label>
            <input
              v-model="editingConnection.writeTimeout"
              type="number"
              class="input-field-inline"
              :disabled="!editingConnection.enableWriteTimeout"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="editingConnection.autoConnect" type="checkbox" />
              <span>自动连接</span>
            </label>
          </div>
        </template>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <button class="btn btn-secondary" :disabled="testingEditConn" @click="testEditConnection">
            {{ testingEditConn ? '测试中...' : '测试连接' }}
          </button>
        </div>
        <div class="dialog-footer-right">
          <button class="btn btn-secondary" :disabled="testingEditConn" @click="closeEditDialog">取消</button>
          <button class="btn btn-primary" :disabled="testingEditConn" @click="updateConnection">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const {
  closeEditDialog,
  editDialogTab,
  editingConnection,
  groups,
  showEditDialog,
  testEditConnection,
  testingEditConn,
  updateConnection
} = databaseStore
</script>
