<template>
  <div v-if="objectSearchDialog.show" class="dialog-overlay" @click.self="closeObjectSearchDialog">
    <div class="dialog dialog-large">
      <div class="dialog-header">
        <h3>搜索数据库对象</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeObjectSearchDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-content object-search-content">
        <div class="object-search-bar">
          <input
            v-model="objectSearchDialog.keyword"
            type="text"
            class="input-field"
            placeholder="输入表名、字段名、函数或触发器名称"
            autofocus
            @keyup.enter="searchDatabaseObjects"
          />
          <button class="btn btn-sm btn-primary" :disabled="objectSearchDialog.loading" @click="searchDatabaseObjects">
            搜索
          </button>
        </div>
        <div v-if="objectSearchDialog.loading" class="object-search-loading">搜索中...</div>
        <div v-else-if="objectSearchDialog.items.length === 0" class="object-search-empty">没有找到匹配的对象</div>
        <div v-else class="object-search-list">
          <div
            v-for="item in objectSearchDialog.items"
            :key="`${item.type}:${item.table || ''}:${item.name}`"
            class="object-search-item"
            @click="openSearchItem(item)"
          >
            <span :class="['object-type-badge', item.type]">{{ typeLabel(item.type) }}</span>
            <span class="object-search-name">{{ item.name }}</span>
            <span class="object-search-detail">{{ item.detail }}</span>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <span class="dialog-footer-hint">共 {{ objectSearchDialog.items.length }} 个对象</span>
        <button class="btn btn-secondary" @click="closeObjectSearchDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const { closeObjectSearchDialog, objectSearchDialog, openSearchItem, searchDatabaseObjects } = databaseStore

function typeLabel(type) {
  const labels = {
    table: '表',
    view: '视图',
    column: '字段',
    function: '函数',
    procedure: '过程',
    trigger: '触发器',
    event: '事件'
  }
  return labels[type] || type
}
</script>
