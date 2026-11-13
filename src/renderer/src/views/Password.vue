<template>
  <PageLayout tool-path="/password" page-class="password-page">
    <template #actions>
      <button class="btn btn-primary btn-sm" @click="generate">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
        生成密码
      </button>
    </template>

    <div class="page-body">
      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">生成结果</span>
        </div>
        <div class="panel-body">
          <div class="password-output-wrapper">
            <input
              v-model="password"
              :type="visible ? 'text' : 'password'"
              class="password-output"
              readonly
              placeholder="点击「生成密码」创建密码"
            />
            <button class="btn-icon" title="显示/隐藏" @click="visible = !visible">
              <svg
                v-if="visible"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.45 3.55M1 1l22 22"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button class="btn-icon" title="复制密码" @click="copyPassword">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">密码选项</span>
        </div>
        <div class="panel-body">
          <div class="field">
            <div class="field-head">
              <label>密码长度</label>
              <span class="length-value">{{ length }}</span>
            </div>
            <input
              v-model="length"
              type="range"
              class="password-slider"
              min="1"
              max="100"
              :style="{ '--progress': progress + '%' }"
              @input="onSliderInput"
            />
            <div class="slider-labels">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>

          <div class="field">
            <label>字符类型</label>
            <div class="checkbox-group">
              <label class="checkbox-card" :class="{ active: useUpper }">
                <input v-model="useUpper" type="checkbox" hidden />
                <span class="checkbox-icon">A</span>
                <span class="checkbox-text">
                  <span class="checkbox-label">大写字母</span>
                  <span class="checkbox-desc">A-Z</span>
                </span>
              </label>
              <label class="checkbox-card" :class="{ active: useLower }">
                <input v-model="useLower" type="checkbox" hidden />
                <span class="checkbox-icon">a</span>
                <span class="checkbox-text">
                  <span class="checkbox-label">小写字母</span>
                  <span class="checkbox-desc">a-z</span>
                </span>
              </label>
              <label class="checkbox-card" :class="{ active: useNumbers }">
                <input v-model="useNumbers" type="checkbox" hidden />
                <span class="checkbox-icon">0</span>
                <span class="checkbox-text">
                  <span class="checkbox-label">数字</span>
                  <span class="checkbox-desc">0-9</span>
                </span>
              </label>
              <label class="checkbox-card" :class="{ active: useSymbols }">
                <input v-model="useSymbols" type="checkbox" hidden />
                <span class="checkbox-icon">#</span>
                <span class="checkbox-text">
                  <span class="checkbox-label">特殊字符</span>
                  <span class="checkbox-desc">!@#$%</span>
                </span>
              </label>
            </div>
          </div>

          <div class="field strength-field">
            <div class="field-head">
              <label>密码强度</label>
              <span class="strength-text" :class="strengthClass">{{ strengthText }}</span>
            </div>
            <div class="strength-bar">
              <div class="strength-fill" :class="strengthClass" />
            </div>
            <div class="strength-hint">{{ strengthHint }}</div>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <span class="panel-title">历史记录</span>
          <div class="panel-actions">
            <button class="btn btn-danger btn-sm" @click="clearHistory">清空</button>
          </div>
        </div>
        <div class="panel-body history-body">
          <div v-if="history.length === 0" class="history-empty">暂无历史记录</div>
          <div v-for="(item, index) in history" :key="index" class="history-item">
            <span class="password-text">{{ maskPassword(item) }}</span>
            <span class="password-length">{{ item.length }} 位</span>
            <button class="btn-icon btn-sm" title="复制" @click="handleCopyHistoryItem(item)">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" />
  </PageLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useToast } from '@/composables'
import { copyToClipboard } from '@/utils'
import Toast from '@/components/Toast.vue'
import PageLayout from '@/layouts/PageLayout.vue'

const { toastVisible, toastMessage, toastType, showSuccess, showError, showWarning } = useToast()

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  special: '!@#$%^&*()_+-=[]{}|;:,.<>?'
}

const password = ref('')
const length = ref(18)
const useUpper = ref(true)
const useLower = ref(true)
const useNumbers = ref(true)
const useSymbols = ref(false)
const visible = ref(true)
const history = ref([])

const progress = computed(() => ((length.value - 1) / 99) * 100)

const minLength = computed(() => {
  let count = 0
  if (useUpper.value) count++
  if (useLower.value) count++
  if (useNumbers.value) count++
  if (useSymbols.value) count++
  return Math.max(count, 1)
})

function onSliderInput() {
  if (length.value < minLength.value) {
    length.value = minLength.value
  }
}

const strengthClass = computed(() => {
  const score = estimateScore()
  if (score < 25) return 'very-weak'
  if (score < 50) return 'weak'
  if (score < 60) return 'average'
  if (score < 70) return 'strong'
  return 'very-strong'
})

const strengthText = computed(() => {
  if (!useUpper.value && !useLower.value && !useNumbers.value && !useSymbols.value) {
    return '请选择字符类型'
  }
  const score = estimateScore()
  if (score < 25) return '非常弱'
  if (score < 50) return '弱'
  if (score < 60) return '一般'
  if (score < 70) return '强'
  return '非常强'
})

const strengthHint = computed(() => {
  if (!useUpper.value && !useLower.value && !useNumbers.value && !useSymbols.value) {
    return '建议同时使用大小写字母、数字和特殊字符'
  }
  const score = estimateScore()
  if (score < 25) return '极易被破解，不建议使用'
  if (score < 50) return '不建议使用，建议增加长度和字符类型'
  if (score < 60) return '强度一般，建议添加特殊字符'
  if (score < 70) return '密码强度良好'
  return '密码强度优秀'
})

function estimateScore() {
  let score = 0
  const len = length.value
  const hasUpper = useUpper.value
  const hasLower = useLower.value
  const hasNumbers = useNumbers.value
  const hasSymbols = useSymbols.value

  if (len <= 4) score += 5
  else if (len <= 7) score += 10
  else score += 25

  const hasLetters = hasUpper || hasLower
  if (!hasLetters) score += 0
  else if (hasUpper && hasLower) score += 20
  else score += 10

  if (!hasNumbers) score += 0
  else {
    const charTypeCount = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSymbols ? 1 : 0)
    const estimatedNumbers = len / charTypeCount
    if (estimatedNumbers >= 2) score += 20
    else score += 10
  }

  if (!hasSymbols) score += 0
  else {
    const charTypeCount = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSymbols ? 1 : 0)
    const estimatedSymbols = len / charTypeCount
    if (estimatedSymbols >= 2) score += 25
    else score += 10
  }

  if (hasUpper && hasLower && hasNumbers && hasSymbols) score += 5
  else if (hasLetters && hasNumbers && hasSymbols) score += 3
  else if (hasLetters && hasNumbers) score += 2

  return score
}

function generate() {
  let chars = ''
  if (useUpper.value) chars += CHAR_SETS.uppercase
  if (useLower.value) chars += CHAR_SETS.lowercase
  if (useNumbers.value) chars += CHAR_SETS.numbers
  if (useSymbols.value) chars += CHAR_SETS.special

  if (!chars) {
    showWarning('请至少选择一种字符类型')
    useLower.value = true
    return
  }

  const requiredChars = []
  if (useUpper.value) requiredChars.push(getRandomChar(CHAR_SETS.uppercase))
  if (useLower.value) requiredChars.push(getRandomChar(CHAR_SETS.lowercase))
  if (useNumbers.value) requiredChars.push(getRandomChar(CHAR_SETS.numbers))
  if (useSymbols.value) requiredChars.push(getRandomChar(CHAR_SETS.special))

  const remainingLength = Math.max(0, length.value - requiredChars.length)
  let result = ''
  const array = new Uint32Array(remainingLength)
  crypto.getRandomValues(array)

  for (let i = 0; i < remainingLength; i++) {
    result += chars[array[i] % chars.length]
  }

  result = shuffleString(result + requiredChars.join(''))
  password.value = result

  addToHistory(result)
  showSuccess('密码已生成')
}

function getRandomChar(charSet) {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return charSet[array[0] % charSet.length]
}

function shuffleString(str) {
  const array = str.split('')
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array.join('')
}

async function copyPassword() {
  if (password.value) {
    const success = await copyToClipboard(password.value)
    if (success) {
      showSuccess('已复制到剪贴板')
    } else {
      showError('复制失败')
    }
  }
}

function clearHistory() {
  history.value = []
  localStorage.removeItem('password_history')
  showSuccess('历史记录已清空')
}

function addToHistory(pwd) {
  history.value = history.value.filter((p) => p !== pwd)
  history.value.unshift(pwd)
  if (history.value.length > 10) {
    history.value = history.value.slice(0, 10)
  }
  saveHistory()
}

function maskPassword(pwd) {
  if (pwd.length <= 4) return '*'.repeat(pwd.length)
  return pwd.substring(0, 2) + '*'.repeat(pwd.length - 4) + pwd.substring(pwd.length - 2)
}

function saveHistory() {
  localStorage.setItem('password_history', JSON.stringify(history.value))
}

function loadHistory() {
  const saved = localStorage.getItem('password_history')
  if (saved) {
    history.value = JSON.parse(saved)
  }
}

async function handleCopyHistoryItem(item) {
  const success = await copyToClipboard(item)
  if (success) {
    showSuccess('已复制到剪贴板')
  } else {
    showError('复制失败')
  }
}

watch([useUpper, useLower, useNumbers, useSymbols], () => {
  if (!useUpper.value && !useLower.value && !useNumbers.value && !useSymbols.value) {
    useLower.value = true
  }
  if (length.value < minLength.value) {
    length.value = minLength.value
  }
})

onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.page-body {
  padding: 12px 16px 16px;
  width: 100%;
}

.password-output-wrapper {
  display: flex;
  gap: 8px;
}

.password-output-wrapper .btn-icon {
  width: 40px;
  height: 40px;
}

.password-output {
  flex: 1;
  height: 40px;
  padding: 0 14px;
  font-size: var(--font-size-md);
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 1.5px;
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  text-align: center;
}

.password-output::placeholder {
  font-size: var(--font-size-sm);
  letter-spacing: normal;
}

.password-output:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.field {
  margin-bottom: 16px;
}

.field:last-child {
  margin-bottom: 0;
}

.field > label,
.field-head label {
  display: block;
  margin-bottom: 8px;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.field-head label {
  margin-bottom: 8px;
}

.length-value {
  font-size: var(--font-size-md);
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--text-primary);
}

.password-slider {
  width: 100%;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

.password-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  margin-top: -6px;
  background: var(--primary-color);
  border: 2px solid var(--surface);
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
}

.password-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    var(--slider-fill) 0%,
    var(--slider-fill) var(--progress, 18%),
    var(--border-color) var(--progress, 18%),
    var(--border-color) 100%
  );
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.checkbox-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.checkbox-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.checkbox-card:hover {
  border-color: var(--border-strong);
}

.checkbox-card.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: rgba(var(--accent-rgb), 0.05);
}

.checkbox-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: var(--font-size-base);
  font-weight: 700;
  background: var(--surface-muted);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
}

.checkbox-card.active .checkbox-icon {
  background: var(--primary-color);
  color: var(--text-inverse);
}

.checkbox-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.checkbox-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
}

.checkbox-desc {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.strength-bar {
  height: 6px;
  background: var(--surface-muted);
  border-radius: 3px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  width: 0%;
  border-radius: 3px;
  transition:
    width 0.25s ease,
    background-color 0.25s ease;
}

.strength-fill.very-weak {
  width: 10%;
  background: var(--error-dark);
}
.strength-fill.weak {
  width: 25%;
  background: var(--error-color);
}
.strength-fill.average {
  width: 50%;
  background: var(--warning-color);
}
.strength-fill.strong {
  width: 75%;
  background: var(--success-color);
}
.strength-fill.very-strong {
  width: 100%;
  background: var(--success-dark);
}

.strength-text {
  font-size: var(--font-size-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.strength-text.very-weak {
  color: var(--error-darker);
  background: rgba(var(--error-rgb), 0.1);
}
.strength-text.weak {
  color: var(--error-dark);
  background: rgba(var(--error-rgb), 0.08);
}
.strength-text.average {
  color: var(--warning-dark);
  background: rgba(var(--warning-rgb), 0.12);
}
.strength-text.strong {
  color: var(--success-dark);
  background: rgba(var(--success-rgb), 0.1);
}
.strength-text.very-strong {
  color: var(--success-darker);
  background: rgba(var(--success-rgb), 0.14);
}

.strength-hint {
  margin-top: 8px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.history-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-empty {
  padding: 16px;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-sm);
}

.password-text {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.password-length {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  padding: 2px 6px;
  background: var(--surface);
  border-radius: 4px;
}
</style>
