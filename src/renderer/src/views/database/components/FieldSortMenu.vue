<template>
  <div
    v-if="fieldSortMenu.show"
    class="context-menu"
    :style="{ left: fieldSortMenu.x + 'px', top: fieldSortMenu.y + 'px' }"
    @click.stop
  >
    <div class="menu-item" @click="sortFieldAsc()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="18 15 12 9 6 15" />
      </svg>
      升序排序
    </div>
    <div class="menu-item" @click="sortFieldDesc()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9" />
      </svg>
      降序排序
    </div>
    <div class="menu-divider" />
    <div class="menu-item" @click="appendFieldSortAsc()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="18 15 12 9 6 15" />
        <line x1="4" y1="20" x2="20" y2="20" />
      </svg>
      追加升序排序
    </div>
    <div class="menu-item" @click="appendFieldSortDesc()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9" />
        <line x1="4" y1="20" x2="20" y2="20" />
      </svg>
      追加降序排序
    </div>
    <div class="menu-divider" />
    <div class="menu-item" @click="clearFieldSort()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
      移除所有排序
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { appendFieldSortAsc, appendFieldSortDesc, clearFieldSort, fieldSortMenu, sortFieldAsc, sortFieldDesc } =
  databaseStore
</script>
