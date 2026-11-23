import path from 'node:path'
import fs from 'node:fs'
import { t } from './i18n.js'
import { app } from 'electron'
import { log } from '../utils'

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const MAX_STEPS = 40
const MAX_CONTENT_PREVIEW = 2000
const LIST_LIMIT = 30

let cleanedUp = false

function tracesRoot() {
  return path.join(app.getPath('userData'), 'agent-runs')
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
    return { id, file }
  }

  persist()
  return { id, addStep, addReflection, setPlan, setGoal, finish }
}

async function readTraceRows() {
  await cleanupOldTraces()
  const root = tracesRoot()
  const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => [])
  const rows = []

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const data = await fs.promises
      .readFile(path.join(root, entry.name), 'utf8')
      .then((raw) => JSON.parse(raw))
      .catch(() => null)
    if (!data || typeof data !== 'object') continue
    rows.push({
      id: data.id || entry.name.replace(/\.json$/, ''),
      startedAt: Number(data.startedAt) || 0,
      endedAt: Number(data.endedAt) || null,
      durationMs: Number(data.durationMs) || 0,
      status: data.status || 'ended',
      termination: data.termination || '',
      goal: data.plan?.goal || data.goal || data.summary?.goal || '',
      workspace: data.meta?.workspacePath || '',
      conversationId: data.meta?.conversationId || '',
      error: data.error || '',
      provider: data.meta?.provider || '',
      model: data.meta?.model || '',
      toolCalls: Array.isArray(data.steps) ? data.steps.length : 0
    })
  }

  return rows
}

export async function listRunTraces(limit = LIST_LIMIT, conversationId = '') {
  const rows = await readTraceRows()
  const scoped = conversationId ? rows.filter((row) => row.conversationId === conversationId) : rows
  scoped.sort((a, b) => b.startedAt - a.startedAt)
  const max = Math.max(1, Math.min(LIST_LIMIT, Math.floor(Number(limit) || LIST_LIMIT)))
  return scoped.slice(0, max)
}

export async function countRunTracesByWorkspace() {
  const rows = await readTraceRows()
  const byWorkspace = {}
  for (const row of rows) {
    if (!row.workspace) continue
    byWorkspace[row.workspace] = (byWorkspace[row.workspace] || 0) + 1
  }
  return { total: rows.length, byWorkspace }
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
