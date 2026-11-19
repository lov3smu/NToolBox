<template>
  <div v-if="historyDialog.show" class="dialog-overlay" @click.self="closeHistoryDialog">
    <div class="dialog dialog-wide">
      <div class="dialog-header">
        <h3>{{ t('查询历史与片段') }}</h3>
        <button class="btn-icon btn-sm" :title="t('关闭')" @click="closeHistoryDialog">
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
          {{ t('查询历史 (') }}{{ queryHistory.length }})
        </div>
        <div
          :class="['dialog-tab', { active: historyDialog.section === 'snippets' }]"
          @click="historyDialog.section = 'snippets'"
        >
          {{ t('SQL 片段 (') }}{{ querySnippets.length }})
        </div>
      </div>
      <div class="dialog-content history-dialog-content">
        <input
          v-model="historyDialog.keyword"
          type="text"
          class="input-field"
          :placeholder="t('筛选 SQL、注释或数据库名')"
        />
        <div v-if="historyDialog.section === 'history'" class="history-list">
          <div v-if="filteredHistory.length === 0" class="history-empty">{{ t('暂无查询历史') }}</div>
          <div v-for="item in filteredHistory" :key="item.id" class="history-item">
            <pre class="history-sql" @click="loadSqlIntoEditor(item.sql)">{{ item.sql }}</pre>
            <div class="history-meta">
              <span :class="['history-status', item.success ? 'success' : 'error']">
                {{ item.success ? t('成功') : t('失败') }}
              </span>
              <span>{{ item.database || '-' }}</span>
              <span>{{ item.duration }}ms</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="history-actions">
              <button class="btn btn-xs btn-secondary" @click="loadSqlIntoEditor(item.sql)">
                {{ t('载入编辑器') }}
              </button>
              <button class="btn btn-xs btn-secondary" @click="copySql(item.sql)">{{ t('复制') }}</button>
              <button class="btn btn-xs btn-secondary" @click="saveSnippetSql(item.sql)">{{ t('存为片段') }}</button>
              <button class="btn btn-xs btn-secondary danger" @click="removeHistoryItem(item.id)">
                {{ t('删除') }}
              </button>
            </div>
          </div>
        </div>
        <div v-else class="history-list">
          <div class="snippet-folder-bar">
            <button :class="['folder-chip', { active: !activeFolder }]" @click="selectFolder('')">
              {{ t('全部 (') }}{{ querySnippets.length }})
            </button>
            <button
              v-for="folder in snippetFolders"
              :key="folder"
              :class="['folder-chip', { active: activeFolder === folder }]"
              @click="selectFolder(folder)"
            >
              {{ folder }} ({{ folderCounts[folder] }})
            </button>
            <button class="btn btn-xs btn-secondary snippet-folder-create" @click="createSnippetFolder">
              {{ t('新建收藏夹') }}
            </button>
          </div>
          <div v-if="activeFolder" class="snippet-folder-hint">{{ t('新保存的片段将归入「') }}{{ activeFolder }}」</div>
          <div v-if="filteredSnippets.length === 0" class="history-empty">{{ t('暂无 SQL 片段') }}</div>
          <div v-for="item in filteredSnippets" :key="item.id" class="history-item">
            <div class="snippet-head">
              <div class="snippet-name">{{ item.name }}</div>
              <select
                class="snippet-folder-select"
                :value="item.folder || ''"
                :title="t('移动到收藏夹')"
                @change="changeFolder(item, $event.target.value)"
              >
                <option value="">{{ t('未分组') }}</option>
                <option v-for="folder in snippetFolders" :key="folder" :value="folder">{{ folder }}</option>
              </select>
            </div>
            <pre class="history-sql" @click="loadSqlIntoEditor(item.sql)">{{ item.sql }}</pre>
            <div class="history-meta">
              <span v-if="item.folder" class="snippet-folder-tag">{{ item.folder }}</span>
              <span>{{ formatTime(item.createdAt) }}</span>
            </div>
            <div class="history-actions">
              <button class="btn btn-xs btn-secondary" @click="loadSqlIntoEditor(item.sql)">
                {{ t('载入编辑器') }}
              </button>
              <button class="btn btn-xs btn-secondary" @click="copySql(item.sql)">{{ t('复制') }}</button>
              <button class="btn btn-xs btn-secondary danger" @click="deleteSnippet(item.id)">{{ t('删除') }}</button>
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
            {{ t('清空历史') }}
          </button>
        </div>
        <button class="btn btn-primary" @click="closeHistoryDialog">{{ t('关闭') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const {
  clearHistory,
  closeHistoryDialog,
  copySql,
  createSnippetFolder,
  deleteSnippet,
  historyDialog,
  loadSqlIntoEditor,
  queryHistory,
  querySnippets,
  snippetFolders: snippetFolderList,
  removeHistoryItem,
  saveSnippetSql,
  setSnippetFolder
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

const activeFolder = computed(() => historyDialog.value.folder || '')

const snippetFolders = computed(() => {
  const folders = []
  const push = (value) => {
    const folder = String(value || '').trim()
    if (folder && !folders.includes(folder)) folders.push(folder)
  }
  for (const folder of snippetFolderList.value || []) push(folder)
  for (const item of querySnippets.value) push(item.folder)
  return folders
})

const folderCounts = computed(() => {
  const counts = {}
  for (const item of querySnippets.value) {
    const folder = String(item.folder || '').trim()
    if (!folder) continue
    counts[folder] = (counts[folder] || 0) + 1
  }
  return counts
})

const filteredSnippets = computed(() => {
  const keyword = historyDialog.value.keyword.trim().toLowerCase()
  const folder = activeFolder.value
  return querySnippets.value.filter((item) => {
    if (folder && String(item.folder || '').trim() !== folder) return false
    if (!keyword) return true
    return (
      String(item.name || '')
        .toLowerCase()
        .includes(keyword) ||
      String(item.sql || '')
        .toLowerCase()
        .includes(keyword) ||
      String(item.folder || '')
        .toLowerCase()
        .includes(keyword)
    )
  })
})

function selectFolder(folder) {
  historyDialog.value.folder = folder
}

function changeFolder(item, folder) {
  setSnippetFolder(item.id, folder)
  if (activeFolder.value && activeFolder.value !== folder) {
    historyDialog.value.folder = folder
  }
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}
</script>
