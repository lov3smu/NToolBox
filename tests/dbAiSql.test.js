import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@/api', () => ({
  chat: vi.fn(),
  dbAlterTable: vi.fn(),
  dbCreateUser: vi.fn(),
  dbDropUser: vi.fn(),
  dbGetErData: vi.fn(),
  dbGetTableMeta: vi.fn(),
  dbGetUserGrants: vi.fn(),
  dbPreviewAlterTable: vi.fn(),
  dbQueryUsers: vi.fn(),
  dbSetUserPassword: vi.fn(),
  dbSetUserPrivileges: vi.fn()
}))

import { chat, dbGetErData } from '@/api'
import { createAdvanced } from '../src/renderer/src/views/database/useAdvanced.js'

const TABLES = [
  { name: 'sys_user', comment: '系统用户表', columns: [{ name: 'id', columnType: 'bigint', columnKey: 'PRI' }] },
  {
    name: 'biz_contract',
    comment: '合同信息表',
    columns: [
      { name: 'id', columnType: 'bigint', columnKey: 'PRI' },
      { name: 'contract_no', columnType: 'varchar(64)', comment: '合同编号' },
      { name: 'amount', columnType: 'decimal(12,2)', comment: '合同金额' }
    ]
  },
  { name: 'sys_role', comment: '角色表', columns: [{ name: 'id', columnType: 'bigint', columnKey: 'PRI' }] }
]

function createState() {
  return {
    activeTabId: ref(''),
    aiDialog: ref({ show: false }),
    databaseObjectsMap: ref({}),
    databases: ref([]),
    erDialog: ref({ show: false }),
    explainDialog: ref({ show: false }),
    historyDialog: ref({ show: false, section: 'history', keyword: '', folder: '' }),
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

function createApi() {
  return {
    showMessage: vi.fn(async () => true),
    showPrompt: vi.fn(async () => ''),
    showConfirm: vi.fn(async () => true),
    createQueryTab: vi.fn(),
    executeTableQuery: vi.fn(),
    loadDatabaseObjects: vi.fn(),
    selectConnection: vi.fn(),
    connectToDatabase: vi.fn()
  }
}

describe('AI 生成 SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.localStorage = { getItem: () => null, setItem: () => {} }
  })

  it('把相关业务表（合同表）放入提示词并格式化生成结果', async () => {
    const state = createState()
    const api = createApi()
    const advanced = createAdvanced(state, api)
    const tab = { type: 'query', connectionName: 'local', database: 'biz', sqlQuery: '' }

    dbGetErData.mockResolvedValue({ success: true, tables: TABLES, foreignKeys: [] })
    chat.mockResolvedValue({
      success: true,
      content: '```sql\nselect c.contract_no,c.amount from biz_contract c where c.amount>1000;\n```'
    })

    state.aiDialog.value = {
      show: true,
      tab,
      database: 'biz',
      prompt: '统计合同金额大于 1000 的合同',
      loading: false,
      result: '',
      error: ''
    }
    await advanced.generateSqlForTab(tab)

    expect(dbGetErData).toHaveBeenCalledWith('local', 'biz', 1000)
    expect(chat).toHaveBeenCalledTimes(1)
    const [messages, options] = chat.mock.calls[0]
    expect(options).toEqual({ toolsEnabled: false })
    const prompt = messages[0].content
    expect(prompt).toContain('biz_contract')
    expect(prompt).toContain('合同金额')
    expect(prompt.indexOf('biz_contract')).toBeLessThan(prompt.indexOf('sys_user'))

    expect(state.aiDialog.value.error).toBe('')
    expect(state.aiDialog.value.result).toBe(`SELECT c.contract_no,
  c.amount
FROM biz_contract c
WHERE c.amount > 1000;`)
  })

  it('表结构读取失败时仍会请求 AI 并给出提示', async () => {
    const state = createState()
    const api = createApi()
    const advanced = createAdvanced(state, api)
    const tab = { type: 'query', connectionName: 'local', database: 'biz', sqlQuery: '' }

    dbGetErData.mockResolvedValue({ success: false, error: '读取失败' })
    chat.mockResolvedValue({ success: true, content: 'select 1' })

    state.aiDialog.value = {
      show: true,
      tab,
      database: 'biz',
      prompt: '查询合同',
      loading: false,
      result: '',
      error: ''
    }
    await advanced.generateSqlForTab(tab)

    expect(chat.mock.calls[0][0][0].content).toContain('未能读取数据库结构')
    expect(state.aiDialog.value.result).toBe('SELECT 1')
  })
})
