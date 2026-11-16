import { computed, onMounted, onUnmounted } from 'vue'
import { dbCloseAllConnections } from '@/api'
import {
  normalizeDatabaseHistoryLimit,
  normalizeDatabasePageSize,
  normalizeDatabaseRefreshInterval,
  normalizeDatabaseTransferBatchSize
} from '@shared/databaseClient'
import { createState } from './state'
import { createMessages } from './useMessages'
import { createLayout } from './useLayout'
import { createMenus } from './useMenus'
import { createSidebar } from './useSidebar'
import { createTabs } from './useTabs'
import { createPagination } from './usePagination'
import { createFormat } from './useFormat'
import { createObjects } from './useObjects'
import { createEventEditor } from './useEventEditor'
import { createConnections } from './useConnections'
import { createConnectionActions } from './useConnectionActions'
import { createGroups } from './useGroups'
import { createDatabaseOps } from './useDatabaseOps'
import { createTableOps } from './useTableOps'
import { createTransfer } from './useTransfer'
import { createAdvanced } from './useAdvanced'
import { createSessions } from './useSessions'
import { createInstanceStatus } from './useInstanceStatus'
import { createHealthCheck } from './useHealthCheck'
import { createSqlAudit } from './useSqlAudit'
import { createBackupTasks } from './useBackupTasks'
import { createOperationLog } from './useOperationLog'

export function useDatabase(appConfig) {
  const state = createState({
    defaultPageSize: computed(() => normalizeDatabasePageSize(appConfig?.value?.database_page_size)),
    refreshInterval: computed(() => normalizeDatabaseRefreshInterval(appConfig?.value?.database_refresh_interval))
  })
  const api = {}
  const transferBatchSize = computed(() =>
    normalizeDatabaseTransferBatchSize(appConfig?.value?.database_transfer_batch_size)
  )
  const queryHistoryLimit = computed(() => normalizeDatabaseHistoryLimit(appConfig?.value?.database_history_limit))

  Object.assign(
    api,
    createMessages(state),
    createLayout(state),
    createMenus(state, api),
    createSidebar(state, api),
    createTabs(state, api),
    createPagination(state, api),
    createFormat(state, api),
    createObjects(state, api),
    createEventEditor(state, api),
    createConnections(state, api),
    createConnectionActions(state, api),
    createGroups(state, api),
    createDatabaseOps(state, api),
    createTableOps(state, api),
    createTransfer(state, api, { defaultBatchSize: transferBatchSize }),
    createSessions(state, api),
    createInstanceStatus(state, api),
    createHealthCheck(state, api),
    createSqlAudit(state),
    createBackupTasks(state, api),
    createOperationLog(state, api),
    createAdvanced(state, api, { historyLimit: queryHistoryLimit })
  )

  onMounted(async () => {
    window.addEventListener('keydown', api.handleKeyDown)
    window.addEventListener('click', api.hideMenus)
    await api.loadConnections()
  })

  onUnmounted(async () => {
    window.removeEventListener('keydown', api.handleKeyDown)
    window.removeEventListener('click', api.hideMenus)
    await dbCloseAllConnections()
  })

  return { ...state, ...api }
}
