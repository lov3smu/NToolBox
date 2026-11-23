import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const state = vi.hoisted(() => ({
  userDataDir: '',
  config: { memory: { auto_capture: true } }
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => state.userDataDir
  }
}))

vi.mock('../src/main/services/config.js', () => ({
  getConfig: () => state.config
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}))

import {
  addMemory,
  updateMemory,
  removeMemory,
  clearMemory,
  clearProjectMemory,
  getMemoryOverview,
  addKnowledgeSource,
  removeKnowledgeSource,
  setKnowledgeSourceEnabled,
  searchKnowledge,
  buildMemoryPrompt
} from '../src/main/services/memory.js'

describe('memory service', () => {
  let workspace

  beforeEach(() => {
    state.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ntoolbox-memory-'))
    state.config = { memory: { auto_capture: true } }
    workspace = path.join(state.userDataDir, 'workspace')
    fs.mkdirSync(workspace, { recursive: true })
  })

  afterEach(async () => {
    const { closeStorage } = await import('../src/main/services/sqlite/index.js')
    await closeStorage()
    fs.rmSync(state.userDataDir, { recursive: true, force: true })
  })

  it('stores global and project memory with workspace isolation', async () => {
    const globalEntry = await addMemory({
      scope: 'global',
      content: '用户偏好 pnpm 与单引号、无分号',
      tags: ['偏好', '代码风格']
    })
    expect(globalEntry.success).toBe(true)
    expect(globalEntry.entry.tags).toEqual(['偏好', '代码风格'])

    const duplicate = await addMemory({
      scope: 'global',
      content: '用户偏好 pnpm 与单引号、无分号',
      tags: ['新标签']
    })
    expect(duplicate.duplicated).toBe(true)

    const projectEntry = await addMemory({
      scope: 'project',
      workspacePath: workspace,
      content: '该项目使用 Vue 3 + Electron',
      source: 'ai'
    })
    expect(projectEntry.success).toBe(true)

    const overview = await getMemoryOverview(workspace)
    expect(overview.global).toHaveLength(1)
    expect(overview.global[0].tags).toEqual(['新标签'])
    expect(overview.project).toHaveLength(1)
    expect(overview.project[0].source).toBe('ai')
    expect(overview.projectPath).toBe(path.resolve(workspace))

    const otherWorkspace = path.join(state.userDataDir, 'other-project')
    const otherOverview = await getMemoryOverview(otherWorkspace)
    expect(otherOverview.global).toHaveLength(1)
    expect(otherOverview.project).toHaveLength(0)
  })

  it('stores global and project memory as markdown files', async () => {
    const globalEntry = await addMemory({
      scope: 'global',
      content: '用户偏好 pnpm 与单引号、无分号',
      tags: ['偏好', '代码风格']
    })
    const globalFile = path.join(state.userDataDir, 'memory', 'global', `${globalEntry.entry.id}.md`)
    expect(fs.existsSync(globalFile)).toBe(true)
    const globalRaw = fs.readFileSync(globalFile, 'utf8')
    expect(globalRaw.startsWith('---')).toBe(true)
    expect(globalRaw).toContain('tags: 偏好, 代码风格')
    expect(globalRaw).toContain('用户偏好 pnpm 与单引号、无分号')

    const projectEntry = await addMemory({
      scope: 'project',
      workspacePath: workspace,
      content: '该项目使用 Vue 3 + Electron',
      source: 'ai'
    })
    const projectFile = path.join(workspace, '.ntoolbox', 'memory', `${projectEntry.entry.id}.md`)
    expect(fs.existsSync(projectFile)).toBe(true)
    expect(fs.readFileSync(projectFile, 'utf8')).toContain('source: ai')

    const overview = await getMemoryOverview(workspace)
    expect(overview.globalDir).toBe(path.join(state.userDataDir, 'memory', 'global'))
    expect(overview.projectDir).toBe(path.join(workspace, '.ntoolbox', 'memory'))
    expect(overview.project).toHaveLength(1)

    const updated = await updateMemory({
      scope: 'project',
      workspacePath: workspace,
      id: projectEntry.entry.id,
      content: '更新后的项目记忆'
    })
    expect(updated.success).toBe(true)
    expect(fs.readFileSync(projectFile, 'utf8')).toContain('更新后的项目记忆')
  })

  it('migrates legacy JSON stores into markdown files', async () => {
    const legacyDir = path.join(state.userDataDir, 'memory')
    fs.mkdirSync(legacyDir, { recursive: true })
    fs.writeFileSync(
      path.join(legacyDir, 'global.json'),
      JSON.stringify({
        version: 1,
        entries: [
          { id: 'legacy-global', content: '旧全局记忆', tags: ['旧'], source: 'ai', createdAt: 1, updatedAt: 2 }
        ]
      }),
      'utf8'
    )
    const legacyWorkspace = path.join(state.userDataDir, 'legacy-project')
    fs.mkdirSync(legacyWorkspace)
    fs.writeFileSync(
      path.join(legacyDir, 'projects.json'),
      JSON.stringify({
        version: 1,
        projects: {
          [path.resolve(legacyWorkspace)]: {
            path: legacyWorkspace,
            entries: [
              { id: 'legacy-project', content: '旧项目记忆', tags: [], source: 'user', createdAt: 1, updatedAt: 2 }
            ],
            updatedAt: 2
          }
        }
      }),
      'utf8'
    )

    const overview = await getMemoryOverview(legacyWorkspace)
    expect(overview.global.map((entry) => entry.content)).toContain('旧全局记忆')
    expect(overview.project.map((entry) => entry.content)).toContain('旧项目记忆')
    expect(fs.existsSync(path.join(legacyDir, 'global', 'legacy-global.md'))).toBe(true)
    expect(fs.existsSync(path.join(legacyWorkspace, '.ntoolbox', 'memory', 'legacy-project.md'))).toBe(true)
    expect(fs.existsSync(path.join(legacyDir, 'global.json'))).toBe(false)
    expect(fs.existsSync(path.join(legacyDir, 'global.json.migrated'))).toBe(true)
    expect(fs.existsSync(path.join(legacyDir, 'projects.json.migrated'))).toBe(true)
  })

  it('keeps legacy project memory when the workspace is missing', async () => {
    const legacyDir = path.join(state.userDataDir, 'memory')
    fs.mkdirSync(legacyDir, { recursive: true })
    const missingWorkspace = path.join(state.userDataDir, 'removed-project')
    fs.writeFileSync(
      path.join(legacyDir, 'projects.json'),
      JSON.stringify({
        version: 1,
        projects: {
          [path.resolve(missingWorkspace)]: {
            path: missingWorkspace,
            entries: [
              {
                id: 'orphan-project',
                content: '工作区已不存在的项目记忆',
                tags: [],
                source: 'ai',
                createdAt: 1,
                updatedAt: 2
              }
            ],
            updatedAt: 2
          }
        }
      }),
      'utf8'
    )

    const overview = await getMemoryOverview(missingWorkspace)
    expect(overview.project).toHaveLength(0)
    expect(fs.existsSync(path.join(legacyDir, 'projects.json'))).toBe(true)
    expect(fs.existsSync(path.join(legacyDir, 'projects.json.migrated'))).toBe(false)
    expect(fs.existsSync(missingWorkspace)).toBe(false)
  })

  it('clears only the removed workspace project memory files', async () => {
    const otherWorkspace = path.join(state.userDataDir, 'other-workspace')
    fs.mkdirSync(otherWorkspace)
    await addMemory({ scope: 'global', content: '全局记忆保留' })
    await addMemory({ scope: 'project', workspacePath: workspace, content: '待清空项目记忆' })
    await addMemory({ scope: 'project', workspacePath: otherWorkspace, content: '另一个项目记忆' })
    const keepFile = path.join(workspace, 'keep.txt')
    fs.writeFileSync(keepFile, 'keep', 'utf8')

    const memoryDir = path.join(workspace, '.ntoolbox', 'memory')
    expect(fs.readdirSync(memoryDir)).toHaveLength(1)

    const result = await clearProjectMemory(workspace)
    expect(result.success).toBe(true)
    expect(result.removed).toBe(1)
    expect(fs.existsSync(memoryDir)).toBe(false)
    expect(fs.existsSync(path.join(workspace, '.ntoolbox'))).toBe(false)
    expect(fs.existsSync(keepFile)).toBe(true)

    const removedOverview = await getMemoryOverview(workspace)
    expect(removedOverview.global).toHaveLength(1)
    expect(removedOverview.project).toHaveLength(0)
    const otherOverview = await getMemoryOverview(otherWorkspace)
    expect(otherOverview.project.map((entry) => entry.content)).toContain('另一个项目记忆')
  })

  it('updates, removes and clears scoped memory', async () => {
    const created = await addMemory({ scope: 'global', content: '旧内容' })
    const updated = await updateMemory({
      scope: 'global',
      id: created.entry.id,
      content: '新内容',
      tags: ['更新']
    })
    expect(updated.success).toBe(true)
    expect(updated.entry.content).toBe('新内容')
    expect(updated.entry.tags).toEqual(['更新'])

    const project = await addMemory({
      scope: 'project',
      workspacePath: workspace,
      content: '项目约定'
    })
    const removed = await removeMemory({
      scope: 'project',
      workspacePath: workspace,
      id: project.entry.id
    })
    expect(removed.success).toBe(true)

    const cleared = await clearMemory({ scope: 'global' })
    expect(cleared.success).toBe(true)
    const overview = await getMemoryOverview(workspace)
    expect(overview.global).toHaveLength(0)
    expect(overview.project).toHaveLength(0)
  })

  it('rejects invalid scope, missing workspace and sensitive content', async () => {
    expect((await addMemory({ scope: 'unknown', content: 'x' })).success).toBe(false)
    expect((await addMemory({ scope: 'project', content: 'x' })).success).toBe(false)
    expect((await addMemory({ scope: 'global', content: '   ' })).success).toBe(false)

    const secret = await addMemory({
      scope: 'global',
      content: 'api_key: sk-1234567890abcdefghij'
    })
    expect(secret.success).toBe(false)
    expect(secret.error).toContain('敏感')

    const longContent = await addMemory({ scope: 'global', content: 'a'.repeat(4001) })
    expect(longContent.success).toBe(false)
    expect(longContent.error).toContain('4000')
  })

  it('indexes knowledge sources and ranks search results', async () => {
    const docs = path.join(state.userDataDir, 'docs')
    fs.mkdirSync(docs, { recursive: true })
    fs.writeFileSync(path.join(docs, 'deploy.md'), '# 部署流程\n\n使用 Docker 构建镜像，然后执行发布脚本。\n', 'utf8')
    fs.writeFileSync(path.join(docs, 'config.json'), '{"connection":"mysql57"}', 'utf8')

    const added = await addKnowledgeSource({ type: 'directory', targetPath: docs })
    expect(added.success).toBe(true)
    expect(added.source.type).toBe('directory')
    expect(added.source.label).toBe('docs')

    const duplicated = await addKnowledgeSource({ type: 'directory', targetPath: docs })
    expect(duplicated.duplicated).toBe(true)

    const search = await searchKnowledge({ query: 'Docker 部署', topK: 5 })
    expect(search.success).toBe(true)
    expect(search.results.length).toBeGreaterThan(0)
    expect(search.results[0].path).toBe(path.join(docs, 'deploy.md'))
    expect(search.results[0].excerpt).toContain('Docker')

    const configSearch = await searchKnowledge({ query: 'mysql57' })
    expect(configSearch.results[0].path).toBe(path.join(docs, 'config.json'))

    const overview = await getMemoryOverview(workspace)
    expect(overview.knowledge).toHaveLength(1)
    expect(overview.knowledgeEnabled).toBe(1)
    expect(overview.knowledge[0].available).toBe(true)
  })

  it('toggles and removes knowledge sources', async () => {
    const docs = path.join(state.userDataDir, 'notes')
    fs.mkdirSync(docs)
    fs.writeFileSync(path.join(docs, 'guide.txt'), 'release checklist', 'utf8')
    const added = await addKnowledgeSource({ type: 'directory', targetPath: docs })

    const disabled = await setKnowledgeSourceEnabled(added.source.id, false)
    expect(disabled.success).toBe(true)
    const noSources = await searchKnowledge({ query: 'release' })
    expect(noSources.results).toHaveLength(0)
    expect(noSources.message).toContain('尚未启用')

    await setKnowledgeSourceEnabled(added.source.id, true)
    const enabled = await searchKnowledge({ query: 'checklist' })
    expect(enabled.results).toHaveLength(1)

    const removed = await removeKnowledgeSource(added.source.id)
    expect(removed.success).toBe(true)
    expect((await getMemoryOverview(workspace)).knowledge).toHaveLength(0)
  })

  it('rejects unsupported knowledge files and missing paths', async () => {
    const image = path.join(state.userDataDir, 'image.png')
    fs.writeFileSync(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    const unsupported = await addKnowledgeSource({ type: 'file', targetPath: image })
    expect(unsupported.success).toBe(false)
    expect(unsupported.error).toContain('不支持')

    const missing = await addKnowledgeSource({
      type: 'directory',
      targetPath: path.join(state.userDataDir, 'missing')
    })
    expect(missing.success).toBe(false)
    expect(missing.error).toContain('不存在')

    const wrongType = await addKnowledgeSource({ type: 'folder', targetPath: image })
    expect(wrongType.success).toBe(false)
  })

  it('builds a scoped prompt with memory and knowledge hints', async () => {
    await addMemory({ scope: 'global', content: '始终使用中文回复', tags: ['语言'] })
    await addMemory({ scope: 'project', workspacePath: workspace, content: '项目使用 Electron 主进程 ESM' })
    const docs = path.join(state.userDataDir, 'kb')
    fs.mkdirSync(docs)
    fs.writeFileSync(path.join(docs, 'spec.md'), '# 接口规范', 'utf8')
    await addKnowledgeSource({ type: 'directory', targetPath: docs })

    const prompt = await buildMemoryPrompt(workspace)
    expect(prompt).toContain('长期记忆')
    expect(prompt).toContain('始终使用中文回复')
    expect(prompt).toContain('项目使用 Electron 主进程 ESM')
    expect(prompt).toContain('外挂知识库')
    expect(prompt).toContain('kb')
    expect(prompt).toContain('knowledge-search')
    expect(prompt).toContain('自动记忆已开启')

    state.config = { memory: { auto_capture: false } }
    const noAuto = await buildMemoryPrompt(workspace)
    expect(noAuto).not.toContain('自动记忆已开启')

    state.config = { memory: { auto_capture: true } }
    const chatOnly = await buildMemoryPrompt(workspace, false)
    expect(chatOnly).toContain('长期记忆')
    expect(chatOnly).toContain('始终使用中文回复')
    expect(chatOnly).not.toContain('knowledge-search')
    expect(chatOnly).not.toContain('自动记忆已开启')
  })

  it('ranks prompt entries by query relevance before recency', async () => {
    await addMemory({ scope: 'global', content: '界面偏好紧凑布局' })
    await addMemory({ scope: 'global', content: '数据库连接使用 mysql57' })
    const prompt = await buildMemoryPrompt(workspace, true, 'mysql57 连接')
    expect(prompt.indexOf('mysql57')).toBeGreaterThan(-1)
    expect(prompt.indexOf('mysql57')).toBeLessThan(prompt.indexOf('紧凑布局'))
  })

  it('always instructs auto capture when enabled, even on an empty store', async () => {
    const prompt = await buildMemoryPrompt(workspace)
    expect(prompt).toContain('自动记忆已开启')
    expect(prompt).toContain('scope=global')
    expect(prompt).toContain('scope=project')

    const withoutWorkspace = await buildMemoryPrompt('')
    expect(withoutWorkspace).toContain('自动记忆已开启')
    expect(withoutWorkspace).toContain('scope=global')
    expect(withoutWorkspace).not.toContain('scope=project')

    expect(await buildMemoryPrompt(workspace, false)).toBe('')

    state.config = { memory: { auto_capture: false } }
    expect(await buildMemoryPrompt(workspace)).toBe('')
  })
})
