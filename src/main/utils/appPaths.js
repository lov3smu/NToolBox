import os from 'node:os'
import path from 'node:path'

// 目录角色遵循各平台约定：配置/数据/缓存/日志分离，目录名固定为 ntoolbox，
// 不再依赖 app.getName()，避免改名后 userData 漂移导致 .dbkey 失效
const APP_DIR_NAME = 'ntoolbox'

function absoluteEnv(env, name) {
  const value = typeof env?.[name] === 'string' ? env[name].trim() : ''
  return value && path.isAbsolute(value) ? value : ''
}

export function resolveAppPaths({ platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  if (platform === 'win32') {
    const roaming = absoluteEnv(env, 'APPDATA') || path.join(home, 'AppData', 'Roaming')
    const local = absoluteEnv(env, 'LOCALAPPDATA') || path.join(home, 'AppData', 'Local')
    const dataDir = path.join(local, APP_DIR_NAME)
    const cacheDir = path.join(dataDir, 'cache')
    return {
      configDir: path.join(roaming, APP_DIR_NAME),
      dataDir,
      cacheDir,
      logsDir: path.join(dataDir, 'logs'),
      chromiumDir: path.join(cacheDir, 'chromium')
    }
  }

  if (platform === 'darwin') {
    // macOS 惯例：配置与数据同放 Application Support
    const supportDir = path.join(home, 'Library', 'Application Support', APP_DIR_NAME)
    const cacheDir = path.join(home, 'Library', 'Caches', APP_DIR_NAME)
    return {
      configDir: supportDir,
      dataDir: supportDir,
      cacheDir,
      logsDir: path.join(home, 'Library', 'Logs', APP_DIR_NAME),
      chromiumDir: path.join(cacheDir, 'chromium')
    }
  }

  const configRoot = absoluteEnv(env, 'XDG_CONFIG_HOME') || path.join(home, '.config')
  const dataRoot = absoluteEnv(env, 'XDG_DATA_HOME') || path.join(home, '.local', 'share')
  const cacheRoot = absoluteEnv(env, 'XDG_CACHE_HOME') || path.join(home, '.cache')
  const stateRoot = absoluteEnv(env, 'XDG_STATE_HOME') || path.join(home, '.local', 'state')
  return {
    configDir: path.join(configRoot, APP_DIR_NAME),
    dataDir: path.join(dataRoot, APP_DIR_NAME),
    cacheDir: path.join(cacheRoot, APP_DIR_NAME),
    logsDir: path.join(stateRoot, APP_DIR_NAME, 'logs'),
    chromiumDir: path.join(cacheRoot, APP_DIR_NAME, 'chromium')
  }
}

let cached = null

export function getAppPaths() {
  if (!cached) cached = resolveAppPaths()
  return cached
}
