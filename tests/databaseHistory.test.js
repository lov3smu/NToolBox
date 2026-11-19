import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({}))

import { createAdvanced } from '../src/renderer/src/views/database/useAdvanced.js'

const HISTORY_KEY = 'ntoolbox-db-query-history'

function createState() {
  return {
    activeTabId: ref(''),
    aiDialog: ref({ show: false }),
    databaseObjectsMap: ref({}),
    databases: ref([]),
    erDialog: ref({ show: false }),
    explainDialog: ref({ show: false }),
    historyDialog: ref({ show: false }),
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

function seedHistory(count) {
  const entries = Array.from({ length: count }, (_, index) => ({
    id: `h${index}`,
    sql: `SELECT ${index}`,
    createdAt: index
  }))
  globalThis.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  return entries
}

describe('database query history limit', () => {
  beforeEach(() => {
    const storage = new Map()
    globalThis.localStorage = {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    }
  })

  it('loads only the configured number of entries', () => {
    seedHistory(120)
    const state = createState()
    createAdvanced(state, {}, { historyLimit: ref(100) })

    expect(state.queryHistory.value).toHaveLength(100)
    expect(state.queryHistory.value[0].id).toBe('h0')
  })

  it('trims existing entries when the limit shrinks', async () => {
    seedHistory(120)
    const state = createState()
    const limit = ref(200)
    createAdvanced(state, {}, { historyLimit: limit })
    expect(state.queryHistory.value).toHaveLength(120)

    limit.value = 50
    await nextTick()

    expect(state.queryHistory.value).toHaveLength(50)
    expect(JSON.parse(globalThis.localStorage.getItem(HISTORY_KEY))).toHaveLength(50)
  })

  it('keeps new entries within the configured limit', () => {
    const state = createState()
    const store = createAdvanced(state, {}, { historyLimit: ref(50) })

    for (let index = 0; index < 60; index++) {
      store.pushHistory({ sql: `SELECT ${index}` })
    }

    expect(state.queryHistory.value).toHaveLength(50)
    expect(state.queryHistory.value[0].sql).toBe('SELECT 59')
  })
})
