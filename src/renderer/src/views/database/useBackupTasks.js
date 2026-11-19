import { t } from '@/i18n'
import { dbDeleteBackupTask, dbGetBackupTasks, dbRunBackupTask, dbSaveBackupTask, dbSelectBackupDirectory } from '@/api'
import { backupTaskNextRun, backupTaskScheduleLabel } from '@shared/backupTasks'

function defaultForm(directory = '') {
  return {
    id: '',
    name: '',
    connection: '',
    database: '',
    table: '',
    format: 'sql',
    mode: 'interval',
    intervalMinutes: 1440,
    time: '03:00',
    maxRows: 100000,
    directory,
    enabled: true
  }
}

export function createBackupTasks(state, api) {
  const { backupDialog } = state

  function resetBackupForm(directory = backupDialog.value.defaultDirectory) {
    backupDialog.value.form = defaultForm(directory)
  }

  async function loadBackupTasks() {
    const dialog = backupDialog.value
    dialog.loading = true
    dialog.error = ''
    try {
      const result = await dbGetBackupTasks()
      if (!result?.success) throw new Error(result?.error || t('加载备份任务失败'))
      dialog.tasks = result.tasks || []
      dialog.defaultDirectory = result.defaultDirectory || ''
      if (!dialog.form.directory) dialog.form.directory = dialog.defaultDirectory
    } catch (error) {
      dialog.error = error.message || t('加载备份任务失败')
    } finally {
      dialog.loading = false
    }
  }

  async function openBackupDialog() {
    backupDialog.value.show = true
    if (!backupDialog.value.form.id && !backupDialog.value.form.connection) {
      resetBackupForm(backupDialog.value.form.directory || backupDialog.value.defaultDirectory)
    }
    await loadBackupTasks()
  }

  function closeBackupDialog() {
    backupDialog.value.show = false
  }

  function editBackupTask(task) {
    backupDialog.value.form = {
      id: task.id,
      name: task.name,
      connection: task.connection,
      database: task.database,
      table: task.table || '',
      format: task.format,
      mode: task.mode,
      intervalMinutes: task.intervalMinutes,
      time: task.time,
      maxRows: task.maxRows,
      directory: task.directory,
      enabled: task.enabled
    }
  }

  async function saveBackupForm() {
    const dialog = backupDialog.value
    const form = dialog.form
    if (!String(form.name || '').trim()) {
      await api.showMessage(t('请输入任务名称'), 'warning')
      return
    }
    if (!form.connection) {
      await api.showMessage(t('请选择连接'), 'warning')
      return
    }
    if (!String(form.database || '').trim()) {
      await api.showMessage(t('请填写数据库名'), 'warning')
      return
    }

    dialog.saving = true
    try {
      const result = await dbSaveBackupTask({ ...form })
      if (!result?.success) throw new Error(result?.error || t('保存备份任务失败'))
      dialog.tasks = result.tasks || []
      resetBackupForm()
      await loadBackupTasks()
      await api.showMessage(t('备份任务已保存'), 'success')
    } catch (error) {
      await api.showMessage(t('保存备份任务失败: ') + error.message, 'error')
    } finally {
      dialog.saving = false
    }
  }

  async function removeBackupTask(task) {
    const confirmed = await api.showConfirm(t('确定删除备份任务「{p0}」？', { p0: task.name }), t('删除备份任务'))
    if (!confirmed) return
    const result = await dbDeleteBackupTask(task.id)
    if (!result?.success) {
      await api.showMessage(t('删除备份任务失败: ') + (result?.error || t('未知错误')), 'error')
      return
    }
    backupDialog.value.tasks = result.tasks || []
    if (backupDialog.value.form.id === task.id) resetBackupForm()
    await api.showMessage(t('备份任务已删除'), 'success')
  }

  async function runBackupTask(task) {
    const dialog = backupDialog.value
    if (dialog.runningId) return
    dialog.runningId = task.id
    try {
      const result = await dbRunBackupTask(task.id)
      if (!result?.success) throw new Error(result?.error || t('备份失败'))
      const suffix = result.truncated ? t('（数据量超过上限，已截断）') : ''
      await api.showMessage(t('备份完成{p0}: {p1}', { p0: suffix, p1: result.file }), 'success')
    } catch (error) {
      await api.showMessage(t('执行备份失败: ') + error.message, 'error')
    } finally {
      dialog.runningId = ''
      await loadBackupTasks()
    }
  }

  async function pickBackupDirectory() {
    const result = await dbSelectBackupDirectory()
    if (!result || result.canceled || !result.directory) return
    backupDialog.value.form.directory = result.directory
  }

  function backupTaskScheduleText(task) {
    return backupTaskScheduleLabel(task)
  }

  function backupTaskNextText(task) {
    if (!task.enabled) return t('已停用')
    const next = backupTaskNextRun(task)
    if (!next) return ''
    const date = new Date(next)
    const pad = (value) => String(value).padStart(2, '0')
    return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  return {
    openBackupDialog,
    closeBackupDialog,
    loadBackupTasks,
    saveBackupForm,
    editBackupTask,
    removeBackupTask,
    runBackupTask,
    pickBackupDirectory,
    resetBackupForm,
    backupTaskScheduleText,
    backupTaskNextText
  }
}
