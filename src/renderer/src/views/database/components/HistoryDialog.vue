<template>
  <div v-if="historyDialog.show" class="dialog-overlay" @click.self="closeHistoryDialog">
    <div class="dialog dialog-wide">
      <div class="dialog-header">
        <h3>查询历史与片段</h3>
        <button class="btn-icon btn-sm" title="关闭" @click="closeHistoryDialog">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="dialog-tabs">
        <div
          :class="['dialog-tab', { active: historyDialog.section === 'history' }]"
          @click="historyDialog.section = 'history'"
        >
          查询历史 ({{ queryHistory.length }})
        </div>
        <div
          :class="['dialog-tab', { active: historyDialog.section === 'snippets' }]"
          @click="historyDialog.section = 'snippets'"
        >
          SQL 片段 ({{ querySnippets.length }})
        </div>
      </div>
      <div class="dialog-content history-dialog-content">
        <input v-model="historyDialog.keyword" type="text" class="input-field" placeholder="筛选 SQL、注释或数据库名" />
        <div v-if="historyDialog.section === 'history'" class="history-list">
          <div v-if="filteredHistory.length === 0" class="history-empty">暂无查询历史</div>
          <div v-for="item in filteredHistory" :key="item.id" class="history-item">
            <pre class="history-sql" @click="loadSqlIntoEditor(item.sql)">{{ item.sql }}</pre>
            <div class="history-meta">
              <span :class="['history-status', item.success ? 'success' : 'error']">
                {{ item.success ? '成功' : '失败' }}
              </span>
              <span>{{ item.database || '-' }}</span>
              <span>{{ item.duration }}ms</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="history-actions">
              <button class="btn btn-xs btn-secondary" @click="loadSqlIntoEditor(item.sql)">载入编辑器</button>
              <button class="btn btn-xs btn-secondary" @click="copySql(item.sql)">复制</button>
              <button class="btn btn-xs btn-secondary" @click="saveSnippetSql(item.sql)">存为片段</button>
              <button class="btn btn-xs btn-secondary danger" @click="removeHistoryItem(item.id)">删除</button>
            </div>
          </div>
        </div>
        <div v-else class="history-list">
          <div v-if="filteredSnippets.length === 0" class="history-empty">暂无 SQL 片段</div>
          <div v-for="item in filteredSnippets" :key="item.id" class="history-item">
            <div class="snippet-name">{{ item.name }}</div>
            <pre class="history-sql" @click="loadSqlIntoEditor(item.sql)">{{ item.sql }}</pre>
            <div class="history-meta">
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="history-actions">
              <button class="btn btn-xs btn-secondary" @click="loadSqlIntoEditor(item.sql)">载入编辑器</button>
              <button class="btn btn-xs btn-secondary" @click="copySql(item.sql)">复制</button>
              <button class="btn btn-xs btn-secondary danger" @click="deleteSnippet(item.id)">删除</button>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <button
            v-if="historyDialog.section === 'history'"
            class="btn btn-secondary"
            :disabled="queryHistory.length === 0"
            @click="clearHistory"
          >
            清空历史
          </button>
        </div>
        <button class="btn btn-primary" @click="closeHistoryDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const {
  clearHistory,
  closeHistoryDialog,
  copySql,
  deleteSnippet,
  historyDialog,
  loadSqlIntoEditor,
  queryHistory,
  querySnippets,
  removeHistoryItem,
  saveSnippetSql
} = databaseStore

const filteredHistory = computed(() => {
  const keyword = historyDialog.value.keyword.trim().toLowerCase()
  if (!keyword) return queryHistory.value
  return queryHistory.value.filter(
    (item) =>
      String(item.sql || '')
        .toLowerCase()
        .includes(keyword) ||
      String(item.database || '')
        .toLowerCase()
        .includes(keyword) ||
      String(item.connectionName || '')
        .toLowerCase()
        .includes(keyword)
  )
})

const filteredSnippets = computed(() => {
  const keyword = historyDialog.value.keyword.trim().toLowerCase()
  if (!keyword) return querySnippets.value
  return querySnippets.value.filter(
    (item) =>
      String(item.name || '')
        .toLowerCase()
        .includes(keyword) ||
      String(item.sql || '')
        .toLowerCase()
        .includes(keyword)
  )
})

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}
</script>
