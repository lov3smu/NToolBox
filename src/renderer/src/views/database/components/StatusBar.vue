<template>
  <div class="status-bar">
    <div class="status-left">
      <template v-if="selectedConnection">
        <span class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          {{ selectedConnection.name }}
        </span>
        <span class="status-divider">|</span>
        <span :class="['status-item', selectedConnection.active ? 'connected' : 'disconnected']">
          {{ selectedConnection.active ? '已连接' : '未连接' }}
        </span>
      </template>
      <template v-else>
        <span class="status-item">
          <svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          共 {{ connections.length }} 个连接
        </span>
      </template>
      <template v-if="lastExecutedSql">
        <span class="status-divider">|</span>
        <span class="sql-preview" :title="lastExecutedSql">{{ truncateSql(lastExecutedSql) }}</span>
        <button class="copy-btn" title="复制SQL" @click="copyLastSql">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <span class="sql-time">{{ lastExecutedTime }}ms</span>
      </template>
    </div>
    <div class="status-right">
      <button :class="['layout-btn', { active: layoutMode === 'two' }]" title="双栏布局" @click="layoutMode = 'two'">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="8" height="18" rx="2" />
          <rect x="13" y="3" width="8" height="18" rx="2" />
        </svg>
      </button>
      <button
        :class="['layout-btn', { active: layoutMode === 'three' }]"
        title="三栏布局"
        @click="layoutMode = 'three'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="6" height="18" rx="1" />
          <rect x="9" y="3" width="6" height="18" rx="1" />
          <rect x="16" y="3" width="6" height="18" rx="1" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { connections, copyLastSql, lastExecutedSql, lastExecutedTime, layoutMode, selectedConnection, truncateSql } =
  databaseStore
</script>
