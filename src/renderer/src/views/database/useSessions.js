import { t } from '@/i18n'
import { computed, onUnmounted } from 'vue'
import { dbGetSessionInfo, dbKillSession } from '@/api'

export function createSessions(state, api) {
  const { selectedConnection, sessionDialog, refreshInterval } = state

  let refreshTimer = null

  const filteredSessions = computed(() => {
    const dialog = sessionDialog.value
    const keyword = dialog.keyword.trim().toLowerCase()
    return dialog.sessions.filter((session) => {
      if (dialog.activeOnly && session.command === 'Sleep') return false
      if (dialog.command && session.command !== dialog.command) return false
      if (!keyword) return true
      return [session.user, session.host, session.db, session.command, session.state, session.info]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    })
  })

  const sessionCommands = computed(() => {
    const commands = new Set()
    for (const session of sessionDialog.value.sessions) {
      if (session.command) commands.add(session.command)
    }
    return Array.from(commands).sort()
  })

  const waitingTransactions = computed(() =>
    sessionDialog.value.transactions.filter((trx) => trx.state === 'LOCK WAIT')
  )

  function stopAutoRefresh() {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
    sessionDialog.value.autoRefresh = false
  }

  function startAutoRefresh() {
    stopAutoRefresh()
    const seconds = refreshInterval?.value ?? 0
    if (seconds <= 0) return
    sessionDialog.value.autoRefresh = true
    refreshTimer = setInterval(() => {
      if (!sessionDialog.value.show) {
        stopAutoRefresh()
        return
      }
      if (!sessionDialog.value.loading) {
        loadSessions()
      }
    }, seconds * 1000)
  }

  function toggleAutoRefresh() {
    if (sessionDialog.value.autoRefresh) {
      stopAutoRefresh()
    } else if ((refreshInterval?.value ?? 0) <= 0) {
      api.showMessage(t('自动刷新已在「设置 > 数据库客户端」中关闭'), 'warning')
    } else {
      startAutoRefresh()
    }
  }

  function openSessionDialog() {
    const connection = selectedConnection.value
    if (!connection) {
      api.showMessage(t('请先在左侧选择连接'), 'warning')
      return
    }
    if (!connection.active) {
      api.showMessage(t('请先连接数据库'), 'warning')
      return
    }
    sessionDialog.value = {
      show: true,
      connectionName: connection.name,
      tab: 'sessions',
      loading: true,
      autoRefresh: false,
      keyword: '',
      command: '',
      activeOnly: true,
      sessions: [],
      selfId: 0,
      version: '',
      transactions: [],
      locks: [],
      waits: [],
      deadlockText: '',
      error: '',
      killingId: 0
    }
    loadSessions()
  }

  function closeSessionDialog() {
    stopAutoRefresh()
    sessionDialog.value.show = false
  }

  async function loadSessions() {
    const dialog = sessionDialog.value
    if (!dialog.show || !dialog.connectionName) return
    dialog.loading = true
    dialog.error = ''
    try {
      const result = await dbGetSessionInfo(dialog.connectionName)
      if (!result.success) {
        dialog.error = result.error || t('读取会话信息失败')
        return
      }
      dialog.selfId = result.selfId || 0
      dialog.version = result.version || ''
      dialog.sessions = result.sessions || []
      dialog.transactions = result.transactions || []
      dialog.locks = result.locks || []
      dialog.waits = result.waits || []
      dialog.deadlockText = result.deadlockText || ''
    } catch (error) {
      dialog.error = t('读取会话信息失败: {p0}', { p0: error.message })
    } finally {
      dialog.loading = false
    }
  }

  async function killSessionById(session, mode) {
    if (!session || session.isSelf) return
    const action = mode === 'query' ? t('取消该会话正在执行的查询') : t('终止该会话')
    const confirmed = await api.showConfirm(t('确定{p0}吗？会话 ID: {p1}', { p0: action, p1: session.id }))
    if (!confirmed) return

    sessionDialog.value.killingId = session.id
    try {
      const result = await dbKillSession(sessionDialog.value.connectionName, session.id, mode)
      if (!result.success) {
        await api.showMessage(result.error || t('操作会话失败'), 'error')
        return
      }
      await api.showMessage(result.message || t('操作成功'), 'success')
      await loadSessions()
    } catch (error) {
      await api.showMessage(t('操作会话失败: ') + error.message, 'error')
    } finally {
      sessionDialog.value.killingId = 0
    }
  }

  onUnmounted(stopAutoRefresh)

  return {
    filteredSessions,
    sessionCommands,
    waitingTransactions,
    openSessionDialog,
    closeSessionDialog,
    loadSessions,
    toggleAutoRefresh,
    killSessionById
  }
}
