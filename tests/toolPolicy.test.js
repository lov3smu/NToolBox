import { describe, it, expect } from 'vitest'
import { classifyToolRisk, needsApproval } from '../src/main/services/toolPolicy.js'

describe('classifyToolRisk', () => {
  it('classifies file reads as read', () => {
    expect(classifyToolRisk('file-ops', { action: 'read' }).level).toBe('read')
    expect(classifyToolRisk('file-ops', { action: 'search' }).level).toBe('read')
  })

  it('classifies file writes as write', () => {
    const result = classifyToolRisk('file-ops', { action: 'write' })
    expect(result.level).toBe('write')
    expect(result.key).toBe('file-ops:write')
    expect(needsApproval(result.level)).toBe(true)
  })

  it('classifies delete and move as destructive', () => {
    expect(classifyToolRisk('file-ops', { action: 'delete' }).level).toBe('destructive')
    expect(classifyToolRisk('file-ops', { action: 'move' }).level).toBe('destructive')
  })

  it('classifies database and web access as read', () => {
    expect(classifyToolRisk('db-query', { action: 'execute' }).level).toBe('read')
    expect(classifyToolRisk('web-fetch', { url: 'https://example.com' }).level).toBe('read')
  })

  it('classifies memory mutations as write and clear as destructive', () => {
    expect(classifyToolRisk('memory', { action: 'add' }).level).toBe('write')
    expect(classifyToolRisk('memory', { action: 'clear' }).level).toBe('destructive')
  })

  it('asks before unknown tools and known write tools', () => {
    const unknown = classifyToolRisk('market-skill', {})
    expect(unknown.level).toBe('write')
    expect(classifyToolRisk('sql-script', {}).level).toBe('write')
  })

  it('keeps prompt-only skills passive', () => {
    expect(classifyToolRisk('code-generate', {}).level).toBe('read')
    expect(classifyToolRisk('knowledge-search', {}).level).toBe('read')
  })

  it('requires approval for MCP tools', () => {
    const result = classifyToolRisk('mcp__filesystem__write_file', {})
    expect(result.level).toBe('write')
    expect(result.key).toBe('mcp:filesystem:write_file')
    expect(result.summary).toContain('filesystem/write_file')
    expect(needsApproval(result.level)).toBe(true)
  })
})
