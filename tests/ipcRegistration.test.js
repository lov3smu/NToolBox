import { describe, it, expect, vi } from 'vitest'
import { IPC_CHANNELS } from '../src/shared/ipc.js'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn()
  },
  clipboard: { writeText: vi.fn(), write: vi.fn() },
  shell: { openExternal: vi.fn() }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  getProjectRoot: () => process.cwd()
}))

vi.mock('../src/main/utils/sanitize.js', () => ({
  isPathWithinBase: vi.fn(async () => true)
}))

vi.mock('../src/main/services/index.js', () => ({
  getConfig: vi.fn(() => ({ base_path: '/tmp/scripts' })),
  saveConfig: vi.fn(async () => true),
  loadConfig: vi.fn(async () => ({})),
  generateSQLFile: vi.fn(async () => ({})),
  openFile: vi.fn(),
  openFolder: vi.fn(),
  setAutoStart: vi.fn(),
  getAutoStart: vi.fn(),
  checkForUpdates: vi.fn()
}))

vi.mock('../src/main/services/chat.js', () => ({
  chat: vi.fn(async () => ({ success: true })),
  chatStream: vi.fn(async () => ({ success: true })),
  validateApiKey: vi.fn(),
  getAvailableProviders: vi.fn(() => []),
  getProviderModels: vi.fn(() => [])
}))

vi.mock('../src/main/services/skills.js', () => ({
  initSkills: vi.fn(),
  getSkills: vi.fn(() => []),
  getSkill: vi.fn(),
  executeSkill: vi.fn(),
  installSkill: vi.fn(),
  uninstallSkill: vi.fn(),
  getSkillToolDefinitions: vi.fn(() => []),
  getMarketSkills: vi.fn(async () => []),
  installMarketSkill: vi.fn(),
  getUserSkillsDirectory: vi.fn(() => '/tmp/skills')
}))

vi.mock('../src/main/services/database.js', () => ({
  testConnection: vi.fn(),
  createConnection: vi.fn(),
  closeConnection: vi.fn(),
  closeAllConnections: vi.fn(),
  executeQuery: vi.fn(),
  queryDatabases: vi.fn(),
  queryTables: vi.fn(),
  getTableStructure: vi.fn(),
  getActiveConnections: vi.fn(() => []),
  isConnectionActive: vi.fn(() => false),
  beginTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  rollbackTransaction: vi.fn(),
  queryObjects: vi.fn(),
  getObjectDefinition: vi.fn(),
  queryUsers: vi.fn()
}))

vi.mock('../src/main/windows/index.js', () => ({
  getMainWindow: vi.fn(() => null),
  getSettingsWindow: vi.fn(() => null),
  createSettingsWindow: vi.fn()
}))

vi.mock('../src/main/ui/index.js', () => ({
  createAppMenu: vi.fn()
}))

import { ipcMain, BrowserWindow } from 'electron'
import { setupIPCHandlers } from '../src/main/ipc/index.js'
import { getMainWindow, getSettingsWindow } from '../src/main/windows/index.js'
import { getConfig } from '../src/main/services/index.js'
import { chat } from '../src/main/services/chat.js'

function getHandler(channel) {
  const entry = ipcMain.handle.mock.calls.find(([registered]) => registered === channel)
  expect(entry, channel).toBeTruthy()
  return entry[1]
}

describe('IPC startup smoke test', () => {
  setupIPCHandlers()

  it('registers exactly the channels declared in the contract', () => {
    const registered = ipcMain.handle.mock.calls.map(([channel]) => channel)
    expect(new Set(registered)).toEqual(new Set(Object.values(IPC_CHANNELS)))
  })

  it('wraps successful responses in the unified envelope', async () => {
    getConfig.mockReturnValueOnce({ base_path: '/tmp/custom' })
    const result = await getHandler(IPC_CHANNELS.getConfig)({})
    expect(result).toEqual({ __ipc: true, ok: true, data: { base_path: '/tmp/custom' } })
  })

  it('converts thrown errors into a logged failure envelope', async () => {
    chat.mockRejectedValueOnce(new Error('provider unavailable'))
    const result = await getHandler(IPC_CHANNELS.chat)({}, [{ role: 'user', content: 'hi' }], {})
    expect(result).toEqual({ __ipc: true, ok: false, error: 'provider unavailable' })
  })

  it('routes window controls to the sender window', async () => {
    const win = {
      isDestroyed: () => false,
      isMaximized: vi.fn(() => false),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      minimize: vi.fn(),
      close: vi.fn()
    }
    BrowserWindow.fromWebContents.mockReturnValue(win)
    const event = { sender: {} }

    const minimize = await getHandler(IPC_CHANNELS.windowMinimize)(event)
    expect(minimize).toEqual({ __ipc: true, ok: true, data: true })
    expect(win.minimize).toHaveBeenCalled()

    const maximize = await getHandler(IPC_CHANNELS.windowToggleMaximize)(event)
    expect(maximize).toEqual({ __ipc: true, ok: true, data: false })
    expect(win.maximize).toHaveBeenCalled()

    win.isMaximized.mockReturnValue(true)
    await getHandler(IPC_CHANNELS.windowToggleMaximize)(event)
    expect(win.unmaximize).toHaveBeenCalled()

    const isMaximized = await getHandler(IPC_CHANNELS.windowIsMaximized)(event)
    expect(isMaximized).toEqual({ __ipc: true, ok: true, data: true })

    const close = await getHandler(IPC_CHANNELS.windowClose)(event)
    expect(close).toEqual({ __ipc: true, ok: true, data: true })
    expect(win.close).toHaveBeenCalled()
  })

  it('returns to the main window and closes the settings window', async () => {
    const mainWindow = {
      isDestroyed: () => false,
      isMinimized: () => true,
      restore: vi.fn(),
      isVisible: () => false,
      show: vi.fn(),
      focus: vi.fn()
    }
    const settingsWindow = { isDestroyed: () => false, close: vi.fn() }
    getMainWindow.mockReturnValue(mainWindow)
    getSettingsWindow.mockReturnValue(settingsWindow)

    const result = await getHandler(IPC_CHANNELS.returnToApp)({})
    expect(result).toEqual({ __ipc: true, ok: true, data: true })
    expect(mainWindow.restore).toHaveBeenCalled()
    expect(mainWindow.show).toHaveBeenCalled()
    expect(mainWindow.focus).toHaveBeenCalled()
    expect(settingsWindow.close).toHaveBeenCalled()
  })
})
