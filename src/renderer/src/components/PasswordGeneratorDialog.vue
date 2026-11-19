<template>
  <Teleport to="body">
    <div v-if="visible" class="generator-overlay" @click.self="emit('close')">
      <section class="generator-dialog" role="dialog" aria-modal="true" aria-labelledby="password-generator-title">
        <header class="generator-header">
          <div>
            <h2 id="password-generator-title">{{ t('密码生成器') }}</h2>
            <span class="generator-sub">{{ t('密码仅在本地生成，不会上传到任何服务器') }}</span>
          </div>
          <button type="button" class="btn-icon" :title="t('关闭')" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <div class="generator-body">
          <div class="generator-output">
            <input
              :value="password"
              :type="revealed ? 'text' : 'password'"
              class="output-field"
              readonly
              :placeholder="t('点击「生成密码」创建密码')"
            />
            <button class="btn-icon" :title="t('显示/隐藏')" @click="revealed = !revealed">
              <svg
                v-if="revealed"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                <path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.45 3.55M1 1l22 22"
                />
              </svg>
            </button>
            <button class="btn-icon" :title="t('复制密码')" :disabled="!password" @click="copyPassword">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>

          <div class="generator-field">
            <div class="field-head">
              <label>{{ t('密码长度') }}</label>
              <span class="length-number">{{ length }}</span>
            </div>
            <input
              v-model.number="length"
              type="range"
              class="generator-slider"
              :min="minLength"
              max="100"
              :style="{ '--progress': progress + '%' }"
              @input="onSliderInput"
            />
            <div class="length-labels">
              <span>1</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>

          <div class="generator-field">
            <label>{{ t('字符类型') }}</label>
            <div class="generator-types">
              <label class="generator-type" :class="{ active: useUpper }">
                <input v-model="useUpper" type="checkbox" hidden />
                <span class="type-icon">A</span>
                <span class="type-text">
                  <span class="type-label">{{ t('大写字母') }}</span>
                  <span class="type-desc">A-Z</span>
                </span>
              </label>
              <label class="generator-type" :class="{ active: useLower }">
                <input v-model="useLower" type="checkbox" hidden />
                <span class="type-icon">a</span>
                <span class="type-text">
                  <span class="type-label">{{ t('小写字母') }}</span>
                  <span class="type-desc">a-z</span>
                </span>
              </label>
              <label class="generator-type" :class="{ active: useNumbers }">
                <input v-model="useNumbers" type="checkbox" hidden />
                <span class="type-icon">0</span>
                <span class="type-text">
                  <span class="type-label">{{ t('数字') }}</span>
                  <span class="type-desc">0-9</span>
                </span>
              </label>
              <label class="generator-type" :class="{ active: useSymbols }">
                <input v-model="useSymbols" type="checkbox" hidden />
                <span class="type-icon">#</span>
                <span class="type-text">
                  <span class="type-label">{{ t('特殊符号') }}</span>
                  <span class="type-desc">!@#$%</span>
                </span>
              </label>
            </div>
          </div>

          <div class="generator-field">
            <div class="field-head">
              <label>{{ t('密码强度') }}</label>
              <span class="strength-badge" :class="strengthClass">{{ strengthText }}</span>
            </div>
            <div class="strength-track">
              <div class="strength-progress" :class="strengthClass" />
            </div>
            <div class="strength-note">{{ strengthHint }}</div>
          </div>

          <div v-if="history.length" class="generator-field">
            <div class="field-head">
              <label>{{ t('历史记录') }}</label>
              <button type="button" class="link-button" @click="clearHistory">{{ t('清空') }}</button>
            </div>
            <div class="generator-history">
              <div v-for="(item, index) in history" :key="index" class="generator-history-item">
                <span class="generator-history-text">{{ maskPassword(item) }}</span>
                <span class="generator-history-length">{{ t('{count} 位', { count: item.length }) }}</span>
                <button class="btn-icon btn-sm" :title="t('复制')" @click="copyText(item)">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer class="generator-footer">
          <span class="footer-spacer" />
          <button type="button" class="btn btn-secondary" @click="emit('close')">{{ t('取消') }}</button>
          <button
            v-if="allowApply"
            type="button"
            class="btn btn-primary"
            :disabled="!password"
            @click="emit('apply', password)"
          >
            {{ t('使用此密码') }}
          </button>
          <button type="button" class="btn" :class="allowApply ? 'btn-secondary' : 'btn-primary'" @click="generate">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            {{ t('生成密码') }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { copyToClipboard } from '@/utils'
import { t } from '@/i18n'

const props = defineProps({
  visible: { type: Boolean, default: false },
  allowApply: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'apply', 'copied', 'copy-failed'])

const HISTORY_KEY = 'password_history'
const HISTORY_LIMIT = 10

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
const revealed = ref(true)
const history = ref(loadHistory())

const progress = computed(() => ((length.value - 1) / 99) * 100)

const minLength = computed(() => {
  let count = 0
  if (useUpper.value) count++
  if (useLower.value) count++
  if (useNumbers.value) count++
  if (useSymbols.value) count++
  return Math.max(count, 1)
})

const strengthClass = computed(() => {
  const score = estimateScore()
  if (score < 25) return 'very-weak'
  if (score < 50) return 'weak'
  if (score < 60) return 'average'
  if (score < 70) return 'strong'
  return 'very-strong'
})

const strengthText = computed(() => {
  if (!hasAnyType.value) return t('请选择字符类型')
  const score = estimateScore()
  if (score < 25) return t('非常弱')
  if (score < 50) return t('弱')
  if (score < 60) return t('一般')
  if (score < 70) return t('强')
  return t('非常强')
})

const strengthHint = computed(() => {
  if (!hasAnyType.value) return t('建议同时使用大小写字母、数字和特殊字符')
  const score = estimateScore()
  if (score < 25) return t('极易被破解，不建议使用')
  if (score < 50) return t('不建议使用，建议增加长度和字符类型')
  if (score < 60) return t('强度一般，建议添加特殊字符')
  if (score < 70) return t('密码强度良好')
  return t('密码强度优秀')
})

const hasAnyType = computed(() => useUpper.value || useLower.value || useNumbers.value || useSymbols.value)

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
    const typeCount = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSymbols ? 1 : 0)
    score += len / typeCount >= 2 ? 20 : 10
  }

  if (!hasSymbols) score += 0
  else {
    const typeCount = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumbers ? 1 : 0) + (hasSymbols ? 1 : 0)
    score += len / typeCount >= 2 ? 25 : 10
  }

  if (hasUpper && hasLower && hasNumbers && hasSymbols) score += 5
  else if (hasLetters && hasNumbers && hasSymbols) score += 3
  else if (hasLetters && hasNumbers) score += 2

  return score
}

function onSliderInput() {
  if (length.value < minLength.value) length.value = minLength.value
}

function generate() {
  if (!hasAnyType.value) {
    useLower.value = true
    return
  }

  let chars = ''
  if (useUpper.value) chars += CHAR_SETS.uppercase
  if (useLower.value) chars += CHAR_SETS.lowercase
  if (useNumbers.value) chars += CHAR_SETS.numbers
  if (useSymbols.value) chars += CHAR_SETS.special

  const requiredChars = []
  if (useUpper.value) requiredChars.push(getRandomChar(CHAR_SETS.uppercase))
  if (useLower.value) requiredChars.push(getRandomChar(CHAR_SETS.lowercase))
  if (useNumbers.value) requiredChars.push(getRandomChar(CHAR_SETS.numbers))
  if (useSymbols.value) requiredChars.push(getRandomChar(CHAR_SETS.special))

  const remainingLength = Math.max(0, length.value - requiredChars.length)
  const array = new Uint32Array(remainingLength)
  crypto.getRandomValues(array)

  let result = ''
  for (let i = 0; i < remainingLength; i++) {
    result += chars[array[i] % chars.length]
  }

  password.value = shuffleString(result + requiredChars.join(''))
  addToHistory(password.value)
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
  if (!password.value) return
  await copyText(password.value)
}

async function copyText(value) {
  const success = await copyToClipboard(value)
  emit(success ? 'copied' : 'copy-failed')
}

function clearHistory() {
  history.value = []
  localStorage.removeItem(HISTORY_KEY)
}

function addToHistory(value) {
  history.value = history.value.filter((item) => item !== value)
  history.value.unshift(value)
  history.value = history.value.slice(0, HISTORY_LIMIT)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value))
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(saved) ? saved.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

function maskPassword(value) {
  if (value.length <= 4) return '*'.repeat(value.length)
  return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
}

function handleKeydown(event) {
  if (event.key !== 'Escape') return
  event.stopPropagation()
  emit('close')
}

watch([useUpper, useLower, useNumbers, useSymbols], () => {
  if (!hasAnyType.value) useLower.value = true
  if (length.value < minLength.value) length.value = minLength.value
})

watch(
  () => props.visible,
  (open) => {
    if (open) {
      revealed.value = true
      password.value = ''
      window.addEventListener('keydown', handleKeydown, true)
    } else {
      window.removeEventListener('keydown', handleKeydown, true)
    }
  }
)

onUnmounted(() => window.removeEventListener('keydown', handleKeydown, true))
</script>

<style scoped>
.generator-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.generator-dialog {
  display: flex;
  flex-direction: column;
  width: 620px;
  max-width: 100%;
  max-height: calc(100vh - 48px);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.generator-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border-color);
}

.generator-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-md);
  font-weight: 600;
}

.generator-sub {
  display: block;
  margin-top: 2px;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.generator-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 18px;
}

.generator-output {
  display: flex;
  gap: 8px;
}

.output-field {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 14px;
  font-size: var(--font-size-md);
  font-family: var(--font-mono, 'Consolas', 'Monaco', monospace);
  letter-spacing: 1.5px;
  text-align: center;
  color: var(--text-primary);
  background: var(--surface-muted);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.output-field:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: var(--shadow-glow);
}

.output-field::placeholder {
  font-size: var(--font-size-sm);
  letter-spacing: normal;
}

.generator-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.generator-field > label,
.field-head label {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.length-number {
  font-size: var(--font-size-md);
  font-weight: 600;
  font-family: 'Consolas', 'Monaco', monospace;
  color: var(--text-primary);
}

.generator-slider {
  width: 100%;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  cursor: pointer;
}

.generator-slider::-webkit-slider-thumb {
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

.generator-slider::-webkit-slider-runnable-track {
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

.length-labels {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.generator-types {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.generator-type {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 54px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.generator-type:hover {
  border-color: var(--border-strong);
}

.generator-type.active {
  border-color: rgba(var(--accent-rgb), 0.45);
  background: rgba(var(--accent-rgb), 0.05);
}

.type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-secondary);
  background: var(--surface-muted);
  border-radius: var(--radius-sm);
}

.generator-type.active .type-icon {
  color: var(--text-inverse);
  background: var(--primary-color);
}

.type-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.type-label {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  white-space: nowrap;
}

.type-desc {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.strength-track {
  height: 6px;
  background: var(--surface-muted);
  border-radius: 3px;
  overflow: hidden;
}

.strength-progress {
  height: 100%;
  width: 0%;
  border-radius: 3px;
  transition:
    width 0.25s ease,
    background-color 0.25s ease;
}

.strength-progress.very-weak {
  width: 10%;
  background: var(--error-dark);
}

.strength-progress.weak {
  width: 25%;
  background: var(--error-color);
}

.strength-progress.average {
  width: 50%;
  background: var(--warning-color);
}

.strength-progress.strong {
  width: 75%;
  background: var(--success-color);
}

.strength-progress.very-strong {
  width: 100%;
  background: var(--success-dark);
}

.strength-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.strength-badge.very-weak {
  color: var(--error-darker);
  background: rgba(var(--error-rgb), 0.1);
}

.strength-badge.weak {
  color: var(--error-dark);
  background: rgba(var(--error-rgb), 0.08);
}

.strength-badge.average {
  color: var(--warning-dark);
  background: rgba(var(--warning-rgb), 0.12);
}

.strength-badge.strong {
  color: var(--success-dark);
  background: rgba(var(--success-rgb), 0.1);
}

.strength-badge.very-strong {
  color: var(--success-darker);
  background: rgba(var(--success-rgb), 0.14);
}

.strength-note {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.link-button {
  padding: 0;
  border: none;
  background: none;
  color: var(--error-dark);
  font-size: var(--font-size-xs);
  cursor: pointer;
}

.link-button:hover {
  text-decoration: underline;
}

.generator-history {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 132px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface-muted);
}

.generator-history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: var(--radius-sm);
}

.generator-history-item:hover {
  background: var(--surface-hover);
}

.generator-history-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.generator-history-length {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.generator-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border-color);
  background: var(--surface-muted);
}

.footer-spacer {
  flex: 1;
}

.generator-footer .btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 560px) {
  .generator-types {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .generator-type,
  .strength-progress {
    transition: none;
  }
}
</style>
