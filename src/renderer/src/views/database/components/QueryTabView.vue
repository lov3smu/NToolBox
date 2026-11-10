<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <div class="query-toolbar">
    <div class="toolbar-left">
      <div class="toolbar-select-group">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
        <select v-model="tab.connectionName" class="toolbar-select" @change="onTabConnectionChange(tab)">
          <option value="" />
          <option v-for="conn in connections" :key="conn.name" :value="conn.name">
            {{ conn.name }}
          </option>
        </select>
      </div>
      <div class="toolbar-select-group">
        <svg class="toolbar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        <select v-model="tab.database" class="toolbar-select" @change="onTabDatabaseChange(tab)">
          <option value="" />
          <option v-for="db in getTabDatabases(tab)" :key="db" :value="db">
            {{ db }}
          </option>
        </select>
      </div>
      <button
        class="btn btn-sm btn-primary"
        :disabled="!tab.sqlQuery || tab.executing"
        title="运行"
        @click="executeQueryForTab(tab)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        运行
      </button>
      <button class="btn btn-sm btn-warning" :disabled="!tab.executing" title="停止" @click="stopQueryForTab(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="6" y="6" width="12" height="12" />
        </svg>
        停止
      </button>
      <div class="toolbar-divider" />
      <template v-if="tab.inTransaction">
        <span class="transaction-badge">事务中</span>
        <button class="btn btn-sm btn-primary" title="提交事务" @click="commitTransactionForTab(tab)">提交</button>
        <button class="btn btn-sm btn-warning" title="回滚事务" @click="rollbackTransactionForTab(tab)">回滚</button>
      </template>
      <button v-else class="toolbar-icon-btn" title="开始事务" @click="beginTransactionForTab(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 4v6h6" />
          <path d="M20 20v-6h-6" />
          <path d="M4 10a8 8 0 0 1 14-5l2 2" />
          <path d="M20 14a8 8 0 0 1-14 5l-2-2" />
        </svg>
      </button>
    </div>
    <div class="toolbar-right">
      <button class="toolbar-icon-btn" title="查询历史" @click="openHistoryDialog('history')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 14" />
        </svg>
      </button>
      <button class="toolbar-icon-btn" title="SQL 片段" @click="openHistoryDialog('snippets')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
        </svg>
      </button>
      <button class="toolbar-icon-btn" :disabled="!tab.sqlQuery" title="存为片段" @click="saveSnippetFromTab(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M6 3h9l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
      </button>
      <button class="toolbar-icon-btn" title="AI 生成 SQL" @click="openAiDialog(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
          <path d="M19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z" />
        </svg>
      </button>
      <button class="toolbar-icon-btn" :disabled="!tab.sqlQuery" title="执行计划" @click="explainQueryForTab(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="6" r="2" />
          <circle cx="12" cy="18" r="2" />
          <path d="M8 6h8" />
          <path d="M7 8l4 8" />
          <path d="M17 8l-4 8" />
        </svg>
      </button>
      <button class="toolbar-icon-btn" :disabled="!tab.queryResult" title="导出查询结果" @click="openExportDialog(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </button>
      <div class="toolbar-divider" />
      <button class="toolbar-icon-btn" :disabled="!tab.sqlQuery" title="美化 SQL" @click="formatSqlForTab(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="21" y1="10" x2="3" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="21" y1="18" x2="3" y2="18" />
        </svg>
      </button>
      <button class="toolbar-icon-btn" title="清空" @click="clearQueryForTab(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      </button>
    </div>
  </div>
  <div class="query-body" :class="{ 'has-result': tab.queryResult }">
    <div class="query-editor-wrapper" :style="{ flex: tab.queryResult ? `0 0 ${editorRatio(tab)}%` : '1' }">
      <SqlEditor
        :ref="
          (el) => {
            if (el) tab.editorRef = el
          }
        "
        v-model="tab.sqlQuery"
        :tables="getTabTables(tab)"
        :databases="getTabDatabases(tab)"
        :placeholder="getTabPlaceholder(tab)"
      />
    </div>

    <div
      v-if="tab.queryResult"
      :class="['query-splitter', { active: resizingTabId === tab.id }]"
      title="拖动调整编辑器与结果区域高度"
      @pointerdown="startQueryResize($event, tab)"
    />

    <div v-if="tab.queryResult" class="query-result-wrapper">
      <div class="query-result">
        <div class="result-header">
          <div v-if="tab.queryResults && tab.queryResults.length > 1" class="result-tabs">
            <div
              v-for="result in tab.queryResults"
              :key="result.index"
              :class="['result-tab', { active: tab.activeResultIndex === result.index }]"
              @click="switchResultTab(tab, result.index)"
            >
              {{ result.name }}
            </div>
          </div>
          <span v-else class="result-title">查询结果</span>
          <span class="result-info">
            {{ tab.queryResult.success ? `成功 - 耗时: ${tab.queryResult.duration}ms` : '失败' }}
          </span>
        </div>
        <div v-if="tab.queryResult.success" class="query-result-content">
          <div v-if="tab.queryResult.rows && tab.queryResult.rows.length > 0" class="result-table-wrapper">
            <div class="result-table-scroll">
              <table class="result-table">
                <thead>
                  <tr>
                    <th v-for="field in tab.queryResult.fields" :key="field.name" class="auto-width">
                      {{ field.name }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in tab.queryResult.rows" :key="index">
                    <td v-for="field in tab.queryResult.fields" :key="field.name">
                      {{ formatCellValue(row[field.name]) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="result-empty">{{ tab.queryResult.rowCount }} 行受影响</div>
        </div>
        <div v-else class="result-error">
          {{ tab.queryResult.error }}
        </div>
      </div>
      <div class="result-footer">
        <div class="footer-left">
          <span v-if="tab.queryResult.success && tab.queryResult.rows" class="result-stats">
            {{ tab.queryResult.totalRows || tab.queryResult.rows.length }} 行
          </span>
          <div
            v-if="
              tab.queryResult.success &&
              tab.queryResult.isSelect &&
              tab.queryResult.rows &&
              tab.queryResult.rows.length > 0
            "
            class="footer-pagination"
          >
            <button
              class="pagination-btn"
              :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage <= 1"
              title="首页"
              @click="firstPage(tab)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="11 17 6 12 11 7" />
                <polyline points="18 17 13 12 18 7" />
              </svg>
            </button>
            <button
              class="pagination-btn"
              :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage <= 1"
              title="上一页"
              @click="prevPage(tab)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <input
              v-model.number="tab.queryResult.jumpPage"
              type="number"
              class="pagination-input"
              min="1"
              :max="tab.queryResult.totalPages || 1"
              title="输入页码回车跳转"
              @keyup.enter="jumpToPage(tab)"
            />
            <span class="pagination-separator">/</span>
            <span class="pagination-total">{{ tab.queryResult.totalPages || 1 }}</span>
            <button
              class="pagination-btn"
              :disabled="
                !tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)
              "
              title="下一页"
              @click="nextPage(tab)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              class="pagination-btn"
              :disabled="
                !tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)
              "
              title="末页"
              @click="lastPage(tab)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="13 17 18 12 13 7" />
                <polyline points="6 17 11 12 6 7" />
              </svg>
            </button>
          </div>
        </div>
        <div class="footer-right">
          <div v-if="limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id" class="footer-settings-panel">
            <label class="settings-checkbox">
              <input v-model="autoLimit" type="checkbox" />
              <span>限制记录</span>
            </label>
            <div v-if="autoLimit" class="settings-limit-input">
              <input v-model.number="limitCount" type="number" class="limit-input" min="1" max="100000" />
              <span class="limit-label">条记录（每页）</span>
            </div>
          </div>
          <div
            :class="[
              'footer-settings',
              {
                active: limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id
              }
            ]"
            title="设置"
            @click="toggleLimitSettingsDialog(tab)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import SqlEditor from '@/components/SqlEditor.vue'
import { inject, ref } from 'vue'

const databaseStore = inject('database')
const {
  autoLimit,
  beginTransactionForTab,
  clearQueryForTab,
  commitTransactionForTab,
  connections,
  executeQueryForTab,
  explainQueryForTab,
  firstPage,
  formatCellValue,
  formatSqlForTab,
  getTabDatabases,
  getTabPlaceholder,
  getTabTables,
  jumpToPage,
  lastPage,
  limitCount,
  limitSettingsDialog,
  nextPage,
  onTabConnectionChange,
  onTabDatabaseChange,
  openAiDialog,
  openExportDialog,
  openHistoryDialog,
  prevPage,
  rollbackTransactionForTab,
  saveSnippetFromTab,
  stopQueryForTab,
  switchResultTab,
  toggleLimitSettingsDialog
} = databaseStore

defineProps({
  tab: { type: Object, required: true }
})

const resizingTabId = ref(null)

function editorRatio(tab) {
  return tab.editorRatio ?? 50
}

function startQueryResize(event, tab) {
  if (event.button !== 0) return
  const body = event.currentTarget.parentElement
  const editor = event.currentTarget.previousElementSibling
  if (!body || !editor) return

  const bodyHeight = body.getBoundingClientRect().height
  if (!bodyHeight) return

  const startY = event.clientY
  const startHeight = editor.getBoundingClientRect().height
  resizingTabId.value = tab.id

  const onMove = (moveEvent) => {
    const next = ((startHeight + moveEvent.clientY - startY) / bodyHeight) * 100
    tab.editorRatio = Math.min(80, Math.max(20, next))
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    document.body.classList.remove('db-resizing-query')
    resizingTabId.value = null
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
  document.body.classList.add('db-resizing-query')
  event.preventDefault()
}
</script>
