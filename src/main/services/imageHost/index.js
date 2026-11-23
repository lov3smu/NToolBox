import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getConfig, saveConfig } from '../config.js'
import { log } from '../../utils/index.js'
import {
  getImageHostMaxFileSize,
  getMissingRequiredFields,
  getProviderMeta,
  normalizeImageHostHistory,
  normalizeImageHostHistoryLimit,
  normalizeImageHostSettings,
  normalizeProviderSettings
} from '../../../shared/imageHosts.js'
import {
  IMAGE_HISTORY_PAGE_SIZE,
  addImageUploads,
  clearImageUploads,
  importImageUploads,
  listImageUploads,
  pruneImageUploads,
  removeImageUpload
} from '../sqlite/imageRepository.js'
import { getImageMime } from './utils.js'
import { testProvider, uploadToProvider } from './providers.js'
import { restoreMaskedImageHostSettings } from '../../../shared/secrets.js'
import { notify } from '../notifications.js'
import { t, getLocale } from '../i18n.js'

const MAX_BATCH_SIZE = 20
const MAX_CONCURRENCY = 3

let legacyImport = null

function currentSettings() {
  return normalizeImageHostSettings(getConfig()?.image_hosting)
}

async function ensureLegacyHistory() {
  if (!legacyImport) {
    legacyImport = (async () => {
      const raw = getConfig()?.image_hosting
      const legacy = normalizeImageHostHistory(raw?.history, normalizeImageHostHistoryLimit(raw?.historyLimit))
      if (!legacy.length) return
      await importImageUploads(legacy, normalizeImageHostHistoryLimit(raw?.historyLimit))
      await saveConfig({ image_hosting: { ...normalizeImageHostSettings(raw), history: [] } })
    })().catch((error) => {
      legacyImport = null
      throw error
    })
  }
  return legacyImport
}

async function firstHistoryPage() {
  return listImageUploads({ limit: IMAGE_HISTORY_PAGE_SIZE, offset: 0 })
}

export async function getImageHostState(options = {}) {
  const settings = currentSettings()
  await ensureLegacyHistory()
  const page = await listImageUploads({
    limit: options.limit ?? IMAGE_HISTORY_PAGE_SIZE,
    offset: options.offset ?? 0
  })
  return { settings, historyLimit: settings.historyLimit, history: page }
}

export async function saveImageHostSettings(input) {
  const settings = normalizeImageHostSettings(restoreMaskedImageHostSettings(input, currentSettings()))
  const saved = await saveConfig({ image_hosting: settings })
  if (!saved) throw new Error(t('保存图床配置失败'))

  await pruneImageUploads(settings.historyLimit)
  const state = await getImageHostState()
  return { success: true, settings: state.settings, historyLimit: state.historyLimit, history: state.history }
}

function resolveUploadContext() {
  const settings = currentSettings()
  const meta = getProviderMeta(settings.active)
  if (!meta) throw new Error(t('当前图床类型无效，请重新选择'))

  const providerSettings = settings.providers[settings.active]
  const missing = getMissingRequiredFields(settings.active, providerSettings)
  if (missing.length) {
    throw new Error(
      t('请先完善 {name} 配置：{fields}', {
        name: meta.name,
        fields: missing.map((field) => field.label).join(getLocale() === 'en-US' ? ', ' : '、')
      })
    )
  }

  return {
    settings,
    meta,
    providerSettings: { ...providerSettings, rename: settings.rename }
  }
}

async function prepareFile(filePath, maxBytes) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error(t('无效的图片路径'))

  const resolvedPath = path.resolve(filePath)
  const mime = getImageMime(resolvedPath)
  if (!mime) throw new Error(t('不支持的图片格式'))

  const stat = await fs.promises.stat(resolvedPath)
  if (!stat.isFile()) throw new Error(t('不是有效的图片文件'))
  if (stat.size <= 0) throw new Error(t('图片内容为空'))
  if (stat.size > maxBytes) {
    throw new Error(t('图片超过 {size}MB，暂不支持上传', { size: Math.round(maxBytes / 1024 / 1024) }))
  }

  return {
    filePath: resolvedPath,
    name: path.basename(resolvedPath),
    mime,
    size: stat.size,
    buffer: await fs.promises.readFile(resolvedPath)
  }
}

function createHistoryRecord(file, providerId, providerName, url) {
  return {
    id: crypto.randomUUID(),
    name: file.name || path.posix.basename(String(url).split('?')[0]) || 'image',
    url,
    provider: providerId,
    providerName,
    size: file.size,
    uploadedAt: Date.now()
  }
}

async function uploadPreparedFile(file, context) {
  const { meta, providerSettings, settings } = context
  const { url, key } = await uploadToProvider({
    providerId: settings.active,
    settings: providerSettings,
    file
  })

  return {
    result: {
      success: true,
      name: path.posix.basename(key),
      url,
      provider: settings.active,
      providerName: meta.name,
      size: file.size,
      sourcePath: file.filePath
    },
    record: createHistoryRecord({ ...file, name: path.posix.basename(key) }, settings.active, meta.name, url)
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length)
  let nextIndex = 0
  const workerCount = Math.min(limit, items.length)

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index], index)
    }
  })

  await Promise.all(workers)
  return results
}

async function commitHistory(records, historyLimit) {
  if (!records.length) return firstHistoryPage()
  try {
    await addImageUploads(records, historyLimit)
  } catch (error) {
    log.error('保存图床上传记录失败:', error)
  }
  return firstHistoryPage()
}

export async function uploadImagePaths(paths) {
  const candidates = Array.isArray(paths)
    ? [...new Set(paths.filter((item) => typeof item === 'string' && item.trim()))].slice(0, MAX_BATCH_SIZE)
    : []
  if (!candidates.length) {
    await ensureLegacyHistory()
    return { success: false, results: [], error: t('未选择图片'), history: await firstHistoryPage() }
  }

  let context
  try {
    context = resolveUploadContext()
  } catch (error) {
    await ensureLegacyHistory()
    return { success: false, results: [], error: error.message, history: await firstHistoryPage() }
  }

  const uploads = await mapLimit(candidates, MAX_CONCURRENCY, async (filePath) => {
    try {
      const file = await prepareFile(filePath, getImageHostMaxFileSize(context.settings))
      return await uploadPreparedFile(file, context)
    } catch (error) {
      return {
        result: {
          success: false,
          name: path.basename(String(filePath)),
          sourcePath: filePath,
          error: error?.message || t('上传失败')
        },
        record: null
      }
    }
  })

  const results = uploads.map((entry) => entry.result)
  const records = uploads.map((entry) => entry.record).filter(Boolean)
  const history = await commitHistory(records, context.settings.historyLimit)
  const successCount = records.length
  const failedCount = results.length - successCount

  if (results.length > 0) {
    void notify('upload_done', {
      title: failedCount > 0 ? t('图床上传部分失败') : t('图床上传完成'),
      body:
        failedCount > 0
          ? t('{success} 张成功，{failed} 张失败', { success: successCount, failed: failedCount })
          : t('{count} 张图片已上传', { count: successCount })
    })
  }

  return {
    success: successCount > 0,
    results,
    history,
    error: successCount > 0 ? '' : results[0]?.error || t('上传失败')
  }
}

export async function uploadImageBuffer({ buffer, name, mime }) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (!data.length) {
    await ensureLegacyHistory()
    return { success: false, results: [], error: t('剪贴板中没有图片'), history: await firstHistoryPage() }
  }
  const settings = currentSettings()
  const maxBytes = getImageHostMaxFileSize(settings)
  if (data.length > maxBytes) {
    await ensureLegacyHistory()
    return {
      success: false,
      results: [],
      error: t('图片超过 {size}MB，暂不支持上传', { size: Math.round(maxBytes / 1024 / 1024) }),
      history: await firstHistoryPage()
    }
  }

  const fileName = path.basename(name || 'clipboard.png')
  const fileMime = mime || getImageMime(fileName)
  if (!fileMime || !String(fileMime).startsWith('image/')) {
    await ensureLegacyHistory()
    return { success: false, results: [], error: t('不支持的图片格式'), history: await firstHistoryPage() }
  }

  let context
  try {
    context = resolveUploadContext()
  } catch (error) {
    await ensureLegacyHistory()
    return { success: false, results: [], error: error.message, history: await firstHistoryPage() }
  }

  try {
    const file = { filePath: fileName, name: fileName, mime: fileMime, size: data.length, buffer: data }
    const { result, record } = await uploadPreparedFile(file, context)
    const history = await commitHistory([record], context.settings.historyLimit)
    void notify('upload_done', { title: t('上传完成'), body: t('图片已上传到图床') })
    return { success: true, results: [result], history, error: '' }
  } catch (error) {
    return {
      success: false,
      results: [{ success: false, name: fileName, error: error?.message || t('上传失败') }],
      history: await firstHistoryPage(),
      error: error?.message || t('上传失败')
    }
  }
}

export async function testImageHostProvider(providerId, rawSettings) {
  const meta = getProviderMeta(providerId)
  if (!meta) return { success: false, message: t('不支持的图床类型') }

  const settings = normalizeProviderSettings(
    providerId,
    restoreMaskedImageHostSettings(
      { providers: { [providerId]: rawSettings } },
      { providers: currentSettings().providers }
    ).providers[providerId]
  )
  const missing = getMissingRequiredFields(providerId, settings)
  if (missing.length) {
    return {
      success: false,
      message: t('请先填写：{fields}', {
        fields: missing.map((field) => field.label).join(getLocale() === 'en-US' ? ', ' : '、')
      })
    }
  }

  try {
    return await testProvider({ providerId, settings })
  } catch (error) {
    return { success: false, message: error?.message || t('连接测试失败') }
  }
}

export async function clearImageHostHistory() {
  await clearImageUploads()
  return { success: true, history: await firstHistoryPage() }
}

export async function removeImageHostHistory(id) {
  await removeImageUpload(id)
  return { success: true, history: await firstHistoryPage() }
}
