import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest'

const testUserData = path.join(os.tmpdir(), `ntoolbox-skills-${process.pid}`)
const userSkillDir = path.join(testUserData, 'skills', 'json-format')
const testFileBase = path.join(testUserData, 'files')

const chatMock = vi.fn(async () => ({ success: true, content: 'prompt-result' }))
const providerMock = {
  name: 'MockProvider',
  validateConfig: vi.fn(() => ({ valid: true })),
  getDefaultModel: vi.fn(() => 'mock-default'),
  chat: chatMock
}

vi.mock('electron', () => ({
  app: { getPath: () => testUserData }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

vi.mock('../src/main/services/config', () => ({
  getConfig: vi.fn(() => ({
    ai: { provider: 'bailian' },
    app: { base_path: testFileBase },
    extensions: { mcp_servers: [], disabled_skills: [], skill_overrides: {} }
  }))
}))

vi.mock('../src/main/services/ai/index.js', () => ({
  getProvider: vi.fn(() => providerMock),
  resolveProviderRuntimeConfig: vi.fn(() => ({}))
}))

vi.mock('../src/main/services/templateGenerator.js', () => ({
  generateDictionarySql: vi.fn(),
  generateDictionarySqlBatch: vi.fn(),
  generateFunctionGroupSql: vi.fn()
}))

vi.mock('../src/main/services/database.js', () => ({}))
vi.mock('../src/main/services/generator.js', () => ({ generateSQLFile: vi.fn() }))
vi.mock('../src/main/services/clawhub.js', () => ({
  fetchClawHubMarket: vi.fn(),
  fetchClawHubSkillDetail: vi.fn(),
  normalizeSkillName: vi.fn(),
  searchClawHubSkills: vi.fn()
}))

let skills

beforeAll(async () => {
  fs.mkdirSync(userSkillDir, { recursive: true })
  fs.mkdirSync(testFileBase, { recursive: true })
  fs.writeFileSync(
    path.join(userSkillDir, 'skill.json'),
    JSON.stringify({
      name: 'json-format',
      version: '9.9.9',
      description: '试图覆盖内置技能',
      author: 'test',
      parameters: { type: 'object', properties: {} }
    })
  )

  skills = await import('../src/main/services/skills.js')
  await skills.initSkills()
})

afterAll(() => {
  fs.rmSync(testUserData, { recursive: true, force: true })
})

describe('skills service', () => {
  it('loads builtin skills and ignores user skills with builtin names', () => {
    const manager = skills.getSkillsManager()
    expect(manager.getSkill('json-format').type).toBe('builtin')
    expect(manager.getSkill('json-format').version).not.toBe('9.9.9')
    const codeReview = manager.getSkills().find((skill) => skill.name === 'code-review')
    expect(codeReview.hasPrompt).toBe(true)
    expect(manager.getSkill('file-ops').type).toBe('builtin')
    expect(manager.getToolDefinitions().some((tool) => tool.function.name === 'file-ops')).toBe(true)
  })

  it('rejects calls that miss required parameters', async () => {
    const result = await skills.executeSkill('json-format', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('json_string')
  })

  it('drops unknown parameters before execution', async () => {
    const result = await skills.executeSkill('json-format', {
      json_string: '{"a":1}',
      indent: 0,
      unexpected: 'ignored'
    })
    expect(result.success).toBe(true)
    expect(result.content).toBe('{"a":1}')
  })

  it('uses the runtime provider and model for prompt skills', async () => {
    const result = await skills.executeSkill(
      'code-review',
      { code: 'const a = 1' },
      { provider: providerMock, model: 'runtime-model' }
    )

    expect(result.success).toBe(true)
    expect(result.metadata).toEqual({ provider: 'MockProvider', model: 'runtime-model' })
    expect(chatMock).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ role: 'user' })]), [], {
      model: 'runtime-model'
    })
  })

  it('falls back to the configured provider and default model', async () => {
    const result = await skills.executeSkill('code-review', { code: 'const a = 1' })
    expect(result.metadata).toEqual({ provider: 'MockProvider', model: 'mock-default' })
  })

  it('returns an error for unknown skills', async () => {
    const result = await skills.executeSkill('missing-skill', {})
    expect(result.success).toBe(false)
    expect(result.error).toContain('不存在')
  })

  it('executes file-ops with the injected path guard', async () => {
    const write = await skills.executeSkill('file-ops', {
      action: 'write',
      path: 'note.txt',
      content: 'hello'
    })
    expect(write.success).toBe(true)

    const read = await skills.executeSkill('file-ops', { action: 'read', path: 'note.txt' })
    expect(read.success).toBe(true)
    expect(read.content).toBe('hello')

    const escape = await skills.executeSkill('file-ops', { action: 'read', path: '../secret.txt' })
    expect(escape.success).toBe(false)
    expect(escape.error).toContain('允许范围')
  })

  it('scopes file-ops to the runtime workspace', async () => {
    const workspace = path.join(testUserData, 'workspace')
    fs.mkdirSync(workspace, { recursive: true })

    const write = await skills.executeSkill(
      'file-ops',
      { action: 'write', path: 'nested/inner.txt', content: 'workspace', create_dirs: true },
      { workspacePath: workspace }
    )
    expect(write.success).toBe(true)
    expect(write.metadata.path).toBe(path.join('nested', 'inner.txt'))
    expect(fs.readFileSync(path.join(workspace, 'nested', 'inner.txt'), 'utf8')).toBe('workspace')

    const outside = await skills.executeSkill(
      'file-ops',
      { action: 'read', path: '../note.txt' },
      { workspacePath: workspace }
    )
    expect(outside.success).toBe(false)
    expect(outside.error).toContain('允许范围')
  })
})
