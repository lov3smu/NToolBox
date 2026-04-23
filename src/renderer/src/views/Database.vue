<template>
  <div
    class="database-container"
    :style="{ width: windowWidth + 'px' }"
  >
    <header>
      <div class="header-left">
        <h1>
          <svg
            class="header-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <ellipse
              cx="12"
              cy="5"
              rx="9"
              ry="3"
            />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          <span class="header-title-text">数据库管理</span>
        </h1>
        <div class="header-divider" />
        <div class="header-shortcuts">
          <div
            class="shortcut-item"
            title="新建连接"
            @click="showAddConnectionModal"
          >
            <svg
              class="shortcut-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="8"
                rx="2"
                ry="2"
              />
              <rect
                x="2"
                y="14"
                width="20"
                height="8"
                rx="2"
                ry="2"
              />
              <line
                x1="6"
                y1="6"
                x2="6.01"
                y2="6"
              />
              <line
                x1="6"
                y1="18"
                x2="6.01"
                y2="18"
              />
              <line
                x1="12"
                y1="12"
                x2="12"
                y2="12.01"
              />
            </svg>
            <span class="shortcut-text">新建连接</span>
          </div>
          <div
            class="shortcut-item"
            title="新建查询"
            @click="createQueryTab('')"
          >
            <svg
              class="shortcut-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line
                x1="16"
                y1="13"
                x2="8"
                y2="13"
              />
              <line
                x1="16"
                y1="17"
                x2="8"
                y2="17"
              />
            </svg>
            <span class="shortcut-text">新建查询</span>
          </div>
        </div>
        <div class="header-divider" />
        <div class="header-stats">
          <span
            class="stat-item clickable"
            title="查看表列表"
            @click="handleHeaderStatClick('tables')"
          >
            <svg
              class="stat-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
              />
              <line
                x1="3"
                y1="9"
                x2="21"
                y2="9"
              />
              <line
                x1="9"
                y1="21"
                x2="9"
                y2="9"
              />
            </svg>
            <span class="stat-text">表</span>
          </span>
          <span
            class="stat-item clickable"
            title="查看视图列表"
            @click="handleHeaderStatClick('views')"
          >
            <svg
              class="stat-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle
                cx="12"
                cy="12"
                r="3"
              />
            </svg>
            <span class="stat-text">视图</span>
          </span>
          <span
            class="stat-item clickable"
            title="查看函数列表"
            @click="handleHeaderStatClick('functions')"
          >
            <svg
              class="stat-icon fx-icon"
              viewBox="0 0 32 18"
              fill="currentColor"
              stroke="none"
            >
              <text
                x="0"
                y="14"
                font-size="12"
                font-style="italic"
                font-weight="600"
              >f</text>
              <text
                x="14"
                y="17"
                font-size="8"
              >(x)</text>
            </svg>
            <span class="stat-text">函数</span>
          </span>
          <span class="stat-item">
            <svg
              class="stat-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle
                cx="12"
                cy="7"
                r="4"
              />
            </svg>
            <span class="stat-text">用户</span>
          </span>
          <span class="stat-item">
            <svg
              class="stat-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span class="stat-text">查询</span>
          </span>
        </div>
      </div>
    </header>

    <div class="main-content">
      <div
        class="sidebar"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <div
          class="sidebar-header"
          :class="{ 'drag-over': draggingConnection && !dragOverGroup }"
          @contextmenu.prevent="showContextMenu($event, 'header')"
          @dragover.prevent="onDragOverHeader"
          @drop.prevent="onDropToHeader"
        >
          <h3>
            <svg
              class="title-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            我的连接
          </h3>
        </div>
        <div
          class="connection-list"
          @contextmenu.prevent="showContextMenu($event, 'list')"
        >
          <template
            v-for="group in connectionGroups"
            :key="group.name"
          >
            <div 
              class="group-item" 
              :class="{ 'drag-over': dragOverGroup === group.name }"
              @click.stop="selectGroup(group)"
              @contextmenu.prevent.stop="showContextMenu($event, 'group', group)"
              @dragover.prevent="onDragOverGroup(group.name)"
              @dragleave="onDragLeaveGroup"
              @drop.prevent="onDropToGroup(group.name)"
            >
              <svg
                class="group-arrow"
                :class="{ expanded: expandedGroups.includes(group.name) }"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                @click.stop="toggleGroup(group.name)"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <svg
                class="group-folder-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">{{ group.connections.length }}</span>
            </div>
            <div
              v-show="expandedGroups.includes(group.name)"
              class="group-connections"
            >
              <div class="connection-wrapper">
                <div
                  v-for="conn in group.connections"
                  :key="conn.name"
                  class="connection-container"
                >
                  <div
                    :class="['connection-item', { active: selectedConnection?.name === conn.name, dragging: draggingConnection === conn.name }]"
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
                        :style="{ visibility: conn.active && connectionDatabases[conn.name]?.length > 0 ? 'visible' : 'hidden' }"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        @click.stop="toggleConnectionDatabases(conn.name)"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                    <svg
                      class="connection-type-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect
                        x="2"
                        y="2"
                        width="20"
                        height="8"
                        rx="2"
                        ry="2"
                      />
                      <rect
                        x="2"
                        y="14"
                        width="20"
                        height="8"
                        rx="2"
                        ry="2"
                      />
                      <line
                        x1="6"
                        y1="6"
                        x2="6.01"
                        y2="6"
                      />
                      <line
                        x1="6"
                        y1="18"
                        x2="6.01"
                        y2="18"
                      />
                    </svg>
                    <span class="connection-name">{{ conn.name }}</span>
                    <span :class="['status-badge', conn.active ? 'active' : 'inactive']">
                      {{ conn.active ? '已连接' : '' }}
                    </span>
                  </div>
                  <div
                    v-if="conn.active && expandedConnections.includes(conn.name)"
                    class="connection-databases"
                  >
                    <div
                      v-for="db in connectionDatabases[conn.name]"
                      :key="db"
                      class="database-wrapper"
                    >
                      <div
                        :class="['database-item', { active: selectedConnection?.name === conn.name && selectedDatabase === db && selectedObject?.type === 'database' && selectedObject?.name === db }]"
                        @click.stop="selectConnection(conn); selectDatabase(db); selectDatabaseObject(db)"
                        @dblclick="openDatabaseFromSidebar(conn, db)"
                        @contextmenu.prevent.stop="showContextMenu($event, 'database', { connection: conn, database: db })"
                      >
                        <span class="db-expand-placeholder">
                          <svg 
                            v-if="openedDatabases.includes(`${conn.name}_${db}`)"
                            class="db-expand-icon"
                            :class="{ expanded: expandedDatabases.includes(`${conn.name}_${db}`) }"
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
                          <ellipse
                            cx="12"
                            cy="5"
                            rx="9"
                            ry="3"
                          />
                          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                        </svg>
                        <span class="db-name">{{ db }}</span>
                      </div>
                      <div
                        v-if="expandedDatabases.includes(`${conn.name}_${db}`)"
                        class="database-objects"
                      >
                        <div class="object-category">
                          <div
                            class="category-header"
                            @click.stop="selectCategory(conn, db, 'tables')"
                            @contextmenu.prevent.stop="showContextMenu($event, 'category', { connection: conn, database: db, category: 'tables' })"
                          >
                            <svg
                              class="category-icon"
                              :class="{ expanded: expandedObjectCategories.includes(`${conn.name}_${db}_tables`) }"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              @click.stop="toggleObjectCategory(`${conn.name}_${db}_tables`)"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <svg
                              class="category-type-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="2"
                              />
                              <line
                                x1="3"
                                y1="9"
                                x2="21"
                                y2="9"
                              />
                              <line
                                x1="9"
                                y1="21"
                                x2="9"
                                y2="9"
                              />
                            </svg>
                            <span class="category-name">表</span>
                            <span class="category-count">{{ databaseObjectsMap[`${conn.name}_${db}`]?.tables?.length || 0 }}</span>
                          </div>
                          <div
                            v-show="expandedObjectCategories.includes(`${conn.name}_${db}_tables`)"
                            class="category-items"
                          >
                            <div 
                              v-for="table in databaseObjectsMap[`${conn.name}_${db}`]?.tables" 
                              :key="table" 
                              :class="['object-item', { active: selectedObject?.type === 'table' && selectedObject?.name === table }]"
                              @click="selectConnection(conn); selectDatabase(db); selectTableObject(table)"
                              @dblclick.stop="openTable({ connection: conn, database: db, table })"
                              @contextmenu.prevent.stop="showContextMenu($event, 'table', { connection: conn, database: db, table })"
                            >
                              <svg
                                class="object-icon table-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                              >
                                <rect
                                  x="3"
                                  y="3"
                                  width="18"
                                  height="18"
                                  rx="2"
                                />
                                <line
                                  x1="3"
                                  y1="9"
                                  x2="21"
                                  y2="9"
                                />
                                <line
                                  x1="9"
                                  y1="21"
                                  x2="9"
                                  y2="9"
                                />
                              </svg>
                              <span class="object-name">{{ table }}</span>
                            </div>
                          </div>
                        </div>
                        <div class="object-category">
                          <div
                            class="category-header"
                            @click.stop="selectCategory(conn, db, 'views')"
                            @contextmenu.prevent.stop="showContextMenu($event, 'category', { connection: conn, database: db, category: 'views' })"
                          >
                            <svg
                              class="category-icon"
                              :class="{ expanded: expandedObjectCategories.includes(`${conn.name}_${db}_views`) }"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              @click.stop="toggleObjectCategory(`${conn.name}_${db}_views`)"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <svg
                              class="category-type-icon"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle
                                cx="12"
                                cy="12"
                                r="3"
                              />
                            </svg>
                            <span class="category-name">视图</span>
                            <span class="category-count">{{ databaseObjectsMap[`${conn.name}_${db}`]?.views?.length || 0 }}</span>
                          </div>
                          <div
                            v-show="expandedObjectCategories.includes(`${conn.name}_${db}_views`)"
                            class="category-items"
                          >
                            <div 
                              v-for="view in databaseObjectsMap[`${conn.name}_${db}`]?.views" 
                              :key="view" 
                              :class="['object-item', { active: selectedObject?.type === 'view' && selectedObject?.name === view }]"
                              @click="selectConnection(conn); selectDatabase(db); selectViewObject(view)"
                            >
                              <svg
                                class="object-icon view-icon"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="3"
                                />
                              </svg>
                              <span class="object-name">{{ view }}</span>
                            </div>
                          </div>
                        </div>
                        <div class="object-category">
                          <div
                            class="category-header"
                            @click.stop="selectCategory(conn, db, 'functions')"
                            @contextmenu.prevent.stop="showContextMenu($event, 'category', { connection: conn, database: db, category: 'functions' })"
                          >
                            <svg
                              class="category-icon"
                              :class="{ expanded: expandedObjectCategories.includes(`${conn.name}_${db}_functions`) }"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                              @click.stop="toggleObjectCategory(`${conn.name}_${db}_functions`)"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <svg
                              class="category-type-icon function-icon"
                              viewBox="0 0 32 18"
                              fill="currentColor"
                              stroke="none"
                            >
                              <text
                                x="0"
                                y="14"
                                font-size="12"
                                font-style="italic"
                                font-weight="600"
                              >f</text>
                              <text
                                x="14"
                                y="17"
                                font-size="8"
                              >(x)</text>
                            </svg>
                            <span class="category-name">函数</span>
                            <span class="category-count">{{ databaseObjectsMap[`${conn.name}_${db}`]?.functions?.length || 0 }}</span>
                          </div>
                          <div
                            v-show="expandedObjectCategories.includes(`${conn.name}_${db}_functions`)"
                            class="category-items"
                          >
                            <div 
                              v-for="func in databaseObjectsMap[`${conn.name}_${db}`]?.functions" 
                              :key="func" 
                              :class="['object-item', { active: selectedObject?.type === 'function' && selectedObject?.name === func }]"
                              @click="selectConnection(conn); selectDatabase(db); selectFunctionObject(func)"
                            >
                              <svg
                                class="object-icon function-icon"
                                viewBox="0 0 32 18"
                                fill="currentColor"
                                stroke="none"
                              >
                                <text
                                  x="0"
                                  y="14"
                                  font-size="12"
                                  font-style="italic"
                                  font-weight="600"
                                >f</text>
                                <text
                                  x="14"
                                  y="17"
                                  font-size="8"
                                >(x)</text>
                              </svg>
                              <span class="object-name">{{ func }}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <template v-if="ungroupedConnections.length > 0">
            <div
              v-for="conn in ungroupedConnections"
              :key="conn.name"
              class="connection-container"
            >
              <div
                :class="['connection-item', { active: selectedConnection?.name === conn.name, dragging: draggingConnection === conn.name }]"
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
                    :style="{ visibility: conn.active && connectionDatabases[conn.name]?.length > 0 ? 'visible' : 'hidden' }"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    @click.stop="toggleConnectionDatabases(conn.name)"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </span>
                <svg
                  class="connection-type-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="8"
                    rx="2"
                    ry="2"
                  />
                  <rect
                    x="2"
                    y="14"
                    width="20"
                    height="8"
                    rx="2"
                    ry="2"
                  />
                  <line
                    x1="6"
                    y1="6"
                    x2="6.01"
                    y2="6"
                  />
                  <line
                    x1="6"
                    y1="18"
                    x2="6.01"
                    y2="18"
                  />
                </svg>
                <span class="connection-name">{{ conn.name }}</span>
                <span :class="['status-badge', conn.active ? 'active' : 'inactive']">
                  {{ conn.active ? '已连接' : '' }}
                </span>
              </div>
              <div
                v-if="conn.active && expandedConnections.includes(conn.name)"
                class="connection-databases"
              >
                <div
                  v-for="db in connectionDatabases[conn.name]"
                  :key="db"
                  class="database-wrapper"
                >
                  <div
                    :class="['database-item', { active: selectedConnection?.name === conn.name && selectedDatabase === db && selectedObject?.type === 'database' && selectedObject?.name === db }]"
                    @click.stop="selectConnection(conn); selectDatabase(db); selectDatabaseObject(db)"
                    @dblclick="openDatabaseFromSidebar(conn, db)"
                    @contextmenu.prevent.stop="showContextMenu($event, 'database', { connection: conn, database: db })"
                  >
                    <span class="db-expand-placeholder">
                      <svg 
                        v-if="openedDatabases.includes(`${conn.name}_${db}`)"
                        class="db-expand-icon"
                        :class="{ expanded: expandedDatabases.includes(`${conn.name}_${db}`) }"
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
                      <ellipse
                        cx="12"
                        cy="5"
                        rx="9"
                        ry="3"
                      />
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </svg>
                    <span class="db-name">{{ db }}</span>
                  </div>
                  <div
                    v-if="expandedDatabases.includes(`${conn.name}_${db}`)"
                    class="database-objects"
                  >
                    <div class="object-category">
                      <div
                        class="category-header"
                        @click.stop="selectCategory(conn, db, 'tables')"
                        @contextmenu.prevent.stop="showContextMenu($event, 'category', { connection: conn, database: db, category: 'tables' })"
                      >
                        <svg
                          class="category-icon"
                          :class="{ expanded: expandedObjectCategories.includes(`${conn.name}_${db}_tables`) }"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          @click.stop="toggleObjectCategory(`${conn.name}_${db}_tables`)"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <svg
                          class="category-type-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                          />
                          <line
                            x1="3"
                            y1="9"
                            x2="21"
                            y2="9"
                          />
                          <line
                            x1="9"
                            y1="21"
                            x2="9"
                            y2="9"
                          />
                        </svg>
                        <span class="category-name">表</span>
                        <span class="category-count">{{ databaseObjectsMap[`${conn.name}_${db}`]?.tables?.length || 0 }}</span>
                      </div>
                      <div
                        v-show="expandedObjectCategories.includes(`${conn.name}_${db}_tables`)"
                        class="category-items"
                      >
                        <div 
                          v-for="table in databaseObjectsMap[`${conn.name}_${db}`]?.tables" 
                          :key="table" 
                          :class="['object-item', { active: selectedObject?.type === 'table' && selectedObject?.name === table }]"
                          @click="selectConnection(conn); selectDatabase(db); selectTableObject(table)"
                          @dblclick.stop="openTable({ connection: conn, database: db, table })"
                          @contextmenu.prevent.stop="showContextMenu($event, 'table', { connection: conn, database: db, table })"
                        >
                          <svg
                            class="object-icon table-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                            />
                            <line
                              x1="3"
                              y1="9"
                              x2="21"
                              y2="9"
                            />
                            <line
                              x1="9"
                              y1="21"
                              x2="9"
                              y2="9"
                            />
                          </svg>
                          <span class="object-name">{{ table }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="object-category">
                      <div
                        class="category-header"
                        @click.stop="selectCategory(conn, db, 'views')"
                        @contextmenu.prevent.stop="showContextMenu($event, 'category', { connection: conn, database: db, category: 'views' })"
                      >
                        <svg
                          class="category-icon"
                          :class="{ expanded: expandedObjectCategories.includes(`${conn.name}_${db}_views`) }"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          @click.stop="toggleObjectCategory(`${conn.name}_${db}_views`)"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <svg
                          class="category-type-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle
                            cx="12"
                            cy="12"
                            r="3"
                          />
                        </svg>
                        <span class="category-name">视图</span>
                        <span class="category-count">{{ databaseObjectsMap[`${conn.name}_${db}`]?.views?.length || 0 }}</span>
                      </div>
                      <div
                        v-show="expandedObjectCategories.includes(`${conn.name}_${db}_views`)"
                        class="category-items"
                      >
                        <div 
                          v-for="view in databaseObjectsMap[`${conn.name}_${db}`]?.views" 
                          :key="view" 
                          :class="['object-item', { active: selectedObject?.type === 'view' && selectedObject?.name === view }]"
                          @click="selectConnection(conn); selectDatabase(db); selectViewObject(view)"
                        >
                          <svg
                            class="object-icon view-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                            />
                          </svg>
                          <span class="object-name">{{ view }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="object-category">
                      <div
                        class="category-header"
                        @click.stop="selectCategory(conn, db, 'functions')"
                        @contextmenu.prevent.stop="showContextMenu($event, 'category', { connection: conn, database: db, category: 'functions' })"
                      >
                        <svg
                          class="category-icon"
                          :class="{ expanded: expandedObjectCategories.includes(`${conn.name}_${db}_functions`) }"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                          @click.stop="toggleObjectCategory(`${conn.name}_${db}_functions`)"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        <svg
                          class="category-type-icon function-icon"
                          viewBox="0 0 32 18"
                          fill="currentColor"
                          stroke="none"
                        >
                          <text
                            x="0"
                            y="14"
                            font-size="12"
                            font-style="italic"
                            font-weight="600"
                          >f</text>
                          <text
                            x="14"
                            y="17"
                            font-size="8"
                          >(x)</text>
                        </svg>
                        <span class="category-name">函数</span>
                        <span class="category-count">{{ databaseObjectsMap[`${conn.name}_${db}`]?.functions?.length || 0 }}</span>
                      </div>
                      <div
                        v-show="expandedObjectCategories.includes(`${conn.name}_${db}_functions`)"
                        class="category-items"
                      >
                        <div 
                          v-for="func in databaseObjectsMap[`${conn.name}_${db}`]?.functions" 
                          :key="func" 
                          :class="['object-item', { active: selectedObject?.type === 'function' && selectedObject?.name === func }]"
                          @click="selectConnection(conn); selectDatabase(db); selectFunctionObject(func)"
                        >
                          <svg
                            class="object-icon function-icon"
                            viewBox="0 0 32 18"
                            fill="currentColor"
                            stroke="none"
                          >
                            <text
                              x="0"
                              y="14"
                              font-size="12"
                              font-style="italic"
                              font-weight="600"
                            >f</text>
                            <text
                              x="14"
                              y="17"
                              font-size="8"
                            >(x)</text>
                          </svg>
                          <span class="object-name">{{ func }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <div
            v-if="connectionGroups.length === 0 && ungroupedConnections.length === 0"
            class="empty-list"
          >
            <p>暂无连接</p>
            <p class="hint">
              右键点击新建连接
            </p>
          </div>
        </div>
        <div
          class="sidebar-resize-handle"
          @mousedown="startSidebarResize"
        />
      </div>

      <div
        class="main-panel"
        :class="{ 'panel-wide': layoutMode === 'three' }"
      >
        <div class="connection-panel">
          <div class="panel-header">
            <div class="tabs-container">
              <div 
                v-for="tab in tabs" 
                :key="tab.id"
                :class="['tab-item', { active: activeTabId === tab.id }]"
                @click="selectTab(tab.id)"
                @contextmenu.prevent.stop="showTabContextMenu($event, tab)"
              >
                <span class="tab-name">{{ tab.name }}</span>
                <button
                  v-if="tab.closable"
                  class="tab-close-btn"
                  @click.stop="closeTab(tab.id)"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div
            v-if="activeTabId === 'object'"
            class="object-panel"
          >
            <div
              v-if="selectedObject"
              class="object-content"
            >
              <div class="object-header">
                <div class="object-title">
                  <svg
                    class="object-type-icon"
                    :class="selectedObject.type"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <template v-if="selectedObject.type === 'database'">
                      <ellipse
                        cx="12"
                        cy="5"
                        rx="9"
                        ry="3"
                      />
                      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    </template>
                    <template v-else-if="selectedObject.type === 'table'">
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="2"
                      />
                      <line
                        x1="3"
                        y1="9"
                        x2="21"
                        y2="9"
                      />
                      <line
                        x1="9"
                        y1="21"
                        x2="9"
                        y2="9"
                      />
                    </template>
                    <template v-else-if="selectedObject.type === 'view'">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                      />
                    </template>
                    <template v-else-if="selectedObject.type === 'function'">
                      <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                    </template>
                  </svg>
                  <span>{{ selectedObject.name }}</span>
                  <span class="object-type-label">{{ objectTypeLabel }}</span>
                </div>
                <div class="object-search">
                  <input 
                    v-model="objectSearchKeyword" 
                    type="text" 
                    placeholder="搜索..."
                    class="search-input"
                  >
                </div>
              </div>
              <div
                v-if="selectedObject.type === 'database'"
                class="object-tables"
              >
                <div
                  v-if="objectTableDetails.length === 0"
                  class="object-loading"
                >
                  <p>加载中...</p>
                </div>
                <div
                  v-else-if="filteredTableDetails.length === 0"
                  class="object-empty-list"
                >
                  <p>{{ objectSearchKeyword ? '没有匹配的结果' : '暂无表' }}</p>
                </div>
                <div
                  v-else
                  class="tables-list"
                >
                  <div class="tables-header">
                    <span class="col-name">名称</span>
                    <span class="col-rows">行数</span>
                    <span class="col-size">数据长度</span>
                    <span class="col-engine">引擎</span>
                    <span class="col-modified">修改日期</span>
                    <span class="col-comment">注释</span>
                  </div>
                  <div class="tables-body">
                    <div 
                      v-for="table in filteredTableDetails" 
                      :key="table.name"
                      class="table-row"
                      @click="selectTableObject(table.name)"
                    >
                      <span class="col-name">
                        <svg
                          class="table-icon-small"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                          />
                          <line
                            x1="3"
                            y1="9"
                            x2="21"
                            y2="9"
                          />
                          <line
                            x1="9"
                            y1="21"
                            x2="9"
                            y2="9"
                          />
                        </svg>
                        {{ table.name }}
                      </span>
                      <span class="col-rows">{{ table.rows }}</span>
                      <span class="col-size">{{ formatSize(table.dataSize) }}</span>
                      <span class="col-engine">{{ table.engine }}</span>
                      <span class="col-modified">{{ formatDate(table.modified) }}</span>
                      <span class="col-comment">{{ table.comment || '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else-if="selectedObject.type === 'table'"
                class="object-detail"
              >
                <div
                  v-if="tableStructure.length === 0"
                  class="object-loading"
                >
                  <p>加载中...</p>
                </div>
                <div
                  v-else
                  class="structure-list"
                >
                  <div class="structure-header">
                    <span class="col-field">字段</span>
                    <span class="col-type">类型</span>
                    <span class="col-null">允许空</span>
                    <span class="col-key">键</span>
                    <span class="col-default">默认值</span>
                    <span class="col-extra">额外</span>
                  </div>
                  <div class="structure-body">
                    <div
                      v-for="field in filteredTableStructure"
                      :key="field.Field"
                      class="structure-row"
                    >
                      <span class="col-field">{{ field.Field }}</span>
                      <span class="col-type">{{ field.Type }}</span>
                      <span class="col-null">{{ field.Null }}</span>
                      <span class="col-key">{{ field.Key || '-' }}</span>
                      <span class="col-default">{{ field.Default || '-' }}</span>
                      <span class="col-extra">{{ field.Extra || '-' }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else-if="selectedObject.type === 'view'"
                class="object-detail"
              >
                <div class="view-definition">
                  <p class="definition-label">
                    视图定义:
                  </p>
                  <pre class="definition-code">{{ viewDefinition }}</pre>
                </div>
              </div>
              <div
                v-else-if="selectedObject.type === 'function'"
                class="object-detail"
              >
                <div class="function-definition">
                  <p class="definition-label">
                    函数定义:
                  </p>
                  <pre class="definition-code">{{ functionDefinition }}</pre>
                </div>
              </div>
            </div>
          </div>

          <div
            v-else
            class="query-panel"
          >
            <div
              v-for="tab in tabs.filter(t => t.type === 'query' || t.type === 'table')"
              v-show="activeTabId === tab.id"
              :key="tab.id"
              class="query-content"
            >
              <template v-if="tab.type === 'query'">
                <div class="query-toolbar">
                  <div class="toolbar-left">
                    <div class="toolbar-select-group">
                      <svg
                        class="toolbar-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect
                          x="2"
                          y="2"
                          width="20"
                          height="8"
                          rx="2"
                          ry="2"
                        />
                        <rect
                          x="2"
                          y="14"
                          width="20"
                          height="8"
                          rx="2"
                          ry="2"
                        />
                        <line
                          x1="6"
                          y1="6"
                          x2="6.01"
                          y2="6"
                        />
                        <line
                          x1="6"
                          y1="18"
                          x2="6.01"
                          y2="18"
                        />
                      </svg>
                      <select 
                        v-model="tab.connectionName" 
                        class="toolbar-select"
                        @change="onTabConnectionChange(tab)"
                      >
                        <option value="" />
                        <option
                          v-for="conn in connections"
                          :key="conn.name"
                          :value="conn.name"
                        >
                          {{ conn.name }}
                        </option>
                      </select>
                    </div>
                    <div class="toolbar-select-group">
                      <svg
                        class="toolbar-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <ellipse
                          cx="12"
                          cy="5"
                          rx="9"
                          ry="3"
                        />
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                      </svg>
                      <select 
                        v-model="tab.database" 
                        class="toolbar-select"
                        @change="onTabDatabaseChange(tab)"
                      >
                        <option value="" />
                        <option
                          v-for="db in getTabDatabases(tab)"
                          :key="db"
                          :value="db"
                        >
                          {{ db }}
                        </option>
                      </select>
                    </div>
                    <button 
                      class="btn-small btn-icon-text" 
                      :disabled="!tab.sqlQuery || tab.executing" 
                      title="运行"
                      @click="executeQueryForTab(tab)"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      运行
                    </button>
                    <button 
                      class="btn-small btn-secondary btn-icon-text" 
                      :disabled="!tab.executing"
                      title="停止"
                      @click="stopQueryForTab(tab)"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <rect
                          x="6"
                          y="6"
                          width="12"
                          height="12"
                        />
                      </svg>
                      停止
                    </button>
                  </div>
                  <div class="toolbar-right">
                    <button 
                      class="btn-small btn-secondary btn-icon-text" 
                      :disabled="!tab.sqlQuery"
                      @click="formatSqlForTab(tab)"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <line
                          x1="21"
                          y1="10"
                          x2="3"
                          y2="10"
                        />
                        <line
                          x1="21"
                          y1="6"
                          x2="3"
                          y2="6"
                        />
                        <line
                          x1="21"
                          y1="14"
                          x2="3"
                          y2="14"
                        />
                        <line
                          x1="21"
                          y1="18"
                          x2="3"
                          y2="18"
                        />
                      </svg>
                      美化
                    </button>
                    <button
                      class="btn-small btn-secondary btn-icon-text"
                      @click="clearQueryForTab(tab)"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      清空
                    </button>
                  </div>
                </div>
                <div
                  class="query-body"
                  :class="{ 'has-result': tab.queryResult }"
                >
                  <div
                    class="query-editor-wrapper"
                    :style="{ flex: tab.queryResult ? '0 0 50%' : '1' }"
                  >
                    <SqlEditor
                      :ref="el => { if (el) tab.editorRef = el }"
                      v-model="tab.sqlQuery"
                      :tables="getTabTables(tab)"
                      :databases="getTabDatabases(tab)"
                      :placeholder="getTabPlaceholder(tab)"
                    />
                  </div>

                  <div
                    v-if="tab.queryResult"
                    class="query-result-wrapper"
                  >
                    <div class="query-result">
                      <div class="result-header">
                        <div
                          v-if="tab.queryResults && tab.queryResults.length > 1"
                          class="result-tabs"
                        >
                          <div
                            v-for="result in tab.queryResults"
                            :key="result.index"
                            :class="['result-tab', { active: tab.activeResultIndex === result.index }]"
                            @click="switchResultTab(tab, result.index)"
                          >
                            {{ result.name }}
                          </div>
                        </div>
                        <span
                          v-else
                          class="result-title"
                        >查询结果</span>
                        <span class="result-info">
                          {{ tab.queryResult.success ? `成功 - 耗时: ${tab.queryResult.duration}ms` : '失败' }}
                        </span>
                      </div>
                      <div
                        v-if="tab.queryResult.success"
                        class="result-content"
                      >
                        <div
                          v-if="tab.queryResult.rows && tab.queryResult.rows.length > 0"
                          class="result-table-wrapper"
                        >
                          <div class="result-table-scroll">
                            <table class="result-table">
                              <thead>
                                <tr>
                                  <th
                                    v-for="field in tab.queryResult.fields"
                                    :key="field.name"
                                    class="auto-width"
                                  >
                                    {{ field.name }}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr
                                  v-for="(row, index) in tab.queryResult.rows"
                                  :key="index"
                                >
                                  <td
                                    v-for="field in tab.queryResult.fields"
                                    :key="field.name"
                                  >
                                    {{ formatCellValue(row[field.name]) }}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div
                          v-else
                          class="result-empty"
                        >
                          {{ tab.queryResult.rowCount }} 行受影响
                        </div>
                      </div>
                      <div
                        v-else
                        class="result-error"
                      >
                        {{ tab.queryResult.error }}
                      </div>
                    </div>
                    <div class="result-footer">
                      <div class="footer-left">
                        <span
                          v-if="tab.queryResult.success && tab.queryResult.rows"
                          class="result-stats"
                        >
                          {{ tab.queryResult.totalRows || tab.queryResult.rows.length }} 行
                        </span>
                        <div
                          v-if="tab.queryResult.success && tab.queryResult.isSelect && tab.queryResult.rows && tab.queryResult.rows.length > 0"
                          class="footer-pagination"
                        >
                          <button 
                            class="pagination-btn" 
                            :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage <= 1"
                            title="首页"
                            @click="firstPage(tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
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
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
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
                          >
                          <span class="pagination-separator">/</span>
                          <span class="pagination-total">{{ tab.queryResult.totalPages || 1 }}</span>
                          <button 
                            class="pagination-btn" 
                            :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
                            title="下一页"
                            @click="nextPage(tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                          <button 
                            class="pagination-btn" 
                            :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
                            title="末页"
                            @click="lastPage(tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="13 17 18 12 13 7" />
                              <polyline points="6 17 11 12 6 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="footer-right">
                        <div
                          v-if="limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id"
                          class="footer-settings-panel"
                        >
                          <label class="settings-checkbox">
                            <input
                              v-model="autoLimit"
                              type="checkbox"
                            >
                            <span>限制记录</span>
                          </label>
                          <div
                            v-if="autoLimit"
                            class="settings-limit-input"
                          >
                            <input 
                              v-model.number="limitCount" 
                              type="number" 
                              class="limit-input"
                              min="1"
                              max="100000"
                            >
                            <span class="limit-label">条记录（每页）</span>
                          </div>
                        </div>
                        <div
                          :class="['footer-settings', { active: limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id }]"
                          title="设置"
                          @click="toggleLimitSettingsDialog(tab)"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                            />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <template v-else-if="tab.type === 'table'">
                <div class="query-toolbar table-query-toolbar">
                  <button 
                    class="toolbar-btn"
                    :class="{ active: tableToolbarState.filterSortActive }"
                    :disabled="tab.executing"
                    title="筛选和排序"
                    @click="toggleFilterSort"
                  >
                    <svg
                      class="toolbar-btn-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polygon points="22 3 2 3 10 12.46 10 19 14 17 14 12.46 22 3" />
                    </svg>
                    <span class="toolbar-btn-text">筛选排序</span>
                  </button>
                  <button 
                    class="toolbar-btn"
                    :disabled="tab.executing"
                    title="刷新"
                    @click="executeTableQuery(tab)"
                  >
                    <svg
                      class="toolbar-btn-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    <span class="toolbar-btn-text">刷新</span>
                  </button>
                  <button 
                    class="toolbar-btn"
                    title="导入"
                    @click="importData()"
                  >
                    <svg
                      class="toolbar-btn-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line
                        x1="12"
                        y1="3"
                        x2="12"
                        y2="15"
                      />
                    </svg>
                    <span class="toolbar-btn-text">导入</span>
                  </button>
                  <button 
                    class="toolbar-btn"
                    title="导出"
                    @click="exportData()"
                  >
                    <svg
                      class="toolbar-btn-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line
                        x1="12"
                        y1="15"
                        x2="12"
                        y2="3"
                      />
                    </svg>
                    <span class="toolbar-btn-text">导出</span>
                  </button>
                </div>
                <div class="query-body table-query-body">
                  <div class="query-result-wrapper full-height">
                    <div class="query-result">
                      <div
                        v-if="tab.executing"
                        class="result-loading"
                      >
                        <div class="loading-spinner" />
                        <span>正在查询...</span>
                      </div>
                      <div
                        v-else-if="tab.queryResult"
                        class="result-content"
                      >
                        <div
                          v-if="tab.queryResult.success"
                          class="result-body"
                        >
                          <div
                            v-if="tab.queryResult.fields && tab.queryResult.fields.length > 0"
                            class="result-table-wrapper"
                          >
                            <div class="result-table-scroll">
                              <table class="result-table">
                                <thead>
                                  <tr>
                                    <th
                                      v-for="fieldName in (tab.fieldOrder || tab.queryResult.fields.map(f => f.name))"
                                      :key="fieldName"
                                      :class="['auto-width', { 'has-sort': tab.sortField === fieldName, 'sort-asc': tab.sortField === fieldName && tab.sortDirection === 'asc', 'sort-desc': tab.sortField === fieldName && tab.sortDirection === 'desc' }]"
                                      draggable="true"
                                      @dragstart="onFieldDragStart($event, tab, fieldName)"
                                      @dragover.prevent="onFieldDragOver($event)"
                                      @drop.prevent="onFieldDrop($event, tab, fieldName)"
                                    >
                                      <div class="th-content">
                                        <span class="th-name">{{ fieldName }}</span>
                                        <div 
                                          class="th-actions"
                                          @click.stop="showFieldSortMenu($event, tab, fieldName)"
                                        >
                                          <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                          >
                                            <circle
                                              cx="12"
                                              cy="12"
                                              r="1"
                                            />
                                            <circle
                                              cx="12"
                                              cy="5"
                                              r="1"
                                            />
                                            <circle
                                              cx="12"
                                              cy="19"
                                              r="1"
                                            />
                                          </svg>
                                        </div>
                                      </div>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody v-if="tab.queryResult.rows && tab.queryResult.rows.length > 0">
                                  <tr
                                    v-for="(row, index) in tab.queryResult.rows"
                                    :key="index"
                                  >
                                    <td
                                      v-for="fieldName in (tab.fieldOrder || tab.queryResult.fields.map(f => f.name))"
                                      :key="fieldName"
                                    >
                                      {{ formatCellValue(row[fieldName]) }}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                          <div
                            v-else
                            class="result-empty"
                          >
                            表无数据
                          </div>
                        </div>
                        <div
                          v-else
                          class="result-error"
                        >
                          {{ tab.queryResult.error }}
                        </div>
                      </div>
                      <div
                        v-else
                        class="result-empty"
                      >
                        点击刷新加载表数据
                      </div>
                    </div>
                    <div class="result-footer">
                      <div class="footer-left">
                        <span
                          v-if="tab.queryResult && tab.queryResult.success && tab.queryResult.rows"
                          class="result-stats"
                        >
                          {{ tab.queryResult.totalRows || tab.queryResult.rows.length }} 行
                        </span>
                        <div
                          v-if="tab.queryResult && tab.queryResult.success && tab.queryResult.rows && tab.queryResult.rows.length > 0"
                          class="footer-pagination"
                        >
                          <button 
                            class="pagination-btn" 
                            :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage <= 1"
                            title="首页"
                            @click="firstPage(tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
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
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
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
                          >
                          <span class="pagination-separator">/</span>
                          <span class="pagination-total">{{ tab.queryResult.totalPages || 1 }}</span>
                          <button 
                            class="pagination-btn" 
                            :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
                            title="下一页"
                            @click="nextPage(tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                          <button 
                            class="pagination-btn" 
                            :disabled="!tab.queryResult.currentPage || tab.queryResult.currentPage >= (tab.queryResult.totalPages || 1)"
                            title="末页"
                            @click="lastPage(tab)"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <polyline points="13 17 18 12 13 7" />
                              <polyline points="6 17 11 12 6 7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      <div class="footer-right">
                        <div
                          v-if="limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id"
                          class="footer-settings-panel"
                        >
                          <label class="settings-checkbox">
                            <input
                              v-model="autoLimit"
                              type="checkbox"
                            >
                            <span>限制记录</span>
                          </label>
                          <div
                            v-if="autoLimit"
                            class="settings-limit-input"
                          >
                            <input 
                              v-model.number="limitCount" 
                              type="number" 
                              class="limit-input"
                              min="1"
                              max="100000"
                            >
                            <span class="limit-label">条记录（每页）</span>
                          </div>
                        </div>
                        <div
                          :class="['footer-settings', { active: limitSettingsDialog.show && limitSettingsDialog.tabId === tab.id }]"
                          title="设置"
                          @click="toggleLimitSettingsDialog(tab)"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <circle
                              cx="12"
                              cy="12"
                              r="3"
                            />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="layoutMode === 'three'"
        class="info-panel"
        :style="{ width: infoPanelWidth + 'px' }"
      >
        <div
          class="info-panel-resize-handle"
          @mousedown="startInfoPanelResize"
        />
        <div class="info-panel-toolbar">
          <button
            :class="['info-tab-btn', { active: tableInfoMode === 'info' }]"
            title="信息"
            @click="tableInfoMode = 'info'"
          >
            <svg
              class="info-tab-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <line
                x1="12"
                y1="16"
                x2="12"
                y2="12"
              />
              <line
                x1="12"
                y1="8"
                x2="12.01"
                y2="8"
              />
            </svg>
          </button>
          <button
            v-if="selectedInfoType === 'table'"
            :class="['info-tab-btn', { active: tableInfoMode === 'ddl' }]"
            title="DDL"
            @click="tableInfoMode = 'ddl'"
          >
            <svg
              class="info-tab-icon ddl-icon"
              viewBox="0 0 32 16"
              fill="currentColor"
              stroke="none"
            >
              <text
                x="0"
                y="13"
                font-size="12"
                font-weight="600"
                font-family="Arial, sans-serif"
              >DDL</text>
            </svg>
          </button>
        </div>
        
        <div
          v-if="selectedInfoType"
          class="info-header"
        >
          <div class="info-header-icon">
            <svg
              v-if="selectedInfoType === 'group'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <svg
              v-else-if="selectedInfoType === 'connection'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="8"
                rx="2"
                ry="2"
              />
              <rect
                x="2"
                y="14"
                width="20"
                height="8"
                rx="2"
                ry="2"
              />
              <line
                x1="6"
                y1="6"
                x2="6.01"
                y2="6"
              />
              <line
                x1="6"
                y1="18"
                x2="6.01"
                y2="18"
              />
            </svg>
            <svg
              v-else-if="selectedInfoType === 'database'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <ellipse
                cx="12"
                cy="5"
                rx="9"
                ry="3"
              />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            <svg
              v-else-if="selectedInfoType === 'table'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
              />
              <line
                x1="3"
                y1="9"
                x2="21"
                y2="9"
              />
              <line
                x1="9"
                y1="21"
                x2="9"
                y2="9"
              />
            </svg>
            <svg
              v-else-if="selectedInfoType === 'category'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
              />
              <line
                x1="3"
                y1="9"
                x2="21"
                y2="9"
              />
              <line
                x1="9"
                y1="21"
                x2="9"
                y2="9"
              />
            </svg>
          </div>
          <div class="info-header-text">
            <span class="info-header-name">{{ getInfoHeaderName() }}</span>
            <span class="info-header-desc">{{ getInfoHeaderDesc() }}</span>
          </div>
        </div>
        
        <div class="info-panel-content">
          <div
            v-if="!selectedInfoType"
            class="info-empty"
          >
            <p>请选择对象查看信息</p>
          </div>
          
          <div
            v-else-if="selectedInfoType === 'group'"
            class="info-content"
          >
            <div class="info-item">
              <span class="info-label">连接数量</span>
              <span class="info-value">{{ selectedGroup?.connections?.length || 0 }}</span>
            </div>
          </div>
          
          <div
            v-else-if="selectedInfoType === 'connection'"
            class="info-content"
          >
            <div class="info-item">
              <span class="info-label">主机</span>
              <span class="info-value">{{ selectedConnection?.host }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">端口</span>
              <span class="info-value">{{ selectedConnection?.port }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ selectedConnection?.user }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">状态</span>
              <span :class="['info-value', selectedConnection?.active ? 'connected' : 'disconnected']">
                {{ selectedConnection?.active ? '已连接' : '未连接' }}
              </span>
            </div>
            <div
              v-if="connectionInfo"
              class="info-item"
            >
              <span class="info-label">服务器版本</span>
              <span class="info-value">{{ connectionInfo.version }}</span>
            </div>
            <div
              v-if="connectionInfo"
              class="info-item"
            >
              <span class="info-label">字符集</span>
              <span class="info-value">{{ connectionInfo.charset }}</span>
            </div>
            <div
              v-if="connectionInfo"
              class="info-item"
            >
              <span class="info-label">排序规则</span>
              <span class="info-value">{{ connectionInfo.collation }}</span>
            </div>
          </div>
          
          <div
            v-else-if="selectedInfoType === 'database'"
            class="info-content"
          >
            <div class="info-item">
              <span class="info-label">连接</span>
              <span class="info-value">{{ selectedConnection?.name }}</span>
            </div>
            <div
              v-if="databaseInfo"
              class="info-item"
            >
              <span class="info-label">字符集</span>
              <span class="info-value">{{ databaseInfo.charset }}</span>
            </div>
            <div
              v-if="databaseInfo"
              class="info-item"
            >
              <span class="info-label">排序规则</span>
              <span class="info-value">{{ databaseInfo.collation }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">表数量</span>
              <span class="info-value">{{ objectTableDetails?.length || 0 }}</span>
            </div>
          </div>
          
          <div
            v-else-if="selectedInfoType === 'category'"
            class="info-content info-category-list"
          >
            <div
              v-for="item in getCategoryList()"
              :key="item"
              class="info-category-item"
              @click="handleCategoryItemClick(item)"
            >
              <svg
                v-if="selectedCategory?.type === 'tables'"
                class="category-item-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                />
                <line
                  x1="3"
                  y1="9"
                  x2="21"
                  y2="9"
                />
                <line
                  x1="9"
                  y1="21"
                  x2="9"
                  y2="9"
                />
              </svg>
              <svg
                v-else-if="selectedCategory?.type === 'views'"
                class="category-item-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                />
              </svg>
              <svg
                v-else-if="selectedCategory?.type === 'functions'"
                class="category-item-icon function-icon"
                viewBox="0 0 32 18"
                fill="currentColor"
                stroke="none"
              >
                <text
                  x="0"
                  y="14"
                  font-size="12"
                  font-style="italic"
                  font-weight="600"
                >f</text>
                <text
                  x="14"
                  y="17"
                  font-size="8"
                >(x)</text>
              </svg>
              <span class="category-item-name">{{ item }}</span>
            </div>
          </div>
          
          <div
            v-else-if="selectedInfoType === 'table' && tableInfoMode === 'info'"
            class="info-content"
          >
            <div class="info-item">
              <span class="info-label">连接</span>
              <span class="info-value">{{ selectedObject?.connectionName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">数据库</span>
              <span class="info-value">{{ selectedObject?.database }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">行数</span>
              <span class="info-value">{{ tableInfo?.TABLE_ROWS ?? '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">引擎</span>
              <span class="info-value">{{ tableInfo?.ENGINE ?? '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">自动递增</span>
              <span class="info-value">{{ tableInfo?.AUTO_INCREMENT ?? '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">行格式</span>
              <span class="info-value">{{ tableInfo?.ROW_FORMAT ?? '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">数据长度</span>
              <span class="info-value">{{ formatSize(tableInfo?.DATA_LENGTH) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">索引长度</span>
              <span class="info-value">{{ formatSize(tableInfo?.INDEX_LENGTH) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">最大数据长度</span>
              <span class="info-value">{{ formatSize(tableInfo?.MAX_DATA_LENGTH) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">数据可用空间</span>
              <span class="info-value">{{ formatSize(tableInfo?.DATA_FREE) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">创建日期</span>
              <span class="info-value">{{ formatDate(tableInfo?.CREATE_TIME) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">修改日期</span>
              <span class="info-value">{{ formatDate(tableInfo?.UPDATE_TIME) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">检查时间</span>
              <span class="info-value">{{ formatDate(tableInfo?.CHECK_TIME) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">排序规则</span>
              <span class="info-value">{{ tableInfo?.TABLE_COLLATION ?? '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">创建选项</span>
              <span class="info-value">{{ tableInfo?.CREATE_OPTIONS ?? '--' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">注释</span>
              <span class="info-value">{{ tableInfo?.TABLE_COMMENT ?? '--' }}</span>
            </div>
          </div>
          
          <div
            v-else-if="selectedInfoType === 'table' && tableInfoMode === 'ddl'"
            class="info-content info-ddl-content"
          >
            <pre
              class="info-ddl"
              v-html="highlightSql(tableDDL || '加载中...')"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <div class="status-left">
        <template v-if="selectedConnection">
          <span class="status-item">
            <svg
              class="status-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <ellipse
                cx="12"
                cy="5"
                rx="9"
                ry="3"
              />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            {{ selectedConnection.name }}
          </span>
          <span class="status-divider">|</span>
          <span :class="['status-item', selectedConnection.active ? 'connected' : 'disconnected']">
            {{ selectedConnection.active ? '已连接' : '未连接' }}
          </span>
        </template>
        <template v-else>
          <span class="status-item">
            <svg
              class="status-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <ellipse
                cx="12"
                cy="5"
                rx="9"
                ry="3"
              />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
            共 {{ connections.length }} 个连接
          </span>
        </template>
        <template v-if="lastExecutedSql">
          <span class="status-divider">|</span>
          <span
            class="sql-preview"
            :title="lastExecutedSql"
          >{{ truncateSql(lastExecutedSql) }}</span>
          <button
            class="copy-btn"
            title="复制SQL"
            @click="copyLastSql"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect
                x="9"
                y="9"
                width="13"
                height="13"
                rx="2"
                ry="2"
              />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          <span class="sql-time">{{ lastExecutedTime }}ms</span>
        </template>
      </div>
      <div class="status-right">
        <button 
          :class="['layout-btn', { active: layoutMode === 'two' }]" 
          title="双栏布局" 
          @click="layoutMode = 'two'"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect
              x="3"
              y="3"
              width="8"
              height="18"
              rx="2"
            />
            <rect
              x="13"
              y="3"
              width="8"
              height="18"
              rx="2"
            />
          </svg>
        </button>
        <button 
          :class="['layout-btn', { active: layoutMode === 'three' }]" 
          title="三栏布局" 
          @click="layoutMode = 'three'"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect
              x="2"
              y="3"
              width="6"
              height="18"
              rx="1"
            />
            <rect
              x="9"
              y="3"
              width="6"
              height="18"
              rx="1"
            />
            <rect
              x="16"
              y="3"
              width="6"
              height="18"
              rx="1"
            />
          </svg>
        </button>
      </div>
    </div>

    <div
      v-if="showCreateDialog"
      class="dialog-overlay"
      @click.self="closeCreateDialog"
    >
      <div class="dialog">
        <div class="dialog-header">
          <h3>新建连接</h3>
          <button
            class="close-btn"
            @click="closeCreateDialog"
          >
            ×
          </button>
        </div>
        <div class="dialog-tabs">
          <div
            :class="['dialog-tab', { active: createDialogTab === 'basic' }]"
            @click="createDialogTab = 'basic'"
          >
            常规
          </div>
          <div
            :class="['dialog-tab', { active: createDialogTab === 'advanced' }]"
            @click="createDialogTab = 'advanced'"
          >
            高级
          </div>
        </div>
        <div class="dialog-content">
          <template v-if="createDialogTab === 'basic'">
            <div class="form-inline-group">
              <label class="form-label-inline">连接名称</label>
              <input
                v-model="newConnection.name"
                type="text"
                class="input-field-inline"
                placeholder="连接名称"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">主机地址</label>
              <input
                v-model="newConnection.host"
                type="text"
                class="input-field-inline"
                placeholder="localhost"
                @blur="onHostBlur"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">端口</label>
              <input
                v-model="newConnection.port"
                type="number"
                class="input-field-inline input-port"
                placeholder="3306"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">用户名</label>
              <input
                v-model="newConnection.user"
                type="text"
                class="input-field-inline input-username"
                placeholder="root"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">密码</label>
              <input
                v-model="newConnection.password"
                type="password"
                class="input-field-inline input-password"
                placeholder="密码"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="newConnection.savePassword"
                  type="checkbox"
                >
                <span>保存密码</span>
              </label>
            </div>
          </template>
          <template v-if="createDialogTab === 'advanced'">
            <div class="form-inline-group">
              <label class="form-label-inline">客户端字符集</label>
              <select
                v-model="newConnection.charset"
                class="input-field-inline"
              >
                <option value="">
                  自动
                </option>
                <option value="utf8mb4">
                  utf8mb4
                </option>
                <option value="utf8">
                  utf8
                </option>
                <option value="latin1">
                  latin1
                </option>
                <option value="gbk">
                  gbk
                </option>
                <option value="gb2312">
                  gb2312
                </option>
              </select>
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="newConnection.enableKeepAlive"
                  type="checkbox"
                >
                <span>保持连接间隔（秒）</span>
              </label>
              <input
                v-model="newConnection.keepAliveInterval"
                type="number"
                class="input-field-inline"
                :disabled="!newConnection.enableKeepAlive"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="newConnection.enableConnectTimeout"
                  type="checkbox"
                >
                <span>连接超时（秒）</span>
              </label>
              <input
                v-model="newConnection.connectTimeout"
                type="number"
                class="input-field-inline"
                :disabled="!newConnection.enableConnectTimeout"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="newConnection.enableReadTimeout"
                  type="checkbox"
                >
                <span>读取超时（秒）</span>
              </label>
              <input
                v-model="newConnection.readTimeout"
                type="number"
                class="input-field-inline"
                :disabled="!newConnection.enableReadTimeout"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="newConnection.enableWriteTimeout"
                  type="checkbox"
                >
                <span>写入超时（秒）</span>
              </label>
              <input
                v-model="newConnection.writeTimeout"
                type="number"
                class="input-field-inline"
                :disabled="!newConnection.enableWriteTimeout"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="newConnection.autoConnect"
                  type="checkbox"
                >
                <span>自动连接</span>
              </label>
            </div>
          </template>
        </div>
        <div class="dialog-footer">
          <button
            class="btn-small btn-secondary"
            :disabled="testingNewConn"
            @click="closeCreateDialog"
          >
            取消
          </button>
          <button
            class="btn-small"
            :disabled="testingNewConn"
            @click="testNewConnection"
          >
            {{ testingNewConn ? '测试中...' : '测试连接' }}
          </button>
          <button
            class="btn-small"
            :disabled="testingNewConn"
            @click="saveConnection"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showEditDialog"
      class="dialog-overlay"
      @click.self="closeEditDialog"
    >
      <div class="dialog">
        <div class="dialog-header">
          <h3>编辑连接</h3>
          <button
            class="close-btn"
            @click="closeEditDialog"
          >
            ×
          </button>
        </div>
        <div class="dialog-tabs">
          <div
            :class="['dialog-tab', { active: editDialogTab === 'basic' }]"
            @click="editDialogTab = 'basic'"
          >
            常规
          </div>
          <div
            :class="['dialog-tab', { active: editDialogTab === 'advanced' }]"
            @click="editDialogTab = 'advanced'"
          >
            高级
          </div>
        </div>
        <div class="dialog-content">
          <template v-if="editDialogTab === 'basic'">
            <div class="form-inline-group">
              <label class="form-label-inline">连接名称</label>
              <input
                v-model="editingConnection.name"
                type="text"
                class="input-field-inline"
                placeholder="连接名称"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">所属分组</label>
              <select
                v-model="editingConnection.group"
                class="input-field-inline"
              >
                <option value="">
                  不分组
                </option>
                <option
                  v-for="g in groups"
                  :key="g"
                  :value="g"
                >
                  {{ g }}
                </option>
              </select>
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">主机地址</label>
              <input
                v-model="editingConnection.host"
                type="text"
                class="input-field-inline"
                placeholder="localhost"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">端口</label>
              <input
                v-model="editingConnection.port"
                type="number"
                class="input-field-inline input-port"
                placeholder="3306"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">用户名</label>
              <input
                v-model="editingConnection.user"
                type="text"
                class="input-field-inline input-username"
                placeholder="root"
              >
            </div>
            <div class="form-inline-group">
              <label class="form-label-inline">密码</label>
              <input
                v-model="editingConnection.password"
                type="password"
                class="input-field-inline input-password"
                placeholder="密码"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="editingConnection.savePassword"
                  type="checkbox"
                >
                <span>保存密码</span>
              </label>
            </div>
          </template>
          <template v-if="editDialogTab === 'advanced'">
            <div class="form-inline-group">
              <label class="form-label-inline">客户端字符集</label>
              <select
                v-model="editingConnection.charset"
                class="input-field-inline"
              >
                <option value="">
                  自动
                </option>
                <option value="utf8mb4">
                  utf8mb4
                </option>
                <option value="utf8">
                  utf8
                </option>
                <option value="latin1">
                  latin1
                </option>
                <option value="gbk">
                  gbk
                </option>
                <option value="gb2312">
                  gb2312
                </option>
              </select>
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="editingConnection.enableKeepAlive"
                  type="checkbox"
                >
                <span>保持连接间隔（秒）</span>
              </label>
              <input
                v-model="editingConnection.keepAliveInterval"
                type="number"
                class="input-field-inline"
                :disabled="!editingConnection.enableKeepAlive"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="editingConnection.enableConnectTimeout"
                  type="checkbox"
                >
                <span>连接超时（秒）</span>
              </label>
              <input
                v-model="editingConnection.connectTimeout"
                type="number"
                class="input-field-inline"
                :disabled="!editingConnection.enableConnectTimeout"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="editingConnection.enableReadTimeout"
                  type="checkbox"
                >
                <span>读取超时（秒）</span>
              </label>
              <input
                v-model="editingConnection.readTimeout"
                type="number"
                class="input-field-inline"
                :disabled="!editingConnection.enableReadTimeout"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="editingConnection.enableWriteTimeout"
                  type="checkbox"
                >
                <span>写入超时（秒）</span>
              </label>
              <input
                v-model="editingConnection.writeTimeout"
                type="number"
                class="input-field-inline"
                :disabled="!editingConnection.enableWriteTimeout"
              >
            </div>
            <div class="form-inline-group">
              <label class="checkbox-label-inline">
                <input
                  v-model="editingConnection.autoConnect"
                  type="checkbox"
                >
                <span>自动连接</span>
              </label>
            </div>
          </template>
        </div>
        <div class="dialog-footer">
          <button
            class="btn-small btn-secondary"
            @click="closeEditDialog"
          >
            取消
          </button>
          <button
            class="btn-small"
            @click="updateConnection"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showGroupDialog"
      class="dialog-overlay"
      @click.self="closeGroupDialog"
    >
      <div class="dialog">
        <div class="dialog-header">
          <h3>{{ editingGroup ? '编辑分组' : '新建分组' }}</h3>
          <button
            class="close-btn"
            @click="closeGroupDialog"
          >
            ×
          </button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <label>分组名称</label>
            <input
              v-model="newGroupName"
              type="text"
              class="input-field"
              placeholder="分组名称"
            >
          </div>
        </div>
        <div class="dialog-footer">
          <button
            class="btn-small btn-secondary"
            @click="closeGroupDialog"
          >
            取消
          </button>
          <button
            class="btn-small"
            @click="saveGroup"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="showManageDialog"
      class="dialog-overlay"
      @click.self="closeManageDialog"
    >
      <div class="dialog dialog-large">
        <div class="dialog-header">
          <h3>连接管理</h3>
          <button
            class="close-btn"
            @click="closeManageDialog"
          >
            ×
          </button>
        </div>
        <div class="dialog-content manage-content">
          <div class="manage-list">
            <div class="manage-header">
              <span>分组管理</span>
              <button
                class="btn-small"
                @click="openNewGroupDialog"
              >
                新建分组
              </button>
            </div>
            <div class="manage-groups">
              <div
                v-for="group in connectionGroups"
                :key="group.name"
                class="manage-group-item"
              >
                <span>{{ group.name }} ({{ group.connections.length }}个连接)</span>
                <div class="manage-group-actions">
                  <button
                    class="btn-icon-sm"
                    title="编辑"
                    @click="editGroup(group)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    class="btn-icon-sm btn-danger"
                    title="删除"
                    @click="deleteGroup(group.name)"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
              <div
                v-if="connectionGroups.length === 0"
                class="manage-empty"
              >
                暂无分组
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div 
      v-if="contextMenu.show" 
      class="context-menu" 
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <template v-if="contextMenu.type === 'header'">
        <div
          class="menu-item"
          @click="newConnection.group = ''; showCreateDialog = true; hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          /><line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          /></svg>
          新建连接
        </div>
        <div
          class="menu-item"
          @click="openManageDialog(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><circle
            cx="12"
            cy="12"
            r="3"
          /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          连接管理
        </div>
        <div
          class="menu-item"
          @click="closeAllConnections(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
            x1="12"
            y1="2"
            x2="12"
            y2="12"
          /></svg>
          关闭所有连接
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="openNewGroupDialog(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line
            x1="12"
            y1="11"
            x2="12"
            y2="17"
          /><line
            x1="9"
            y1="14"
            x2="15"
            y2="14"
          /></svg>
          新建分组
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="loadConnections(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          刷新
        </div>
      </template>
      <template v-if="contextMenu.type === 'connection'">
        <div
          v-if="!contextMenu.target.active"
          class="menu-item"
          @click="selectConnection(contextMenu.target); connectToDatabase(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
            x1="12"
            y1="2"
            x2="12"
            y2="12"
          /></svg>
          连接
        </div>
        <div
          v-if="contextMenu.target.active"
          class="menu-item"
          @click="selectConnection(contextMenu.target); disconnectFromDatabase(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
            x1="12"
            y1="2"
            x2="12"
            y2="12"
          /></svg>
          断开连接
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="newConnection.group = contextMenu.target.group || ''; showCreateDialog = true; hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          /><line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          /></svg>
          新建连接
        </div>
        <div
          class="menu-item"
          @click="openNewQuery(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line
            x1="16"
            y1="13"
            x2="8"
            y2="13"
          /><line
            x1="16"
            y1="17"
            x2="8"
            y2="17"
          /></svg>
          新建查询
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="editConnection(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          编辑连接
        </div>
        <div
          class="menu-item"
          @click="duplicateConnection(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><rect
            x="9"
            y="9"
            width="13"
            height="13"
            rx="2"
            ry="2"
          /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          复制连接
        </div>
        <div
          class="menu-item danger"
          @click="selectConnection(contextMenu.target); deleteConnection(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          删除连接
        </div>
        <div class="menu-divider" />
        <div class="menu-item has-submenu">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><circle
            cx="12"
            cy="12"
            r="3"
          /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          管理组
          <svg
            class="submenu-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="9 18 15 12 9 6" /></svg>
          <div class="submenu">
            <div
              class="menu-item"
              @click.stop="openNewGroupDialog(); hideContextMenu()"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              ><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line
                x1="12"
                y1="11"
                x2="12"
                y2="17"
              /><line
                x1="9"
                y1="14"
                x2="15"
                y2="14"
              /></svg>
              新建组
            </div>
            <div class="menu-divider" />
            <div
              class="menu-item"
              :class="{ disabled: !contextMenu.target.group }"
              @click.stop="contextMenu.target.group && removeFromGroup(contextMenu.target); hideContextMenu()"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              ><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg>
              从组中删除
            </div>
            <div class="menu-divider" />
            <div class="submenu-header">
              移动到
            </div>
            <div 
              v-for="g in groups" 
              :key="g" 
              :class="['menu-item', { disabled: g === contextMenu.target.group }]" 
              @click.stop="g !== contextMenu.target.group && moveToGroup(contextMenu.target, g); hideContextMenu()"
            >
              {{ g }}
            </div>
            <div
              v-if="groups.length === 0"
              class="menu-item disabled"
            >
              暂无分组
            </div>
          </div>
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="loadConnections(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          刷新
        </div>
      </template>
      <template v-if="contextMenu.type === 'group'">
        <div
          class="menu-item"
          @click="newConnection.group = contextMenu.target.name; showCreateDialog = true; hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
          /><line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          /></svg>
          新建连接
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="editGroup(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          编辑分组
        </div>
        <div
          class="menu-item danger"
          @click="deleteGroup(contextMenu.target.name); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          删除分组
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="loadConnections(); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          刷新
        </div>
      </template>
      <template v-if="contextMenu.type === 'database'">
        <div
          v-if="!openedDatabases.includes(`${contextMenu.target.connection.name}_${contextMenu.target.database}`)"
          class="menu-item"
          @click="openDatabase(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><ellipse
            cx="12"
            cy="5"
            rx="9"
            ry="3"
          /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
          打开数据库
        </div>
        <div
          v-if="openedDatabases.includes(`${contextMenu.target.connection.name}_${contextMenu.target.database}`)"
          class="menu-item"
          @click="closeDatabase(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><line
            x1="12"
            y1="2"
            x2="12"
            y2="12"
          /></svg>
          关闭数据库
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="editDatabase(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          编辑数据库
        </div>
        <div
          class="menu-item danger"
          @click="deleteDatabase(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          删除数据库
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="newQueryForDatabase(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line
            x1="16"
            y1="13"
            x2="8"
            y2="13"
          /><line
            x1="16"
            y1="17"
            x2="8"
            y2="17"
          /></svg>
          新建查询
        </div>
        <div
          class="menu-item"
          @click="runSqlFile(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="10 12 8 12 8 16" /><polyline points="16 12 14 12 14 16" /></svg>
          运行SQL文件
        </div>
        <div class="menu-item has-submenu">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line
            x1="12"
            y1="15"
            x2="12"
            y2="3"
          /></svg>
          转存储SQL文件
          <svg
            class="submenu-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="9 18 15 12 9 6" /></svg>
          <div class="submenu">
            <div
              class="menu-item"
              @click.stop="dumpDatabase(contextMenu.target, 'structure'); hideContextMenu()"
            >
              结构和数据
            </div>
            <div
              class="menu-item"
              @click.stop="dumpDatabase(contextMenu.target, 'data'); hideContextMenu()"
            >
              仅数据
            </div>
          </div>
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="refreshDatabase(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          刷新
        </div>
      </template>
      <template v-if="contextMenu.type === 'category'">
        <div
          class="menu-item"
          @click="refreshCategory(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          刷新{{ contextMenu.target.category === 'tables' ? '表' : contextMenu.target.category === 'views' ? '视图' : '函数' }}列表
        </div>
      </template>
      <template v-if="contextMenu.type === 'table'">
        <div
          class="menu-item"
          @click="openTable(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="2"
          /><line
            x1="3"
            y1="9"
            x2="21"
            y2="9"
          /><line
            x1="9"
            y1="21"
            x2="9"
            y2="9"
          /></svg>
          打开表
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item danger"
          @click="deleteTable(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          删除表
        </div>
        <div
          class="menu-item danger"
          @click="emptyTable(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M12 11v11" /><line
            x1="8"
            y1="11"
            x2="8.01"
            y2="11"
          /><line
            x1="16"
            y1="11"
            x2="16.01"
            y2="11"
          /></svg>
          清空表
        </div>
        <div
          class="menu-item danger"
          @click="truncateTable(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><rect
            x="8"
            y="11"
            width="8"
            height="10"
          /></svg>
          截断表
        </div>
        <div class="menu-divider" />
        <div class="menu-item has-submenu">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><rect
            x="9"
            y="9"
            width="13"
            height="13"
            rx="2"
            ry="2"
          /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          复制表
          <svg
            class="submenu-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="9 18 15 12 9 6" /></svg>
          <div class="submenu">
            <div
              class="menu-item"
              @click.stop="copyTable(contextMenu.target, 'structure_data'); hideContextMenu()"
            >
              结构和数据
            </div>
            <div
              class="menu-item"
              @click.stop="copyTable(contextMenu.target, 'structure'); hideContextMenu()"
            >
              仅结构
            </div>
          </div>
        </div>
        <div class="menu-item has-submenu">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line
            x1="12"
            y1="15"
            x2="12"
            y2="3"
          /></svg>
          转储SQL文件
          <svg
            class="submenu-arrow"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="9 18 15 12 9 6" /></svg>
          <div class="submenu">
            <div
              class="menu-item"
              @click.stop="dumpTable(contextMenu.target, 'structure_data'); hideContextMenu()"
            >
              结构和数据
            </div>
            <div
              class="menu-item"
              @click.stop="dumpTable(contextMenu.target, 'structure'); hideContextMenu()"
            >
              仅结构
            </div>
          </div>
        </div>
        <div class="menu-divider" />
        <div
          class="menu-item"
          @click="renameTable(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
          重命名
        </div>
        <div
          class="menu-item"
          @click="refreshTable(contextMenu.target); hideContextMenu()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          ><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
          刷新
        </div>
      </template>
    </div>

    <div 
      v-if="tabContextMenu.show" 
      class="context-menu" 
      :style="{ left: tabContextMenu.x + 'px', top: tabContextMenu.y + 'px' }"
      @click.stop
    >
      <div
        class="menu-item"
        @click="closeTab(tabContextMenu.tab.id); hideTabContextMenu()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
          />
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
          />
        </svg>
        关闭
      </div>
      <div
        class="menu-item"
        @click="closeOtherTabs(tabContextMenu.tab.id)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect
            x="3"
            y="3"
            width="18"
            height="18"
            rx="2"
          />
          <line
            x1="9"
            y1="3"
            x2="9"
            y2="21"
          />
          <line
            x1="15"
            y1="3"
            x2="15"
            y2="21"
          />
        </svg>
        关闭其他
      </div>
      <div
        class="menu-item"
        @click="closeAllTabs()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        关闭全部
      </div>
      <div
        class="menu-item"
        @click="closeTabsToRight(tabContextMenu.tab.id)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="9 18 15 12 9 6" />
          <rect
            x="3"
            y="3"
            width="6"
            height="18"
          />
        </svg>
        关闭右侧
      </div>
      <div
        class="menu-item"
        @click="closeTabsToLeft(tabContextMenu.tab.id)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="15 18 9 12 15 6" />
          <rect
            x="15"
            y="3"
            width="6"
            height="18"
          />
        </svg>
        关闭左侧
      </div>
    </div>

    <div 
      v-if="fieldSortMenu.show" 
      class="context-menu" 
      :style="{ left: fieldSortMenu.x + 'px', top: fieldSortMenu.y + 'px' }"
      @click.stop
    >
      <div
        class="menu-item"
        @click="sortFieldAsc()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="18 15 12 9 6 15" />
        </svg>
        升序排序
      </div>
      <div
        class="menu-item"
        @click="sortFieldDesc()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        降序排序
      </div>
      <div class="menu-divider" />
      <div
        class="menu-item"
        @click="clearFieldSort()"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <line
            x1="18"
            y1="6"
            x2="6"
            y2="18"
          />
          <line
            x1="6"
            y1="6"
            x2="18"
            y2="18"
          />
        </svg>
        移除所有排序
      </div>
    </div>

    <MessageDialog
      :visible="messageDialog.visible"
      :type="messageDialog.type"
      :title="messageDialog.title"
      :message="messageDialog.message"
      @confirm="onMessageConfirm"
      @cancel="onMessageCancel"
    />

    <div
      v-if="promptDialog.visible"
      class="dialog-overlay"
      @click.self="onPromptCancel"
    >
      <div class="dialog dialog-small">
        <div class="dialog-header">
          <h3>{{ promptDialog.title }}</h3>
          <button
            class="close-btn"
            @click="onPromptCancel"
          >
            ×
          </button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <input 
              ref="promptInputRef" 
              v-model="promptDialog.value" 
              type="text"
              class="form-input"
              @keyup.enter="onPromptConfirm"
            >
          </div>
        </div>
        <div class="dialog-footer">
          <button
            class="btn btn-secondary"
            @click="onPromptCancel"
          >
            取消
          </button>
          <button
            class="btn btn-primary"
            @click="onPromptConfirm"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  dbTestConnection,
  dbCreateConnection,
  dbCloseConnection,
  dbCloseAllConnections,
  dbExecuteQuery,
  dbQueryDatabases,
  dbQueryTables,
  dbGetTableStructure,
  dbGetActiveConnections,
  getConfig,
  saveConfig,
  selectSqlFile,
  readFile,
  saveSqlFile,
  writeFile
} from '@/api'
import SqlEditor from '@/components/SqlEditor.vue'
import MessageDialog from '@/components/MessageDialog.vue'

const windowWidth = ref(window.innerWidth)

const messageDialog = ref({
  visible: false,
  type: 'info',
  title: '',
  message: '',
  resolve: null
})

const promptDialog = ref({
  visible: false,
  title: '',
  value: '',
  defaultValue: '',
  resolve: null
})

const promptInputRef = ref(null)

function showPrompt(title, defaultValue = '') {
  promptDialog.value = {
    visible: true,
    title,
    value: defaultValue,
    defaultValue,
    resolve: null
  }
  
  setTimeout(() => {
    if (promptInputRef.value) {
      promptInputRef.value.focus()
      promptInputRef.value.select()
    }
  }, 100)
  
  return new Promise(resolve => {
    promptDialog.value.resolve = resolve
  })
}

function onPromptConfirm() {
  if (promptDialog.value.resolve) {
    promptDialog.value.resolve(promptDialog.value.value)
  }
  promptDialog.value.visible = false
}

function onPromptCancel() {
  if (promptDialog.value.resolve) {
    promptDialog.value.resolve(null)
  }
  promptDialog.value.visible = false
}

function showMessage(message, type = 'info', title = '') {
  messageDialog.value = {
    visible: true,
    type,
    title,
    message,
    resolve: null
  }
  return new Promise(resolve => {
    messageDialog.value.resolve = resolve
  })
}

function showConfirm(message, title = '') {
  messageDialog.value = {
    visible: true,
    type: 'confirm',
    title,
    message,
    resolve: null
  }
  return new Promise(resolve => {
    messageDialog.value.resolve = resolve
  })
}

function onMessageConfirm() {
  if (messageDialog.value.resolve) {
    messageDialog.value.resolve(true)
  }
  messageDialog.value.visible = false
}

function onMessageCancel() {
  if (messageDialog.value.resolve) {
    messageDialog.value.resolve(false)
  }
  messageDialog.value.visible = false
}

function updateWidth() {
  windowWidth.value = window.innerWidth
}

onMounted(async () => {
  updateWidth()
  window.addEventListener('resize', updateWidth)
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('click', hideContextMenu)
  await loadConnections()
})

onUnmounted(async () => {
  window.removeEventListener('resize', updateWidth)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('click', hideContextMenu)
  await dbCloseAllConnections()
})

function handleKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const activeTab = tabs.value.find(t => t.id === activeTabId.value)
    if (activeTab?.type === 'query' && activeTab.sqlQuery && activeTab.connectionName && !activeTab.executing) {
      e.preventDefault()
      executeQueryForTab(activeTab)
    }
  }
}

const connections = ref([])
const groups = ref([])
const expandedGroups = ref([])
const expandedConnections = ref([])
const expandedDatabases = ref([])
const openedDatabases = ref([])
const expandedObjectCategories = ref([])
const databaseObjectsMap = ref({})
const connectionDatabases = ref({})
const selectedConnection = ref(null)
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const showGroupDialog = ref(false)
const showManageDialog = ref(false)
const createDialogTab = ref('basic')
const editDialogTab = ref('basic')
const connecting = ref(false)
const testingNewConn = ref(false)
const databases = ref([])
const tables = ref([])
const selectedDatabase = ref('')
const autoLimit = ref(true)
const limitCount = ref(1000)
const layoutMode = ref(localStorage.getItem('databaseLayoutMode') || 'two')
const sidebarWidth = ref(parseInt(localStorage.getItem('databaseSidebarWidth') || '240'))
const infoPanelWidth = ref(parseInt(localStorage.getItem('databaseInfoPanelWidth') || '280'))
const isResizingSidebar = ref(false)
const isResizingInfoPanel = ref(false)

const limitSettingsDialog = ref({
  show: false,
  tabId: null
})

const tableToolbarState = ref({
  filterSortActive: false
})

const tabs = ref([
  { id: 'object', name: '对象', type: 'object', closable: false }
])
const activeTabId = ref('object')

const lastExecutedSql = ref('')
const lastExecutedTime = ref(0)

const selectedObject = ref(null)
const objectSearchKeyword = ref('')
const objectTableDetails = ref([])
const tableStructure = ref([])
const viewDefinition = ref('')
const functionDefinition = ref('')
const tableDDL = ref('')

const selectedInfoType = ref(null)
const selectedCategory = ref(null)
const selectedGroup = ref(null)
const connectionInfo = ref(null)
const databaseInfo = ref(null)
const tableInfo = ref(null)
const tableInfoMode = ref('info')

const objectTypeLabel = computed(() => {
  if (!selectedObject.value) return ''
  const typeLabels = {
    database: '数据库',
    table: '表',
    view: '视图',
    function: '函数'
  }
  return typeLabels[selectedObject.value.type] || ''
})

const filteredTableDetails = computed(() => {
  if (!objectSearchKeyword.value) return objectTableDetails.value
  const keyword = objectSearchKeyword.value.toLowerCase()
  return objectTableDetails.value.filter(table => 
    table.name.toLowerCase().includes(keyword) ||
    (table.comment && table.comment.toLowerCase().includes(keyword))
  )
})

const filteredTableStructure = computed(() => {
  if (!objectSearchKeyword.value) return tableStructure.value
  const keyword = objectSearchKeyword.value.toLowerCase()
  return tableStructure.value.filter(field =>
    field.Field.toLowerCase().includes(keyword) ||
    field.Type.toLowerCase().includes(keyword)
  )
})

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  type: '',
  target: null
})

const tabContextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  tab: null
})

const fieldSortMenu = ref({
  show: false,
  x: 0,
  y: 0,
  tab: null,
  fieldName: null
})

const draggingConnection = ref(null)
const dragOverGroup = ref(null)

function onDragStartConnection(conn) {
  draggingConnection.value = conn.name
}

function onDragEndConnection() {
  draggingConnection.value = null
  dragOverGroup.value = null
}

function onDragOverGroup(groupName) {
  if (draggingConnection.value) {
    dragOverGroup.value = groupName
  }
}

function onDragLeaveGroup() {
  dragOverGroup.value = null
}

async function onDropToGroup(groupName) {
  if (!draggingConnection.value) return
  
  const conn = connections.value.find(c => c.name === draggingConnection.value)
  if (!conn) return
  
  if (conn.group === groupName) {
    dragOverGroup.value = null
    draggingConnection.value = null
    return
  }
  
  await moveToGroup(conn, groupName)
  dragOverGroup.value = null
  draggingConnection.value = null
}

function onDragOverHeader(e) {
  if (draggingConnection.value) {
    e.dataTransfer.dropEffect = 'move'
  }
}

async function onDropToHeader() {
  if (!draggingConnection.value) return
  
  const conn = connections.value.find(c => c.name === draggingConnection.value)
  if (!conn || !conn.group) {
    draggingConnection.value = null
    return
  }
  
  await removeFromGroup(conn)
  draggingConnection.value = null
}

async function showContextMenu(e, type, target = null) {
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    type,
    target
  }
}

function toggleConnectionDatabases(connName) {
  const index = expandedConnections.value.indexOf(connName)
  if (index >= 0) {
    expandedConnections.value.splice(index, 1)
  } else {
    expandedConnections.value.push(connName)
    if (!connectionDatabases.value[connName]) {
      loadConnectionDatabases(connName)
    }
  }
}

async function loadConnectionDatabases(connName) {
  const conn = connections.value.find(c => c.name === connName)
  if (!conn || !conn.active) return
  
  try {
    const result = await dbQueryDatabases(connName)
    if (result.success) {
      connectionDatabases.value[connName] = result.databases
    }
  } catch (error) {
    console.error('加载数据库列表失败:', error)
  }
}

function toggleDatabaseObjects(connName, dbName) {
  const key = `${connName}_${dbName}`
  const index = expandedDatabases.value.indexOf(key)
  if (index >= 0) {
    expandedDatabases.value.splice(index, 1)
  } else {
    expandedDatabases.value.push(key)
    loadDatabaseObjects(connName, dbName)
  }
}

function toggleObjectCategory(category) {
  const index = expandedObjectCategories.value.indexOf(category)
  if (index >= 0) {
    expandedObjectCategories.value.splice(index, 1)
  } else {
    expandedObjectCategories.value.push(category)
  }
}

function selectCategory(connection, database, categoryType) {
  selectedCategory.value = {
    connectionName: connection.name,
    database: database,
    type: categoryType
  }
  selectedInfoType.value = 'category'
  selectedObject.value = null
  selectConnection(connection)
  selectDatabase(database)
  const key = `${connection.name}_${database}`
  if (!expandedObjectCategories.value.includes(`${key}_${categoryType}`)) {
    expandedObjectCategories.value.push(`${key}_${categoryType}`)
  }
}

function handleHeaderStatClick(categoryType) {
  if (!selectedConnection.value || !selectedDatabase.value) {
    return
  }
  selectCategory(selectedConnection.value, selectedDatabase.value, categoryType)
}

async function openDatabaseFromSidebar(conn, dbName) {
  selectConnection(conn)
  selectDatabase(dbName)
  selectDatabaseObject(dbName)
  const key = `${conn.name}_${dbName}`
  if (!openedDatabases.value.includes(key)) {
    openedDatabases.value.push(key)
  }
  if (!expandedDatabases.value.includes(key)) {
    expandedDatabases.value.push(key)
    await loadDatabaseObjects(conn.name, dbName)
  }
}

async function loadDatabaseObjects(connName, dbName) {
  const key = `${connName}_${dbName}`
  try {
    const tablesResult = await dbQueryTables(connName, dbName)
    const viewsResult = await dbExecuteQuery(connName, `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '${dbName}'`, [], { autoLimit: false })
    const functionsResult = await dbExecuteQuery(connName, `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '${dbName}' AND ROUTINE_TYPE = 'FUNCTION'`, [], { autoLimit: false })
    
    databaseObjectsMap.value[key] = {
      tables: tablesResult.success ? tablesResult.tables : [],
      views: viewsResult.success && viewsResult.rows ? viewsResult.rows.map(r => r.TABLE_NAME) : [],
      functions: functionsResult.success && functionsResult.rows ? functionsResult.rows.map(r => r.ROUTINE_NAME) : []
    }
  } catch (error) {
    console.error('加载数据库对象失败:', error)
    databaseObjectsMap.value[key] = { tables: [], views: [], functions: [] }
  }
}

function selectDatabaseFromSidebar(connName, dbName) {
  selectDatabase(dbName)
}

function hideContextMenu() {
  contextMenu.value.show = false
}

function showTabContextMenu(e, tab) {
  tabContextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    tab
  }
}

function hideTabContextMenu() {
  tabContextMenu.value.show = false
}

function showFieldSortMenu(e, tab, fieldName) {
  fieldSortMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    tab,
    fieldName
  }
}

function hideFieldSortMenu() {
  fieldSortMenu.value.show = false
}

function sortFieldAsc() {
  const tab = fieldSortMenu.value.tab
  const fieldName = fieldSortMenu.value.fieldName
  if (tab && fieldName) {
    tab.sortField = fieldName
    tab.sortDirection = 'asc'
    executeTableQueryWithSort(tab)
  }
  hideFieldSortMenu()
}

function sortFieldDesc() {
  const tab = fieldSortMenu.value.tab
  const fieldName = fieldSortMenu.value.fieldName
  if (tab && fieldName) {
    tab.sortField = fieldName
    tab.sortDirection = 'desc'
    executeTableQueryWithSort(tab)
  }
  hideFieldSortMenu()
}

function clearFieldSort() {
  const tab = fieldSortMenu.value.tab
  if (tab) {
    tab.sortField = null
    tab.sortDirection = null
    executeTableQuery(tab)
  }
  hideFieldSortMenu()
}

async function executeTableQueryWithSort(tab) {
  if (!tab.connectionName || !tab.database || !tab.tableName) return
  
  tab.executing = true
  tab.queryResult = null
  
  try {
    await dbExecuteQuery(tab.connectionName, `USE \`${tab.database}\``, [], { autoLimit: false })
    
    const limitValue = autoLimit.value ? limitCount.value : 100
    let sql = `SELECT * FROM \`${tab.tableName}\``
    
    if (tab.sortField && tab.sortDirection) {
      sql += ` ORDER BY \`${tab.sortField}\` ${tab.sortDirection === 'asc' ? 'ASC' : 'DESC'}`
    }
    
    sql += ` LIMIT ${limitValue}`
    
    const startTime = Date.now()
    const result = await dbExecuteQuery(tab.connectionName, sql, [], { autoLimit: false })
    const endTime = Date.now()
    
    const totalRows = result.rowCount || (result.rows ? result.rows.length : 0)
    const totalPages = Math.ceil(totalRows / limitCount.value) || 1
    
    tab.queryResult = {
      success: result.success,
      rows: result.rows,
      fields: result.fields,
      error: result.error,
      duration: endTime - startTime,
      rowCount: result.rowCount || 0,
      totalRows: totalRows,
      currentPage: 1,
      totalPages: totalPages,
      jumpPage: null,
      isSelect: true
    }
    
    if (result.fields) {
      tab.fieldOrder = result.fields.map(f => f.name)
    }
  } catch (error) {
    console.error('查询表数据失败:', error)
    tab.queryResult = {
      success: false,
      error: error.message
    }
  } finally {
    tab.executing = false
  }
}

function showFilterSortDialog() {
  showMessage('筛选排序功能开发中', 'info')
}

function toggleFilterSort() {
  tableToolbarState.value.filterSortActive = !tableToolbarState.value.filterSortActive
}

function importData() {
  showMessage('导入功能开发中', 'info')
}

function exportData() {
  showMessage('导出功能开发中', 'info')
}

function closeOtherTabs(tabId) {
  const currentTab = tabs.value.find(t => t.id === tabId)
  if (!currentTab) return
  
  tabs.value = tabs.value.filter(t => t.id === tabId || !t.closable)
  
  if (!tabs.value.find(t => t.id === activeTabId.value)) {
    activeTabId.value = tabId
  }
  
  hideTabContextMenu()
}

function closeAllTabs() {
  tabs.value = tabs.value.filter(t => !t.closable)
  
  if (tabs.value.length === 0) {
    activeTabId.value = 'object'
  } else {
    activeTabId.value = tabs.value[0].id
  }
  
  hideTabContextMenu()
}

function closeTabsToRight(tabId) {
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return
  
  const tabsToKeep = tabs.value.slice(0, index + 1)
  const nonClosableTabs = tabs.value.filter(t => !t.closable && tabs.value.findIndex(x => x.id === t.id) > index)
  
  tabs.value = [...tabsToKeep, ...nonClosableTabs]
  
  if (!tabs.value.find(t => t.id === activeTabId.value)) {
    activeTabId.value = tabId
  }
  
  hideTabContextMenu()
}

function closeTabsToLeft(tabId) {
  const index = tabs.value.findIndex(t => t.id === tabId)
  if (index === -1) return
  
  const tabsToKeep = tabs.value.slice(index)
  const nonClosableTabs = tabs.value.filter(t => !t.closable && tabs.value.findIndex(x => x.id === t.id) < index)
  
  tabs.value = [...nonClosableTabs, ...tabsToKeep]
  
  if (!tabs.value.find(t => t.id === activeTabId.value)) {
    activeTabId.value = tabId
  }
  
  hideTabContextMenu()
}

function selectTab(tabId) {
  activeTabId.value = tabId
}

function closeTab(tabId) {
  const tab = tabs.value.find(t => t.id === tabId)
  if (!tab || !tab.closable) return
  
  const index = tabs.value.findIndex(t => t.id === tabId)
  tabs.value.splice(index, 1)
  
  if (activeTabId.value === tabId) {
    activeTabId.value = tabs.value[Math.max(0, index - 1)].id
  }
}

function createQueryTab(connName, dbName = '') {
  const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const tabName = '无标题-查询'
  
  tabs.value.push({
    id: queryId,
    name: tabName,
    type: 'query',
    closable: true,
    connectionName: connName,
    database: dbName,
    sqlQuery: '',
    queryResult: null,
    executing: false,
    editorRef: null
  })
  
  activeTabId.value = queryId
  
  if (dbName) {
    const tab = tabs.value.find(t => t.id === queryId)
    if (tab) {
      tab.sqlQuery = ''
    }
  }
}

function createTableTab(connName, dbName, tableName) {
  const tabName = `${tableName}@${dbName}（${connName}）-表`
  
  const existingTab = tabs.value.find(t => t.type === 'table' && t.name === tabName)
  if (existingTab) {
    activeTabId.value = existingTab.id
    return existingTab
  }
  
  const tableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  tabs.value.push({
    id: tableId,
    name: tabName,
    type: 'table',
    closable: true,
    connectionName: connName,
    database: dbName,
    tableName: tableName,
    queryResult: null,
    executing: false,
    fieldOrder: [],
    sortField: null,
    sortDirection: null
  })
  
  activeTabId.value = tableId
  
  return tabs.value.find(t => t.id === tableId)
}

const activeConnections = computed(() => {
  return connections.value.filter(conn => conn.active)
})

function getTabDatabases(tab) {
  if (!tab.connectionName) return []
  return connectionDatabases.value[tab.connectionName] || []
}

function getTabTables(tab) {
  if (!tab.connectionName || !tab.database) return []
  const key = `${tab.connectionName}_${tab.database}`
  return databaseObjectsMap.value[key]?.tables || []
}

function getTabPlaceholder(tab) {
  if (!tab.connectionName) return '请先选择数据库连接...'
  if (!tab.database) return '请选择数据库...'
  return '输入SQL查询...'
}

async function onTabConnectionChange(tab) {
  tab.database = ''
  tab.sqlQuery = ''
  tab.queryResult = null
  
  if (tab.connectionName) {
    await loadConnectionDatabases(tab.connectionName)
  }
}

async function onTabDatabaseChange(tab) {
  tab.sqlQuery = ''
  tab.queryResult = null
  
  if (tab.connectionName && tab.database) {
    const key = `${tab.connectionName}_${tab.database}`
    if (!databaseObjectsMap.value[key]) {
      await loadDatabaseObjects(tab.connectionName, tab.database)
    }
  }
}

async function executeQueryForTab(tab) {
  if (!tab.connectionName) return
  
  let sqlContent = tab.sqlQuery
  if (tab.editorRef && tab.editorRef.getSelectionOrAll) {
    sqlContent = tab.editorRef.getSelectionOrAll()
  }
  
  if (!sqlContent || sqlContent.trim() === '') return
  
  tab.executing = true
  
  const statements = parseSqlStatements(sqlContent)
  
  if (statements.length === 0) {
    tab.executing = false
    return
  }
  
  tab.queryResults = []
  tab.activeResultIndex = 0
  
  try {
    if (tab.database) {
      await dbExecuteQuery(tab.connectionName, `USE \`${tab.database}\``, [], { autoLimit: false })
    }
    
    for (let i = 0; i < statements.length; i++) {
      let sql = statements[i].trim()
      if (sql.toLowerCase().endsWith(';')) {
        sql = sql.slice(0, -1)
      }
      
      const isSelect = sql.toLowerCase().match(/^\s*select\b/i)
      
      if (isSelect) {
        const limitValue = autoLimit.value ? limitCount.value : 100000
        
        if (!sql.toLowerCase().match(/limit\s+\d+/i)) {
          sql = `${sql} LIMIT ${limitValue}`
        }
      }
      
      const startTime = Date.now()
      const result = await dbExecuteQuery(tab.connectionName, sql, [], { autoLimit: false })
      const endTime = Date.now()
      
      const totalRows = result.rowCount || (result.rows ? result.rows.length : 0)
      const totalPages = isSelect ? Math.ceil(totalRows / limitCount.value) || 1 : 1
      
      tab.queryResults.push({
        index: i,
        name: `结果(${i + 1})`,
        sql: statements[i],
        success: result.success,
        rows: result.rows,
        fields: result.fields,
        error: result.error,
        duration: endTime - startTime,
        rowCount: result.rowCount || 0,
        totalRows: totalRows,
        currentPage: 1,
        totalPages: totalPages,
        jumpPage: null,
        isSelect: isSelect
      })
      
      lastExecutedSql.value = sql
      lastExecutedTime.value = endTime - startTime
    }
    
    tab.queryResult = tab.queryResults[0]
  } catch (error) {
    console.error('执行查询失败:', error)
    tab.queryResults = [{
      index: 0,
      name: '结果(1)',
      sql: sqlContent,
      success: false,
      error: error.message
    }]
    tab.queryResult = tab.queryResults[0]
  } finally {
    tab.executing = false
  }
}

function parseSqlStatements(sql) {
  const statements = []
  let currentStatement = ''
  let inString = false
  let stringChar = null
  
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    
    if (!inString && (char === "'" || char === '"' || char === '`')) {
      inString = true
      stringChar = char
      currentStatement += char
    } else if (inString && char === stringChar) {
      if (sql[i - 1] !== '\\') {
        inString = false
        stringChar = null
      }
      currentStatement += char
    } else if (!inString && char === ';') {
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim())
      }
      currentStatement = ''
    } else {
      currentStatement += char
    }
  }
  
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim())
  }
  
  return statements
}

function switchResultTab(tab, index) {
  if (tab.queryResults && tab.queryResults[index]) {
    tab.activeResultIndex = index
    tab.queryResult = tab.queryResults[index]
  }
}

function stopQueryForTab(tab) {
  tab.executing = false
  tab.queryResult = {
    success: false,
    error: '查询已停止'
  }
}

function formatSqlForTab(tab) {
  if (!tab.sqlQuery) return
  
  let sql = tab.sqlQuery
  
  sql = sql.replace(/\s+/g, ' ')
  
  const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'ON', 'AS', 'SET', 'VALUES', 'INTO']
  
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi')
    sql = sql.replace(regex, keyword.toUpperCase())
  })
  
  keywords.forEach(keyword => {
    const regex = new RegExp(`\\s*${keyword.toUpperCase()}\\s*`, 'g')
    if (keyword === 'SELECT' || keyword === 'FROM' || keyword === 'WHERE' || keyword === 'ORDER BY' || keyword === 'GROUP BY' || keyword === 'HAVING' || keyword === 'LIMIT') {
      sql = sql.replace(regex, `\n${keyword.toUpperCase()}\n`)
    } else if (keyword === 'AND' || keyword === 'OR' || keyword === 'ON') {
      sql = sql.replace(regex, `\n  ${keyword.toUpperCase()}\n`)
    }
  })
  
  sql = sql.replace(/\n\s*\n/g, '\n')
  sql = sql.trim()
  
  tab.sqlQuery = sql
  
  if (tab.editorRef && tab.editorRef.setContent) {
    tab.editorRef.setContent(sql)
  }
}

function clearQueryForTab(tab) {
  tab.sqlQuery = ''
  tab.queryResult = null
}

function toggleLimitSettingsDialog(tab) {
  if (limitSettingsDialog.value.show && limitSettingsDialog.value.tabId === tab.id) {
    limitSettingsDialog.value.show = false
    limitSettingsDialog.value.tabId = null
  } else {
    limitSettingsDialog.value.show = true
    limitSettingsDialog.value.tabId = tab.id
  }
}

async function firstPage(tab) {
  if (!tab.queryResult || tab.queryResult.currentPage <= 1) return
  await loadPageData(tab, 1)
}

async function lastPage(tab) {
  if (!tab.queryResult || tab.queryResult.currentPage >= tab.queryResult.totalPages) return
  await loadPageData(tab, tab.queryResult.totalPages)
}

async function prevPage(tab) {
  if (!tab.queryResult || tab.queryResult.currentPage <= 1) return
  const newPage = tab.queryResult.currentPage - 1
  await loadPageData(tab, newPage)
}

async function nextPage(tab) {
  if (!tab.queryResult || tab.queryResult.currentPage >= tab.queryResult.totalPages) return
  const newPage = tab.queryResult.currentPage + 1
  await loadPageData(tab, newPage)
}

async function jumpToPage(tab) {
  if (!tab.queryResult || !tab.queryResult.jumpPage) return
  const targetPage = Math.max(1, Math.min(tab.queryResult.jumpPage, tab.queryResult.totalPages))
  await loadPageData(tab, targetPage)
}

async function loadPageData(tab, page) {
  if (!tab.connectionName || !tab.sqlQuery) return
  
  let sql = tab.sqlQuery.trim()
  const isSelect = sql.toLowerCase().match(/^\s*select\b/i)
  
  if (!isSelect) {
    return
  }
  
  const offset = (page - 1) * limitCount.value
  const limit = autoLimit.value ? limitCount.value : 100000
  
  if (sql.toLowerCase().match(/limit\s+\d+/i)) {
    sql = sql.replace(/limit\s+\d+(\s*,\s*\d+)?/i, '')
  }
  
  if (sql.toLowerCase().endsWith(';')) {
    sql = sql.slice(0, -1)
  }
  
  sql = `${sql} LIMIT ${offset}, ${limit}`
  
  tab.executing = true
  try {
    if (tab.database) {
      await dbExecuteQuery(tab.connectionName, `USE \`${tab.database}\``, [], { autoLimit: false })
    }
    
    const startTime = Date.now()
    const result = await dbExecuteQuery(tab.connectionName, sql, [], { autoLimit: false })
    const endTime = Date.now()
    
    tab.queryResult = {
      ...tab.queryResult,
      success: result.success,
      rows: result.rows,
      fields: result.fields,
      error: result.error,
      duration: endTime - startTime,
      rowCount: result.rowCount || 0,
      currentPage: page,
      jumpPage: null
    }
  } catch (error) {
    console.error('分页查询失败:', error)
    tab.queryResult = {
      ...tab.queryResult,
      success: false,
      error: error.message
    }
  } finally {
    tab.executing = false
  }
}

function formatCellValue(value) {
  if (value === null) return 'NULL'
  if (value === '') return ''
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    const hours = String(value.getHours()).padStart(2, '0')
    const minutes = String(value.getMinutes()).padStart(2, '0')
    const seconds = String(value.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}:\d{2}/)) {
    const date = new Date(value)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const seconds = String(date.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
    }
  }
  return value
}

function truncateSql(sql) {
  if (!sql) return ''
  const maxLength = 60
  if (sql.length <= maxLength) return sql
  return sql.substring(0, maxLength) + '...'
}

async function copyLastSql() {
  if (!lastExecutedSql.value) return
  try {
    await navigator.clipboard.writeText(lastExecutedSql.value)
  } catch (err) {
    console.error('复制失败:', err)
  }
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}

function formatTableTime(time) {
  if (!time) return '-'
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatDate(time) {
  if (!time) return '--'
  const date = new Date(time)
  if (isNaN(date.getTime())) return '--'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getInfoHeaderName() {
  if (selectedInfoType.value === 'group') return selectedGroup.value?.name
  if (selectedInfoType.value === 'connection') return selectedConnection.value?.name
  if (selectedInfoType.value === 'database') return selectedObject.value?.name
  if (selectedInfoType.value === 'table') return selectedObject.value?.name
  if (selectedInfoType.value === 'category') {
    const typeLabels = { tables: '表', views: '视图', functions: '函数' }
    return typeLabels[selectedCategory.value?.type] || ''
  }
  return ''
}

function getInfoHeaderDesc() {
  if (selectedInfoType.value === 'group') return '分组'
  if (selectedInfoType.value === 'connection') return selectedConnection.value?.active ? '已连接' : '未连接'
  if (selectedInfoType.value === 'database') return '数据库'
  if (selectedInfoType.value === 'table') return selectedObject.value?.database || ''
  if (selectedInfoType.value === 'category') return selectedCategory.value?.database || ''
  return ''
}

function getCategoryList() {
  if (!selectedCategory.value) return []
  const key = `${selectedCategory.value.connectionName}_${selectedCategory.value.database}`
  const objects = databaseObjectsMap.value[key]
  if (!objects) return []
  return objects[selectedCategory.value.type] || []
}

function handleCategoryItemClick(item) {
  if (selectedCategory.value?.type === 'tables') {
    selectTableObject(item)
  } else if (selectedCategory.value?.type === 'views') {
    selectViewObject(item)
  } else if (selectedCategory.value?.type === 'functions') {
    selectFunctionObject(item)
  }
}

async function loadTableDetails(connName, dbName) {
  objectTableDetails.value = []
  if (!connName || !dbName) return
  
  try {
    const result = await dbExecuteQuery(
      connName,
      `SELECT 
        TABLE_NAME as name,
        TABLE_ROWS as rows,
        DATA_LENGTH + INDEX_LENGTH as dataSize,
        ENGINE as engine,
        UPDATE_TIME as modified,
        TABLE_COMMENT as comment
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = '${dbName}'
      ORDER BY TABLE_NAME`,
      [],
      { autoLimit: false }
    )
    
    if (result.success && result.rows) {
      objectTableDetails.value = result.rows.map(row => ({
        name: row.name,
        rows: row.rows || 0,
        dataSize: row.dataSize || 0,
        engine: row.engine || '-',
        modified: row.modified || '-',
        comment: row.comment || ''
      }))
    }
  } catch (error) {
    console.error('加载表详情失败:', error)
  }
}

function highlightSql(sql) {
  if (!sql) return ''
  
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AS', 'GROUP', 'BY',
    'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE', 'DELETE',
    'CREATE', 'ALTER', 'DROP', 'TABLE', 'DATABASE', 'INDEX', 'VIEW',
    'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT',
    'NULL', 'AUTO_INCREMENT', 'ENGINE', 'CHARSET',
    'COLLATE', 'COMMENT', 'INT', 'VARCHAR', 'TEXT', 'BIGINT', 'SMALLINT',
    'TINYINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'DATE', 'DATETIME', 'TIMESTAMP',
    'BOOLEAN', 'BOOL', 'ENUM', 'SET', 'IF', 'ELSE', 'THEN', 'END', 'CASE',
    'WHEN', 'BEGIN', 'COMMIT', 'ROLLBACK', 'TRUNCATE', 'REPLACE', 'INTO',
    'VALUES', 'SHOW', 'DESCRIBE', 'DESC', 'USE', 'GRANT', 'REVOKE',
    'UNION', 'ALL', 'DISTINCT', 'EXISTS', 'ASC', 'DESC', 'CONSTRAINT',
    'ADD', 'COLUMN', 'MODIFY', 'CHANGE', 'RENAME', 'AFTER', 'FIRST',
    'PARTITION', 'PARTITIONS', 'PROCEDURE', 'FUNCTION', 'TRIGGER',
    'RETURNS', 'DECLARE', 'RETURN', 'CALL', 'EXECUTE', 'PREPARE', 'CURRENT_TIMESTAMP'
  ]
  
  const functions = [
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CONCAT', 'SUBSTRING', 'LENGTH',
    'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'FORMAT',
    'NOW', 'CURDATE', 'CURTIME', 'DATE_FORMAT', 'YEAR', 'MONTH', 'DAY',
    'HOUR', 'MINUTE', 'SECOND', 'IFNULL', 'COALESCE', 'NULLIF', 'CAST',
    'CONVERT', 'ABS', 'ROUND', 'CEIL', 'FLOOR', 'MOD', 'POWER', 'SQRT',
    'RAND', 'SIGN', 'EXP', 'LOG', 'LN', 'SIN', 'COS', 'TAN', 'ASCII',
    'CHAR', 'HEX', 'UNHEX', 'INSTR', 'LOCATE', 'LEFT', 'RIGHT', 'LPAD',
    'RPAD', 'REVERSE', 'SPACE', 'STRCMP', 'UUID', 'MD5', 'SHA1', 'SHA2'
  ]
  
  let result = sql
  
  result = result.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>')
  result = result.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="sql-comment">$1</span>')
  
  result = result.replace(/'([^']*)'/g, '<span class="sql-string">\'$1\'</span>')
  result = result.replace(/"(?![^<]*>)([^"]*)"(?![^<]*>)/g, '<span class="sql-string">"$1"</span>')
  
  result = result.replace(/`([^`]+)`/g, '<span class="sql-identifier">`$1`</span>')
  
  const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi')
  result = result.replace(keywordRegex, '<span class="sql-keyword">$&</span>')
  
  const functionRegex = new RegExp(`\\b(${functions.join('|')})\\b`, 'gi')
  result = result.replace(functionRegex, '<span class="sql-function">$&</span>')
  
  result = result.replace(/\b(\d+\.?\d*)\b/g, '<span class="sql-number">$1</span>')
  
  return result
}

async function loadTableStructureForObject(connName, dbName, tableName) {
  tableStructure.value = []
  tableDDL.value = ''
  if (!connName || !dbName || !tableName) return
  
  try {
    const result = await dbGetTableStructure(connName, dbName, tableName)
    if (result.success) {
      tableStructure.value = result.fields || []
    }
    
    const ddlResult = await dbExecuteQuery(
      connName,
      `SHOW CREATE TABLE \`${dbName}\`.\`${tableName}\``,
      [],
      { autoLimit: false }
    )
    if (ddlResult.success && ddlResult.rows && ddlResult.rows.length > 0) {
      tableDDL.value = ddlResult.rows[0]['Create Table'] || '无法获取DDL'
    }
  } catch (error) {
    console.error('加载表结构失败:', error)
  }
}

async function loadViewDefinitionForObject(connName, dbName, viewName) {
  viewDefinition.value = ''
  if (!connName || !dbName || !viewName) return
  
  try {
    const result = await dbExecuteQuery(
      connName,
      `SELECT VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${viewName}'`,
      [],
      { autoLimit: false }
    )
    
    if (result.success && result.rows && result.rows.length > 0) {
      viewDefinition.value = result.rows[0].VIEW_DEFINITION || '无法获取视图定义'
    }
  } catch (error) {
    console.error('加载视图定义失败:', error)
    viewDefinition.value = '加载失败'
  }
}

async function loadFunctionDefinitionForObject(connName, dbName, funcName) {
  functionDefinition.value = ''
  if (!connName || !dbName || !funcName) return
  
  try {
    const result = await dbExecuteQuery(
      connName,
      `SELECT ROUTINE_DEFINITION FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = '${dbName}' AND ROUTINE_NAME = '${funcName}' AND ROUTINE_TYPE = 'FUNCTION'`,
      [],
      { autoLimit: false }
    )
    
    if (result.success && result.rows && result.rows.length > 0) {
      functionDefinition.value = result.rows[0].ROUTINE_DEFINITION || '无法获取函数定义'
    }
  } catch (error) {
    console.error('加载函数定义失败:', error)
    functionDefinition.value = '加载失败'
  }
}

function selectDatabaseObject(dbName) {
  selectedObject.value = { type: 'database', name: dbName, connectionName: selectedConnection.value?.name }
  selectedInfoType.value = 'database'
  objectSearchKeyword.value = ''
  objectTableDetails.value = []
  tableStructure.value = []
  viewDefinition.value = ''
  functionDefinition.value = ''
  databaseInfo.value = null
  tableInfo.value = null
  if (selectedConnection.value?.active) {
    loadTableDetails(selectedConnection.value.name, dbName)
    loadDatabaseInfo(selectedConnection.value.name, dbName)
  }
}

async function loadDatabaseInfo(connName, dbName) {
  try {
    const result = await dbExecuteQuery(connName, `SELECT SCHEMA_NAME, DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${dbName}'`, [], { autoLimit: false })
    if (result.success && result.rows && result.rows.length > 0) {
      databaseInfo.value = {
        name: result.rows[0].SCHEMA_NAME,
        charset: result.rows[0].DEFAULT_CHARACTER_SET_NAME,
        collation: result.rows[0].DEFAULT_COLLATION_NAME
      }
    }
  } catch (err) {
    console.error('获取数据库信息失败:', err)
  }
}

function selectTableObject(tableName) {
  selectedObject.value = { type: 'table', name: tableName, connectionName: selectedConnection.value?.name, database: selectedDatabase.value }
  selectedInfoType.value = 'table'
  tableInfoMode.value = 'info'
  objectSearchKeyword.value = ''
  tableStructure.value = []
  tableInfo.value = null
  tableDDL.value = ''
  if (selectedConnection.value?.active && selectedDatabase.value) {
    loadTableStructureForObject(selectedConnection.value.name, selectedDatabase.value, tableName)
    loadTableInfo(selectedConnection.value.name, selectedDatabase.value, tableName)
  }
}

async function loadTableInfo(connName, dbName, tableName) {
  try {
    const result = await dbExecuteQuery(connName, `SELECT TABLE_NAME, TABLE_ROWS, ENGINE, AUTO_INCREMENT, ROW_FORMAT, TABLE_COLLATION, CREATE_TIME, UPDATE_TIME, CHECK_TIME, INDEX_LENGTH, DATA_LENGTH, MAX_DATA_LENGTH, DATA_FREE, CREATE_OPTIONS, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${tableName}'`, [], { autoLimit: false })
    if (result.success && result.rows && result.rows.length > 0) {
      tableInfo.value = result.rows[0]
    }
  } catch (err) {
    console.error('获取表信息失败:', err)
  }
}

function selectViewObject(viewName) {
  selectedObject.value = { type: 'view', name: viewName, connectionName: selectedConnection.value?.name, database: selectedDatabase.value }
  objectSearchKeyword.value = ''
  viewDefinition.value = ''
  if (selectedConnection.value?.active && selectedDatabase.value) {
    loadViewDefinitionForObject(selectedConnection.value.name, selectedDatabase.value, viewName)
  }
}

function selectFunctionObject(funcName) {
  selectedObject.value = { type: 'function', name: funcName, connectionName: selectedConnection.value?.name, database: selectedDatabase.value }
  objectSearchKeyword.value = ''
  functionDefinition.value = ''
  if (selectedConnection.value?.active && selectedDatabase.value) {
    loadFunctionDefinitionForObject(selectedConnection.value.name, selectedDatabase.value, funcName)
  }
}

function clearObjectInfo() {
  selectedObject.value = null
  objectSearchKeyword.value = ''
  objectTableDetails.value = []
  tableStructure.value = []
  viewDefinition.value = ''
  functionDefinition.value = ''
}

const newConnection = ref({
  name: '',
  group: '',
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  savePassword: true,
  charset: '',
  enableKeepAlive: true,
  keepAliveInterval: 240,
  enableConnectTimeout: true,
  connectTimeout: 30,
  enableReadTimeout: false,
  readTimeout: 30,
  enableWriteTimeout: true,
  writeTimeout: 30,
  autoConnect: false
})

const editingConnection = ref(null)
const editingGroup = ref(null)
const newGroupName = ref('')

const connectionGroups = computed(() => {
  const groupMap = {}
  groups.value.forEach(g => {
    groupMap[g] = []
  })
  connections.value.forEach(conn => {
    if (conn.group && groupMap[conn.group]) {
      groupMap[conn.group].push(conn)
    }
  })
  return groups.value.map(g => ({
    name: g,
    connections: groupMap[g]
  }))
})

const ungroupedConnections = computed(() => {
  return connections.value.filter(conn => !conn.group || !groups.value.includes(conn.group))
})

async function loadConnections() {
  try {
    const config = await getConfig()
    const savedConnections = config.dbConnections || []
    const savedGroups = config.dbConnectionGroups || []
    const activeConnections = await dbGetActiveConnections()
    
    connections.value = savedConnections.map(conn => ({
      ...conn,
      savePassword: conn.savePassword ?? true,
      charset: conn.charset ?? '',
      enableKeepAlive: conn.enableKeepAlive ?? true,
      keepAliveInterval: conn.keepAliveInterval ?? 240,
      enableConnectTimeout: conn.enableConnectTimeout ?? true,
      connectTimeout: conn.connectTimeout ?? 30,
      enableReadTimeout: conn.enableReadTimeout ?? false,
      readTimeout: conn.readTimeout ?? 30,
      enableWriteTimeout: conn.enableWriteTimeout ?? true,
      writeTimeout: conn.writeTimeout ?? 30,
      autoConnect: conn.autoConnect ?? false,
      active: activeConnections.includes(conn.name)
    }))
    groups.value = savedGroups
    
    if (expandedGroups.value.length === 0 && savedGroups.length > 0) {
      expandedGroups.value = [...savedGroups]
    }
    
    for (const conn of connections.value) {
      if (conn.autoConnect && !conn.active) {
        selectedConnection.value = conn
        await connectToDatabase()
      }
    }
  } catch (error) {
    console.error('加载连接配置失败:', error)
  }
}

function toggleGroup(name) {
  const index = expandedGroups.value.indexOf(name)
  if (index >= 0) {
    expandedGroups.value.splice(index, 1)
  } else {
    expandedGroups.value.push(name)
  }
}

async function saveConnection() {
  if (!newConnection.value.name) {
    await showMessage('请输入连接名称', 'warning')
    return
  }

  const connection = { ...newConnection.value }
  
  if (!connection.savePassword) {
    connection.password = ''
  }
  
  try {
    const config = await getConfig()
    const dbConnections = config.dbConnections || []
    const existingIndex = dbConnections.findIndex(c => c.name === connection.name)
    
    if (existingIndex >= 0) {
      await showMessage('连接名称已存在', 'error')
      return
    }
    
    dbConnections.push(connection)
    await saveConfig({ ...config, dbConnections })
    
    showCreateDialog.value = false
    resetNewConnection()
    await loadConnections()
  } catch (error) {
    console.error('保存连接失败:', error)
    await showMessage('保存连接失败: ' + error.message, 'error')
  }
}

function onHostBlur() {
  if (!newConnection.value.name && newConnection.value.host) {
    newConnection.value.name = newConnection.value.host
  }
}

function resetNewConnection() {
  newConnection.value = {
    name: '',
    group: '',
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    savePassword: true,
    charset: '',
    enableKeepAlive: true,
    keepAliveInterval: 240,
    enableConnectTimeout: true,
    connectTimeout: 30,
    enableReadTimeout: false,
    readTimeout: 30,
    enableWriteTimeout: true,
    writeTimeout: 30,
    autoConnect: false
  }
  createDialogTab.value = 'basic'
}

function closeCreateDialog() {
  showCreateDialog.value = false
  resetNewConnection()
}

function editConnection(conn) {
  editingConnection.value = { 
    ...conn,
    savePassword: conn.savePassword ?? true,
    charset: conn.charset ?? '',
    enableKeepAlive: conn.enableKeepAlive ?? true,
    keepAliveInterval: conn.keepAliveInterval ?? 240,
    enableConnectTimeout: conn.enableConnectTimeout ?? true,
    connectTimeout: conn.connectTimeout ?? 30,
    enableReadTimeout: conn.enableReadTimeout ?? false,
    readTimeout: conn.readTimeout ?? 30,
    enableWriteTimeout: conn.enableWriteTimeout ?? true,
    writeTimeout: conn.writeTimeout ?? 30,
    autoConnect: conn.autoConnect ?? false
  }
  editDialogTab.value = 'basic'
  showEditDialog.value = true
}

function closeEditDialog() {
  showEditDialog.value = false
  editingConnection.value = null
}

async function updateConnection() {
  if (!editingConnection.value.name) {
    await showMessage('请输入连接名称', 'warning')
    return
  }
  
  const oldName = selectedConnection.value?.name
  const connection = { ...editingConnection.value }
  
  if (!connection.savePassword) {
    connection.password = ''
  }
  
  try {
    const config = await getConfig()
    const dbConnections = config.dbConnections || []
    const index = dbConnections.findIndex(c => c.name === oldName)
    
    if (index >= 0) {
      if (editingConnection.value.name !== oldName) {
        const existing = dbConnections.findIndex(c => c.name === editingConnection.value.name)
        if (existing >= 0) {
          await showMessage('连接名称已存在', 'error')
          return
        }
      }
      dbConnections[index] = connection
      await saveConfig({ ...config, dbConnections })
    }
    
    showEditDialog.value = false
    editingConnection.value = null
    await loadConnections()
    
    if (selectedConnection.value?.name === oldName) {
      selectedConnection.value = connections.value.find(c => c.name === editingConnection.value?.name) || null
    }
  } catch (error) {
    console.error('更新连接失败:', error)
    await showMessage('更新连接失败: ' + error.message, 'error')
  }
}

async function duplicateConnection(conn) {
  const newConn = { ...conn, name: conn.name + '_copy' }
  
  try {
    const config = await getConfig()
    const dbConnections = config.dbConnections || []
    
    let name = newConn.name
    let counter = 1
    while (dbConnections.find(c => c.name === name)) {
      name = conn.name + '_copy' + counter
      counter++
    }
    newConn.name = name
    
    dbConnections.push(newConn)
    await saveConfig({ ...config, dbConnections })
    await loadConnections()
  } catch (error) {
    console.error('复制连接失败:', error)
    await showMessage('复制连接失败: ' + error.message, 'error')
  }
}

function selectConnection(conn) {
  selectedConnection.value = conn
  databases.value = []
  tables.value = []
  selectedDatabase.value = ''
  clearObjectInfo()
  selectedInfoType.value = 'connection'
  selectedGroup.value = null
  connectionInfo.value = null
  databaseInfo.value = null
  tableInfo.value = null
  if (conn.active) {
    loadConnectionInfo(conn.name)
  }
}

async function loadConnectionInfo(connName) {
  try {
    const result = await dbExecuteQuery(connName, 'SELECT VERSION() AS version, @@character_set_server AS charset, @@collation_server AS collation, @@session.auto_increment_increment AS autoIncrementIncrement', [], { autoLimit: false })
    if (result.success && result.rows && result.rows.length > 0) {
      connectionInfo.value = {
        version: result.rows[0].version,
        charset: result.rows[0].charset,
        collation: result.rows[0].collation,
        autoIncrementIncrement: result.rows[0].autoIncrementIncrement
      }
    }
  } catch (err) {
    console.error('获取连接信息失败:', err)
  }
}

function selectGroup(group) {
  selectedGroup.value = group
  selectedInfoType.value = 'group'
  selectedConnection.value = null
  selectedDatabase.value = ''
  selectedObject.value = null
  connectionInfo.value = null
  databaseInfo.value = null
  tableInfo.value = null
}

async function handleConnectionDoubleClick(conn) {
  selectConnection(conn)
  if (!conn.active) {
    await connectToDatabase()
  }
}

async function connectToDatabase() {
  if (!selectedConnection.value) return
  
  connecting.value = true
  try {
    const connConfig = {
      host: selectedConnection.value.host,
      port: selectedConnection.value.port,
      user: selectedConnection.value.user,
      password: selectedConnection.value.password
    }
    
    if (selectedConnection.value.charset) {
      connConfig.charset = selectedConnection.value.charset
    }
    
    if (selectedConnection.value.enableKeepAlive) {
      connConfig.keepAliveInterval = selectedConnection.value.keepAliveInterval
    }
    
    if (selectedConnection.value.enableConnectTimeout) {
      connConfig.connectTimeout = selectedConnection.value.connectTimeout
    }
    
    if (selectedConnection.value.enableReadTimeout) {
      connConfig.readTimeout = selectedConnection.value.readTimeout
    }
    
    if (selectedConnection.value.enableWriteTimeout) {
      connConfig.writeTimeout = selectedConnection.value.writeTimeout
    }
    
    const result = await dbCreateConnection(selectedConnection.value.name, connConfig)
    
    if (result.success) {
      selectedConnection.value.active = true
      await loadConnectionDatabases(selectedConnection.value.name)
      if (!expandedConnections.value.includes(selectedConnection.value.name)) {
        expandedConnections.value.push(selectedConnection.value.name)
      }
      await loadDatabases()
    } else {
      await showMessage('连接失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('连接失败:', error)
    await showMessage('连接失败: ' + error.message, 'error')
  } finally {
    connecting.value = false
  }
}

async function disconnectFromDatabase() {
  if (!selectedConnection.value) return
  
  try {
    const result = await dbCloseConnection(selectedConnection.value.name)
    
    if (result.success) {
      selectedConnection.value.active = false
      databases.value = []
      tables.value = []
      selectedDatabase.value = ''
    } else {
      await showMessage('断开连接失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('断开连接失败:', error)
    await showMessage('断开连接失败: ' + error.message, 'error')
  }
}

async function closeAllConnections() {
  try {
    const result = await dbCloseAllConnections()
    if (result.success) {
      connections.value.forEach(conn => conn.active = false)
      if (selectedConnection.value) {
        selectedConnection.value.active = false
      }
      databases.value = []
      tables.value = []
      selectedDatabase.value = ''
    } else {
      await showMessage('关闭连接失败', 'error')
    }
  } catch (error) {
    console.error('关闭所有连接失败:', error)
    await showMessage('关闭所有连接失败: ' + error.message, 'error')
  }
}

async function testConnection() {
  if (!selectedConnection.value) return
  
  try {
    const connConfig = {
      host: selectedConnection.value.host,
      port: selectedConnection.value.port,
      user: selectedConnection.value.user,
      password: selectedConnection.value.password
    }
    
    if (selectedConnection.value.charset) {
      connConfig.charset = selectedConnection.value.charset
    }
    
    if (selectedConnection.value.enableConnectTimeout) {
      connConfig.connectTimeout = selectedConnection.value.connectTimeout
    }
    
    const result = await dbTestConnection(connConfig)
    
    if (result.success) {
      await showMessage('连接成功！', 'success')
    } else {
      await showMessage('连接失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('测试连接失败:', error)
    await showMessage('测试连接失败: ' + error.message, 'error')
  }
}

async function testNewConnection() {
  if (!newConnection.value.host) {
    await showMessage('请输入主机地址', 'warning')
    return
  }
  
  testingNewConn.value = true
  try {
    const connConfig = {
      host: newConnection.value.host,
      port: newConnection.value.port || 3306,
      user: newConnection.value.user || 'root',
      password: newConnection.value.password
    }
    
    if (newConnection.value.charset) {
      connConfig.charset = newConnection.value.charset
    }
    
    if (newConnection.value.enableConnectTimeout) {
      connConfig.connectTimeout = newConnection.value.connectTimeout
    }
    
    const result = await dbTestConnection(connConfig)
    
    if (result.success) {
      await showMessage('连接成功！', 'success')
    } else {
      await showMessage('连接失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('测试连接失败:', error)
    await showMessage('测试连接失败: ' + error.message, 'error')
  } finally {
    testingNewConn.value = false
  }
}

async function deleteConnection() {
  if (!selectedConnection.value) return
  
  const confirmed = await showConfirm(`确定要删除连接 "${selectedConnection.value.name}" 吗？`)
  if (!confirmed) return
  
  try {
    if (selectedConnection.value.active) {
      await dbCloseConnection(selectedConnection.value.name)
    }
    
    const config = await getConfig()
    const dbConnections = config.dbConnections || []
    const index = dbConnections.findIndex(c => c.name === selectedConnection.value.name)
    
    if (index >= 0) {
      dbConnections.splice(index, 1)
      await saveConfig({ ...config, dbConnections })
    }
    
    selectedConnection.value = null
    await loadConnections()
  } catch (error) {
    console.error('删除连接失败:', error)
    await showMessage('删除连接失败: ' + error.message, 'error')
  }
}

async function executeSqlDirect(sql, connName) {
  try {
    const result = await dbExecuteQuery(connName, sql, [], { autoLimit: false })
    return result
  } catch (error) {
    console.error('执行SQL失败:', error)
    return { success: false, error: error.message }
  }
}

async function loadDatabases() {
  if (!selectedConnection.value || !selectedConnection.value.active) return
  
  try {
    const result = await dbQueryDatabases(selectedConnection.value.name)
    
    if (result.success) {
      databases.value = result.databases
    } else {
      console.error('加载数据库列表失败:', result.error)
    }
  } catch (error) {
    console.error('加载数据库列表失败:', error)
  }
}

function selectDatabaseOnly(conn, db) {
  selectConnection(conn)
  selectedDatabase.value = db
}

async function selectDatabase(db) {
  selectedDatabase.value = db
  tables.value = []
  
  try {
    const result = await dbQueryTables(selectedConnection.value.name, db)
    
    if (result.success) {
      tables.value = result.tables
    } else {
      console.error('加载表列表失败:', result.error)
    }
  } catch (error) {
    console.error('加载表列表失败:', error)
  }
}

async function viewTableStructure(tableName) {
  if (!selectedDatabase.value) return
  
  try {
    const result = await dbGetTableStructure(
      selectedConnection.value.name,
      selectedDatabase.value,
      tableName
    )
    
    if (result.success) {
      const tabId = `query_${Date.now()}_structure_${Math.random().toString(36).substr(2, 9)}`
      tabs.value.push({
        id: tabId,
        name: `表结构 - ${tableName}`,
        type: 'query',
        closable: true,
        connectionName: selectedConnection.value.name,
        database: selectedDatabase.value,
        sqlQuery: `-- 表: ${tableName}\nDESCRIBE \`${tableName}\`;`,
        queryResult: {
          success: true,
          rows: result.fields,
          fields: [
            { name: 'Field' },
            { name: 'Type' },
            { name: 'Null' },
            { name: 'Key' },
            { name: 'Default' },
            { name: 'Extra' }
          ],
          duration: 0,
          rowCount: result.fields.length
        }
      })
      activeTabId.value = tabId
    } else {
      await showMessage('获取表结构失败: ' + result.error, 'error')
    }
  } catch (error) {
    console.error('获取表结构失败:', error)
    await showMessage('获取表结构失败: ' + error.message, 'error')
  }
}

function openNewGroupDialog() {
  editingGroup.value = null
  newGroupName.value = ''
  showGroupDialog.value = true
}

function editGroup(group) {
  editingGroup.value = group
  newGroupName.value = group.name
  showGroupDialog.value = true
}

function closeGroupDialog() {
  showGroupDialog.value = false
  editingGroup.value = null
  newGroupName.value = ''
}

async function saveGroup() {
  if (!newGroupName.value) {
    await showMessage('请输入分组名称', 'warning')
    return
  }
  
  try {
    const config = await getConfig()
    const dbConnectionGroups = config.dbConnectionGroups || []
    
    if (editingGroup.value) {
      const index = dbConnectionGroups.indexOf(editingGroup.value.name)
      if (index >= 0) {
        if (newGroupName.value !== editingGroup.value.name && dbConnectionGroups.includes(newGroupName.value)) {
          await showMessage('分组名称已存在', 'error')
          return
        }
        dbConnectionGroups[index] = newGroupName.value
        
        const dbConnections = config.dbConnections || []
        dbConnections.forEach(conn => {
          if (conn.group === editingGroup.value.name) {
            conn.group = newGroupName.value
          }
        })
      }
    } else {
      if (dbConnectionGroups.includes(newGroupName.value)) {
        await showMessage('分组名称已存在', 'error')
        return
      }
      dbConnectionGroups.push(newGroupName.value)
    }
    
    await saveConfig({ ...config, dbConnectionGroups })
    
    showGroupDialog.value = false
    editingGroup.value = null
    newGroupName.value = ''
    await loadConnections()
  } catch (error) {
    console.error('保存分组失败:', error)
    await showMessage('保存分组失败: ' + error.message, 'error')
  }
}

async function deleteGroup(groupName) {
  const confirmed = await showConfirm(`确定要删除分组 "${groupName}" 吗？分组内的连接将变为未分组状态。`)
  if (!confirmed) return
  
  try {
    const config = await getConfig()
    const dbConnectionGroups = config.dbConnectionGroups || []
    const index = dbConnectionGroups.indexOf(groupName)
    
    if (index >= 0) {
      dbConnectionGroups.splice(index, 1)
      
      const dbConnections = config.dbConnections || []
      dbConnections.forEach(conn => {
        if (conn.group === groupName) {
          conn.group = ''
        }
      })
      
      await saveConfig({ ...config, dbConnectionGroups })
      await loadConnections()
    }
  } catch (error) {
    console.error('删除分组失败:', error)
    await showMessage('删除分组失败: ' + error.message, 'error')
  }
}

function openManageDialog() {
  showManageDialog.value = true
}

function closeManageDialog() {
  showManageDialog.value = false
}

function openNewQuery(conn) {
  if (!conn.active) {
    selectConnection(conn)
    connectToDatabase()
  } else {
    selectConnection(conn)
  }
  createQueryTab(conn.name)
}

async function moveToGroup(conn, groupName) {
  try {
    const config = await getConfig()
    const dbConnections = config.dbConnections || []
    const index = dbConnections.findIndex(c => c.name === conn.name)
    
    if (index >= 0) {
      dbConnections[index].group = groupName
      await saveConfig({ ...config, dbConnections })
      await loadConnections()
    }
  } catch (error) {
    console.error('移动连接失败:', error)
    await showMessage('移动连接失败: ' + error.message, 'error')
  }
}

async function removeFromGroup(conn) {
  try {
    const config = await getConfig()
    const dbConnections = config.dbConnections || []
    const index = dbConnections.findIndex(c => c.name === conn.name)
    
    if (index >= 0) {
      dbConnections[index].group = ''
      await saveConfig({ ...config, dbConnections })
      await loadConnections()
    }
  } catch (error) {
    console.error('从组中删除失败:', error)
    await showMessage('从组中删除失败: ' + error.message, 'error')
  }
}

async function openDatabase(target) {
  if (!target.connection || !target.database) return
  await openDatabaseFromSidebar(target.connection, target.database)
}

function closeDatabase(target) {
  const key = `${target.connection.name}_${target.database}`
  
  openedDatabases.value = openedDatabases.value.filter(k => k !== key)
  
  expandedDatabases.value = expandedDatabases.value.filter(k => k !== key)
  
  expandedObjectCategories.value = expandedObjectCategories.value.filter(k => 
    !k.startsWith(`${key}_`)
  )
  
  const tabsToClose = tabs.value.filter(t => 
    t.type === 'query' && 
    t.connectionName === target.connection.name && 
    t.database === target.database
  )
  
  tabsToClose.forEach(t => {
    const index = tabs.value.findIndex(tab => tab.id === t.id)
    if (index >= 0) {
      tabs.value.splice(index, 1)
    }
  })
  
  if (tabsToClose.length > 0 && tabsToClose.some(t => t.id === activeTabId.value)) {
    const remainingTabs = tabs.value.filter(t => t.id !== activeTabId.value)
    if (remainingTabs.length > 0) {
      activeTabId.value = remainingTabs[remainingTabs.length - 1].id
    } else {
      activeTabId.value = 'object'
    }
  }
  
  if (selectedDatabase.value === target.database) {
    selectedDatabase.value = ''
    tables.value = []
    clearObjectInfo()
  }
}

function startSidebarResize(e) {
  isResizingSidebar.value = true
  document.addEventListener('mousemove', handleSidebarResize)
  document.addEventListener('mouseup', stopSidebarResize)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

function handleSidebarResize(e) {
  if (!isResizingSidebar.value) return
  const newWidth = e.clientX
  if (newWidth >= 180 && newWidth <= 400) {
    sidebarWidth.value = newWidth
    localStorage.setItem('databaseSidebarWidth', newWidth.toString())
  }
}

function stopSidebarResize() {
  isResizingSidebar.value = false
  document.removeEventListener('mousemove', handleSidebarResize)
  document.removeEventListener('mouseup', stopSidebarResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

function startInfoPanelResize(e) {
  isResizingInfoPanel.value = true
  document.addEventListener('mousemove', handleInfoPanelResize)
  document.addEventListener('mouseup', stopInfoPanelResize)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

function handleInfoPanelResize(e) {
  if (!isResizingInfoPanel.value) return
  const containerWidth = document.querySelector('.main-content')?.clientWidth || window.innerWidth
  const newWidth = containerWidth - e.clientX - sidebarWidth.value
  if (newWidth >= 200 && newWidth <= 500) {
    infoPanelWidth.value = newWidth
    localStorage.setItem('databaseInfoPanelWidth', newWidth.toString())
  }
}

function stopInfoPanelResize() {
  isResizingInfoPanel.value = false
  document.removeEventListener('mousemove', handleInfoPanelResize)
  document.removeEventListener('mouseup', stopInfoPanelResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

watch(layoutMode, (newMode) => {
  localStorage.setItem('databaseLayoutMode', newMode)
})

async function editDatabase(target) {
  if (!target.connection || !target.database) return
  selectConnection(target.connection)
  await selectDatabase(target.database)
  
  createQueryTab(target.connection.name, target.database)
  const activeTab = tabs.value.find(t => t.id === activeTabId.value)
  if (activeTab) {
    activeTab.sqlQuery = `-- 编辑数据库: ${target.database}\n-- 修改数据库字符集\nALTER DATABASE \`${target.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  }
}

async function deleteDatabase(target) {
  if (!target.connection || !target.database) return
  
  const confirmed = await showConfirm(`确定要删除数据库 "${target.database}" 吗？此操作不可恢复！`)
  if (!confirmed) return
  
  selectConnection(target.connection)
  
  const result = await executeSqlDirect(`DROP DATABASE \`${target.database}\`;`, target.connection.name)
  
  if (result.success) {
    await loadConnectionDatabases(target.connection.name)
    if (selectedDatabase.value === target.database) {
      selectedDatabase.value = ''
      tables.value = []
    }
    await showMessage(`数据库 "${target.database}" 已删除`, 'success')
  } else {
    await showMessage('删除数据库失败: ' + result.error, 'error')
  }
}

function newQueryForDatabase(target) {
  if (!target.connection || !target.database) return
  selectConnection(target.connection)
  if (!target.connection.active) {
    connectToDatabase()
  }
  createQueryTab(target.connection.name, target.database)
}

async function runSqlFile(target) {
  if (!target.connection) return
  
  try {
    const result = await selectSqlFile()
    
    if (result.canceled || !result.filePaths.length) return
    
    const filePath = result.filePaths[0]
    const fileResult = await readFile(filePath)
    
    if (!fileResult.success) {
      await showMessage('读取文件失败: ' + fileResult.error, 'error')
      return
    }
    
    const sqlContent = fileResult.content
    
    selectConnection(target.connection)
    
    if (!target.connection.active) {
      await connectToDatabase()
    }
    
    const sql = target.database ? `USE \`${target.database}\`;\n${sqlContent}` : sqlContent
    
    const execResult = await executeSqlDirect(sql, target.connection.name)
    
    if (execResult.success) {
      await showMessage('SQL文件执行成功', 'success')
    } else {
      await showMessage('SQL文件执行失败: ' + execResult.error, 'error')
    }
  } catch (error) {
    console.error('运行SQL文件失败:', error)
    await showMessage('运行SQL文件失败: ' + error.message, 'error')
  }
}

async function dumpDatabase(target, type) {
  if (!target.connection || !target.database) return
  
  try {
    selectConnection(target.connection)
    
    let dumpContent = ''
    
    if (type === 'structure' || type === 'data') {
      dumpContent += `-- 数据库转储: ${target.database}\\n`
      dumpContent += `-- 生成时间: ${new Date().toISOString()}\\n`
      dumpContent += `-- 连接: ${target.connection.host}:${target.connection.port}\\n\\n`
      
      dumpContent += `CREATE DATABASE IF NOT EXISTS \`${target.database}\`;\\n`
      dumpContent += `USE \`${target.database}\`;\\n\\n`
    }
    
    if (!target.connection.active) {
      await connectToDatabase()
    }
    
    const tablesResult = await dbQueryTables(target.connection.name, target.database)
    if (!tablesResult.success) {
      await showMessage('获取表列表失败', 'error')
      return
    }
    
    for (const tableName of tablesResult.tables) {
      if (type === 'structure' || type === 'data') {
        const structureResult = await dbGetTableStructure(target.connection.name, target.database, tableName)
        if (structureResult.success) {
          dumpContent += `-- 表结构: ${tableName}\\n`
          dumpContent += `DROP TABLE IF EXISTS \`${tableName}\`;\\n`
          
          const createTableParts = []
          for (const field of structureResult.fields) {
            const fieldDef = `  \`${field.Field}\` ${field.Type}`
            const nullDef = field.Null === 'NO' ? ' NOT NULL' : ''
            const defaultDef = field.Default !== null ? ` DEFAULT '${field.Default}'` : ''
            const extraDef = field.Extra || ''
            createTableParts.push(`${fieldDef}${nullDef}${defaultDef} ${extraDef}`)
          }
          
          dumpContent += `CREATE TABLE \`${tableName}\` (\\n${createTableParts.join(',\\n')}\\n);\\n\\n`
        }
      }
      
      if (type === 'data') {
        const dataResult = await dbExecuteQuery(
          target.connection.name,
          `SELECT * FROM \`${tableName}\``,
          [],
          { autoLimit: false }
        )
        
        if (dataResult.success && dataResult.rows?.length > 0) {
          dumpContent += `-- 表数据: ${tableName} (${dataResult.rows.length} 行)\\n`
          
          for (const row of dataResult.rows) {
            const values = dataResult.fields.map(f => {
              const val = row[f.name]
              if (val === null) return 'NULL'
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
              return val
            })
            dumpContent += `INSERT INTO \`${tableName}\` (${dataResult.fields.map(f => `\`${f.name}\``).join(',')}) VALUES (${values.join(',')});\\n`
          }
          dumpContent += '\\n'
        }
      }
    }
    
    const defaultFileName = `${target.database}_${type}_${Date.now()}.sql`
    const saveResult = await saveSqlFile(defaultFileName)
    
    if (saveResult.canceled || !saveResult.filePath) return
    
    const writeResult = await writeFile(saveResult.filePath, dumpContent)
    
    if (writeResult.success) {
      await showMessage(`转储文件已保存到: ${saveResult.filePath}`, 'success')
    } else {
      await showMessage('保存文件失败: ' + writeResult.error, 'error')
    }
    
  } catch (error) {
    console.error('转储数据库失败:', error)
    await showMessage('转储数据库失败: ' + error.message, 'error')
  }
}

async function refreshDatabase(target) {
  if (!target.connection) return
  
  selectConnection(target.connection)
  await loadConnectionDatabases(target.connection.name)
  
  if (target.database) {
    await selectDatabase(target.database)
  }
  
  await showMessage('数据库列表已刷新', 'success')
}

async function refreshCategory(target) {
  if (!target.connection || !target.database || !target.category) return
  
  selectConnection(target.connection)
  
  if (!target.connection.active) {
    await connectToDatabase()
  }
  
  await loadDatabaseObjects(target.connection.name, target.database)
  
  const categoryName = target.category === 'tables' ? '表' : target.category === 'views' ? '视图' : '函数'
  await showMessage(`${categoryName}列表已刷新`, 'success')
}

async function openTable(target) {
  if (!target.connection || !target.database || !target.table) return
  
  selectConnection(target.connection)
  selectedDatabase.value = target.database
  
  if (!target.connection.active) {
    await connectToDatabase()
  }
  
  const tab = createTableTab(target.connection.name, target.database, target.table)
  if (tab) {
    await executeTableQuery(tab)
  }
}

async function executeTableQuery(tab) {
  if (!tab.connectionName || !tab.database || !tab.tableName) return
  
  tab.executing = true
  tab.queryResult = null
  
  try {
    await dbExecuteQuery(tab.connectionName, `USE \`${tab.database}\``, [], { autoLimit: false })
    
    const limitValue = autoLimit.value ? limitCount.value : 100
    const sql = `SELECT * FROM \`${tab.tableName}\` LIMIT ${limitValue}`
    
    const startTime = Date.now()
    const result = await dbExecuteQuery(tab.connectionName, sql, [], { autoLimit: false })
    const endTime = Date.now()
    
    const totalRows = result.rowCount || (result.rows ? result.rows.length : 0)
    const totalPages = Math.ceil(totalRows / limitCount.value) || 1
    
    tab.queryResult = {
      success: result.success,
      rows: result.rows,
      fields: result.fields,
      error: result.error,
      duration: endTime - startTime,
      rowCount: result.rowCount || 0,
      totalRows: totalRows,
      currentPage: 1,
      totalPages: totalPages,
      jumpPage: null,
      isSelect: true
    }
    
    if (result.fields) {
      tab.fieldOrder = result.fields.map(f => f.name)
    }
  } catch (error) {
    console.error('查询表数据失败:', error)
    tab.queryResult = {
      success: false,
      error: error.message
    }
  } finally {
    tab.executing = false
  }
}

let draggedFieldName = null

function onFieldDragStart(event, tab, fieldName) {
  draggedFieldName = fieldName
  event.dataTransfer.effectAllowed = 'move'
}

function onFieldDragOver(event) {
  event.dataTransfer.dropEffect = 'move'
}

function onFieldDrop(event, tab, fieldName) {
  if (!draggedFieldName || draggedFieldName === fieldName) return
  
  const fieldOrder = tab.fieldOrder || tab.queryResult.fields.map(f => f.name)
  const draggedIndex = fieldOrder.indexOf(draggedFieldName)
  const targetIndex = fieldOrder.indexOf(fieldName)
  
  if (draggedIndex !== -1 && targetIndex !== -1) {
    const newOrder = [...fieldOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedFieldName)
    tab.fieldOrder = newOrder
  }
  
  draggedFieldName = null
}

async function deleteTable(target) {
  if (!target.connection || !target.database || !target.table) return
  
  const confirmed = await showConfirm(`确定要删除表 "${target.table}" 吗？此操作不可恢复！`)
  if (!confirmed) return
  
  selectConnection(target.connection)
  
  const result = await executeSqlDirect(`DROP TABLE \`${target.database}\`.\`${target.table}\`;`, target.connection.name)
  
  if (result.success) {
    await loadDatabaseObjects(target.connection.name, target.database)
    await showMessage(`表 "${target.table}" 已删除`, 'success')
  } else {
    await showMessage('删除表失败: ' + result.error, 'error')
  }
}

async function emptyTable(target) {
  if (!target.connection || !target.database || !target.table) return
  
  const confirmed = await showConfirm(`确定要清空表 "${target.table}" 的所有数据吗？此操作不可恢复！`)
  if (!confirmed) return
  
  selectConnection(target.connection)
  
  const result = await executeSqlDirect(`DELETE FROM \`${target.database}\`.\`${target.table}\`;`, target.connection.name)
  
  if (result.success) {
    await showMessage(`表 "${target.table}" 已清空`, 'success')
  } else {
    await showMessage('清空表失败: ' + result.error, 'error')
  }
}

async function truncateTable(target) {
  if (!target.connection || !target.database || !target.table) return
  
  const confirmed = await showConfirm(`确定要截断表 "${target.table}" 吗？此操作将删除所有数据并重置自增ID，不可恢复！`)
  if (!confirmed) return
  
  selectConnection(target.connection)
  
  const result = await executeSqlDirect(`TRUNCATE TABLE \`${target.database}\`.\`${target.table}\`;`, target.connection.name)
  
  if (result.success) {
    await showMessage(`表 "${target.table}" 已截断`, 'success')
  } else {
    await showMessage('截断表失败: ' + result.error, 'error')
  }
}

async function copyTable(target, type) {
  if (!target.connection || !target.database || !target.table) return
  
  const newTableName = `${target.table}_copy`
  
  selectConnection(target.connection)
  
  if (type === 'structure') {
    const result = await executeSqlDirect(`CREATE TABLE \`${target.database}\`.\`${newTableName}\` LIKE \`${target.database}\`.\`${target.table}\`;`, target.connection.name)
    
    if (result.success) {
      await loadDatabaseObjects(target.connection.name, target.database)
      await showMessage(`表结构已复制到 "${newTableName}"`, 'success')
    } else {
      await showMessage('复制表结构失败: ' + result.error, 'error')
    }
  } else {
    const createResult = await executeSqlDirect(`CREATE TABLE \`${target.database}\`.\`${newTableName}\` LIKE \`${target.database}\`.\`${target.table}\`;`, target.connection.name)
    
    if (!createResult.success) {
      await showMessage('复制表结构失败: ' + createResult.error, 'error')
      return
    }
    
    const insertResult = await executeSqlDirect(`INSERT INTO \`${target.database}\`.\`${newTableName}\` SELECT * FROM \`${target.database}\`.\`${target.table}\`;`, target.connection.name)
    
    if (insertResult.success) {
      await loadDatabaseObjects(target.connection.name, target.database)
      await showMessage(`表已复制到 "${newTableName}"（包含数据）`, 'success')
    } else {
      await showMessage('复制表数据失败: ' + insertResult.error, 'error')
    }
  }
}

async function dumpTable(target, type) {
  if (!target.connection || !target.database || !target.table) return
  
  try {
    selectConnection(target.connection)
    
    if (!target.connection.active) {
      await connectToDatabase()
    }
    
    let dumpContent = ''
    dumpContent += `-- 表转储: ${target.table}\n`
    dumpContent += `-- 数据库: ${target.database}\n`
    dumpContent += `-- 生成时间: ${new Date().toISOString()}\n`
    dumpContent += `-- 连接: ${target.connection.host}:${target.connection.port}\n\n`
    
    dumpContent += `USE \`${target.database}\`;\n\n`
    
    const structureResult = await dbGetTableStructure(target.connection.name, target.database, target.table)
    
    if (structureResult.success) {
      dumpContent += `-- 表结构: ${target.table}\n`
      dumpContent += `DROP TABLE IF EXISTS \`${target.table}\`;\n`
      
      const createTableParts = []
      for (const field of structureResult.fields) {
        const fieldDef = `  \`${field.Field}\` ${field.Type}`
        const nullDef = field.Null === 'NO' ? ' NOT NULL' : ''
        const defaultDef = field.Default !== null ? ` DEFAULT '${field.Default}'` : ''
        const extraDef = field.Extra || ''
        createTableParts.push(`${fieldDef}${nullDef}${defaultDef} ${extraDef}`)
      }
      
      dumpContent += `CREATE TABLE \`${target.table}\` (\n${createTableParts.join(',\n')}\n);\n\n`
    }
    
    if (type === 'structure_data') {
      const dataResult = await dbExecuteQuery(
        target.connection.name,
        `SELECT * FROM \`${target.table}\``,
        [],
        { autoLimit: false }
      )
      
      if (dataResult.success && dataResult.rows?.length > 0) {
        dumpContent += `-- 表数据: ${target.table} (${dataResult.rows.length} 行)\n`
        
        for (const row of dataResult.rows) {
          const values = dataResult.fields.map(f => {
            const val = row[f.name]
            if (val === null) return 'NULL'
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`
            return val
          })
          dumpContent += `INSERT INTO \`${target.table}\` (${dataResult.fields.map(f => `\`${f.name}\``).join(',')}) VALUES (${values.join(',')});\n`
        }
      }
    }
    
    const defaultFileName = `${target.table}_${type}_${Date.now()}.sql`
    const saveResult = await saveSqlFile(defaultFileName)
    
    if (saveResult.canceled || !saveResult.filePath) return
    
    const writeResult = await writeFile(saveResult.filePath, dumpContent)
    
    if (writeResult.success) {
      await showMessage(`转储文件已保存到: ${saveResult.filePath}`, 'success')
    } else {
      await showMessage('保存文件失败: ' + writeResult.error, 'error')
    }
    
  } catch (error) {
    console.error('转储表失败:', error)
    await showMessage('转储表失败: ' + error.message, 'error')
  }
}

async function renameTable(target) {
  if (!target.connection || !target.database || !target.table) return
  
  const newTableName = await showPrompt('请输入新的表名：', target.table)
  if (!newTableName || newTableName === target.table) return
  
  const confirmed = await showConfirm(`确定要将表 "${target.table}" 重命名为 "${newTableName}" 吗？`)
  if (!confirmed) return
  
  selectConnection(target.connection)
  
  const result = await executeSqlDirect(`RENAME TABLE \`${target.database}\`.\`${target.table}\` TO \`${target.database}\`.\`${newTableName}\`;`, target.connection.name)
  
  if (result.success) {
    await loadDatabaseObjects(target.connection.name, target.database)
    await showMessage(`表已重命名为 "${newTableName}"`, 'success')
  } else {
    await showMessage('重命名表失败: ' + result.error, 'error')
  }
}

async function refreshTable(target) {
  if (!target.connection || !target.database) return
  
  selectConnection(target.connection)
  await loadDatabaseObjects(target.connection.name, target.database)
  await showMessage('表列表已刷新', 'success')
}
</script>

<style scoped>
.database-container {
  width: 100%;
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

header {
  background: linear-gradient(135deg, 
    rgba(102, 126, 234, 0.95) 0%, 
    rgba(118, 75, 162, 0.95) 100%
  );
  color: white;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 72px;
}

header h1 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 700;
  margin: 0;
}

.header-title-text {
  letter-spacing: 1px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-divider {
  width: 1px;
  height: 48px;
  background: rgba(255, 255, 255, 0.25);
}

.header-shortcuts {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition-normal);
  min-width: 64px;
}

.shortcut-item:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.shortcut-icon {
  width: 22px;
  height: 22px;
}

.shortcut-text {
  font-size: 13px;
  font-weight: 500;
}

.header-stats {
  display: flex;
  align-items: stretch;
  gap: 8px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  transition: var(--transition-normal);
  min-width: 56px;
  opacity: 0.85;
}

.stat-icon {
  width: 20px;
  height: 20px;
}

.stat-icon.fx-icon {
  width: 32px;
  height: 18px;
}

.stat-text {
  font-size: 13px;
  font-weight: 500;
}

.stat-item.clickable {
  cursor: pointer;
}

.stat-item.clickable:hover {
  background: rgba(102, 126, 234, 0.1);
  opacity: 1;
}

.header-icon {
  width: 26px;
  height: 26px;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.sidebar {
  width: 240px;
  min-width: 180px;
  max-width: 400px;
  border-right: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.6);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding: 0 5px 0 5px;
  position: relative;
}

.sidebar-resize-handle {
  position: absolute;
  right: 0;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 10;
}

.sidebar-resize-handle:hover {
  background: rgba(102, 126, 234, 0.3);
}

.sidebar-resize-handle:active {
  background: rgba(102, 126, 234, 0.5);
}

.sidebar-header {
  padding: 12px 8px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  cursor: default;
}

.sidebar-header.drag-over {
  background: rgba(102, 126, 234, 0.15);
  border-bottom: 2px dashed var(--primary-color);
}

.sidebar-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  width: 18px;
  height: 18px;
}

.btn-icon {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--primary-gradient);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-normal);
}

.btn-icon:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-icon svg {
  width: 16px;
  height: 16px;
}

.connection-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.group-item {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
  background: rgba(255, 255, 255, 0.3);
  margin-bottom: 2px;
}

.group-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.group-item.drag-over {
  background: rgba(102, 126, 234, 0.2);
  border: 2px dashed var(--primary-color);
}

.group-arrow {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.group-arrow.expanded {
  transform: rotate(90deg);
}

.group-folder-icon {
  width: 18px;
  height: 18px;
  color: #e6a23c;
  flex-shrink: 0;
}

.group-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
}

.group-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
  background: rgba(128, 128, 128, 0.2);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
}

.group-connections {
  padding-left: 12px;
}

.connection-wrapper {
  display: flex;
  flex-direction: column;
}

.connection-container {
  display: flex;
  flex-direction: column;
}

.connection-item {
  padding: 10px 12px;
  margin-bottom: 2px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-normal);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid transparent;
}

.connection-item:hover {
  background: rgba(255, 255, 255, 0.7);
  border-color: var(--primary-color);
}

.connection-item.active {
  background: rgba(102, 126, 234, 0.15);
  border-color: var(--primary-color);
}

.connection-item.dragging {
  opacity: 0.5;
  background: rgba(102, 126, 234, 0.3);
}

.connection-expand-placeholder {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.connection-expand-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
  color: var(--text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
}

.connection-expand-icon:hover {
  color: var(--text-primary);
}

.connection-expand-icon.expanded {
  transform: rotate(90deg);
}

.connection-type-icon {
  width: 18px;
  height: 18px;
  color: #409eff;
  flex-shrink: 0;
}

.connection-databases {
  padding-left: 16px;
  margin-bottom: 4px;
}

.connection-databases .database-wrapper {
  display: flex;
  flex-direction: column;
}

.connection-databases .database-item {
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
  background: rgba(255, 255, 255, 0.2);
}

.connection-databases .database-item:hover {
  background: rgba(255, 255, 255, 0.5);
}

.connection-databases .database-item.active {
  background: rgba(102, 126, 234, 0.15);
}

.connection-databases .db-icon {
  width: 16px;
  height: 16px;
  color: #808080;
  flex-shrink: 0;
}

.connection-databases .db-icon.active {
  color: #228b22;
}

.connection-databases .db-name {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
}

.connection-databases .db-expand-placeholder {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.connection-databases .db-expand-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
}

.connection-databases .db-expand-icon:hover {
  color: var(--text-primary);
}

.connection-databases .db-expand-icon.expanded {
  transform: rotate(90deg);
}

.connection-databases .db-icon.opened {
  color: #228b22;
}

.database-objects {
  padding-left: 24px;
  margin-top: 2px;
}

.object-category {
  margin-bottom: 1px;
}

.category-header {
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
  background: rgba(255, 255, 255, 0.15);
}

.category-header:hover {
  background: rgba(255, 255, 255, 0.25);
}

.category-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.category-icon.expanded {
  transform: rotate(90deg);
}

.category-type-icon {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.category-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.category-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
  background: rgba(128, 128, 128, 0.15);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
}

.category-items {
  padding-left: 12px;
}

.object-item {
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
}

.object-item:hover {
  background: rgba(255, 255, 255, 0.3);
}

.object-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.object-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.table-icon {
  color: #409eff;
}

.view-icon {
  color: #67c23a;
}

.function-icon {
  width: 22px;
  height: 12px;
  color: #e6a23c;
}

.object-name {
  font-size: 13px;
}

.connection-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
}

.status-badge {
  font-size: 12px;
  font-weight: 400;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
}

.status-badge.active {
  background: rgba(34, 139, 34, 0.2);
  color: #228b22;
}

.empty-list {
  text-align: center;
  padding: 20px;
  color: var(--text-tertiary);
}

.empty-list p {
  margin: 0;
  font-size: 13px;
}

.empty-list .hint {
  font-size: 11px;
  margin-top: 8px;
}

.context-menu {
  position: fixed;
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 6px 0;
  min-width: 180px;
  z-index: 2000;
}

.menu-item {
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
  transition: var(--transition-normal);
}

.menu-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.menu-item.danger {
  color: #c42b1c;
}

.menu-item.danger:hover {
  background: rgba(196, 43, 28, 0.1);
}

.menu-item svg {
  width: 16px;
  height: 16px;
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 6px 12px;
}

.menu-item.has-submenu {
  position: relative;
}

.submenu-arrow {
  width: 14px;
  height: 14px;
  margin-left: auto;
}

.submenu {
  position: absolute;
  left: 100%;
  top: -4px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px 0;
  min-width: 140px;
  display: none;
  z-index: 2001;
}

.menu-item.has-submenu:hover .submenu {
  display: block;
}

.submenu-header {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--text-tertiary);
  font-weight: 600;
  text-transform: uppercase;
}

.menu-item.disabled {
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.menu-item.disabled:hover {
  background: transparent;
}

.main-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.3);
}

.connection-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.6);
}

.tabs-container {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: var(--transition-normal);
  white-space: nowrap;
}

.tab-item:hover {
  background: rgba(102, 126, 234, 0.05);
  color: var(--text-primary);
}

.tab-item.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  background: rgba(102, 126, 234, 0.1);
}

.tab-name {
  font-weight: 500;
}

.tab-close-btn {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  font-size: 14px;
  font-weight: 400;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-normal);
  line-height: 1;
}

.tab-close-btn:hover {
  background: rgba(196, 43, 28, 0.2);
  color: #c42b1c;
}

.object-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.object-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.object-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.object-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.6);
}

.object-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.object-type-icon {
  width: 18px;
  height: 18px;
}

.object-type-icon.database {
  color: #228b22;
}

.object-type-icon.table {
  color: #409eff;
}

.object-type-icon.view {
  color: #67c23a;
}

.object-type-icon.function {
  color: #e6a23c;
}

.object-type-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
  background: rgba(128, 128, 128, 0.15);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
}

.object-search {
  width: 200px;
}

.search-input {
  width: 100%;
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
  transition: var(--transition-normal);
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.object-tables,
.object-detail {
  flex: 1;
  overflow: hidden;
  padding: 8px;
}

.object-loading,
.object-empty-list {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  font-size: 13px;
}

.tables-list,
.structure-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.tables-header,
.structure-header {
  display: flex;
  padding: 8px 12px;
  background: rgba(102, 126, 234, 0.1);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.tables-body,
.structure-body {
  flex: 1;
  overflow-y: auto;
}

.table-row,
.structure-row {
  display: flex;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: var(--transition-normal);
}

.table-row:hover,
.structure-row:hover {
  background: rgba(102, 126, 234, 0.05);
}

.table-row:last-child,
.structure-row:last-child {
  border-bottom: none;
}

.col-name {
  flex: 2;
  min-width: 120px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.col-rows,
.col-size {
  flex: 1;
  min-width: 80px;
}

.col-engine {
  flex: 1;
  min-width: 60px;
}

.col-modified {
  flex: 1;
  min-width: 100px;
}

.col-comment {
  flex: 2;
  min-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-field {
  flex: 1.5;
  min-width: 100px;
}

.col-type {
  flex: 1.5;
  min-width: 100px;
}

.col-null {
  flex: 0.5;
  min-width: 60px;
}

.col-key {
  flex: 0.5;
  min-width: 40px;
}

.col-default {
  flex: 1;
  min-width: 80px;
}

.col-extra {
  flex: 1;
  min-width: 80px;
}

.table-icon-small {
  width: 14px;
  height: 14px;
  color: #409eff;
}

.view-definition,
.function-definition {
  padding: 12px;
}

.definition-label {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.definition-code {
  padding: 12px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--text-secondary);
  overflow: auto;
  max-height: 300px;
  white-space: pre-wrap;
  word-break: break-all;
}

.query-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.query-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.result-body {
  flex: 1;
  overflow: hidden;
}

.query-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 8px;
}

.query-body.has-result .query-editor-wrapper {
  flex: 0 0 50%;
}

.query-editor-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.4);
}

.query-result-wrapper {
  flex: 0 0 50%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.result-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.4);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.result-info {
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 400;
}

.result-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
}

.result-tab {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
}

.result-tab:hover {
  background: rgba(102, 126, 234, 0.1);
  color: var(--text-primary);
}

.result-tab.active {
  background: var(--primary-color);
  color: white;
}

.result-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.result-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.query-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--border-color);
  border-radius: 0;
}

.table-query-toolbar {
  border-bottom: 1px solid var(--border-color);
  justify-content: flex-start;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  transition: var(--transition-normal);
}

.toolbar-btn:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.08);
  color: var(--text-primary);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn.active {
  background: rgba(102, 126, 234, 0.15);
  color: var(--primary-color);
}

.toolbar-btn-icon {
  width: 16px;
  height: 16px;
}

.toolbar-btn-text {
  font-size: 13px;
  font-weight: 400;
}

.table-query-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.query-result-wrapper.full-height {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.th-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.th-name {
  flex: 1;
  font-weight: 600;
}

.th-actions {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: var(--transition-normal);
  border-radius: 3px;
}

.th-actions svg {
  width: 16px;
  height: 16px;
}

th:hover .th-actions {
  opacity: 1;
}

.th-actions:hover {
  background: rgba(102, 126, 234, 0.1);
}

th.has-sort {
  background: rgba(102, 126, 234, 0.05);
}

th.sort-asc .th-name::after,
th.sort-desc .th-name::after {
  margin-left: 4px;
}

th.sort-asc .th-name::after {
  content: '↑';
  color: var(--primary-color);
}

th.sort-desc .th-name::after {
  content: '↓';
  color: var(--primary-color);
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.toolbar-select-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.toolbar-icon {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
}

.toolbar-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  font-weight: 400;
  color: var(--text-primary);
  min-width: 80px;
  max-width: 120px;
  cursor: pointer;
}

.toolbar-select:focus {
  outline: none;
  border-color: var(--primary-color);
}

.btn-icon-text {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-icon-text svg {
  width: 14px;
  height: 14px;
}

.btn-small {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--primary-gradient);
  color: white;
  transition: var(--transition-normal);
}

.query-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 0;
  background: rgba(255, 255, 255, 0.6);
}

.result-footer {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 6px 12px;
  height: 40px;
  background: rgba(255, 255, 255, 0.6);
  border-top: 1px solid var(--border-color);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.result-stats {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  line-height: 28px;
}

.footer-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 12px;
}

.footer-settings {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
  flex-shrink: 0;
}

.footer-settings:hover,
.footer-settings.active {
  background: rgba(102, 126, 234, 0.1);
}

.footer-settings.active svg {
  color: var(--primary-color);
}

.footer-settings svg {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}

.footer-settings-panel {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 12px;
  background: var(--glass-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
}

.settings-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
}

.settings-checkbox input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.settings-checkbox input:checked + span {
  color: var(--text-primary);
}

.settings-limit-input {
  display: flex;
  align-items: center;
  gap: 6px;
}

.limit-input {
  width: 64px;
  height: 24px;
  padding: 4px 8px;
  font-size: 13px;
  font-weight: 400;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  color: var(--text-primary);
}

.limit-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.limit-label {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-secondary);
  white-space: nowrap;
}

.pagination-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: var(--transition-normal);
}

.pagination-btn:hover:not(:disabled) {
  background: rgba(102, 126, 234, 0.1);
  border-color: var(--primary-color);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-btn svg {
  width: 14px;
  height: 14px;
  color: var(--text-secondary);
}

.pagination-input {
  width: 44px;
  padding: 4px 6px;
  border: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  font-weight: 400;
  color: var(--text-primary);
  text-align: center;
  height: 24px;
  line-height: 16px;
}

.pagination-input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.pagination-separator {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
}

.pagination-total {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.dialog-small {
  width: 320px;
}

.result-header {
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  color: var(--text-primary);
}

.result-info {
  color: var(--text-tertiary);
  font-size: 11px;
}

.result-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-table {
  border-collapse: collapse;
  font-size: 13px;
  font-weight: 400;
  white-space: nowrap;
}

.result-table th,
.result-table td {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  text-align: left;
}

.result-content {
  flex: 1;
  overflow: hidden;
}

.result-table-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.result-table-scroll {
  flex: 1;
  overflow: auto;
}

.result-table th.auto-width {
  white-space: nowrap;
}

.result-table th {
  background: rgba(102, 126, 234, 0.1);
  font-weight: 600;
  color: var(--text-primary);
  position: sticky;
  top: 0;
  z-index: 1;
}

.result-table tr:hover {
  background: rgba(102, 126, 234, 0.05);
}

.result-hint {
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-tertiary);
  background: rgba(255, 200, 50, 0.1);
  border-top: 1px solid var(--border-color);
}

.result-empty {
  color: var(--text-tertiary);
  text-align: center;
  padding: 20px;
}

.result-error {
  color: #c42b1c;
  padding: 12px;
}

.empty-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.btn-small {
  padding: 6px 14px;
  font-size: 12px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: var(--primary-gradient);
  color: white;
  transition: var(--transition-normal);
}

.btn-small:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-small:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small.btn-secondary {
  background: rgba(128, 128, 128, 0.3);
  color: var(--text-primary);
}

.btn-small.btn-secondary:hover:not(:disabled) {
  background: rgba(128, 128, 128, 0.5);
}

.btn-small.btn-danger {
  background: linear-gradient(135deg, #c42b1c, #d63c2d);
}

.btn-small.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-icon-sm {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  background: rgba(128, 128, 128, 0.2);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-normal);
}

.btn-icon-sm:hover {
  background: rgba(102, 126, 234, 0.2);
  color: var(--primary-color);
}

.btn-icon-sm.btn-danger:hover {
  background: rgba(196, 43, 28, 0.2);
  color: #c42b1c;
}

.btn-icon-sm svg {
  width: 14px;
  height: 14px;
}

.auto-limit-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
}

.auto-limit-label input {
  cursor: pointer;
}

.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.dialog {
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  width: 400px;
  max-width: 90%;
}

.dialog-large {
  width: 500px;
}

.dialog-header {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  font-size: 18px;
  font-weight: 400;
  cursor: pointer;
  padding: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-normal);
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--text-primary);
}

.dialog-content {
  padding: 14px 20px;
  max-height: 50vh;
  overflow-y: auto;
}

.manage-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.manage-list {
  background: rgba(255, 255, 255, 0.5);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.manage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.manage-groups {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.manage-group-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.manage-group-actions {
  display: flex;
  gap: 4px;
}

.manage-empty {
  text-align: center;
  color: var(--text-tertiary);
  font-size: 12px;
  padding: 12px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-field {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.8);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 400;
  box-sizing: border-box;
  transition: var(--transition-normal);
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.dialog-footer {
  padding: 18px 24px;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  padding: 0 20px;
}

.dialog-tab {
  padding: 14px 24px;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: var(--transition-normal);
}

.dialog-tab:hover {
  color: var(--text-primary);
}

.dialog-tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.checkbox-label-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-primary);
}

.checkbox-label-inline input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
  margin: 0;
  flex-shrink: 0;
}

.checkbox-label-inline span {
  display: inline-block;
}

.form-inline-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
}

.form-label-inline {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  min-width: 80px;
}

.checkbox-label-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  color: var(--text-primary);
}

.checkbox-label-inline input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
  margin: 0;
  flex-shrink: 0;
}

.checkbox-label-inline span {
  display: inline-block;
}

.input-field-inline {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.8);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 400;
  transition: var(--transition-normal);
}

.input-field-inline:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.input-field-inline:disabled {
  background: rgba(200, 200, 200, 0.3);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.input-port {
  flex: none;
  width: 100px;
}

.input-username {
  flex: none;
  width: 50%;
}

.input-password {
  flex: none;
  width: 50%;
}

.status-bar {
  height: 32px;
  padding: 0 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  border-top: 1px solid var(--border-color);
  font-size: 13px;
  font-weight: 400;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
}

.status-item.connected {
  color: #228b22;
}

.status-item.disconnected {
  color: var(--text-tertiary);
}

.status-item.empty {
  color: var(--text-tertiary);
}

.status-icon {
  width: 14px;
  height: 14px;
}

.status-icon.db-icon {
  color: #228b22;
}

.status-divider {
  color: var(--border-color);
  margin: 0 6px;
}

.sql-preview {
  color: var(--text-tertiary);
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.copy-btn {
  width: 20px;
  height: 20px;
  padding: 2px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-normal);
}

.copy-btn:hover {
  background: rgba(102, 126, 234, 0.1);
  color: var(--primary-color);
}

.copy-btn svg {
  width: 14px;
  height: 14px;
}

.sql-time {
  color: var(--text-tertiary);
  font-size: 12px;
  font-weight: 400;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.layout-btn {
  width: 26px;
  height: 26px;
  padding: 3px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-normal);
}

.layout-btn:hover {
  background: rgba(102, 126, 234, 0.1);
  color: var(--text-secondary);
}

.layout-btn.active {
  background: rgba(102, 126, 234, 0.2);
  color: var(--primary-color);
}

.layout-btn svg {
  width: 18px;
  height: 18px;
}

.sidebar-wide {
  width: 220px;
}

.panel-wide {
  flex: 1;
}

.panel-wide .connection-panel {
  flex: 2;
}

.panel-wide .object-panel {
  flex: 1;
}

.panel-wide .query-panel {
  flex: 2;
}

.panel-wide .query-content {
  flex: 1;
}

.info-panel {
  width: 280px;
  min-width: 200px;
  max-width: 500px;
  border-left: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

.info-panel-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: ew-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 10;
}

.info-panel-resize-handle:hover {
  background: rgba(102, 126, 234, 0.3);
}

.info-panel-resize-handle:active {
  background: rgba(102, 126, 234, 0.5);
}

.info-panel-toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  gap: 8px;
  justify-content: center;
}

.info-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-header-icon {
  width: 36px;
  height: 36px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: rgba(102, 126, 234, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
}

.info-header-icon svg {
  width: 20px;
  height: 20px;
  color: var(--primary-color);
}

.info-header-text {
  flex: 1;
  overflow: hidden;
}

.info-header-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.info-header-desc {
  font-size: 11px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

.info-panel-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 8px 10px;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-category-list {
  overflow-y: auto;
  max-height: 100%;
}

.info-category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 12px;
}

.info-category-item:hover {
  background: rgba(102, 126, 234, 0.1);
}

.category-item-icon {
  width: 16px;
  height: 16px;
  color: var(--primary-color);
}

.category-item-icon.function-icon {
  width: 24px;
  height: 14px;
}

.category-item-name {
  color: var(--text-primary);
  font-weight: 500;
}

.info-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  font-size: 13px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
}

.info-label {
  color: var(--text-tertiary);
  min-width: 50px;
  white-space: nowrap;
}

.info-value {
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.info-value.connected {
  color: #228b22;
}

.info-value.disconnected {
  color: #c42b1c;
}

.info-tab-btn {
  width: 32px;
  height: 32px;
  padding: 6px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: var(--transition-normal);
}

.info-tab-btn:hover {
  background: rgba(102, 126, 234, 0.1);
  color: var(--text-secondary);
}

.info-tab-btn.active {
  background: rgba(102, 126, 234, 0.2);
  color: var(--primary-color);
}

.info-tab-icon {
  width: 18px;
  height: 18px;
}

.info-tab-icon.ddl-icon {
  width: 32px;
  height: 18px;
}

.info-item-block {
  padding: 8px 0;
  font-size: 12px;
}

.info-index-list {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-index-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.index-name {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 80px;
  white-space: nowrap;
}

.index-col {
  color: var(--text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.index-type {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-tertiary);
  white-space: nowrap;
}

.index-type.unique {
  background: rgba(102, 126, 234, 0.1);
  color: var(--primary-color);
}

.info-ddl {
  font-size: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  background: rgba(255, 255, 255, 0.3);
  padding: 12px;
  border-radius: var(--radius-sm);
  overflow: auto;
  height: 100%;
  white-space: pre;
  margin: 0;
  line-height: 1.5;
}

.info-ddl :deep(.sql-keyword) {
  color: #569cd6 !important;
  font-weight: 600;
}

.info-ddl :deep(.sql-function) {
  color: #dcdcaa !important;
}

.info-ddl :deep(.sql-string) {
  color: #ce9178 !important;
}

.info-ddl :deep(.sql-number) {
  color: #b5cea8 !important;
}

.info-ddl :deep(.sql-identifier) {
  color: #9cdcfe !important;
}

.info-ddl :deep(.sql-comment) {
  color: #6a9955 !important;
  font-style: italic;
}

.info-ddl-content {
  height: 100%;
  overflow: hidden;
}

.info-table-structure {
  max-height: 300px;
  overflow-y: auto;
}

.info-table-row {
  display: flex;
  font-size: 11px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}

.info-table-row:last-child {
  border-bottom: none;
}

.info-table-row span {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-table-row span:first-child {
  flex: 1.5;
  font-weight: 500;
}

.info-table-header {
  font-weight: 500;
  color: var(--text-tertiary);
  background: rgba(102, 126, 234, 0.05);
  padding: 4px 6px;
  margin: -6px -10px 4px -10px;
}

@media (max-width: 1200px) {
  .sidebar {
    width: 200px;
  }
  
  .sidebar-wide {
    width: 180px;
  }
  
  .info-panel {
    width: 200px;
  }
  
  .toolbar-select-group {
    gap: 6px;
  }
  
  .toolbar-select {
    min-width: 100px;
  }
  
  .footer-pagination {
    gap: 4px;
  }
  
  .pagination-input {
    width: 50px;
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 180px;
  }
  
  .info-panel {
    display: none;
  }
  
  .layout-btn:nth-child(2) {
    display: none;
  }
}
</style>