<template>
  <div v-if="layoutMode === 'three'" class="info-panel" :style="{ width: infoPanelWidth + 'px' }">
    <div class="info-panel-resize-handle" @mousedown="startInfoPanelResize" />
    <div class="info-panel-toolbar">
      <button
        :class="['info-tab-btn', { active: tableInfoMode === 'info' }]"
        title="信息"
        @click="tableInfoMode = 'info'"
      >
        <svg class="info-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>
      <button
        v-if="selectedInfoType === 'table'"
        :class="['info-tab-btn', { active: tableInfoMode === 'ddl' }]"
        title="DDL"
        @click="tableInfoMode = 'ddl'"
      >
        <svg class="info-tab-icon ddl-icon" viewBox="0 0 32 16" fill="currentColor" stroke="none">
          <text x="0" y="13" font-size="12" font-weight="600" font-family="Arial, sans-serif">DDL</text>
        </svg>
      </button>
    </div>

    <div v-if="selectedInfoType" class="info-header">
      <div class="info-header-icon">
        <svg v-if="selectedInfoType === 'group'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <svg
          v-else-if="selectedInfoType === 'connection'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
        <svg
          v-else-if="selectedInfoType === 'database'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        <svg
          v-else-if="selectedInfoType === 'table'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <svg
          v-else-if="selectedInfoType === 'category'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <svg
          v-else-if="selectedInfoType === 'object'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      </div>
      <div class="info-header-text">
        <span class="info-header-name">{{ getInfoHeaderName() }}</span>
        <span class="info-header-desc">{{ getInfoHeaderDesc() }}</span>
      </div>
    </div>

    <div class="info-panel-content">
      <div v-if="!selectedInfoType" class="info-empty">
        <p>请选择对象查看信息</p>
      </div>

      <div v-else-if="selectedInfoType === 'group'" class="info-content">
        <div class="info-item">
          <span class="info-label">连接数量</span>
          <span class="info-value">{{ selectedGroup?.connections?.length || 0 }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'connection'" class="info-content">
        <div class="info-item">
          <span class="info-label">主机</span>
          <span class="info-value">{{ selectedConnection?.host }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">端口</span>
          <span class="info-value">{{ selectedConnection?.port }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">用户名</span>
          <span class="info-value">{{ selectedConnection?.user }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">状态</span>
          <span :class="['info-value', selectedConnection?.active ? 'connected' : 'disconnected']">
            {{ selectedConnection?.active ? '已连接' : '未连接' }}
          </span>
        </div>
        <div v-if="connectionInfo" class="info-item">
          <span class="info-label">服务器版本</span>
          <span class="info-value">{{ connectionInfo.version }}</span>
        </div>
        <div v-if="connectionInfo" class="info-item">
          <span class="info-label">字符集</span>
          <span class="info-value">{{ connectionInfo.charset }}</span>
        </div>
        <div v-if="connectionInfo" class="info-item">
          <span class="info-label">排序规则</span>
          <span class="info-value">{{ connectionInfo.collation }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'database'" class="info-content">
        <div class="info-item">
          <span class="info-label">连接</span>
          <span class="info-value">{{ selectedConnection?.name }}</span>
        </div>
        <div v-if="databaseInfo" class="info-item">
          <span class="info-label">字符集</span>
          <span class="info-value">{{ databaseInfo.charset }}</span>
        </div>
        <div v-if="databaseInfo" class="info-item">
          <span class="info-label">排序规则</span>
          <span class="info-value">{{ databaseInfo.collation }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">表数量</span>
          <span class="info-value">{{ objectTableDetails?.length || 0 }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'category'" class="info-content info-category-list">
        <div
          v-for="item in getCategoryList()"
          :key="item"
          class="info-category-item"
          @click="handleCategoryItemClick(item)"
        >
          <svg
            v-if="selectedCategory?.type === 'tables'"
            class="category-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <svg
            v-else-if="selectedCategory?.type === 'views'"
            class="category-item-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg
            v-else-if="selectedCategory?.type === 'functions'"
            class="category-item-icon function-icon"
            viewBox="0 0 32 18"
            fill="currentColor"
            stroke="none"
          >
            <text x="0" y="14" font-size="12" font-style="italic" font-weight="600">f</text>
            <text x="14" y="17" font-size="8">(x)</text>
          </svg>
          <svg
            v-else-if="selectedCategory?.type === 'procedures'"
            class="category-item-icon procedure-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <polygon points="10 9 15 12 10 15" />
          </svg>
          <svg
            v-else-if="selectedCategory?.type === 'triggers'"
            class="category-item-icon trigger-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          <svg
            v-else-if="selectedCategory?.type === 'events'"
            class="category-item-icon event-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span class="category-item-name">{{ item }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'object'" class="info-content">
        <div class="info-item">
          <span class="info-label">连接</span>
          <span class="info-value">{{ selectedObject?.connectionName }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">数据库</span>
          <span class="info-value">{{ selectedObject?.database }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">类型</span>
          <span class="info-value">{{ objectTypeLabel }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'table' && tableInfoMode === 'info'" class="info-content">
        <div class="info-item">
          <span class="info-label">连接</span>
          <span class="info-value">{{ selectedObject?.connectionName }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">数据库</span>
          <span class="info-value">{{ selectedObject?.database }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">行数</span>
          <span class="info-value">{{ tableInfo?.TABLE_ROWS ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">引擎</span>
          <span class="info-value">{{ tableInfo?.ENGINE ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">自动递增</span>
          <span class="info-value">{{ tableInfo?.AUTO_INCREMENT ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">行格式</span>
          <span class="info-value">{{ tableInfo?.ROW_FORMAT ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">数据长度</span>
          <span class="info-value">{{ formatSize(tableInfo?.DATA_LENGTH) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">索引长度</span>
          <span class="info-value">{{ formatSize(tableInfo?.INDEX_LENGTH) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">最大数据长度</span>
          <span class="info-value">{{ formatSize(tableInfo?.MAX_DATA_LENGTH) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">数据可用空间</span>
          <span class="info-value">{{ formatSize(tableInfo?.DATA_FREE) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">创建日期</span>
          <span class="info-value">{{ formatDate(tableInfo?.CREATE_TIME) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">修改日期</span>
          <span class="info-value">{{ formatDate(tableInfo?.UPDATE_TIME) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">检查时间</span>
          <span class="info-value">{{ formatDate(tableInfo?.CHECK_TIME) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">排序规则</span>
          <span class="info-value">{{ tableInfo?.TABLE_COLLATION ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">创建选项</span>
          <span class="info-value">{{ tableInfo?.CREATE_OPTIONS ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">注释</span>
          <span class="info-value">{{ tableInfo?.TABLE_COMMENT ?? '--' }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'table' && tableInfoMode === 'ddl'" class="info-content info-ddl-content">
        <pre class="info-ddl" v-html="highlightSql(tableDDL || '加载中...')" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const {
  connectionInfo,
  databaseInfo,
  formatDate,
  formatSize,
  getCategoryList,
  getInfoHeaderDesc,
  getInfoHeaderName,
  handleCategoryItemClick,
  highlightSql,
  infoPanelWidth,
  layoutMode,
  objectTableDetails,
  objectTypeLabel,
  selectedCategory,
  selectedConnection,
  selectedGroup,
  selectedInfoType,
  selectedObject,
  startInfoPanelResize,
  tableDDL,
  tableInfo,
  tableInfoMode
} = databaseStore
</script>
