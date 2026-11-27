<template>
  <PageLayout tool-path="/scheduled-tasks">
    <template #actions>
      <button class="btn btn-secondary btn-sm" :disabled="loading" @click="loadTasks">
        <AppIcon name="refresh" />
        {{ loading ? t('加载中...') : t('刷新') }}
      </button>
      <button class="btn btn-primary btn-sm" @click="resetForm">{{ t('新建任务') }}</button>
    </template>

    <div class="page-body sched-page">
      <div v-if="errorText" class="sched-error">{{ errorText }}</div>
      <div class="sched-grid">
        <section class="panel sched-list-pane">
          <div class="panel-header">
            <span class="panel-title">{{ t('任务') }}</span>
            <span class="panel-hint">{{ tasks.length }}/{{ SCHEDULE_LIMITS.max }}</span>
          </div>
          <div class="panel-body sched-list">
            <div v-if="!tasks.length" class="sched-empty">
              {{ loading ? t('正在加载任务...') : t('暂无计划任务，右侧可创建第一个任务') }}
            </div>
            <article v-for="task in tasks" :key="task.id" class="sched-task" :class="{ active: form.id === task.id }">
              <div class="sched-task-head">
                <span class="sched-task-name" :title="task.name">{{ task.name }}</span>
                <span :class="['sched-chip', task.enabled ? 'ok' : 'muted']">{{
                  task.enabled ? t('启用') : t('停用')
                }}</span>
              </div>
              <div class="sched-task-meta">{{ t(scheduleActionLabel(task)) }} · {{ t(scheduleModeLabel(task)) }}</div>
              <div class="sched-task-meta">{{ t('下次') }} {{ nextRunText(task) }}</div>
              <div class="sched-task-status">
                <span v-if="!task.lastStatus" class="sched-chip muted">{{ t('未运行') }}</span>
                <span v-else :class="['sched-chip', task.lastStatus === 'success' ? 'ok' : 'warn']">
                  {{ task.lastStatus === 'success' ? t('上次成功') : t('上次失败') }}
                </span>
                <span v-if="task.lastRunAt">{{ formatTime(task.lastRunAt) }}</span>
              </div>
              <div v-if="task.lastSummary" class="sched-task-meta">{{ task.lastSummary }}</div>
              <div v-if="task.lastError" class="sched-task-meta is-error">{{ task.lastError }}</div>
              <div class="sched-task-actions">
                <button class="btn btn-secondary btn-sm" @click="editTask(task)">{{ t('编辑') }}</button>
                <button
                  class="btn btn-secondary btn-sm"
                  :disabled="!!runningId || !task.enabled"
                  @click="runTask(task)"
                >
                  {{ runningId === task.id ? t('运行中...') : t('立即运行') }}
                </button>
                <button class="btn btn-secondary btn-sm" @click="askDelete(task)">{{ t('删除') }}</button>
              </div>
            </article>
          </div>
        </section>

        <section class="panel sched-form-pane">
          <div class="panel-header">
            <span class="panel-title">{{ form.id ? t('编辑任务') : t('新建任务') }}</span>
            <span class="panel-hint">{{ form.id ? t('修改') : t('新') }}</span>
          </div>
          <div class="panel-body sched-form">
            <div class="sched-grid-fields">
              <label class="sched-field">
                <span class="field-label">{{ t('任务名称') }}</span>
                <AppInput v-model="form.name" :placeholder="t('例如：每日健康检查')" :maxlength="60" />
              </label>
              <label class="sched-field">
                <span class="field-label">{{ t('动作') }}</span>
                <AppSelect v-model="form.action" :options="actionOptions" />
              </label>
              <label class="sched-field">
                <span class="field-label">{{ t('调度方式') }}</span>
                <AppSelect v-model="form.mode" :options="modeOptions" />
              </label>
              <label class="sched-field">
                <span class="field-label">{{ form.mode === 'interval' ? t('间隔（分钟）') : t('执行时间') }}</span>
                <AppInput
                  v-if="form.mode === 'interval'"
                  v-model.number="form.intervalMinutes"
                  type="number"
                  min="5"
                  max="10080"
                />
                <AppInput v-else v-model="form.time" type="time" />
              </label>
            </div>

            <div v-if="actionHint" class="sched-hint">{{ actionHint }}</div>

            <div v-if="form.action === 'http'" class="sched-grid-fields">
              <label class="sched-field">
                <span class="field-label">{{ t('请求方法') }}</span>
                <AppSelect v-model="form.method" :options="methodOptions" />
              </label>
              <label class="sched-field">
                <span class="field-label">{{ t('请求地址') }}</span>
                <AppInput v-model="form.url" placeholder="https://api.example.com/health" spellcheck="false" />
              </label>
              <label class="sched-field wide">
                <span class="field-label">{{ t('请求头') }}</span>
                <AppTextarea
                  v-model="form.headers"
                  class="sched-textarea-sm"
                  :placeholder="t('请求头每行一条，格式为「名称: 值」')"
                  spellcheck="false"
                />
              </label>
              <label class="sched-field wide">
                <span class="field-label">{{ t('请求体') }}</span>
                <AppTextarea
                  v-model="form.body"
                  class="sched-textarea-sm"
                  :placeholder="t('GET 与 HEAD 请求不包含请求体')"
                  spellcheck="false"
                />
              </label>
            </div>

            <template v-else-if="form.action === 'recipe'">
              <div class="sched-section">
                <span class="sched-section-title">{{ t('Recipe 步骤') }}</span>
                <RecipeStepsEditor v-model="form.steps" />
              </div>
              <label class="sched-field">
                <span class="field-label">{{ t('输入文本') }}</span>
                <AppTextarea
                  v-model="form.input"
                  class="sched-textarea"
                  :placeholder="t('每次运行都使用这段文本作为输入')"
                  spellcheck="false"
                />
              </label>
              <label class="sched-field">
                <span class="field-label">{{ t('输出目录') }}</span>
                <div class="sched-inline">
                  <AppInput v-model="form.directory" :placeholder="defaultDirectory" spellcheck="false" />
                  <button type="button" class="btn btn-secondary" @click="pickDirectory">{{ t('选择目录') }}</button>
                </div>
              </label>
            </template>

            <label class="sched-toggle">
              <input v-model="form.enabled" type="checkbox" />
              {{ t('启用任务（关闭后不会自动执行）') }}
            </label>

            <div class="sched-form-actions">
              <button class="btn btn-secondary" @click="resetForm">{{ t('清空表单') }}</button>
              <button class="btn btn-primary" :disabled="saving" @click="saveTask">
                {{ saving ? t('保存中...') : form.id ? t('保存修改') : t('创建任务') }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>

    <MessageDialog
      :visible="deleteVisible"
      type="confirm"
      :title="t('删除任务')"
      :message="t('将删除计划任务「{p0}」，此操作无法撤销。', { p0: pendingTask?.name || '' })"
      @confirm="confirmDelete"
      @cancel="deleteVisible = false"
      @close="deleteVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import RecipeStepsEditor from '@/components/RecipeStepsEditor.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppSelect from '@/components/AppSelect.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import { useToast } from '@/composables'
import { t } from '@/i18n'
import { selectDirectory, scheduledTasksDelete, scheduledTasksList, scheduledTasksRun, scheduledTasksSave } from '@/api'
import { HTTP_METHODS } from '@shared/httpClient'
import { createRecipeStep } from '@shared/recipes'
import {
  normalizeScheduledTask,
  SCHEDULE_ACTIONS,
  SCHEDULE_LIMITS,
  SCHEDULE_MODES,
  scheduleActionLabel,
  scheduledTaskNextRun,
  scheduleModeLabel
} from '@shared/taskSchedule'

const { showSuccess, showError, showWarning } = useToast()

const tasks = ref([])
const loading = ref(false)
const saving = ref(false)
const runningId = ref('')
const errorText = ref('')
const defaultDirectory = ref('')
const deleteVisible = ref(false)
const pendingTask = ref(null)
const form = ref(blankForm())

const actionOptions = SCHEDULE_ACTIONS.map((item) => ({
  value: item.value,
  label: t(item.label),
  description: t(item.hint)
}))
const modeOptions = SCHEDULE_MODES.map((item) => ({ value: item.value, label: t(item.label) }))
const methodOptions = HTTP_METHODS.map((method) => ({ value: method, label: method }))

const actionHint = computed(() => {
  if (form.value.action === 'clipboard-clear') return t('无需额外配置，到点自动清空剪贴板历史。')
  if (form.value.action === 'recipe') return t('到点按步骤处理输入文本，结果写入文件名带时间戳的 txt。')
  return ''
})

function blankForm() {
  return {
    id: '',
    name: '',
    action: 'http',
    method: 'GET',
    url: '',
    headers: 'Accept: */*',
    body: '',
    steps: [createRecipeStep('codec')],
    input: '',
    directory: '',
    mode: 'interval',
    intervalMinutes: 60,
    time: '09:00',
    enabled: true
  }
}

function fillForm(task) {
  const normalized = normalizeScheduledTask({ ...blankForm(), ...task })
  form.value = {
    ...normalized,
    steps: normalized.steps.length ? normalized.steps.map((step) => ({ ...step })) : [createRecipeStep('codec')]
  }
}

function resetForm() {
  form.value = blankForm()
}

function editTask(task) {
  fillForm(task)
}

async function loadTasks() {
  loading.value = true
  errorText.value = ''
  const result = await scheduledTasksList()
  loading.value = false
  if (!result?.success) {
    errorText.value = result?.error || t('加载计划任务失败')
    return
  }
  tasks.value = Array.isArray(result.tasks) ? result.tasks : []
  defaultDirectory.value = result.defaultDirectory || ''
}

async function saveTask() {
  if (saving.value) return
  saving.value = true
  const result = await scheduledTasksSave({ ...form.value })
  saving.value = false
  if (!result?.success) {
    showWarning(result?.error || t('保存任务失败'))
    return
  }
  tasks.value = Array.isArray(result.tasks) ? result.tasks : []
  if (result.task) fillForm(result.task)
  showSuccess(t('任务已保存'))
}

async function runTask(task) {
  if (runningId.value) return
  runningId.value = task.id
  const result = await scheduledTasksRun(task.id)
  runningId.value = ''
  if (Array.isArray(result?.tasks)) tasks.value = result.tasks
  if (result?.success) showSuccess(result.summary || t('任务已完成'))
  else showError(result?.error || t('任务执行失败'))
}

function askDelete(task) {
  pendingTask.value = task
  deleteVisible.value = true
}

async function confirmDelete() {
  deleteVisible.value = false
  const task = pendingTask.value
  pendingTask.value = null
  if (!task) return
  const result = await scheduledTasksDelete(task.id)
  if (!result?.success) {
    showWarning(result?.error || t('删除计划任务失败'))
    return
  }
  tasks.value = Array.isArray(result.tasks) ? result.tasks : []
  if (form.value.id === task.id) resetForm()
  showSuccess(t('已删除计划任务「{p0}」', { p0: task.name }))
}

async function pickDirectory() {
  const directory = await selectDirectory()
  if (directory) form.value.directory = directory
}

function nextRunText(task) {
  if (!task.enabled) return '—'
  const timestamp = scheduledTaskNextRun(task)
  return timestamp ? formatTime(timestamp) : '—'
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

onMounted(loadTasks)
</script>

<style scoped>
.sched-page {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sched-error {
  padding: 8px 10px;
  border: 1px solid rgba(var(--error-rgb), 0.25);
  border-radius: var(--radius-sm);
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error-color);
  font-size: var(--font-size-dense);
}

.sched-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  gap: 12px;
  align-items: stretch;
}

.sched-list-pane,
.sched-form-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sched-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sched-empty {
  padding: 24px 12px;
  color: var(--text-tertiary);
  font-size: var(--font-size-dense);
  text-align: center;
}

.sched-task {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
}

.sched-task.active {
  border-color: var(--accent-color);
  background: var(--surface-hover);
}

.sched-task-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sched-task-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-size: var(--font-size-dense);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sched-task-meta {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  word-break: break-word;
}

.sched-task-meta.is-error {
  color: var(--error-dark);
}

.sched-task-status {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.sched-chip {
  padding: 1px 7px;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.sched-chip.ok {
  border: 1px solid rgba(var(--success-rgb), 0.35);
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
}

.sched-chip.warn {
  border: 1px solid rgba(var(--warning-rgb), 0.4);
  background: rgba(var(--warning-rgb), 0.12);
  color: var(--warning-dark);
}

.sched-chip.muted {
  border: 1px solid var(--border-color);
  background: var(--surface-muted);
  color: var(--text-tertiary);
}

.sched-task-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.sched-form {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sched-grid-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.sched-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.sched-field.wide {
  grid-column: 1 / -1;
}

.sched-hint {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.sched-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sched-section-title {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

.sched-textarea {
  min-height: 110px;
  font-family: var(--font-mono);
}

.sched-textarea-sm {
  min-height: 72px;
  font-family: var(--font-mono);
}

.sched-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sched-inline > :first-child {
  flex: 1;
  min-width: 0;
}

.sched-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: var(--font-size-dense);
}

.sched-form-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
}

@media (max-width: 1000px) {
  .sched-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .sched-list {
    max-height: 320px;
  }
}

@media (max-width: 720px) {
  .sched-grid-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
