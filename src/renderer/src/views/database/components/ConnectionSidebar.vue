<template>
  <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
    <div
      class="sidebar-header"
      :class="{ 'drag-over': draggingConnection && !dragOverGroup }"
      @contextmenu.prevent="showContextMenu($event, 'header')"
      @dragover.prevent="onDragOverHeader"
      @drop.prevent="onDropToHeader"
    >
      <h3>
        <AppIcon name="link" class="title-icon" />
        {{ t('我的连接') }}
      </h3>
      <div class="sidebar-header-actions" @click.stop>
        <button class="sidebar-icon-btn" :title="t('导入连接配置')" @click="openConnectionTransferDialog('import')">
          <AppIcon name="upload" />
        </button>
        <button class="sidebar-icon-btn" :title="t('导出连接配置')" @click="openConnectionTransferDialog('export')">
          <AppIcon name="download" />
        </button>
      </div>
    </div>
    <div class="connection-list">
      <template v-for="group in visibleConnectionGroups" :key="group.name">
        <div
          class="group-item"
          :class="{ 'drag-over': dragOverGroup === group.name }"
          @click.stop="selectGroup(group)"
          @contextmenu.prevent.stop="showContextMenu($event, 'group', group)"
          @dragover.prevent="onDragOverGroup(group.name)"
          @dragleave="onDragLeaveGroup"
          @drop.prevent="onDropToGroup(group.name)"
        >
          <AppIcon
            name="chevron-right"
            class="group-arrow"
            :class="{ expanded: searchActive || expandedGroups.includes(group.name) }"
            @click.stop="toggleGroup(group.name)"
          />
          <AppIcon name="folder-open" class="group-folder-icon" />
          <span class="group-name">{{ group.name }}</span>
          <span class="group-count">{{ group.connections.length }}</span>
        </div>
        <div v-show="searchActive || expandedGroups.includes(group.name)" class="group-connections">
          <div class="connection-wrapper">
            <ConnectionTreeItem
              v-for="conn in group.connections"
              :key="conn.name"
              :conn="conn"
              :filter-keyword="filterKeyword"
            />
          </div>
        </div>
      </template>
      <template v-if="visibleUngroupedConnections.length > 0">
        <ConnectionTreeItem
          v-for="conn in visibleUngroupedConnections"
          :key="conn.name"
          :conn="conn"
          :filter-keyword="filterKeyword"
        />
      </template>
      <EmptyState v-if="searchActive && !hasSearchMatches" size="sm" :title="searchHint" />
      <EmptyState
        v-else-if="!searchActive && connectionGroups.length === 0 && ungroupedConnections.length === 0"
        size="sm"
        :title="t('暂无连接')"
        :description="t('添加一个数据库连接开始使用')"
      >
        <template #actions>
          <button type="button" class="btn btn-secondary btn-sm" @click="showAddConnectionModal">
            {{ t('新建连接') }}
          </button>
        </template>
      </EmptyState>
    </div>
    <div class="sidebar-footer">
      <div class="sidebar-search" :class="{ 'is-active': searchActive }">
        <AppIcon name="search" />
        <input v-model="searchKeyword" type="text" :placeholder="t('搜索库和表')" @keydown.esc="searchKeyword = ''" />
        <button
          v-if="searchKeyword"
          type="button"
          class="sidebar-search-clear"
          :title="t('清除搜索')"
          @click="searchKeyword = ''"
        >
          <AppIcon name="close" />
        </button>
      </div>
    </div>
    <div class="sidebar-resize-handle" @mousedown="startSidebarResize" />
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import ConnectionTreeItem from './ConnectionTreeItem.vue'
import { computed, inject, onUnmounted, ref, watch } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import EmptyState from '@/components/EmptyState.vue'
const databaseStore = inject('database')
const {
  connectionDatabases,
  connectionGroups,
  connections,
  databaseObjectsMap,
  dragOverGroup,
  draggingConnection,
  expandedGroups,
  loadConnectionDatabases,
  loadDatabaseObjects,
  onDragLeaveGroup,
  onDragOverGroup,
  onDragOverHeader,
  onDropToGroup,
  onDropToHeader,
  openConnectionTransferDialog,
  openedDatabases,
  selectGroup,
  showAddConnectionModal,
  showContextMenu,
  sidebarWidth,
  startSidebarResize,
  toggleGroup,
  ungroupedConnections
} = databaseStore

const searchKeyword = ref('')
const debouncedKeyword = ref('')
const filterKeyword = computed(() => debouncedKeyword.value.trim())
const searchActive = computed(() => filterKeyword.value.length > 0)
const activeConnections = computed(() => connections.value.filter((conn) => conn.active))

let searchTimer = 0
watch(searchKeyword, (value) => {
  window.clearTimeout(searchTimer)
  if (!value.trim()) {
    debouncedKeyword.value = value
    return
  }
  searchTimer = window.setTimeout(() => {
    debouncedKeyword.value = value
  }, 200)
})

onUnmounted(() => window.clearTimeout(searchTimer))

function connectionMatches(connection) {
  if (!connection.active) return false
  const keyword = filterKeyword.value.toLowerCase()
  const databases = connectionDatabases.value[connection.name] || []

  return databases.some((database) => {
    if (database.toLowerCase().includes(keyword)) return true
    const objectsKey = `${connection.name}_${database}`
    if (!openedDatabases.value.includes(objectsKey)) return false
    const objects = databaseObjectsMap.value[objectsKey]
    return [...(objects?.tables || []), ...(objects?.views || [])].some((name) => name.toLowerCase().includes(keyword))
  })
}

const visibleConnectionGroups = computed(() => {
  if (!searchActive.value) return connectionGroups.value
  return connectionGroups.value
    .map((group) => ({
      ...group,
      connections: group.connections.filter(connectionMatches)
    }))
    .filter((group) => group.connections.length > 0)
})

const visibleUngroupedConnections = computed(() => {
  if (!searchActive.value) return ungroupedConnections.value
  return ungroupedConnections.value.filter(connectionMatches)
})

const hasSearchMatches = computed(
  () => visibleConnectionGroups.value.length > 0 || visibleUngroupedConnections.value.length > 0
)

const searchHint = computed(() => (activeConnections.value.length ? t('没有匹配的库或表') : t('暂无已连接的链接')))

const loadingKeys = new Set()

async function loadSearchScope() {
  for (const connection of activeConnections.value) {
    if (connectionDatabases.value[connection.name] || loadingKeys.has(connection.name)) continue
    loadingKeys.add(connection.name)
    try {
      await loadConnectionDatabases(connection.name)
    } finally {
      loadingKeys.delete(connection.name)
    }
  }

  for (const connection of activeConnections.value) {
    for (const database of connectionDatabases.value[connection.name] || []) {
      const key = `${connection.name}_${database}`
      if (!openedDatabases.value.includes(key) || databaseObjectsMap.value[key] || loadingKeys.has(key)) continue
      loadingKeys.add(key)
      try {
        await loadDatabaseObjects(connection.name, database)
      } finally {
        loadingKeys.delete(key)
      }
    }
  }
}

watch([filterKeyword, connections], () => {
  if (searchActive.value) loadSearchScope()
})
</script>
