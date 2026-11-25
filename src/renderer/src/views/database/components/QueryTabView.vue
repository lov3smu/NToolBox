<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <div class="query-toolbar">
    <div class="toolbar-left">
      <div class="toolbar-select-group">
        <AppIcon name="layers" class="toolbar-icon" />
        <select v-model="tab.connectionName" class="toolbar-select" @change="onTabConnectionChange(tab)">
          <option value="" />
          <option v-for="conn in connections" :key="conn.name" :value="conn.name">
            {{ conn.name }}
          </option>
        </select>
      </div>
      <div class="toolbar-select-group">
        <AppIcon name="database" class="toolbar-icon" />
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
        :title="t('运行')"
        @click="executeQueryForTab(tab)"
      >
        <AppIcon name="run" />
        {{ t('运行') }}
      </button>
      <button
        class="btn btn-sm btn-warning"
        :disabled="!tab.executing"
        :title="t('停止')"
        @click="stopQueryForTab(tab)"
      >
        <AppIcon name="stop" />
        {{ t('停止') }}
      </button>
      <div class="toolbar-divider" />
      <template v-if="tab.inTransaction">
        <span class="transaction-badge">{{ t('事务中') }}</span>
        <button class="btn btn-sm btn-primary" :title="t('提交事务')" @click="commitTransactionForTab(tab)">
          {{ t('提交') }}
        </button>
        <button class="btn btn-sm btn-warning" :title="t('回滚事务')" @click="rollbackTransactionForTab(tab)">
          {{ t('回滚') }}
        </button>
      </template>
      <button v-else class="toolbar-icon-btn" :title="t('开始事务')" @click="beginTransactionForTab(tab)">
        <AppIcon name="refresh" />
      </button>
    </div>
    <div class="toolbar-right">
      <button class="toolbar-icon-btn" :title="t('查询历史')" @click="openHistoryDialog('history')">
        <AppIcon name="history" />
      </button>
      <button class="toolbar-icon-btn" :title="t('SQL 片段')" @click="openHistoryDialog('snippets')">
        <AppIcon name="bookmark" />
      </button>
      <button
        class="toolbar-icon-btn"
        :disabled="!tab.sqlQuery"
        :title="t('存为片段')"
        @click="saveSnippetFromTab(tab)"
      >
        <AppIcon name="file-plus" />
      </button>
      <button class="toolbar-icon-btn" :title="t('AI 生成 SQL')" @click="openAiDialog(tab)">
        <AppIcon name="sparkles" />
      </button>
      <button class="toolbar-icon-btn" :title="t('AI 处理选中 SQL')" @click="openInlineAiForTab(tab)">
        <AppIcon name="bot" />
      </button>
      <button
        class="toolbar-icon-btn"
        :disabled="!tab.sqlQuery"
        :title="t('执行计划')"
        @click="explainQueryForTab(tab)"
      >
        <AppIcon name="network" />
      </button>
      <button
        class="toolbar-icon-btn"
        :disabled="!tab.queryResult"
        :title="t('复制结果为 CSV')"
        @click="copyResultCsv(tab)"
      >
        <AppIcon name="copy" />
      </button>
      <button
        class="toolbar-icon-btn"
        :disabled="!tab.queryResult"
        :title="t('发送到…')"
        :aria-label="t('发送到…')"
        @click="openSendMenuForResult($event, tab)"
      >
        <AppIcon name="shuffle" />
      </button>
      <button
        class="toolbar-icon-btn"
        :disabled="!tab.queryResult"
        :title="t('导出查询结果')"
        @click="openExportDialog(tab)"
      >
        <AppIcon name="download" />
      </button>
      <div class="toolbar-divider" />
      <button class="toolbar-icon-btn" :disabled="!tab.sqlQuery" :title="t('美化 SQL')" @click="formatSqlForTab(tab)">
        <AppIcon name="align-justify" />
      </button>
      <button class="toolbar-icon-btn" :title="t('清空')" @click="clearQueryForTab(tab)">
        <AppIcon name="trash" />
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
      :title="t('拖动调整编辑器与结果区域高度')"
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
          <span v-else class="result-title">{{ t('查询结果') }}</span>
          <div class="result-header-actions">
            <span v-if="tab.queryResult.editLoading" class="result-edit-hint">{{ t('正在识别可编辑性…') }}</span>
            <span
              v-else-if="tab.queryResult.editSource"
              class="result-edit-badge"
              :title="
                t('来源表 {p0}.{p1}', {
                  p0: tab.queryResult.editSource.database,
                  p1: tab.queryResult.editSource.tableName
                })
              "
            >
              {{ t('可编辑') }}<template v-if="tab.queryResult.editSource.isUniqueKey"> {{ t('· 唯一键') }}</template>
            </span>
            <span
              v-else-if="tab.queryResult.editChecked && tab.queryResult.readonlyReason"
              class="result-readonly-badge"
              :title="tab.queryResult.readonlyReason"
            >
              {{ t('只读') }}
            </span>
            <button
              v-if="tab.previousResult && tab.queryResult.success"
              class="btn btn-xs btn-secondary result-compare-btn"
              :title="t('与上一次执行结果对比')"
              @click="openResultCompare(tab)"
            >
              {{ t('对比上次') }}
            </button>
            <template v-if="canEditResult(tab.queryResult) && tab.queryResult.editMode">
              <button
                class="btn btn-sm btn-secondary"
                :disabled="tab.queryResult.saving"
                @click="addResultRow(tab.queryResult)"
              >
                {{ t('新增行') }}
              </button>
              <button
                class="btn btn-sm btn-secondary"
                :disabled="tab.queryResult.saving"
                @click="deleteSelectedResultRows(tab.queryResult)"
              >
                {{ t('删除选中') }}
              </button>
            </template>
            <button
              v-if="canEditResult(tab.queryResult)"
              class="btn btn-sm btn-secondary"
              :disabled="tab.queryResult.saving"
              @click="toggleResultEditMode(tab.queryResult)"
            >
              {{ tab.queryResult.editMode ? t('退出编辑') : t('编辑结果') }}
            </button>
            <div
              v-if="
                tab.queryResult.success &&
                tab.queryResult.rows &&
                tab.queryResult.rows.length > 0 &&
                !tab.queryResult.editMode
              "
              class="result-view-switch"
            >
              <button
                :class="['btn btn-xs', resultViewOf(tab) === 'table' ? 'btn-primary' : 'btn-secondary']"
                @click="tab.resultView = 'table'"
              >
                {{ t('表格') }}
              </button>
              <button
                :class="['btn btn-xs', resultViewOf(tab) === 'chart' ? 'btn-primary' : 'btn-secondary']"
                @click="showChartView(tab)"
              >
                {{ t('图表') }}
              </button>
            </div>
            <span class="result-info">
              {{ tab.queryResult.success ? t('成功 - 耗时: {p0}ms', { p0: tab.queryResult.duration }) : t('失败') }}
            </span>
          </div>
        </div>
        <div v-if="tab.queryResult.success" class="query-result-content">
          <div
            v-if="tab.queryResult.rows && tab.queryResult.rows.length > 0 && resultViewOf(tab) === 'chart'"
            class="result-chart-wrapper"
          >
            <QueryChart :fields="tab.queryResult.fields" :rows="tab.queryResult.rows" />
          </div>
          <div v-else-if="tab.queryResult.rows && tab.queryResult.rows.length > 0" class="result-table-wrapper">
            <div class="result-table-scroll">
              <table :class="['result-table', { 'editable-table': tab.queryResult.editMode }]">
                <thead>
                  <tr>
                    <th v-if="tab.queryResult.editMode" class="row-select-col">
                      <input
                        type="checkbox"
                        :checked="isAllResultRowsSelected(tab.queryResult)"
                        :disabled="tab.queryResult.saving"
                        :title="t('全选当前页')"
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
                        :title="t('撤销删除')"
                        @click="restoreResultDeletedRow(tab.queryResult, row)"
                      >
                        <AppIcon name="refresh" />
                      </button>
                      <button
                        v-else
                        class="row-action-btn danger"
                        :title="t('删除行')"
                        @click="deleteResultRow(tab.queryResult, row)"
                      >
                        <AppIcon name="trash" />
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
                        :placeholder="resultColumnMeta(tab.queryResult, field.name)?.autoIncrement ? t('自动') : ''"
                        @change="setResultNewRowValue(tab.queryResult, index, field.name, $event.target.value)"
                      />
                    </td>
                    <td class="row-action-col">
                      <button
                        class="row-action-btn danger"
                        :title="t('移除新增行')"
                        @click="removeResultNewRow(tab.queryResult, index)"
                      >
                        <AppIcon name="close" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="result-empty">{{ tab.queryResult.rowCount }} {{ t('行受影响') }}</div>
        </div>
        <div v-else class="result-error">
          {{ tab.queryResult.error }}
        </div>
      </div>
      <div v-if="tab.queryResult.editMode && hasResultPendingChanges(tab.queryResult)" class="pending-changes-bar">
        <div class="pending-changes-info">
          <span class="pending-changes-dot" />
          <span class="pending-changes-title">{{ t('结果已修改') }}</span>
          <span class="pending-changes-counts">
            <span v-if="pendingResultCounts(tab.queryResult).updated" class="pending-change-chip">
              {{ t('更新') }} {{ pendingResultCounts(tab.queryResult).updated }} {{ t('行') }}
            </span>
            <span v-if="pendingResultCounts(tab.queryResult).deleted" class="pending-change-chip removed">
              {{ t('删除') }} {{ pendingResultCounts(tab.queryResult).deleted }} {{ t('行') }}
            </span>
            <span v-if="pendingResultCounts(tab.queryResult).inserted" class="pending-change-chip added">
              {{ t('新增') }} {{ pendingResultCounts(tab.queryResult).inserted }} {{ t('行') }}
            </span>
          </span>
        </div>
        <div class="pending-changes-actions">
          <button
            class="btn btn-sm btn-secondary"
            :disabled="tab.queryResult.saving"
            @click="previewResultChanges(tab.queryResult)"
          >
            {{ t('预览 SQL') }}
          </button>
          <button
            class="btn btn-sm btn-secondary"
            :disabled="tab.queryResult.saving"
            @click="discardResultChanges(tab.queryResult)"
          >
            {{ t('撤销') }}
          </button>
          <button
            class="btn btn-sm btn-primary"
            :disabled="tab.queryResult.saving"
            @click="saveResultChanges(tab, tab.queryResult)"
          >
            {{ tab.queryResult.saving ? t('提交中...') : t('提交修改') }}
          </button>
        </div>
      </div>
      <div class="result-footer">
        <div class="footer-left">
          <span v-if="tab.queryResult.success && tab.queryResult.rows" class="result-stats">
            {{ tab.queryResult.totalRows || tab.queryResult.rows.length }} {{ t('行') }}
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
              :title="t('首页')"
              @click="firstPage(tab)"
            >
              <AppIcon name="chevrons-left" />
            </button>
            <button
              class="pagination-btn"
              :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage <= 1"
              :title="t('上一页')"
              @click="prevPage(tab)"
            >
              <AppIcon name="chevron-left" />
            </button>
            <input
              v-model.number="tab.queryResult.jumpPage"
              type="number"
              class="pagination-input"
              min="1"
              :max="tab.queryResult.totalPages || 1"
              :title="t('输入页码回车跳转')"
              @keyup.enter="jumpToPage(tab)"
            />
            <span class="pagination-separator">/</span>
            <span class="pagination-total">{{ tab.queryResult.totalPages || 1 }}</span>
            <button
              class="pagination-btn"
              :disabled="
                !tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)
              "
              :title="t('下一页')"
              @click="nextPage(tab)"
            >
              <AppIcon name="chevron-right" />
            </button>
            <button
              class="pagination-btn"
              :disabled="
                !tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)
              "
              :title="t('末页')"
              @click="lastPage(tab)"
            >
              <AppIcon name="chevrons-right" />
            </button>
          </div>
        </div>
        <div class="footer-right">
          <div v-if="limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id" class="footer-settings-panel">
            <label class="settings-checkbox">
              <input v-model="autoLimit" type="checkbox" />
              <span>{{ t('限制记录') }}</span>
            </label>
            <div v-if="autoLimit" class="settings-limit-input">
              <input v-model.number="limitCount" type="number" class="limit-input" min="1" max="100000" />
              <span class="limit-label">{{ t('条记录（每页）') }}</span>
            </div>
          </div>
          <div
            :class="[
              'footer-settings',
              {
                active: limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id
              }
            ]"
            :title="t('设置')"
            @click="toggleLimitSettingsDialog(tab)"
          >
            <AppIcon name="settings" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <SendToMenu
    :visible="sendMenu.show"
    :x="sendMenu.x"
    :y="sendMenu.y"
    :resource="sendResource"
    @close="sendMenu.show = false"
    @sent="onSendDone"
  />

  <InlineAiDialog
    :visible="inlineAiVisible"
    :text="inlineAiText"
    context="code"
    :apply-label="t('替换选中 SQL')"
    @apply="applyInlineAi"
    @close="inlineAiVisible = false"
  />
</template>

<script setup>
import { t } from '@/i18n'
import SqlEditor from '@/components/SqlEditor.vue'
import QueryChart from '@/components/QueryChart.vue'
import SendToMenu from '@/components/SendToMenu.vue'
import InlineAiDialog from '@/components/InlineAiDialog.vue'
import { copyToClipboard } from '@/utils/clipboard'
import { inject, ref, watch } from 'vue'
import { formatCellInput, isBinaryColumn } from '../cellFormat'
import { buildRowsText } from '@shared/sendTo'

import AppIcon from '@/components/AppIcon.vue'
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
const inlineAiVisible = ref(false)
const inlineAiText = ref('')
const inlineAiEditor = ref(null)

function openInlineAiForTab(tab) {
  const selected = tab.editorRef?.getSelection?.() || ''
  if (!selected.trim()) {
    showMessage(t('请先在编辑器中选择要处理的 SQL'), 'warning')
    return
  }
  inlineAiText.value = selected
  inlineAiEditor.value = tab.editorRef
  inlineAiVisible.value = true
}

function applyInlineAi(result) {
  inlineAiEditor.value?.replaceSelection?.(result)
  showMessage(t('已替换选中 SQL'), 'success')
}

function executeEditorStatement(tab, sql) {
  if (tab.executing) return
  executeQueryForTab(tab, sql)
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const sendMenu = ref({ show: false, x: 0, y: 0 })
const sendResource = ref(null)

async function openSendMenuForResult(event, tab) {
  const result = tab.queryResult
  const text = buildRowsText(result?.fields || [], result?.rows || [])
  if (!text) {
    await showMessage(t('当前结果没有可发送的数据'), 'warning')
    return
  }
  sendResource.value = { kind: 'text', title: t('查询结果'), text }
  const rect = event.currentTarget.getBoundingClientRect()
  sendMenu.value = { show: true, x: rect.right - 252, y: rect.bottom + 6 }
}

async function onSendDone(target) {
  await showMessage(t('已发送到 {name}', { name: t(target.name) }), 'success')
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
    await showMessage(t('当前结果没有可复制的数据'), 'warning')
    return
  }
  const lines = [fields.map(escapeCsvCell).join(',')]
  for (const row of rows) {
    lines.push(fields.map((field) => escapeCsvCell(row[field])).join(','))
  }
  const copied = await copyToClipboard(lines.join('\n'))
  await showMessage(copied ? t('已复制 {p0} 行 CSV', { p0: rows.length }) : t('复制失败'), copied ? 'success' : 'error')
}

function resultViewOf(tab) {
  if (tab.queryResult?.editMode) return 'table'
  return tab.resultView === 'chart' ? 'chart' : 'table'
}

function showChartView(tab) {
  tab.resultView = 'chart'
  if ((tab.editorRatio ?? 50) > 40) tab.editorRatio = 40
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
