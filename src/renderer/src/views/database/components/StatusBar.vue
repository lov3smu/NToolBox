<template>
  <div class="status-bar" :style="{ '--db-sidebar-width': `${sidebarWidth}px` }">
    <div class="status-left">
      <div class="status-connection">
        <template v-if="selectedConnection">
          <span class="status-item">
            <AppIcon name="database" class="status-icon" />
            {{ selectedConnection.name }}
          </span>
          <span class="status-divider">|</span>
          <span :class="['status-item', selectedConnection.active ? 'connected' : 'disconnected']">
            {{ selectedConnection.active ? t('已连接') : t('未连接') }}
          </span>
        </template>
        <template v-else>
          <span class="status-item">
            <AppIcon name="database" class="status-icon" />
            {{ t('共') }} {{ connections.length }} {{ t('个连接') }}
          </span>
        </template>
      </div>
      <div v-if="lastExecutedSql" class="status-sql">
        <span class="sql-preview" :title="lastExecutedSql">{{ truncateSql(lastExecutedSql) }}</span>
        <button class="copy-btn" :title="t('复制SQL')" @click="copyLastSql">
          <AppIcon name="copy" />
        </button>
        <span class="sql-time">{{ lastExecutedTime }}ms</span>
      </div>
    </div>
    <div class="status-right">
      <button
        :class="['layout-btn', { active: layoutMode === 'two' }]"
        :title="t('双栏布局')"
        @click="layoutMode = 'two'"
      >
        <AppIcon name="layout-two" />
      </button>
      <button
        :class="['layout-btn', { active: layoutMode === 'three' }]"
        :title="t('三栏布局')"
        @click="layoutMode = 'three'"
      >
        <AppIcon name="layout-three" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const {
  connections,
  copyLastSql,
  lastExecutedSql,
  lastExecutedTime,
  layoutMode,
  selectedConnection,
  sidebarWidth,
  truncateSql
} = databaseStore
</script>
