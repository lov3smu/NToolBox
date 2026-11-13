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
    <div class="connection-list" @contextmenu.prevent="showContextMenu($event, 'list')">
      <template v-for="group in connectionGroups" :key="group.name">
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
            :class="{ expanded: expandedGroups.includes(group.name) }"
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
        <div v-show="expandedGroups.includes(group.name)" class="group-connections">
          <div class="connection-wrapper">
            <ConnectionTreeItem v-for="conn in group.connections" :key="conn.name" :conn="conn" />
          </div>
        </div>
      </template>
      <template v-if="ungroupedConnections.length > 0">
        <ConnectionTreeItem v-for="conn in ungroupedConnections" :key="conn.name" :conn="conn" />
      </template>
      <div v-if="connectionGroups.length === 0 && ungroupedConnections.length === 0" class="empty-list">
        <p>暂无连接</p>
        <p class="hint">右键点击新建连接</p>
      </div>
    </div>
    <div class="sidebar-resize-handle" @mousedown="startSidebarResize" />
  </div>
</template>

<script setup>
import ConnectionTreeItem from './ConnectionTreeItem.vue'
import { inject } from 'vue'

const databaseStore = inject('database')
const {
  connectionGroups,
  dragOverGroup,
  draggingConnection,
  expandedGroups,
  onDragLeaveGroup,
  onDragOverGroup,
  onDragOverHeader,
  onDropToGroup,
  onDropToHeader,
  openConnectionTransferDialog,
  selectGroup,
  showContextMenu,
  sidebarWidth,
  startSidebarResize,
  toggleGroup,
  ungroupedConnections
} = databaseStore
</script>
