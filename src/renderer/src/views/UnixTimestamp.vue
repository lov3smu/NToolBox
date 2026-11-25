<template>
  <PageLayout tool-path="/unixtimestamp">
    <div class="page-body">
      <div class="ts-grid">
        <section class="panel now-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('当前时间戳') }}</span>
            <span class="panel-hint live-hint"><span class="live-dot" />{{ t('每秒刷新') }}</span>
          </div>
          <div class="panel-body">
            <div class="timestamp-display">
              <button
                type="button"
                class="timestamp-item"
                :class="{ active: timestampType === '10' }"
                @click="timestampType = '10'"
              >
                <span class="timestamp-label">{{ t('10 位 · 秒级') }}</span>
                <span class="timestamp-value">{{ currentTimestamp10 }}</span>
              </button>
              <button
                type="button"
                class="timestamp-item"
                :class="{ active: timestampType === '13' }"
                @click="timestampType = '13'"
              >
                <span class="timestamp-label">{{ t('13 位 · 毫秒级') }}</span>
                <span class="timestamp-value">{{ currentTimestamp13 }}</span>
              </button>
            </div>
            <div class="current-datetime">
              <span class="datetime-label">{{ t('北京时间') }}</span>
              <span class="datetime-value">{{ currentDatetime }}</span>
            </div>
          </div>
        </section>

        <section class="panel to-datetime-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('时间戳 → 北京时间') }}</span>
            <span class="panel-hint">{{ t('支持 10 位秒级或 13 位毫秒级') }}</span>
          </div>
          <div class="panel-body">
            <div class="input-row">
              <AppInput
                v-model="timestampInput"
                type="text"
                mono
                :placeholder="t('输入时间戳（10 位或 13 位）')"
                @input="onTimestampInput"
              />
              <button class="btn btn-primary" @click="convertTimestampToDatetime">{{ t('转换') }}</button>
            </div>
            <div v-if="datetimeResult" class="ts-results">
              <div class="ts-result">
                <span class="ts-result-label">{{ t('北京时间') }}</span>
                <span class="ts-result-value">{{ datetimeResult }}</span>
                <CopyButton :text="datetimeResult" :title="t('复制时间')" size="sm" />
              </div>
            </div>
          </div>
        </section>

        <section class="panel to-timestamp-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('北京时间 → 时间戳') }}</span>
            <span class="panel-hint">{{ t('按逐项选择的北京时间换算') }}</span>
          </div>
          <div class="panel-body">
            <div class="datetime-grid">
              <label class="datetime-field">
                <span class="field-label">{{ t('年') }}</span>
                <AppSelect v-model="yearValue" :options="yearOptions" />
              </label>
              <label class="datetime-field">
                <span class="field-label">{{ t('月') }}</span>
                <AppSelect v-model="monthValue" :options="monthOptions" />
              </label>
              <label class="datetime-field">
                <span class="field-label">{{ t('日') }}</span>
                <AppSelect v-model="dayValue" :options="dayOptions" />
              </label>
              <label class="datetime-field">
                <span class="field-label">{{ t('时') }}</span>
                <AppSelect v-model="hourValue" :options="hourOptions" />
              </label>
              <label class="datetime-field">
                <span class="field-label">{{ t('分') }}</span>
                <AppSelect v-model="minuteValue" :options="minuteOptions" />
              </label>
              <label class="datetime-field">
                <span class="field-label">{{ t('秒') }}</span>
                <AppSelect v-model="secondValue" :options="minuteOptions" />
              </label>
              <label class="datetime-field">
                <span class="field-label">{{ t('毫秒') }}</span>
                <AppInput type="number" min="0" max="999" mono :value="millisecondValue" @input="onMillisecondInput" />
              </label>
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" @click="convertDatetimeToTimestamp">{{ t('转换') }}</button>
            </div>
            <div v-if="timestampResult10 || timestampResult13" class="ts-results">
              <div class="ts-result">
                <span class="ts-result-label">{{ t('10 位') }}</span>
                <span class="ts-result-value">{{ timestampResult10 }}</span>
                <CopyButton :text="timestampResult10" :title="t('复制 10 位时间戳')" size="sm" />
              </div>
              <div class="ts-result">
                <span class="ts-result-label">{{ t('13 位') }}</span>
                <span class="ts-result-value">{{ timestampResult13 }}</span>
                <CopyButton :text="timestampResult13" :title="t('复制 13 位时间戳')" size="sm" />
              </div>
            </div>
          </div>
        </section>

        <section class="panel quick-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('快速转换') }}</span>
            <span class="panel-hint">{{ t('格式 YYYYMMDDHHMMSS') }}</span>
          </div>
          <div class="panel-body">
            <div class="input-row">
              <AppInput
                v-model="quickInput"
                type="text"
                mono
                :placeholder="t('例如：20240101120000')"
                @input="onQuickInput"
              />
              <button class="btn btn-primary" @click="convertQuickInput">{{ t('转换') }}</button>
            </div>
            <div class="quick-hint">{{ t('年月日时分秒，如 20240101120000 表示 2024年01月01日 12:00:00') }}</div>
            <div v-if="quickTimestampResult10 || quickTimestampResult13" class="ts-results">
              <div class="ts-result">
                <span class="ts-result-label">{{ t('10 位') }}</span>
                <span class="ts-result-value">{{ quickTimestampResult10 }}</span>
                <CopyButton :text="quickTimestampResult10" :title="t('复制 10 位时间戳')" size="sm" />
              </div>
              <div class="ts-result">
                <span class="ts-result-label">{{ t('13 位') }}</span>
                <span class="ts-result-value">{{ quickTimestampResult13 }}</span>
                <CopyButton :text="quickTimestampResult13" :title="t('复制 13 位时间戳')" size="sm" />
              </div>
            </div>
          </div>
        </section>

        <section class="panel help-panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('工具介绍') }}</span>
            <span class="panel-hint">{{ t('关于 Unix 时间戳') }}</span>
          </div>
          <div class="panel-body help-content">
            <p>
              {{ t('Unix 时间戳表示从 1970-01-01 00:00:00 UTC 起至现在的总秒数，被广泛用于各类操作系统与编程语言。') }}
            </p>
            <div class="help-list">
              <div class="help-item">
                <strong>{{ t('10 位时间戳') }}</strong>
                <span>{{ t('秒级精度，日常接口与数据库中最常用') }}</span>
              </div>
              <div class="help-item">
                <strong>{{ t('13 位时间戳') }}</strong>
                <span>{{ t('毫秒级精度，适合需要更细时间粒度的场景') }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { takeSendResource, useToast } from '@/composables'
import PageLayout from '@/layouts/PageLayout.vue'
import { t } from '@/i18n'
import AppSelect from '@/components/AppSelect.vue'
import CopyButton from '@/components/CopyButton.vue'
import AppInput from '@/components/AppInput.vue'
const { showSuccess, showError, showWarning } = useToast()

const currentTimestamp10 = ref('')
const currentTimestamp13 = ref('')
const currentDatetime = ref('')
const timestampType = ref('10')

const timestampInput = ref('')
const datetimeResult = ref('')

const yearValue = ref(new Date().getFullYear())
const monthValue = ref(new Date().getMonth() + 1)
const dayValue = ref(new Date().getDate())
const hourValue = ref(new Date().getHours())
const minuteValue = ref(new Date().getMinutes())
const secondValue = ref(new Date().getSeconds())
const millisecondValue = ref(0)
const timestampResult10 = ref('')
const timestampResult13 = ref('')

const quickInput = ref('')
const quickTimestampResult10 = ref('')
const quickTimestampResult13 = ref('')

let timer = null

const yearOptions = computed(() => {
  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear - 50; y <= currentYear + 10; y++) {
    years.push(y)
  }
  return years
})

const dayOptions = computed(() => {
  const daysInMonth = new Date(yearValue.value, monthValue.value, 0).getDate()
  const days = []
  for (let d = 1; d <= daysInMonth; d++) {
    days.push(d)
  }
  return days
})

const monthOptions = computed(() => Array.from({ length: 12 }, (_, index) => index + 1))
const hourOptions = computed(() =>
  Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: String(hour).padStart(2, '0') }))
)
const minuteOptions = computed(() =>
  Array.from({ length: 60 }, (_, minute) => ({ value: minute, label: String(minute).padStart(2, '0') }))
)

function onMillisecondInput(event) {
  const value = Number(event.target.value)
  if (!Number.isFinite(value)) return
  millisecondValue.value = Math.min(999, Math.max(0, Math.trunc(value)))
}

function updateCurrentTimestamp() {
  const now = new Date()
  currentTimestamp10.value = Math.floor(now.getTime() / 1000)
  currentTimestamp13.value = now.getTime()
  currentDatetime.value = formatDatetime(now)
}

function formatDatetime(date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hour = date.getHours().toString().padStart(2, '0')
  const minute = date.getMinutes().toString().padStart(2, '0')
  const second = date.getSeconds().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

function onTimestampInput() {
  datetimeResult.value = ''
}

function convertTimestampToDatetime() {
  const input = timestampInput.value.trim()
  if (!input) {
    showWarning(t('请输入时间戳'))
    return
  }

  const timestamp = parseInt(input)
  if (isNaN(timestamp)) {
    showError(t('时间戳格式错误，请输入数字'))
    return
  }

  let date
  if (input.length === 10) {
    date = new Date(timestamp * 1000)
  } else if (input.length === 13) {
    date = new Date(timestamp)
  } else {
    showError(t('时间戳长度应为 10 位或 13 位'))
    return
  }

  if (date.toString() === 'Invalid Date') {
    showError(t('时间戳无效'))
    return
  }

  datetimeResult.value = formatDatetime(date)
  showSuccess(t('转换成功'))
}

function convertDatetimeToTimestamp() {
  const date = new Date(
    yearValue.value,
    monthValue.value - 1,
    dayValue.value,
    hourValue.value,
    minuteValue.value,
    secondValue.value,
    millisecondValue.value
  )

  if (date.toString() === 'Invalid Date') {
    showError(t('日期无效'))
    return
  }

  timestampResult10.value = Math.floor(date.getTime() / 1000).toString()
  timestampResult13.value = date.getTime().toString()
  showSuccess(t('转换成功'))
}

function onQuickInput() {
  quickTimestampResult10.value = ''
  quickTimestampResult13.value = ''
}

function convertQuickInput() {
  const input = quickInput.value.trim()
  if (!input) {
    showWarning(t('请输入日期时间'))
    return
  }

  if (input.length !== 14) {
    showError(t('格式应为 14 位数字：YYYYMMDDHHMMSS'))
    return
  }

  const year = parseInt(input.substring(0, 4))
  const month = parseInt(input.substring(4, 6))
  const day = parseInt(input.substring(6, 8))
  const hour = parseInt(input.substring(8, 10))
  const minute = parseInt(input.substring(10, 12))
  const second = parseInt(input.substring(12, 14))

  if (month < 1 || month > 12) {
    showError(t('月份应在 1-12 之间'))
    return
  }
  if (day < 1 || day > 31) {
    showError(t('日期应在 1-31 之间'))
    return
  }
  if (hour < 0 || hour > 23) {
    showError(t('小时应在 0-23 之间'))
    return
  }
  if (minute < 0 || minute > 59) {
    showError(t('分钟应在 0-59 之间'))
    return
  }
  if (second < 0 || second > 59) {
    showError(t('秒应在 0-59 之间'))
    return
  }

  const date = new Date(year, month - 1, day, hour, minute, second)
  if (date.toString() === 'Invalid Date') {
    showError(t('日期无效'))
    return
  }

  quickTimestampResult10.value = Math.floor(date.getTime() / 1000).toString()
  quickTimestampResult13.value = date.getTime().toString()
  showSuccess(t('转换成功'))
}

onMounted(() => {
  updateCurrentTimestamp()
  timer = setInterval(updateCurrentTimestamp, 1000)
  const incoming = takeSendResource('/unixtimestamp')
  if (incoming?.kind === 'text') {
    timestampInput.value = incoming.text.trim()
    convertTimestampToDatetime()
  }
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
.page-body {
  width: 100%;
}

.ts-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-areas:
    'now now'
    'to-date to-ts'
    'quick help';
  gap: 14px;
  align-items: stretch;
}

.ts-grid > .panel {
  margin-top: 0;
}

.now-panel {
  grid-area: now;
}

.to-datetime-panel {
  grid-area: to-date;
}

.to-timestamp-panel {
  grid-area: to-ts;
}

.quick-panel {
  grid-area: quick;
}

.help-panel {
  grid-area: help;
}

.live-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success-color);
  box-shadow: 0 0 0 3px rgba(var(--success-rgb), 0.15);
}

/* ---------- 当前时间戳 ---------- */
.now-panel .panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timestamp-display {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.timestamp-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px 16px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: var(--transition-fast);
}

.timestamp-item:hover {
  border-color: var(--border-strong);
}

.timestamp-item.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: linear-gradient(135deg, rgba(var(--accent-rgb), 0.1), rgba(var(--accent-rgb), 0.04));
}

.timestamp-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.timestamp-item.active .timestamp-label {
  color: var(--accent-color);
}

.timestamp-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-xl);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.current-datetime {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.datetime-label {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(var(--accent-rgb), 0.1);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.datetime-value {
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
}

/* ---------- 输入与转换 ---------- */
.input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-row .input-field {
  flex: 1;
  min-width: 0;
}

.input-field.mono {
  font-family: var(--font-mono);
}

.datetime-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.datetime-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.quick-hint {
  margin-top: 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

/* ---------- 结果 ---------- */
.ts-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.ts-result {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(var(--success-rgb), 0.06);
  border: 1px solid rgba(var(--success-rgb), 0.22);
  border-radius: var(--radius-sm);
}

.ts-result-label {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(var(--success-rgb), 0.12);
  color: var(--success-dark);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.ts-result-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--success-dark);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ts-result .btn-icon {
  flex-shrink: 0;
}

/* ---------- 工具介绍 ---------- */
.help-content p {
  margin: 0 0 12px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.7;
}

.help-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.help-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.help-item strong {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.help-item span {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.6;
}

/* ---------- 响应式 ---------- */
@media (max-width: 1000px) {
  .ts-grid {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'now'
      'to-date'
      'to-ts'
      'quick'
      'help';
  }
}

@media (max-width: 760px) {
  .timestamp-display {
    grid-template-columns: minmax(0, 1fr);
  }

  .datetime-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .datetime-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .help-list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
