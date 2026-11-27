<template>
  <div
    v-if="serverStatusDialog.show"
    v-modal-shell="closeServerStatusDialog"
    class="dialog-overlay"
    @click.self="closeServerStatusDialog"
  >
    <div class="dialog dialog-wide server-status-dialog">
      <div class="dialog-header">
        <h3>
          {{ t('实例状态 ·') }}
          <span class="server-status-connection">{{ serverStatusDialog.connectionName }}</span>
        </h3>
        <div class="dialog-header-actions">
          <span v-if="status.version" class="server-status-version">MySQL {{ status.version }}</span>
          <button
            :class="['btn btn-sm', serverStatusDialog.autoRefresh ? 'btn-primary' : 'btn-secondary']"
            @click="toggleAutoRefresh"
          >
            {{ serverStatusDialog.autoRefresh ? t('自动刷新中') : t('自动刷新') }}
          </button>
          <button class="btn btn-sm btn-secondary" :disabled="serverStatusDialog.loading" @click="refreshAll">
            {{ t('刷新') }}
          </button>
          <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeServerStatusDialog">
            <AppIcon name="close" />
          </button>
        </div>
      </div>

      <div class="dialog-content server-status-body">
        <p v-if="serverStatusDialog.error" class="create-table-error">{{ serverStatusDialog.error }}</p>
        <div v-if="!status.success && serverStatusDialog.loading" class="session-hint">
          {{ t('正在读取实例状态…') }}
        </div>

        <template v-if="status.success">
          <div class="status-card-grid">
            <div class="status-card">
              <span class="status-card-label">QPS</span>
              <span class="status-card-value">{{ formatQps(serverStatusDialog.qps) }}</span>
              <span class="status-card-sub"
                >{{ t('累计查询') }} {{ formatInteger(status.questions) }} {{ t('· 平均') }}
                {{ formatQps(status.qpsAvg) }}</span
              >
            </div>
            <div class="status-card">
              <span class="status-card-label">{{ t('连接数') }}</span>
              <span class="status-card-value">
                {{ formatInteger(status.threadsConnected) }}
                <span class="status-card-unit">/ {{ formatInteger(status.maxConnections) }}</span>
              </span>
              <span class="status-card-sub"
                >{{ t('活跃') }} {{ formatInteger(status.threadsRunning) }} {{ t('· 异常中断') }}
                {{ formatInteger(status.abortedConnects) }}</span
              >
            </div>
            <div class="status-card">
              <span class="status-card-label">{{ t('缓存命中率') }}</span>
              <span class="status-card-value">{{ formatRate(status.bufferPool?.hitRate) }}</span>
              <span class="status-card-sub">
                {{ t('缓冲池') }} {{ status.bufferPool?.sizeMb || 0 }} {{ t('MB · 磁盘读') }}
                {{ formatInteger(status.bufferPool?.reads) }}
              </span>
            </div>
            <div class="status-card">
              <span class="status-card-label">{{ t('慢查询') }}</span>
              <span class="status-card-value">{{ formatInteger(status.slowQueries) }}</span>
              <span class="status-card-sub">
                {{ t('近采样 +') }}{{ formatInteger(serverStatusDialog.slowDelta) }} {{ t('· 慢日志') }}
                {{ status.slowQueryLog ? t('开启') : t('关闭') }} {{ t('· 阈值') }}
                {{ formatSeconds(status.longQueryTime) }}
              </span>
            </div>
          </div>

          <div class="status-trend">
            <div class="status-trend-header">
              <span class="status-section-title">{{ t('QPS 趋势') }}</span>
              <span class="status-trend-meta">
                {{ t('最近') }} {{ trendSpanSeconds }} {{ t('秒 · 峰值') }} {{ formatQps(maxQps) }}
              </span>
            </div>
            <div class="status-trend-chart">
              <div v-if="history.length === 0" class="session-hint">{{ t('等待采样…') }}</div>
              <svg v-else viewBox="0 0 600 90" preserveAspectRatio="none" class="status-spark">
                <polygon :points="areaPoints" class="status-spark-area" />
                <polyline :points="linePoints" class="status-spark-line" />
              </svg>
            </div>
          </div>

          <div class="status-slow">
            <div class="status-slow-header">
              <span class="status-section-title">{{ t('慢查询 TOP 10') }}</span>
              <span class="session-hint"
                >{{ t('按总耗时排序 · 来自 performance_schema')
                }}{{ serverStatusDialog.database ? ' · ' + serverStatusDialog.database : '' }}</span
              >
              <button
                class="btn btn-xs btn-secondary"
                :disabled="serverStatusDialog.slowLoading"
                @click="loadSlowQueries"
              >
                {{ t('刷新慢查询') }}
              </button>
            </div>
            <p v-if="serverStatusDialog.slowError" class="create-table-error">{{ serverStatusDialog.slowError }}</p>
            <div v-else-if="serverStatusDialog.slowLoading" class="session-hint">{{ t('正在读取慢查询…') }}</div>
            <div v-else-if="!serverStatusDialog.slowEnabled" class="session-hint">
              {{ serverStatusDialog.slowReason || t('performance_schema 不可用') }}{{ t('，无法展示慢查询排行') }}
            </div>
            <div v-else-if="serverStatusDialog.slowQueries.length === 0" class="session-hint">
              {{ t('暂无慢查询记录') }}
            </div>
            <div v-else class="status-slow-scroll">
              <table class="result-table status-slow-table">
                <thead>
                  <tr>
                    <th>SQL</th>
                    <th>{{ t('次数') }}</th>
                    <th>{{ t('平均耗时') }}</th>
                    <th>{{ t('最大耗时') }}</th>
                    <th>{{ t('扫描行数') }}</th>
                    <th>{{ t('操作') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(query, index) in serverStatusDialog.slowQueries" :key="index">
                    <td class="status-slow-sql" :title="query.sql">{{ query.sql }}</td>
                    <td class="server-mono">{{ formatInteger(query.executions) }}</td>
                    <td class="server-mono">{{ formatMs(query.avgMs) }}</td>
                    <td class="server-mono">{{ formatMs(query.maxMs) }}</td>
                    <td class="server-mono">{{ formatInteger(query.rowsExamined) }}</td>
                    <td>
                      <button class="btn btn-xs btn-secondary" @click="explainSlowQuery(query)">EXPLAIN</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="status-meta">
            <span>{{ t('运行时长') }} {{ formatUptime(status.uptimeSeconds) }}</span>
            <span>{{ t('认证用户') }} {{ status.currentUser || '-' }}</span>
            <span
              >{{ t('缓冲池空闲页') }} {{ formatInteger(status.bufferPool?.pagesFree) }} /
              {{ formatInteger(status.bufferPool?.pagesTotal) }}</span
            >
            <span v-if="status.performanceSchema === false" class="status-meta-warn">{{
              t('performance_schema 已关闭')
            }}</span>
          </div>
        </template>
      </div>

      <div class="dialog-footer">
        <span class="dialog-footer-hint">{{ t('每 2 秒自动采样（仅对话框打开时），EXPLAIN 会将占位符替换为 1') }}</span>
        <button class="btn btn-primary" @click="closeServerStatusDialog">{{ t('关闭') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const {
  serverStatusDialog,
  closeServerStatusDialog,
  loadServerStatus,
  loadSlowQueries,
  toggleAutoRefresh,
  explainSlowQuery
} = databaseStore

const status = computed(() => serverStatusDialog.value.status || {})
const history = computed(() => serverStatusDialog.value.history || [])

const trendSpanSeconds = computed(() => Math.max(0, history.value.length - 1) * 2)

const maxQps = computed(() => Math.max(0, ...history.value.map((item) => Number(item.qps) || 0)))

const linePoints = computed(() => {
  const values = history.value.map((item) => Number(item.qps) || 0)
  if (values.length === 0) return ''
  const series = values.length === 1 ? [values[0], values[0]] : values
  const max = Math.max(1, ...series)
  const step = 600 / Math.max(1, series.length - 1)
  return series
    .map((value, index) => {
      const x = (index * step).toFixed(1)
      const y = (90 - (value / max) * 84 - 3).toFixed(1)
      return `${x},${y}`
    })
    .join(' ')
})

const areaPoints = computed(() => (linePoints.value ? `0,90 ${linePoints.value} 600,90` : ''))

function formatInteger(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toLocaleString('en-US')
}

function formatQps(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0.0'
  if (number >= 1000) return `${(number / 1000).toFixed(2)}k`
  return number.toFixed(1)
}

function formatRate(value) {
  if (value === null || value === undefined) return '--'
  return `${(Number(value) * 100).toFixed(2)}%`
}

function formatMs(value) {
  const number = Number(value) || 0
  if (number >= 1000) return `${(number / 1000).toFixed(2)} s`
  return `${number.toFixed(2)} ms`
}

function formatSeconds(value) {
  const number = Number(value) || 0
  return `${number}s`
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const parts = []
  if (days) parts.push(t('{p0} 天', { p0: days }))
  if (hours) parts.push(t('{p0} 小时', { p0: hours }))
  parts.push(t('{p0} 分钟', { p0: minutes }))
  return parts.join(' ')
}

async function refreshAll() {
  await Promise.all([loadServerStatus(), loadSlowQueries()])
}
</script>
