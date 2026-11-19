<template>
  <PageLayout tool-path="/database" page-class="database-page">
    <template #actions>
      <div class="header-shortcuts">
        <div class="shortcut-item" :title="t('新建连接')" @click="showAddConnectionModal">
          <svg class="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
            <line x1="12" y1="12" x2="12" y2="12.01" />
          </svg>
          <span class="shortcut-text">{{ t('新建连接') }}</span>
        </div>
        <div
          class="shortcut-item"
          :title="t('新建查询')"
          @click="createQueryTab(selectedConnection?.name || '', selectedDatabase || '')"
        >
          <svg class="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <span class="shortcut-text">{{ t('新建查询') }}</span>
        </div>
        <div class="shortcut-item" :title="t('数据传输')" @click="openDataTransferDialog">
          <svg class="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7h13" />
            <path d="m14 4 3 3-3 3" />
            <path d="M20 17H7" />
            <path d="m10 20-3-3 3-3" />
          </svg>
          <span class="shortcut-text">{{ t('数据传输') }}</span>
        </div>
        <div class="header-ops" :class="{ open: headerOpsOpen }">
          <div
            class="shortcut-item"
            :class="{ active: headerOpsOpen }"
            :title="t('运维与诊断')"
            @click.stop="headerOpsOpen = !headerOpsOpen"
          >
            <svg class="shortcut-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path
                d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
              />
            </svg>
            <span class="shortcut-text">{{ t('运维') }}</span>
            <svg class="shortcut-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <div v-if="headerOpsOpen" v-clamp-viewport class="header-ops-menu" @click.stop>
            <div class="header-ops-item" @click="runHeaderAction(openSessionDialog)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <span>{{ t('会话与锁') }}</span>
            </div>
            <div class="header-ops-item" @click="runHeaderAction(openServerStatusDialog)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 12h4l2-6 4 12 2-6h6" />
              </svg>
              <span>{{ t('实例状态') }}</span>
            </div>
            <div class="header-ops-item" @click="runHeaderAction(openHealthDialog)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <ellipse cx="12" cy="5" rx="8" ry="3" />
                <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
                <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
              </svg>
              <span>{{ t('容量与健康检查') }}</span>
            </div>
            <div class="header-ops-item" @click="runHeaderAction(openBackupDialog)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{{ t('定时备份与导出') }}</span>
            </div>
            <div class="header-ops-item" @click="runHeaderAction(openOperationLog)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
              <span>{{ t('数据库操作日志') }}</span>
            </div>
            <div class="header-ops-divider" />
            <div class="header-ops-item" @click="runHeaderAction(openUserDialog)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>{{ t('用户与权限') }}</span>
            </div>
          </div>
        </div>
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

    <CellFilterMenu />

    <MessageDialogHost />

    <PromptDialog />

    <SqlParamsDialog />

    <ImportDialog />

    <ExportDialog />

    <DataTransferDialog />

    <ConnectionTransferDialog />

    <HistoryDialog />

    <UserDialog />

    <SessionDialog />

    <ServerStatusDialog />

    <HealthDialog />

    <SqlAuditDialog />

    <BackupTasksDialog />

    <OperationLogDialog />

    <AiSqlDialog />

    <ExplainDialog />

    <ResultCompareDialog />

    <StructureDialog />

    <TableDesignerDialog />

    <EventDialog />

    <ErDialog />

    <SqlPreviewDialog />

    <CreateTableDialog />

    <SchemaDiffDialog />

    <CellViewerDialog />
  </PageLayout>
</template>

<script setup>
import { t } from '@/i18n'
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import PageLayout from '@/layouts/PageLayout.vue'
import { useConfig } from '@/composables'
import { normalizeDatabaseEditorConfig } from '@shared/databaseEditor'
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
import CellFilterMenu from './database/components/CellFilterMenu.vue'
import MessageDialogHost from './database/components/MessageDialogHost.vue'
import PromptDialog from './database/components/PromptDialog.vue'
import SqlParamsDialog from './database/components/SqlParamsDialog.vue'
import ImportDialog from './database/components/ImportDialog.vue'
import ExportDialog from './database/components/ExportDialog.vue'
import DataTransferDialog from './database/components/DataTransferDialog.vue'
import ConnectionTransferDialog from './database/components/ConnectionTransferDialog.vue'
import HistoryDialog from './database/components/HistoryDialog.vue'
import UserDialog from './database/components/UserDialog.vue'
import SessionDialog from './database/components/SessionDialog.vue'
import ServerStatusDialog from './database/components/ServerStatusDialog.vue'
import HealthDialog from './database/components/HealthDialog.vue'
import SqlAuditDialog from './database/components/SqlAuditDialog.vue'
import BackupTasksDialog from './database/components/BackupTasksDialog.vue'
import OperationLogDialog from './database/components/OperationLogDialog.vue'
import AiSqlDialog from './database/components/AiSqlDialog.vue'
import ExplainDialog from './database/components/ExplainDialog.vue'
import ResultCompareDialog from './database/components/ResultCompareDialog.vue'
import StructureDialog from './database/components/StructureDialog.vue'
import TableDesignerDialog from './database/components/TableDesignerDialog.vue'
import EventDialog from './database/components/EventDialog.vue'
import ErDialog from './database/components/ErDialog.vue'
import SqlPreviewDialog from './database/components/SqlPreviewDialog.vue'
import CreateTableDialog from './database/components/CreateTableDialog.vue'
import SchemaDiffDialog from './database/components/SchemaDiffDialog.vue'
import CellViewerDialog from './database/components/CellViewerDialog.vue'
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

const { config: appConfig } = useConfig()
const databaseStore = useDatabase(appConfig)
provide('database', databaseStore)

const databaseEditor = computed(() => normalizeDatabaseEditorConfig(appConfig.value?.database?.editor))
provide('databaseEditor', databaseEditor)

const {
  layoutMode,
  createQueryTab,
  showAddConnectionModal,
  openUserDialog,
  openDataTransferDialog,
  openSessionDialog,
  openServerStatusDialog,
  openHealthDialog,
  openBackupDialog,
  openOperationLog,
  selectedConnection,
  selectedDatabase
} = databaseStore

const headerOpsOpen = ref(false)

function onHeaderOpsOutsideClick(event) {
  if (!event.target?.closest?.('.header-ops')) headerOpsOpen.value = false
}

function onHeaderOpsKeydown(event) {
  if (event.key === 'Escape') headerOpsOpen.value = false
}

function runHeaderAction(action) {
  headerOpsOpen.value = false
  action?.()
}

onMounted(() => {
  document.addEventListener('click', onHeaderOpsOutsideClick)
  document.addEventListener('keydown', onHeaderOpsKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onHeaderOpsOutsideClick)
  document.removeEventListener('keydown', onHeaderOpsKeydown)
})
</script>
