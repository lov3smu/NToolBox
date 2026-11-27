import fs from 'fs'
import path from 'path'
import { dialog } from 'electron'
import { log } from '../utils'
import { t } from './i18n.js'
import { getDataDir } from '../utils/path'
import { writeFileAtomic } from '../utils/atomicFile'
import { grantFilePath, isFilePathGranted } from '../utils/fileAccess'
import { MARKDOWN_DOCUMENT_LIMITS, normalizeRecentDocuments } from '../../shared/markdownDocument.js'

const FILE_NAME = 'markdown-recents.json'
const MAX_BYTES = MARKDOWN_DOCUMENT_LIMITS.maxBytes

let recents = null
let loading = null

function recentsPath() {
  return path.join(getDataDir(), FILE_NAME)
}

async function loadRecents() {
  if (recents) return recents
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await fs.promises.readFile(recentsPath(), 'utf8')
        recents = normalizeRecentDocuments(JSON.parse(raw)?.recentDocuments)
      } catch {
        recents = []
      }
      return recents
    })()
  }
  return loading
}

async function persistRecents() {
  try {
    await fs.promises.mkdir(getDataDir(), { recursive: true })
    await writeFileAtomic(recentsPath(), JSON.stringify({ recentDocuments: recents }, null, 2), 'utf8')
  } catch (error) {
    log.warn('保存 Markdown 最近文件失败:', error.message)
  }
}

async function rememberRecent(filePath) {
  const current = await loadRecents()
  const resolved = path.resolve(filePath)
  recents = normalizeRecentDocuments([
    { path: resolved, name: path.basename(resolved), openedAt: Date.now() },
    ...current.filter((item) => item.path !== resolved)
  ])
  await persistRecents()
  return recents
}

async function forgetRecent(filePath) {
  const current = await loadRecents()
  const next = current.filter((item) => item.path !== filePath)
  if (next.length !== current.length) {
    recents = next
    await persistRecents()
  }
  return recents
}

async function canAccessDocument(filePath) {
  if (isFilePathGranted(filePath)) return true
  const current = await loadRecents()
  return current.some((item) => item.path === filePath)
}

function normalizePathInput(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function readDocument(rawPath) {
  if (!rawPath || !path.isAbsolute(rawPath)) {
    return { success: false, error: t('路径无效') }
  }
  const filePath = path.resolve(rawPath)
  if (!(await canAccessDocument(filePath))) {
    return { success: false, error: t('文件路径未授权，请重新选择') }
  }
  try {
    const stat = await fs.promises.stat(filePath)
    if (!stat.isFile()) return { success: false, error: t('不是文件') }
    if (stat.size > MAX_BYTES) {
      return { success: false, error: t('文件超过 {size}MB，无法打开', { size: Math.round(MAX_BYTES / 1024 / 1024) }) }
    }
    const content = await fs.promises.readFile(filePath, 'utf8')
    const list = await rememberRecent(filePath)
    return {
      success: true,
      path: filePath,
      name: path.basename(filePath),
      content,
      mtimeMs: stat.mtimeMs,
      recents: list
    }
  } catch (error) {
    if (error?.code === 'ENOENT') await forgetRecent(filePath)
    log.warn('读取 Markdown 文件失败:', error.message)
    return { success: false, error: t('读取文件失败') }
  }
}

async function writeDocument(rawPath, content) {
  const filePath = path.resolve(rawPath)
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await writeFileAtomic(filePath, content, 'utf8')
    const stat = await fs.promises.stat(filePath)
    const current = await loadRecents()
    const list = current[0]?.path === filePath ? current : await rememberRecent(filePath)
    return { success: true, path: filePath, name: path.basename(filePath), mtimeMs: stat.mtimeMs, recents: list }
  } catch (error) {
    log.error('保存 Markdown 文件失败:', error.message)
    return { success: false, error: t('保存失败') }
  }
}

export async function listMarkdownRecents() {
  return { recents: await loadRecents() }
}

export async function openMarkdownDocument(parentWindow) {
  const result = await dialog.showOpenDialog(parentWindow, {
    title: t('打开 Markdown 文件'),
    properties: ['openFile'],
    filters: [
      { name: t('Markdown 文件'), extensions: ['md', 'markdown', 'mdown', 'txt'] },
      { name: t('所有文件'), extensions: ['*'] }
    ]
  })
  if (result.canceled || !result.filePaths?.length) {
    return { canceled: true, recents: await loadRecents() }
  }
  const filePath = result.filePaths[0]
  grantFilePath(filePath)
  return { canceled: false, ...(await readDocument(filePath)) }
}

export async function readMarkdownDocument(rawPath) {
  return readDocument(normalizePathInput(rawPath))
}

export async function saveMarkdownDocument(payload = {}) {
  const rawPath = normalizePathInput(payload.path)
  if (!rawPath || !path.isAbsolute(rawPath)) {
    return { success: false, error: t('路径无效') }
  }
  if (typeof payload.content !== 'string') {
    return { success: false, error: t('保存失败') }
  }
  const filePath = path.resolve(rawPath)
  if (!(await canAccessDocument(filePath))) {
    return { success: false, error: t('文件路径未授权，请重新选择') }
  }
  return writeDocument(filePath, payload.content)
}

export async function saveMarkdownDocumentAs({ defaultPath, content, parentWindow } = {}) {
  if (typeof content !== 'string') {
    return { success: false, error: t('保存失败') }
  }
  const fallback = typeof defaultPath === 'string' && defaultPath.trim() ? path.resolve(defaultPath.trim()) : ''
  const result = await dialog.showSaveDialog(parentWindow, {
    title: t('保存 Markdown 文件'),
    defaultPath: fallback || 'untitled.md',
    filters: [{ name: t('Markdown 文件'), extensions: ['md'] }]
  })
  if (result.canceled || !result.filePath) return { canceled: true }
  grantFilePath(result.filePath)
  const saved = await writeDocument(result.filePath, content)
  return { canceled: false, ...saved }
}
