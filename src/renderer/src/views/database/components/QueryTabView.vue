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
      <button class="toolbar-icon-btn" :disabled="!tab.queryResult" title="复制结果为 CSV" @click="copyResultCsv(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
        :schema="getTabSchema(tab)"
        :placeholder="getTabPlaceholder(tab)"
        :connection-name="tab.connectionName"
        :database="tab.database"
        :settings="databaseEditor"
        @execute="executeEditorStatement(tab, $event)"
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
          <div class="result-header-actions">
            <span v-if="tab.queryResult.editLoading" class="result-edit-hint">正在识别可编辑性…</span>
            <span
              v-else-if="tab.queryResult.editSource"
              class="result-edit-badge"
              :title="`来源表 ${tab.queryResult.editSource.database}.${tab.queryResult.editSource.tableName}`"
            >
              可编辑<template v-if="tab.queryResult.editSource.isUniqueKey"> · 唯一键</template>
            </span>
            <span
              v-else-if="tab.queryResult.editChecked && tab.queryResult.readonlyReason"
              class="result-readonly-badge"
              :title="tab.queryResult.readonlyReason"
            >
              只读
            </span>
            <button
              v-if="tab.previousResult && tab.queryResult.success"
              class="btn btn-xs btn-secondary result-compare-btn"
              title="与上一次执行结果对比"
              @click="openResultCompare(tab)"
            >
              对比上次
            </button>
            <template v-if="canEditResult(tab.queryResult) && tab.queryResult.editMode">
              <button
                class="btn btn-sm btn-secondary"
                :disabled="tab.queryResult.saving"
                @click="addResultRow(tab.queryResult)"
              >
                新增行
              </button>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="tab.queryResult.saving"
                @click="deleteSelectedResultRows(tab.queryResult)"
              >
                删除选中
              </button>
            </template>
            <button
              v-if="canEditResult(tab.queryResult)"
              class="btn btn-sm btn-secondary"
              :disabled="tab.queryResult.saving"
              @click="toggleResultEditMode(tab.queryResult)"
            >
              {{ tab.queryResult.editMode ? '退出编辑' : '编辑结果' }}
            </button>
            <span class="result-info">
              {{ tab.queryResult.success ? `成功 - 耗时: ${tab.queryResult.duration}ms` : '失败' }}
            </span>
          </div>
        </div>
        <div v-if="tab.queryResult.success" class="query-result-content">
          <div v-if="tab.queryResult.rows && tab.queryResult.rows.length > 0" class="result-table-wrapper">
            <div class="result-table-scroll">
              <table :class="['result-table', { 'editable-table': tab.queryResult.editMode }]">
                <thead>
                  <tr>
                    <th v-if="tab.queryResult.editMode" class="row-select-col">
                      <input
                        type="checkbox"
                        :checked="isAllResultRowsSelected(tab.queryResult)"
                        :disabled="tab.queryResult.saving"
                        title="全选当前页"
                        @change="toggleAllResultRows(tab.queryResult, $event.target.checked)"
                      />
                    </th>
                    <th v-for="field in tab.queryResult.fields" :key="field.name" class="auto-width">
                      <span class="th-inline">
                        {{ field.name }}
                        <span v-if="tab.queryResult.editSource?.primaryKeys?.includes(field.name)" class="pk-badge">
                          PK
                        </span>
                      </span>
                    </th>
                    <th v-if="tab.queryResult.editMode" class="row-action-col" />
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in tab.queryResult.rows"
                    :key="index"
                    :class="{
                      'deleted-row': isResultRowDeleted(tab.queryResult, row),
                      'updated-row': isResultRowUpdated(tab.queryResult, row),
                      'selected-row': isResultRowSelected(tab.queryResult, row)
                    }"
                  >
                    <td v-if="tab.queryResult.editMode" class="row-select-col">
                      <input
                        type="checkbox"
                        :checked="isResultRowSelected(tab.queryResult, row)"
                        :disabled="isResultRowDeleted(tab.queryResult, row) || tab.queryResult.saving"
                        @change="toggleResultRowSelection(tab.queryResult, row)"
                      />
                    </td>
                    <td
                      v-for="field in tab.queryResult.fields"
                      :key="field.name"
                      :class="{ 'edited-cell': isResultCellEdited(tab.queryResult, row, field.name) }"
                      @dblclick="onResultCellDblclick(tab, row, field.name)"
                    >
                      <template v-if="tab.queryResult.editMode && isResultRowDeleted(tab.queryResult, row)">
                        {{ formatCellValue(row[field.name]) }}
                      </template>
                      <template
                        v-else-if="tab.queryResult.editMode && isEditableResultField(tab.queryResult, field.name)"
                      >
                        <input
                          class="cell-editor"
                          :value="resultCellInputValue(tab.queryResult, row, field.name)"
                          @change="updateResultCell(tab.queryResult, row, field.name, $event.target.value)"
                        />
                      </template>
                      <template v-else>{{
                        formatCellValue(getResultCellValue(tab.queryResult, row, field.name))
                      }}</template>
                    </td>
                    <td v-if="tab.queryResult.editMode" class="row-action-col">
                      <button
                        v-if="isResultRowDeleted(tab.queryResult, row)"
                        class="row-action-btn"
                        title="撤销删除"
                        @click="restoreResultDeletedRow(tab.queryResult, row)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                      </button>
                      <button
                        v-else
                        class="row-action-btn danger"
                        title="删除行"
                        @click="deleteResultRow(tab.queryResult, row)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  <tr
                    v-for="(draft, index) in tab.queryResult.rowInserts"
                    v-show="tab.queryResult.editMode"
                    :key="'insert-' + index"
                    class="insert-row"
                  >
                    <td class="row-select-col"><span class="insert-badge">+</span></td>
                    <td v-for="field in tab.queryResult.fields" :key="field.name">
                      <input
                        class="cell-editor"
                        :value="formatCellInput(draft.values[field.name])"
                        :placeholder="resultColumnMeta(tab.queryResult, field.name)?.autoIncrement ? '自动' : ''"
                        @change="setResultNewRowValue(tab.queryResult, index, field.name, $event.target.value)"
                      />
                    </td>
                    <td class="row-action-col">
                      <button
                        class="row-action-btn danger"
                        title="移除新增行"
                        @click="removeResultNewRow(tab.queryResult, index)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
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
      <div v-if="tab.queryResult.editMode && hasResultPendingChanges(tab.queryResult)" class="pending-changes-bar">
        <div class="pending-changes-info">
          <span class="pending-changes-dot" />
          <span class="pending-changes-title">结果已修改</span>
          <span class="pending-changes-counts">
            <span v-if="pendingResultCounts(tab.queryResult).updated" class="pending-change-chip">
              更新 {{ pendingResultCounts(tab.queryResult).updated }} 行
            </span>
            <span v-if="pendingResultCounts(tab.queryResult).deleted" class="pending-change-chip removed">
              删除 {{ pendingResultCounts(tab.queryResult).deleted }} 行
            </span>
            <span v-if="pendingResultCounts(tab.queryResult).inserted" class="pending-change-chip added">
              新增 {{ pendingResultCounts(tab.queryResult).inserted }} 行
            </span>
          </span>
        </div>
        <div class="pending-changes-actions">
          <button
            class="btn btn-sm btn-secondary"
            :disabled="tab.queryResult.saving"
            @click="previewResultChanges(tab.queryResult)"
          >
            预览 SQL
          </button>
          <button
            class="btn btn-sm btn-secondary"
            :disabled="tab.queryResult.saving"
            @click="discardResultChanges(tab.queryResult)"
          >
            撤销
          </button>
          <button
            class="btn btn-sm btn-primary"
            :disabled="tab.queryResult.saving"
            @click="saveResultChanges(tab, tab.queryResult)"
          >
            {{ tab.queryResult.saving ? '提交中...' : '提交修改' }}
          </button>
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
import { copyToClipboard } from '@/utils/clipboard'
import { inject, ref, watch } from 'vue'
import { formatCellInput, isBinaryColumn } from '../cellFormat'

const databaseStore = inject('database')
const databaseEditor = inject('databaseEditor', null)
const {
  addResultRow,
  autoLimit,
  beginTransactionForTab,
  canEditResult,
  clearQueryForTab,
  commitTransactionForTab,
  connections,
  deleteResultRow,
  deleteSelectedResultRows,
  discardResultChanges,
  executeQueryForTab,
  explainQueryForTab,
  firstPage,
  formatCellValue,
  formatSqlForTab,
  getResultCellValue,
  getResultPendingCounts,
  getTabDatabases,
  getTabPlaceholder,
  getTabSchema,
  getTabTables,
  hasResultPendingChanges,
  isAllResultRowsSelected,
  isResultCellEdited,
  isResultRowDeleted,
  isResultRowSelected,
  isResultRowUpdated,
  jumpToPage,
  lastPage,
  limitCount,
  limitSettingsDialog,
  loadTabSchema,
  nextPage,
  onTabConnectionChange,
  onTabDatabaseChange,
  openAiDialog,
  openCellViewer,
  openExportDialog,
  openResultCompare,
  openHistoryDialog,
  prevPage,
  previewResultChanges,
  removeResultNewRow,
  resultColumnMeta,
  restoreResultDeletedRow,
  rollbackTransactionForTab,
  saveResultChanges,
  saveSnippetFromTab,
  setResultNewRowValue,
  showMessage,
  stopQueryForTab,
  switchResultTab,
  toggleAllResultRows,
  toggleLimitSettingsDialog,
  toggleResultEditMode,
  toggleResultRowSelection,
  updateResultCell
} = databaseStore

const props = defineProps({
  tab: { type: Object, required: true }
})

watch(
  () => [props.tab.connectionName, props.tab.database],
  ([connectionName, database]) => {
    if (connectionName && database) loadTabSchema(props.tab)
  },
  { immediate: true }
)

const resizingTabId = ref(null)

function executeEditorStatement(tab, sql) {
  if (tab.executing) return
  executeQueryForTab(tab, sql)
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function isEditableResultField(result, fieldName) {
  const meta = resultColumnMeta(result, fieldName)
  if (!meta) return false
  if (/GENERATED/i.test(String(meta.extra || ''))) return false
  return !isBinaryColumn(meta.dataType || meta.columnType)
}

function resultCellInputValue(result, row, fieldName) {
  return formatCellInput(getResultCellValue(result, row, fieldName))
}

function pendingResultCounts(result) {
  return getResultPendingCounts(result)
}

function onResultCellDblclick(tab, row, fieldName) {
  const result = tab.queryResult
  if (result.editMode && !isResultRowDeleted(result, row) && isEditableResultField(result, fieldName)) return
  const meta = resultColumnMeta(result, fieldName)
  openCellViewer(fieldName, meta?.columnType || '', getResultCellValue(result, row, fieldName))
}

async function copyResultCsv(tab) {
  const result = tab.queryResult
  const rows = result?.rows || []
  const fields = (result?.fields || []).map((field) => field.name)
  if (!rows.length || !fields.length) {
    await showMessage('当前结果没有可复制的数据', 'warning')
    return
  }
  const lines = [fields.map(escapeCsvCell).join(',')]
  for (const row of rows) {
    lines.push(fields.map((field) => escapeCsvCell(row[field])).join(','))
  }
  const copied = await copyToClipboard(lines.join('\n'))
  await showMessage(copied ? `已复制 ${rows.length} 行 CSV` : '复制失败', copied ? 'success' : 'error')
}

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
