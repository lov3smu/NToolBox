<template>
  <PageLayout tool-path="/text-toolbox">
    <div class="page-body devt-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('文本处理') }}</span>
          <span class="panel-hint">{{ t('选择操作后生成结果，不会改动输入内容') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-op-groups">
            <div v-for="group in groups" :key="group.id" class="devt-op-group">
              <span class="devt-op-label">{{ t(group.label) }}</span>
              <div class="devt-toolbar">
                <button
                  v-for="operation in group.operations"
                  :key="operation.id"
                  type="button"
                  class="devt-chip"
                  :class="{ 'is-active': lastOperation === operation.id }"
                  @click="apply(operation)"
                >
                  {{ t(operation.label) }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div class="devt-grid">
        <section class="panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('输入文本') }}</span>
            <span class="panel-hint">{{ formatStats(inputStats) }}</span>
          </div>
          <div class="panel-body devt-stack">
            <AppTextarea
              v-model="input"
              class="devt-textarea is-fill"
              mono
              :placeholder="t('粘贴或输入需要处理的文本')"
              spellcheck="false"
            />
            <div class="devt-actions">
              <button class="btn btn-secondary" :disabled="!input" @click="clearAll">{{ t('清空') }}</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('转换结果') }}</span>
            <span class="panel-hint">{{ output ? formatStats(outputStats) : t('等待操作') }}</span>
          </div>
          <div class="panel-body devt-stack">
            <AppTextarea
              :value="output"
              class="devt-textarea is-fill is-readonly"
              mono
              :placeholder="t('处理结果会显示在这里')"
              readonly
              spellcheck="false"
            />
            <div class="devt-actions">
              <button class="btn btn-secondary" :disabled="!output" @click="adoptOutput">
                {{ t('以结果为新输入') }}
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
import { useToast } from '@/composables'
import { t } from '@/i18n'
import CopyButton from '@/components/CopyButton.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import { TEXT_OPERATION_GROUPS, TEXT_OPERATIONS, textStats, transformText } from '@shared/textTools'
import '@/styles/dev-tools.css'

const { showWarning } = useToast()

const groups = TEXT_OPERATION_GROUPS.map((group) => ({
  ...group,
  operations: TEXT_OPERATIONS.filter((operation) => operation.group === group.id)
}))

const input = ref('')
const output = ref('')
const lastOperation = ref('')

const inputStats = computed(() => textStats(input.value))
const outputStats = computed(() => textStats(output.value))

function formatStats(stats) {
  return t('{p0} 字符 · {p1} 行 · {p2} 字节', { p0: stats.chars, p1: stats.lines, p2: stats.bytes })
}

function apply(operation) {
  if (!input.value) {
    showWarning(t('请先输入文本'))
    return
  }
  output.value = transformText(operation.id, input.value)
  lastOperation.value = operation.id
}

function adoptOutput() {
  if (!output.value) return
  input.value = output.value
  output.value = ''
  lastOperation.value = ''
}

function clearAll() {
  input.value = ''
  output.value = ''
  lastOperation.value = ''
}
</script>
