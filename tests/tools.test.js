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
  MAX_RECENT
} from '../src/shared/tools.js'

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
      expect(['file', 'primary', 'utilities', 'settings', 'extensions']).toContain(tool.menuGroup)
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
    expect(dashboardTools).toHaveLength(tools.length - 1 - extensionTools.length)
    expect(dashboardTools.some((tool) => tool.path === '/')).toBe(false)
    expect(dashboardTools.some((tool) => tool.path === '/market')).toBe(false)
    expect(dashboardTools.some((tool) => tool.path === SETTINGS_PATH)).toBe(true)
  })

  it('derives menu, tray and lookup collections from the registry', () => {
    expect(getToolByPath('/chat')?.name).toBe('AI助手')
    expect(getToolsByMenuGroup('primary').every((tool) => tool.menuGroup === 'primary')).toBe(true)
    expect(getTrayTopTools().every((tool) => tool.trayGroup === 'top')).toBe(true)
    expect(getTrayTools().every((tool) => tool.trayGroup === 'tools')).toBe(true)
    expect(getToolsByMenuGroup('extensions').map((tool) => tool.path)).toEqual(['/market'])
    expect(searchTools('JSON').map((tool) => tool.path)).toContain('/json-parser')
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
    delete globalThis.localStorage
  })

  it('never records the dashboard', () => {
    addToRecent(getToolByPath('/'))
    expect(store.has(RECENT_TOOLS_KEY)).toBe(false)
    expect(getRecentTools()).toEqual([])
  })

  it('drops legacy dashboard entries', () => {
    store.set(RECENT_TOOLS_KEY, JSON.stringify(['/', '/chat']))
    expect(getRecentTools().map((tool) => tool.path)).toEqual(['/chat'])
  })

  it('records unique tools in most-recent order', () => {
    addToRecent(getToolByPath('/chat'))
    addToRecent(getToolByPath('/password'))
    addToRecent(getToolByPath('/chat'))

    expect(getRecentTools().map((tool) => tool.path)).toEqual(['/chat', '/password'])

    addToRecent(getToolByPath('/cron'))
    addToRecent(getToolByPath('/yaml-editor'))
    expect(getRecentTools()).toHaveLength(MAX_RECENT)
    expect(getRecentTools().map((tool) => tool.path)).toEqual(
      ['/yaml-editor', '/cron', '/chat', '/password'].slice(0, MAX_RECENT)
    )
  })
})
