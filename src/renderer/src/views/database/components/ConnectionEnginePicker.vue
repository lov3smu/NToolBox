<template>
  <div class="dialog dialog-conn-picker">
    <div class="dialog-header">
      <h3>{{ t(title) }}</h3>
      <button class="btn-icon btn-sm" :title="t('关闭')" @click="$emit('close')">
        <AppIcon name="close" />
      </button>
    </div>
    <div class="conn-picker-toolbar">
      <div class="conn-picker-view-toggle">
        <button
          type="button"
          :class="['btn-icon', 'btn-sm', { active: view === 'grid' }]"
          :title="t('网格视图')"
          @click="view = 'grid'"
        >
          <AppIcon name="layout-grid" />
        </button>
        <button
          type="button"
          :class="['btn-icon', 'btn-sm', { active: view === 'list' }]"
          :title="t('列表视图')"
          @click="view = 'list'"
        >
          <AppIcon name="list" />
        </button>
      </div>
      <label class="conn-picker-search">
        <AppIcon name="search" class="conn-picker-search-icon" />
        <AppInput
          ref="searchRef"
          v-model="query"
          type="text"
          class="input-field-inline conn-picker-search-input"
          :placeholder="t('搜索数据库类型')"
          @keydown.enter.prevent="confirm"
        />
      </label>
      <button class="btn btn-secondary conn-picker-jdbc" type="button" disabled :title="t('即将支持通过 JDBC 连接')">
        <AppIcon name="database" />
        <span>{{ t('JDBC 连接') }}</span>
      </button>
    </div>
    <div class="conn-picker-body">
      <nav class="conn-picker-nav">
        <button
          v-for="category in categories"
          :key="category.id"
          type="button"
          :class="['conn-picker-nav-item', { active: category.id === activeCategory }]"
          @click="selectCategory(category.id)"
        >
          {{ t(category.label) }}
        </button>
      </nav>
      <div :class="['conn-picker-main', { 'is-list': view === 'list' }]">
        <button
          v-for="engine in shownEngines"
          :key="engine.value"
          type="button"
          class="conn-engine-card"
          :class="{ selected: engine.value === modelValue }"
          :aria-pressed="engine.value === modelValue"
          @click="pick(engine.value)"
          @dblclick="confirm"
        >
          <EngineLogo :engine="engine.value" size="xl" />
          <span class="conn-engine-name">{{ engine.label }}</span>
        </button>
        <div v-if="!shownEngines.length" class="conn-picker-empty">{{ t('暂无匹配的数据库类型') }}</div>
      </div>
    </div>
    <div class="dialog-footer">
      <div class="dialog-footer-left conn-picker-selected">
        <EngineLogo :engine="selectedEngine.value" size="xs" />
        <span>{{ t('已选择：{p0}', { p0: selectedEngine.label }) }}</span>
      </div>
      <div class="dialog-footer-right">
        <button class="btn btn-secondary" @click="$emit('close')">{{ t('取消') }}</button>
        <button class="btn btn-primary" @click="confirm">{{ t('下一步') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { t } from '@/i18n'
import { DATABASE_ENGINES, ENGINE_INFO } from '@shared/databaseEngines'

import AppIcon from '@/components/AppIcon.vue'
import EngineLogo from './EngineLogo.vue'
import AppInput from '@/components/AppInput.vue'

const props = defineProps({
  modelValue: { type: String, default: 'mysql' },
  title: { type: String, default: '新建连接' }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'close'])

const CATEGORIES = [
  { id: 'relational', label: '关系型数据库', engines: ['mysql', 'postgres'] },
  { id: 'lightweight', label: '轻量数据库', engines: ['sqlite'] }
]

const searchRef = ref(null)
const query = ref('')
const view = ref('grid')
const activeCategory = ref('relational')

const engines = DATABASE_ENGINES.map((value) => ({
  value,
  label: ENGINE_INFO[value].label
}))

const categories = CATEGORIES.map((category) => ({
  ...category,
  engines: category.engines.filter((value) => DATABASE_ENGINES.includes(value))
})).filter((category) => category.engines.length)

const selectedEngine = computed(() => engines.find((engine) => engine.value === props.modelValue) || engines[0])

const shownEngines = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (keyword) {
    return engines.filter((engine) => engine.label.toLowerCase().includes(keyword) || engine.value.includes(keyword))
  }
  const category = categories.find((item) => item.id === activeCategory.value) || categories[0]
  return engines.filter((engine) => category.engines.includes(engine.value))
})

function selectCategory(id) {
  activeCategory.value = id
  if (query.value) query.value = ''
}

function pick(value) {
  if (value !== props.modelValue) emit('update:modelValue', value)
}

function confirm() {
  emit('confirm')
}

onMounted(() => nextTick(() => searchRef.value?.focus()))
</script>

<style scoped>
.dialog-conn-picker {
  width: 860px;
  height: min(720px, calc(100vh - 64px));
}

.conn-picker-toolbar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  padding: 12px 16px;
}

.conn-picker-view-toggle {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
}

.conn-picker-view-toggle .btn-icon {
  border-color: transparent;
  background: transparent;
}

.conn-picker-view-toggle .btn-icon.active {
  background: var(--surface-muted);
  border-color: var(--border-color);
  color: var(--text-primary);
}

.conn-picker-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.conn-picker-search-icon {
  position: absolute;
  left: 9px;
  width: 14px;
  height: 14px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.conn-picker-search-input {
  width: 100%;
  padding-left: 30px;
}

.conn-picker-jdbc {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 6px;
}

.conn-picker-jdbc svg {
  width: 14px;
  height: 14px;
}

.conn-picker-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.conn-picker-nav {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  gap: 2px;
  width: 176px;
  padding: 4px 8px 12px 16px;
  overflow-y: auto;
  border-right: 1px solid var(--border-color);
}

.conn-picker-nav-item {
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.conn-picker-nav-item:hover {
  color: var(--text-primary);
}

.conn-picker-nav-item.active {
  background: var(--surface-muted);
  color: var(--text-primary);
  font-weight: 500;
}

.conn-picker-main {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  align-content: start;
  gap: 10px;
  min-width: 0;
  padding: 4px 16px 16px;
  overflow-y: auto;
}

.conn-picker-main.is-list {
  grid-template-columns: minmax(0, 1fr);
}

.conn-engine-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 104px;
  padding: 12px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: var(--transition-fast);
}

.conn-engine-card:hover {
  border-color: var(--border-strong);
  background: var(--surface-muted);
}

.conn-engine-card[aria-pressed='true'] {
  border-color: var(--text-primary);
  background: var(--surface-muted);
  box-shadow: inset 0 0 0 1px var(--text-primary);
}

.conn-picker-main.is-list .conn-engine-card {
  flex-direction: row;
  justify-content: flex-start;
  min-height: 0;
  padding: 10px 12px;
}

.conn-picker-empty {
  grid-column: 1 / -1;
  padding: 32px 0;
  font-size: var(--font-size-sm);
  text-align: center;
  color: var(--text-tertiary);
}

.conn-picker-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

@media (max-width: 760px) {
  .conn-picker-toolbar {
    flex-wrap: wrap;
  }

  .conn-picker-jdbc span {
    display: none;
  }

  .conn-picker-body {
    flex-direction: column;
  }

  .conn-picker-nav {
    flex-direction: row;
    width: auto;
    padding: 4px 12px 8px;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border-color);
  }

  .conn-picker-nav-item {
    width: auto;
    white-space: nowrap;
  }
}
</style>
