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
        <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        我的连接
      </h3>
      <div class="sidebar-header-actions" @click.stop>
        <button class="sidebar-icon-btn" title="导入连接配置" @click="openConnectionTransferDialog('import')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </button>
        <button class="sidebar-icon-btn" title="导出连接配置" @click="openConnectionTransferDialog('export')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
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
          <svg
            class="group-arrow"
            :class="{ expanded: searchActive || expandedGroups.includes(group.name) }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            @click.stop="toggleGroup(group.name)"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <svg class="group-folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
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
      <div v-if="searchActive && !hasSearchMatches" class="empty-list">
        <p>{{ searchHint }}</p>
      </div>
      <div
        v-else-if="!searchActive && connectionGroups.length === 0 && ungroupedConnections.length === 0"
        class="empty-list"
      >
        <p>暂无连接</p>
        <p class="hint">添加一个数据库连接开始使用</p>
        <button type="button" class="btn btn-secondary btn-sm empty-list-action" @click="showAddConnectionModal">
          新建连接
        </button>
      </div>
    </div>
    <div class="sidebar-footer">
      <div class="sidebar-search" :class="{ 'is-active': searchActive }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input v-model="searchKeyword" type="text" placeholder="搜索库和表" @keydown.esc="searchKeyword = ''" />
        <button
          v-if="searchKeyword"
          type="button"
          class="sidebar-search-clear"
          title="清除搜索"
          @click="searchKeyword = ''"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
    <div class="sidebar-resize-handle" @mousedown="startSidebarResize" />
  </div>
</template>

<script setup>
import ConnectionTreeItem from './ConnectionTreeItem.vue'
import { computed, inject, onUnmounted, ref, watch } from 'vue'

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

const searchHint = computed(() => (activeConnections.value.length ? '没有匹配的库或表' : '暂无已连接的链接'))

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
