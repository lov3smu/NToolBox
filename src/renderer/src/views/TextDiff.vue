<template>
  <PageLayout tool-path="/text-diff">
    <div class="page-body devt-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('文本对比') }}</span>
          <span class="panel-hint">{{ t('按行对比两段文本，标出新增与删除的行') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-grid">
            <div class="devt-field">
              <span class="field-label">{{ t('原始文本') }}</span>
              <AppTextarea
                v-model="leftText"
                class="devt-textarea is-fill"
                mono
                :placeholder="t('粘贴修改前的文本')"
                spellcheck="false"
              />
            </div>
            <div class="devt-field">
              <span class="field-label">{{ t('新文本') }}</span>
              <AppTextarea
                v-model="rightText"
                class="devt-textarea is-fill"
                mono
                :placeholder="t('粘贴修改后的文本')"
                spellcheck="false"
              />
            </div>
          </div>
          <div class="devt-toolbar">
            <label class="devt-check">
              <input v-model="ignoreCase" type="checkbox" />
              {{ t('忽略大小写') }}
            </label>
            <label class="devt-check">
              <input v-model="ignoreWhitespace" type="checkbox" />
              {{ t('忽略空白差异') }}
            </label>
            <span class="devt-spacer" />
            <button class="btn btn-secondary" @click="clearAll">{{ t('清空') }}</button>
            <button class="btn btn-primary" @click="compare">{{ t('开始对比') }}</button>
          </div>
        </div>
      </section>

      <section v-if="result" class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('对比结果') }}</span>
          <span class="panel-hint">{{ t('{p0} 行 · 新增 {p1} · 删除 {p2}', rowStats) }}</span>
        </div>
        <div class="panel-body devt-stack">
          <div v-if="result.truncated" class="devt-note is-warning">
            {{ t('文本行数超过 2000 行，已按整段替换展示，差异统计为近似值') }}
          </div>
          <EmptyState v-if="!result.rows.length" size="sm" :description="t('两段文本都为空，没有可对比的内容')" />
          <div v-else class="devt-diff">
            <div v-for="(row, index) in result.rows" :key="index" class="devt-diff-row" :class="`is-${row.type}`">
              <span class="devt-diff-no">{{ row.oldNo ?? '' }}</span>
              <span class="devt-diff-no">{{ row.newNo ?? '' }}</span>
              <span class="devt-diff-sign">{{ signs[row.type] }}</span>
              <span class="devt-diff-text">{{ row.text }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import EmptyState from '@/components/EmptyState.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import { t } from '@/i18n'
import { diffLines } from '@shared/textDiff'
import '@/styles/dev-tools.css'

const leftText = ref('')
const rightText = ref('')
const ignoreCase = ref(false)
const ignoreWhitespace = ref(false)
const result = ref(null)

const signs = { equal: ' ', add: '+', remove: '-' }

const rowStats = computed(() => {
  if (!result.value) return { p0: 0, p1: 0, p2: 0 }
  const { stats } = result.value
  return { p0: stats.added + stats.removed + stats.unchanged, p1: stats.added, p2: stats.removed }
})

function compare() {
  result.value = diffLines(leftText.value, rightText.value, {
    ignoreCase: ignoreCase.value,
    ignoreWhitespace: ignoreWhitespace.value
  })
}

function clearAll() {
  leftText.value = ''
  rightText.value = ''
  result.value = null
}
</script>
