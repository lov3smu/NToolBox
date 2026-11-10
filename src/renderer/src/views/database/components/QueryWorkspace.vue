<template>
  <div v-if="activeTabId !== 'object'" class="query-panel">
    <div
      v-for="tab in tabs.filter((t) => t.type === 'query' || t.type === 'table')"
      v-show="activeTabId === tab.id"
      :key="tab.id"
      class="query-content"
    >
      <QueryTabView v-if="tab.type === 'query'" :tab="tab" />
      <TableTabView v-else-if="tab.type === 'table'" :tab="tab" />
    </div>
  </div>
</template>

<script setup>
import QueryTabView from './QueryTabView.vue'
import TableTabView from './TableTabView.vue'
import { inject } from 'vue'

const databaseStore = inject('database')
const { activeTabId, tabs } = databaseStore
</script>
