<template>
  <div v-if="layoutMode === 'three'" class="info-panel" :style="{ width: infoPanelWidth + 'px' }">
    <div class="info-panel-resize-handle" @mousedown="startInfoPanelResize" />
    <div class="info-panel-toolbar">
      <button
        :class="['info-tab-btn', { active: tableInfoMode === 'info' }]"
        :title="t('信息')"
        @click="tableInfoMode = 'info'"
      >
        <AppIcon name="info" class="info-tab-icon" />
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
        <AppIcon v-if="selectedInfoType === 'group'" name="folder-open" />
        <AppIcon v-else-if="selectedInfoType === 'connection'" name="layers" />
        <AppIcon v-else-if="selectedInfoType === 'database'" name="database" />
        <AppIcon v-else-if="selectedInfoType === 'table'" name="table" />
        <AppIcon v-else-if="selectedInfoType === 'category'" name="table" />
        <AppIcon v-else-if="selectedInfoType === 'object'" name="code" />
      </div>
      <div class="info-header-text">
        <span class="info-header-name">{{ getInfoHeaderName() }}</span>
        <span class="info-header-desc">{{ getInfoHeaderDesc() }}</span>
      </div>
    </div>

    <div class="info-panel-content">
      <div v-if="!selectedInfoType" class="info-empty">
        <p>{{ t('请选择对象查看信息') }}</p>
      </div>

      <div v-else-if="selectedInfoType === 'group'" class="info-content">
        <div class="info-item">
          <span class="info-label">{{ t('连接数量') }}</span>
          <span class="info-value">{{ selectedGroup?.connections?.length || 0 }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'connection'" class="info-content">
        <div class="info-item">
          <span class="info-label">{{ t('主机') }}</span>
          <span class="info-value">{{ selectedConnection?.host }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('端口') }}</span>
          <span class="info-value">{{ selectedConnection?.port }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('用户名') }}</span>
          <span class="info-value">{{ selectedConnection?.user }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('状态') }}</span>
          <span :class="['info-value', selectedConnection?.active ? 'connected' : 'disconnected']">
            {{ selectedConnection?.active ? t('已连接') : t('未连接') }}
          </span>
        </div>
        <div v-if="connectionInfo" class="info-item">
          <span class="info-label">{{ t('服务器版本') }}</span>
          <span class="info-value">{{ connectionInfo.version }}</span>
        </div>
        <div v-if="connectionInfo" class="info-item">
          <span class="info-label">{{ t('字符集') }}</span>
          <span class="info-value">{{ connectionInfo.charset }}</span>
        </div>
        <div v-if="connectionInfo" class="info-item">
          <span class="info-label">{{ t('排序规则') }}</span>
          <span class="info-value">{{ connectionInfo.collation }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'database'" class="info-content">
        <div class="info-item">
          <span class="info-label">{{ t('连接') }}</span>
          <span class="info-value">{{ selectedConnection?.name }}</span>
        </div>
        <div v-if="databaseInfo" class="info-item">
          <span class="info-label">{{ t('字符集') }}</span>
          <span class="info-value">{{ databaseInfo.charset }}</span>
        </div>
        <div v-if="databaseInfo" class="info-item">
          <span class="info-label">{{ t('排序规则') }}</span>
          <span class="info-value">{{ databaseInfo.collation }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('表数量') }}</span>
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
          <AppIcon v-if="selectedCategory?.type === 'tables'" name="table" class="category-item-icon" />
          <AppIcon v-else-if="selectedCategory?.type === 'views'" name="eye" class="category-item-icon" />
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
          <AppIcon
            v-else-if="selectedCategory?.type === 'procedures'"
            name="procedure"
            class="category-item-icon procedure-icon"
          />
          <AppIcon
            v-else-if="selectedCategory?.type === 'triggers'"
            name="zap"
            class="category-item-icon trigger-icon"
          />
          <AppIcon
            v-else-if="selectedCategory?.type === 'events'"
            name="history"
            class="category-item-icon event-icon"
          />
          <span class="category-item-name">{{ item }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'object'" class="info-content">
        <div class="info-item">
          <span class="info-label">{{ t('连接') }}</span>
          <span class="info-value">{{ selectedObject?.connectionName }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('数据库') }}</span>
          <span class="info-value">{{ selectedObject?.database }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('类型') }}</span>
          <span class="info-value">{{ objectTypeLabel }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'table' && tableInfoMode === 'info'" class="info-content">
        <div class="info-item">
          <span class="info-label">{{ t('连接') }}</span>
          <span class="info-value">{{ selectedObject?.connectionName }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('数据库') }}</span>
          <span class="info-value">{{ selectedObject?.database }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('行数') }}</span>
          <span class="info-value">{{ tableInfo?.TABLE_ROWS ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('引擎') }}</span>
          <span class="info-value">{{ tableInfo?.ENGINE ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('自动递增') }}</span>
          <span class="info-value">{{ tableInfo?.AUTO_INCREMENT ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('行格式') }}</span>
          <span class="info-value">{{ tableInfo?.ROW_FORMAT ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('数据长度') }}</span>
          <span class="info-value">{{ formatSize(tableInfo?.DATA_LENGTH) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('索引长度') }}</span>
          <span class="info-value">{{ formatSize(tableInfo?.INDEX_LENGTH) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('最大数据长度') }}</span>
          <span class="info-value">{{ formatSize(tableInfo?.MAX_DATA_LENGTH) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('数据可用空间') }}</span>
          <span class="info-value">{{ formatSize(tableInfo?.DATA_FREE) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('创建日期') }}</span>
          <span class="info-value">{{ formatDate(tableInfo?.CREATE_TIME) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('修改日期') }}</span>
          <span class="info-value">{{ formatDate(tableInfo?.UPDATE_TIME) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('检查时间') }}</span>
          <span class="info-value">{{ formatDate(tableInfo?.CHECK_TIME) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('排序规则') }}</span>
          <span class="info-value">{{ tableInfo?.TABLE_COLLATION ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('创建选项') }}</span>
          <span class="info-value">{{ tableInfo?.CREATE_OPTIONS ?? '--' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('注释') }}</span>
          <span class="info-value">{{ tableInfo?.TABLE_COMMENT ?? '--' }}</span>
        </div>
      </div>

      <div v-else-if="selectedInfoType === 'table' && tableInfoMode === 'ddl'" class="info-content info-ddl-content">
        <SqlHighlight class="info-ddl" :code="tableDDL" :placeholder="t('加载中...')" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject } from 'vue'
import SqlHighlight from '@/components/SqlHighlight.vue'

import AppIcon from '@/components/AppIcon.vue'
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
