<template>
  <div
    v-if="contextMenu.show"
    ref="menuRef"
    v-clamp-viewport
    class="context-menu"
    role="menu"
    :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
    @click.stop
    @keydown="onMenuKeydown"
  >
    <template v-if="contextMenu.type === 'header'">
      <div role="menuitem" class="menu-item" @click="handleNewConnectionAndHide()">
        <AppIcon name="plus" />
        {{ t('新建连接') }}
      </div>
      <div role="menuitem" class="menu-item" @click="handleOpenManageAndHide()">
        <AppIcon name="settings" />
        {{ t('连接管理') }}
      </div>
      <div role="menuitem" class="menu-item" @click="handleCloseAllConnectionsAndHide()">
        <AppIcon name="power" />
        {{ t('关闭所有连接') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleOpenNewGroupAndHide()">
        <AppIcon name="folder-plus" />
        {{ t('新建分组') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleLoadConnectionsAndHide()">
        <AppIcon name="refresh" />
        {{ t('刷新') }}
      </div>
    </template>
    <template v-if="contextMenu.type === 'connection'">
      <div v-if="!contextMenu.target.active" role="menuitem" class="menu-item" @click="handleConnectAndHide()">
        <AppIcon name="power" />
        {{ t('连接') }}
      </div>
      <div v-if="contextMenu.target.active" role="menuitem" class="menu-item" @click="handleDisconnectAndHide()">
        <AppIcon name="power" />
        {{ t('断开连接') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleNewConnectionInGroupAndHide()">
        <AppIcon name="plus" />
        {{ t('新建连接') }}
      </div>
      <div role="menuitem" class="menu-item" @click="handleLoadConnectionsAndHide()">
        <AppIcon name="file-text" />
        {{ t('新建查询') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleEditConnectionAndHide()">
        <AppIcon name="edit" />
        {{ t('编辑连接') }}
      </div>
      <div role="menuitem" class="menu-item" @click="handleDuplicateConnectionAndHide()">
        <AppIcon name="copy" />
        {{ t('复制连接') }}
      </div>
      <div role="menuitem" class="menu-item danger" @click="handleDeleteConnectionAndHide()">
        <AppIcon name="trash" />
        {{ t('删除连接') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item has-submenu">
        <AppIcon name="settings" />
        {{ t('管理组') }}
        <AppIcon name="chevron-right" class="submenu-arrow" />
        <div class="submenu" role="menu">
          <div role="menuitem" class="menu-item" @click.stop="handleOpenNewGroupAndHide()">
            <AppIcon name="folder-plus" />
            {{ t('新建组') }}
          </div>
          <div class="menu-divider" role="separator" />
          <div
            role="menuitem"
            class="menu-item"
            :class="{ disabled: !contextMenu.target.group }"
            @click.stop="handleRemoveFromGroupAndHide()"
          >
            <AppIcon name="trash" />
            {{ t('从组中删除') }}
          </div>
          <div class="menu-divider" role="separator" />
          <div class="submenu-header" role="presentation">{{ t('移动到') }}</div>
          <div
            v-for="g in groups"
            :key="g"
            role="menuitem"
            :class="['menu-item', { disabled: g === contextMenu.target.group }]"
            @click.stop="handleMoveToGroupAndHide(g)"
          >
            {{ g }}
          </div>
          <div v-if="groups.length === 0" role="menuitem" class="menu-item disabled">{{ t('暂无分组') }}</div>
        </div>
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleLoadConnectionsAndHide()">
        <AppIcon name="refresh" />
        {{ t('刷新') }}
      </div>
    </template>
    <template v-if="contextMenu.type === 'group'">
      <div role="menuitem" class="menu-item" @click="handleNewConnectionInNamedGroupAndHide()">
        <AppIcon name="plus" />
        {{ t('新建连接') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleEditGroupAndHide()">
        <AppIcon name="edit" />
        {{ t('编辑分组') }}
      </div>
      <div role="menuitem" class="menu-item danger" @click="handleDeleteGroupAndHide()">
        <AppIcon name="trash" />
        {{ t('删除分组') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleLoadConnectionsAndHide()">
        <AppIcon name="refresh" />
        {{ t('刷新') }}
      </div>
    </template>
    <template v-if="contextMenu.type === 'database'">
      <div
        v-if="!openedDatabases.includes(`${contextMenu.target.connection.name}_${contextMenu.target.database}`)"
        role="menuitem"
        class="menu-item"
        @click="handleOpenDatabaseAndHide()"
      >
        <AppIcon name="database" />
        {{ t('打开数据库') }}
      </div>
      <div
        v-if="openedDatabases.includes(`${contextMenu.target.connection.name}_${contextMenu.target.database}`)"
        role="menuitem"
        class="menu-item"
        @click="handleCloseDatabaseAndHide()"
      >
        <AppIcon name="power" />
        {{ t('关闭数据库') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleEditDatabaseAndHide()">
        <AppIcon name="edit" />
        {{ t('编辑数据库') }}
      </div>
      <div role="menuitem" class="menu-item danger" @click="handleDeleteDatabaseAndHide()">
        <AppIcon name="trash" />
        {{ t('删除数据库') }}
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleNewQueryForDatabaseAndHide()">
        <AppIcon name="file-text" />
        {{ t('新建查询') }}
      </div>
      <div v-if="canUse('createTable')" role="menuitem" class="menu-item" @click="handleOpenCreateTableAndHide()">
        <AppIcon name="table-plus" />
        {{ t('新建表') }}
      </div>
      <div v-if="canUse('schemaDiff')" role="menuitem" class="menu-item" @click="handleOpenSchemaDiffAndHide()">
        <AppIcon name="columns" />
        {{ t('结构对比') }}
      </div>
      <div role="menuitem" class="menu-item" @click="handleRunSqlFileAndHide()">
        <AppIcon name="file-code" />
        {{ t('运行SQL文件') }}
      </div>
      <div v-if="canUse('backup')" role="menuitem" class="menu-item has-submenu">
        <AppIcon name="download" />
        {{ t('转存储SQL文件') }}
        <AppIcon name="chevron-right" class="submenu-arrow" />
        <div class="submenu" role="menu">
          <div role="menuitem" class="menu-item" @click.stop="handleDumpDatabaseStructureAndHide()">
            {{ t('结构和数据') }}
          </div>
          <div role="menuitem" class="menu-item" @click.stop="handleDumpDatabaseDataAndHide()">{{ t('仅数据') }}</div>
        </div>
      </div>
      <div class="menu-divider" role="separator" />
      <div role="menuitem" class="menu-item" @click="handleRefreshDatabaseAndHide()">
        <AppIcon name="refresh" />
        {{ t('刷新') }}
      </div>
    </template>
    <template v-if="contextMenu.type === 'category'">
      <div
        v-if="contextMenu.target.category === 'tables' && canUse('createTable')"
        role="menuitem"
        class="menu-item"
        @click="handleOpenCreateTableAndHide()"
      >
        <AppIcon name="table-plus" />
        {{ t('新建表') }}
      </div>
      <div v-if="contextMenu.target.category === 'tables' && canUse('createTable')" class="menu-divider" />
      <div role="menuitem" class="menu-item" @click="handleRefreshCategoryAndHide()">
        <AppIcon name="refresh" />
        {{ t('刷新')
        }}{{
          contextMenu.target.category === 'tables'
            ? t('表')
            : contextMenu.target.category === 'views'
              ? t('视图')
              : t('函数')
        }}{{ t('列表') }}
      </div>
    </template>
    <template v-if="contextMenu.type === 'table'">
      <div role="menuitem" class="menu-item" @click="handleOpenTableAndHide()">
        <AppIcon name="table" />
        {{ t('打开表') }}
      </div>
      <div v-if="canUse('tableDesigner')" role="menuitem" class="menu-item" @click="handleOpenTableDesignerAndHide()">
        <AppIcon name="wrench" />
        {{ t('设计表') }}
      </div>
      <template v-if="canUse('createTable')">
        <div class="menu-divider" role="separator" />
        <div role="menuitem" class="menu-item danger" @click="handleDeleteTableAndHide()">
          <AppIcon name="trash" />
          {{ t('删除表') }}
        </div>
        <div role="menuitem" class="menu-item danger" @click="handleEmptyTableAndHide()">
          <AppIcon name="eraser" />
          {{ t('清空表') }}
        </div>
        <div role="menuitem" class="menu-item danger" @click="handleTruncateTableAndHide()">
          <AppIcon name="trash" />
          {{ t('截断表') }}
        </div>
        <div class="menu-divider" role="separator" />
        <div role="menuitem" class="menu-item has-submenu">
          <AppIcon name="copy" />
          {{ t('复制表') }}
          <AppIcon name="chevron-right" class="submenu-arrow" />
          <div class="submenu" role="menu">
            <div role="menuitem" class="menu-item" @click.stop="handleCopyTableStructureDataAndHide()">
              {{ t('结构和数据') }}
            </div>
            <div role="menuitem" class="menu-item" @click.stop="handleCopyTableStructureAndHide()">
              {{ t('仅结构') }}
            </div>
          </div>
        </div>
      </template>
      <div v-if="canUse('backup')" role="menuitem" class="menu-item has-submenu">
        <AppIcon name="download" />
        {{ t('转储SQL文件') }}
        <AppIcon name="chevron-right" class="submenu-arrow" />
        <div class="submenu" role="menu">
          <div role="menuitem" class="menu-item" @click.stop="handleDumpTableStructureDataAndHide()">
            {{ t('结构和数据') }}
          </div>
          <div role="menuitem" class="menu-item" @click.stop="handleDumpTableStructureAndHide()">{{ t('仅结构') }}</div>
        </div>
      </div>
      <div class="menu-divider" role="separator" />
      <div v-if="canUse('createTable')" role="menuitem" class="menu-item" @click="handleRenameTableAndHide()">
        <AppIcon name="pencil" />
        {{ t('重命名') }}
      </div>
      <div role="menuitem" class="menu-item" @click="handleRefreshTableAndHide()">
        <AppIcon name="refresh" />
        {{ t('刷新') }}
      </div>
    </template>
  </div>
</template>

<script setup>
import { t } from '@/i18n'
import { inject, nextTick, ref, watch } from 'vue'
import { getEngineCapabilities } from '@shared/databaseEngines'
import { focusFirstMenuItem, handleMenuKeydown } from '@/utils/menuKeyboard'

import AppIcon from '@/components/AppIcon.vue'
const databaseStore = inject('database')
const menuRef = ref(null)

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
  hideContextMenu,
  handleLoadConnectionsAndHide,
  handleMoveToGroupAndHide,
  handleNewConnectionAndHide,
  handleNewConnectionInGroupAndHide,
  handleNewConnectionInNamedGroupAndHide,
  handleNewQueryForDatabaseAndHide,
  handleOpenDatabaseAndHide,
  handleOpenManageAndHide,
  handleOpenNewGroupAndHide,
  handleOpenCreateTableAndHide,
  handleOpenSchemaDiffAndHide,
  handleOpenTableAndHide,
  handleOpenTableDesignerAndHide,
  handleRefreshCategoryAndHide,
  handleRefreshDatabaseAndHide,
  handleRefreshTableAndHide,
  handleRemoveFromGroupAndHide,
  handleRenameTableAndHide,
  handleRunSqlFileAndHide,
  handleTruncateTableAndHide,
  openedDatabases
} = databaseStore

function canUse(capability) {
  const engine = contextMenu.value.target?.connection?.engine
  return getEngineCapabilities(engine)[capability] === true
}

watch(
  () => contextMenu.value.show,
  (show) => {
    if (show) nextTick(() => focusFirstMenuItem(menuRef.value))
  }
)

function onMenuKeydown(event) {
  handleMenuKeydown(event, menuRef.value, hideContextMenu)
}
</script>
