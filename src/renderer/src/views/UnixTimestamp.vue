<template>
  <PageLayout tool-path="/unixtimestamp">
    <div class="page-body">
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">当前时间戳</span>
        </div>
        <div class="panel-body">
          <div class="timestamp-display">
            <div class="timestamp-item" :class="{ active: timestampType === '10' }" @click="timestampType = '10'">
              <div class="timestamp-value">{{ currentTimestamp10 }}</div>
              <div class="timestamp-label">10 位 · 秒级</div>
            </div>
            <div class="timestamp-item" :class="{ active: timestampType === '13' }" @click="timestampType = '13'">
              <div class="timestamp-value">{{ currentTimestamp13 }}</div>
              <div class="timestamp-label">13 位 · 毫秒级</div>
            </div>
          </div>
          <div class="current-datetime">
            <span class="datetime-label">对应北京时间</span>
            <span class="datetime-value">{{ currentDatetime }}</span>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">时间戳 → 北京时间</span>
        </div>
        <div class="panel-body">
          <div class="input-row">
            <input
              v-model="timestampInput"
              type="text"
              class="input-field mono"
              placeholder="输入时间戳（10位或13位）"
              @input="onTimestampInput"
            />
            <button class="btn btn-primary" @click="convertTimestampToDatetime">转换</button>
          </div>
          <div v-if="datetimeResult" class="result-box">
            <span class="result-value">{{ datetimeResult }}</span>
            <button class="btn btn-secondary btn-sm" @click="copyResult(datetimeResult)">复制</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">北京时间 → 时间戳（逐项输入）</span>
        </div>
        <div class="panel-body">
          <div class="datetime-inputs">
            <div class="input-group">
              <select v-model="yearValue" class="select-field year">
                <option v-for="y in yearOptions" :key="y" :value="y">
                  {{ y }}
                </option>
              </select>
              <span class="input-label">年</span>
            </div>
            <div class="input-group">
              <select v-model="monthValue" class="select-field">
                <option v-for="m in 12" :key="m" :value="m">
                  {{ m }}
                </option>
              </select>
              <span class="input-label">月</span>
            </div>
            <div class="input-group">
              <select v-model="dayValue" class="select-field">
                <option v-for="d in dayOptions" :key="d" :value="d">
                  {{ d }}
                </option>
              </select>
              <span class="input-label">日</span>
            </div>
            <div class="input-group">
              <select v-model="hourValue" class="select-field">
                <option v-for="h in 24" :key="h - 1" :value="h - 1">
                  {{ (h - 1).toString().padStart(2, '0') }}
                </option>
              </select>
              <span class="input-label">时</span>
            </div>
            <div class="input-group">
              <select v-model="minuteValue" class="select-field">
                <option v-for="m in 60" :key="m - 1" :value="m - 1">
                  {{ (m - 1).toString().padStart(2, '0') }}
                </option>
              </select>
              <span class="input-label">分</span>
            </div>
            <div class="input-group">
              <select v-model="secondValue" class="select-field">
                <option v-for="s in 60" :key="s - 1" :value="s - 1">
                  {{ (s - 1).toString().padStart(2, '0') }}
                </option>
              </select>
              <span class="input-label">秒</span>
            </div>
            <div class="input-group">
              <select v-model="millisecondValue" class="select-field ms">
                <option v-for="ms in 1000" :key="ms - 1" :value="ms - 1">
                  {{ (ms - 1).toString().padStart(3, '0') }}
                </option>
              </select>
              <span class="input-label">毫秒</span>
            </div>
            <button class="btn btn-primary" @click="convertDatetimeToTimestamp">转换</button>
          </div>
          <div v-if="timestampResult10 || timestampResult13" class="result-box column">
            <div class="result-row">
              <span class="result-label">10 位</span>
              <span class="result-value">{{ timestampResult10 }}</span>
              <button class="btn btn-secondary btn-sm" @click="copyResult(timestampResult10)">复制</button>
            </div>
            <div class="result-row">
              <span class="result-label">13 位</span>
              <span class="result-value">{{ timestampResult13 }}</span>
              <button class="btn btn-secondary btn-sm" @click="copyResult(timestampResult13)">复制</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">快速转换（YYYYMMDDHHMMSS）</span>
        </div>
        <div class="panel-body">
          <div class="input-row">
            <input
              v-model="quickInput"
              type="text"
              class="input-field mono"
              placeholder="例如：20240101120000"
              @input="onQuickInput"
            />
            <button class="btn btn-primary" @click="convertQuickInput">转换</button>
          </div>
          <div class="quick-hint">年月日时分秒，如 20240101120000 表示 2024年01月01日 12:00:00</div>
          <div v-if="quickTimestampResult10 || quickTimestampResult13" class="result-box column">
            <div class="result-row">
              <span class="result-label">10 位</span>
              <span class="result-value">{{ quickTimestampResult10 }}</span>
              <button class="btn btn-secondary btn-sm" @click="copyResult(quickTimestampResult10)">复制</button>
            </div>
            <div class="result-row">
              <span class="result-label">13 位</span>
              <span class="result-value">{{ quickTimestampResult13 }}</span>
              <button class="btn btn-secondary btn-sm" @click="copyResult(quickTimestampResult13)">复制</button>
            </div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">工具介绍</span>
        </div>
        <div class="panel-body help-content">
          <p>Unix 时间戳表示从 1970-01-01 00:00:00 UTC 起至现在的总秒数，被广泛用于各类操作系统与编程语言。</p>
          <ul>
            <li><strong>10 位时间戳</strong>：秒级精度</li>
            <li><strong>13 位时间戳</strong>：毫秒级精度</li>
          </ul>
        </div>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useToast } from '@/composables'
import { copyToClipboard } from '@/utils'
import Toast from '@/components/Toast.vue'
import PageLayout from '@/layouts/PageLayout.vue'

const { toastVisible, toastMessage, toastType, showSuccess, showError, showWarning } = useToast()

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
    showWarning('请输入时间戳')
    return
  }

  const timestamp = parseInt(input)
  if (isNaN(timestamp)) {
    showError('时间戳格式错误，请输入数字')
    return
  }

  let date
  if (input.length === 10) {
    date = new Date(timestamp * 1000)
  } else if (input.length === 13) {
    date = new Date(timestamp)
  } else {
    showError('时间戳长度应为10位或13位')
    return
  }

  if (date.toString() === 'Invalid Date') {
    showError('时间戳无效')
    return
  }

  datetimeResult.value = formatDatetime(date)
  showSuccess('转换成功')
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
    showError('日期无效')
    return
  }

  timestampResult10.value = Math.floor(date.getTime() / 1000).toString()
  timestampResult13.value = date.getTime().toString()
  showSuccess('转换成功')
}

function onQuickInput() {
  quickTimestampResult10.value = ''
  quickTimestampResult13.value = ''
}

function convertQuickInput() {
  const input = quickInput.value.trim()
  if (!input) {
    showWarning('请输入日期时间')
    return
  }

  if (input.length !== 14) {
    showError('格式应为14位数字：YYYYMMDDHHMMSS')
    return
  }

  const year = parseInt(input.substring(0, 4))
  const month = parseInt(input.substring(4, 6))
  const day = parseInt(input.substring(6, 8))
  const hour = parseInt(input.substring(8, 10))
  const minute = parseInt(input.substring(10, 12))
  const second = parseInt(input.substring(12, 14))

  if (month < 1 || month > 12) {
    showError('月份应在1-12之间')
    return
  }
  if (day < 1 || day > 31) {
    showError('日期应在1-31之间')
    return
  }
  if (hour < 0 || hour > 23) {
    showError('小时应在0-23之间')
    return
  }
  if (minute < 0 || minute > 59) {
    showError('分钟应在0-59之间')
    return
  }
  if (second < 0 || second > 59) {
    showError('秒应在0-59之间')
    return
  }

  const date = new Date(year, month - 1, day, hour, minute, second)
  if (date.toString() === 'Invalid Date') {
    showError('日期无效')
    return
  }

  quickTimestampResult10.value = Math.floor(date.getTime() / 1000).toString()
  quickTimestampResult13.value = date.getTime().toString()
  showSuccess('转换成功')
}

async function copyResult(text) {
  if (!text) return
  const success = await copyToClipboard(text)
  if (success) {
    showSuccess('已复制到剪贴板')
  } else {
    showError('复制失败，请手动复制')
  }
}

onMounted(() => {
  updateCurrentTimestamp()
  timer = setInterval(updateCurrentTimestamp, 1000)
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
  padding: 12px 16px 16px;
  width: 100%;
}

.timestamp-display {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.timestamp-item {
  flex: 1;
  padding: 12px 14px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.timestamp-item:hover {
  border-color: var(--border-strong);
}

.timestamp-item.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: rgba(var(--accent-rgb), 0.06);
}

.timestamp-value {
  font-size: var(--font-size-lg);
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.timestamp-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.current-datetime {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

.datetime-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.datetime-value {
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--text-primary);
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row .input-field {
  flex: 1;
}

.input-field.mono {
  font-family: 'Consolas', 'Monaco', monospace;
}

.datetime-inputs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.input-group .select-field {
  width: 68px;
}

.input-group .select-field.year {
  width: 88px;
}

.input-group .select-field.ms {
  width: 80px;
}

.input-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.quick-hint {
  margin-top: 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.result-box {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(var(--success-rgb), 0.06);
  border: 1px solid rgba(var(--success-rgb), 0.22);
  border-radius: var(--radius-sm);
}

.result-box.column {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.result-box .result-value {
  flex: 1;
  font-size: var(--font-size-sm);
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--success-dark);
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result-label {
  width: 40px;
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.help-content {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  line-height: 1.7;
}

.help-content p {
  margin-bottom: 8px;
}

.help-content ul {
  padding-left: 18px;
}
</style>
