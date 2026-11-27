<template>
  <div
    v-if="cellFilterMenu.show"
    ref="menuRef"
    v-clamp-viewport
    class="context-menu"
    role="menu"
    :style="{ left: cellFilterMenu.x + 'px', top: cellFilterMenu.y + 'px' }"
    @click.stop
    @keydown="onMenuKeydown"
  >
    <div class="menu-title">
      <span class="menu-title-field">{{ cellFilterMenu.fieldName }}</span>
      <span class="menu-title-value">{{ filterMenuValue }}</span>
    </div>
    <div
      role="menuitem"
      class="menu-item"
      :class="{ disabled: isNullValue }"
      :aria-disabled="isNullValue ? 'true' : undefined"
      @click="apply('=')"
    >
      <AppIcon name="equal" />
      {{ t('等于此值') }}
    </div>
    <div
      role="menuitem"
      class="menu-item"
      :class="{ disabled: isNullValue }"
      :aria-disabled="isNullValue ? 'true' : undefined"
      @click="apply('!=')"
    >
      <AppIcon name="not-equal" />
      {{ t('不等于此值') }}
    </div>
    <div
      role="menuitem"
      class="menu-item"
      :class="{ disabled: isNullValue }"
      :aria-disabled="isNullValue ? 'true' : undefined"
      @click="apply('LIKE')"
    >
      <AppIcon name="search" />
      {{ t('包含此值') }}
    </div>
    <div class="menu-divider" role="separator" />
    <div role="menuitem" class="menu-item" @click="apply('IS NULL')">
      <AppIcon name="circle-slash" />
      {{ t('仅看空值') }}
    </div>
  </div>
</template>

<script setup>
import AppIcon from '@/components/AppIcon.vue'
import { t } from '@/i18n'
import { computed, inject, nextTick, ref, watch } from 'vue'
import { focusFirstMenuItem, handleMenuKeydown } from '@/utils/menuKeyboard'

const databaseStore = inject('database')
const { applyCellFilter, cellFilterMenu, hideCellFilterMenu } = databaseStore
const menuRef = ref(null)

watch(
  () => cellFilterMenu.value.show,
  (show) => {
    if (show) nextTick(() => focusFirstMenuItem(menuRef.value))
  }
)

function onMenuKeydown(event) {
  handleMenuKeydown(event, menuRef.value, hideCellFilterMenu)
}

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
