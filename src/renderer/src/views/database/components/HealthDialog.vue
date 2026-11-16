<template>
  <div v-if="healthDialog.show" class="dialog-overlay" @click.self="closeHealthDialog">
    <div class="dialog health-dialog">
      <div class="dialog-header">
        <h3>容量与健康 · {{ healthDialog.connectionName }}</h3>
        <div class="health-toolbar">
          <select
            class="input-field-inline health-db-select"
            :value="healthDialog.database"
            :disabled="healthDialog.loading"
            @change="changeHealthDatabase($event.target.value)"
          >
            <option v-for="db in healthDialog.databases" :key="db" :value="db">{{ db }}</option>
          </select>
          <button class="btn btn-secondary btn-sm" :disabled="healthDialog.loading" @click="loadHealth()">
            {{ healthDialog.loading ? '检查中...' : '重新检查' }}
          </button>
          <button class="btn-icon btn-sm" title="关闭" @click="closeHealthDialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="dialog-content">
        <div v-if="healthDialog.error" class="health-error">{{ healthDialog.error }}</div>
        <div v-else-if="healthDialog.loading && !healthResult" class="health-loading">正在收集容量与健康数据...</div>
        <template v-else-if="healthResult">
          <div class="health-card-grid">
            <div class="health-card">
              <div class="health-card-label">数据量</div>
              <div class="health-card-value">{{ formatBytes(healthResult.totals.dataLength) }}</div>
              <div class="health-card-hint">
                表 {{ formatCount(healthResult.totals.tableCount) }} · 视图
                {{ formatCount(healthResult.totals.viewCount) }} · 估算行数
                {{ formatCount(healthResult.totals.rowEstimate) }}
              </div>
            </div>
            <div class="health-card">
              <div class="health-card-label">索引量</div>
              <div class="health-card-value">{{ formatBytes(healthResult.totals.indexLength) }}</div>
              <div class="health-card-hint">总占用 {{ formatBytes(healthResult.totals.totalLength) }}</div>
            </div>
            <div class="health-card">
              <div class="health-card-label">可回收空间</div>
              <div class="health-card-value">{{ formatBytes(healthResult.totals.dataFree) }}</div>
              <div class="health-card-hint">碎片整理后可由 OPTIMIZE TABLE 回收</div>
            </div>
            <div class="health-card">
              <div class="health-card-label">检查项</div>
              <div class="health-card-value">{{ healthResult.issues.length }}</div>
              <div class="health-card-hint">警告 {{ warnCount }} · 提示 {{ infoCount }}</div>
            </div>
          </div>

          <section class="health-section">
            <div class="health-section-title">
              健康检查
              <span class="health-count">{{ healthResult.issues.length }}</span>
            </div>
            <div v-if="!healthResult.issues.length" class="health-empty">未发现明显的结构或配置问题</div>
            <div v-else class="health-issues">
              <div v-for="(issue, index) in healthResult.issues" :key="index" class="health-issue">
                <span :class="['health-issue-level', issue.level]">{{ issue.level === 'warn' ? '警告' : '提示' }}</span>
                <div class="health-issue-body">
                  <div class="health-issue-title">
                    {{ issue.title }}
                    <span v-if="issue.table" class="health-issue-table">{{ issue.table }}</span>
                    <span v-else-if="issue.scope === 'server'" class="health-issue-table">实例</span>
                  </div>
                  <div class="health-issue-detail">{{ issue.detail }}</div>
                </div>
              </div>
            </div>
          </section>

          <section class="health-section">
            <div class="health-section-title">
              表容量
              <span class="health-count">{{ formatCount(healthResult.totals.tableCount) }}</span>
            </div>
            <div v-if="!healthResult.tables.length" class="health-empty">该数据库暂无数据表</div>
            <div v-else class="health-table-wrap">
              <table class="health-table">
                <thead>
                  <tr>
                    <th>表</th>
                    <th>引擎</th>
                    <th class="num">估算行数</th>
                    <th class="num">数据</th>
                    <th class="num">索引</th>
                    <th class="num">可回收</th>
                    <th>主键</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="table in healthResult.tables" :key="table.name">
                    <td class="health-table-name" :title="table.comment || table.name">{{ table.name }}</td>
                    <td>{{ table.engine || '—' }}</td>
                    <td class="num">{{ formatCount(table.rowEstimate) }}</td>
                    <td class="num">{{ formatBytes(table.dataLength) }}</td>
                    <td class="num">{{ formatBytes(table.indexLength) }}</td>
                    <td class="num" :class="{ 'health-warn-text': needsOptimize(table) }">
                      {{ formatBytes(table.dataFree) }}
                    </td>
                    <td>
                      <span :class="['health-chip', table.hasPrimaryKey ? 'ok' : 'warn']">
                        {{ table.hasPrimaryKey ? '有' : '无' }}
                      </span>
                    </td>
                    <td>
                      <button
                        v-if="needsOptimize(table)"
                        class="btn btn-secondary btn-sm health-optimize"
                        :disabled="healthDialog.loading"
                        @click="optimizeHealthTable(table.name)"
                      >
                        优化
                      </button>
                      <span v-else class="health-na">—</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div class="health-server-row">
            <span class="health-server-item">
              <span class="health-server-label">binlog</span>
              <span :class="['health-chip', healthResult.server.binlog ? 'ok' : 'warn']">
                {{ healthResult.server.binlog ? '开启' : '关闭' }}
              </span>
            </span>
            <span class="health-server-item">
              <span class="health-server-label">慢查询日志</span>
              <span :class="['health-chip', healthResult.server.slowQueryLog ? 'ok' : 'warn']">
                {{ healthResult.server.slowQueryLog ? '开启' : '关闭' }}
              </span>
              <span v-if="healthResult.server.slowQueryLog" class="health-server-value">
                {{ healthResult.server.longQueryTime }}s
              </span>
            </span>
            <span class="health-server-item">
              <span class="health-server-label">独立表空间</span>
              <span :class="['health-chip', healthResult.server.filePerTable ? 'ok' : 'warn']">
                {{ healthResult.server.filePerTable ? '开启' : '关闭' }}
              </span>
            </span>
            <span class="health-server-item">
              <span class="health-server-label">performance_schema</span>
              <span :class="['health-chip', healthResult.server.performanceSchema ? 'ok' : 'warn']">
                {{ healthResult.server.performanceSchema ? '开启' : '关闭' }}
              </span>
            </span>
            <span class="health-server-item">
              <span class="health-server-label">缓冲池</span>
              <span class="health-server-value">{{ healthResult.server.bufferPoolMb }} MB</span>
            </span>
            <span class="health-server-item">
              <span class="health-server-label">连接使用率</span>
              <span class="health-server-value">
                {{ formatPercent(healthResult.server.connectionUsage) }}（{{ healthResult.server.threadsConnected }} /
                {{ healthResult.server.maxConnections }}）
              </span>
            </span>
          </div>

          <div class="health-meta">
            采样于 {{ formatSampledAt(healthResult.sampledAt) }} · MySQL {{ healthResult.version }} · 认证用户
            {{ healthResult.currentUser }}
          </div>
        </template>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-primary" @click="closeHealthDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const { changeHealthDatabase, closeHealthDialog, healthDialog, loadHealth, optimizeHealthTable } = databaseStore

const healthResult = computed(() => healthDialog.value?.result || null)
const warnCount = computed(() => (healthResult.value?.issues || []).filter((issue) => issue.level === 'warn').length)
const infoCount = computed(() => (healthResult.value?.issues || []).filter((issue) => issue.level === 'info').length)

function needsOptimize(table) {
  return table.dataFree > 1048576 && table.freeRatio >= 0.2
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${Math.round(value)} B`
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-US')
}

function formatPercent(ratio) {
  return `${Math.round((Number(ratio) || 0) * 100)}%`
}

function formatSampledAt(timestamp) {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false })
}
</script>
