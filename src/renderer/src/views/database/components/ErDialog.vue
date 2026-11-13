<template>
  <div v-if="erDialog.show" class="dialog-overlay" @click.self="closeErDialog">
    <div class="dialog dialog-er">
      <div class="dialog-header">
        <h3>ER 图 · {{ erDialog.tab?.database }}</h3>
        <div class="dialog-header-actions">
          <span v-if="layout" class="er-summary"
            >{{ layout.tables.length }} 张表 · {{ layout.edges.length }} 个外键</span
          >
          <button class="btn-icon btn-sm" title="关闭" @click="closeErDialog">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <div class="dialog-content er-content">
        <div v-if="erDialog.loading" class="structure-loading">加载中...</div>
        <div v-else-if="!layout || layout.tables.length === 0" class="er-empty">数据库中没有可展示的表</div>
        <div v-else class="er-canvas">
          <svg :width="layout.width" :height="layout.height" class="er-svg">
            <defs>
              <marker
                id="er-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <g class="er-edges">
              <path
                v-for="(edge, index) in layout.edges"
                :key="index"
                :d="edge.path"
                class="er-edge"
                marker-end="url(#er-arrow)"
              />
            </g>
            <g
              v-for="table in layout.tables"
              :key="table.name"
              class="er-table"
              :transform="`translate(${table.x}, ${table.y})`"
              @click="handleOpenTable(table.name)"
            >
              <title>{{ table.name }}{{ table.comment ? ` · ${table.comment}` : '' }}</title>
              <rect :width="tableWidth" :height="table.height" rx="6" class="er-table-box" />
              <rect :width="tableWidth" height="28" rx="6" class="er-table-header" />
              <text x="10" y="18" class="er-table-title">{{ table.name }}</text>
              <g v-for="(column, columnIndex) in table.columns" :key="column.name">
                <text
                  :x="12"
                  :y="44 + columnIndex * rowHeight"
                  :class="['er-column-name', { 'is-pk': column.columnKey === 'PRI' }]"
                >
                  {{ column.columnKey === 'PRI' ? '🔑' : '' }}{{ column.name }}
                </text>
                <text :x="tableWidth - 10" :y="44 + columnIndex * rowHeight" text-anchor="end" class="er-column-type">
                  {{ column.columnType }}
                </text>
              </g>
              <text v-if="table.columns.length === 0" x="12" y="44" class="er-column-type">（无字段）</text>
            </g>
          </svg>
        </div>
      </div>
      <div class="dialog-footer">
        <div class="dialog-footer-left">
          <span class="er-hint">点击表可打开数据页</span>
        </div>
        <button class="btn btn-primary" @click="closeErDialog">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const { closeErDialog, connections, erDialog, openTable, showMessage } = inject('database')

const tableWidth = 230
const headerHeight = 28
const rowHeight = 20
const columnStartOffset = 44
const gapX = 90
const gapY = 70
const maxColumnsPerRow = 4
const maxDisplayColumns = 10

const layout = computed(() => {
  const data = erDialog.value.data
  if (!data || !Array.isArray(data.tables) || data.tables.length === 0) return null

  const columnsPerRow = Math.max(1, Math.min(maxColumnsPerRow, Math.ceil(Math.sqrt(data.tables.length))))

  const boxes = data.tables.map((table) => {
    const shownColumns = (table.columns || []).slice(0, maxDisplayColumns)
    const height =
      headerHeight + (shownColumns.length > 0 ? columnStartOffset - headerHeight + shownColumns.length * rowHeight : 24)
    return {
      name: table.name,
      comment: table.comment,
      columns: shownColumns,
      height
    }
  })

  const rows = []
  for (let i = 0; i < boxes.length; i += columnsPerRow) {
    rows.push(boxes.slice(i, i + columnsPerRow))
  }

  let offsetY = 20
  for (const row of rows) {
    const rowMaxHeight = Math.max(...row.map((box) => box.height))
    row.forEach((box, index) => {
      box.x = 20 + index * (tableWidth + gapX)
      box.y = offsetY
    })
    offsetY += rowMaxHeight + gapY
  }

  const tablesWide = Math.min(columnsPerRow, boxes.length)
  const width = 40 + tablesWide * tableWidth + (tablesWide - 1) * gapX
  const height = offsetY - gapY + 20

  const byName = new Map(boxes.map((box) => [box.name, box]))
  const edges = []
  for (const foreignKey of data.foreignKeys || []) {
    const source = byName.get(foreignKey.tableName)
    const target = byName.get(foreignKey.refTable)
    if (!source || !target) continue

    if (source === target) {
      const x = source.x + tableWidth
      const y = source.y + headerHeight + 10
      edges.push({
        path: `M ${x} ${y} C ${x + 40} ${y - 30}, ${x + 40} ${y + 40}, ${x} ${y + 40}`
      })
      continue
    }

    const sourceCenterX = source.x + tableWidth / 2
    const targetCenterX = target.x + tableWidth / 2
    let startX
    let endX
    const startY = source.y + Math.min(source.height, headerHeight + 20) - 6
    const endY = target.y + Math.min(target.height, headerHeight + 20) - 6

    if (sourceCenterX <= targetCenterX) {
      startX = source.x + tableWidth
      endX = target.x
    } else {
      startX = source.x
      endX = target.x + tableWidth
    }

    const midDistance = Math.abs(endX - startX) / 2 + 20
    const control1X = sourceCenterX <= targetCenterX ? startX + midDistance : startX - midDistance
    const control2X = sourceCenterX <= targetCenterX ? endX - midDistance : endX + midDistance

    edges.push({
      path: `M ${startX} ${startY} C ${control1X} ${startY}, ${control2X} ${endY}, ${endX} ${endY}`
    })
  }

  return { tables: boxes, edges, width, height }
})

async function handleOpenTable(tableName) {
  const tab = erDialog.value.tab
  if (!tab) return
  closeErDialog()
  try {
    const connection = connections.value.find((item) => item.name === tab.connectionName)
    await openTable({ connection, database: tab.database, table: tableName })
  } catch (error) {
    await showMessage('打开表失败: ' + error.message, 'error')
  }
}
</script>
