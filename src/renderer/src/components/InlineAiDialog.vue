<template>
  <Teleport to="body">
    <div v-if="visible" class="inline-ai-overlay">
      <section class="inline-ai-dialog" role="dialog" aria-modal="true" aria-labelledby="inline-ai-title">
        <header class="inline-ai-head">
          <div class="inline-ai-heading">
            <span class="inline-ai-badge">
              <AppIcon name="sparkles" />
            </span>
            <div>
              <h3 id="inline-ai-title" class="inline-ai-title">{{ t('AI 处理选中内容') }}</h3>
              <p class="inline-ai-summary">{{ t('已选中 {p0} 个字符', { p0: text.length }) }}</p>
            </div>
          </div>
          <button type="button" class="btn-icon btn-sm" :title="t('关闭')" @click="requestClose">
            <AppIcon name="close" />
          </button>
        </header>

        <div class="inline-ai-actions">
          <button
            v-for="action in actions"
            :key="action.id"
            type="button"
            class="inline-ai-chip"
            :class="{ active: activeAction === action.id }"
            :disabled="loading"
            @click="run(action.id)"
          >
            {{ t(action.label) }}
          </button>
        </div>

        <div class="inline-ai-block">
          <div class="inline-ai-block-head">
            <span>{{ t('原文') }}</span>
            <span>{{ t('{p0} 字符', { p0: text.length }) }}</span>
          </div>
          <pre class="inline-ai-source">{{ text }}</pre>
        </div>

        <div class="inline-ai-block inline-ai-block-result">
          <div class="inline-ai-block-head">
            <span>{{ t('处理结果') }}</span>
            <span v-if="model" class="inline-ai-model">{{ model }}</span>
          </div>
          <div v-if="loading" class="inline-ai-loading">
            <span class="inline-ai-spinner" />
            <span>{{ cancelling ? t('正在取消…') : t('正在调用模型…') }}</span>
            <button type="button" class="btn btn-secondary btn-xs" :disabled="cancelling" @click="cancel">
              {{ t('取消') }}
            </button>
          </div>
          <p v-else-if="error" class="inline-ai-error">{{ error }}</p>
          <AppTextarea
            v-else
            v-model="result"
            class="inline-ai-textarea"
            spellcheck="false"
            :placeholder="t('结果会显示在这里，可先修改再应用')"
          />
        </div>

        <footer class="inline-ai-foot">
          <span class="inline-ai-hint">{{ t('使用「设置 → 模型」中当前服务商的默认模型') }}</span>
          <div class="inline-ai-foot-actions">
            <button type="button" class="btn btn-secondary btn-sm" :disabled="loading || !result" @click="copyResult">
              {{ copied ? t('已复制') : t('复制结果') }}
            </button>
            <button type="button" class="btn btn-secondary btn-sm" @click="requestClose">{{ t('关闭') }}</button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              :disabled="loading || !result.trim()"
              @click="applyResult"
            >
              {{ applyLabelText }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { t } from '@/i18n'
import { cancelInlineAi, inlineAi } from '@/api'
import { copyToClipboard } from '@/utils/clipboard'
import { actionsForContext } from '@shared/inlineAi'

import AppIcon from '@/components/AppIcon.vue'
import AppTextarea from '@/components/AppTextarea.vue'
const props = defineProps({
  visible: { type: Boolean, default: false },
  text: { type: String, default: '' },
  context: { type: String, default: 'text' },
  applyLabel: { type: String, default: '' }
})

const emit = defineEmits(['apply', 'close'])

const actions = computed(() => actionsForContext(props.context))
const applyLabelText = computed(() => props.applyLabel || t('替换选中内容'))

const activeAction = ref('')
const result = ref('')
const error = ref('')
const model = ref('')
const loading = ref(false)
const cancelling = ref(false)
const copied = ref(false)
const requestId = ref('')

let copiedTimer = null

function reset() {
  activeAction.value = ''
  result.value = ''
  error.value = ''
  model.value = ''
  loading.value = false
  cancelling.value = false
  copied.value = false
  requestId.value = ''
}

function cancelActive() {
  if (!requestId.value) return
  void cancelInlineAi(requestId.value)
  requestId.value = ''
}

async function run(actionId) {
  if (loading.value) return
  activeAction.value = actionId
  result.value = ''
  error.value = ''
  model.value = ''
  cancelling.value = false
  loading.value = true
  const id = `inline_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  requestId.value = id
  const res = await inlineAi({ action: actionId, text: props.text, requestId: id })
  if (requestId.value !== id) return
  requestId.value = ''
  loading.value = false
  cancelling.value = false
  if (!res || res.success !== true) {
    error.value = res?.cancelled ? t('已取消') : res?.error || t('AI 请求失败')
    return
  }
  result.value = res.content
  model.value = res.model || ''
}

function cancel() {
  if (!requestId.value || cancelling.value) return
  cancelling.value = true
  void cancelInlineAi(requestId.value)
}

function requestClose() {
  cancelActive()
  emit('close')
}

async function copyResult() {
  if (!result.value) return
  await copyToClipboard(result.value)
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 1600)
}

function applyResult() {
  const value = result.value.trim()
  if (!value) return
  emit('apply', value)
  emit('close')
}

function onKeydown(event) {
  if (event.key === 'Escape' && props.visible) requestClose()
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      reset()
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
    }
  }
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(copiedTimer)
  cancelActive()
})
</script>

<style scoped>
.inline-ai-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 9999;
}

.inline-ai-dialog {
  width: 720px;
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  animation: inline-ai-in var(--motion-panel) var(--motion-ease);
}

.inline-ai-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.inline-ai-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.inline-ai-badge {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent-color);
}

.inline-ai-badge svg {
  width: var(--icon-size-sm);
  height: var(--icon-size-sm);
}

.inline-ai-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}

.inline-ai-summary {
  margin: 2px 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
}

.inline-ai-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.inline-ai-chip {
  padding: 5px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-pill);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--motion-ease),
    border-color var(--motion-fast) var(--motion-ease),
    color var(--motion-fast) var(--motion-ease);
}

.inline-ai-chip:hover:not(:disabled) {
  border-color: var(--accent-color);
  color: var(--accent-color);
}

.inline-ai-chip.active {
  border-color: var(--accent-color);
  background: rgba(var(--accent-rgb), 0.14);
  color: var(--accent-color);
}

.inline-ai-chip:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.inline-ai-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.inline-ai-block-result {
  flex: 1;
}

.inline-ai-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.inline-ai-model {
  font-family: var(--font-mono);
  color: var(--accent-color);
}

.inline-ai-source {
  margin: 0;
  max-height: 110px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.inline-ai-textarea {
  min-height: 160px;
  flex: 1;
  font-size: var(--font-size-base);
}

.inline-ai-loading,
.inline-ai-error {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 120px;
  justify-content: center;
  margin: 0;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.inline-ai-error {
  color: var(--error-color);
  padding: 12px;
  text-align: center;
}

.inline-ai-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(var(--accent-rgb), 0.25);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: inline-ai-spin 0.8s linear infinite;
}

@keyframes inline-ai-spin {
  to {
    transform: rotate(360deg);
  }
}

.inline-ai-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.inline-ai-hint {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.inline-ai-foot-actions {
  display: flex;
  gap: 8px;
}

/* 入场动画只作用于卡片：遮罩层始终不透明，动画帧被节流时也不会留下不可见却拦截点击的全屏层 */
@keyframes inline-ai-in {
  from {
    transform: translateY(8px) scale(0.98);
    opacity: 0.85;
  }
}

@media (prefers-reduced-motion: reduce) {
  .inline-ai-spinner {
    animation-duration: 2s;
  }

  .inline-ai-dialog {
    animation: none;
  }
}

@media (max-width: 720px) {
  .inline-ai-dialog {
    padding: 16px;
  }

  .inline-ai-foot {
    align-items: flex-end;
  }
}
</style>
