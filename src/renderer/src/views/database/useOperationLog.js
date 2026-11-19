import { t } from '@/i18n'
import { dbClearOperationLog, dbQueryOperationLog } from '@/api'

export function createOperationLog(state, api) {
  const { operationLogDialog } = state

  async function loadOperationLog() {
    const dialog = operationLogDialog.value
    dialog.loading = true
    dialog.error = ''
    try {
      const result = await dbQueryOperationLog({
        connection: dialog.connection,
        keyword: dialog.keyword,
        limit: 300
      })
      if (!result?.success) throw new Error(result?.error || t('读取操作日志失败'))
      dialog.entries = result.entries || []
    } catch (error) {
      dialog.error = error.message || t('读取操作日志失败')
    } finally {
      dialog.loading = false
    }
  }

  async function openOperationLog() {
    operationLogDialog.value.show = true
    await loadOperationLog()
  }

  function closeOperationLog() {
    operationLogDialog.value.show = false
  }

  async function clearOperationLog() {
    const confirmed = await api.showConfirm(t('确定清空数据库操作日志？此操作不可恢复。'), t('清空操作日志'))
    if (!confirmed) return
    operationLogDialog.value.clearing = true
    try {
      const result = await dbClearOperationLog()
      if (!result?.success) throw new Error(result?.error || t('清空失败'))
      await loadOperationLog()
      await api.showMessage(t('操作日志已清空'), 'success')
    } catch (error) {
      await api.showMessage(t('清空操作日志失败: ') + error.message, 'error')
    } finally {
      operationLogDialog.value.clearing = false
    }
  }

  return {
    openOperationLog,
    closeOperationLog,
    loadOperationLog,
    clearOperationLog
  }
}
