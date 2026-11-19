import { t } from '@/i18n'
import { computed } from 'vue'
import { dbExecuteQuery } from '@/api'
import { buildAlterEventSql, toDateTimeInput } from './eventSql'

export function createEventEditor(state, api) {
  const { eventDialog, selectedObject } = state

  async function openEventDialog(target) {
    if (!target?.connection || !target?.database || !target?.event) return

    const dialog = eventDialog.value
    dialog.show = true
    dialog.tab = 'definition'
    dialog.loading = true
    dialog.saving = false
    dialog.connectionName = target.connection.name
    dialog.database = target.database
    dialog.name = target.event
    dialog.definition = ''
    dialog.comment = ''
    dialog.status = 'ENABLED'
    dialog.scheduleType = 'RECURRING'
    dialog.starts = ''
    dialog.ends = ''
    dialog.intervalValue = ''
    dialog.intervalField = 'DAY'
    dialog.onCompletion = 'PRESERVE'
    dialog.error = ''

    try {
      const result = await dbExecuteQuery(
        target.connection.name,
        `SELECT EVENT_NAME, EVENT_DEFINITION, EVENT_COMMENT, STATUS, EVENT_TYPE, EXECUTE_AT,
                INTERVAL_VALUE, INTERVAL_FIELD, STARTS, ENDS, ON_COMPLETION
         FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ? AND EVENT_NAME = ?`,
        [target.database, target.event],
        { autoLimit: false }
      )
      if (!result.success) throw new Error(result.error || t('读取事件失败'))

      const row = result.rows?.[0]
      if (!row) throw new Error(t('事件不存在或无权访问'))

      dialog.definition = row.EVENT_DEFINITION || ''
      dialog.comment = row.EVENT_COMMENT || ''
      dialog.status = row.STATUS === 'DISABLED' ? 'DISABLED' : 'ENABLED'
      dialog.scheduleType = row.EVENT_TYPE === 'ONE TIME' ? 'ONCE' : 'RECURRING'
      dialog.starts = toDateTimeInput(row.EVENT_TYPE === 'ONE TIME' ? row.EXECUTE_AT : row.STARTS)
      dialog.ends = toDateTimeInput(row.ENDS)
      dialog.intervalValue = row.INTERVAL_VALUE ? String(row.INTERVAL_VALUE) : ''
      dialog.intervalField = row.INTERVAL_FIELD || 'DAY'
      dialog.onCompletion = row.ON_COMPLETION === 'NOT PRESERVE' ? 'NOT PRESERVE' : 'PRESERVE'
    } catch (error) {
      dialog.error = error.message || t('读取事件失败')
    } finally {
      dialog.loading = false
    }
  }

  function closeEventDialog() {
    if (eventDialog.value.saving) return
    eventDialog.value.show = false
  }

  const eventSqlPreview = computed(() => {
    try {
      return buildAlterEventSql(eventDialog.value)
    } catch (error) {
      return `-- ${error.message}`
    }
  })

  async function saveEventDialog() {
    const dialog = eventDialog.value
    if (dialog.loading || dialog.saving) return

    let sql
    try {
      sql = buildAlterEventSql(dialog)
    } catch (error) {
      dialog.error = error.message
      return
    }

    dialog.saving = true
    dialog.error = ''

    try {
      const result = await dbExecuteQuery(dialog.connectionName, sql, [], { database: dialog.database })
      if (!result.success) throw new Error(result.error || t('保存事件失败'))

      dialog.show = false
      api.showMessage(t('事件已保存'), 'success')

      if (selectedObject.value?.type === 'event' && selectedObject.value.name === dialog.name) {
        await api.loadObjectDefinitionForObject('event', dialog.name)
      }
      await api.loadDatabaseCategory(dialog.connectionName, dialog.database, 'events', { force: true })
    } catch (error) {
      dialog.error = error.message || t('保存事件失败')
    } finally {
      dialog.saving = false
    }
  }

  return { closeEventDialog, eventSqlPreview, openEventDialog, saveEventDialog }
}
