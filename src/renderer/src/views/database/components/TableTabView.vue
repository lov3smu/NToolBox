<template>
  <!-- eslint-disable vue/no-mutating-props -->
  <div class="query-toolbar table-query-toolbar">
    <button
      class="toolbar-btn"
      :class="{ active: tableToolbarState.filterSortActive || activeFilterCount > 0 }"
      :disabled="tab.executing"
      :title="t('筛选和排序')"
      @click="toggleFilterSort"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="22 3 2 3 10 12.46 10 19 14 17 14 12.46 22 3" />
      </svg>
      <span class="toolbar-btn-text">{{ t('筛选排序') }}</span>
      <span v-if="activeFilterCount > 0" class="toolbar-badge">{{ activeFilterCount }}</span>
    </button>
    <button
      class="toolbar-btn"
      :class="{ active: showColumnPanel }"
      :disabled="tab.executing"
      :title="t('列显示、列宽与冻结')"
      @click="showColumnPanel = !showColumnPanel"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="9" y1="4" x2="9" y2="20" />
        <line x1="15" y1="4" x2="15" y2="20" />
      </svg>
      <span class="toolbar-btn-text">{{ t('列') }}</span>
      <span v-if="hiddenFieldCount > 0" class="toolbar-badge">{{ hiddenFieldCount }}</span>
    </button>
    <button class="toolbar-btn" :disabled="tab.executing" :title="t('刷新')" @click="refreshTableData(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      <span class="toolbar-btn-text">{{ t('刷新') }}</span>
    </button>
    <div class="toolbar-divider" />
    <button
      class="toolbar-btn"
      :disabled="tab.executing || !canEditTable(tab)"
      :title="canEditTable(tab) ? t('新增行') : t('视图或没有主键的表不支持直接编辑')"
      @click="addRow(tab)"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
      <span class="toolbar-btn-text">{{ t('新增行') }}</span>
    </button>
    <button
      class="toolbar-btn"
      :disabled="tab.executing || !canEditTable(tab)"
      :title="canEditTable(tab) ? t('删除选中行') : t('视图或没有主键的表不支持直接编辑')"
      @click="deleteSelectedRows(tab)"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
      <span class="toolbar-btn-text">{{ t('删除') }}</span>
    </button>
    <button
      class="toolbar-btn"
      :disabled="tab.executing"
      :title="t('复制选中行为 INSERT 语句')"
      @click="copyRowsAsInsert(tab)"
    >
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span class="toolbar-btn-text">{{ t('复制 SQL') }}</span>
    </button>
    <div class="toolbar-divider" />
    <div class="table-toolbar-menu">
      <button
        class="toolbar-btn"
        :class="{ active: structureMenuOpen }"
        :disabled="tab.executing"
        :title="t('查看结构、设计表、ER 图')"
        @click.stop="structureMenuOpen = !structureMenuOpen"
      >
        <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <span class="toolbar-btn-text">{{ t('结构') }}</span>
        <svg class="toolbar-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div v-if="structureMenuOpen" v-clamp-viewport class="toolbar-dropdown" @click.stop>
        <button class="toolbar-dropdown-item" @click="runStructureAction(openStructureDialog, tab)">
          {{ t('查看表结构') }}
        </button>
        <button class="toolbar-dropdown-item" @click="runStructureAction(openTableDesigner, tab)">
          {{ t('可视化设计表') }}
        </button>
        <button class="toolbar-dropdown-item" @click="runStructureAction(openErDialog, tab)">
          {{ t('数据库 ER 图') }}
        </button>
      </div>
    </div>
    <div class="toolbar-spacer" />
    <div class="table-search-group">
      <input
        v-model="tab.searchKeyword"
        type="text"
        class="table-search-input"
        :placeholder="t('搜索表内数据，回车确认')"
        @keyup.enter="searchTableData(tab)"
      />
      <button class="toolbar-icon-btn" :title="t('搜索')" @click="searchTableData(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
      <button v-if="tab.searchKeyword" class="toolbar-icon-btn" :title="t('清除搜索')" @click="clearSearch(tab)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
    <button class="toolbar-btn" :disabled="tab.executing" :title="t('导入数据')" @click="importData(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span class="toolbar-btn-text">{{ t('导入') }}</span>
    </button>
    <button class="toolbar-btn" :disabled="tab.executing" :title="t('导出数据')" @click="exportData(tab)">
      <svg class="toolbar-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span class="toolbar-btn-text">{{ t('导出') }}</span>
    </button>
  </div>

  <div v-if="tableToolbarState.filterSortActive" class="table-filter-panel">
    <div class="filter-panel-section">
      <div class="filter-section-head">
        <span class="filter-section-title">{{ t('筛选条件') }}</span>
        <span v-if="!tab.filters.length" class="filter-section-hint">{{
          t('暂无筛选条件，可按字段过滤当前表数据')
        }}</span>
        <span v-else-if="tab.filters.length > 1" class="filter-section-hint">
          {{ t('每行可选 且 / 或，条件按从上到下顺序组合') }}
        </span>
        <button
          class="btn btn-sm btn-secondary filter-add-btn"
          :disabled="!tab.columns.length"
          @click="addTableFilter(tab)"
        >
          {{ t('添加条件') }}
        </button>
      </div>
      <div v-for="(filter, index) in tab.filters" :key="index" class="table-filter-row">
        <span v-if="index === 0" class="filter-prefix">{{ t('当') }}</span>
        <select
          v-else
          v-model="filter.connector"
          class="filter-select filter-connector"
          :title="t('与上一条件的组合方式')"
        >
          <option value="AND">{{ t('且') }}</option>
          <option value="OR">{{ t('或') }}</option>
        </select>
        <select v-model="filter.field" class="filter-select filter-field" @change="onFilterFieldChange(tab, filter)">
          <option v-for="column in tab.columns" :key="column.name" :value="column.name">{{ column.name }}</option>
        </select>
        <select v-model="filter.operator" class="filter-select filter-operator">
          <option v-for="operator in operatorsFor(filter.field)" :key="operator" :value="operator">
            {{ operatorLabel(operator) }}
          </option>
        </select>
        <input
          v-if="!['IS NULL', 'IS NOT NULL'].includes(filter.operator)"
          v-model="filter.value"
          type="text"
          class="filter-value"
          :placeholder="filterPlaceholder(filter.operator)"
          @keyup.enter="applyTableFilters(tab)"
        />
        <button
          class="toolbar-icon-btn filter-remove-btn"
          :title="t('移除条件')"
          @click="removeTableFilter(tab, index)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="table-filter-actions">
        <button class="btn btn-sm btn-primary" :disabled="tab.executing" @click="applyTableFilters(tab)">
          {{ t('应用筛选') }}
        </button>
        <button class="btn btn-sm btn-secondary" :disabled="tab.executing" @click="resetTableFilters(tab)">
          {{ t('重置全部') }}
        </button>
        <span class="filter-action-hint">{{ t('输入后按回车可直接应用') }}</span>
      </div>
    </div>

    <div class="filter-panel-section filter-sort-section">
      <div class="filter-section-head">
        <span class="filter-section-title">{{ t('排序') }}</span>
        <span class="filter-section-hint">{{ t('点击表头切换排序，Shift + 点击可追加多列排序') }}</span>
        <button
          class="btn btn-sm btn-secondary filter-add-btn"
          :disabled="!nextSortField(tab)"
          :title="nextSortField(tab) ? t('添加下一列排序') : t('所有字段均已参与排序')"
          @click="addTableSort(tab, nextSortField(tab))"
        >
          {{ t('添加排序') }}
        </button>
      </div>
      <div v-if="!tab.sorts?.length" class="filter-section-hint">{{ t('暂无排序，可点击表头或添加排序') }}</div>
      <div v-for="(sortItem, index) in tab.sorts || []" :key="sortItem.field" class="table-sort-row">
        <span class="sort-order-index">{{ index + 1 }}</span>
        <select
          class="filter-select filter-sort-field"
          :value="sortItem.field"
          @change="changeTableSortField(tab, index, $event.target.value)"
        >
          <option v-for="fieldName in allFields" :key="fieldName" :value="fieldName">{{ fieldName }}</option>
        </select>
        <div class="sort-direction-group">
          <button
            :class="{ active: sortItem.order === 'ASC' }"
            @click="changeTableSortOrder(tab, sortItem.field, 'ASC')"
          >
            {{ t('升序') }}
          </button>
          <button
            :class="{ active: sortItem.order === 'DESC' }"
            @click="changeTableSortOrder(tab, sortItem.field, 'DESC')"
          >
            {{ t('降序') }}
          </button>
        </div>
        <button class="toolbar-icon-btn" :title="t('移除该排序')" @click="removeTableSort(tab, sortItem.field)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </div>

  <div v-if="showColumnPanel" class="table-column-panel">
    <div class="filter-section-head">
      <span class="filter-section-title">{{ t('列显示') }}</span>
      <span class="filter-section-hint">{{ fields.length }} / {{ allFields.length }} {{ t('列可见') }}</span>
      <button class="btn btn-sm btn-secondary" :disabled="!hiddenFieldCount" @click="showAllColumns(tab)">
        {{ t('全部显示') }}
      </button>
      <button class="btn btn-sm btn-secondary" @click="resetColumnWidths(tab)">{{ t('重置列宽') }}</button>
    </div>
    <div class="column-toggle-list">
      <label v-for="fieldName in allFields" :key="fieldName" class="column-toggle-item">
        <input
          type="checkbox"
          :checked="!isFieldHidden(tab, fieldName)"
          :disabled="fields.length === 1 && !isFieldHidden(tab, fieldName)"
          @change="toggleColumnVisibility(tab, fieldName)"
        />
        <span class="column-toggle-name" :title="fieldName">{{ fieldName }}</span>
        <span class="column-toggle-type">{{ columnMeta(fieldName)?.columnType }}</span>
      </label>
    </div>
    <div class="column-panel-footer">
      <label class="column-freeze-group">
        <span>{{ t('冻结列') }}</span>
        <select :value="tab.frozenCount || 0" @change="setFrozenColumnCount(tab, $event.target.value)">
          <option v-for="count in freezeOptions" :key="count" :value="count">
            {{ count === 0 ? t('不冻结') : t('前 {p0} 列', { p0: count }) }}
          </option>
        </select>
      </label>
      <span class="filter-section-hint">{{ t('拖动表头右侧边缘可调整列宽，按表记忆；右键单元格可按值快速筛选') }}</span>
    </div>
  </div>

  <div class="query-body table-query-body">
    <div class="query-result-wrapper full-height">
      <div class="query-result">
        <div v-if="tab.executing" class="result-loading">
          <div class="loading-spinner" />
          <span>{{ t('正在查询...') }}</span>
        </div>
        <div v-else-if="tab.queryResult" class="query-result-content">
          <div v-if="tab.queryResult.success" class="result-body">
            <div class="result-table-wrapper">
              <div class="result-table-scroll">
                <table class="result-table editable-table" :class="{ 'has-frozen-columns': tab.frozenCount > 0 }">
                  <colgroup>
                    <col style="width: 36px" />
                    <col style="width: 56px" />
                    <col v-for="fieldName in fields" :key="fieldName" :style="columnWidthStyle(tab, fieldName)" />
                    <col v-if="canEditTable(tab)" style="width: 112px" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th class="row-select-col" :class="{ 'is-frozen': tab.frozenCount > 0 }">
                        <input
                          type="checkbox"
                          :checked="isAllSelected(tab)"
                          :disabled="!canEditTable(tab)"
                          :title="t('全选当前页')"
                          @change="toggleAllRows(tab, $event.target.checked)"
                        />
                      </th>
                      <th class="row-index-col" :class="{ 'is-frozen': tab.frozenCount > 0 }">#</th>
                      <th
                        v-for="fieldName in fields"
                        :key="fieldName"
                        :class="[
                          'auto-width',
                          {
                            'has-sort': sortIndex(tab, fieldName) >= 0,
                            'sort-asc': sortIndex(tab, fieldName) >= 0 && sortOrder(tab, fieldName) === 'ASC',
                            'sort-desc': sortIndex(tab, fieldName) >= 0 && sortOrder(tab, fieldName) === 'DESC',
                            'is-frozen': isFrozenField(tab, fieldName)
                          }
                        ]"
                        :style="frozenStyle(tab, fieldName)"
                        draggable="true"
                        @dragstart="onFieldDragStart($event, tab, fieldName)"
                        @dragover.prevent="onFieldDragOver($event)"
                        @drop.prevent="onFieldDrop($event, tab, fieldName)"
                      >
                        <div class="th-content">
                          <span
                            v-if="sortIndex(tab, fieldName) >= 0"
                            class="sort-rank-badge"
                            :title="t('排序优先级 {p0}', { p0: sortIndex(tab, fieldName) + 1 })"
                          >
                            {{ sortIndex(tab, fieldName) + 1 }}
                          </span>
                          <span
                            class="th-name"
                            :title="fieldTitle(fieldName)"
                            @click="toggleFieldSort(tab, fieldName, $event)"
                          >
                            {{ fieldName }}
                          </span>
                          <span v-if="columnMeta(fieldName)?.columnKey === 'PRI'" class="pk-badge">PK</span>
                          <span class="th-type">{{ columnMeta(fieldName)?.columnType }}</span>
                          <div
                            class="th-actions"
                            :title="t('排序')"
                            @click.stop="showFieldSortMenu($event, tab, fieldName)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <circle cx="12" cy="12" r="1" />
                              <circle cx="12" cy="5" r="1" />
                              <circle cx="12" cy="19" r="1" />
                            </svg>
                          </div>
                        </div>
                        <span
                          class="col-resizer"
                          :title="t('拖动调整列宽')"
                          @mousedown.stop.prevent="startColumnResize($event, tab, fieldName)"
                          @click.stop
                        />
                      </th>
                      <th v-if="canEditTable(tab)" class="row-action-col" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="rowView in displayRows"
                      :key="rowView.renderKey"
                      v-memo="[rowView, isEditingRow(rowView)]"
                      :class="{
                        'deleted-row': rowView.deleted,
                        'updated-row': rowView.updated,
                        'selected-row': rowView.selected
                      }"
                    >
                      <td class="row-select-col" :class="{ 'is-frozen': tab.frozenCount > 0 }">
                        <input
                          type="checkbox"
                          :checked="rowView.selected"
                          :disabled="!canEditTable(tab) || rowView.deleted"
                          @change="toggleRowSelection(tab, rowView.row)"
                        />
                      </td>
                      <td class="row-index-col" :class="{ 'is-frozen': tab.frozenCount > 0 }">
                        {{ rowNumber(rowView.index) }}
                      </td>
                      <td
                        v-for="cell in rowView.cells"
                        :key="cell.field"
                        :class="{
                          'edited-cell': cell.edited,
                          'is-frozen': cell.frozen
                        }"
                        :style="cell.frozenStyle"
                        @dblclick="showCellViewer(tab, rowView.row, cell.field)"
                        @contextmenu.prevent="
                          openCellFilterMenu($event, tab, cell.field, getCellValue(tab, rowView.row, cell.field))
                        "
                      >
                        <template v-if="rowView.deleted">{{ cell.text }}</template>
                        <template v-else-if="cell.editable">
                          <input
                            v-if="isEditingCell(tab, rowView.row, cell.field)"
                            :ref="setCellEditorRef"
                            class="cell-editor"
                            :value="cellInputValue(tab, rowView.row, cell.field)"
                            @change="updateCell(tab, rowView.row, cell.field, $event.target.value)"
                            @blur="endCellEdit"
                            @keydown.enter.prevent="$event.currentTarget.blur()"
                            @keydown.esc.prevent="cancelCellEdit"
                          />
                          <span
                            v-else
                            class="cell-text"
                            :class="cell.class"
                            @click="beginCellEdit(tab, rowView.row, cell.field)"
                          >
                            {{ cell.text }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="cell-text" :class="cell.class">{{ cell.text }}</span>
                        </template>
                      </td>
                      <td v-if="canEditTable(tab)" class="row-action-col">
                        <button
                          v-if="rowView.deleted"
                          class="row-action-btn"
                          :title="t('撤销删除')"
                          @click="restoreDeletedRow(tab, rowView.row)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                        </button>
                        <template v-else>
                          <button
                            class="row-action-btn"
                            :title="t('复制为新行')"
                            @click="duplicateRow(tab, rowView.row)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          </button>
                          <button
                            class="row-action-btn"
                            :title="t('复制为 INSERT 语句')"
                            @click="copyRowAsInsert(tab, rowView.row)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="16 18 22 12 16 6" />
                              <polyline points="8 6 2 12 8 18" />
                            </svg>
                          </button>
                          <button
                            class="row-action-btn danger"
                            :title="t('删除行')"
                            @click="deleteRow(tab, rowView.row)"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path
                                d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                              />
                            </svg>
                          </button>
                        </template>
                      </td>
                    </tr>
                    <tr v-for="(draft, index) in tab.rowInserts" :key="'insert-' + index" class="insert-row">
                      <td class="row-select-col" :class="{ 'is-frozen': tab.frozenCount > 0 }">
                        <span class="insert-badge">+</span>
                      </td>
                      <td class="row-index-col" :class="{ 'is-frozen': tab.frozenCount > 0 }">{{ t('新') }}</td>
                      <td
                        v-for="fieldName in fields"
                        :key="fieldName"
                        :class="{ 'is-frozen': isFrozenField(tab, fieldName) }"
                        :style="frozenStyle(tab, fieldName)"
                      >
                        <input
                          class="cell-editor"
                          :value="formatCellInput(draft.values[fieldName])"
                          :placeholder="isAutoIncrement(fieldName) ? t('自动') : ''"
                          @change="setNewRowValue(tab, index, fieldName, $event.target.value)"
                        />
                      </td>
                      <td v-if="canEditTable(tab)" class="row-action-col">
                        <button
                          class="row-action-btn danger"
                          :title="t('移除新增行')"
                          @click="removeNewRow(tab, index)"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr v-if="rows.length === 0 && tab.rowInserts.length === 0" class="empty-row">
                      <td :colspan="colSpan">
                        {{ tab.searchKeyword || activeFilterCount ? t('没有符合条件的数据') : t('表无数据') }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <div v-else class="result-error">{{ tab.queryResult.error }}</div>
        </div>
        <div v-else class="result-empty">{{ t('点击刷新加载表数据') }}</div>
      </div>
      <div v-if="hasPendingChanges(tab)" class="pending-changes-bar">
        <div class="pending-changes-info">
          <span class="pending-changes-dot" />
          <span class="pending-changes-title">{{ t('数据已修改') }}</span>
          <span class="pending-changes-counts">
            <span v-if="pendingCounts.updated" class="pending-change-chip"
              >{{ t('更新') }} {{ pendingCounts.updated }} {{ t('行') }}</span
            >
            <span v-if="pendingCounts.deleted" class="pending-change-chip removed">
              {{ t('删除') }} {{ pendingCounts.deleted }} {{ t('行') }}
            </span>
            <span v-if="pendingCounts.inserted" class="pending-change-chip added">
              {{ t('新增') }} {{ pendingCounts.inserted }} {{ t('行') }}
            </span>
          </span>
        </div>
        <div class="pending-changes-actions">
          <button class="btn btn-sm btn-secondary" :disabled="tab.executing" @click="previewChanges(tab)">
            {{ t('预览 SQL') }}
          </button>
          <button class="btn btn-sm btn-secondary" :disabled="tab.executing" @click="discardTableChanges(tab)">
            {{ t('撤销') }}
          </button>
          <button class="btn btn-sm btn-primary" :disabled="tab.executing" @click="saveTableChanges(tab)">
            {{ tab.executing ? t('提交中...') : t('提交修改') }}
          </button>
        </div>
      </div>
      <div class="result-footer">
        <div class="footer-left">
          <span v-if="tab.queryResult && tab.queryResult.success" class="result-stats">
            {{ tab.queryResult.countApproximate ? t('约') : t('共') }}
            {{ tab.queryResult.totalRows ?? rows.length }} {{ t('行') }}
          </span>
          <span
            v-if="tab.queryResult && tab.queryResult.success && !canEditTable(tab)"
            class="readonly-badge"
            :title="t('视图或没有主键的表不支持直接编辑')"
          >
            {{ t('只读') }}
          </span>
          <div
            v-if="tab.queryResult && tab.queryResult.success && tab.queryResult.totalPages && rows.length > 0"
            class="footer-pagination"
          >
            <button
              class="pagination-btn"
              :disabled="tab.queryResult.currentPage <= 1"
              :title="t('首页')"
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
              :title="t('上一页')"
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
              :title="t('输入页码回车跳转')"
              @keyup.enter="jumpToPage(tab)"
            />
            <span class="pagination-separator">/</span>
            <span class="pagination-total">{{ tab.queryResult.totalPages || 1 }}</span>
            <button
              class="pagination-btn"
              :disabled="tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
              :title="t('下一页')"
              @click="nextPage(tab)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button
              class="pagination-btn"
              :disabled="tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
              :title="t('末页')"
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
            <span class="page-size-label">{{ t('每页') }}</span>
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
import { t } from '@/i18n'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatBytes, formatCellInput, isBinaryColumn, isBinaryValue } from '../cellFormat'

const databaseStore = inject('database')
const {
  addRow,
  addTableFilter,
  addTableSort,
  applyTableFilters,
  canEditTable,
  changeTableSortField,
  changeTableSortOrder,
  copyRowAsInsert,
  copyRowsAsInsert,
  defaultFilterOperator,
  deleteRow,
  deleteSelectedRows,
  discardTableChanges,
  duplicateRow,
  exportData,
  firstPage,
  formatCellValue,
  getCellValue,
  fetchTableCellValue,
  getPendingCounts,
  hasPendingChanges,
  importData,
  isAllSelected,
  isComparisonColumn,
  isLazyCell,
  isRowDeleted,
  jumpToPage,
  lastPage,
  nextPage,
  onFieldDragOver,
  onFieldDragStart,
  onFieldDrop,
  openCellFilterMenu,
  openCellViewer,
  openErDialog,
  openStructureDialog,
  openTableDesigner,
  prevPage,
  previewChanges,
  refreshTableData,
  removeNewRow,
  removeTableSort,
  removeTableFilter,
  resetColumnWidths,
  resetTableFilters,
  restoreDeletedRow,
  setColumnWidth,
  setFrozenColumnCount,
  rowKey,
  saveTableChanges,
  searchTableData,
  setNewRowValue,
  setTablePageSize,
  showAllColumns,
  showFieldSortMenu,
  tableToolbarState,
  toggleAllRows,
  toggleFieldSort,
  toggleColumnVisibility,
  toggleFilterSort,
  toggleRowSelection,
  updateCell
} = databaseStore

const props = defineProps({
  tab: { type: Object, required: true }
})

const TEXT_OPERATORS = ['=', '!=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'BETWEEN', 'IS NULL', 'IS NOT NULL']
const COMPARISON_OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'IN', 'NOT IN', 'BETWEEN', 'IS NULL', 'IS NOT NULL']

const OPERATOR_LABELS = {
  '=': t('等于 (=)'),
  '!=': t('不等于 (!=)'),
  '>': t('大于 (>)'),
  '>=': t('大于等于 (>=)'),
  '<': t('小于 (<)'),
  '<=': t('小于等于 (<=)'),
  LIKE: t('包含 (LIKE)'),
  'NOT LIKE': t('不包含 (NOT LIKE)'),
  IN: t('在列表中 (IN)'),
  'NOT IN': t('不在列表中 (NOT IN)'),
  BETWEEN: t('介于 (BETWEEN)'),
  'IS NULL': t('为空'),
  'IS NOT NULL': t('不为空')
}

const pageSizeOptions = [50, 100, 200, 500]

const showColumnPanel = ref(false)
const structureMenuOpen = ref(false)
const editingCell = ref(null)
const cellEditorEl = ref(null)
const freezeOptions = [0, 1, 2, 3, 4, 5]
const DEFAULT_COLUMN_WIDTH = 150

function closeStructureMenu() {
  structureMenuOpen.value = false
}

onMounted(() => document.addEventListener('click', closeStructureMenu))
onBeforeUnmount(() => document.removeEventListener('click', closeStructureMenu))

function runStructureAction(action, tab) {
  structureMenuOpen.value = false
  action(tab)
}

const allFields = computed(() => {
  const order = props.tab.fieldOrder || []
  if (order.length) return order
  return (props.tab.queryResult?.fields || []).map((field) => field.name)
})

const fields = computed(() => {
  const hidden = props.tab.hiddenFields || []
  return allFields.value.filter((name) => !hidden.includes(name))
})

const hiddenFieldCount = computed(() => (props.tab.hiddenFields || []).length)

function isFieldHidden(tab, fieldName) {
  return (tab.hiddenFields || []).includes(fieldName)
}

function sortIndex(tab, fieldName) {
  return (tab.sorts || []).findIndex((item) => item.field === fieldName)
}

function sortOrder(tab, fieldName) {
  return (tab.sorts || []).find((item) => item.field === fieldName)?.order || ''
}

function nextSortField(tab) {
  return allFields.value.find((name) => !(tab.sorts || []).some((item) => item.field === name)) || ''
}

function columnWidth(tab, fieldName) {
  const width = Number(tab.fieldWidths?.[fieldName])
  return width > 0 ? width : DEFAULT_COLUMN_WIDTH
}

function isFrozenField(tab, fieldName) {
  if (!(tab.frozenCount > 0)) return false
  const index = fields.value.indexOf(fieldName)
  return index >= 0 && index < tab.frozenCount
}

function columnWidthStyle(tab, fieldName) {
  if (!isFrozenField(tab, fieldName) && !tab.fieldWidths?.[fieldName]) return undefined
  return { width: `${columnWidth(tab, fieldName)}px` }
}

function frozenStyle(tab, fieldName) {
  if (!isFrozenField(tab, fieldName)) return undefined
  let left = 36 + 56
  const index = fields.value.indexOf(fieldName)
  for (let i = 0; i < index; i++) {
    left += columnWidth(tab, fields.value[i])
  }
  return { left: `${left}px` }
}

function startColumnResize(event, tab, fieldName) {
  const th = event.currentTarget.closest('th')
  const startX = event.clientX
  const startWidth = th?.offsetWidth || columnWidth(tab, fieldName)
  const onMove = (moveEvent) => {
    const width = Math.min(720, Math.max(60, Math.round(startWidth + moveEvent.clientX - startX)))
    tab.fieldWidths = { ...(tab.fieldWidths || {}), [fieldName]: width }
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    setColumnWidth(tab, fieldName, tab.fieldWidths?.[fieldName] || startWidth)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

const rows = computed(() => props.tab.queryResult?.rows || [])

const columnMap = computed(() => new Map((props.tab.columns || []).map((column) => [column.name, column])))

function columnMeta(fieldName) {
  return columnMap.value.get(fieldName)
}

const pendingCounts = computed(() => getPendingCounts(props.tab))

const activeFilterCount = computed(() => (props.tab.filters || []).filter((filter) => filter.field).length)

const colSpan = computed(() => fields.value.length + 2 + (canEditTable(props.tab) ? 1 : 0))

const displayRows = computed(() => {
  const tab = props.tab
  const editable = canEditTable(tab)
  const fieldList = fields.value
  const rowDeletes = tab.rowDeletes || {}
  const rowEdits = tab.rowEdits || {}
  const selectedRows = tab.selectedRows || {}
  return rows.value.map((row, index) => {
    const key = rowKey(tab, row)
    const deleted = Boolean(key && rowDeletes[key])
    const editValues = key && rowEdits[key] ? rowEdits[key].values : null
    const cells = fieldList.map((fieldName) => {
      const lazy = isLazyCell(tab, fieldName)
      const edited = Boolean(editValues && Object.prototype.hasOwnProperty.call(editValues, fieldName))
      let value = row[fieldName]
      if (!deleted && edited) {
        value = editValues[fieldName]
      }
      const isNullValue = value === null || value === undefined
      return {
        field: fieldName,
        editable: editable && isEditableColumn(fieldName),
        edited: !deleted && edited,
        frozen: isFrozenField(tab, fieldName),
        frozenStyle: frozenStyle(tab, fieldName),
        text: lazy ? (isNullValue ? 'NULL' : t('[二进制 {p0}]', { p0: formatBytes(value) })) : formatCellValue(value),
        class: {
          'is-null': isNullValue,
          'is-binary': lazy ? !isNullValue : isBinaryValue(value),
          'is-json': !lazy && isStructuredValue(value)
        }
      }
    })
    return {
      row,
      index,
      key,
      renderKey: key || `row-${index}`,
      deleted,
      updated: Boolean(key && rowEdits[key]),
      selected: Boolean(key && selectedRows[key]),
      cells
    }
  })
})

function isEditingRow(rowView) {
  const current = editingCell.value
  return Boolean(current && current.tabId === props.tab.id && current.key === rowView.key)
}

function fieldTitle(fieldName) {
  const meta = columnMeta(fieldName)
  if (!meta) return fieldName
  return `${meta.name} ${meta.columnType || meta.dataType || ''}${meta.nullable ? '' : ' NOT NULL'}`
}

function isEditableColumn(fieldName) {
  const meta = columnMeta(fieldName)
  if (!meta) return true
  if (/GENERATED/i.test(String(meta.extra || ''))) return false
  return !isBinaryColumn(meta.dataType || meta.columnType)
}

function isAutoIncrement(fieldName) {
  return /auto_increment/i.test(String(columnMeta(fieldName)?.extra || ''))
}

function isStructuredValue(value) {
  return value !== null && typeof value === 'object' && !(value instanceof Date) && !isBinaryValue(value)
}

function cellInputValue(tab, row, fieldName) {
  return formatCellInput(getCellValue(tab, row, fieldName))
}

function isEditingCell(tab, row, fieldName) {
  const current = editingCell.value
  if (!current || current.tabId !== tab.id || current.field !== fieldName) return false
  return current.key === rowKey(tab, row)
}

function setCellEditorRef(el) {
  cellEditorEl.value = el
}

async function beginCellEdit(tab, row, fieldName) {
  if (!canEditTable(tab) || !isEditableColumn(fieldName) || isRowDeleted(tab, row)) return
  const key = rowKey(tab, row)
  if (!key) return
  editingCell.value = { tabId: tab.id, key, field: fieldName }
  await nextTick()
  cellEditorEl.value?.focus()
}

function endCellEdit() {
  editingCell.value = null
}

function cancelCellEdit() {
  editingCell.value = null
}

function showCellViewer(tab, row, fieldName) {
  if (canEditTable(tab) && isEditableColumn(fieldName) && !isRowDeleted(tab, row)) return
  const meta = columnMeta(fieldName)
  const columnType = meta?.columnType || meta?.dataType || ''
  if (isLazyCell(tab, fieldName)) {
    const length = Number(getCellValue(tab, row, fieldName))
    openCellViewer(fieldName, columnType, null, {
      byteLength: Number.isFinite(length) ? length : 0,
      load: () => fetchTableCellValue(tab, row, fieldName)
    })
    return
  }
  openCellViewer(fieldName, columnType, getCellValue(tab, row, fieldName))
}

function rowNumber(index) {
  const page = props.tab.queryResult?.currentPage || 1
  const size = props.tab.queryResult?.pageSize || props.tab.pageSize || 100
  return (page - 1) * size + index + 1
}

function filterPlaceholder(operator) {
  if (operator === 'IN' || operator === 'NOT IN') return t('多个值用英文逗号分隔')
  if (operator === 'BETWEEN') return t('起止值用逗号分隔')
  if (operator === 'LIKE' || operator === 'NOT LIKE') return t('使用 % 作为通配符')
  return t('筛选值')
}

function operatorsFor(fieldName) {
  return isComparisonColumn(columnMeta(fieldName)) ? COMPARISON_OPERATORS : TEXT_OPERATORS
}

function operatorLabel(operator) {
  return OPERATOR_LABELS[operator] || operator
}

function onFilterFieldChange(tab, filter) {
  const allowed = operatorsFor(filter.field)
  if (!allowed.includes(filter.operator)) {
    filter.operator = defaultFilterOperator(columnMeta(filter.field))
  }
}

function onPageSizeChange(event) {
  setTablePageSize(props.tab, event.target.value)
}

function clearSearch(tab) {
  tab.searchKeyword = ''
  searchTableData(tab)
}
</script>
