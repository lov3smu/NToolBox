import path from 'node:path'
import fs from 'node:fs'
import { t } from './i18n.js'
import { app } from 'electron'
import { log } from '../utils'
import {
  listRunTraces as listRunTracesPage,
  pruneRunTraces,
  runTraceStats,
  upsertRunTrace,
  upsertRunTraces
} from './sqlite/runTraceRepository.js'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_STEPS = 40
const MAX_CONTENT_PREVIEW = 2000
const LIST_LIMIT = 30

let cleanedUp = false
let filesIndexed = false

function tracesRoot() {
  return path.join(app.getPath('userData'), 'agent', 'runs')
}

function normalizeRunId(runId) {
  const safe = String(runId || '')
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .slice(0, 80)
  return safe
}

function traceFile(runId) {
  const id = normalizeRunId(runId)
  return id ? path.join(tracesRoot(), `${id}.json`) : ''
}

function indexRow(trace, file) {
  return {
    id: trace.id,
    startedAt: Number(trace.startedAt) || 0,
    endedAt: Number(trace.endedAt) || null,
    durationMs: Number(trace.durationMs) || 0,
    status: trace.status || 'running',
    termination: trace.termination || '',
    goal: trace.plan?.goal || trace.goal || trace.summary?.goal || '',
    workspace: trace.meta?.workspacePath || '',
    conversationId: trace.meta?.conversationId || '',
    provider: trace.meta?.provider || '',
    model: trace.meta?.model || '',
    toolCalls: Array.isArray(trace.steps) ? trace.steps.length : 0,
    error: trace.error || '',
    filePath: file
  }
}

function persistIndex(trace, file) {
  void upsertRunTrace(indexRow(trace, file)).catch((error) => {
    log.warn('写入运行轨迹索引失败:', error.message)
  })
}

async function cleanupOldTraces() {
  if (cleanedUp) return
  cleanedUp = true
  try {
    const root = tracesRoot()
    const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
    const now = Date.now()
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const file = path.join(root, entry.name)
      const stat = await fs.promises.stat(file).catch(() => null)
      if (stat && now - stat.mtimeMs > RETENTION_MS) {
        await fs.promises.rm(file, { force: true })
      }
    }
    await pruneRunTraces(now - RETENTION_MS).catch(() => {})
  } catch (error) {
    log.warn('清理历史运行轨迹失败:', error.message)
  }
}

export function createRunTrace(runId, meta = {}) {
  const id = normalizeRunId(runId) || `run-${Date.now()}`
  const file = path.join(tracesRoot(), `${id}.json`)
  const trace = {
    id,
    startedAt: Date.now(),
    endedAt: null,
    status: 'running',
    termination: null,
    goal: '',
    meta: {
      provider: String(meta.provider || ''),
      model: String(meta.model || ''),
      workspacePath: String(meta.workspacePath || ''),
      conversationId: String(meta.conversationId || ''),
      approvalPolicy: String(meta.approvalPolicy || ''),
      toolsEnabled: meta.toolsEnabled !== false
    },
    plan: null,
    steps: [],
    reflections: [],
    summary: null,
    usage: null,
    error: null,
    contentPreview: ''
  }

  let queue = Promise.resolve()
  let finished = false

  function persist() {
    const snapshot = JSON.stringify(trace, null, 2)
    queue = queue
      .then(async () => {
        await fs.promises.mkdir(tracesRoot(), { recursive: true })
        await fs.promises.writeFile(file, snapshot, 'utf8')
      })
      .catch((error) => log.warn('写入运行轨迹失败:', error.message))
    return queue
  }

  function addStep(step) {
    if (finished) return
    if (trace.steps.length >= MAX_STEPS) return
    trace.steps.push({ index: trace.steps.length + 1, at: Date.now(), ...step })
    persist()
  }

  function addReflection(entry) {
    if (finished || !entry) return
    trace.reflections.push({ at: Date.now(), ...entry })
    persist()
  }

  function setPlan(plan) {
    if (finished) return
    trace.plan = plan || null
    persist()
    persistIndex(trace, file)
  }

  function setGoal(goal) {
    if (finished || trace.goal) return
    const text = String(goal || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160)
    if (!text) return
    trace.goal = text
    persist()
    persistIndex(trace, file)
  }

  async function finish(payload = {}) {
    if (finished) return { id, file }
    finished = true
    trace.endedAt = Date.now()
    trace.durationMs = trace.endedAt - trace.startedAt
    trace.status = payload.status || 'ended'
    trace.termination = payload.termination || null
    trace.summary = payload.summary || null
    trace.usage = payload.usage || null
    trace.error = payload.error || null
    trace.contentPreview = String(payload.content || '').slice(0, MAX_CONTENT_PREVIEW)
    await persist()
    await upsertRunTrace(indexRow(trace, file)).catch((error) => {
      log.warn('写入运行轨迹索引失败:', error.message)
    })
    return { id, file }
  }

  persist()
  persistIndex(trace, file)
  return { id, addStep, addReflection, setPlan, setGoal, finish }
}

async function ensureIndexed() {
  if (filesIndexed) return
  filesIndexed = true
  await cleanupOldTraces()
  const root = tracesRoot()
  const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
  const rows = []
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const file = path.join(root, entry.name)
    const data = await fs.promises
      .readFile(file, 'utf8')
      .then((raw) => JSON.parse(raw))
      .catch(() => null)
    if (!data || typeof data !== 'object') continue
    rows.push(indexRow({ id: entry.name.replace(/\.json$/, ''), ...data }, file))
  }
  if (rows.length) await upsertRunTraces(rows)
  await pruneRunTraces(Date.now() - RETENTION_MS)
}

export async function listRunTraces(options = {}) {
  const normalized = typeof options === 'number' ? { limit: options } : options || {}
  await ensureIndexed()
  const page = await listRunTracesPage({
    limit: normalized.limit || LIST_LIMIT,
    offset: normalized.offset || 0,
    keyword: normalized.keyword || '',
    status: normalized.status && normalized.status !== 'all' ? normalized.status : '',
    conversationId: normalized.conversationId || '',
    since: Date.now() - RETENTION_MS
  })
  return page
}

export async function countRunTracesByWorkspace() {
  await ensureIndexed()
  return runTraceStats({ since: Date.now() - RETENTION_MS })
}

export async function readRunTrace(runId) {
  const file = traceFile(runId)
  if (!file) return { success: false, error: t('运行标识无效') }
  try {
    const trace = JSON.parse(await fs.promises.readFile(file, 'utf8'))
    return { success: true, trace }
  } catch {
    return { success: false, error: t('运行轨迹不存在或已过期（保留 7 天）') }
  }
}

export async function writeRunTraceFile(runId, targetPath) {
  const result = await readRunTrace(runId)
  if (!result.success) return result
  try {
    await fs.promises.writeFile(targetPath, JSON.stringify(result.trace, null, 2), 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
