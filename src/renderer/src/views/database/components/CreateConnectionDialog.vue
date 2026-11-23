<template>
  <div v-if="showCreateDialog" class="dialog-overlay">
    <div class="dialog">
      <div class="dialog-header">
        <h3>{{ t('新建连接') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeCreateDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-tabs">
        <div :class="['dialog-tab', { active: createDialogTab === 'basic' }]" @click="createDialogTab = 'basic'">
          {{ t('常规') }}
        </div>
        <div :class="['dialog-tab', { active: createDialogTab === 'advanced' }]" @click="createDialogTab = 'advanced'">
          {{ t('高级') }}
        </div>
      </div>
      <div class="dialog-content">
        <template v-if="createDialogTab === 'basic'">
          <div class="form-inline-group">
            <label class="form-label-inline">{{ t('连接名称') }}</label>
            <input v-model="newConnection.name" type="text" class="input-field-inline" :placeholder="t('连接名称')" />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">{{ t('主机地址') }}</label>
            <input
              v-model="newConnection.host"
              type="text"
              class="input-field-inline"
              placeholder="localhost"
              @blur="onHostBlur"
            />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">{{ t('端口') }}</label>
            <input
              v-model="newConnection.port"
              type="number"
              class="input-field-inline input-port"
              placeholder="3306"
            />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">{{ t('用户名') }}</label>
            <input
              v-model="newConnection.user"
              type="text"
              class="input-field-inline input-username"
              placeholder="root"
            />
          </div>
          <div class="form-inline-group">
            <label class="form-label-inline">{{ t('密码') }}</label>
            <input
              v-model="newConnection.password"
              type="password"
              class="input-field-inline input-password"
              :placeholder="t('密码')"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="newConnection.savePassword" type="checkbox" />
              <span>{{ t('保存密码') }}</span>
            </label>
          </div>
        </template>
        <template v-if="createDialogTab === 'advanced'">
          <div class="form-inline-group">
            <label class="form-label-inline">{{ t('客户端字符集') }}</label>
            <select v-model="newConnection.charset" class="input-field-inline">
              <option value="">{{ t('自动') }}</option>
              <option value="utf8mb4">utf8mb4</option>
              <option value="utf8">utf8</option>
              <option value="latin1">latin1</option>
              <option value="gbk">gbk</option>
              <option value="gb2312">gb2312</option>
            </select>
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="newConnection.enableKeepAlive" type="checkbox" />
              <span>{{ t('保持连接间隔（秒）') }}</span>
            </label>
            <input
              v-model="newConnection.keepAliveInterval"
              type="number"
              class="input-field-inline"
              :disabled="!newConnection.enableKeepAlive"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="newConnection.enableConnectTimeout" type="checkbox" />
              <span>{{ t('连接超时（秒）') }}</span>
            </label>
            <input
              v-model="newConnection.connectTimeout"
              type="number"
              class="input-field-inline"
              :disabled="!newConnection.enableConnectTimeout"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="newConnection.enableReadTimeout" type="checkbox" />
              <span>{{ t('读取超时（秒）') }}</span>
            </label>
            <input
              v-model="newConnection.readTimeout"
              type="number"
              class="input-field-inline"
              :disabled="!newConnection.enableReadTimeout"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="newConnection.enableWriteTimeout" type="checkbox" />
              <span>{{ t('写入超时（秒）') }}</span>
            </label>
            <input
              v-model="newConnection.writeTimeout"
              type="number"
              class="input-field-inline"
              :disabled="!newConnection.enableWriteTimeout"
            />
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="newConnection.autoConnect" type="checkbox" />
              <span>{{ t('自动连接') }}</span>
            </label>
          </div>
          <div class="form-inline-group">
            <label class="checkbox-label-inline">
              <input v-model="newConnection.readOnly" type="checkbox" />
              <span>{{ t('只读连接') }}</span>
            </label>
            <div class="setting-hint">{{ t('只读连接禁止执行写入与结构变更，查询与状态面板不受影响') }}</div>
          </div>
          <ConnectionNetworkFields v-model="newConnection" />
        </template>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <button class="btn btn-secondary" :disabled="testingNewConn" @click="testNewConnection">
            {{ testingNewConn ? t('测试中...') : t('测试连接') }}
          </button>
        </div>
        <button class="btn btn-secondary" :disabled="testingNewConn" @click="closeCreateDialog">{{ t('取消') }}</button>
        <button class="btn btn-primary" :disabled="testingNewConn" @click="saveConnection">{{ t('保存') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'
import ConnectionNetworkFields from './ConnectionNetworkFields.vue'

const databaseStore = inject('database')
const {
  closeCreateDialog,
  createDialogTab,
  newConnection,
  onHostBlur,
  saveConnection,
  showCreateDialog,
  testNewConnection,
  testingNewConn
} = databaseStore
</script>
