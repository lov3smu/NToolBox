import { ipcMain, dialog, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'
import { log, getProjectRoot } from '../utils'
import { getConfig, saveConfig, loadConfig, generateSQLFile, openFile, openFolder, setAutoStart, getAutoStart, checkForUpdates } from '../services'
import { isPathWithinBase } from '../utils/sanitize'
import { getMainWindow, getSettingsWindow, createSettingsWindow } from '../windows'
import { createAppMenu } from '../ui'

import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const packageJson = require(path.join(getProjectRoot(), 'package.json'))

export function setupIPCHandlers() {
  ipcMain.handle('get-config', async () => getConfig())

  ipcMain.handle('get-package-info', async () => ({
    version: packageJson.version,
    author: packageJson.author,
    name: packageJson.name,
    description: packageJson.description,
  }))

  ipcMain.handle('save-config', async (_event, newConfig) => {
    const success = await saveConfig(newConfig)
    if (success) {
      const mainWindow = getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('config-changed')
      }
    }
    return success
  })

  ipcMain.handle('generate-script', async (_event, scriptInfo) => await generateSQLFile(scriptInfo))

  ipcMain.handle('open-file', async (_event, filePath) => {
    if (!filePath || typeof filePath !== 'string') return false
    const config = getConfig()
    if (config.base_path && !isPathWithinBase(filePath, config.base_path)) {
      log.warn('拒绝打开 base_path 外的文件:', filePath)
      return false
    }
    return await openFile(filePath, config.text_edit_app)
  })

  ipcMain.handle('open-folder', async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== 'string') return false
    const config = getConfig()
    if (config.base_path && !isPathWithinBase(folderPath, config.base_path)) {
      log.warn('拒绝打开 base_path 外的文件夹:', folderPath)
      return false
    }
    return await openFolder(folderPath)
  })

  ipcMain.handle('select-directory', async () => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, { properties: ['openDirectory'] })
    return result.filePaths[0] || ''
  })

  ipcMain.handle('select-file', async () => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, {
      properties: ['openFile'],
      filters: [
        { name: '可执行文件', extensions: ['exe'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    return result.filePaths[0] || ''
  })

  ipcMain.handle('reload-config', async () => await loadConfig())

  ipcMain.handle('set-auto-start', async (_event, enable) => await setAutoStart(enable))
  ipcMain.handle('get-auto-start', async () => await getAutoStart())

  ipcMain.handle('check-for-updates', async (_event, manual) => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    return await checkForUpdates(manual, parentWindow)
  })

  ipcMain.handle('open-settings', async () => {
    createSettingsWindow()
    return true
  })

  ipcMain.handle('close-settings-window', async () => {
    const win = getSettingsWindow()
    if (win && !win.isDestroyed()) {
      win.close()
    }
  })

  ipcMain.handle('reload-menu', async () => {
    const mainWindow = getMainWindow()
    if (mainWindow) {
      createAppMenu(mainWindow, checkForUpdates, createSettingsWindow)
      return true
    }
    return false
  })

  ipcMain.handle('read-directory', async (_event, dirPath) => {
    try {
      const config = getConfig()
      const basePath = config.base_path
      
      if (!dirPath || typeof dirPath !== 'string') {
        return { success: false, error: '路径无效' }
      }
      
      if (basePath && !isPathWithinBase(dirPath, basePath)) {
        log.warn('拒绝读取 base_path 外的目录:', dirPath)
        return { success: false, error: '无权访问该目录' }
      }
      
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const directories = []
      const files = []
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stat = await fs.promises.stat(fullPath)
          const item = {
            name: entry.name,
            path: fullPath,
            created: stat.birthtimeMs || stat.mtimeMs,
            modified: stat.mtimeMs,
            isDirectory: entry.isDirectory()
          }
          
          if (entry.isDirectory()) {
            directories.push(item)
          } else {
            files.push(item)
          }
        } catch (e) {
          log.warn('无法读取文件信息:', fullPath, e.message)
        }
      }
      
      return { success: true, directories, files }
    } catch (e) {
      log.error('读取目录失败:', e)
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('copy-to-clipboard', async (_event, itemPath, recursive = false) => {
    try {
      const config = getConfig()
      const basePath = config.base_path
      
      if (!itemPath || typeof itemPath !== 'string') {
        return false
      }
      
      if (basePath && !isPathWithinBase(itemPath, basePath)) {
        log.warn('拒绝访问 base_path 外的路径:', itemPath)
        return false
      }
      
      let filePaths = []
      
      const stat = await fs.promises.stat(itemPath)
      
      if (stat.isDirectory()) {
        filePaths = await collectFiles(itemPath, recursive)
      } else {
        filePaths = [itemPath]
      }
      
      const text = filePaths.join('\n')
      clipboard.writeText(text)
      return true
    } catch (e) {
      log.error('复制失败:', e)
      return false
    }
  })

  ipcMain.handle('get-item-info', async (_event, itemPath) => {
    try {
      const config = getConfig()
      const basePath = config.base_path
      
      if (!itemPath || typeof itemPath !== 'string') {
        return { success: false, error: '路径无效' }
      }
      
      if (basePath && !isPathWithinBase(itemPath, basePath)) {
        log.warn('拒绝访问 base_path 外的路径:', itemPath)
        return { success: false, error: '无权访问' }
      }
      
      const stat = await fs.promises.stat(itemPath)
      const isDirectory = stat.isDirectory()
      
      const info = {
        name: path.basename(itemPath),
        type: isDirectory ? '文件夹' : '文件',
        location: itemPath,
        created: stat.birthtimeMs || stat.ctimeMs,
        modified: stat.mtimeMs,
        accessed: stat.atimeMs
      }
      
      if (isDirectory) {
        const stats = await getDirectoryStats(itemPath)
        info.size = stats.size
        info.sizeOnDisk = stats.size
        info.directoryCount = stats.directoryCount
        info.fileCount = stats.fileCount
      } else {
        info.size = stat.size
        info.sizeOnDisk = stat.size
      }
      
      return { success: true, info }
    } catch (e) {
      log.error('获取信息失败:', e)
      return { success: false, error: e.message }
    }
  })
}

async function collectFiles(dirPath, recursive) {
  const files = []
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory() && recursive) {
      const subFiles = await collectFiles(fullPath, recursive)
      files.push(...subFiles)
    } else if (entry.isFile()) {
      files.push(fullPath)
    }
  }
  
  return files
}

async function getDirectoryStats(dirPath) {
  let size = 0
  let directoryCount = 0
  let fileCount = 0
  
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      try {
        if (entry.isDirectory()) {
          directoryCount++
          const subStats = await getDirectoryStats(fullPath)
          size += subStats.size
          directoryCount += subStats.directoryCount
          fileCount += subStats.fileCount
        } else {
          fileCount++
          const fileStat = await fs.promises.stat(fullPath)
          size += fileStat.size
        }
      } catch (e) {
        log.warn('无法读取:', fullPath, e.message)
      }
    }
  } catch (e) {
    log.warn('无法读取目录:', dirPath, e.message)
  }
  
  return { size, directoryCount, fileCount }
}