<template>
  <div v-if="activeTabId !== 'object'" class="query-panel">
    <div class="query-content">
      <QueryTabView v-if="activeTab?.type === 'query'" :key="activeTab.id" :tab="activeTab" />
      <TableTabView v-else-if="activeTab?.type === 'table'" :key="activeTab.id" :tab="activeTab" />
    </div>
  </div>
</template>

<script setup>
import QueryTabView from './QueryTabView.vue'
import TableTabView from './TableTabView.vue'
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const { activeTabId, tabs } = databaseStore

const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value) || null)
</script>
