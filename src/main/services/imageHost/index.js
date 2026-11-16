import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getConfig, saveConfig } from '../config.js'
import { log } from '../../utils/index.js'
import {
  IMAGE_HOST_HISTORY_LIMIT,
  getImageHostMaxFileSize,
  getMissingRequiredFields,
  getProviderMeta,
  normalizeImageHostConfig,
  normalizeImageHostSettings,
  normalizeProviderSettings
} from '../../../shared/imageHosts.js'
import { getImageMime } from './utils.js'
import { testProvider, uploadToProvider } from './providers.js'
import { restoreMaskedImageHostSettings } from '../../../shared/secrets.js'
import { notify } from '../notifications.js'

const MAX_BATCH_SIZE = 20
const MAX_CONCURRENCY = 3

let historyQueue = Promise.resolve()

function currentConfig() {
  return normalizeImageHostConfig(getConfig()?.image_hosting)
}

export function getImageHostState() {
  const config = currentConfig()
  return {
    settings: normalizeImageHostSettings(config),
    history: config.history
  }
}

export async function saveImageHostSettings(input) {
  const current = currentConfig()
  const settings = normalizeImageHostSettings(restoreMaskedImageHostSettings(input, current))
  const next = { ...settings, history: current.history }
  const saved = await saveConfig({ image_hosting: next })
  if (!saved) throw new Error('保存图床配置失败')

  const state = getImageHostState()
  return { success: true, settings: state.settings, history: state.history }
}

function enqueueHistoryUpdate(mutator) {
  const task = historyQueue.then(async () => {
    const config = currentConfig()
    const history = mutator(config.history).slice(0, config.historyLimit)
    const saved = await saveConfig({
      image_hosting: { ...normalizeImageHostSettings(config), history }
    })
    if (!saved) throw new Error('保存上传记录失败')
    return history
  })
  historyQueue = task.catch(() => {})
  return task
}

function resolveUploadContext() {
  const { settings, history } = getImageHostState()
  const meta = getProviderMeta(settings.active)
  if (!meta) throw new Error('当前图床类型无效，请重新选择')

  const providerSettings = settings.providers[settings.active]
  const missing = getMissingRequiredFields(settings.active, providerSettings)
  if (missing.length) {
    throw new Error(`请先完善 ${meta.name} 配置：${missing.map((field) => field.label).join('、')}`)
  }

  return {
    settings,
    history,
    meta,
    providerSettings: { ...providerSettings, rename: settings.rename }
  }
}

async function prepareFile(filePath, maxBytes) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('无效的图片路径')

  const resolvedPath = path.resolve(filePath)
  const mime = getImageMime(resolvedPath)
  if (!mime) throw new Error('不支持的图片格式')

  const stat = await fs.promises.stat(resolvedPath)
  if (!stat.isFile()) throw new Error('不是有效的图片文件')
  if (stat.size <= 0) throw new Error('图片内容为空')
  if (stat.size > maxBytes) throw new Error(`图片超过 ${Math.round(maxBytes / 1024 / 1024)}MB，暂不支持上传`)

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

async function commitHistory(records, fallbackHistory, historyLimit = IMAGE_HOST_HISTORY_LIMIT) {
  if (!records.length) return fallbackHistory
  try {
    return await enqueueHistoryUpdate((history) => [...records, ...history])
  } catch (error) {
    log.error('保存图床上传记录失败:', error)
    return [...records, ...fallbackHistory].slice(0, historyLimit)
  }
}

export async function uploadImagePaths(paths) {
  const candidates = Array.isArray(paths)
    ? [...new Set(paths.filter((item) => typeof item === 'string' && item.trim()))].slice(0, MAX_BATCH_SIZE)
    : []
  if (!candidates.length) return { success: false, results: [], error: '未选择图片', history: currentConfig().history }

  let context
  try {
    context = resolveUploadContext()
  } catch (error) {
    return { success: false, results: [], error: error.message, history: currentConfig().history }
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
          error: error?.message || '上传失败'
        },
        record: null
      }
    }
  })

  const results = uploads.map((entry) => entry.result)
  const records = uploads.map((entry) => entry.record).filter(Boolean)
  const history = await commitHistory(records, context.history, context.settings.historyLimit)
  const successCount = records.length
  const failedCount = results.length - successCount

  if (results.length > 0) {
    void notify('upload_done', {
      title: failedCount > 0 ? '图床上传部分失败' : '图床上传完成',
      body: failedCount > 0 ? `${successCount} 张成功，${failedCount} 张失败` : `${successCount} 张图片已上传`
    })
  }

  return {
    success: successCount > 0,
    results,
    history,
    error: successCount > 0 ? '' : results[0]?.error || '上传失败'
  }
}

export async function uploadImageBuffer({ buffer, name, mime }) {
  const data = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || [])
  if (!data.length) {
    return { success: false, results: [], error: '剪贴板中没有图片', history: currentConfig().history }
  }
  const maxBytes = getImageHostMaxFileSize(currentConfig())
  if (data.length > maxBytes) {
    return {
      success: false,
      results: [],
      error: `图片超过 ${Math.round(maxBytes / 1024 / 1024)}MB，暂不支持上传`,
      history: currentConfig().history
    }
  }

  const fileName = path.basename(name || 'clipboard.png')
  const fileMime = mime || getImageMime(fileName)
  if (!fileMime || !String(fileMime).startsWith('image/')) {
    return { success: false, results: [], error: '不支持的图片格式', history: currentConfig().history }
  }

  let context
  try {
    context = resolveUploadContext()
  } catch (error) {
    return { success: false, results: [], error: error.message, history: currentConfig().history }
  }

  try {
    const file = { filePath: fileName, name: fileName, mime: fileMime, size: data.length, buffer: data }
    const { result, record } = await uploadPreparedFile(file, context)
    const history = await commitHistory([record], context.history, context.settings.historyLimit)
    void notify('upload_done', { title: '图床上传完成', body: '图片已上传到图床' })
    return { success: true, results: [result], history, error: '' }
  } catch (error) {
    return {
      success: false,
      results: [{ success: false, name: fileName, error: error?.message || '上传失败' }],
      history: context.history,
      error: error?.message || '上传失败'
    }
  }
}

export async function testImageHostProvider(providerId, rawSettings) {
  const meta = getProviderMeta(providerId)
  if (!meta) return { success: false, message: '不支持的图床类型' }

  const settings = normalizeProviderSettings(
    providerId,
    restoreMaskedImageHostSettings({ providers: { [providerId]: rawSettings } }, currentConfig()).providers[providerId]
  )
  const missing = getMissingRequiredFields(providerId, settings)
  if (missing.length) {
    return { success: false, message: `请先填写：${missing.map((field) => field.label).join('、')}` }
  }

  try {
    return await testProvider({ providerId, settings })
  } catch (error) {
    return { success: false, message: error?.message || '连接测试失败' }
  }
}

export async function clearImageHostHistory() {
  const history = await enqueueHistoryUpdate(() => [])
  return { success: true, history }
}

export async function removeImageHostHistory(id) {
  const history = await enqueueHistoryUpdate((items) => items.filter((item) => item.id !== id))
  return { success: true, history }
}
