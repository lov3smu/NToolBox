import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export function getInstallDir() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

export function getProjectRoot() {
  return path.join(__dirname, '..', '..')
}

// nativeImage 仅在 Windows 上支持 .ico，其他平台优先使用 .png
export function getIconPath() {
  const assetsDir = app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(getProjectRoot(), 'assets')
  const candidates = process.platform === 'win32' ? ['icon.ico', 'icon.png'] : ['icon.png', 'icon.ico']
  for (const name of candidates) {
    const iconPath = path.join(assetsDir, name)
    if (fs.existsSync(iconPath)) return iconPath
  }
  return null
}

export function getLogDir() {
  if (app.isPackaged) {
    return path.join(getInstallDir(), 'logs')
  } else {
    return path.join(getProjectRoot(), 'logs')
  }
}

export function getConfigPath() {
  if (app.isPackaged) {
    const configDir = path.join(app.getPath('home'), '.config', 'ntoolbox')
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }
    return path.join(configDir, 'config.json')
  } else {
    return path.join(getProjectRoot(), 'config.json')
  }
}

export const installDir = getInstallDir()
