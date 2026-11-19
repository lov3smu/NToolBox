import { t } from '@/i18n'
import { onUnmounted } from 'vue'
import { dbExplainQuery, dbQueryServerStatus, dbQuerySlowQueries } from '@/api'

const HISTORY_LIMIT = 40
const SLOW_QUERY_EVERY_TICKS = 5

export function createInstanceStatus(state, api) {
  const { selectedConnection, selectedDatabase, serverStatusDialog, explainDialog, refreshInterval } = state

  let pollTimer = null
  let tick = 0

  function stopAutoRefresh() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    serverStatusDialog.value.autoRefresh = false
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    const seconds = refreshInterval?.value ?? 0
    if (seconds <= 0) return
    serverStatusDialog.value.autoRefresh = true
    tick = 0
    pollTimer = setInterval(() => {
      const dialog = serverStatusDialog.value
      if (!dialog.show) {
        stopAutoRefresh()
        return
      }
      if (dialog.loading) return
      tick += 1
      loadServerStatus()
      if (tick % SLOW_QUERY_EVERY_TICKS === 0) loadSlowQueries()
    }, seconds * 1000)
  }

  function toggleAutoRefresh() {
    if (serverStatusDialog.value.autoRefresh) {
      stopAutoRefresh()
    } else if ((refreshInterval?.value ?? 0) <= 0) {
      api.showMessage(t('自动刷新已在「设置 > 数据库客户端」中关闭'), 'warning')
    } else {
      startAutoRefresh()
    }
  }

  function openServerStatusDialog() {
    const connection = selectedConnection.value
    if (!connection) {
      api.showMessage(t('请先在左侧选择连接'), 'warning')
      return
    }
    if (!connection.active) {
      api.showMessage(t('请先连接数据库'), 'warning')
      return
    }
    serverStatusDialog.value = {
      show: true,
      connectionName: connection.name,
      database: selectedDatabase.value || '',
      loading: true,
      autoRefresh: false,
      error: '',
      status: null,
      history: [],
      qps: 0,
      slowDelta: 0,
      lastCounters: null,
      slowQueries: [],
      slowLoading: true,
      slowEnabled: true,
      slowReason: '',
      slowError: ''
    }
    startAutoRefresh()
    loadServerStatus()
    loadSlowQueries()
  }

  function closeServerStatusDialog() {
    stopAutoRefresh()
    serverStatusDialog.value.show = false
  }

  function appendHistory(dialog, result, sampledAt, qps) {
    dialog.history.push({
      at: sampledAt,
      qps,
      connections: result.threadsConnected,
      running: result.threadsRunning,
      hitRate: result.bufferPool?.hitRate ?? null
    })
    if (dialog.history.length > HISTORY_LIMIT) {
      dialog.history.splice(0, dialog.history.length - HISTORY_LIMIT)
    }
  }

  async function loadServerStatus() {
    const dialog = serverStatusDialog.value
    if (!dialog.show || !dialog.connectionName) return
    dialog.loading = true
    dialog.error = ''
    try {
      const result = await dbQueryServerStatus(dialog.connectionName)
      if (!serverStatusDialog.value.show) return
      if (!result.success) {
        dialog.error = result.error || t('读取实例状态失败')
        return
      }

      const sampledAt = Number(result.sampledAt) || Date.now()
      const previous = dialog.lastCounters
      let qps = Number(result.qpsAvg) || 0
      let slowDelta = 0
      if (previous) {
        const seconds = (sampledAt - previous.sampledAt) / 1000
        if (seconds > 0) {
          qps = Math.max(0, (result.questions - previous.questions) / seconds)
          slowDelta = Math.max(0, result.slowQueries - previous.slowQueries)
        }
      }

      dialog.status = result
      dialog.qps = qps
      dialog.slowDelta = slowDelta
      dialog.lastCounters = {
        sampledAt,
        questions: result.questions,
        slowQueries: result.slowQueries
      }
      appendHistory(dialog, result, sampledAt, qps)
    } catch (error) {
      dialog.error = t('读取实例状态失败: {p0}', { p0: error.message })
    } finally {
      dialog.loading = false
    }
  }

  async function loadSlowQueries() {
    const dialog = serverStatusDialog.value
    if (!dialog.show || !dialog.connectionName) return
    dialog.slowLoading = true
    dialog.slowError = ''
    try {
      const result = await dbQuerySlowQueries(dialog.connectionName, dialog.database, 10)
      if (!serverStatusDialog.value.show) return
      if (!result.success) {
        dialog.slowError = result.error || t('读取慢查询失败')
        return
      }
      dialog.slowQueries = result.queries || []
      dialog.slowEnabled = result.enabled !== false
      dialog.slowReason = result.reason || ''
    } catch (error) {
      dialog.slowError = t('读取慢查询失败: ') + error.message
    } finally {
      dialog.slowLoading = false
    }
  }

  async function explainSlowQuery(query) {
    const dialog = serverStatusDialog.value
    if (!query?.sql) return
    if (!/^\s*(SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH)\b/i.test(query.sql)) {
      api.showMessage(t('该语句类型不支持 EXPLAIN'), 'warning')
      return
    }
    const explainableSql = query.sql.replace(/\?/g, '1')
    const result = await dbExplainQuery(dialog.connectionName, dialog.database, explainableSql)
    explainDialog.value = { show: true, tab: null, result, loading: false }
  }

  onUnmounted(stopAutoRefresh)

  return {
    openServerStatusDialog,
    closeServerStatusDialog,
    loadServerStatus,
    loadSlowQueries,
    toggleAutoRefresh,
    explainSlowQuery
  }
}
