<template>
  <div class="panel-header">
    <div class="tabs-container">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-item', { active: activeTabId === tab.id }]"
        @click="selectTab(tab.id)"
        @contextmenu.prevent.stop="showTabContextMenu($event, tab)"
      >
        <span class="tab-name">{{ tab.name }}</span>
        <button v-if="tab.closable" class="tab-close-btn" @click.stop="closeTab(tab.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { activeTabId, closeTab, selectTab, showTabContextMenu, tabs } = databaseStore
</script>
