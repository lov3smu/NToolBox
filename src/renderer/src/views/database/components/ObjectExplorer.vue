<template>
  <div v-if="activeTabId === 'object'" class="object-panel">
    <div v-if="selectedObject" class="object-content">
      <div class="object-header">
        <div class="object-title">
          <svg
            class="object-type-icon"
            :class="selectedObject.type"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <template v-if="selectedObject.type === 'database'">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </template>
            <template v-else-if="selectedObject.type === 'table'">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </template>
            <template v-else-if="selectedObject.type === 'view'">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </template>
            <template v-else-if="selectedObject.type === 'function'">
              <path
                d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
              />
            </template>
            <template v-else-if="selectedObject.type === 'procedure'">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <polygon points="10 9 15 12 10 15" />
            </template>
            <template v-else-if="selectedObject.type === 'trigger'">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </template>
            <template v-else-if="selectedObject.type === 'event'">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </template>
          </svg>
          <span>{{ selectedObject.name }}</span>
          <span class="object-type-label">{{ objectTypeLabel }}</span>
        </div>
        <div class="object-search">
          <input v-model="objectSearchKeyword" type="text" placeholder="搜索..." class="search-input" />
        </div>
      </div>
      <div v-if="selectedObject.type === 'database'" class="object-tables">
        <div v-if="objectTableDetails.length === 0" class="object-loading">
          <p>加载中...</p>
        </div>
        <div v-else-if="filteredTableDetails.length === 0" class="object-empty-list">
          <p>{{ objectSearchKeyword ? '没有匹配的结果' : '暂无表' }}</p>
        </div>
        <div v-else class="tables-list">
          <div class="tables-header">
            <span class="col-name">名称</span>
            <span class="col-rows">行数</span>
            <span class="col-size">数据长度</span>
            <span class="col-engine">引擎</span>
            <span class="col-modified">修改日期</span>
            <span class="col-comment">注释</span>
          </div>
          <div class="tables-body">
            <div
              v-for="table in filteredTableDetails"
              :key="table.name"
              class="table-row"
              @click="selectTableObject(table.name)"
            >
              <span class="col-name">
                <svg class="table-icon-small" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                {{ table.name }}
              </span>
              <span class="col-rows">{{ table.rows }}</span>
              <span class="col-size">{{ formatSize(table.dataSize) }}</span>
              <span class="col-engine">{{ table.engine }}</span>
              <span class="col-modified">{{ formatDate(table.modified) }}</span>
              <span class="col-comment">{{ table.comment || '-' }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="selectedObject.type === 'table'" class="object-detail">
        <div v-if="tableStructure.length === 0" class="object-loading">
          <p>加载中...</p>
        </div>
        <div v-else class="structure-list">
          <div class="structure-header">
            <span class="col-field">字段</span>
            <span class="col-type">类型</span>
            <span class="col-null">允许空</span>
            <span class="col-key">键</span>
            <span class="col-default">默认值</span>
            <span class="col-extra">额外</span>
          </div>
          <div class="structure-body">
            <div v-for="field in filteredTableStructure" :key="field.name" class="structure-row">
              <span class="col-field">{{ field.name }}</span>
              <span class="col-type">{{ field.columnType || field.dataType }}</span>
              <span class="col-null">{{ field.nullable ? 'YES' : 'NO' }}</span>
              <span class="col-key">{{ field.columnKey || '-' }}</span>
              <span class="col-default">{{ field.defaultValue ?? '-' }}</span>
              <span class="col-extra">{{ field.extra || '-' }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="selectedObject.type === 'view'" class="object-detail">
        <div class="view-definition">
          <p class="definition-label">视图定义:</p>
          <pre class="definition-code">{{ viewDefinition }}</pre>
        </div>
      </div>
      <div v-else-if="selectedObject.type === 'function'" class="object-detail">
        <div class="function-definition">
          <p class="definition-label">函数定义:</p>
          <pre class="definition-code">{{ functionDefinition }}</pre>
        </div>
      </div>
      <div v-else-if="['procedure', 'trigger', 'event'].includes(selectedObject.type)" class="object-detail">
        <div class="object-definition">
          <p class="definition-label">{{ objectTypeLabel }}定义:</p>
          <pre class="definition-code">{{ objectDefinition || '加载中...' }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const {
  activeTabId,
  filteredTableDetails,
  filteredTableStructure,
  formatDate,
  formatSize,
  functionDefinition,
  objectDefinition,
  objectSearchKeyword,
  objectTableDetails,
  objectTypeLabel,
  selectTableObject,
  selectedObject,
  tableStructure,
  viewDefinition
} = databaseStore
</script>
