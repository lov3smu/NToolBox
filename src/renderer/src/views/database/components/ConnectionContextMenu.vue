<template>
  <div
    v-if="contextMenu.show"
    class="context-menu"
    :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    @click.stop
  >
    <template v-if="contextMenu.type === 'header'">
      <div class="menu-item" @click="handleNewConnectionAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        新建连接
      </div>
      <div class="menu-item" @click="handleOpenManageAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
        连接管理
      </div>
      <div class="menu-item" @click="handleCloseAllConnectionsAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
        关闭所有连接
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleOpenNewGroupAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="9" y1="14" x2="15" y2="14" />
        </svg>
        新建分组
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleLoadConnectionsAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        刷新
      </div>
    </template>
    <template v-if="contextMenu.type === 'connection'">
      <div v-if="!contextMenu.target.active" class="menu-item" @click="handleConnectAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
        连接
      </div>
      <div v-if="contextMenu.target.active" class="menu-item" @click="handleDisconnectAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
        断开连接
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleNewConnectionInGroupAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        新建连接
      </div>
      <div class="menu-item" @click="handleLoadConnectionsAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        新建查询
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleEditConnectionAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        编辑连接
      </div>
      <div class="menu-item" @click="handleDuplicateConnectionAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        复制连接
      </div>
      <div class="menu-item danger" @click="handleDeleteConnectionAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        删除连接
      </div>
      <div class="menu-divider" />
      <div class="menu-item has-submenu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
        管理组
        <svg class="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div class="submenu">
          <div class="menu-item" @click.stop="handleOpenNewGroupAndHide()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              <line x1="12" y1="11" x2="12" y2="17" />
              <line x1="9" y1="14" x2="15" y2="14" />
            </svg>
            新建组
          </div>
          <div class="menu-divider" />
          <div
            class="menu-item"
            :class="{ disabled: !contextMenu.target.group }"
            @click.stop="handleRemoveFromGroupAndHide()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
            从组中删除
          </div>
          <div class="menu-divider" />
          <div class="submenu-header">移动到</div>
          <div
            v-for="g in groups"
            :key="g"
            :class="['menu-item', { disabled: g === contextMenu.target.group }]"
            @click.stop="handleMoveToGroupAndHide(g)"
          >
            {{ g }}
          </div>
          <div v-if="groups.length === 0" class="menu-item disabled">暂无分组</div>
        </div>
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleLoadConnectionsAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        刷新
      </div>
    </template>
    <template v-if="contextMenu.type === 'group'">
      <div class="menu-item" @click="handleNewConnectionInNamedGroupAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        新建连接
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleEditGroupAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        编辑分组
      </div>
      <div class="menu-item danger" @click="handleDeleteGroupAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        删除分组
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleLoadConnectionsAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        刷新
      </div>
    </template>
    <template v-if="contextMenu.type === 'database'">
      <div
        v-if="!openedDatabases.includes(`${contextMenu.target.connection.name}_${contextMenu.target.database}`)"
        class="menu-item"
        @click="handleOpenDatabaseAndHide()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
        打开数据库
      </div>
      <div
        v-if="openedDatabases.includes(`${contextMenu.target.connection.name}_${contextMenu.target.database}`)"
        class="menu-item"
        @click="handleCloseDatabaseAndHide()"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
          <line x1="12" y1="2" x2="12" y2="12" />
        </svg>
        关闭数据库
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleEditDatabaseAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        编辑数据库
      </div>
      <div class="menu-item danger" @click="handleDeleteDatabaseAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        删除数据库
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleNewQueryForDatabaseAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        新建查询
      </div>
      <div class="menu-item" @click="handleRunSqlFileAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <polyline points="10 12 8 12 8 16" />
          <polyline points="16 12 14 12 14 16" />
        </svg>
        运行SQL文件
      </div>
      <div class="menu-item has-submenu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        转存储SQL文件
        <svg class="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div class="submenu">
          <div class="menu-item" @click.stop="handleDumpDatabaseStructureAndHide()">结构和数据</div>
          <div class="menu-item" @click.stop="handleDumpDatabaseDataAndHide()">仅数据</div>
        </div>
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleRefreshDatabaseAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        刷新
      </div>
    </template>
    <template v-if="contextMenu.type === 'category'">
      <div class="menu-item" @click="handleRefreshCategoryAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        刷新{{
          contextMenu.target.category === 'tables' ? '表' : contextMenu.target.category === 'views' ? '视图' : '函数'
        }}列表
      </div>
    </template>
    <template v-if="contextMenu.type === 'table'">
      <div class="menu-item" @click="handleOpenNewQueryAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        打开表
      </div>
      <div class="menu-divider" />
      <div class="menu-item danger" @click="handleDeleteTableAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        删除表
      </div>
      <div class="menu-item danger" @click="handleOpenTableAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M12 11v11" />
          <line x1="8" y1="11" x2="8.01" y2="11" />
          <line x1="16" y1="11" x2="16.01" y2="11" />
        </svg>
        清空表
      </div>
      <div class="menu-item danger" @click="handleTruncateTableAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <rect x="8" y="11" width="8" height="10" />
        </svg>
        截断表
      </div>
      <div class="menu-divider" />
      <div class="menu-item has-submenu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        复制表
        <svg class="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div class="submenu">
          <div class="menu-item" @click.stop="handleCopyTableStructureDataAndHide()">结构和数据</div>
          <div class="menu-item" @click.stop="handleCopyTableStructureAndHide()">仅结构</div>
        </div>
      </div>
      <div class="menu-item has-submenu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        转储SQL文件
        <svg class="submenu-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div class="submenu">
          <div class="menu-item" @click.stop="handleDumpTableStructureDataAndHide()">结构和数据</div>
          <div class="menu-item" @click.stop="handleDumpTableStructureAndHide()">仅结构</div>
        </div>
      </div>
      <div class="menu-divider" />
      <div class="menu-item" @click="handleEmptyTableAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
        重命名
      </div>
      <div class="menu-item" @click="handleRenameTableAndHide()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        刷新
      </div>
    </template>
  </div>
</template>

<script setup>
import { inject } from 'vue'

const databaseStore = inject('database')
const {
  contextMenu,
  groups,
  handleCloseAllConnectionsAndHide,
  handleCloseDatabaseAndHide,
  handleConnectAndHide,
  handleCopyTableStructureAndHide,
  handleCopyTableStructureDataAndHide,
  handleDeleteConnectionAndHide,
  handleDeleteDatabaseAndHide,
  handleDeleteGroupAndHide,
  handleDeleteTableAndHide,
  handleDisconnectAndHide,
  handleDumpDatabaseDataAndHide,
  handleDumpDatabaseStructureAndHide,
  handleDumpTableStructureAndHide,
  handleDumpTableStructureDataAndHide,
  handleDuplicateConnectionAndHide,
  handleEditConnectionAndHide,
  handleEditDatabaseAndHide,
  handleEditGroupAndHide,
  handleEmptyTableAndHide,
  handleLoadConnectionsAndHide,
  handleMoveToGroupAndHide,
  handleNewConnectionAndHide,
  handleNewConnectionInGroupAndHide,
  handleNewConnectionInNamedGroupAndHide,
  handleNewQueryForDatabaseAndHide,
  handleOpenDatabaseAndHide,
  handleOpenManageAndHide,
  handleOpenNewGroupAndHide,
  handleOpenNewQueryAndHide,
  handleOpenTableAndHide,
  handleRefreshCategoryAndHide,
  handleRefreshDatabaseAndHide,
  handleRemoveFromGroupAndHide,
  handleRenameTableAndHide,
  handleRunSqlFileAndHide,
  handleTruncateTableAndHide,
  openedDatabases
} = databaseStore
</script>
