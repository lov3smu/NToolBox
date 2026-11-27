import { describe, expect, it } from 'vitest'
import {
  MARKET_PATH,
  SETTINGS_PATH,
  isSplitTool,
  normalizeSplitPath,
  splitTools,
  visibleTools
} from '../src/shared/navTools.js'

describe('split workbench tool registry', () => {
  it('excludes full-window pages from split candidates', () => {
    const paths = splitTools.map((tool) => tool.path)
    expect(paths).not.toContain('/')
    expect(paths).not.toContain(SETTINGS_PATH)
    expect(paths).not.toContain(MARKET_PATH)
    expect(paths).not.toContain('/chat')
    expect(paths).not.toContain('/database')
  })

  it('keeps every other visible tool selectable and hidden tools excluded', () => {
    expect(splitTools.length).toBe(visibleTools.length - 5)
    expect(isSplitTool('/markdown-editor')).toBe(true)
    expect(isSplitTool('/json-parser')).toBe(true)
    expect(isSplitTool('/memory')).toBe(false)
  })

  it('normalizes stored split paths', () => {
    expect(normalizeSplitPath('/yaml-editor')).toBe('/yaml-editor')
    expect(normalizeSplitPath('/chat')).toBe('')
    expect(normalizeSplitPath('/not-a-tool')).toBe('')
    expect(normalizeSplitPath(null)).toBe('')
    expect(normalizeSplitPath(42)).toBe('')
  })
})
