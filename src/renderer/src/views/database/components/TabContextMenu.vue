<template>
  <div
    v-if="tabContextMenu.show"
    ref="menuRef"
    v-clamp-viewport
    class="context-menu"
    role="menu"
    :style="{ left: tabContextMenu.x + 'px', top: tabContextMenu.y + 'px' }"
    @click.stop
    @keydown="onMenuKeydown"
  >
    <div role="menuitem" class="menu-item" @click="closeCurrentTab()">
      <AppIcon name="close" />
      {{ t('关闭') }}
    </div>
    <div role="menuitem" class="menu-item" @click="closeOtherTabs(tabContextMenu.tab.id)">
      <AppIcon name="columns" />
      {{ t('关闭其他') }}
    </div>
    <div role="menuitem" class="menu-item" @click="closeAllTabs()">
      <AppIcon name="trash" />
      {{ t('关闭全部') }}
    </div>
    <div role="menuitem" class="menu-item" @click="closeTabsToRight(tabContextMenu.tab.id)">
      <AppIcon name="chevrons-right" />
      {{ t('关闭右侧') }}
    </div>
    <div role="menuitem" class="menu-item" @click="closeTabsToLeft(tabContextMenu.tab.id)">
      <AppIcon name="chevrons-left" />
      {{ t('关闭左侧') }}
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
  closeAllTabs,
  closeOtherTabs,
  closeTab,
  closeTabsToLeft,
  closeTabsToRight,
  hideTabContextMenu,
  tabContextMenu
} = databaseStore

const menuRef = ref(null)

watch(
  () => tabContextMenu.value.show,
  (show) => {
    if (show) nextTick(() => focusFirstMenuItem(menuRef.value))
  }
)

function onMenuKeydown(event) {
  handleMenuKeydown(event, menuRef.value, hideTabContextMenu)
}

function closeCurrentTab() {
  const tab = tabContextMenu.value.tab
  if (!tab) return
  closeTab(tab.id)
  hideTabContextMenu()
}
</script>
