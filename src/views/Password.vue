<template>
  <div class="password-container" :style="{ width: windowWidth + 'px' }">
    <header>
      <h1>🔐 密码生成器</h1>
      <div class="subtitle">随机安全密码生成工具</div>
    </header>
    <div class="password-content">
      <div class="password-display-section">
        <div class="password-output-wrapper">
          <input type="text" v-model="password" class="password-output" readonly placeholder="点击生成按钮创建密码" :type="visible ? 'text' : 'password'">
          <button class="btn-icon" title="显示/隐藏" @click="visible = !visible">{{ visible ? '🙈' : '👁️' }}</button>
          <button class="btn-icon" title="复制密码" @click="copyPassword">📋</button>
        </div>
        <button class="btn btn-primary btn-lg generate-btn" @click="generate">🔄 生成密码</button>
      </div>

      <div class="section">
        <div class="length-header">
          <label>密码长度</label>
          <span class="length-value">{{ length }}</span>
        </div>
        <div class="slider-container">
          <input type="range" class="password-slider" v-model="length" min="1" max="100" :style="{ '--progress': progress + '%' }" @input="onSliderInput">
          <div class="slider-labels">
            <span>1</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
        </div>
      </div>

      <div class="section">
        <label class="section-title">字符类型</label>
        <div class="checkbox-group">
          <label class="checkbox-card" :class="{ active: useUpper }" data-type="uppercase">
            <input type="checkbox" v-model="useUpper" hidden>
            <span class="checkbox-icon">🔠</span>
            <span class="checkbox-label">大写字母</span>
            <span class="checkbox-desc">A-Z</span>
          </label>
          <label class="checkbox-card" :class="{ active: useLower }" data-type="lowercase">
            <input type="checkbox" v-model="useLower" hidden>
            <span class="checkbox-icon">🔡</span>
            <span class="checkbox-label">小写字母</span>
            <span class="checkbox-desc">a-z</span>
          </label>
          <label class="checkbox-card" :class="{ active: useNumbers }" data-type="numbers">
            <input type="checkbox" v-model="useNumbers" hidden>
            <span class="checkbox-icon">🔢</span>
            <span class="checkbox-label">数字</span>
            <span class="checkbox-desc">0-9</span>
          </label>
          <label class="checkbox-card" :class="{ active: useSymbols }" data-type="special">
            <input type="checkbox" v-model="useSymbols" hidden>
            <span class="checkbox-icon">⚡</span>
            <span class="checkbox-label">特殊字符</span>
            <span class="checkbox-desc">!@#$%</span>
          </label>
        </div>
      </div>

      <div class="section">
        <div class="strength-header">
          <label>密码强度</label>
          <span class="strength-text" :class="strengthClass">{{ strengthText }}</span>
        </div>
        <div class="strength-meter">
          <div class="strength-bar">
            <div class="strength-fill" :class="strengthClass"></div>
          </div>
        </div>
        <div class="strength-hint">{{ strengthHint }}</div>
      </div>

      <div class="section history-section">
        <div class="history-header">
          <label class="section-title">历史记录</label>
          <button class="btn-text" @click="clearHistory">清空</button>
        </div>
        <div class="history-list">
          <div class="history-empty" v-if="history.length === 0">暂无历史记录</div>
          <div class="history-item" v-for="(item, index) in history" :key="index">
            <span class="password-text">{{ maskPassword(item) }}</span>
            <span class="password-length">{{ item.length }}位</span>
            <button class="copy-btn" title="复制" @click="copyToClipboard(item)">📋</button>
          </div>
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

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
const toastVisible = ref(false)
const toastMessage = ref('')
const windowWidth = ref(900)

const progress = computed(() => ((length.value - 1) / 99) * 100)

function updateWindowWidth() {
  windowWidth.value = window.innerWidth < 900 ? window.innerWidth : 900
}

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
    showToast('请至少选择一种字符类型')
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
  showToast('密码已生成')
}

function getRandomChar(charSet) {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return charSet[array[0] % charSet.length]
}

function shuffleString(str) {
  const array = str.split('')
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
  return array.join('')
}

function copyPassword() {
  if (password.value) {
    copyToClipboard(password.value)
  }
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板')
  }).catch(() => {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    showToast('已复制到剪贴板')
  })
}

function addToHistory(pwd) {
  history.value = history.value.filter(p => p !== pwd)
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

function clearHistory() {
  history.value = []
  localStorage.removeItem('password_history')
  showToast('历史记录已清空')
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

function showToast(msg) {
  toastMessage.value = msg
  toastVisible.value = true
  setTimeout(() => {
    toastVisible.value = false
  }, 2000)
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
  updateWindowWidth()
  window.addEventListener('resize', updateWindowWidth)
  loadHistory()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<style scoped>
.password-container {
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  overflow: hidden;
}

.password-container header {
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.95) 0%, 
    rgba(118, 75, 162, 0.95) 100%
  );
  color: white;
  padding: 30px;
  text-align: center;
  flex-shrink: 0;
}

.password-container header h1 {
  font-size: 28px;
  margin-bottom: 10px;
  font-weight: 600;
}

.password-container .subtitle {
  font-size: 14px;
  opacity: 0.9;
}

.password-content {
  padding: 30px;
  flex: 1;
  overflow-y: auto;
}

.password-display-section {
  text-align: center;
  margin-bottom: 30px;
}

.password-output-wrapper {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.password-output {
  flex: 1;
  padding: 16px 20px;
  font-size: 18px;
  font-family: 'Consolas', 'Monaco', monospace;
  letter-spacing: 2px;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  text-align: center;
}

.password-output:focus {
  outline: none;
  border-color: var(--primary-color);
}

.btn-icon {
  width: 52px;
  height: 52px;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  background: white;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  border-color: var(--primary-color);
  background: var(--glass-bg-hover);
}

.generate-btn {
  width: 100%;
  padding: 16px;
}

.section {
  margin-bottom: 28px;
}

.section-title {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
  font-size: 14px;
}

.length-header,
.strength-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.length-header label,
.strength-header label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.length-value {
  font-weight: 700;
  color: var(--primary-color);
  font-size: 24px;
}

.slider-container {
  padding: 10px 0;
}

.password-slider {
  width: 100%;
  height: 8px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
  position: relative;
  z-index: 2;
}

.password-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 28px;
  height: 28px;
  background: var(--primary-gradient);
  border-radius: 50%;
  cursor: grab;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
  border: 3px solid white;
  margin-top: -10px;
}

.password-slider::-webkit-slider-thumb:active {
  cursor: grabbing;
  transform: scale(1.1);
}

.password-slider::-webkit-slider-runnable-track {
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(to right, var(--primary-color) 0%, var(--primary-color) var(--progress, 18%), var(--border-color) var(--progress, 18%), var(--border-color) 100%);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.slider-labels span {
  text-decoration: none;
  border: none;
  background: transparent;
  position: relative;
}

.slider-labels span::before,
.slider-labels span::after {
  display: none !important;
  content: none !important;
  border: none !important;
  background: none !important;
}

.checkbox-group {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.checkbox-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 4px;
  background: white;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: center;
  min-width: 0;
  transition: var(--transition-normal);
}

.checkbox-card:hover {
  border-color: rgba(102, 126, 234, 0.4);
}

.checkbox-card.active {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
}

.checkbox-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.checkbox-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
  white-space: nowrap;
}

.checkbox-desc {
  font-size: 10px;
  color: var(--text-tertiary);
}

.strength-meter {
  margin-bottom: 8px;
}

.strength-bar {
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  width: 0%;
  border-radius: 4px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

.strength-fill.very-weak { width: 10%; background: linear-gradient(90deg, #7f1d1d, #991b1b); }
.strength-fill.weak { width: 25%; background: linear-gradient(90deg, #ef4444, #dc2626); }
.strength-fill.average { width: 50%; background: linear-gradient(90deg, #f59e0b, #d97706); }
.strength-fill.strong { width: 75%; background: linear-gradient(90deg, #22c55e, #16a34a); }
.strength-fill.very-strong { width: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); }

.strength-text {
  font-weight: 600;
  font-size: 14px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
}

.strength-text.very-weak { color: #7f1d1d; background: rgba(127, 29, 29, 0.1); }
.strength-text.weak { color: #dc2626; background: rgba(220, 38, 38, 0.1); }
.strength-text.average { color: #d97706; background: rgba(217, 119, 6, 0.1); }
.strength-text.strong { color: #16a34a; background: rgba(22, 163, 74, 0.1); }
.strength-text.very-strong { color: #2563eb; background: rgba(37, 99, 235, 0.1); }

.strength-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: center;
}

.history-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.btn-text {
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 13px;
  cursor: pointer;
}

.btn-text:hover {
  color: var(--error-color);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-empty {
  text-align: center;
  color: var(--text-tertiary);
  padding: 20px;
  font-size: 13px;
  background: rgba(248, 249, 250, 0.8);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.history-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: rgba(248, 249, 250, 0.8);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.history-item:last-child {
  margin-bottom: 0;
}

.password-text {
  flex: 1;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.password-length {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-right: 8px;
  padding: 2px 6px;
  background: var(--border-color);
  border-radius: 4px;
}

.copy-btn {
  padding: 4px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.6;
}

.copy-btn:hover {
  opacity: 1;
}

.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background: var(--success-color);
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s ease;
  z-index: 1000;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-icon {
  width: 20px;
  height: 20px;
  background: white;
  color: var(--success-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}
</style>