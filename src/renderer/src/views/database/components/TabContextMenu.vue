<template>
  <div
    v-if="tabContextMenu.show"
    class="context-menu"
    :style="{ left: tabContextMenu.x + 'px', top: tabContextMenu.y + 'px' }"
    @click.stop
  >
    <div class="menu-item" @click="handleRefreshTableAndHide()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      关闭
    </div>
    <div class="menu-item" @click="closeOtherTabs(tabContextMenu.tab.id)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
      关闭其他
    </div>
    <div class="menu-item" @click="closeAllTabs()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
      关闭全部
    </div>
    <div class="menu-item" @click="closeTabsToRight(tabContextMenu.tab.id)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6" />
        <rect x="3" y="3" width="6" height="18" />
      </svg>
      关闭右侧
    </div>
    <div class="menu-item" @click="closeTabsToLeft(tabContextMenu.tab.id)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6" />
        <rect x="15" y="3" width="6" height="18" />
      </svg>
      关闭左侧
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { closeAllTabs, closeOtherTabs, closeTabsToLeft, closeTabsToRight, handleRefreshTableAndHide, tabContextMenu } =
  databaseStore
</script>
