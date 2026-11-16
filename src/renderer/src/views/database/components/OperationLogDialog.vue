<template>
  <div v-if="operationLogDialog.show" class="dialog-overlay" @click.self="closeOperationLog">
    <div class="dialog oplog-dialog">
      <div class="dialog-header">
        <h3>数据库操作日志</h3>
        <div class="health-toolbar">
          <button class="btn btn-secondary btn-sm" :disabled="operationLogDialog.loading" @click="loadOperationLog()">
            {{ operationLogDialog.loading ? '读取中...' : '刷新' }}
          </button>
          <button class="btn-icon btn-sm" title="关闭" @click="closeOperationLog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="dialog-content">
        <div class="oplog-toolbar">
          <select
            v-model="operationLogDialog.connection"
            class="input-field-inline oplog-connection"
            @change="loadOperationLog()"
          >
            <option value="">全部连接</option>
            <option v-for="conn in connections" :key="conn.name" :value="conn.name">{{ conn.name }}</option>
          </select>
          <input
            v-model="operationLogDialog.keyword"
            class="input-field-inline oplog-search"
            placeholder="搜索 SQL / 数据库 / 表"
            @keydown.enter="loadOperationLog()"
          />
          <button class="btn btn-secondary btn-sm" :disabled="operationLogDialog.loading" @click="loadOperationLog()">
            查询
          </button>
          <span class="oplog-count">最近 {{ operationLogDialog.entries.length }} 条</span>
          <button
            class="btn btn-secondary btn-sm"
            :disabled="operationLogDialog.clearing || !operationLogDialog.entries.length"
            @click="clearOperationLog"
          >
            {{ operationLogDialog.clearing ? '清空中...' : '清空日志' }}
          </button>
        </div>

        <div v-if="operationLogDialog.error" class="health-error">{{ operationLogDialog.error }}</div>
        <div v-else-if="operationLogDialog.loading && !operationLogDialog.entries.length" class="health-loading">
          正在读取操作日志...
        </div>
        <div v-else-if="!operationLogDialog.entries.length" class="oplog-empty">
          暂无操作日志。执行写入类 SQL（INSERT / UPDATE / DELETE / DDL）后会自动记录。
        </div>
        <div v-else class="oplog-table-wrap">
          <table class="oplog-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>连接</th>
                <th>数据库</th>
                <th>表</th>
                <th>结果</th>
                <th class="num">行数</th>
                <th class="num">耗时</th>
                <th>SQL</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(entry, index) in operationLogDialog.entries" :key="index">
                <td class="oplog-time">{{ formatTime(entry.time) }}</td>
                <td class="oplog-action">{{ entry.action || 'SQL' }}</td>
                <td :title="entry.connection">{{ entry.connection || '—' }}</td>
                <td>{{ entry.database || '—' }}</td>
                <td>{{ entry.table || '—' }}</td>
                <td>
                  <span v-if="entry.readonlyBlocked" class="oplog-chip blocked">只读拦截</span>
                  <span v-else :class="['oplog-chip', entry.success ? 'ok' : 'fail']">
                    {{ entry.success ? '成功' : '失败' }}
                  </span>
                </td>
                <td class="num">{{ entry.rows || '—' }}</td>
                <td class="num">{{ entry.duration ? `${entry.duration} ms` : '—' }}</td>
                <td>
                  <div class="oplog-sql" :title="entry.error ? `${entry.sql}\n${entry.error}` : entry.sql">
                    {{ entry.sql || '—' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-primary" @click="closeOperationLog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { operationLogDialog, connections, clearOperationLog, closeOperationLog, loadOperationLog } = databaseStore

function formatTime(timestamp) {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`
}
</script>
