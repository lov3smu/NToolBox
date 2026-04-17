<template>
  <div class="unix-container" :style="{ width: windowWidth + 'px' }">
    <header>
      <h1>
        <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Unix时间戳互转
      </h1>
      <div class="subtitle">时间戳与日期时间双向转换工具</div>
    </header>

    <div class="unix-content">
      <div class="current-timestamp-section">
        <div class="section-header">
          <label>当前时间戳(Unix timestamp)</label>
        </div>
        <div class="timestamp-display">
          <div class="timestamp-item" :class="{ active: timestampType === '10' }" @click="timestampType = '10'">
            <div class="timestamp-value">{{ currentTimestamp10 }}</div>
            <div class="timestamp-label">10位(秒级)</div>
          </div>
          <div class="timestamp-item" :class="{ active: timestampType === '13' }" @click="timestampType = '13'">
            <div class="timestamp-value">{{ currentTimestamp13 }}</div>
            <div class="timestamp-label">13位(毫秒级)</div>
          </div>
        </div>
        <div class="current-datetime">
          <span class="datetime-label">对应北京时间：</span>
          <span class="datetime-value">{{ currentDatetime }}</span>
        </div>
      </div>

      <div class="convert-section">
        <div class="section-header">
          <label>时间戳 → 北京时间</label>
        </div>
        <div class="input-row">
          <input type="text" v-model="timestampInput" class="input-field timestamp-input" placeholder="输入时间戳（10位或13位）" @input="onTimestampInput">
          <button class="btn btn-primary" @click="convertTimestampToDatetime">转换</button>
        </div>
        <div class="result-box" v-if="datetimeResult">
          <div class="result-label">转换结果：</div>
          <div class="result-value">{{ datetimeResult }}</div>
          <button class="btn-text" @click="copyResult(datetimeResult)">复制</button>
        </div>
      </div>

      <div class="convert-section">
        <div class="section-header">
          <label>北京时间 → 时间戳（逐项输入）</label>
        </div>
        <div class="datetime-inputs">
          <div class="input-group">
            <select v-model="yearValue" class="select-field">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
            <span class="input-label">年</span>
          </div>
          <div class="input-group">
            <select v-model="monthValue" class="select-field">
              <option v-for="m in 12" :key="m" :value="m">{{ m }}</option>
            </select>
            <span class="input-label">月</span>
          </div>
          <div class="input-group">
            <select v-model="dayValue" class="select-field">
              <option v-for="d in dayOptions" :key="d" :value="d">{{ d }}</option>
            </select>
            <span class="input-label">日</span>
          </div>
          <div class="input-group">
            <select v-model="hourValue" class="select-field">
              <option v-for="h in 24" :key="h - 1" :value="h - 1">{{ (h - 1).toString().padStart(2, '0') }}</option>
            </select>
            <span class="input-label">时</span>
          </div>
          <div class="input-group">
            <select v-model="minuteValue" class="select-field">
              <option v-for="m in 60" :key="m - 1" :value="m - 1">{{ (m - 1).toString().padStart(2, '0') }}</option>
            </select>
            <span class="input-label">分</span>
          </div>
          <div class="input-group">
            <select v-model="secondValue" class="select-field">
              <option v-for="s in 60" :key="s - 1" :value="s - 1">{{ (s - 1).toString().padStart(2, '0') }}</option>
            </select>
            <span class="input-label">秒</span>
          </div>
          <div class="input-group">
            <select v-model="millisecondValue" class="select-field">
              <option v-for="ms in 1000" :key="ms - 1" :value="ms - 1">{{ (ms - 1).toString().padStart(3, '0') }}</option>
            </select>
            <span class="input-label">毫秒</span>
          </div>
          <button class="btn btn-primary" @click="convertDatetimeToTimestamp">转换</button>
        </div>
        <div class="result-box" v-if="timestampResult10 || timestampResult13">
          <div class="result-row">
            <div class="result-item">
              <div class="result-label">10位时间戳：</div>
              <div class="result-value">{{ timestampResult10 }}</div>
              <button class="btn-text" @click="copyResult(timestampResult10)">复制</button>
            </div>
          </div>
          <div class="result-row">
            <div class="result-item">
              <div class="result-label">13位时间戳：</div>
              <div class="result-value">{{ timestampResult13 }}</div>
              <button class="btn-text" @click="copyResult(timestampResult13)">复制</button>
            </div>
          </div>
        </div>
      </div>

      <div class="convert-section">
        <div class="section-header">
          <label>北京时间 → 时间戳（快速输入格式：YYYYMMDDHHMMSS）</label>
        </div>
        <div class="input-row">
          <input type="text" v-model="quickInput" class="input-field quick-input" placeholder="例如：20240101120000" @input="onQuickInput">
          <button class="btn btn-primary" @click="convertQuickInput">转换</button>
        </div>
        <div class="quick-hint">格式说明：年月日时分秒，如 20240101120000 表示 2024年01月01日 12:00:00</div>
        <div class="result-box" v-if="quickTimestampResult10 || quickTimestampResult13">
          <div class="result-row">
            <div class="result-item">
              <div class="result-label">10位时间戳：</div>
              <div class="result-value">{{ quickTimestampResult10 }}</div>
              <button class="btn-text" @click="copyResult(quickTimestampResult10)">复制</button>
            </div>
          </div>
          <div class="result-row">
            <div class="result-item">
              <div class="result-label">13位时间戳：</div>
              <div class="result-value">{{ quickTimestampResult13 }}</div>
              <button class="btn-text" @click="copyResult(quickTimestampResult13)">复制</button>
            </div>
          </div>
        </div>
      </div>

      <div class="help-section">
        <div class="help-title">工具介绍</div>
        <div class="help-content">
          <p>Unix时间戳(Unix timestamp)，或Unix时间(Unix time)、POSIX时间(POSIX time)，是一种时间表示方式。</p>
          <p>定义为从格林威治时间1970年01月01日00时00分00秒起至现在的总秒数。</p>
          <p>Unix时间戳不仅被使用在Unix系统、类Unix系统中，也在许多其他操作系统中被广泛采用。</p>
          <p><strong>时间戳类型说明：</strong></p>
          <ul>
            <li><strong>10位时间戳</strong>：秒级精度，表示从1970-01-01 00:00:00 UTC到指定时间的秒数</li>
            <li><strong>13位时间戳</strong>：毫秒级精度，表示从1970-01-01 00:00:00 UTC到指定时间的毫秒数</li>
          </ul>
        </div>
      </div>
    </div>

    <div class="toast" :class="{ show: toastVisible }">
      <span class="toast-icon">✓</span>
      <span class="toast-message">{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWindowWidth } from '@/composables'

const windowWidth = useWindowWidth()

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

const toastVisible = ref(false)
const toastMessage = ref('')

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
    showToast('请输入时间戳')
    return
  }

  const timestamp = parseInt(input)
  if (isNaN(timestamp)) {
    showToast('时间戳格式错误，请输入数字')
    return
  }

  let date
  if (input.length === 10) {
    date = new Date(timestamp * 1000)
  } else if (input.length === 13) {
    date = new Date(timestamp)
  } else {
    showToast('时间戳长度应为10位或13位')
    return
  }

  if (date.toString() === 'Invalid Date') {
    showToast('时间戳无效')
    return
  }

  datetimeResult.value = formatDatetime(date)
  showToast('转换成功')
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
    showToast('日期无效')
    return
  }

  timestampResult10.value = Math.floor(date.getTime() / 1000).toString()
  timestampResult13.value = date.getTime().toString()
  showToast('转换成功')
}

function onQuickInput() {
  quickTimestampResult10.value = ''
  quickTimestampResult13.value = ''
}

function convertQuickInput() {
  const input = quickInput.value.trim()
  if (!input) {
    showToast('请输入日期时间')
    return
  }

  if (input.length !== 14) {
    showToast('格式应为14位数字：YYYYMMDDHHMMSS')
    return
  }

  const year = parseInt(input.substring(0, 4))
  const month = parseInt(input.substring(4, 6))
  const day = parseInt(input.substring(6, 8))
  const hour = parseInt(input.substring(8, 10))
  const minute = parseInt(input.substring(10, 12))
  const second = parseInt(input.substring(12, 14))

  if (month < 1 || month > 12) {
    showToast('月份应在1-12之间')
    return
  }
  if (day < 1 || day > 31) {
    showToast('日期应在1-31之间')
    return
  }
  if (hour < 0 || hour > 23) {
    showToast('小时应在0-23之间')
    return
  }
  if (minute < 0 || minute > 59) {
    showToast('分钟应在0-59之间')
    return
  }
  if (second < 0 || second > 59) {
    showToast('秒应在0-59之间')
    return
  }

  const date = new Date(year, month - 1, day, hour, minute, second)
  if (date.toString() === 'Invalid Date') {
    showToast('日期无效')
    return
  }

  quickTimestampResult10.value = Math.floor(date.getTime() / 1000).toString()
  quickTimestampResult13.value = date.getTime().toString()
  showToast('转换成功')
}

function copyResult(text) {
  if (!text) return
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      showToast('已复制到剪贴板')
    } catch (e) {
      showToast('复制失败，请手动复制')
    }
    document.body.removeChild(textarea)
  })
}

function showToast(message) {
  toastMessage.value = message
  toastVisible.value = true
  setTimeout(() => {
    toastVisible.value = false
  }, 2000)
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
.unix-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  overflow: hidden;
}

.unix-container header {
  background: var(--primary-gradient);
  color: white;
  padding: 20px 24px 16px;
  text-align: center;
  flex-shrink: 0;
}

.unix-container header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 24px;
  margin-bottom: 6px;
}

.unix-container header h1 .header-icon {
  width: 28px;
  height: 28px;
}

.unix-container header .subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.unix-content {
  padding: 20px 24px;
  flex: 1;
  overflow-y: auto;
  background: rgba(248, 249, 250, 0.5);
}

.current-timestamp-section,
.convert-section {
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 16px;
}

.section-header {
  margin-bottom: 12px;
}

.section-header label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.timestamp-display {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.timestamp-item {
  flex: 1;
  padding: 16px;
  background: rgba(248, 249, 250, 0.5);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.timestamp-item:hover {
  border-color: var(--primary-color);
}

.timestamp-item.active {
  border-color: var(--primary-color);
  background: rgba(102, 126, 234, 0.1);
}

.timestamp-value {
  font-size: 20px;
  font-weight: 700;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--primary-color);
  margin-bottom: 6px;
}

.timestamp-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.current-datetime {
  padding: 10px 16px;
  background: rgba(102, 126, 234, 0.08);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  gap: 8px;
}

.datetime-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.datetime-value {
  font-size: 15px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--primary-color);
}

.input-row {
  display: flex;
  gap: 10px;
}

.input-field {
  flex: 1;
  padding: 10px 14px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  background: var(--glass-bg);
  color: var(--text-primary);
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.timestamp-input,
.quick-input {
  font-family: 'Consolas', 'Monaco', monospace;
}

.datetime-inputs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.select-field {
  padding: 8px 10px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--glass-bg);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 60px;
}

.select-field:focus {
  outline: none;
  border-color: var(--primary-color);
}

.input-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.quick-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.result-box {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: var(--radius-sm);
}

.result-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.result-value {
  font-size: 16px;
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: #15803d;
}

.result-row {
  margin-bottom: 8px;
}

.result-row:last-child {
  margin-bottom: 0;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result-item .result-label {
  flex-shrink: 0;
  margin-bottom: 0;
}

.result-item .result-value {
  flex: 1;
}

.btn-text {
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: var(--primary-color);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.btn-text:hover {
  color: var(--primary-color-dark);
}

.help-section {
  background: rgba(248, 249, 250, 0.5);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
}

.help-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.help-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.help-content p {
  margin-bottom: 8px;
}

.help-content ul {
  margin: 8px 0;
  padding-left: 20px;
}

.help-content li {
  margin-bottom: 4px;
}
</style>