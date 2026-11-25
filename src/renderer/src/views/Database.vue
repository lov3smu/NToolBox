<template>
  <PageLayout tool-path="/database" page-class="database-page">
    <template #actions>
      <div class="header-shortcuts">
        <button type="button" class="shortcut-item" :title="t('新建连接')" @click="showAddConnectionModal">
          <AppIcon name="database-plus" class="shortcut-icon" />
          <span class="shortcut-text">{{ t('新建连接') }}</span>
        </button>
        <button
          type="button"
          class="shortcut-item"
          :title="t('新建查询')"
          @click="createQueryTab(selectedConnection?.name || '', selectedDatabase || '')"
        >
          <AppIcon name="file-text" class="shortcut-icon" />
          <span class="shortcut-text">{{ t('新建查询') }}</span>
        </button>
        <button type="button" class="shortcut-item" :title="t('数据传输')" @click="openDataTransferDialog">
          <AppIcon name="swap-horizontal" class="shortcut-icon" />
          <span class="shortcut-text">{{ t('数据传输') }}</span>
        </button>
        <div class="header-ops" :class="{ open: headerOpsOpen }">
          <button
            type="button"
            class="shortcut-item"
            :class="{ active: headerOpsOpen }"
            :title="t('运维与诊断')"
            aria-haspopup="menu"
            :aria-expanded="headerOpsOpen"
            @click.stop="toggleHeaderOps"
          >
            <AppIcon name="wrench" class="shortcut-icon" />
            <span class="shortcut-text">{{ t('运维') }}</span>
            <AppIcon name="chevron-down" class="shortcut-chevron" />
          </button>
          <div
            v-if="headerOpsOpen"
            ref="headerOpsMenuRef"
            v-clamp-viewport
            class="header-ops-menu"
            role="menu"
            @click.stop
            @keydown="onHeaderOpsMenuKeydown"
          >
            <button
              v-if="engineCapabilities.sessions"
              type="button"
              role="menuitem"
              class="header-ops-item"
              @click="runHeaderAction(openSessionDialog)"
            >
              <AppIcon name="lock" />
              <span>{{ t('会话与锁') }}</span>
            </button>
            <button
              v-if="engineCapabilities.serverStatus"
              type="button"
              role="menuitem"
              class="header-ops-item"
              @click="runHeaderAction(openServerStatusDialog)"
            >
              <AppIcon name="activity" />
              <span>{{ t('实例状态') }}</span>
            </button>
            <button
              v-if="engineCapabilities.health"
              type="button"
              role="menuitem"
              class="header-ops-item"
              @click="runHeaderAction(openHealthDialog)"
            >
              <AppIcon name="database" />
              <span>{{ t('容量与健康检查') }}</span>
            </button>
            <button
              v-if="engineCapabilities.backup"
              type="button"
              role="menuitem"
              class="header-ops-item"
              @click="runHeaderAction(openBackupDialog)"
            >
              <AppIcon name="download" />
              <span>{{ t('定时备份与导出') }}</span>
            </button>
            <button type="button" role="menuitem" class="header-ops-item" @click="runHeaderAction(openOperationLog)">
              <AppIcon name="list" />
              <span>{{ t('数据库操作日志') }}</span>
            </button>
            <template v-if="engineCapabilities.users">
              <div class="header-ops-divider" />
              <button type="button" role="menuitem" class="header-ops-item" @click="runHeaderAction(openUserDialog)">
                <AppIcon name="user" />
                <span>{{ t('用户与权限') }}</span>
              </button>
            </template>
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
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref } from 'vue'
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
import AppIcon from '@/components/AppIcon.vue'
import { focusFirstMenuItem, handleMenuKeydown } from '@/utils/menuKeyboard'
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
  selectedDatabase,
  engineCapabilities
} = databaseStore

const headerOpsOpen = ref(false)
const headerOpsMenuRef = ref(null)

function onHeaderOpsOutsideClick(event) {
  if (!event.target?.closest?.('.header-ops')) headerOpsOpen.value = false
}

function onHeaderOpsKeydown(event) {
  if (event.key === 'Escape') headerOpsOpen.value = false
}

async function toggleHeaderOps() {
  headerOpsOpen.value = !headerOpsOpen.value
  if (!headerOpsOpen.value) return
  await nextTick()
  focusFirstMenuItem(headerOpsMenuRef.value)
}

function onHeaderOpsMenuKeydown(event) {
  handleMenuKeydown(event, headerOpsMenuRef.value, () => {
    headerOpsOpen.value = false
  })
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
