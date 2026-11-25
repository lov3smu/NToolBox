<template>
  <PageLayout tool-path="/codec">
    <div class="page-body devt-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('编码模式') }}</span>
          <span class="panel-hint">{{ t('输入时实时转换，可交换方向继续处理') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-toolbar">
            <button
              v-for="item in EDITOR_MODES"
              :key="item.id"
              type="button"
              class="devt-chip"
              :class="{ 'is-active': editorMode === item.id }"
              :aria-pressed="editorMode === item.id"
              @click="editorMode = item.id"
            >
              {{ t(item.label) }}
            </button>
          </div>
          <div v-if="!isChain" class="devt-toolbar">
            <button
              v-for="item in CODEC_DIRECTIONS"
              :key="item.id"
              type="button"
              class="devt-chip"
              :class="{ 'is-active': direction === item.id }"
              :aria-pressed="direction === item.id"
              @click="direction = item.id"
            >
              {{ t(item.label) }}
            </button>
            <span class="devt-spacer" />
            <button class="btn btn-secondary btn-sm" :disabled="!input" @click="clearAll">{{ t('清空') }}</button>
          </div>
          <div v-else class="codec-chain">
            <div v-for="(step, index) in chainSteps" :key="index" class="codec-chain-step">
              <span class="codec-chain-index">{{ index + 1 }}</span>
              <AppSelect v-model="step.mode" class="codec-chain-select" :options="modeOptions" />
              <AppSelect v-model="step.direction" class="codec-chain-select" :options="directionOptions" />
              <button
                type="button"
                class="codec-chain-remove"
                :disabled="chainSteps.length <= 1"
                :title="t('删除第 {p0} 步', { p0: index + 1 })"
                @click="removeStep(index)"
              >
                ×
              </button>
            </div>
            <div class="devt-toolbar">
              <button
                type="button"
                class="devt-chip"
                :disabled="chainSteps.length >= CODEC_MAX_CHAIN_STEPS"
                @click="addStep"
              >
                {{ t('添加步骤') }}
              </button>
              <span class="devt-hint">{{ t('按顺序依次执行，每一步的输出作为下一步输入') }}</span>
              <span class="devt-spacer" />
              <button class="btn btn-secondary btn-sm" :disabled="!input" @click="clearAll">{{ t('清空') }}</button>
            </div>
          </div>
        </div>
      </section>

      <div class="devt-grid">
        <section class="panel">
          <div class="panel-header">
            <span class="panel-title">
              {{ isChain || direction === 'encode' ? t('原文') : t('已编码文本') }}
            </span>
            <span class="panel-hint">{{ t('{p0} 字符', { p0: input.length }) }}</span>
          </div>
          <div class="panel-body devt-stack">
            <AppTextarea
              v-model="input"
              class="devt-textarea is-fill"
              mono
              :placeholder="t('粘贴或输入需要转换的文本')"
              spellcheck="false"
            />
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <span class="panel-title">
              {{ isChain ? t('转换结果') : direction === 'encode' ? t('编码结果') : t('解码结果') }}
            </span>
            <span class="panel-hint">{{ t('{p0} 字符', { p0: output.length }) }}</span>
          </div>
          <div class="panel-body devt-stack">
            <AppTextarea
              :value="output"
              class="devt-textarea is-fill is-readonly"
              mono
              :placeholder="t('转换结果会显示在这里')"
              readonly
              spellcheck="false"
            />
            <div v-if="errorMessage" class="devt-error">{{ errorMessage }}</div>
            <div class="devt-actions">
              <button v-if="!isChain" class="btn btn-secondary" @click="swap">
                {{ t('交换并反转方向') }}
              </button>
              <CopyButton :text="output" :label="t('复制结果')" variant="primary" />
            </div>
          </div>
        </section>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { t } from '@/i18n'
import CopyButton from '@/components/CopyButton.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import AppSelect from '@/components/AppSelect.vue'
import { CODEC_DIRECTIONS, CODEC_MAX_CHAIN_STEPS, CODEC_MODES, applyCodecChain, transformCodec } from '@shared/codec'
import '@/styles/dev-tools.css'

const EDITOR_MODES = Object.freeze([
  { id: 'single', label: '单步转换' },
  { id: 'chain', label: '转换链' }
])

const editorMode = ref('single')
const mode = ref('base64')
const direction = ref('encode')
const input = ref('')
const chainSteps = ref([{ mode: 'base64', direction: 'encode' }])

const isChain = computed(() => editorMode.value === 'chain')
const modeOptions = computed(() => CODEC_MODES.map((item) => ({ value: item.id, label: t(item.label) })))
const directionOptions = computed(() => CODEC_DIRECTIONS.map((item) => ({ value: item.id, label: t(item.label) })))

const result = computed(() =>
  isChain.value
    ? applyCodecChain(chainSteps.value, input.value)
    : transformCodec(mode.value, direction.value, input.value)
)
const output = computed(() => (result.value.ok ? result.value.value : ''))

const errorMessage = computed(() => {
  if (result.value.ok || !input.value) return ''
  let message
  switch (result.value.error) {
    case 'invalid-base64':
      message = t('Base64 解码失败，请检查输入')
      break
    case 'invalid-url':
      message = t('URL 解码失败，存在无效的转义序列')
      break
    case 'invalid-hex':
      message = t('十六进制格式无效，只允许 0-9 与 a-f')
      break
    case 'invalid-utf8':
      message = t('解码结果不是有效的 UTF-8 文本')
      break
    case 'invalid-json':
      message = t('JSON 字符串格式无效')
      break
    case 'unsupported-mode':
      message = t('不支持的编码模式')
      break
    default:
      message = t('转换失败')
  }
  if (Number.isInteger(result.value.stepIndex)) {
    return t('第 {p0} 步：{p1}', { p0: result.value.stepIndex + 1, p1: message })
  }
  return message
})

function addStep() {
  if (chainSteps.value.length >= CODEC_MAX_CHAIN_STEPS) return
  const last = chainSteps.value[chainSteps.value.length - 1]
  chainSteps.value.push({ mode: last?.mode || 'base64', direction: last?.direction || 'encode' })
}

function removeStep(index) {
  if (chainSteps.value.length <= 1) return
  chainSteps.value.splice(index, 1)
}

function swap() {
  if (result.value.ok) input.value = result.value.value
  direction.value = direction.value === 'encode' ? 'decode' : 'encode'
}

function clearAll() {
  input.value = ''
}
</script>
