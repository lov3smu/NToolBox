import { dbExecuteQuery, dbQueryDatabaseHealth } from '@/api'

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, '``')}\``
}

export function createHealthCheck(state, api) {
  const { connectionDatabases, healthDialog, selectedConnection, selectedDatabase } = state

  async function openHealthDialog() {
    const conn = selectedConnection.value
    if (!conn) {
      await api.showMessage('请先在左侧选择一个数据库连接', 'warning')
      return
    }
    if (!conn.active) {
      await api.showMessage('连接尚未建立，请先连接数据库', 'warning')
      return
    }
    const databases = connectionDatabases.value[conn.name] || []
    if (!databases.length) {
      await api.showMessage('该连接下没有可检查的数据库', 'warning')
      return
    }
    const target = databases.includes(selectedDatabase.value) ? selectedDatabase.value : databases[0]
    healthDialog.value = {
      show: true,
      connectionName: conn.name,
      database: target,
      databases,
      loading: true,
      error: '',
      result: null
    }
    await loadHealth()
  }

  async function loadHealth(database = healthDialog.value.database) {
    const { connectionName } = healthDialog.value
    if (!connectionName || !database) return
    healthDialog.value.loading = true
    healthDialog.value.error = ''
    try {
      const result = await dbQueryDatabaseHealth(connectionName, database)
      if (!result?.success) {
        healthDialog.value.result = null
        healthDialog.value.error = result?.error || '健康检查失败'
        return
      }
      healthDialog.value.result = result
    } catch (error) {
      healthDialog.value.result = null
      healthDialog.value.error = error.message || '健康检查失败'
    } finally {
      healthDialog.value.loading = false
    }
  }

  function changeHealthDatabase(database) {
    if (!database || database === healthDialog.value.database) return
    healthDialog.value.database = database
    healthDialog.value.result = null
    loadHealth(database)
  }

  function closeHealthDialog() {
    healthDialog.value = {
      show: false,
      connectionName: '',
      database: '',
      databases: [],
      loading: false,
      error: '',
      result: null
    }
  }

  async function optimizeHealthTable(tableName) {
    const table = String(tableName || '').trim()
    if (!table) return
    const { connectionName, database } = healthDialog.value
    const confirmed = await api.showConfirm(
      `确定对表 ${table} 执行 OPTIMIZE TABLE 吗？该操作会重建表并回收空闲空间，期间可能短暂锁表。`,
      '优化表'
    )
    if (!confirmed) return
    const result = await dbExecuteQuery(
      connectionName,
      `OPTIMIZE TABLE ${quoteIdentifier(database)}.${quoteIdentifier(table)}`,
      [],
      { autoLimit: false }
    )
    if (!result?.success) {
      await api.showMessage('优化失败: ' + (result?.error || ''), 'error')
      return
    }
    await api.showMessage(`表 ${table} 优化完成`, 'success')
    await loadHealth()
  }

  return {
    openHealthDialog,
    loadHealth,
    changeHealthDatabase,
    closeHealthDialog,
    optimizeHealthTable
  }
}
