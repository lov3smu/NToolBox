import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { resolveAppPaths } from '../src/main/utils/appPaths.js'

const home = '/home/tester'

describe('应用目录解析', () => {
  it('Linux 默认使用 XDG 约定', () => {
    const paths = resolveAppPaths({ platform: 'linux', env: {}, home })
    expect(paths.configDir).toBe(path.join(home, '.config', 'ntoolbox'))
    expect(paths.dataDir).toBe(path.join(home, '.local', 'share', 'ntoolbox'))
    expect(paths.cacheDir).toBe(path.join(home, '.cache', 'ntoolbox'))
    expect(paths.logsDir).toBe(path.join(home, '.local', 'state', 'ntoolbox', 'logs'))
    expect(paths.chromiumDir).toBe(path.join(home, '.cache', 'ntoolbox', 'chromium'))
  })

  it('Linux 优先使用 XDG 环境变量', () => {
    const paths = resolveAppPaths({
      platform: 'linux',
      env: {
        XDG_CONFIG_HOME: '/xdg/config',
        XDG_DATA_HOME: '/xdg/data',
        XDG_CACHE_HOME: '/xdg/cache',
        XDG_STATE_HOME: '/xdg/state'
      },
      home
    })
    expect(paths.configDir).toBe('/xdg/config/ntoolbox')
    expect(paths.dataDir).toBe('/xdg/data/ntoolbox')
    expect(paths.cacheDir).toBe('/xdg/cache/ntoolbox')
    expect(paths.logsDir).toBe('/xdg/state/ntoolbox/logs')
  })

  it('忽略非绝对路径的 XDG 变量', () => {
    const paths = resolveAppPaths({ platform: 'linux', env: { XDG_DATA_HOME: 'relative/dir' }, home })
    expect(paths.dataDir).toBe(path.join(home, '.local', 'share', 'ntoolbox'))
  })

  it('Windows 配置走 Roaming、数据走 Local', () => {
    const paths = resolveAppPaths({
      platform: 'win32',
      env: { APPDATA: '/win/roaming', LOCALAPPDATA: '/win/local' },
      home
    })
    expect(paths.configDir).toBe(path.join('/win/roaming', 'ntoolbox'))
    expect(paths.dataDir).toBe(path.join('/win/local', 'ntoolbox'))
    expect(paths.cacheDir).toBe(path.join('/win/local', 'ntoolbox', 'cache'))
    expect(paths.logsDir).toBe(path.join('/win/local', 'ntoolbox', 'logs'))
    expect(paths.chromiumDir).toBe(path.join('/win/local', 'ntoolbox', 'cache', 'chromium'))
  })

  it('macOS 使用 Application Support / Caches / Logs', () => {
    const paths = resolveAppPaths({ platform: 'darwin', env: {}, home })
    expect(paths.configDir).toBe(path.join(home, 'Library', 'Application Support', 'ntoolbox'))
    expect(paths.dataDir).toBe(paths.configDir)
    expect(paths.cacheDir).toBe(path.join(home, 'Library', 'Caches', 'ntoolbox'))
    expect(paths.logsDir).toBe(path.join(home, 'Library', 'Logs', 'ntoolbox'))
  })
})
