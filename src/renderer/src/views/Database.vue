<template>
  <PageLayout tool-path="/database" page-class="database-page">
    <template #actions>
      <div class="header-shortcuts">
        <div class="shortcut-item" title="新建连接" @click="showAddConnectionModal">
          <svg class="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
            <line x1="12" y1="12" x2="12" y2="12.01" />
          </svg>
          <span class="shortcut-text">新建连接</span>
        </div>
        <div
          class="shortcut-item"
          title="新建查询"
          @click="createQueryTab(selectedConnection?.name || '', selectedDatabase || '')"
        >
          <svg class="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span class="shortcut-text">新建查询</span>
        </div>
        <div class="shortcut-item" title="搜索对象" @click="openObjectSearchDialog">
          <svg class="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span class="shortcut-text">搜索对象</span>
        </div>
      </div>
      <div class="header-divider" />
      <div class="header-stats">
        <span class="stat-item clickable" title="查看表列表" @click="handleHeaderStatClick('tables')">
          <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <span class="stat-text">表</span>
        </span>
        <span class="stat-item clickable" title="查看视图列表" @click="handleHeaderStatClick('views')">
          <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span class="stat-text">视图</span>
        </span>
        <span class="stat-item clickable" title="查看函数列表" @click="handleHeaderStatClick('functions')">
          <svg class="stat-icon fx-icon" viewBox="0 0 32 18" fill="currentColor" stroke="none">
            <text x="0" y="14" font-size="12" font-style="italic" font-weight="600">f</text>
            <text x="14" y="17" font-size="8">(x)</text>
          </svg>
          <span class="stat-text">函数</span>
        </span>
        <span class="stat-item clickable" title="查看用户列表" @click="openUserDialog">
          <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span class="stat-text">用户</span>
        </span>
        <span class="stat-item clickable" title="查看查询历史" @click="openHistoryDialog('history')">
          <svg class="stat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span class="stat-text">查询</span>
        </span>
      </div>
    </template>

    <div class="main-content">
      <ConnectionSidebar />

      <div class="main-panel" :class="{ 'panel-wide': layoutMode === 'three' }">
        <div class="connection-panel">
          <QueryTabBar />

          <ObjectExplorer />

          <QueryWorkspace />
        </div>
      </div>

      <InfoPanel />
    </div>

    <StatusBar />

    <CreateConnectionDialog />

    <EditConnectionDialog />

    <ManageDialog />

    <GroupDialog />

    <ConnectionContextMenu />

    <TabContextMenu />

    <FieldSortMenu />

    <MessageDialogHost />

    <PromptDialog />

    <ImportDialog />

    <ExportDialog />

    <ConnectionTransferDialog />

    <SearchObjectsDialog />

    <HistoryDialog />

    <UserDialog />

    <AiSqlDialog />

    <ExplainDialog />

    <StructureDialog />

    <ErDialog />

    <SqlPreviewDialog />
  </PageLayout>
</template>

<script setup>
import { provide } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { useDatabase } from './database/useDatabase'
import ConnectionSidebar from './database/components/ConnectionSidebar.vue'
import QueryTabBar from './database/components/QueryTabBar.vue'
import ObjectExplorer from './database/components/ObjectExplorer.vue'
import QueryWorkspace from './database/components/QueryWorkspace.vue'
import InfoPanel from './database/components/InfoPanel.vue'
import StatusBar from './database/components/StatusBar.vue'
import CreateConnectionDialog from './database/components/CreateConnectionDialog.vue'
import EditConnectionDialog from './database/components/EditConnectionDialog.vue'
import GroupDialog from './database/components/GroupDialog.vue'
import ManageDialog from './database/components/ManageDialog.vue'
import ConnectionContextMenu from './database/components/ConnectionContextMenu.vue'
import TabContextMenu from './database/components/TabContextMenu.vue'
import FieldSortMenu from './database/components/FieldSortMenu.vue'
import MessageDialogHost from './database/components/MessageDialogHost.vue'
import PromptDialog from './database/components/PromptDialog.vue'
import ImportDialog from './database/components/ImportDialog.vue'
import ExportDialog from './database/components/ExportDialog.vue'
import ConnectionTransferDialog from './database/components/ConnectionTransferDialog.vue'
import SearchObjectsDialog from './database/components/SearchObjectsDialog.vue'
import HistoryDialog from './database/components/HistoryDialog.vue'
import UserDialog from './database/components/UserDialog.vue'
import AiSqlDialog from './database/components/AiSqlDialog.vue'
import ExplainDialog from './database/components/ExplainDialog.vue'
import StructureDialog from './database/components/StructureDialog.vue'
import ErDialog from './database/components/ErDialog.vue'
import SqlPreviewDialog from './database/components/SqlPreviewDialog.vue'
import './database/styles/page.css'
import './database/styles/sidebar.css'
import './database/styles/menus.css'
import './database/styles/workspace.css'
import './database/styles/query.css'
import './database/styles/results.css'
import './database/styles/dialogs.css'
import './database/styles/advanced.css'
import './database/styles/status.css'
import './database/styles/info.css'
import './database/styles/media.css'

const databaseStore = useDatabase()
provide('database', databaseStore)

const {
  layoutMode,
  handleHeaderStatClick,
  createQueryTab,
  showAddConnectionModal,
  openObjectSearchDialog,
  openHistoryDialog,
  openUserDialog,
  selectedConnection,
  selectedDatabase
} = databaseStore
</script>
