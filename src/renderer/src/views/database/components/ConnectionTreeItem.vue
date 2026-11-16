<template>
  <div v-if="!filtering || visibleDatabases.length" class="connection-container">
    <div
      :class="[
        'connection-item',
        {
          active: selectedConnection?.name === conn.name,
          dragging: draggingConnection === conn.name
        }
      ]"
      draggable="true"
      @dragstart="onDragStartConnection(conn)"
      @dragend="onDragEndConnection"
      @click="selectConnection(conn)"
      @dblclick="handleConnectionDoubleClick(conn)"
      @contextmenu.prevent.stop="showContextMenu($event, 'connection', conn)"
    >
      <span class="connection-expand-placeholder">
        <svg
          class="connection-expand-icon"
          :class="{ expanded: expandedConnections.includes(conn.name) }"
          :style="{
            visibility: conn.active ? 'visible' : 'hidden'
          }"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          @click.stop="toggleConnectionDatabases(conn.name)"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
      <svg class="connection-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="6" x2="6.01" y2="6" />
        <line x1="6" y1="18" x2="6.01" y2="18" />
      </svg>
      <span class="connection-name">{{ conn.name }}</span>
      <span v-if="conn.readOnly" class="connection-readonly-badge" title="只读连接">只读</span>
      <span :class="['connection-status-dot', { active: conn.active }]" :title="conn.active ? '已连接' : '未连接'" />
    </div>
    <div v-if="conn.active && (expandedConnections.includes(conn.name) || filtering)" class="connection-databases">
      <div v-for="db in visibleDatabases" :key="db" class="database-wrapper">
        <div
          :class="[
            'database-item',
            {
              active:
                selectedConnection?.name === conn.name &&
                selectedDatabase === db &&
                selectedObject?.type === 'database' &&
                selectedObject?.name === db
            }
          ]"
          @click.stop="handleSelectConnectionDatabase(conn, db)"
          @dblclick="openDatabaseFromSidebar(conn, db)"
          @contextmenu.prevent.stop="showContextMenu($event, 'database', { connection: conn, database: db })"
        >
          <span class="db-expand-placeholder">
            <svg
              v-if="openedDatabases.includes(`${conn.name}_${db}`)"
              class="db-expand-icon"
              :class="{ expanded: filtering || expandedDatabases.includes(`${conn.name}_${db}`) }"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              @click.stop="toggleDatabaseObjects(conn.name, db)"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </span>
          <svg
            :class="['db-icon', openedDatabases.includes(`${conn.name}_${db}`) ? 'opened' : '']"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <span class="db-name">{{ db }}</span>
          <span v-if="openedDatabases.includes(`${conn.name}_${db}`)" class="db-status-dot" title="已打开" />
        </div>
        <div v-if="filtering || expandedDatabases.includes(`${conn.name}_${db}`)" class="database-objects">
          <div v-if="!filtering || tablesFor(db).length" class="object-category">
            <div
              class="category-header"
              @click.stop="selectCategory(conn, db, 'tables')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'tables'
                })
              "
            >
              <svg
                class="category-icon"
                :class="{
                  expanded: filtering || expandedObjectCategories.includes(`${conn.name}_${db}_tables`)
                }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                @click.stop="toggleObjectCategory(conn.name, db, 'tables')"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg class="category-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="9" y1="21" x2="9" y2="9" />
              </svg>
              <span class="category-name">表</span>
              <span class="category-count">{{ categoryCount(db, 'tables') }}</span>
            </div>
            <div
              v-show="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_tables`)"
              class="category-items"
            >
              <div v-if="isCategoryLoading(db, 'tables')" class="category-loading">加载中…</div>
              <div
                v-for="table in displayItems(db, 'tables')"
                :key="table"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'table' && selectedObject?.name === table
                  }
                ]"
                @click="handleSelectConnectionDatabaseTable(conn, db, table)"
                @dblclick.stop="openTable({ connection: conn, database: db, table })"
                @contextmenu.prevent.stop="
                  showContextMenu($event, 'table', {
                    connection: conn,
                    database: db,
                    table
                  })
                "
              >
                <svg
                  class="object-icon table-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
                <span class="object-name">{{ table }}</span>
              </div>
              <div v-if="remainingFor(db, 'tables')" class="object-more" @click.stop="loadMore(db, 'tables')">
                还有 {{ remainingFor(db, 'tables') }} 项，点击加载
              </div>
            </div>
          </div>
          <div v-if="!filtering || viewsFor(db).length" class="object-category">
            <div
              class="category-header"
              @click.stop="selectCategory(conn, db, 'views')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'views'
                })
              "
            >
              <svg
                class="category-icon"
                :class="{
                  expanded: filtering || expandedObjectCategories.includes(`${conn.name}_${db}_views`)
                }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                @click.stop="toggleObjectCategory(conn.name, db, 'views')"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg class="category-type-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span class="category-name">视图</span>
              <span class="category-count">{{ categoryCount(db, 'views') }}</span>
            </div>
            <div
              v-show="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_views`)"
              class="category-items"
            >
              <div v-if="isCategoryLoading(db, 'views')" class="category-loading">加载中…</div>
              <div
                v-for="view in displayItems(db, 'views')"
                :key="view"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'view' && selectedObject?.name === view
                  }
                ]"
                @click="handleSelectConnectionDatabaseView(conn, db, view)"
                @dblclick.stop="openTable({ connection: conn, database: db, table: view, isView: true })"
              >
                <svg
                  class="object-icon view-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span class="object-name">{{ view }}</span>
              </div>
              <div v-if="remainingFor(db, 'views')" class="object-more" @click.stop="loadMore(db, 'views')">
                还有 {{ remainingFor(db, 'views') }} 项，点击加载
              </div>
            </div>
          </div>
          <div v-if="!filtering" class="object-category">
            <div
              class="category-header"
              @click.stop="selectCategory(conn, db, 'functions')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'functions'
                })
              "
            >
              <svg
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_functions`)
                }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                @click.stop="toggleObjectCategory(conn.name, db, 'functions')"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg class="category-type-icon function-icon" viewBox="0 0 32 18" fill="currentColor" stroke="none">
                <text x="0" y="14" font-size="12" font-style="italic" font-weight="600">f</text>
                <text x="14" y="17" font-size="8">(x)</text>
              </svg>
              <span class="category-name">函数</span>
              <span class="category-count">{{ categoryCount(db, 'functions') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_functions`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'functions')" class="category-loading">加载中…</div>
              <div
                v-for="func in displayItems(db, 'functions')"
                :key="func"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'function' && selectedObject?.name === func
                  }
                ]"
                @click="handleSelectConnectionDatabaseFunction(conn, db, func)"
              >
                <svg class="object-icon function-icon" viewBox="0 0 32 18" fill="currentColor" stroke="none">
                  <text x="0" y="14" font-size="12" font-style="italic" font-weight="600">f</text>
                  <text x="14" y="17" font-size="8">(x)</text>
                </svg>
                <span class="object-name">{{ func }}</span>
              </div>
              <div v-if="remainingFor(db, 'functions')" class="object-more" @click.stop="loadMore(db, 'functions')">
                还有 {{ remainingFor(db, 'functions') }} 项，点击加载
              </div>
            </div>
          </div>
          <div v-if="!filtering" class="object-category">
            <div
              class="category-header"
              @click.stop="selectCategory(conn, db, 'procedures')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'procedures'
                })
              "
            >
              <svg
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_procedures`)
                }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                @click.stop="toggleObjectCategory(conn.name, db, 'procedures')"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg
                class="category-type-icon procedure-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <polygon points="10 9 15 12 10 15" />
              </svg>
              <span class="category-name">存储过程</span>
              <span class="category-count">{{ categoryCount(db, 'procedures') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_procedures`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'procedures')" class="category-loading">加载中…</div>
              <div
                v-for="proc in displayItems(db, 'procedures')"
                :key="proc"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'procedure' && selectedObject?.name === proc
                  }
                ]"
                @click="handleSelectConnectionDatabaseProcedure(conn, db, proc)"
                @dblclick.stop="previewProcedureInQuery({ connection: conn, database: db, procedure: proc })"
              >
                <svg
                  class="object-icon procedure-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <polygon points="10 9 15 12 10 15" />
                </svg>
                <span class="object-name">{{ proc }}</span>
              </div>
              <div v-if="remainingFor(db, 'procedures')" class="object-more" @click.stop="loadMore(db, 'procedures')">
                还有 {{ remainingFor(db, 'procedures') }} 项，点击加载
              </div>
            </div>
          </div>
          <div v-if="!filtering" class="object-category">
            <div
              class="category-header"
              @click.stop="selectCategory(conn, db, 'triggers')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'triggers'
                })
              "
            >
              <svg
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_triggers`)
                }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                @click.stop="toggleObjectCategory(conn.name, db, 'triggers')"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg
                class="category-type-icon trigger-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span class="category-name">触发器</span>
              <span class="category-count">{{ categoryCount(db, 'triggers') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_triggers`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'triggers')" class="category-loading">加载中…</div>
              <div
                v-for="trigger in displayItems(db, 'triggers')"
                :key="trigger"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'trigger' && selectedObject?.name === trigger
                  }
                ]"
                @click="handleSelectConnectionDatabaseTrigger(conn, db, trigger)"
              >
                <svg
                  class="object-icon trigger-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span class="object-name">{{ trigger }}</span>
              </div>
              <div v-if="remainingFor(db, 'triggers')" class="object-more" @click.stop="loadMore(db, 'triggers')">
                还有 {{ remainingFor(db, 'triggers') }} 项，点击加载
              </div>
            </div>
          </div>
          <div v-if="!filtering" class="object-category">
            <div
              class="category-header"
              @click.stop="selectCategory(conn, db, 'events')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'events'
                })
              "
            >
              <svg
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_events`)
                }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                @click.stop="toggleObjectCategory(conn.name, db, 'events')"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg
                class="category-type-icon event-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span class="category-name">事件</span>
              <span class="category-count">{{ categoryCount(db, 'events') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_events`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'events')" class="category-loading">加载中…</div>
              <div
                v-for="event in displayItems(db, 'events')"
                :key="event"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'event' && selectedObject?.name === event
                  }
                ]"
                @click="handleSelectConnectionDatabaseEvent(conn, db, event)"
                @dblclick.stop="openEventDialog({ connection: conn, database: db, event })"
              >
                <svg
                  class="object-icon event-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span class="object-name">{{ event }}</span>
              </div>
              <div v-if="remainingFor(db, 'events')" class="object-more" @click.stop="loadMore(db, 'events')">
                还有 {{ remainingFor(db, 'events') }} 项，点击加载
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'

const databaseStore = inject('database')
const {
  connectionDatabases,
  databaseObjectsMap,
  draggingConnection,
  expandedConnections,
  expandedDatabases,
  expandedObjectCategories,
  handleConnectionDoubleClick,
  handleSelectConnectionDatabase,
  handleSelectConnectionDatabaseEvent,
  handleSelectConnectionDatabaseFunction,
  handleSelectConnectionDatabaseProcedure,
  handleSelectConnectionDatabaseTable,
  handleSelectConnectionDatabaseTrigger,
  handleSelectConnectionDatabaseView,
  objectCategoryLoading,
  onDragEndConnection,
  onDragStartConnection,
  openDatabaseFromSidebar,
  openEventDialog,
  openTable,
  openedDatabases,
  previewProcedureInQuery,
  selectCategory,
  selectConnection,
  selectedConnection,
  selectedDatabase,
  selectedObject,
  showContextMenu,
  toggleConnectionDatabases,
  toggleDatabaseObjects,
  toggleObjectCategory
} = databaseStore

const props = defineProps({
  conn: { type: Object, required: true },
  filterKeyword: { type: String, default: '' }
})

const filtering = computed(() => props.filterKeyword.length > 0)
const keyword = computed(() => props.filterKeyword.toLowerCase())

function matches(name) {
  return String(name || '')
    .toLowerCase()
    .includes(keyword.value)
}

function objectsFor(db) {
  const objectsKey = `${props.conn.name}_${db}`
  if (!openedDatabases.value.includes(objectsKey)) return null
  return databaseObjectsMap.value[objectsKey] || null
}

const visibleDatabases = computed(() => {
  const databases = connectionDatabases.value[props.conn.name] || []
  if (!filtering.value) return databases

  return databases.filter((db) => {
    if (matches(db)) return true
    const objects = objectsFor(db)
    if (!objects) return false
    return [...(objects.tables || []), ...(objects.views || [])].some(matches)
  })
})

function tablesFor(db) {
  const tables = objectsFor(db)?.tables || []
  return filtering.value ? tables.filter(matches) : tables
}

function viewsFor(db) {
  const views = objectsFor(db)?.views || []
  return filtering.value ? views.filter(matches) : views
}

const OBJECT_RENDER_LIMIT = 200
const OBJECT_RENDER_STEP = 300
const renderLimits = ref({})

function categoryItems(db, category) {
  if (category === 'tables') return tablesFor(db)
  if (category === 'views') return viewsFor(db)
  const items = objectsFor(db)?.[category] || []
  return filtering.value ? items.filter(matches) : items
}

function isCategoryLoading(db, category) {
  return Boolean(objectCategoryLoading.value[`${props.conn.name}_${db}_${category}`])
}

function categoryCount(db, category) {
  if (isCategoryLoading(db, category)) return '…'
  const objects = objectsFor(db)
  if (!objects || !Array.isArray(objects[category])) return ''
  return categoryItems(db, category).length
}

function renderLimitKey(db, category) {
  return `${props.conn.name}_${db}_${category}`
}

function renderLimit(db, category) {
  return renderLimits.value[renderLimitKey(db, category)] || OBJECT_RENDER_LIMIT
}

function displayItems(db, category) {
  return categoryItems(db, category).slice(0, renderLimit(db, category))
}

function remainingFor(db, category) {
  return Math.max(0, categoryItems(db, category).length - renderLimit(db, category))
}

function loadMore(db, category) {
  renderLimits.value = {
    ...renderLimits.value,
    [renderLimitKey(db, category)]: renderLimit(db, category) + OBJECT_RENDER_STEP
  }
}
</script>
