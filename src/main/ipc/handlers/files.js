import { clipboard, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { log } from '../../utils'
import { t } from '../../services/i18n.js'
import { getConfig } from '../../services/config.js'
import { isPathWithinBase } from '../../utils/sanitize'
import { grantFilePath, isFilePathGranted } from '../../utils/fileAccess'
import { getMainWindow, getSettingsWindow } from '../../windows'
import { IPC_CHANNELS } from '../../../shared/ipc'
import { SEND_MAX_TEXT } from '../../../shared/sendTo'

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

export function registerFileHandlers(handle) {
  handle(IPC_CHANNELS.readDirectory, async (_event, dirPath, options = {}) => {
    try {
      const config = getConfig()
      const basePath = config.sql_generator.base_path

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
          const isDirectory = entry.isDirectory()
          const item = {
            name: entry.name,
            path: fullPath,
            created: stat.birthtimeMs || stat.mtimeMs,
            modified: stat.mtimeMs,
            isDirectory,
            size: isDirectory ? null : stat.size
          }

          if (isDirectory) {
            if (options.withDirectorySize) {
              item.size = (await getDirectoryStats(fullPath)).size
            }
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

  handle(IPC_CHANNELS.searchDirectory, async (_event, rootPath, keyword, options = {}) => {
    try {
      const config = getConfig()
      const basePath = config.sql_generator.base_path

      if (!rootPath || typeof rootPath !== 'string') {
        return { success: false, error: '路径无效' }
      }

      if (basePath && !isPathWithinBase(rootPath, basePath)) {
        log.warn('拒绝搜索 base_path 外的目录:', rootPath)
        return { success: false, error: '无权访问该目录' }
      }

      const term = typeof keyword === 'string' ? keyword.trim().toLowerCase() : ''
      if (!term) {
        return { success: true, items: [], truncated: false }
      }

      const limit = 500
      const maxDepth = 12
      const maxVisited = 20000
      const items = []
      let visited = 0
      let truncated = false

      const walk = async (dirPath, depth) => {
        let entries
        try {
          entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
        } catch (e) {
          log.warn('搜索时无法读取目录:', dirPath, e.message)
          return
        }

        for (const entry of entries) {
          if (items.length >= limit || visited >= maxVisited) {
            truncated = true
            return
          }
          visited++

          const fullPath = path.join(dirPath, entry.name)
          const isDirectory = entry.isDirectory()

          if (entry.name.toLowerCase().includes(term)) {
            try {
              const stat = await fs.promises.stat(fullPath)
              const item = {
                name: entry.name,
                path: fullPath,
                relativePath: path.relative(rootPath, fullPath),
                created: stat.birthtimeMs || stat.mtimeMs,
                modified: stat.mtimeMs,
                isDirectory,
                size: isDirectory ? null : stat.size
              }
              if (isDirectory && options.withDirectorySize) {
                item.size = (await getDirectoryStats(fullPath)).size
              }
              items.push(item)
            } catch (e) {
              log.warn('搜索时无法读取文件信息:', fullPath, e.message)
            }
          }

          if (isDirectory && depth < maxDepth) {
            await walk(fullPath, depth + 1)
          }
        }
      }

      await walk(rootPath, 0)

      return { success: true, items, truncated }
    } catch (e) {
      log.error('搜索目录失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.copyToClipboard, async (_event, itemPath, recursive = false) => {
    try {
      const config = getConfig()
      const basePath = config.sql_generator.base_path

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

  handle(IPC_CHANNELS.copyRichText, async (_event, html, text) => {
    try {
      if (typeof html !== 'string' || !html.trim()) return false
      if (html.length > 8 * 1024 * 1024) return false
      const plain = typeof text === 'string' ? text : ''
      clipboard.write({ html, text: plain })
      return true
    } catch (e) {
      log.error('复制富文本失败:', e)
      return false
    }
  })

  handle(IPC_CHANNELS.getItemInfo, async (_event, itemPath) => {
    try {
      const config = getConfig()
      const basePath = config.sql_generator.base_path

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

  handle(IPC_CHANNELS.readTextDocument, async (_event, filePath) => {
    try {
      const config = getConfig()
      const basePath = config.sql_generator.base_path

      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: '路径无效' }
      }

      if (basePath && !isPathWithinBase(filePath, basePath)) {
        log.warn('拒绝读取 base_path 外的文件:', filePath)
        return { success: false, error: '无权访问' }
      }

      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile()) {
        return { success: false, error: '不是文件' }
      }
      if (stat.size > SEND_MAX_TEXT) {
        return { success: false, error: '文件过大，无法发送' }
      }

      const content = await fs.promises.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (e) {
      log.error('读取文件失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.selectSqlFile, async () => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showOpenDialog(parentWindow, {
      title: t('选择SQL文件'),
      filters: [{ name: t('SQL文件'), extensions: ['sql'] }],
      properties: ['openFile']
    })
    if (!result.canceled) {
      for (const filePath of result.filePaths || []) grantFilePath(filePath)
    }
    return result
  })

  handle(IPC_CHANNELS.readFile, async (_event, filePath) => {
    if (!isFilePathGranted(filePath)) {
      log.warn('拒绝读取未授权文件:', filePath)
      return { success: false, error: '文件路径未授权，请通过文件选择对话框重新选择' }
    }
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (e) {
      log.error('读取文件失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.saveSqlFile, async (_event, defaultPath) => {
    const mainWindow = getMainWindow()
    const settingsWindow = getSettingsWindow()
    const parentWindow = settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : mainWindow
    const result = await dialog.showSaveDialog(parentWindow, {
      title: t('保存SQL转储文件'),
      defaultPath: defaultPath || 'dump.sql',
      filters: [{ name: t('SQL文件'), extensions: ['sql'] }]
    })
    if (!result.canceled && result.filePath) grantFilePath(result.filePath)
    return result
  })

  handle(IPC_CHANNELS.writeFile, async (_event, filePath, content) => {
    if (!isFilePathGranted(filePath)) {
      log.warn('拒绝写入未授权文件:', filePath)
      return { success: false, error: '文件路径未授权，请通过保存对话框重新选择' }
    }
    try {
      await fs.promises.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (e) {
      log.error('写入文件失败:', e)
      return { success: false, error: e.message }
    }
  })
}
