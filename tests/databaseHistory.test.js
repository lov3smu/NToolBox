import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  dbHistoryAdd: vi.fn(),
  dbHistoryClear: vi.fn(),
  dbHistoryRemove: vi.fn(),
  dbSnippetFolderAdd: vi.fn(),
  dbSnippetRemove: vi.fn(),
  dbSnippetSave: vi.fn(),
  dbToolsState: vi.fn()
}))

vi.mock('@/api', () => api)

import { createAdvanced } from '../src/renderer/src/views/database/useAdvanced.js'

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

function createState() {
  return {
    activeTabId: ref(''),
    aiDialog: ref({ show: false }),
    databaseObjectsMap: ref({}),
    databases: ref([]),
    erDialog: ref({ show: false }),
    explainDialog: ref({ show: false }),
    historyDialog: ref({ show: false }),
    historyHasMore: ref(false),
    historyLoading: ref(false),
    historyTotal: ref(0),
    queryHistory: ref([]),
    querySnippets: ref([]),
    snippetFolders: ref([]),
    selectedConnection: ref(null),
    selectedDatabase: ref(''),
    sqlPreviewDialog: ref({ show: false }),
    structureDialog: ref({ show: false }),
    tableDesignerDialog: ref({ show: false }),
    tabs: ref([]),
    userDialog: ref({ show: false })
  }
}

function pageOf(count, total, offset = 0) {
  const items = Array.from({ length: count }, (_, index) => ({
    id: `h${offset + index}`,
    sql: `SELECT ${offset + index}`,
    createdAt: offset + index
  }))
  return { items, total, hasMore: offset + count < total }
}

describe('database query history paging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const fn of [
      api.dbHistoryAdd,
      api.dbHistoryClear,
      api.dbHistoryRemove,
      api.dbSnippetFolderAdd,
      api.dbSnippetRemove,
      api.dbSnippetSave
    ]) {
      fn.mockResolvedValue({ success: true })
    }
    api.dbToolsState.mockResolvedValue({
      history: { items: [], total: 0, hasMore: false },
      snippets: [],
      folders: []
    })
  })

  it('loads the first page with the configured limit', async () => {
    api.dbToolsState.mockResolvedValue({
      history: pageOf(50, 120),
      snippets: [{ id: 's1' }],
      folders: ['常用']
    })
    const state = createState()
    createAdvanced(state, {}, { historyLimit: ref(100) })
    await flushPromises()

    expect(api.dbToolsState).toHaveBeenCalledWith({
      historyLimit: 100,
      offset: 0,
      legacy: { history: [], snippets: [], folders: [] }
    })
    expect(state.queryHistory.value).toHaveLength(50)
    expect(state.queryHistory.value[0].id).toBe('h0')
    expect(state.historyTotal.value).toBe(120)
    expect(state.historyHasMore.value).toBe(true)
    expect(state.querySnippets.value).toEqual([{ id: 's1' }])
    expect(state.snippetFolders.value).toEqual(['常用'])
  })

  it('reloads the first page when the limit changes', async () => {
    const limit = ref(200)
    createAdvanced(createState(), {}, { historyLimit: limit })
    await flushPromises()
    expect(api.dbToolsState).toHaveBeenLastCalledWith(
      expect.objectContaining({ historyLimit: 200, offset: 0 })
    )

    limit.value = 50
    await nextTick()
    await flushPromises()

    expect(api.dbToolsState).toHaveBeenLastCalledWith(
      expect.objectContaining({ historyLimit: 50, offset: 0 })
    )
  })

  it('appends the next page and resets the loading flag', async () => {
    api.dbToolsState
      .mockResolvedValueOnce({ history: pageOf(50, 120), snippets: [], folders: [] })
      .mockResolvedValueOnce({ history: pageOf(50, 120, 50), snippets: [], folders: [] })

    const state = createState()
    const store = createAdvanced(state, {}, { historyLimit: ref(100) })
    await flushPromises()
    expect(state.historyHasMore.value).toBe(true)

    const pending = store.loadMoreHistory()
    expect(state.historyLoading.value).toBe(true)
    await pending

    expect(api.dbToolsState).toHaveBeenLastCalledWith(
      expect.objectContaining({ historyLimit: 100, offset: 50 })
    )
    expect(state.queryHistory.value).toHaveLength(100)
    expect(state.queryHistory.value[99].id).toBe('h99')
    expect(state.historyLoading.value).toBe(false)
    expect(state.historyTotal.value).toBe(120)
  })

  it('keeps new entries within the configured limit', async () => {
    const state = createState()
    const store = createAdvanced(state, {}, { historyLimit: ref(50) })
    await flushPromises()

    for (let index = 0; index < 60; index++) {
      store.pushHistory({ sql: `SELECT ${index}` })
    }

    expect(state.queryHistory.value).toHaveLength(50)
    expect(state.queryHistory.value[0].sql).toBe('SELECT 59')
    expect(state.historyTotal.value).toBe(50)
    expect(state.historyHasMore.value).toBe(false)
    expect(api.dbHistoryAdd).toHaveBeenCalledTimes(60)
    expect(api.dbHistoryAdd).toHaveBeenLastCalledWith(
      expect.objectContaining({ sql: 'SELECT 59' }),
      { historyLimit: 50 }
    )
  })
})
