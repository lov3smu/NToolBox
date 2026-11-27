import fs from 'fs'
import path from 'path'
import { t } from '../i18n.js'
import { netFetch } from '../network.js'
import { getDataDir } from '../../utils/path'
import { writeFileAtomic } from '../../utils/atomicFile'
import toolboxHandler from '../../skills/builtin/toolbox/handler.js'
import { isSandboxHostAllowed, SANDBOX_HTTP_PREVIEW, SANDBOX_STORAGE_MAX_BYTES } from '../../../shared/pluginSandbox.js'

const HTTP_MAX_BYTES = 2 * 1024 * 1024

function getStorageDirectory() {
  return path.join(getDataDir(), 'plugin-storage')
}

function getStoragePath(pluginName) {
  return path.join(getStorageDirectory(), `${pluginName}.json`)
}

async function readStorage(pluginName) {
  try {
    const content = await fs.promises.readFile(getStoragePath(pluginName), 'utf8')
    const parsed = JSON.parse(content)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function runToolboxAction(action, text) {
  const params = { ...action.params }
  if (action.input === 'clipboard') {
    if (!text.trim()) {
      return { success: false, error: t('剪贴板中没有可用的文本') }
    }
    params.text = text
  }
  const result = toolboxHandler(params)
  return result.success ? { success: true, output: result.content } : result
}

async function runHttpAction(action) {
  const params = action.params
  if (!isSandboxHostAllowed(new URL(params.url).hostname, params.hosts)) {
    return { success: false, error: t('沙箱动作的主机不在允许范围内') }
  }

  let response
  try {
    response = await netFetch(params.url, {
      method: params.method,
      headers: { 'user-agent': 'NToolBox', ...params.headers },
      body: params.method === 'POST' ? params.body : undefined,
      redirect: 'follow',
      signal: globalThis.AbortSignal.timeout(params.timeoutMs)
    })
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError'
    return { success: false, error: timedOut ? t('沙箱请求超时') : t('沙箱请求失败：{p0}', { p0: error.message }) }
  }

  let finalHost
  try {
    finalHost = new URL(response.url).hostname
  } catch {
    return { success: false, error: t('沙箱请求返回了无效地址') }
  }
  if (!isSandboxHostAllowed(finalHost, params.hosts)) {
    return { success: false, error: t('沙箱请求被重定向到未授权的主机') }
  }

  const declared = Number(response.headers.get('content-length')) || 0
  if (declared > HTTP_MAX_BYTES) {
    return { success: false, error: t('沙箱请求的响应超过大小限制') }
  }
  const body = await response.text()
  if (Buffer.byteLength(body) > HTTP_MAX_BYTES) {
    return { success: false, error: t('沙箱请求的响应超过大小限制') }
  }
  const preview = body.length > SANDBOX_HTTP_PREVIEW ? `${body.slice(0, SANDBOX_HTTP_PREVIEW)}\n…[内容已截断]` : body
  return { success: true, output: `HTTP ${response.status} ${response.statusText}\n\n${preview}` }
}

async function runStorageAction(pluginName, action) {
  const { key, mode, value, delta } = action.params
  const store = await readStorage(pluginName)

  if (mode === 'get') {
    return { success: true, output: JSON.stringify(store[key] ?? null) }
  }
  if (mode === 'set') {
    store[key] = value
  } else {
    const current = typeof store[key] === 'number' && Number.isFinite(store[key]) ? store[key] : 0
    store[key] = current + (delta ?? 1)
  }

  const serialized = JSON.stringify(store)
  if (Buffer.byteLength(serialized) > SANDBOX_STORAGE_MAX_BYTES) {
    return { success: false, error: t('插件本地数据超过大小限制') }
  }
  await fs.promises.mkdir(getStorageDirectory(), { recursive: true, mode: 0o700 })
  await writeFileAtomic(getStoragePath(pluginName), serialized, 'utf8')
  return { success: true, output: JSON.stringify(store[key] ?? null) }
}

export async function executeSandboxAction(pluginName, action, { text = '' } = {}) {
  if (!action || !action.op) {
    return { success: false, error: t('沙箱动作无效') }
  }
  if (action.op === 'toolbox') return runToolboxAction(action, text)
  if (action.op === 'http') return runHttpAction(action)
  if (action.op === 'storage') return runStorageAction(pluginName, action)
  return { success: false, error: t('不支持的沙箱动作类型') }
}

export async function clearPluginSandboxStorage(pluginName) {
  await fs.promises.rm(getStoragePath(pluginName), { force: true }).catch(() => {})
}
