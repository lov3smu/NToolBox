import { app, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'

export function getInstallDir() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

export function getProjectRoot() {
  return path.join(__dirname, '..', '..')
}

export function getAssetsDir() {
  return app.isPackaged ? path.join(process.resourcesPath, 'assets') : path.join(getProjectRoot(), 'assets')
}

// nativeImage 不支持 .icns；Windows 优先多尺寸 .ico，macOS/Linux 使用 .png
const ICON_CANDIDATES = {
  win32: ['icon.ico', 'icon.png'],
  darwin: ['icon.png'],
  linux: ['icon.png', 'icon.ico']
}

export function getIconPath() {
  const assetsDir = getAssetsDir()
  const candidates = ICON_CANDIDATES[process.platform] || ICON_CANDIDATES.linux
  for (const name of candidates) {
    const iconPath = path.join(assetsDir, name)
    if (fs.existsSync(iconPath)) return iconPath
  }
  return null
}

// Linux 的 _NET_WM_ICON 在图标过大（实测 >=256）时为空，需缩到 128 才能被窗口管理器采用；
// Windows 使用多尺寸 .ico，macOS 窗口图标由 app bundle 决定，传入也会被忽略
const LINUX_WINDOW_ICON_SIZE = 128

export function getWindowIcon() {
  if (process.platform === 'darwin') return undefined
  const iconPath = getIconPath()
  if (!iconPath || process.platform !== 'linux') return iconPath

  const icon = nativeImage.createFromPath(iconPath)
  if (icon.isEmpty()) return iconPath
  return icon.resize({ width: LINUX_WINDOW_ICON_SIZE, height: LINUX_WINDOW_ICON_SIZE, quality: 'best' })
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
