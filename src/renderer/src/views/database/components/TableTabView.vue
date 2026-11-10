<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <div class="query-toolbar table-query-toolbar">
    <button
      class="toolbar-btn"
      :class="{ active: tableToolbarState.filterSortActive || activeFilterCount > 0 }"
      :disabled="tab.executing"
      title="筛选和排序"
      @click="toggleFilterSort"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="22 3 2 3 10 12.46 10 19 14 17 14 12.46 22 3" />
      </svg>
      <span class="toolbar-btn-text">筛选排序</span>
      <span v-if="activeFilterCount > 0" class="toolbar-badge">{{ activeFilterCount }}</span>
    </button>
    <button class="toolbar-btn" :disabled="tab.executing" title="刷新" @click="refreshTableData(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <span class="toolbar-btn-text">刷新</span>
    </button>
    <div class="toolbar-divider" />
    <button class="toolbar-btn" :disabled="tab.executing || !canEditTable(tab)" title="新增行" @click="addRow(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span class="toolbar-btn-text">新增行</span>
    </button>
    <button
      class="toolbar-btn"
      :disabled="tab.executing || !canEditTable(tab)"
      title="删除选中行"
      @click="deleteSelectedRows(tab)"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
      <span class="toolbar-btn-text">删除</span>
    </button>
    <button
      class="toolbar-btn"
      :disabled="tab.executing || !hasPendingChanges(tab)"
      title="预览待执行的 SQL"
      @click="previewChanges(tab)"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span class="toolbar-btn-text">预览 SQL</span>
    </button>
    <button
      class="toolbar-btn primary"
      :disabled="tab.executing || !hasPendingChanges(tab)"
      title="保存修改"
      @click="saveTableChanges(tab)"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
      <span class="toolbar-btn-text">保存</span>
    </button>
    <div class="toolbar-divider" />
    <button class="toolbar-btn" :disabled="tab.executing" title="查看和修改表结构" @click="openStructureDialog(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
      <span class="toolbar-btn-text">结构</span>
    </button>
    <button class="toolbar-btn" :disabled="tab.executing" title="查看数据库 ER 图" @click="openErDialog(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="3" width="8" height="6" rx="1" />
        <rect x="14" y="15" width="8" height="6" rx="1" />
        <rect x="2" y="15" width="8" height="6" rx="1" />
        <path d="M6 9v3h12v3" />
        <path d="M6 15v-3" />
      </svg>
      <span class="toolbar-btn-text">ER 图</span>
    </button>
    <div class="toolbar-spacer" />
    <div class="table-search-group">
      <input
        v-model="tab.searchKeyword"
        type="text"
        class="table-search-input"
        placeholder="搜索表内数据，回车确认"
        @keyup.enter="searchTableData(tab)"
      />
      <button class="toolbar-icon-btn" title="搜索" @click="searchTableData(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
      <button v-if="tab.searchKeyword" class="toolbar-icon-btn" title="清除搜索" @click="clearSearch(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <button class="toolbar-btn" :disabled="tab.executing" title="导入数据" @click="importData(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span class="toolbar-btn-text">导入</span>
    </button>
    <button class="toolbar-btn" :disabled="tab.executing" title="导出数据" @click="exportData(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span class="toolbar-btn-text">导出</span>
    </button>
  </div>

  <div v-if="tableToolbarState.filterSortActive" class="table-filter-panel">
    <div v-for="(filter, index) in tab.filters" :key="index" class="table-filter-row">
      <select v-model="filter.field" class="filter-select">
        <option v-for="column in tab.columns" :key="column.name" :value="column.name">{{ column.name }}</option>
      </select>
      <select v-model="filter.operator" class="filter-select filter-operator">
        <option v-for="operator in filterOperators" :key="operator" :value="operator">{{ operator }}</option>
      </select>
      <input
        v-if="!['IS NULL', 'IS NOT NULL'].includes(filter.operator)"
        v-model="filter.value"
        type="text"
        class="filter-value"
        :placeholder="filterPlaceholder(filter.operator)"
        @keyup.enter="applyTableFilters(tab)"
      />
      <button class="toolbar-icon-btn" title="移除条件" @click="removeTableFilter(tab, index)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <div class="table-filter-actions">
      <select v-model="tab.filterLogic" class="filter-select filter-logic">
        <option value="AND">并且 (AND)</option>
        <option value="OR">或者 (OR)</option>
      </select>
      <button class="btn btn-sm btn-secondary" :disabled="!tab.columns.length" @click="addTableFilter(tab)">
        添加条件
      </button>
      <button class="btn btn-sm btn-primary" @click="applyTableFilters(tab)">应用</button>
      <button class="btn btn-sm btn-secondary" @click="resetTableFilters(tab)">重置</button>
      <span v-if="tab.sortField" class="filter-sort-info">
        排序: {{ tab.sortField }} {{ tab.sortDirection === 'DESC' ? '降序' : '升序' }}
      </span>
    </div>
  </div>

  <div class="query-body table-query-body">
    <div class="query-result-wrapper full-height">
      <div class="query-result">
        <div v-if="tab.executing" class="result-loading">
          <div class="loading-spinner" />
          <span>正在查询...</span>
        </div>
        <div v-else-if="tab.queryResult" class="query-result-content">
          <div v-if="tab.queryResult.success" class="result-body">
            <div class="result-table-wrapper">
              <div class="result-table-scroll">
                <table class="result-table editable-table">
                  <thead>
                    <tr>
                      <th class="row-select-col">
                        <input
                          type="checkbox"
                          :checked="isAllSelected(tab)"
                          :disabled="!canEditTable(tab)"
                          title="全选当前页"
                          @change="toggleAllRows(tab, $event.target.checked)"
                        />
                      </th>
                      <th class="row-index-col">#</th>
                      <th
                        v-for="fieldName in fields"
                        :key="fieldName"
                        :class="[
                          'auto-width',
                          {
                            'has-sort': tab.sortField === fieldName,
                            'sort-asc': tab.sortField === fieldName && tab.sortDirection === 'asc',
                            'sort-desc': tab.sortField === fieldName && tab.sortDirection === 'desc'
                          }
                        ]"
                        draggable="true"
                        @dragstart="onFieldDragStart($event, tab, fieldName)"
                        @dragover.prevent="onFieldDragOver($event)"
                        @drop.prevent="onFieldDrop($event, tab, fieldName)"
                      >
                        <div class="th-content">
                          <span class="th-name" :title="fieldTitle(fieldName)" @click="toggleFieldSort(tab, fieldName)">
                            {{ fieldName }}
                          </span>
                          <span v-if="columnMeta(fieldName)?.columnKey === 'PRI'" class="pk-badge">PK</span>
                          <span class="th-type">{{ columnMeta(fieldName)?.columnType }}</span>
                          <div class="th-actions" title="排序" @click.stop="showFieldSortMenu($event, tab, fieldName)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th v-if="canEditTable(tab)" class="row-action-col" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, index) in rows"
                      :key="rowKey(tab, row) || index"
                      :class="{
                        'deleted-row': isRowDeleted(tab, row),
                        'updated-row': isRowUpdated(tab, row),
                        'selected-row': isRowSelected(tab, row)
                      }"
                    >
                      <td class="row-select-col">
                        <input
                          type="checkbox"
                          :checked="isRowSelected(tab, row)"
                          :disabled="!canEditTable(tab) || isRowDeleted(tab, row)"
                          @change="toggleRowSelection(tab, row)"
                        />
                      </td>
                      <td class="row-index-col">{{ rowNumber(index) }}</td>
                      <td
                        v-for="fieldName in fields"
                        :key="fieldName"
                        :class="{ 'edited-cell': isCellEdited(tab, row, fieldName) }"
                      >
                        <template v-if="isRowDeleted(tab, row)">{{ formatCellValue(row[fieldName]) }}</template>
                        <template v-else-if="canEditTable(tab) && isEditableColumn(fieldName)">
                          <input
                            class="cell-editor"
                            :value="cellInputValue(tab, row, fieldName)"
                            @change="updateCell(tab, row, fieldName, $event.target.value)"
                          />
                        </template>
                        <template v-else>{{ formatCellValue(getCellValue(tab, row, fieldName)) }}</template>
                      </td>
                      <td v-if="canEditTable(tab)" class="row-action-col">
                        <button
                          v-if="isRowDeleted(tab, row)"
                          class="row-action-btn"
                          title="撤销删除"
                          @click="restoreDeletedRow(tab, row)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                        </button>
                        <button v-else class="row-action-btn danger" title="删除行" @click="deleteRow(tab, row)">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr v-for="(draft, index) in tab.rowInserts" :key="'insert-' + index" class="insert-row">
                      <td class="row-select-col"><span class="insert-badge">+</span></td>
                      <td class="row-index-col">新</td>
                      <td v-for="fieldName in fields" :key="fieldName">
                        <input
                          class="cell-editor"
                          :value="draft.values[fieldName]"
                          :placeholder="isAutoIncrement(fieldName) ? '自动' : ''"
                          @change="setNewRowValue(tab, index, fieldName, $event.target.value)"
                        />
                      </td>
                      <td v-if="canEditTable(tab)" class="row-action-col">
                        <button class="row-action-btn danger" title="移除新增行" @click="removeNewRow(tab, index)">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr v-if="rows.length === 0 && tab.rowInserts.length === 0" class="empty-row">
                      <td :colspan="colSpan">
                        {{ tab.searchKeyword || activeFilterCount ? '没有符合条件的数据' : '表无数据' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div v-else class="result-error">{{ tab.queryResult.error }}</div>
        </div>
        <div v-else class="result-empty">点击刷新加载表数据</div>
      </div>
      <div class="result-footer">
        <div class="footer-left">
          <span v-if="tab.queryResult && tab.queryResult.success" class="result-stats">
            共 {{ tab.queryResult.totalRows ?? rows.length }} 行
          </span>
          <span v-if="hasPendingChanges(tab)" class="pending-summary">
            待保存: 改 {{ pendingCounts.updated }} · 删 {{ pendingCounts.deleted }} · 增 {{ pendingCounts.inserted }}
          </span>
          <div
            v-if="tab.queryResult && tab.queryResult.success && tab.queryResult.totalPages && rows.length > 0"
            class="footer-pagination"
          >
            <button
              class="pagination-btn"
              :disabled="tab.queryResult.currentPage <= 1"
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
              :disabled="tab.queryResult.currentPage <= 1"
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
              :disabled="tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
              title="下一页"
              @click="nextPage(tab)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              class="pagination-btn"
              :disabled="tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
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
          <label class="page-size-group">
            <span class="page-size-label">每页</span>
            <select class="page-size-select" :value="tab.pageSize || 100" @change="onPageSizeChange($event)">
              <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const databaseStore = inject('database')
const {
  addRow,
  addTableFilter,
  applyTableFilters,
  canEditTable,
  deleteRow,
  deleteSelectedRows,
  exportData,
  firstPage,
  formatCellValue,
  getCellValue,
  getPendingCounts,
  hasPendingChanges,
  importData,
  isAllSelected,
  isRowDeleted,
  isRowSelected,
  isRowUpdated,
  jumpToPage,
  lastPage,
  nextPage,
  onFieldDragOver,
  onFieldDragStart,
  onFieldDrop,
  openErDialog,
  openStructureDialog,
  prevPage,
  previewChanges,
  refreshTableData,
  removeNewRow,
  removeTableFilter,
  resetTableFilters,
  restoreDeletedRow,
  rowKey,
  saveTableChanges,
  searchTableData,
  setNewRowValue,
  setTablePageSize,
  showFieldSortMenu,
  tableToolbarState,
  toggleAllRows,
  toggleFieldSort,
  toggleFilterSort,
  toggleRowSelection,
  updateCell
} = databaseStore

const props = defineProps({
  tab: { type: Object, required: true }
})

const filterOperators = [
  '=',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  'LIKE',
  'NOT LIKE',
  'IN',
  'NOT IN',
  'BETWEEN',
  'IS NULL',
  'IS NOT NULL'
]

const pageSizeOptions = [50, 100, 200, 500, 1000]

const fields = computed(() => {
  const order = props.tab.fieldOrder || []
  if (order.length) return order
  return (props.tab.queryResult?.fields || []).map((field) => field.name)
})

const rows = computed(() => props.tab.queryResult?.rows || [])

const pendingCounts = computed(() => getPendingCounts(props.tab))

const activeFilterCount = computed(() => (props.tab.filters || []).filter((filter) => filter.field).length)

const colSpan = computed(() => fields.value.length + 2 + (canEditTable(props.tab) ? 1 : 0))

function columnMeta(fieldName) {
  return (props.tab.columns || []).find((column) => column.name === fieldName)
}

function fieldTitle(fieldName) {
  const meta = columnMeta(fieldName)
  if (!meta) return fieldName
  return `${meta.name} ${meta.columnType || meta.dataType || ''}${meta.nullable ? '' : ' NOT NULL'}`
}

function isEditableColumn(fieldName) {
  const meta = columnMeta(fieldName)
  if (!meta) return true
  return !/GENERATED/i.test(String(meta.extra || ''))
}

function isAutoIncrement(fieldName) {
  return /auto_increment/i.test(String(columnMeta(fieldName)?.extra || ''))
}

function cellInputValue(tab, row, fieldName) {
  const value = getCellValue(tab, row, fieldName)
  return value === null || value === undefined ? '' : value
}

function isCellEdited(tab, row, fieldName) {
  const key = rowKey(tab, row)
  if (!key) return false
  const entry = tab.rowEdits?.[key]
  return Boolean(entry && Object.prototype.hasOwnProperty.call(entry.values, fieldName))
}

function rowNumber(index) {
  const page = props.tab.queryResult?.currentPage || 1
  const size = props.tab.queryResult?.pageSize || props.tab.pageSize || 100
  return (page - 1) * size + index + 1
}

function filterPlaceholder(operator) {
  if (operator === 'IN' || operator === 'NOT IN') return '多个值用英文逗号分隔'
  if (operator === 'BETWEEN') return '起止值用逗号分隔'
  if (operator === 'LIKE' || operator === 'NOT LIKE') return '使用 % 作为通配符'
  return '筛选值'
}

function onPageSizeChange(event) {
  setTablePageSize(props.tab, event.target.value)
}

function clearSearch(tab) {
  tab.searchKeyword = ''
  searchTableData(tab)
}
</script>
