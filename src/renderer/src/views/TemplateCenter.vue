<template>
  <PageLayout tool-path="/template-center">
    <div class="page-body devt-page">
      <section class="panel">
        <div class="panel-header">
          <span class="panel-title">{{ t('模板库') }}</span>
          <span class="panel-hint">
            {{ t('{p0} 个模板 · 选择后复制或发送到对应工具', { p0: filteredTemplates.length }) }}
          </span>
        </div>
        <div class="panel-body devt-stack">
          <div class="devt-toolbar">
            <AppInput
              v-model="query"
              class="devt-url-input"
              type="text"
              :placeholder="t('搜索模板名称、标签或内容')"
              spellcheck="false"
            />
            <span class="devt-spacer" />
            <button
              v-for="item in categories"
              :key="item.id"
              type="button"
              class="devt-chip"
              :class="{ 'is-active': category === item.id }"
              :aria-pressed="category === item.id"
              @click="category = item.id"
            >
              {{ t(item.name) }}
            </button>
          </div>

          <EmptyState v-if="!filteredTemplates.length" size="sm" :description="t('没有匹配的模板')" />
          <div v-else class="tpl-layout">
            <div class="tpl-list">
              <button
                v-for="template in filteredTemplates"
                :key="template.id"
                type="button"
                class="tpl-card"
                :class="{ 'is-active': activeTemplate?.id === template.id }"
                @click="activeId = template.id"
              >
                <span class="tpl-name">{{ t(template.name) }}</span>
                <span class="tpl-desc">{{ t(template.description) }}</span>
                <span class="tpl-tags">
                  <span v-for="tag in template.tags" :key="tag" class="tpl-tag">{{ tag }}</span>
                  <span v-if="template.plugin" class="tpl-tag is-plugin">{{ template.plugin }}</span>
                </span>
              </button>
            </div>

            <div v-if="activeTemplate" class="tpl-preview">
              <div class="tpl-preview-head">
                <div class="tpl-preview-title">
                  <span class="tpl-name">{{ t(activeTemplate.name) }}</span>
                  <span class="devt-hint">{{ t(getTemplateCategoryName(activeTemplate.category)) }}</span>
                  <span v-if="activeTemplate.plugin" class="devt-hint">{{ activeTemplate.plugin }}</span>
                </div>
                <div class="devt-actions">
                  <CopyButton
                    :text="filledContent"
                    :label="t('复制内容')"
                    :success-message="t('已复制模板内容')"
                    variant="secondary"
                    size="sm"
                  />
                  <button v-if="activeTarget" class="btn btn-primary btn-sm" @click="sendTemplate">
                    {{ t('发送到 {p0}', { p0: t(activeTarget) }) }}
                  </button>
                </div>
              </div>
              <div v-if="variableNames.length" class="tpl-vars">
                <div class="tpl-vars-head">
                  <span class="tpl-vars-title">{{ t('模板变量') }}</span>
                  <span class="devt-hint">{{ t('填写后，复制与发送会自动替换；留空则保留占位符') }}</span>
                </div>
                <div class="tpl-var-grid">
                  <label v-for="name in variableNames" :key="name" class="tpl-var">
                    <span class="tpl-var-name">{{ name }}</span>
                    <AppInput
                      v-model="variableValues[name]"
                      size="sm"
                      :placeholder="t('输入 {p0}', { p0: name })"
                      spellcheck="false"
                    />
                  </label>
                </div>
              </div>
              <pre class="tpl-pre">{{ filledContent }}</pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { pluginsList } from '@/api'
import { sendResourceTo, useToast } from '@/composables'
import CopyButton from '@/components/CopyButton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { visibleTools } from '@shared/navTools'
import {
  BUILTIN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  collectPluginTemplates,
  extractTemplateVariables,
  fillTemplate,
  filterTemplates,
  getTemplateById,
  getTemplateCategoryName
} from '@shared/templates'
import { t } from '@/i18n'
import '@/styles/dev-tools.css'
import '@/styles/template-center.css'
import AppInput from '@/components/AppInput.vue'

const { showError } = useToast()

const categories = [{ id: 'all', name: '全部' }, ...TEMPLATE_CATEGORIES]
const plugins = ref([])
const templates = computed(() => [...BUILTIN_TEMPLATES, ...collectPluginTemplates(plugins.value)])
const query = ref('')
const category = ref('all')
const activeId = ref(BUILTIN_TEMPLATES[0]?.id || '')

onMounted(async () => {
  const list = await pluginsList()
  if (Array.isArray(list)) plugins.value = list
})

const filteredTemplates = computed(() => filterTemplates(templates.value, query.value, category.value))
const activeTemplate = computed(() => {
  const current = getTemplateById(filteredTemplates.value, activeId.value)
  return current || filteredTemplates.value[0] || null
})
const activeTarget = computed(() => {
  const path = activeTemplate.value?.targetPath
  if (!path) return ''
  return visibleTools.find((tool) => tool.path === path)?.name || ''
})

const variableValues = reactive({})
const variableNames = computed(() => extractTemplateVariables(activeTemplate.value?.content || ''))
const filledContent = computed(() => fillTemplate(activeTemplate.value?.content || '', variableValues))

watch(
  () => activeTemplate.value?.id,
  () => {
    for (const name of Object.keys(variableValues)) delete variableValues[name]
  }
)

function sendTemplate() {
  if (!activeTemplate.value?.targetPath) return
  const sent = sendResourceTo(
    { kind: 'text', text: filledContent.value, title: activeTemplate.value.name },
    activeTemplate.value.targetPath
  )
  if (!sent) showError(t('该模板暂不支持发送'))
}
</script>
