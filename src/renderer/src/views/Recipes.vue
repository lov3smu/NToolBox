<template>
  <PageLayout tool-path="/recipes">
    <template #actions>
      <button class="btn btn-secondary btn-sm" @click="resetDraft">
        <AppIcon name="plus" />
        {{ t('新建 Recipe') }}
      </button>
      <button class="btn btn-danger btn-sm" :disabled="!selectedId" @click="deleteVisible = true">
        <AppIcon name="trash" />
        {{ t('删除当前') }}
      </button>
    </template>

    <div class="page-body recipe-page">
      <div class="recipe-grid">
        <section class="panel">
          <div class="panel-header">
            <span class="panel-title">{{ t('Recipe 步骤') }}</span>
            <span class="panel-hint">{{ t('按顺序执行编码转换与文本处理') }}</span>
          </div>
          <div class="panel-body recipe-stack">
            <div class="recipe-toolbar">
              <AppSelect
                v-model="selectedId"
                class="recipe-select"
                :options="recipeOptions"
                :placeholder="t('选择 Recipe')"
              />
              <AppInput v-model="recipeName" class="recipe-name" :placeholder="t('Recipe 名称')" spellcheck="false" />
              <span class="recipe-spacer" />
              <button class="btn btn-primary btn-sm" :disabled="!steps.length" @click="saveRecipe">
                {{ selectedId ? t('保存修改') : t('保存 Recipe') }}
              </button>
            </div>

            <RecipeStepsEditor v-model="steps" />
          </div>
        </section>

        <div class="recipe-io">
          <section class="panel">
            <div class="panel-header">
              <span class="panel-title">{{ t('待处理内容') }}</span>
              <span class="panel-hint">{{ t('可接收任意工具「发送到」的内容') }}</span>
            </div>
            <div class="panel-body recipe-stack">
              <AppTextarea
                v-model="input"
                class="recipe-textarea"
                :placeholder="t('粘贴或发送要处理的文本')"
                spellcheck="false"
              />
              <div class="recipe-actions">
                <span class="recipe-meta">{{ t('{p0} 字符', { p0: input.length }) }}</span>
                <span class="recipe-spacer" />
                <button class="btn btn-secondary btn-sm" :disabled="!input" @click="input = ''">{{ t('清空') }}</button>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <span class="panel-title">{{ t('处理结果') }}</span>
              <span class="panel-hint">{{ t('每一步依次处理上一步的结果') }}</span>
            </div>
            <div class="panel-body recipe-stack">
              <p v-if="errorText" class="recipe-error">{{ errorText }}</p>
              <pre v-else class="recipe-result" :class="{ 'is-empty': !output }">{{
                output || t('结果会显示在这里')
              }}</pre>
              <div class="recipe-actions">
                <span class="recipe-meta">{{ t('{p0} 字符', { p0: output.length }) }}</span>
                <span class="recipe-spacer" />
                <CopyButton :text="output" :label="t('复制结果')" variant="secondary" size="sm" />
                <button class="btn btn-secondary btn-sm" :disabled="!output" @click="openSendMenu">
                  <AppIcon name="shuffle" />
                  {{ t('发送到…') }}
                </button>
              </div>

              <div v-if="runResult.steps.length" class="recipe-trace">
                <div
                  v-for="step in runResult.steps"
                  :key="step.index"
                  class="recipe-trace-item"
                  :class="{ 'is-error': !step.ok }"
                >
                  <div class="recipe-trace-head">
                    <span class="recipe-step-index">{{ step.index + 1 }}</span>
                    <span class="recipe-trace-label">{{ stepLabel(steps[step.index]) }}</span>
                    <span class="recipe-trace-meta">
                      {{ step.ok ? t('{p0} 字符', { p0: step.value.length }) : t('失败') }}
                    </span>
                  </div>
                  <pre v-if="step.ok" class="recipe-trace-preview">{{ tracePreview(step.value) }}</pre>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <SendToMenu
      :visible="sendMenu.show"
      :x="sendMenu.x"
      :y="sendMenu.y"
      :resource="sendResource"
      exclude-path="/recipes"
      @close="sendMenu.show = false"
      @sent="onSendDone"
    />

    <MessageDialog
      :visible="deleteVisible"
      type="confirm"
      :title="t('删除 Recipe')"
      :message="t('将删除 Recipe「{p0}」，此操作无法撤销。', { p0: activeName })"
      @confirm="deleteRecipe"
      @cancel="deleteVisible = false"
      @close="deleteVisible = false"
    />
  </PageLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import SendToMenu from '@/components/SendToMenu.vue'
import MessageDialog from '@/components/MessageDialog.vue'
import CopyButton from '@/components/CopyButton.vue'
import AppIcon from '@/components/AppIcon.vue'
import AppInput from '@/components/AppInput.vue'
import AppSelect from '@/components/AppSelect.vue'
import AppTextarea from '@/components/AppTextarea.vue'
import RecipeStepsEditor from '@/components/RecipeStepsEditor.vue'
import { takeSendResource, useToast } from '@/composables'
import { t } from '@/i18n'
import { CODEC_DIRECTIONS, CODEC_MODES } from '@shared/codec'
import { TEXT_OPERATIONS } from '@shared/textTools'
import {
  createRecipeId,
  createRecipeStep,
  normalizeRecipeSteps,
  normalizeRecipes,
  RECIPE_ERROR_LABELS,
  RECIPE_LIMITS,
  runRecipeSteps,
  sortRecipes
} from '@shared/recipes'

const RECIPES_KEY = 'ntb_recipes'
const SESSION_KEY = 'ntb_recipe_session'

const { showSuccess, showInfo, showWarning } = useToast()

const recipes = ref(loadRecipes())
const selectedId = ref('')
const recipeName = ref('')
const steps = ref([createRecipeStep('codec')])
const input = ref('')
const deleteVisible = ref(false)
const sendMenu = ref({ show: false, x: 0, y: 0 })
const sendResource = ref(null)

const recipeOptions = computed(() => [
  { value: '', label: t('新 Recipe') },
  ...sortRecipes(recipes.value).map((recipe) => ({ value: recipe.id, label: recipe.name || t('未命名 Recipe') }))
])

const activeName = computed(() => {
  const recipe = recipes.value.find((item) => item.id === selectedId.value)
  return recipe?.name || recipeName.value.trim() || t('未命名 Recipe')
})

const runResult = computed(() => runRecipeSteps(steps.value, input.value))
const output = computed(() => (runResult.value.ok ? runResult.value.value : ''))
const errorText = computed(() => {
  const result = runResult.value
  if (result.ok) return ''
  const reason = RECIPE_ERROR_LABELS[result.error] || '执行失败'
  return t('第 {p0} 步「{p1}」失败：{p2}', {
    p0: (result.stepIndex ?? 0) + 1,
    p1: stepLabel(steps.value[result.stepIndex]),
    p2: t(reason)
  })
})

function stepLabel(step) {
  if (!step) return ''
  if (step.type === 'text') {
    const operation = TEXT_OPERATIONS.find((item) => item.id === step.operation)
    return t(operation?.label || '')
  }
  const mode = CODEC_MODES.find((item) => item.id === step.mode)
  const direction = CODEC_DIRECTIONS.find((item) => item.id === step.direction)
  return `${t(mode?.label || '')} ${t(direction?.label || '')}`.trim()
}

function loadRecipes() {
  try {
    return sortRecipes(normalizeRecipes(JSON.parse(localStorage.getItem(RECIPES_KEY) || '[]')))
  } catch {
    return []
  }
}

function persistRecipes() {
  try {
    localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes.value))
  } catch {
    // 存储不可用时仅保留内存中的 Recipe
  }
}

function persistSession() {
  try {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ selectedId: selectedId.value, input: input.value.slice(0, RECIPE_LIMITS.textLength) })
    )
  } catch {
    // 忽略会话保存失败
  }
}

function loadSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function applyRecipe(id) {
  const recipe = recipes.value.find((item) => item.id === id)
  if (recipe) {
    recipeName.value = recipe.name
    steps.value = recipe.steps.map((step) => ({ ...step }))
    return
  }
  recipeName.value = ''
  steps.value = [createRecipeStep('codec')]
}

function resetDraft() {
  if (selectedId.value) selectedId.value = ''
  applyRecipe('')
}

function saveRecipe() {
  const normalizedSteps = normalizeRecipeSteps(steps.value)
  if (!normalizedSteps.length) {
    showWarning(t('请至少保留一个步骤'))
    return
  }
  const name = (recipeName.value.trim() || t('未命名 Recipe')).slice(0, RECIPE_LIMITS.nameLength)
  const now = Date.now()
  const existing = recipes.value.find((item) => item.id === selectedId.value)
  if (existing) {
    existing.name = name
    existing.steps = normalizedSteps
    existing.updatedAt = now
  } else {
    if (recipes.value.length >= RECIPE_LIMITS.max) {
      showWarning(t('最多保存 {p0} 个 Recipe', { p0: RECIPE_LIMITS.max }))
      return
    }
    const recipe = { id: createRecipeId(), name, steps: normalizedSteps, createdAt: now, updatedAt: now }
    recipes.value.push(recipe)
    selectedId.value = recipe.id
  }
  recipeName.value = name
  recipes.value = sortRecipes(recipes.value)
  persistRecipes()
  persistSession()
  showSuccess(t('Recipe 已保存'))
}

function deleteRecipe() {
  deleteVisible.value = false
  const recipe = recipes.value.find((item) => item.id === selectedId.value)
  if (!recipe) return
  recipes.value = recipes.value.filter((item) => item.id !== recipe.id)
  selectedId.value = ''
  applyRecipe('')
  persistRecipes()
  persistSession()
  showInfo(t('已删除 Recipe「{p0}」', { p0: recipe.name || t('未命名 Recipe') }))
}

function tracePreview(value) {
  const text = value || ''
  return text.length > 160 ? `${text.slice(0, 160)}…` : text || t('（空结果）')
}

function openSendMenu(event) {
  if (!output.value) return
  sendResource.value = {
    kind: 'text',
    title: recipeName.value.trim() || t('Recipe 结果'),
    text: output.value
  }
  const rect = event.currentTarget.getBoundingClientRect()
  sendMenu.value = { show: true, x: rect.right - 252, y: rect.bottom + 6 }
}

function onSendDone(target) {
  showSuccess(t('已发送到 {name}', { name: t(target.name) }))
}

watch(selectedId, (id) => {
  applyRecipe(id)
  persistSession()
})

watch([input, recipeName], persistSession)

onMounted(() => {
  const session = loadSession()
  if (session?.input) input.value = String(session.input)
  const storedId = typeof session?.selectedId === 'string' ? session.selectedId : ''
  if (storedId && recipes.value.some((item) => item.id === storedId)) {
    selectedId.value = storedId
    applyRecipe(storedId)
  } else if (recipes.value.length) {
    selectedId.value = recipes.value[0].id
    applyRecipe(recipes.value[0].id)
  }
  const incoming = takeSendResource('/recipes')
  if (incoming?.kind === 'text') {
    input.value = incoming.text
    showInfo(t('已载入待处理内容'))
  }
})
</script>

<style scoped>
.recipe-page {
  flex: 1;
  min-height: 0;
}

.recipe-grid {
  display: grid;
  grid-template-columns: minmax(380px, 1fr) minmax(380px, 1fr);
  gap: 12px;
  align-items: start;
}

.recipe-io {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.recipe-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.recipe-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.recipe-select {
  width: 220px;
  max-width: 100%;
}

.recipe-name {
  flex: 1;
  min-width: 160px;
}

.recipe-spacer {
  flex: 1;
}

.recipe-step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-pill);
  background: rgba(var(--accent-rgb), 0.12);
  color: var(--accent-color);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.recipe-textarea {
  min-height: 170px;
  font-family: var(--font-mono);
}

.recipe-result {
  margin: 0;
  min-height: 170px;
  max-height: 320px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--inset-bg);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.recipe-result.is-empty {
  color: var(--text-tertiary);
}

.recipe-error {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid rgba(var(--error-rgb), 0.35);
  border-radius: var(--radius-md);
  background: rgba(var(--error-rgb), 0.08);
  color: var(--error-dark);
  font-size: var(--font-size-dense);
}

.recipe-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recipe-meta {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.recipe-trace {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.recipe-trace-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--surface);
}

.recipe-trace-item.is-error {
  border-color: rgba(var(--error-rgb), 0.35);
}

.recipe-trace-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recipe-trace-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recipe-trace-meta {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
}

.recipe-trace-preview {
  margin: 0;
  max-height: 60px;
  overflow: hidden;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 1000px) {
  .recipe-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
