import { onMounted, onUnmounted } from 'vue'
import { dbCloseAllConnections } from '@/api'
import { createState } from './state'
import { createMessages } from './useMessages'
import { createLayout } from './useLayout'
import { createMenus } from './useMenus'
import { createSidebar } from './useSidebar'
import { createTabs } from './useTabs'
import { createPagination } from './usePagination'
import { createFormat } from './useFormat'
import { createObjects } from './useObjects'
import { createConnections } from './useConnections'
import { createConnectionActions } from './useConnectionActions'
import { createGroups } from './useGroups'
import { createDatabaseOps } from './useDatabaseOps'
import { createTableOps } from './useTableOps'
import { createTransfer } from './useTransfer'
import { createAdvanced } from './useAdvanced'

export function useDatabase() {
  const state = createState()
  const api = {}

  Object.assign(
    api,
    createMessages(state),
    createLayout(state),
    createMenus(state, api),
    createSidebar(state, api),
    createTabs(state, api),
    createPagination(state, api),
    createFormat(state, api),
    createObjects(state),
    createConnections(state, api),
    createConnectionActions(state, api),
    createGroups(state, api),
    createDatabaseOps(state, api),
    createTableOps(state, api),
    createTransfer(state, api),
    createAdvanced(state, api)
  )

  onMounted(async () => {
    window.addEventListener('keydown', api.handleKeyDown)
    window.addEventListener('click', api.hideContextMenu)
    await api.loadConnections()
  })

  onUnmounted(async () => {
    window.removeEventListener('keydown', api.handleKeyDown)
    window.removeEventListener('click', api.hideContextMenu)
    await dbCloseAllConnections()
  })

  return { ...state, ...api }
}
