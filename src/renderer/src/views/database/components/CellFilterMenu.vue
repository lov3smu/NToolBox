<template>
  <div
    v-if="cellFilterMenu.show"
    v-clamp-viewport
    class="context-menu"
    :style="{ left: cellFilterMenu.x + 'px', top: cellFilterMenu.y + 'px' }"
    @click.stop
  >
    <div class="menu-title">
      <span class="menu-title-field">{{ cellFilterMenu.fieldName }}</span>
      <span class="menu-title-value">{{ filterMenuValue }}</span>
    </div>
    <div class="menu-item" :class="{ disabled: isNullValue }" @click="apply('=')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="9" x2="19" y2="9" />
        <line x1="5" y1="15" x2="19" y2="15" />
      </svg>
      {{ t('等于此值') }}
    </div>
    <div class="menu-item" :class="{ disabled: isNullValue }" @click="apply('!=')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="9" x2="19" y2="9" />
        <line x1="5" y1="15" x2="19" y2="15" />
        <line x1="16" y1="5" x2="8" y2="19" />
      </svg>
      {{ t('不等于此值') }}
    </div>
    <div class="menu-item" :class="{ disabled: isNullValue }" @click="apply('LIKE')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      {{ t('包含此值') }}
    </div>
    <div class="menu-divider" />
    <div class="menu-item" @click="apply('IS NULL')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="9" />
        <line x1="5" y1="19" x2="19" y2="5" />
      </svg>
      {{ t('仅看空值') }}
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const { applyCellFilter, cellFilterMenu } = databaseStore

const filterMenuValue = computed(() => {
  const value = cellFilterMenu.value.value
  if (value === null || value === undefined) return 'NULL'
  const text = String(value)
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
})

const isNullValue = computed(() => cellFilterMenu.value.value === null || cellFilterMenu.value.value === undefined)

function apply(operator) {
  if (operator !== 'IS NULL' && isNullValue.value) return
  applyCellFilter(operator)
}
</script>
