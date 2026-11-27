import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'
import { log } from '../../utils'
import { isPathWithinBase } from '../../utils/sanitize'
import { recordToolResult } from '../sqlite/artifactRepository.js'

const MAX_RESULT_CHARS = 24000
const MIN_PREVIEW_CHARS = 1200
const MAX_RUN_CHARS = 160000
const READ_DEFAULT_CHARS = 4000
const READ_MAX_CHARS = 8000
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const RESULT_ID_PATTERN = /^[A-Za-z0-9_-]{1,180}$/

let cleanedUp = false

function resultsRoot() {
  return path.join(app.getPath('userData'), 'agent', 'results')
}

function normalizeId(value, fallback) {
  const safe = String(value || '')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 60)
  return safe || fallback
}

function safeStringify(value) {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

async function cleanupOldResults(retentionMs = RETENTION_MS) {
  if (cleanedUp) return
  cleanedUp = true
  try {
    const root = resultsRoot()
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
    const now = Date.now()
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.txt')) continue
      const file = path.join(root, entry.name)
      const stat = await fs.promises.stat(file).catch(() => null)
      if (stat && now - stat.mtimeMs > retentionMs) {
        await fs.promises.rm(file, { force: true })
      }
    }
  } catch (error) {
    log.warn('清理历史工具结果失败:', error.message)
  }
}

function resultFilePath(resultId) {
  if (!RESULT_ID_PATTERN.test(String(resultId || ''))) return ''
  const root = resultsRoot()
  const file = path.join(root, `${resultId}.txt`)
  return isPathWithinBase(file, root) ? file : ''
}

export function createToolResultStore(runId, options = {}) {
  const runKey = normalizeId(runId, `run-${Date.now()}`)
  const maxResultChars = Math.max(1024, Number(options.maxResultChars) || MAX_RESULT_CHARS)
  const maxRunChars = Math.max(maxResultChars, Number(options.maxRunChars) || MAX_RUN_CHARS)
  const retentionMs = Math.max(60 * 60 * 1000, Number(options.retentionMs) || RETENTION_MS)
  let usedChars = 0
  let counter = 0
  let initialized = false

  async function ensureRoot() {
    if (initialized) return
    await fs.promises.mkdir(resultsRoot(), { recursive: true })
    initialized = true
  }

  async function save(text, callId, meta = {}) {
    await ensureRoot()
    counter += 1
    const resultId = `${runKey}__${normalizeId(callId, 'call')}__${counter}`
    const file = resultFilePath(resultId)
    await fs.promises.writeFile(file, text, 'utf8')
    void recordToolResult({
      id: resultId,
      requestId: runKey,
      conversationId: meta.conversationId,
      tool: meta.tool,
      bytes: Buffer.byteLength(text, 'utf8'),
      truncated: true,
      filePath: file,
      createdAt: Date.now()
    }).catch((error) => log.warn('写入工具结果索引失败:', error.message))
    return resultId
  }

  async function budgetOne(toolResult, callId, meta = {}) {
    const text = safeStringify(toolResult)
    const originalChars = text.length
    const remaining = Math.max(0, maxRunChars - usedChars)

    if (originalChars <= maxResultChars && originalChars <= remaining) {
      usedChars += originalChars
      return { content: text, truncated: false, originalChars, resultId: '' }
    }

    const previewChars = Math.max(MIN_PREVIEW_CHARS, Math.min(maxResultChars, remaining))
    let resultId = ''
    try {
      if (!cleanedUp) await cleanupOldResults(retentionMs)
      resultId = await save(text, callId, meta)
    } catch (error) {
      log.warn('保存完整工具结果失败:', error.message)
    }

    const marker = resultId
      ? `已保存完整结果，可用 result-read 工具分页读取：{"result_id":"${resultId}"}`
      : '完整结果保存失败，仅保留截断内容'
    const markerReserve = 160
    let headChars = Math.max(0, Math.floor((previewChars - markerReserve) * 0.6))
    let tailChars = Math.max(0, previewChars - markerReserve - headChars)

    const wrapper = {
      truncated: true,
      resultId: resultId || undefined,
      originalChars,
      note: `工具结果超过上下文预算（${originalChars} 字符），已截断。${marker}`
    }
    if (toolResult && typeof toolResult === 'object' && !Array.isArray(toolResult)) {
      wrapper.success = toolResult.success !== false
      if (toolResult.success === false && toolResult.error) wrapper.error = String(toolResult.error)
      if (toolResult.metadata) wrapper.metadata = toolResult.metadata
    }

    // JSON 转义会放大内容，按实际序列化长度回退裁剪
    let content = ''
    for (let attempt = 0; attempt < 6; attempt += 1) {
      wrapper.head = text.slice(0, headChars)
      wrapper.tail = tailChars > 0 ? text.slice(-tailChars) : ''
      content = safeStringify(wrapper)
      if (content.length <= previewChars) break
      const overflow = content.length - previewChars
      if (tailChars > 0) tailChars = Math.max(0, tailChars - Math.ceil(overflow / 2) - 20)
      headChars = Math.max(0, headChars - Math.ceil(overflow / 2) - 20)
    }
    usedChars += content.length
    return { content, truncated: true, originalChars, resultId }
  }

  let queue = Promise.resolve()

  function budget(toolResult, callId, meta = {}) {
    const next = queue.then(() => budgetOne(toolResult, callId, meta))
    queue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  return { budget }
}

export async function readToolResult(resultId, options = {}) {
  const file = resultFilePath(resultId)
  if (!file) {
    return { success: false, error: 'result_id 格式无效' }
  }

  let text
  try {
    text = await fs.promises.readFile(file, 'utf8')
  } catch {
    return { success: false, error: '工具结果不存在或已过期' }
  }

  const totalChars = text.length
  const offset = Math.max(0, Math.min(totalChars, Math.floor(Number(options.offset) || 0)))
  const limitInput = Math.floor(Number(options.limit) || READ_DEFAULT_CHARS)
  const limit = Math.max(1, Math.min(READ_MAX_CHARS, limitInput))
  const end = Math.min(totalChars, offset + limit)

  return {
    success: true,
    result_id: String(resultId),
    offset,
    limit,
    total_chars: totalChars,
    content: text.slice(offset, end),
    has_more: end < totalChars,
    next_offset: end < totalChars ? end : null
  }
}
