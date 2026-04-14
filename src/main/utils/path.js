import { app } from 'electron'
import path from 'path'
import fs from 'fs'

export function getInstallDir() {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()
}

export function getProjectRoot() {
  return path.join(__dirname, '..', '..')
}

export function getIconPath() {
  let iconPath = null
  if (app.isPackaged) {
    const resourcesDir = process.resourcesPath
    const possiblePaths = [
      path.join(resourcesDir, 'assets', 'icon.ico'),
      path.join(resourcesDir, 'assets', 'icon.png'),
    ]
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) { iconPath = p; break }
    }
  } else {
    const projectRoot = getProjectRoot()
    const devIco = path.join(projectRoot, 'assets', 'icon.ico')
    const devPng = path.join(projectRoot, 'assets', 'icon.png')
    if (fs.existsSync(devIco)) iconPath = devIco
    else if (fs.existsSync(devPng)) iconPath = devPng
  }
  return iconPath
}

export function getLogDir() {
  return path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : getProjectRoot(), 'logs')
}

export const installDir = getInstallDir()
export const configPath = path.join(installDir, 'config.json')