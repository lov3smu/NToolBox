<template>
  <div v-if="backupDialog.show" class="dialog-overlay" @click.self="closeBackupDialog">
    <div class="dialog backup-dialog">
      <div class="dialog-header">
        <h3>定时备份与导出</h3>
        <div class="health-toolbar">
          <button class="btn btn-secondary btn-sm" :disabled="backupDialog.loading" @click="loadBackupTasks()">
            {{ backupDialog.loading ? '加载中...' : '刷新' }}
          </button>
          <button class="btn-icon btn-sm" title="关闭" @click="closeBackupDialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="dialog-content">
        <div v-if="backupDialog.error" class="health-error">{{ backupDialog.error }}</div>
        <div class="backup-layout">
          <section class="backup-task-pane">
            <div class="backup-pane-title">
              任务
              <span class="health-count">{{ backupDialog.tasks.length }}</span>
              <button class="btn btn-secondary btn-sm" @click="resetBackupForm()">新建</button>
            </div>
            <div v-if="!backupDialog.tasks.length" class="backup-empty">
              {{ backupDialog.loading ? '正在加载任务...' : '暂无定时备份任务，右侧可创建第一个任务' }}
            </div>
            <div
              v-for="task in backupDialog.tasks"
              :key="task.id"
              class="backup-task"
              :class="{ active: backupDialog.form.id === task.id }"
            >
              <div class="backup-task-head">
                <span class="backup-task-name" :title="task.name">{{ task.name }}</span>
                <span :class="['backup-chip', task.enabled ? 'ok' : 'muted']">{{
                  task.enabled ? '启用' : '停用'
                }}</span>
              </div>
              <div class="backup-task-meta">
                {{ task.connection }} / {{ task.database }}{{ task.table ? '.' + task.table : '' }} ·
                {{ formatLabel(task.format) }}
              </div>
              <div class="backup-task-meta">
                {{ backupTaskScheduleText(task) }} · 下次 {{ backupTaskNextText(task) || '—' }}
              </div>
              <div class="backup-task-status">
                <span v-if="!task.lastStatus" class="backup-chip muted">未运行</span>
                <span v-else :class="['backup-chip', task.lastStatus === 'success' ? 'ok' : 'warn']">
                  {{ task.lastStatus === 'success' ? '上次成功' : '上次失败' }}
                </span>
                <span v-if="task.lastRunAt">{{ formatTime(task.lastRunAt) }}</span>
                <span v-if="task.lastFile" class="backup-task-name" :title="task.lastFile">
                  → {{ baseName(task.lastFile) }}
                </span>
              </div>
              <div v-if="task.lastError" class="backup-task-meta">{{ task.lastError }}</div>
              <div class="backup-task-actions">
                <button class="btn btn-secondary" @click="editBackupTask(task)">编辑</button>
                <button
                  class="btn btn-secondary"
                  :disabled="!!backupDialog.runningId || !task.enabled"
                  @click="runBackupTask(task)"
                >
                  {{ backupDialog.runningId === task.id ? '运行中...' : '立即运行' }}
                </button>
                <button class="btn btn-secondary" @click="removeBackupTask(task)">删除</button>
              </div>
            </div>
          </section>

          <section class="backup-form-pane">
            <div class="health-section-title">
              {{ backupDialog.form.id ? '编辑任务' : '新建任务' }}
              <span class="health-count">{{ backupDialog.form.id ? '修改' : '新' }}</span>
            </div>
            <div class="backup-form-grid">
              <div class="backup-field">
                <label>任务名称</label>
                <input v-model="backupDialog.form.name" class="input-field-inline" placeholder="例如：订单库每日备份" />
              </div>
              <div class="backup-field">
                <label>连接</label>
                <select v-model="backupDialog.form.connection" class="input-field-inline">
                  <option value="">请选择连接</option>
                  <option v-for="conn in connections" :key="conn.name" :value="conn.name">{{ conn.name }}</option>
                </select>
              </div>
              <div class="backup-field">
                <label>数据库</label>
                <input v-model="backupDialog.form.database" class="input-field-inline" placeholder="数据库名" />
              </div>
              <div class="backup-field">
                <label>表（可选）</label>
                <input v-model="backupDialog.form.table" class="input-field-inline" placeholder="留空表示整个数据库" />
              </div>
              <div class="backup-field">
                <label>导出格式</label>
                <select v-model="backupDialog.form.format" class="input-field-inline">
                  <option v-for="item in BACKUP_FORMATS" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </div>
              <div class="backup-field">
                <label>调度方式</label>
                <select v-model="backupDialog.form.mode" class="input-field-inline">
                  <option v-for="item in BACKUP_SCHEDULE_MODES" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </option>
                </select>
              </div>
              <div class="backup-field">
                <label>{{ backupDialog.form.mode === 'interval' ? '间隔（分钟）' : '执行时间' }}</label>
                <input
                  v-if="backupDialog.form.mode === 'interval'"
                  v-model.number="backupDialog.form.intervalMinutes"
                  type="number"
                  min="5"
                  max="10080"
                  class="input-field-inline"
                />
                <input v-else v-model="backupDialog.form.time" type="time" class="input-field-inline" />
              </div>
              <div class="backup-field">
                <label>单表最大行数</label>
                <input
                  v-model.number="backupDialog.form.maxRows"
                  type="number"
                  min="100"
                  max="1000000"
                  class="input-field-inline"
                />
              </div>
              <div class="backup-field wide">
                <label>备份目录</label>
                <div class="backup-field-row">
                  <input
                    v-model="backupDialog.form.directory"
                    class="input-field-inline"
                    :placeholder="backupDialog.defaultDirectory"
                  />
                  <button class="btn btn-secondary btn-sm" @click="pickBackupDirectory">选择目录</button>
                </div>
              </div>
              <div class="backup-field wide">
                <label class="backup-toggle">
                  <input v-model="backupDialog.form.enabled" type="checkbox" />
                  启用任务（关闭后不会自动执行）
                </label>
              </div>
            </div>
            <div class="backup-form-actions">
              <button class="btn btn-secondary" @click="resetBackupForm()">清空表单</button>
              <button class="btn btn-primary" :disabled="backupDialog.saving" @click="saveBackupForm">
                {{ backupDialog.saving ? '保存中...' : backupDialog.form.id ? '保存修改' : '创建任务' }}
              </button>
            </div>
          </section>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-primary" @click="closeBackupDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { BACKUP_FORMATS, BACKUP_SCHEDULE_MODES } from '@shared/backupTasks'

const databaseStore = inject('database')
const {
  backupDialog,
  connections,
  closeBackupDialog,
  editBackupTask,
  loadBackupTasks,
  pickBackupDirectory,
  removeBackupTask,
  resetBackupForm,
  runBackupTask,
  saveBackupForm,
  backupTaskScheduleText,
  backupTaskNextText
} = databaseStore

function formatLabel(value) {
  return BACKUP_FORMATS.find((item) => item.value === value)?.label || value
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function baseName(filePath) {
  return (
    String(filePath || '')
      .split(/[\\/]/)
      .pop() || filePath
  )
}
</script>
