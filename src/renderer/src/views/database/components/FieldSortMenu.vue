<template>
  <div
    v-if="fieldSortMenu.show"
    ref="menuRef"
    v-clamp-viewport
    class="context-menu"
    role="menu"
    :style="{ left: fieldSortMenu.x + 'px', top: fieldSortMenu.y + 'px' }"
    @click.stop
    @keydown="onMenuKeydown"
  >
    <div role="menuitem" class="menu-item" @click="sortFieldAsc()">
      <AppIcon name="chevron-up" />
      {{ t('升序排序') }}
    </div>
    <div role="menuitem" class="menu-item" @click="sortFieldDesc()">
      <AppIcon name="chevron-down" />
      {{ t('降序排序') }}
    </div>
    <div class="menu-divider" role="separator" />
    <div role="menuitem" class="menu-item" @click="appendFieldSortAsc()">
      <AppIcon name="sort-ascending" />
      {{ t('追加升序排序') }}
    </div>
    <div role="menuitem" class="menu-item" @click="appendFieldSortDesc()">
      <AppIcon name="sort-descending" />
      {{ t('追加降序排序') }}
    </div>
    <div class="menu-divider" role="separator" />
    <div role="menuitem" class="menu-item" @click="clearFieldSort()">
      <AppIcon name="close" />
      {{ t('移除所有排序') }}
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject, nextTick, ref, watch } from 'vue'
import { focusFirstMenuItem, handleMenuKeydown } from '@/utils/menuKeyboard'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const {
  appendFieldSortAsc,
  appendFieldSortDesc,
  clearFieldSort,
  fieldSortMenu,
  hideFieldSortMenu,
  sortFieldAsc,
  sortFieldDesc
} = databaseStore

const menuRef = ref(null)

watch(
  () => fieldSortMenu.value.show,
  (show) => {
    if (show) nextTick(() => focusFirstMenuItem(menuRef.value))
  }
)

function onMenuKeydown(event) {
  handleMenuKeydown(event, menuRef.value, hideFieldSortMenu)
}
</script>
