<template>
  <PageLayout tool-path="/regex-tester">
    <div class="page-body devt-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('匹配规则') }}</span>
          <span class="panel-hint">{{ t('始终启用全局匹配，最多返回 500 处结果') }}</span>
        </div>
        <div class="panel-body devt-stack">
          <AppInput v-model="pattern" mono :placeholder="t('输入正则表达式')" spellcheck="false" @keyup.enter="runTest">
            <template #prefix>/</template>
            <template #suffix>/{{ activeFlags }}</template>
          </AppInput>
          <div class="devt-regex-flags">
            <label v-for="flag in REGEX_FLAG_OPTIONS" :key="flag.value" class="devt-check">
              <input v-model="flags" type="checkbox" :value="flag.value" :disabled="flag.value === 'g'" />
              {{ t(flag.label) }}
            </label>
          </div>
          <div class="devt-toolbar">
            <span class="devt-hint">{{ t('支持命名分组写法') }}</span>
            <code class="devt-group">(?&lt;name&gt;pattern)</code>
            <span class="devt-spacer" />
            <button class="btn btn-secondary" @click="clearAll">{{ t('清空') }}</button>
            <button class="btn btn-primary" @click="runTest">{{ t('测试正则') }}</button>
          </div>
        </div>
      </section>

      <div class="devt-grid">
        <section class="panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('待匹配文本') }}</span>
            <span class="panel-hint">{{ t('{p0} 字符', { p0: text.length }) }}</span>
          </div>
          <div class="panel-body devt-stack">
            <AppTextarea
              v-model="text"
              class="devt-textarea is-fill"
              mono
              :placeholder="t('粘贴需要匹配的文本')"
              spellcheck="false"
            />
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('匹配结果') }}</span>
            <span class="panel-hint">{{ resultHint }}</span>
          </div>
          <div class="panel-body devt-stack">
            <template v-if="result && !result.ok">
              <div class="devt-error">
                {{ result.error === 'empty-pattern' ? t('请输入正则表达式') : t('正则表达式无效') }}
                <template v-if="result.detail"> · {{ result.detail }}</template>
              </div>
            </template>
            <template v-else-if="result">
              <div v-if="result.truncated" class="devt-note is-warning">
                {{ t('匹配结果已截断，仅展示前 500 处') }}
              </div>
              <EmptyState v-if="!result.matches.length" size="sm" :description="t('没有匹配到内容')" />
              <template v-else>
                <div v-if="scannedText" class="devt-highlight">
                  <template v-for="(segment, index) in segments" :key="index">
                    <mark v-if="segment.hit">{{ segment.text }}</mark>
                    <span v-else>{{ segment.text }}</span>
                  </template>
                </div>
                <div class="devt-match-list">
                  <div v-for="(match, index) in result.matches" :key="index" class="devt-match">
                    <div class="devt-match-head">
                      <span class="devt-match-index">#{{ index + 1 }}</span>
                      <span>[{{ match.index }}, {{ match.end }})</span>
                    </div>
                    <div class="devt-match-value">{{ match.value === '' ? t('空匹配') : match.value }}</div>
                    <div v-if="match.groups.length || Object.keys(match.named).length" class="devt-groups">
                      <span v-for="(group, groupIndex) in match.groups" :key="groupIndex" class="devt-group">
                        #{{ groupIndex + 1 }}: {{ group === null ? 'null' : group === '' ? t('空匹配') : group }}
                      </span>
                      <span v-for="(group, name) in match.named" :key="`n-${name}`" class="devt-group">
                        {{ name }}: {{ group.value === '' ? t('空匹配') : group.value }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>
            </template>
            <EmptyState v-else size="sm" :description="t('输入表达式与文本后点击「测试正则」')" />
          </div>
        </section>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import EmptyState from '@/components/EmptyState.vue'
import AppInput from '@/components/AppInput.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import { t } from '@/i18n'
import { REGEX_FLAG_OPTIONS, REGEX_MAX_TEXT_LENGTH, runRegex } from '@shared/regexTester'
import '@/styles/dev-tools.css'

const pattern = ref('')
const flags = ref(['g', 'i'])
const text = ref('')
const result = ref(null)

const activeFlags = computed(() => flags.value.join(''))

const scannedText = computed(() => text.value.slice(0, REGEX_MAX_TEXT_LENGTH))

const resultHint = computed(() => {
  if (!result.value) return t('等待测试')
  if (!result.value.ok) return t('表达式有误')
  return t('匹配到 {p0} 处', { p0: result.value.matches.length })
})

const segments = computed(() => {
  const current = result.value
  if (!current?.ok) return []
  const source = scannedText.value
  const output = []
  let cursor = 0
  for (const match of current.matches) {
    if (match.end <= match.index) continue
    if (match.index > cursor) output.push({ text: source.slice(cursor, match.index), hit: false })
    output.push({ text: source.slice(match.index, match.end), hit: true })
    cursor = Math.max(cursor, match.end)
  }
  if (cursor < source.length) output.push({ text: source.slice(cursor), hit: false })
  return output
})

function runTest() {
  result.value = runRegex(pattern.value, flags.value.join(''), text.value)
}

function clearAll() {
  pattern.value = ''
  text.value = ''
  result.value = null
}
</script>
