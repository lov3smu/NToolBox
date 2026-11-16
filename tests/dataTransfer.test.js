import { ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMock = vi.hoisted(() => ({
  dbExecuteQuery: vi.fn(),
  dbExportTable: vi.fn(),
  dbGetObjectDefinition: vi.fn(),
  dbGetTableData: vi.fn(),
  dbGetTableMeta: vi.fn(),
  dbGetTableStructure: vi.fn(),
  dbInsertRows: vi.fn(),
  dbQueryDatabases: vi.fn(),
  dbQueryObjects: vi.fn(),
  dbSaveConnectionFile: vi.fn(),
  dbSaveExportFile: vi.fn(),
  dbSelectConnectionFile: vi.fn(),
  dbSelectImportFile: vi.fn(),
  getConfig: vi.fn(),
  patchConfig: vi.fn()
}))

vi.mock('@/api', () => apiMock)

import { createTransfer } from '../src/renderer/src/views/database/useTransfer.js'

function createState(overrides = {}) {
  const conn = {
    name: 'local',
    active: true,
    enableReadTimeout: true,
    readTimeout: 60,
    enableWriteTimeout: true,
    writeTimeout: 30
  }
  return {
    connections: ref([conn]),
    connectionTransferDialog: ref({ show: false }),
    dataTransferDialog: ref({ show: false }),
    exportDialog: ref({ show: false }),
    importDialog: ref({ show: false }),
    selectedConnection: ref(conn),
    selectedDatabase: ref('demo'),
    ...overrides
  }
}

function createStore(state = createState(), options = {}) {
  const api = {
    showConfirm: vi.fn(async () => true),
    showMessage: vi.fn(async () => {}),
    showPrompt: vi.fn(async () => '任务A'),
    loadDatabaseObjects: vi.fn(async () => {})
  }
  return { state, api, store: createTransfer(state, api, options) }
}

function createDialog(overrides = {}) {
  return {
    show: true,
    sourceConnection: 'local',
    sourceDatabase: 'demo',
    targetConnection: 'local',
    targetDatabase: 'archive',
    sourceDatabases: [],
    targetDatabases: [],
    objects: [],
    selectedObjects: [],
    objectKeyword: '',
    bulkOpen: false,
    bulkText: '',
    loadingDatabases: false,
    loadingObjects: false,
    transferring: false,
    progress: '',
    error: '',
    summary: null,
    contentMode: 'all',
    targetMode: 'append',
    tableNameCase: 'keep',
    columnNameCase: 'keep',
    batchSize: 1000,
    timeoutMode: 'inherit',
    tasks: [],
    taskKeyword: '',
    ...overrides
  }
}

function objectsOf(...items) {
  return items.map((item) => ({ type: item[0], name: item[1] }))
}

function keysOf(items) {
  return items.map((item) => `${item.type}:${item.name}`)
}

describe('data transfer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.dbQueryDatabases.mockResolvedValue({ success: true, databases: ['demo', 'archive'] })
    apiMock.dbQueryObjects.mockImplementation(async (_name, database) => {
      if (database === 'archive') return { success: true, items: [] }
      return {
        success: true,
        items: [
          { type: 'table', name: 'orders' },
          { type: 'view', name: 'order_view' },
          { type: 'procedure', name: 'sp_clean' },
          { type: 'column', name: 'id', table: 'orders' }
        ]
      }
    })
    apiMock.dbGetTableMeta.mockImplementation(async (_name, _db, table) => ({
      success: true,
      ddl: `CREATE TABLE \`${table}\` (id int)`,
      primaryKeys: ['id']
    }))
    apiMock.dbGetTableStructure.mockResolvedValue({
      success: true,
      fields: [
        { name: 'id', extra: '' },
        { name: 'title', extra: '' }
      ]
    })
    apiMock.dbGetObjectDefinition.mockImplementation(async (_name, _db, type, objectName) => {
      const definitions = {
        view: `CREATE ALGORITHM=UNDEFINED DEFINER=\`root\`@\`localhost\` SQL SECURITY DEFINER VIEW \`${objectName}\` AS select 1 AS \`id\``,
        procedure: `CREATE DEFINER=\`root\`@\`localhost\` PROCEDURE \`${objectName}\`() BEGIN SELECT 1; END`,
        function: `CREATE DEFINER=\`root\`@\`localhost\` FUNCTION \`${objectName}\`() RETURNS int RETURN 1`,
        trigger: `CREATE DEFINER=\`root\`@\`localhost\` TRIGGER \`${objectName}\` BEFORE INSERT ON \`orders\` FOR EACH ROW SET NEW.id = NEW.id`,
        event: `CREATE DEFINER=\`root\`@\`localhost\` EVENT \`${objectName}\` ON SCHEDULE EVERY 1 DAY DO DELETE FROM \`orders\` WHERE 1 = 0`
      }
      return { success: true, ddl: definitions[type] }
    })
    apiMock.dbExecuteQuery.mockResolvedValue({ success: true })
    apiMock.dbGetTableData.mockResolvedValue({ success: true, rows: [], pageCount: 1 })
    apiMock.dbInsertRows.mockImplementation(async (_name, _db, _table, rows) => ({
      success: true,
      inserted: rows.length
    }))
    apiMock.getConfig.mockResolvedValue({})
    apiMock.patchConfig.mockResolvedValue(true)
  })

  it('defaults to the selected connection and selects every database object', async () => {
    const { state, store } = createStore()
    await store.openDataTransferDialog()

    const dialog = state.dataTransferDialog.value
    expect(dialog.sourceConnection).toBe('local')
    expect(dialog.targetConnection).toBe('local')
    expect(dialog.sourceDatabases).toEqual(['demo', 'archive'])
    expect(dialog.targetDatabases).toEqual(['demo', 'archive'])
    expect(dialog.sourceDatabase).toBe('demo')
    expect(dialog.objects.map((item) => `${item.type}:${item.name}`)).toEqual([
      'table:orders',
      'view:order_view',
      'procedure:sp_clean'
    ])
    expect(dialog.selectedObjects).toEqual(dialog.objects.map((item) => `${item.type}:${item.name}`))
  })

  it('uses the configured batch size as the transfer dialog default', async () => {
    const { state, store } = createStore(createState(), { defaultBatchSize: ref(2000) })
    await store.openDataTransferDialog()

    expect(state.dataTransferDialog.value.batchSize).toBe(2000)
  })

  it('falls back to the built-in batch size without configuration', async () => {
    const { state, store } = createStore()
    await store.openDataTransferDialog()

    expect(state.dataTransferDialog.value.batchSize).toBe(1000)
  })

  it('copies table structure and paged data while skipping existing objects', async () => {
    const { state, api, store } = createStore()
    const objects = objectsOf(['table', 'orders'], ['table', 'users'], ['table', 'existing'], ['view', 'order_view'])
    state.dataTransferDialog.value = createDialog({
      objects,
      selectedObjects: keysOf(objects),
      targetMode: 'skip'
    })

    apiMock.dbQueryObjects.mockResolvedValueOnce({
      success: true,
      items: [
        { type: 'table', name: 'existing' },
        { type: 'view', name: 'order_view' }
      ]
    })
    apiMock.dbGetTableData.mockImplementation(async (_name, _db, table, options) => {
      if (table !== 'orders') return { success: true, rows: [], pageCount: 1 }
      return options.page === 1
        ? { success: true, rows: Array.from({ length: 1000 }, (_, id) => ({ id, title: 'x' })), pageCount: 2 }
        : { success: true, rows: [{ id: 1000, title: 'x' }], pageCount: 2 }
    })

    await store.executeDataTransfer()

    const summary = state.dataTransferDialog.value.summary
    expect(summary.transferred).toEqual([
      { type: 'table', name: 'orders', rows: 1001 },
      { type: 'table', name: 'users', rows: 0 }
    ])
    expect(summary.skipped.map((item) => item.name)).toEqual(['existing', 'order_view'])
    expect(summary.failed).toEqual([])
    expect(apiMock.dbExecuteQuery).toHaveBeenCalledTimes(2)
    expect(apiMock.dbExecuteQuery).toHaveBeenCalledWith('local', 'CREATE TABLE `orders` (id int)', [], {
      database: 'archive',
      timeout: 30
    })
    expect(apiMock.dbGetTableData).toHaveBeenCalledWith('local', 'demo', 'orders', {
      page: 1,
      pageSize: 1000,
      sort: [{ field: 'id', order: 'ASC' }],
      timeout: 60
    })
    expect(apiMock.dbInsertRows).toHaveBeenCalledTimes(2)
    expect(api.loadDatabaseObjects).toHaveBeenCalledWith('local', 'archive', { force: true })
    expect(api.showMessage).toHaveBeenCalledWith('数据传输完成：成功 2，跳过 2，失败 0', 'success')
  })

  it('transfers views, routines, triggers and events with definers removed', async () => {
    const { state, store } = createStore()
    const objects = objectsOf(
      ['view', 'v_orders'],
      ['procedure', 'sp_clean'],
      ['function', 'fn_total'],
      ['trigger', 'trg_orders'],
      ['event', 'ev_clean']
    )
    state.dataTransferDialog.value = createDialog({
      objects,
      selectedObjects: keysOf(objects)
    })

    await store.executeDataTransfer()

    const summary = state.dataTransferDialog.value.summary
    expect(summary.transferred).toHaveLength(5)
    expect(summary.failed).toEqual([])
    expect(summary.skipped).toEqual([])
    expect(apiMock.dbGetTableData).not.toHaveBeenCalled()
    expect(apiMock.dbInsertRows).not.toHaveBeenCalled()

    const statements = apiMock.dbExecuteQuery.mock.calls.map((call) => call[1])
    expect(statements[0]).toBe(
      'CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_orders` AS select 1 AS `id`'
    )
    expect(statements[1]).toBe('CREATE PROCEDURE `sp_clean`() BEGIN SELECT 1; END')
    expect(statements[2]).toBe('CREATE FUNCTION `fn_total`() RETURNS int RETURN 1')
    expect(statements[3]).toBe('CREATE TRIGGER `trg_orders` BEFORE INSERT ON `orders` FOR EACH ROW SET NEW.id = NEW.id')
    expect(statements[4]).toBe('CREATE EVENT `ev_clean` ON SCHEDULE EVERY 1 DAY DO DELETE FROM `orders` WHERE 1 = 0')
  })

  it('applies target name case, truncates existing tables and remaps columns', async () => {
    const { state, store } = createStore()
    const objects = objectsOf(['table', 'orders'])
    state.dataTransferDialog.value = createDialog({
      objects,
      selectedObjects: keysOf(objects),
      targetMode: 'truncate',
      tableNameCase: 'upper',
      columnNameCase: 'lower'
    })

    apiMock.dbQueryObjects.mockResolvedValueOnce({
      success: true,
      items: [{ type: 'table', name: 'ORDERS' }]
    })
    apiMock.dbGetTableStructure.mockResolvedValueOnce({
      success: true,
      fields: [
        { name: 'id', extra: '' },
        { name: 'title', extra: '' }
      ]
    })
    apiMock.dbGetTableData.mockResolvedValueOnce({
      success: true,
      rows: [{ ID: 1, Title: '合同' }],
      pageCount: 1
    })

    await store.executeDataTransfer()

    expect(apiMock.dbExecuteQuery).toHaveBeenCalledWith('local', 'TRUNCATE TABLE `archive`.`ORDERS`', [], {
      database: 'archive',
      timeout: 30
    })
    expect(apiMock.dbInsertRows).toHaveBeenCalledWith('local', 'archive', 'ORDERS', [{ id: 1, title: '合同' }], {
      timeout: 30
    })
    expect(state.dataTransferDialog.value.summary.transferred).toEqual([{ type: 'table', name: 'orders', rows: 1 }])
  })

  it('reports per-object failures and continues with remaining objects', async () => {
    const { state, api, store } = createStore()
    const objects = objectsOf(['table', 'broken'], ['table', 'orders'])
    state.dataTransferDialog.value = createDialog({
      objects,
      selectedObjects: keysOf(objects)
    })

    apiMock.dbGetTableMeta.mockImplementation(async (_name, _db, table) =>
      table === 'broken'
        ? { success: false, error: '表已损坏' }
        : { success: true, ddl: 'CREATE TABLE `orders` (id int)', primaryKeys: ['id'] }
    )

    await store.executeDataTransfer()

    const summary = state.dataTransferDialog.value.summary
    expect(summary.transferred).toEqual([{ type: 'table', name: 'orders', rows: 0 }])
    expect(summary.failed).toMatchObject([{ type: 'table', name: 'broken', error: '表已损坏', rows: 0 }])
    expect(api.showMessage).toHaveBeenCalledWith('数据传输完成：成功 1，跳过 0，失败 1', 'warning')
  })

  it('rejects transferring into the same database', async () => {
    const { state, store } = createStore()
    const objects = objectsOf(['table', 'orders'])
    state.dataTransferDialog.value = createDialog({
      targetDatabase: 'demo',
      objects,
      selectedObjects: keysOf(objects)
    })

    await store.executeDataTransfer()

    expect(state.dataTransferDialog.value.error).toBe('源数据库和目标数据库不能相同')
    expect(apiMock.dbQueryObjects).not.toHaveBeenCalled()
    expect(apiMock.dbInsertRows).not.toHaveBeenCalled()
  })

  it('saves the current settings as a named task', async () => {
    const { state, api, store } = createStore()
    const objects = objectsOf(['table', 'orders'])
    state.dataTransferDialog.value = createDialog({
      objects,
      selectedObjects: keysOf(objects),
      contentMode: 'structure',
      taskKeyword: ''
    })

    await store.saveTransferTask()

    expect(api.showPrompt).toHaveBeenCalled()
    expect(apiMock.patchConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        dbTransferTasks: [
          expect.objectContaining({
            name: '任务A',
            sourceDatabase: 'demo',
            targetDatabase: 'archive',
            contentMode: 'structure',
            selectedObjects: ['table:orders']
          })
        ]
      })
    )
    expect(state.dataTransferDialog.value.tasks).toHaveLength(1)
    expect(api.showMessage).toHaveBeenCalledWith('传输任务已保存', 'success')
  })
})
