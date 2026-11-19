<template>
  <div class="panel-header">
    <div class="tabs-container">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-item', { active: activeTabId === tab.id }]"
        :title="tabTitle(tab)"
        @click="selectTab(tab.id)"
        @contextmenu.prevent.stop="showTabContextMenu($event, tab)"
      >
        <span class="tab-name">{{ tabLabel(tab) }}</span>
        <button v-if="tab.closable" class="tab-close-btn" @click.stop="closeTab(tab.id)">×</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { t } from '@/i18n'

const databaseStore = inject('database')
const { activeTabId, closeTab, selectTab, showTabContextMenu, tabs } = databaseStore

function tabLabel(tab) {
  if (tab.type !== 'table') return tab.name
  const others = tabs.value.filter((item) => item.type === 'table' && item.name === tab.name && item.id !== tab.id)
  if (!others.length) return tab.name
  const hasSameDatabase = others.some((item) => item.database === tab.database)
  const hasSameConnection = others.some((item) => item.connectionName === tab.connectionName)
  if (!hasSameDatabase) return `${tab.name}@${tab.database}`
  if (!hasSameConnection) return `${tab.name}@${tab.connectionName}`
  return `${tab.name}@${tab.connectionName}/${tab.database}`
}

function tabTitle(tab) {
  if (tab.type !== 'table') return tab.name
  return t('{p0}@{p1}（{p2}）-{p3}', {
    p0: tab.tableName,
    p1: tab.database,
    p2: tab.connectionName,
    p3: tab.isView ? t('视图') : t('表')
  })
}
</script>
