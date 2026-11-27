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
      role="button"
      tabindex="0"
      :aria-expanded="conn.active ? expandedConnections.includes(conn.name) : undefined"
      @dragstart="onDragStartConnection(conn)"
      @dragend="onDragEndConnection"
      @click="selectConnection(conn)"
      @dblclick="handleConnectionDoubleClick(conn)"
      @keydown.enter.prevent="handleConnectionDoubleClick(conn)"
      @keydown.space.prevent="selectConnection(conn)"
      @keydown="
        handleExpandKeys($event, expandedConnections.includes(conn.name), () => toggleConnectionDatabases(conn.name))
      "
      @contextmenu.prevent.stop="showContextMenu($event, 'connection', conn)"
    >
      <span class="connection-expand-placeholder">
        <AppIcon
          name="chevron-right"
          class="connection-expand-icon"
          :class="{ expanded: expandedConnections.includes(conn.name) }"
          :style="{
            visibility: conn.active ? 'visible' : 'hidden'
          }"
          @click.stop="toggleConnectionDatabases(conn.name)"
        />
      </span>
      <EngineLogo :engine="conn.engine" size="xs" class="connection-type-icon" />
      <span v-if="conn.color" class="connection-color-dot" :style="{ background: conn.color }" />
      <span class="connection-name">{{ conn.name }}</span>
      <span v-if="conn.readOnly" class="connection-readonly-badge" :title="t('只读连接')">{{ t('只读') }}</span>
      <span
        :class="['connection-status-dot', { active: conn.active }]"
        :title="conn.active ? t('已连接') : t('未连接')"
      />
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
          role="button"
          tabindex="0"
          :aria-expanded="
            openedDatabases.includes(`${conn.name}_${db}`)
              ? expandedDatabases.includes(`${conn.name}_${db}`)
              : undefined
          "
          @click.stop="handleSelectConnectionDatabase(conn, db)"
          @dblclick="openDatabaseFromSidebar(conn, db)"
          @keydown.enter.prevent="openDatabaseFromSidebar(conn, db)"
          @keydown.space.prevent="handleSelectConnectionDatabase(conn, db)"
          @keydown="
            handleExpandKeys($event, expandedDatabases.includes(`${conn.name}_${db}`), () =>
              toggleDatabaseObjects(conn.name, db)
            )
          "
          @contextmenu.prevent.stop="showContextMenu($event, 'database', { connection: conn, database: db })"
        >
          <span class="db-expand-placeholder">
            <AppIcon
              v-if="openedDatabases.includes(`${conn.name}_${db}`)"
              name="chevron-right"
              class="db-expand-icon"
              :class="{ expanded: filtering || expandedDatabases.includes(`${conn.name}_${db}`) }"
              @click.stop="toggleDatabaseObjects(conn.name, db)"
            />
          </span>
          <AppIcon
            name="database"
            :class="['db-icon', openedDatabases.includes(`${conn.name}_${db}`) ? 'opened' : '']"
          />
          <span class="db-name">{{ db }}</span>
          <span v-if="openedDatabases.includes(`${conn.name}_${db}`)" class="db-status-dot" :title="t('已打开')" />
        </div>
        <div v-if="filtering || expandedDatabases.includes(`${conn.name}_${db}`)" class="database-objects">
          <div v-if="!filtering || tablesFor(db).length" class="object-category">
            <div
              class="category-header"
              role="button"
              tabindex="0"
              :aria-expanded="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_tables`)"
              @click.stop="selectCategory(conn, db, 'tables')"
              @keydown="onCategoryKey($event, conn, db, 'tables')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'tables'
                })
              "
            >
              <AppIcon
                name="chevron-right"
                class="category-icon"
                :class="{
                  expanded: filtering || expandedObjectCategories.includes(`${conn.name}_${db}_tables`)
                }"
                @click.stop="toggleObjectCategory(conn.name, db, 'tables')"
              />
              <AppIcon name="table" class="category-type-icon" />
              <span class="category-name">{{ t('表') }}</span>
              <span class="category-count">{{ categoryCount(db, 'tables') }}</span>
            </div>
            <div
              v-show="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_tables`)"
              class="category-items"
            >
              <div v-if="isCategoryLoading(db, 'tables')" class="category-loading">{{ t('加载中…') }}</div>
              <div
                v-for="table in displayItems(db, 'tables')"
                :key="table"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'table' && selectedObject?.name === table
                  }
                ]"
                role="button"
                tabindex="0"
                @click="handleSelectConnectionDatabaseTable(conn, db, table)"
                @dblclick.stop="openTable({ connection: conn, database: db, table })"
                @keydown.enter.prevent="openTable({ connection: conn, database: db, table })"
                @keydown.space.prevent="handleSelectConnectionDatabaseTable(conn, db, table)"
                @contextmenu.prevent.stop="
                  showContextMenu($event, 'table', {
                    connection: conn,
                    database: db,
                    table
                  })
                "
              >
                <AppIcon name="table" class="object-icon table-icon" />
                <span class="object-name">{{ table }}</span>
              </div>
              <div
                v-if="remainingFor(db, 'tables')"
                class="object-more"
                role="button"
                tabindex="0"
                @click.stop="loadMore(db, 'tables')"
                @keydown.enter.prevent="loadMore(db, 'tables')"
                @keydown.space.prevent="loadMore(db, 'tables')"
              >
                {{ t('还有') }} {{ remainingFor(db, 'tables') }} {{ t('项，点击加载') }}
              </div>
            </div>
          </div>
          <div v-if="!filtering || viewsFor(db).length" class="object-category">
            <div
              class="category-header"
              role="button"
              tabindex="0"
              :aria-expanded="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_views`)"
              @click.stop="selectCategory(conn, db, 'views')"
              @keydown="onCategoryKey($event, conn, db, 'views')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'views'
                })
              "
            >
              <AppIcon
                name="chevron-right"
                class="category-icon"
                :class="{
                  expanded: filtering || expandedObjectCategories.includes(`${conn.name}_${db}_views`)
                }"
                @click.stop="toggleObjectCategory(conn.name, db, 'views')"
              />
              <AppIcon name="eye" class="category-type-icon" />
              <span class="category-name">{{ t('视图') }}</span>
              <span class="category-count">{{ categoryCount(db, 'views') }}</span>
            </div>
            <div
              v-show="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_views`)"
              class="category-items"
            >
              <div v-if="isCategoryLoading(db, 'views')" class="category-loading">{{ t('加载中…') }}</div>
              <div
                v-for="view in displayItems(db, 'views')"
                :key="view"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'view' && selectedObject?.name === view
                  }
                ]"
                role="button"
                tabindex="0"
                @click="handleSelectConnectionDatabaseView(conn, db, view)"
                @dblclick.stop="openTable({ connection: conn, database: db, table: view, isView: true })"
                @keydown.enter.prevent="openTable({ connection: conn, database: db, table: view, isView: true })"
                @keydown.space.prevent="handleSelectConnectionDatabaseView(conn, db, view)"
              >
                <AppIcon name="eye" class="object-icon view-icon" />
                <span class="object-name">{{ view }}</span>
              </div>
              <div
                v-if="remainingFor(db, 'views')"
                class="object-more"
                role="button"
                tabindex="0"
                @click.stop="loadMore(db, 'views')"
                @keydown.enter.prevent="loadMore(db, 'views')"
                @keydown.space.prevent="loadMore(db, 'views')"
              >
                {{ t('还有') }} {{ remainingFor(db, 'views') }} {{ t('项，点击加载') }}
              </div>
            </div>
          </div>
          <div v-if="!filtering && supports('routines')" class="object-category">
            <div
              class="category-header"
              role="button"
              tabindex="0"
              :aria-expanded="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_functions`)"
              @click.stop="selectCategory(conn, db, 'functions')"
              @keydown="onCategoryKey($event, conn, db, 'functions')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'functions'
                })
              "
            >
              <AppIcon
                name="chevron-right"
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_functions`)
                }"
                @click.stop="toggleObjectCategory(conn.name, db, 'functions')"
              />
              <svg class="category-type-icon function-icon" viewBox="0 0 32 18" fill="currentColor" stroke="none">
                <text x="0" y="14" font-size="12" font-style="italic" font-weight="600">f</text>
                <text x="14" y="17" font-size="8">(x)</text>
              </svg>
              <span class="category-name">{{ t('函数') }}</span>
              <span class="category-count">{{ categoryCount(db, 'functions') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_functions`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'functions')" class="category-loading">{{ t('加载中…') }}</div>
              <div
                v-for="func in displayItems(db, 'functions')"
                :key="func"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'function' && selectedObject?.name === func
                  }
                ]"
                role="button"
                tabindex="0"
                @click="handleSelectConnectionDatabaseFunction(conn, db, func)"
                @keydown.enter.prevent="handleSelectConnectionDatabaseFunction(conn, db, func)"
                @keydown.space.prevent="handleSelectConnectionDatabaseFunction(conn, db, func)"
              >
                <svg class="object-icon function-icon" viewBox="0 0 32 18" fill="currentColor" stroke="none">
                  <text x="0" y="14" font-size="12" font-style="italic" font-weight="600">f</text>
                  <text x="14" y="17" font-size="8">(x)</text>
                </svg>
                <span class="object-name">{{ func }}</span>
              </div>
              <div
                v-if="remainingFor(db, 'functions')"
                class="object-more"
                role="button"
                tabindex="0"
                @click.stop="loadMore(db, 'functions')"
                @keydown.enter.prevent="loadMore(db, 'functions')"
                @keydown.space.prevent="loadMore(db, 'functions')"
              >
                {{ t('还有') }} {{ remainingFor(db, 'functions') }} {{ t('项，点击加载') }}
              </div>
            </div>
          </div>
          <div v-if="!filtering && supports('routines')" class="object-category">
            <div
              class="category-header"
              role="button"
              tabindex="0"
              :aria-expanded="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_procedures`)"
              @click.stop="selectCategory(conn, db, 'procedures')"
              @keydown="onCategoryKey($event, conn, db, 'procedures')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'procedures'
                })
              "
            >
              <AppIcon
                name="chevron-right"
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_procedures`)
                }"
                @click.stop="toggleObjectCategory(conn.name, db, 'procedures')"
              />
              <AppIcon name="procedure" class="category-type-icon procedure-icon" />
              <span class="category-name">{{ t('存储过程') }}</span>
              <span class="category-count">{{ categoryCount(db, 'procedures') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_procedures`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'procedures')" class="category-loading">{{ t('加载中…') }}</div>
              <div
                v-for="proc in displayItems(db, 'procedures')"
                :key="proc"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'procedure' && selectedObject?.name === proc
                  }
                ]"
                role="button"
                tabindex="0"
                @click="handleSelectConnectionDatabaseProcedure(conn, db, proc)"
                @dblclick.stop="previewProcedureInQuery({ connection: conn, database: db, procedure: proc })"
                @keydown.enter.prevent="previewProcedureInQuery({ connection: conn, database: db, procedure: proc })"
                @keydown.space.prevent="handleSelectConnectionDatabaseProcedure(conn, db, proc)"
              >
                <AppIcon name="procedure" class="object-icon procedure-icon" />
                <span class="object-name">{{ proc }}</span>
              </div>
              <div
                v-if="remainingFor(db, 'procedures')"
                class="object-more"
                role="button"
                tabindex="0"
                @click.stop="loadMore(db, 'procedures')"
                @keydown.enter.prevent="loadMore(db, 'procedures')"
                @keydown.space.prevent="loadMore(db, 'procedures')"
              >
                {{ t('还有') }} {{ remainingFor(db, 'procedures') }} {{ t('项，点击加载') }}
              </div>
            </div>
          </div>
          <div v-if="!filtering && supports('triggers')" class="object-category">
            <div
              class="category-header"
              role="button"
              tabindex="0"
              :aria-expanded="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_triggers`)"
              @click.stop="selectCategory(conn, db, 'triggers')"
              @keydown="onCategoryKey($event, conn, db, 'triggers')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'triggers'
                })
              "
            >
              <AppIcon
                name="chevron-right"
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_triggers`)
                }"
                @click.stop="toggleObjectCategory(conn.name, db, 'triggers')"
              />
              <AppIcon name="zap" class="category-type-icon trigger-icon" />
              <span class="category-name">{{ t('触发器') }}</span>
              <span class="category-count">{{ categoryCount(db, 'triggers') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_triggers`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'triggers')" class="category-loading">{{ t('加载中…') }}</div>
              <div
                v-for="trigger in displayItems(db, 'triggers')"
                :key="trigger"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'trigger' && selectedObject?.name === trigger
                  }
                ]"
                role="button"
                tabindex="0"
                @click="handleSelectConnectionDatabaseTrigger(conn, db, trigger)"
                @keydown.enter.prevent="handleSelectConnectionDatabaseTrigger(conn, db, trigger)"
                @keydown.space.prevent="handleSelectConnectionDatabaseTrigger(conn, db, trigger)"
              >
                <AppIcon name="zap" class="object-icon trigger-icon" />
                <span class="object-name">{{ trigger }}</span>
              </div>
              <div
                v-if="remainingFor(db, 'triggers')"
                class="object-more"
                role="button"
                tabindex="0"
                @click.stop="loadMore(db, 'triggers')"
                @keydown.enter.prevent="loadMore(db, 'triggers')"
                @keydown.space.prevent="loadMore(db, 'triggers')"
              >
                {{ t('还有') }} {{ remainingFor(db, 'triggers') }} {{ t('项，点击加载') }}
              </div>
            </div>
          </div>
          <div v-if="!filtering && supports('events')" class="object-category">
            <div
              class="category-header"
              role="button"
              tabindex="0"
              :aria-expanded="filtering || expandedObjectCategories.includes(`${conn.name}_${db}_events`)"
              @click.stop="selectCategory(conn, db, 'events')"
              @keydown="onCategoryKey($event, conn, db, 'events')"
              @contextmenu.prevent.stop="
                showContextMenu($event, 'category', {
                  connection: conn,
                  database: db,
                  category: 'events'
                })
              "
            >
              <AppIcon
                name="chevron-right"
                class="category-icon"
                :class="{
                  expanded: expandedObjectCategories.includes(`${conn.name}_${db}_events`)
                }"
                @click.stop="toggleObjectCategory(conn.name, db, 'events')"
              />
              <AppIcon name="history" class="category-type-icon event-icon" />
              <span class="category-name">{{ t('事件') }}</span>
              <span class="category-count">{{ categoryCount(db, 'events') }}</span>
            </div>
            <div v-show="expandedObjectCategories.includes(`${conn.name}_${db}_events`)" class="category-items">
              <div v-if="isCategoryLoading(db, 'events')" class="category-loading">{{ t('加载中…') }}</div>
              <div
                v-for="event in displayItems(db, 'events')"
                :key="event"
                :class="[
                  'object-item',
                  {
                    active: selectedObject?.type === 'event' && selectedObject?.name === event
                  }
                ]"
                role="button"
                tabindex="0"
                @click="handleSelectConnectionDatabaseEvent(conn, db, event)"
                @dblclick.stop="openEventDialog({ connection: conn, database: db, event })"
                @keydown.enter.prevent="openEventDialog({ connection: conn, database: db, event })"
                @keydown.space.prevent="handleSelectConnectionDatabaseEvent(conn, db, event)"
              >
                <AppIcon name="history" class="object-icon event-icon" />
                <span class="object-name">{{ event }}</span>
              </div>
              <div
                v-if="remainingFor(db, 'events')"
                class="object-more"
                role="button"
                tabindex="0"
                @click.stop="loadMore(db, 'events')"
                @keydown.enter.prevent="loadMore(db, 'events')"
                @keydown.space.prevent="loadMore(db, 'events')"
              >
                {{ t('还有') }} {{ remainingFor(db, 'events') }} {{ t('项，点击加载') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { getEngineCapabilities } from '@shared/databaseEngines'
import { computed, inject, ref } from 'vue'

import AppIcon from '@/components/AppIcon.vue'
import EngineLogo from './EngineLogo.vue'
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
const engineCapabilities = computed(() => getEngineCapabilities(props.conn.engine))

function supports(feature) {
  return engineCapabilities.value[feature] === true
}

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

function handleExpandKeys(event, expanded, toggle) {
  if ((event.key === 'ArrowRight' && !expanded) || (event.key === 'ArrowLeft' && expanded)) {
    event.preventDefault()
    toggle()
  }
}

function onCategoryKey(event, conn, db, category) {
  if (event.key === 'Enter') {
    event.preventDefault()
    toggleObjectCategory(conn.name, db, category)
  } else if (event.key === ' ') {
    event.preventDefault()
    selectCategory(conn, db, category)
  }
}
</script>
