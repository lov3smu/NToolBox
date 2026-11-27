import { dialog, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { log } from '../../utils'
import { t } from '../../services/i18n.js'
import { isPathWithinBase } from '../../utils/sanitize'
import { IPC_CHANNELS } from '../../../shared/ipc'
import { netFetch } from '../../services/network.js'
import { getDialogParentWindow } from './common'

const MAX_IMAGE_FILE_SIZE = 100 * 1024 * 1024
const MAX_DOWNLOAD_IMAGE_SIZE = 50 * 1024 * 1024
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif']
const IMAGE_MIME = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  avif: 'image/avif'
}

function getImageMime(filePath) {
  if (typeof filePath !== 'string') return ''
  return IMAGE_MIME[path.extname(filePath).toLowerCase().slice(1)] || ''
}

function decodeImageDataUrl(dataUrl) {
  const match = /^data:([^;,]*)((?:;[^,]*)*?),(.*)$/s.exec(dataUrl)
  if (!match) return null
  const mime = match[1] || 'application/octet-stream'
  const base64 = /;base64/i.test(match[2] || '')
  try {
    const buffer = base64 ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8')
    return { mime, buffer }
  } catch {
    return null
  }
}

function pickImageExtension(name, mime) {
  const ext = path
    .extname(path.basename(String(name || '').replace(/\\/g, '/')))
    .toLowerCase()
    .slice(1)
  if (IMAGE_EXTENSIONS.includes(ext)) return ext === 'jpeg' ? 'jpg' : ext
  const byMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/x-icon': 'ico',
    'image/avif': 'avif'
  }
  return byMime[mime] || 'png'
}

function buildImageDownloadName(name, mime) {
  const ext = pickImageExtension(name, mime)
  const base = path
    .basename(String(name || '').replace(/\\/g, '/'))
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
  if (!base) return `image.${ext}`
  return path.extname(base) ? base : `${base}.${ext}`
}

export function registerImageViewerHandlers(handle) {
  // 图片浏览器的目录授权：只允许访问用户通过对话框选择或拖入的目录
  const imageRoots = new Set()

  const grantImageRoot = (dirPath) => {
    imageRoots.add(path.resolve(dirPath))
    while (imageRoots.size > 24) {
      imageRoots.delete(imageRoots.values().next().value)
    }
  }

  const canAccessImagePath = (targetPath) =>
    typeof targetPath === 'string' && [...imageRoots].some((root) => isPathWithinBase(targetPath, root))

  const imageDialogFilters = [
    { name: t('图片文件'), extensions: IMAGE_EXTENSIONS },
    { name: t('所有文件'), extensions: ['*'] }
  ]

  handle(IPC_CHANNELS.imageOpenDialog, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('打开图片'),
      properties: ['openFile'],
      filters: imageDialogFilters
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const filePath = result.filePaths[0]
    if (!getImageMime(filePath)) return { canceled: false, error: '不支持的图片格式' }

    grantImageRoot(path.dirname(filePath))
    return { canceled: false, filePath, dir: path.dirname(filePath) }
  })

  handle(IPC_CHANNELS.imageOpenFolder, async () => {
    const result = await dialog.showOpenDialog(getDialogParentWindow(), {
      title: t('打开图片文件夹'),
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }

    const folderPath = result.filePaths[0]
    grantImageRoot(folderPath)
    return { canceled: false, folderPath, dir: folderPath }
  })

  handle(IPC_CHANNELS.imageListDir, async (_event, dirPath) => {
    try {
      if (!canAccessImagePath(dirPath)) return { success: false, error: '无权访问该文件夹' }

      const stat = await fs.promises.stat(dirPath)
      if (!stat.isDirectory()) return { success: false, error: '不是有效的文件夹' }

      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
      const files = []
      for (const entry of entries) {
        if (!getImageMime(entry.name)) continue
        const fullPath = path.join(dirPath, entry.name)
        try {
          const fileStat = await fs.promises.stat(fullPath)
          if (!fileStat.isFile()) continue
          files.push({ name: entry.name, path: fullPath, size: fileStat.size, modified: fileStat.mtimeMs })
        } catch {
          // 忽略无法访问的条目
        }
      }

      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
      return { success: true, dir: path.resolve(dirPath), files }
    } catch (e) {
      log.error('读取图片目录失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.imageRead, async (_event, filePath) => {
    try {
      const mime = getImageMime(filePath)
      if (!mime || !canAccessImagePath(filePath)) return { success: false, error: '无权访问该图片' }

      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile()) return { success: false, error: '不是有效的图片文件' }
      if (stat.size > MAX_IMAGE_FILE_SIZE) return { success: false, error: '图片超过 100MB，暂不支持' }

      const data = await fs.promises.readFile(filePath)
      return { success: true, data, mime, size: stat.size, modified: stat.mtimeMs }
    } catch (e) {
      log.error('读取图片失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.imageThumbnail, async (_event, filePath) => {
    try {
      if (!getImageMime(filePath) || !canAccessImagePath(filePath)) return { success: false }

      const image = nativeImage.createFromPath(filePath)
      if (image.isEmpty()) return { success: false }

      const size = image.getSize()
      if (!size.width || !size.height) return { success: false }

      const scale = Math.min(240 / size.width, 180 / size.height, 1)
      const resized =
        scale < 1
          ? image.resize({
              width: Math.max(1, Math.round(size.width * scale)),
              height: Math.max(1, Math.round(size.height * scale)),
              quality: 'good'
            })
          : image

      return { success: true, dataUrl: resized.toDataURL() }
    } catch {
      return { success: false }
    }
  })

  handle(IPC_CHANNELS.imageDownload, async (_event, payload) => {
    const src = typeof payload?.src === 'string' ? payload.src : ''
    const name = typeof payload?.name === 'string' ? payload.name : ''
    if (!src) return { success: false, error: '缺少图片数据' }

    try {
      let buffer = null
      let mime = ''
      if (/^data:/i.test(src)) {
        const decoded = decodeImageDataUrl(src)
        if (!decoded) return { success: false, error: '图片数据无效' }
        buffer = decoded.buffer
        mime = decoded.mime
      } else if (/^https?:\/\//i.test(src)) {
        const res = await netFetch(src)
        if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
        buffer = Buffer.from(await res.arrayBuffer())
        mime = String(res.headers.get('content-type') || '')
          .split(';')[0]
          .trim()
      } else {
        return { success: false, error: '不支持的图片地址' }
      }

      if (!buffer || !buffer.length) return { success: false, error: '图片内容为空' }
      if (buffer.length > MAX_DOWNLOAD_IMAGE_SIZE) return { success: false, error: '图片过大，暂不支持下载' }

      const result = await dialog.showSaveDialog(getDialogParentWindow(), {
        title: t('保存图片'),
        defaultPath: buildImageDownloadName(name, mime),
        filters: [{ name: t('图片文件'), extensions: IMAGE_EXTENSIONS }]
      })
      if (result.canceled || !result.filePath) return { canceled: true, success: false }

      await fs.promises.writeFile(result.filePath, buffer)
      return { success: true, path: result.filePath }
    } catch (e) {
      log.error('保存图片失败:', e)
      return { success: false, error: e.message }
    }
  })

  handle(IPC_CHANNELS.imageAcceptDropped, async (_event, paths) => {
    if (!Array.isArray(paths) || !paths.length) return { success: false, error: '没有可打开的文件' }

    for (const candidate of paths) {
      if (typeof candidate !== 'string' || !candidate) continue
      try {
        const stat = await fs.promises.stat(candidate)
        if (stat.isDirectory()) {
          grantImageRoot(candidate)
          return { success: true, dir: candidate }
        }
        if (stat.isFile() && getImageMime(candidate)) {
          grantImageRoot(path.dirname(candidate))
          return { success: true, filePath: candidate, dir: path.dirname(candidate) }
        }
      } catch {
        // 跳过不存在或不可访问的路径
      }
    }

    return { success: false, error: '未找到可打开的图片或文件夹' }
  })
}
