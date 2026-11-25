import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { MIGRATIONS } from '../src/main/services/sqlite/schema.js'

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ntb-sqlite-'))
process.env.NTB_SQLITE_PATH = path.join(tempRoot, 'ntoolbox.db')

vi.mock('electron', () => ({
  app: { getPath: () => tempRoot }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

let storage
let chatRepository
let imageRepository
let runTraceRepository
let artifactRepository
let dbToolsRepository
let clipboardRepository
let draftRepository
let notificationRepository

beforeAll(async () => {
  storage = await import('../src/main/services/sqlite/index.js')
  chatRepository = await import('../src/main/services/sqlite/chatRepository.js')
  imageRepository = await import('../src/main/services/sqlite/imageRepository.js')
  runTraceRepository = await import('../src/main/services/sqlite/runTraceRepository.js')
  artifactRepository = await import('../src/main/services/sqlite/artifactRepository.js')
  dbToolsRepository = await import('../src/main/services/sqlite/dbToolsRepository.js')
  clipboardRepository = await import('../src/main/services/sqlite/clipboardRepository.js')
  draftRepository = await import('../src/main/services/sqlite/draftRepository.js')
  notificationRepository = await import('../src/main/services/sqlite/notificationRepository.js')
})

afterAll(async () => {
  await storage?.closeStorage()
  fs.rmSync(tempRoot, { recursive: true, force: true })
})

function makeSession(id, overrides = {}) {
  return {
    id,
    title: `会话 ${id}`,
    workspace: '/tmp/workspace',
    provider: 'bailian',
    model: 'qwen-max',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    messages: [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好，有什么可以帮你？' }
    ],
    ...overrides
  }
}

describe('SQLite 存储层', () => {
  it('打开数据库并执行 schema 迁移', async () => {
    const db = await storage.getStorage()
    const row = await db.get('PRAGMA user_version')
    expect(Number(row.user_version)).toBe(MIGRATIONS.length)
    const tables = (await db.all("SELECT name FROM sqlite_master WHERE type = 'table'")).map((item) => item.name)
    expect(tables).toEqual(
      expect.arrayContaining([
        'chat_sessions',
        'chat_messages',
        'image_uploads',
        'run_traces',
        'memory_entries',
        'clipboard_history',
        'drafts',
        'app_state'
      ])
    )
    expect(['worker', 'inline']).toContain(storage.getStorageMode())
  })

  it('所有表都包含 id / created_at / updated_at', async () => {
    const db = await storage.getStorage()
    const rows = await db.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    const tables = rows.map((item) => item.name)
    expect(tables.length).toBeGreaterThan(0)
    const missing = []
    for (const table of tables) {
      const columns = (await db.all(`PRAGMA table_info(${table})`)).map((column) => column.name)
      for (const required of ['id', 'created_at', 'updated_at']) {
        if (!columns.includes(required)) missing.push(`${table}.${required}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('保存并读回会话与消息', async () => {
    const session = makeSession('s1', {
      pinned: true,
      unread: true,
      usage: { total_tokens: 42, calls: 1 },
      context: { summary: '早期摘要', upToIndex: 4 },
      toolAllowlist: ['file-ops']
    })
    expect(await chatRepository.saveChatSession(session)).toBe(true)

    const list = await chatRepository.loadChatSessions()
    const loaded = list.find((item) => item.id === 's1')
    expect(loaded).toEqual(
      expect.objectContaining({
        title: '会话 s1',
        workspace: '/tmp/workspace',
        pinned: true,
        unread: true,
        usage: { total_tokens: 42, calls: 1 },
        toolAllowlist: ['file-ops']
      })
    )
    expect(loaded.context.summary).toBe('早期摘要')
    expect(loaded.messages).toHaveLength(2)
    expect(loaded.messages[0].content).toBe('你好')
  })

  it('重复保存会覆盖消息而不是追加', async () => {
    const session = makeSession('s2')
    await chatRepository.saveChatSession(session)
    await chatRepository.saveChatSession({ ...session, messages: [{ role: 'user', content: '只剩一条' }] })
    const loaded = (await chatRepository.loadChatSessions()).find((item) => item.id === 's2')
    expect(loaded.messages).toHaveLength(1)
    expect(loaded.messages[0].content).toBe('只剩一条')
  })

  it('导入历史会话是幂等的', async () => {
    const legacy = [makeSession('legacy-1'), makeSession('legacy-2')]
    expect(await chatRepository.importChatSessions(legacy)).toBe(2)
    await chatRepository.importChatSessions(legacy)
    const list = await chatRepository.loadChatSessions()
    expect(list.filter((item) => item.id.startsWith('legacy-')).length).toBe(2)
  })

  it('消息分页返回最新一页并可继续向前翻', async () => {
    const messages = Array.from({ length: 150 }, (_item, index) => ({ role: 'user', content: `第 ${index} 条` }))
    await chatRepository.saveChatSession(makeSession('paged', { messages }))

    const first = await chatRepository.loadChatMessagePage({ sessionId: 'paged', limit: 60 })
    expect(first.total).toBe(150)
    expect(first.items).toHaveLength(60)
    expect(first.hasMore).toBe(true)
    expect(first.items.at(-1).message.content).toBe('第 149 条')
    expect(first.items[0].message.content).toBe('第 90 条')

    const second = await chatRepository.loadChatMessagePage({
      sessionId: 'paged',
      limit: 60,
      beforeSeq: first.nextBeforeSeq
    })
    expect(second.items).toHaveLength(60)
    expect(second.items.at(-1).message.content).toBe('第 89 条')

    const third = await chatRepository.loadChatMessagePage({
      sessionId: 'paged',
      limit: 60,
      beforeSeq: second.nextBeforeSeq
    })
    expect(third.items).toHaveLength(30)
    expect(third.hasMore).toBe(false)
    expect(third.items[0].message.content).toBe('第 0 条')
  })

  it('会话摘要支持分页、关键字与归档过滤', async () => {
    await chatRepository.saveChatSession(makeSession('summary-a', { archived: true }))
    await chatRepository.saveChatSession(makeSession('summary-b', { title: '数据库优化' }))

    const page = await chatRepository.loadChatSessionSummaries({ limit: 2, offset: 0 })
    expect(page.items.length).toBeLessThanOrEqual(2)
    expect(page.hasMore).toBe(page.total > 2)
    expect(page.items[0].messages).toBeUndefined()

    const matched = await chatRepository.loadChatSessionSummaries({ keyword: '数据库', limit: 10 })
    expect(matched.items.some((item) => item.id === 'summary-b')).toBe(true)

    const activeOnly = await chatRepository.loadChatSessionSummaries({ includeArchived: false, limit: 50 })
    expect(activeOnly.items.some((item) => item.id === 'summary-a')).toBe(false)
  })

  it('删除会话时一并清理消息', async () => {
    await chatRepository.saveChatSession(makeSession('to-delete'))
    expect(await chatRepository.deleteChatSession('to-delete')).toBe(true)
    const list = await chatRepository.loadChatSessions()
    expect(list.some((item) => item.id === 'to-delete')).toBe(false)
    const db = await storage.getStorage()
    const row = await db.get('SELECT COUNT(*) AS total FROM chat_messages WHERE session_id = ?', ['to-delete'])
    expect(row.total).toBe(0)
  })
})

describe('图床历史', () => {
  function upload(id, uploadedAt) {
    return {
      id,
      name: `${id}.png`,
      url: `https://img.example/${id}.png`,
      provider: 'github',
      providerName: 'GitHub',
      size: 10,
      uploadedAt
    }
  }

  it('按时间倒序分页并按保留条数裁剪', async () => {
    await imageRepository.clearImageUploads()
    await imageRepository.addImageUploads(
      [1, 2, 3, 4, 5].map((index) => upload(`up-${index}`, index)),
      3
    )
    const first = await imageRepository.listImageUploads({ limit: 2, offset: 0 })
    expect(first.total).toBe(3)
    expect(first.hasMore).toBe(true)
    expect(first.items.map((item) => item.id)).toEqual(['up-5', 'up-4'])
    const second = await imageRepository.listImageUploads({ limit: 2, offset: 2 })
    expect(second.items.map((item) => item.id)).toEqual(['up-3'])
    expect(second.hasMore).toBe(false)
    expect(await imageRepository.countImageUploads()).toBe(3)
  })

  it('历史导入幂等并支持删除与清空', async () => {
    const legacy = [upload('legacy-up', 100), upload('up-5', 5)]
    expect(await imageRepository.importImageUploads(legacy, 100)).toBe(2)
    expect(await imageRepository.importImageUploads(legacy, 100)).toBe(2)
    expect(await imageRepository.countImageUploads()).toBe(4)
    expect(await imageRepository.removeImageUpload('legacy-up')).toBe(true)
    expect(await imageRepository.countImageUploads()).toBe(3)
    await imageRepository.clearImageUploads()
    expect(await imageRepository.countImageUploads()).toBe(0)
  })
})

describe('运行轨迹索引', () => {
  function trace(id, overrides = {}) {
    return {
      id,
      startedAt: 1700000000000,
      endedAt: 1700000005000,
      durationMs: 5000,
      status: 'done',
      termination: 'goal_reached',
      goal: '整理数据库',
      workspace: '/tmp/workspace-a',
      conversationId: 'conv-1',
      provider: 'bailian',
      model: 'qwen-max',
      toolCalls: 3,
      error: '',
      filePath: `/tmp/runs/${id}.json`,
      ...overrides
    }
  }

  it('按状态、关键字、会话过滤并分页', async () => {
    await runTraceRepository.upsertRunTraces([
      trace('t1', { startedAt: 1000 }),
      trace('t2', {
        startedAt: 2000,
        status: 'error',
        termination: 'timeout',
        goal: '导出数据',
        workspace: '/tmp/workspace-b'
      }),
      trace('t3', { startedAt: 3000, status: 'cancelled', termination: 'cancelled', conversationId: 'conv-2' })
    ])

    const page = await runTraceRepository.listRunTraces({ limit: 2 })
    expect(page.total).toBe(3)
    expect(page.items.map((item) => item.id)).toEqual(['t3', 't2'])
    expect(page.hasMore).toBe(true)

    const rest = await runTraceRepository.listRunTraces({ limit: 2, offset: 2 })
    expect(rest.items.map((item) => item.id)).toEqual(['t1'])

    const errors = await runTraceRepository.listRunTraces({ status: 'error' })
    expect(errors.items.map((item) => item.id)).toEqual(['t2'])

    const stopped = await runTraceRepository.listRunTraces({ status: 'stopped' })
    expect(stopped.items.map((item) => item.id)).toEqual(['t3'])

    const keyword = await runTraceRepository.listRunTraces({ keyword: '导出' })
    expect(keyword.items.map((item) => item.id)).toEqual(['t2'])

    const scoped = await runTraceRepository.listRunTraces({ conversationId: 'conv-1' })
    expect(scoped.total).toBe(2)
  })

  it('统计工作区数量并支持清理过期数据', async () => {
    const stats = await runTraceRepository.runTraceStats()
    expect(stats.total).toBe(3)
    expect(stats.byWorkspace).toEqual({ '/tmp/workspace-a': 2, '/tmp/workspace-b': 1 })

    expect(await runTraceRepository.pruneRunTraces(2000)).toBe(1)
    expect(await runTraceRepository.getRunTraceRow('t1')).toBeNull()
    const row = await runTraceRepository.getRunTraceRow('t2')
    expect(row).toEqual(expect.objectContaining({ status: 'error', termination: 'timeout' }))
  })
})

describe('工具结果与快照索引', () => {
  it('记录工具结果并支持快照更新与过期清理', async () => {
    const db = await storage.getStorage()
    await artifactRepository.recordToolResult({
      id: 'run-a__call-1__1',
      requestId: 'run-a',
      conversationId: 'conv-a',
      tool: 'file-ops',
      bytes: 2048,
      truncated: true,
      filePath: '/tmp/agent-results/run-a__call-1__1.txt',
      createdAt: 5000
    })
    await artifactRepository.recordToolResult({
      id: 'run-a__call-1__1',
      requestId: 'run-a',
      conversationId: 'conv-a',
      tool: 'file-ops',
      bytes: 4096,
      truncated: true,
      filePath: '/tmp/agent-results/run-a__call-1__1.txt',
      createdAt: 6000
    })
    const result = await db.get('SELECT * FROM tool_results WHERE id = ?', ['run-a__call-1__1'])
    expect(Number(result.bytes)).toBe(4096)
    expect(Number(result.created_at)).toBe(6000)
    expect(Number(result.updated_at)).toBe(6000)
    expect(result.conversation_id).toBe('conv-a')

    await artifactRepository.recordSnapshot({
      requestId: 'run-a',
      conversationId: 'conv-a',
      fileCount: 1,
      directory: '/tmp/agent-snapshots/run-a',
      createdAt: 5000
    })
    await artifactRepository.recordSnapshot({
      requestId: 'run-a',
      conversationId: 'conv-a',
      fileCount: 4,
      directory: '/tmp/agent-snapshots/run-a',
      createdAt: 7000
    })
    const snapshot = await db.get('SELECT * FROM tool_snapshots WHERE request_id = ?', ['run-a'])
    expect(snapshot.id).toBe('run-a')
    expect(Number(snapshot.file_count)).toBe(4)
    expect(Number(snapshot.created_at)).toBe(7000)
    expect(Number(snapshot.updated_at)).toBe(7000)

    await artifactRepository.pruneArtifacts(6500)
    expect((await db.get('SELECT COUNT(*) AS total FROM tool_results')).total).toBe(0)
    expect((await db.get('SELECT COUNT(*) AS total FROM tool_snapshots')).total).toBe(1)
  })
})

describe('数据库工具仓储', () => {
  it('写入查询历史并按条数裁剪、分页读取', async () => {
    await dbToolsRepository.clearDbQueryHistory()
    for (let i = 0; i < 6; i += 1) {
      await dbToolsRepository.addDbQueryHistory(
        {
          id: `h-${i}`,
          sql: `SELECT ${i}`,
          connectionName: 'local',
          database: 'demo',
          duration: i * 10,
          success: i !== 3,
          createdAt: 1000 + i
        },
        4
      )
    }
    const first = await dbToolsRepository.listDbQueryHistory({ limit: 2 })
    expect(first.total).toBe(4)
    expect(first.hasMore).toBe(true)
    expect(first.items.map((item) => item.id)).toEqual(['h-5', 'h-4'])
    expect(first.items[0].sql).toBe('SELECT 5')
    expect(first.items[0].duration).toBe(50)

    const second = await dbToolsRepository.listDbQueryHistory({ limit: 2, offset: 2 })
    expect(second.items.map((item) => item.id)).toEqual(['h-3', 'h-2'])
    expect(second.items[0].success).toBe(false)
    expect(second.hasMore).toBe(false)
  })

  it('迁移旧历史保持幂等', async () => {
    await dbToolsRepository.clearDbQueryHistory()
    const legacy = [
      { id: 'legacy-1', sql: 'SELECT * FROM a', createdAt: 2000 },
      { id: 'legacy-2', sql: 'SELECT * FROM b', createdAt: 3000 }
    ]
    expect(await dbToolsRepository.importDbQueryHistory(legacy, 10)).toBe(2)
    expect(await dbToolsRepository.importDbQueryHistory(legacy, 10)).toBe(2)
    const page = await dbToolsRepository.listDbQueryHistory({ limit: 10 })
    expect(page.total).toBe(2)
    expect(page.items[0].id).toBe('legacy-2')

    expect(await dbToolsRepository.removeDbQueryHistory('legacy-1')).toBe(true)
    expect((await dbToolsRepository.listDbQueryHistory()).total).toBe(1)
    await dbToolsRepository.clearDbQueryHistory()
    expect((await dbToolsRepository.listDbQueryHistory()).total).toBe(0)
  })

  it('保存、更新与删除 SQL 收藏及文件夹', async () => {
    expect(
      await dbToolsRepository.saveDbSnippet({
        id: 'snip-1',
        name: '全部用户',
        sql: 'SELECT * FROM users',
        folder: '常用',
        createdAt: 1000
      })
    ).toBe(true)
    expect(
      await dbToolsRepository.saveDbSnippet({
        id: 'snip-1',
        name: '活跃用户',
        sql: 'SELECT * FROM users WHERE active = 1',
        folder: '常用',
        createdAt: 1000
      })
    ).toBe(true)
    const snippets = await dbToolsRepository.listDbSnippets()
    expect(snippets).toHaveLength(1)
    expect(snippets[0].name).toBe('活跃用户')
    expect(snippets[0].sql).toBe('SELECT * FROM users WHERE active = 1')
    expect(snippets[0].createdAt).toBe(1000)

    expect(await dbToolsRepository.importDbSnippets([{ id: 'snip-1', name: '覆盖', sql: 'SELECT 1' }])).toBe(1)
    expect((await dbToolsRepository.listDbSnippets())[0].name).toBe('活跃用户')

    expect(await dbToolsRepository.addDbSnippetFolder(' 常用 ')).toBe(true)
    expect(await dbToolsRepository.addDbSnippetFolder('常用')).toBe(true)
    expect(await dbToolsRepository.addDbSnippetFolder('')).toBe(false)
    expect(await dbToolsRepository.importDbSnippetFolders(['报表', ''])).toBe(1)
    expect(await dbToolsRepository.listDbSnippetFolders()).toEqual(['常用', '报表'])

    expect(await dbToolsRepository.removeDbSnippet('snip-1')).toBe(true)
    expect(await dbToolsRepository.listDbSnippets()).toHaveLength(0)
  })

  it('记忆索引整组替换并按作用域分页', async () => {
    const globalEntries = [
      {
        id: 'g-1',
        title: '偏好',
        content: '偏好 TypeScript',
        category: 'preference',
        createdAt: 1000,
        updatedAt: 1000
      },
      { id: 'g-2', title: '习惯', content: '用 pnpm', category: 'habit', createdAt: 2000, updatedAt: 3000 }
    ]
    expect(await dbToolsRepository.replaceMemoryEntries('global', '', globalEntries)).toBe(2)
    expect(await dbToolsRepository.replaceMemoryEntries('project', '/tmp/ws-a', globalEntries.slice(0, 1))).toBe(1)

    const globalPage = await dbToolsRepository.listMemoryEntries({ scope: 'global', limit: 1 })
    expect(globalPage.total).toBe(2)
    expect(globalPage.hasMore).toBe(true)
    expect(globalPage.items[0].id).toBe('g-2')
    expect(globalPage.items[0].scope).toBe('global')
    expect(globalPage.items[0].workspace).toBe('')

    const projectPage = await dbToolsRepository.listMemoryEntries({ scope: 'project', workspace: '/tmp/ws-a' })
    expect(projectPage.total).toBe(1)
    expect(projectPage.items[0].id).toBe('g-1')
    expect(projectPage.items[0].workspace).toBe('/tmp/ws-a')

    expect(await dbToolsRepository.listMemoryEntries({ scope: 'project', workspace: '/tmp/ws-b' })).toEqual({
      items: [],
      total: 0,
      hasMore: false
    })

    expect(await dbToolsRepository.replaceMemoryEntries('global', '', [])).toBe(0)
    expect((await dbToolsRepository.listMemoryEntries({ scope: 'global' })).total).toBe(0)
    expect((await dbToolsRepository.listMemoryEntries({ scope: 'project', workspace: '/tmp/ws-a' })).total).toBe(1)
  })
})

describe('剪贴板历史仓储', () => {
  it('写入、分页读取并保持置顶保留语义', async () => {
    await clipboardRepository.clearClipboardEntries()
    for (let i = 0; i < 5; i += 1) {
      await clipboardRepository.saveClipboardEntry({
        id: `c-${i}`,
        type: 'text',
        text: `内容 ${i}`,
        fingerprint: `fp-${i}`,
        pinned: i === 0,
        createdAt: 1000 + i,
        updatedAt: 1000 + i
      })
    }

    const first = await clipboardRepository.listClipboardEntries({ limit: 2 })
    expect(first.total).toBe(5)
    expect(first.hasMore).toBe(true)
    expect(first.items.map((item) => item.id)).toEqual(['c-4', 'c-3'])
    expect(first.items[0].text).toBe('内容 4')

    await clipboardRepository.pruneClipboardEntries(3)
    const rows = (await clipboardRepository.listClipboardEntries({ limit: 10 })).items
    expect(rows.map((item) => item.id)).toEqual(['c-4', 'c-3', 'c-0'])
    expect(rows[2].pinned).toBe(true)

    const updated = await clipboardRepository.saveClipboardEntry({
      id: 'c-0',
      type: 'text',
      text: '已更新',
      fingerprint: 'fp-0',
      pinned: false,
      createdAt: 1000,
      updatedAt: 9000
    })
    expect(updated).toBe(true)
    const reloaded = (await clipboardRepository.listClipboardEntries({ limit: 10 })).items
    expect(reloaded[0].id).toBe('c-0')
    expect(reloaded[0].text).toBe('已更新')
    expect(reloaded[0].pinned).toBe(false)
  })

  it('整组替换并持久化暂停状态', async () => {
    const entries = [
      {
        id: 'img-1',
        type: 'image',
        image: 'data:image/png;base64,AAAA',
        fingerprint: 'fp-img',
        pinned: false,
        createdAt: 100,
        updatedAt: 200
      },
      {
        id: 'txt-1',
        type: 'text',
        text: 'hello',
        fingerprint: 'fp-txt',
        pinned: true,
        createdAt: 100,
        updatedAt: 150
      }
    ]
    expect(await clipboardRepository.replaceClipboardEntries(entries, 2)).toBe(2)
    const page = await clipboardRepository.listClipboardEntries({ limit: 10 })
    expect(page.total).toBe(2)
    expect(page.items.find((item) => item.id === 'img-1').image).toBe('data:image/png;base64,AAAA')

    expect(await clipboardRepository.setClipboardPausedState(true)).toBe(true)
    expect(await clipboardRepository.getClipboardPausedState()).toBe(true)
    expect(await clipboardRepository.setClipboardPausedState(false)).toBe(true)
    expect(await clipboardRepository.getClipboardPausedState()).toBe(false)

    expect(await clipboardRepository.removeClipboardEntry('txt-1')).toBe(true)
    expect((await clipboardRepository.listClipboardEntries()).total).toBe(1)
    await clipboardRepository.clearClipboardEntries()
    expect((await clipboardRepository.listClipboardEntries()).total).toBe(0)
  })
})

describe('草稿仓储', () => {
  it('保存、更新、删除与分页排序', async () => {
    await draftRepository.clearDrafts('wechat-draft')
    expect(
      await draftRepository.saveDraft('wechat-draft', { id: 'd-1', title: '第一篇', content: 'A', updatedAt: 1000 })
    ).toBe(true)
    await draftRepository.saveDraft('wechat-draft', { id: 'd-2', title: '第二篇', content: 'B', updatedAt: 2000 })
    await draftRepository.saveDraft('wechat-draft', { id: 'd-1', title: '第一篇改', content: 'A2', updatedAt: 3000 })

    const page = await draftRepository.listDrafts('wechat-draft', { limit: 1 })
    expect(page.total).toBe(2)
    expect(page.hasMore).toBe(true)
    expect(page.items[0]).toMatchObject({ id: 'd-1', title: '第一篇改', content: 'A2' })

    const second = await draftRepository.listDrafts('wechat-draft', { limit: 1, offset: 1 })
    expect(second.items[0].id).toBe('d-2')
    expect(second.hasMore).toBe(false)

    expect(await draftRepository.saveDraft('unknown', { id: 'x', content: 'x' })).toBe(false)
    expect(await draftRepository.removeDraft('wechat-draft', 'd-2')).toBe(true)
    expect((await draftRepository.listDrafts('wechat-draft')).total).toBe(1)
  })

  it('编辑器草稿支持 JSON/YAML/HTML', async () => {
    for (const kind of ['json', 'yaml', 'html']) {
      await draftRepository.clearDrafts(kind)
      expect(await draftRepository.saveDraft(kind, { id: 'current', content: `${kind}-content` })).toBe(true)
      const page = await draftRepository.listDrafts(kind)
      expect(page.total).toBe(1)
      expect(page.items[0].content).toBe(`${kind}-content`)
      await draftRepository.clearDrafts(kind)
    }
  })

  it('旧草稿导入幂等并按保留条数裁剪', async () => {
    await draftRepository.clearDrafts('wechat-draft')
    const legacy = []
    for (let i = 0; i < 5; i += 1) {
      legacy.push({ id: `legacy-${i}`, title: `草稿 ${i}`, content: `内容 ${i}`, updatedAt: 1000 + i })
    }
    expect(await draftRepository.importDrafts('wechat-draft', legacy, 3)).toBe(5)
    expect(await draftRepository.importDrafts('wechat-draft', legacy, 3)).toBe(5)
    const page = await draftRepository.listDrafts('wechat-draft')
    expect(page.total).toBe(3)
    expect(page.items.map((draft) => draft.id)).toEqual(['legacy-4', 'legacy-3', 'legacy-2'])

    expect(await draftRepository.importDrafts('markdown', [{ id: 'current', content: '# 标题' }], 1)).toBe(1)
    const single = await draftRepository.listDrafts('markdown')
    expect(single.total).toBe(1)
    expect(single.items[0].content).toBe('# 标题')

    await draftRepository.clearDrafts('markdown')
    expect((await draftRepository.listDrafts('markdown')).total).toBe(0)
    await draftRepository.clearDrafts('wechat-draft')
  })
})

describe('notification center repository', () => {
  it('records notifications, tracks unread and marks read', async () => {
    await notificationRepository.clearNotifications()
    const first = await notificationRepository.addNotification({
      kind: 'upload_done',
      level: 'success',
      title: '上传完成',
      body: '图片已上传到图床',
      createdAt: 1000
    })
    const second = await notificationRepository.addNotification({
      kind: 'backup_done',
      level: 'success',
      title: '备份完成',
      body: '任务已结束',
      createdAt: 2000
    })
    expect(first?.id).toBeTruthy()
    expect(second?.id).toBeTruthy()

    const page = await notificationRepository.listNotifications({ limit: 10 })
    expect(page.total).toBe(2)
    expect(page.unread).toBe(2)
    expect(page.items.map((item) => item.kind)).toEqual(['backup_done', 'upload_done'])
    expect(await notificationRepository.unreadNotificationCount()).toBe(2)

    expect(await notificationRepository.markNotificationsRead([first.id])).toBe(true)
    expect(await notificationRepository.unreadNotificationCount()).toBe(1)

    expect(await notificationRepository.markNotificationsRead()).toBe(true)
    expect(await notificationRepository.unreadNotificationCount()).toBe(0)

    expect(await notificationRepository.clearNotifications()).toBe(true)
    const empty = await notificationRepository.listNotifications({ limit: 10 })
    expect(empty.total).toBe(0)
    expect(empty.items).toEqual([])
  })
})
