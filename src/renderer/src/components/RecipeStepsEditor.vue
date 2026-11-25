<template>
  <div class="recipe-steps">
    <div v-for="(step, index) in steps" :key="index" class="recipe-step">
      <span class="recipe-step-index">{{ index + 1 }}</span>
      <AppSelect
        class="recipe-step-type"
        :model-value="step.type"
        :options="stepTypeOptions"
        size="sm"
        @update:model-value="setStepType(index, $event)"
      />
      <template v-if="step.type === 'codec'">
        <AppSelect
          class="recipe-step-mode"
          :model-value="step.mode"
          :options="codecOptions"
          size="sm"
          @update:model-value="patchStep(index, { mode: $event })"
        />
        <AppSelect
          class="recipe-step-direction"
          :model-value="step.direction"
          :options="directionOptions"
          size="sm"
          @update:model-value="patchStep(index, { direction: $event })"
        />
      </template>
      <AppSelect
        v-else
        class="recipe-step-operation"
        :model-value="step.operation"
        :options="textOptions"
        size="sm"
        @update:model-value="patchStep(index, { operation: $event })"
      />
      <button
        type="button"
        class="recipe-step-btn"
        :disabled="index === 0"
        :title="t('上移')"
        :aria-label="t('上移')"
        @click="moveStep(index, -1)"
      >
        <AppIcon name="arrow-up" />
      </button>
      <button
        type="button"
        class="recipe-step-btn"
        :disabled="index === steps.length - 1"
        :title="t('下移')"
        :aria-label="t('下移')"
        @click="moveStep(index, 1)"
      >
        <AppIcon name="arrow-down" />
      </button>
      <button
        type="button"
        class="recipe-step-btn danger"
        :disabled="steps.length <= 1"
        :title="t('移除步骤')"
        :aria-label="t('移除步骤')"
        @click="removeStep(index)"
      >
        <AppIcon name="trash" />
      </button>
    </div>
    <button class="btn btn-secondary btn-sm recipe-add-step" :disabled="steps.length >= maxSteps" @click="addStep">
      <AppIcon name="plus" />
      {{ t('添加步骤') }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { t } from '@/i18n'
import AppIcon from '@/components/AppIcon.vue'
import AppSelect from '@/components/AppSelect.vue'
import { CODEC_DIRECTIONS, CODEC_MODES } from '@shared/codec'
import { TEXT_OPERATIONS } from '@shared/textTools'
import { createRecipeStep, RECIPE_LIMITS, RECIPE_STEP_TYPES } from '@shared/recipes'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  maxSteps: { type: Number, default: RECIPE_LIMITS.maxSteps }
})

const emit = defineEmits(['update:modelValue'])

const steps = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []))
const stepTypeOptions = computed(() => RECIPE_STEP_TYPES.map((item) => ({ value: item.value, label: t(item.label) })))
const codecOptions = computed(() => CODEC_MODES.map((item) => ({ value: item.id, label: t(item.label) })))
const directionOptions = computed(() => CODEC_DIRECTIONS.map((item) => ({ value: item.id, label: t(item.label) })))
const textOptions = computed(() => TEXT_OPERATIONS.map((item) => ({ value: item.id, label: t(item.label) })))

function patchStep(index, patch) {
  emit(
    'update:modelValue',
    steps.value.map((step, current) => (current === index ? { ...step, ...patch } : step))
  )
}

function setStepType(index, type) {
  const current = steps.value[index]
  if (!current || current.type === type) return
  emit(
    'update:modelValue',
    steps.value.map((step, position) => (position === index ? createRecipeStep(type) : step))
  )
}

function addStep() {
  if (steps.value.length >= props.maxSteps) return
  emit('update:modelValue', [...steps.value, createRecipeStep('codec')])
}

function removeStep(index) {
  if (steps.value.length <= 1) return
  emit(
    'update:modelValue',
    steps.value.filter((_, position) => position !== index)
  )
}

function moveStep(index, delta) {
  const target = index + delta
  if (target < 0 || target >= steps.value.length) return
  const next = steps.value.slice()
  const [step] = next.splice(index, 1)
  next.splice(target, 0, step)
  emit('update:modelValue', next)
}
</script>

<style scoped>
.recipe-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recipe-step {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
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

.recipe-step-type {
  width: 108px;
  flex-shrink: 0;
}

.recipe-step-mode {
  width: 128px;
  flex-shrink: 0;
}

.recipe-step-direction {
  width: 88px;
  flex-shrink: 0;
}

.recipe-step-operation {
  flex: 1;
  min-width: 120px;
}

.recipe-step-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
}

.recipe-step-btn svg {
  width: var(--icon-size-xs);
  height: var(--icon-size-xs);
}

.recipe-step-btn:hover:not(:disabled) {
  border-color: var(--border-color);
  background: var(--surface-hover);
  color: var(--accent-color);
}

.recipe-step-btn.danger:hover:not(:disabled) {
  border-color: rgba(var(--error-rgb), 0.4);
  background: rgba(var(--error-rgb), 0.1);
  color: var(--error-dark);
}

.recipe-step-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.recipe-add-step {
  align-self: flex-start;
}
</style>
