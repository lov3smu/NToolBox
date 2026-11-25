import fs from 'fs'
import path from 'path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  tools,
  dashboardTools,
  SETTINGS_PATH,
  getToolByPath,
  getToolsByMenuGroup,
  getTrayTopTools,
  getTrayTools,
  searchTools,
  getToolAccelerator,
  getRecentTools,
  addToRecent,
  RECENT_TOOLS_KEY,
  MAX_RECENT,
  RECENT_TOOLS_LIMIT_OPTIONS,
  normalizeRecentToolsLimit,
  setRecentToolsLimit,
  getRecentToolsLimit
} from '../src/shared/navTools.js'

const ROUTER_FILE = path.join(process.cwd(), 'src/renderer/src/router/index.js')
const routerSource = fs.readFileSync(ROUTER_FILE, 'utf8')
const routerPaths = [...routerSource.matchAll(/path:\s*'([^']+)'/g)].map((match) => match[1])

describe('tool registry', () => {
  it('declares the expected fields for every tool', () => {
    for (const tool of tools) {
      expect(tool.name, JSON.stringify(tool)).toBeTruthy()
      expect(tool.description).toBeTruthy()
      expect(tool.path.startsWith('/')).toBe(true)
      expect(tool.icon).toContain('<svg')
      expect(['file', 'primary', 'dev', 'content', 'system', 'settings', 'extensions']).toContain(tool.menuGroup)
    }
  })

  it('uses unique paths, shortcut keys and accelerators', () => {
    expect(new Set(tools.map((tool) => tool.path)).size).toBe(tools.length)

    const accelerators = tools.filter((tool) => tool.accelerator).map((tool) => tool.accelerator)
    expect(new Set(accelerators).size).toBe(accelerators.length)

    const shortcutKeys = tools.filter((tool) => tool.shortcutKey).map((tool) => tool.shortcutKey)
    expect(new Set(shortcutKeys).size).toBe(shortcutKeys.length)
  })

  it('keeps registry paths aligned with the router', () => {
    expect(new Set(tools.map((tool) => tool.path))).toEqual(new Set(routerPaths))
  })

  it('excludes the dashboard and extension pages from dashboardTools and includes settings', () => {
    const extensionTools = tools.filter((tool) => tool.menuGroup === 'extensions')
    expect(extensionTools.length).toBeGreaterThan(0)
    expect(dashboardTools).toHaveLength(tools.filter((tool) => !tool.hidden).length - 1 - extensionTools.length)
    expect(dashboardTools.some((tool) => tool.path === '/')).toBe(false)
    expect(dashboardTools.some((tool) => tool.path === '/market')).toBe(false)
    expect(dashboardTools.some((tool) => tool.path === SETTINGS_PATH)).toBe(true)
  })

  it('keeps hidden entries out of navigation, dashboard and search', () => {
    const hiddenTools = tools.filter((tool) => tool.hidden)
    expect(hiddenTools.map((tool) => tool.path)).toEqual(['/memory'])
    for (const tool of hiddenTools) {
      expect(dashboardTools.some((item) => item.path === tool.path)).toBe(false)
      expect(getToolsByMenuGroup(tool.menuGroup).some((item) => item.path === tool.path)).toBe(false)
      expect(searchTools(tool.name).some((item) => item.path === tool.path)).toBe(false)
    }
    expect(getToolByPath('/memory')?.name).toBe('外挂知识库')
  })

  it('derives menu, tray and lookup collections from the registry', () => {
    expect(getToolByPath('/chat')?.name).toBe('AI助手')
    expect(getToolsByMenuGroup('primary').every((tool) => tool.menuGroup === 'primary')).toBe(true)
    expect(getTrayTopTools().every((tool) => tool.trayGroup === 'top')).toBe(true)
    expect(getTrayTools().every((tool) => tool.trayGroup === 'tools')).toBe(true)
    expect(getToolsByMenuGroup('extensions').map((tool) => tool.path)).toEqual(['/market'])
    expect(searchTools('JSON').map((tool) => tool.path)).toContain('/json-parser')
    expect(searchTools('json 美化').map((tool) => tool.path)).toContain('/json-parser')
    expect(searchTools('password').map((tool) => tool.path)).toContain('/password-manager')
    expect(searchTools('开发工具').map((tool) => tool.path)).toContain('/regex-tester')
    expect(searchTools('开发工具').map((tool) => tool.path)).not.toContain('/markdown-editor')
    expect(getToolAccelerator(getToolByPath('/chat'))).toBeUndefined()
    expect(getToolAccelerator(getToolByPath('/database'))).toBeUndefined()
    expect(getToolAccelerator({ shortcutKey: 'settings', accelerator: 'CmdOrCtrl+,' }, { settings: 'Alt+S' })).toBe(
      'Alt+S'
    )
    expect(getToolAccelerator({ shortcutKey: 'settings', accelerator: 'CmdOrCtrl+,' }, {})).toBe('CmdOrCtrl+,')
    expect(getToolAccelerator({ shortcutKey: 'settings', accelerator: 'CmdOrCtrl+,' }, { settings: '' })).toBe('')
  })
})

describe('recent tools', () => {
  let store

  beforeEach(() => {
    store = new Map()
    globalThis.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      clear: () => store.clear()
    }
  })

  afterEach(() => {
    setRecentToolsLimit(MAX_RECENT)
    delete globalThis.localStorage
  })

  it('never records the dashboard', () => {
    addToRecent(getToolByPath('/'))
    expect(store.has(RECENT_TOOLS_KEY)).toBe(false)
    expect(getRecentTools()).toEqual([])
  })

  it('never records hidden pages', () => {
    addToRecent(getToolByPath('/memory'))
    expect(store.has(RECENT_TOOLS_KEY)).toBe(false)
    store.set(RECENT_TOOLS_KEY, JSON.stringify(['/memory', '/chat']))
    expect(getRecentTools().map((tool) => tool.path)).toEqual(['/chat'])
  })

  it('drops legacy dashboard entries', () => {
    store.set(RECENT_TOOLS_KEY, JSON.stringify(['/', '/chat']))
    expect(getRecentTools().map((tool) => tool.path)).toEqual(['/chat'])
  })

  it('records unique tools in most-recent order', () => {
    addToRecent(getToolByPath('/chat'))
    addToRecent(getToolByPath('/password-manager'))
    addToRecent(getToolByPath('/chat'))

    expect(getRecentTools().map((tool) => tool.path)).toEqual(['/chat', '/password-manager'])

    addToRecent(getToolByPath('/cron'))
    addToRecent(getToolByPath('/yaml-editor'))
    expect(getRecentTools()).toHaveLength(MAX_RECENT)
    expect(getRecentTools().map((tool) => tool.path)).toEqual(
      ['/yaml-editor', '/cron', '/chat', '/password-manager'].slice(0, MAX_RECENT)
    )
  })

  it('limits the stored recent list to the configured count', () => {
    expect(RECENT_TOOLS_LIMIT_OPTIONS.map((option) => option.value)).toEqual([2, 3, 4, 5, 6, 8])
    expect(normalizeRecentToolsLimit(6)).toBe(6)
    expect(normalizeRecentToolsLimit(1)).toBe(2)
    expect(normalizeRecentToolsLimit(99)).toBe(8)
    expect(normalizeRecentToolsLimit('abc')).toBe(MAX_RECENT)

    setRecentToolsLimit(2)
    expect(getRecentToolsLimit()).toBe(2)
    addToRecent(getToolByPath('/chat'))
    addToRecent(getToolByPath('/password-manager'))
    addToRecent(getToolByPath('/cron'))
    expect(getRecentTools().map((tool) => tool.path)).toEqual(['/cron', '/password-manager'])

    setRecentToolsLimit(6)
    expect(getRecentTools()).toHaveLength(2)
  })
})
