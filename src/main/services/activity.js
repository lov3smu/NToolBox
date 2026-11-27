import { log } from '../utils'
import { getConfig } from './config.js'
import { getStorage } from './sqlite/index.js'
import {
  ACTIVITY_MAX_LIMIT,
  normalizeActivityKinds,
  normalizeActivityLimit,
  sortActivityItems
} from '../../shared/activity.js'

const BACKUP_KIND = 'backup_done'
const BACKUP_DEDUPE_WINDOW_MS = 90 * 1000

function parsePayload(raw) {
  try {
    return JSON.parse(raw || '{}') || {}
  } catch {
    return {}
  }
}

function queryItems(rows, since) {
  return rows
    .map((row) => {
      const payload = parsePayload(row.payload)
      return {
        kind: 'query',
        id: row.id,
        ts: Number(row.created_at) || 0,
        sql: typeof payload.sql === 'string' ? payload.sql : '',
        connectionName: typeof payload.connectionName === 'string' ? payload.connectionName : '',
        database: typeof payload.database === 'string' ? payload.database : '',
        duration: Number(payload.duration) || 0,
        success: payload.success !== false
      }
    })
    .filter((item) => item.ts >= since)
}

function uploadItems(rows, since) {
  return rows
    .map((row) => ({
      kind: 'upload',
      id: row.id,
      ts: Number(row.uploaded_at) || 0,
      name: row.name || '',
      url: row.url || '',
      providerName: row.provider_name || '',
      size: Number(row.size) || 0
    }))
    .filter((item) => item.ts >= since)
}

function runItems(rows, since) {
  return rows
    .map((row) => ({
      kind: 'ai_run',
      id: row.id,
      ts: Number(row.started_at) || 0,
      goal: row.goal || '',
      status: row.status || '',
      termination: row.termination || '',
      durationMs: Number(row.duration_ms) || 0,
      toolCalls: Number(row.tool_calls) || 0,
      model: row.model || '',
      error: row.error || ''
    }))
    .filter((item) => item.ts >= since)
}

function snapshotItems(rows, since) {
  return rows
    .map((row) => ({
      kind: 'file_change',
      id: row.request_id,
      ts: Number(row.created_at) || 0,
      requestId: row.request_id || '',
      conversationId: row.conversation_id || '',
      fileCount: Number(row.file_count) || 0,
      directory: row.directory || ''
    }))
    .filter((item) => item.ts >= since)
}

function backupNotificationItems(rows, since) {
  return rows
    .map((row) => ({
      kind: 'backup',
      id: row.id,
      ts: Number(row.created_at) || 0,
      title: row.title || '',
      body: row.body || '',
      level: row.level || 'info'
    }))
    .filter((item) => item.ts >= since)
}

function backupTaskItems(since, existing) {
  const tasks = getConfig()?.database?.backup_tasks
  if (!Array.isArray(tasks)) return []
  const stamps = existing.map((item) => item.ts)
  return tasks
    .filter((task) => task && task.id && task.lastRunAt)
    .map((task) => ({
      kind: 'backup',
      id: `backup-task:${task.id}`,
      ts: Number(task.lastRunAt) || 0,
      title: task.name || '',
      body: task.lastStatus === 'error' ? task.lastError || '' : task.lastFile || '',
      level: task.lastStatus === 'error' ? 'error' : 'info'
    }))
    .filter((item) => item.ts >= since)
    .filter((item) => !stamps.some((stamp) => Math.abs(stamp - item.ts) <= BACKUP_DEDUPE_WINDOW_MS))
}

export async function listActivityTimeline(options = {}) {
  const size = normalizeActivityLimit(options.limit)
  const start = Math.max(0, Math.floor(Number(options.offset)) || 0)
  const since = Math.max(0, Number(options.since) || 0)
  const kinds = normalizeActivityKinds(options.kinds)
  const fetchLimit = Math.min(ACTIVITY_MAX_LIMIT * 2, start + size + 1)

  let db
  try {
    db = await getStorage()
  } catch (error) {
    log.warn('活动时间线不可用:', error?.message)
    return { items: [], hasMore: false }
  }

  const tasks = []
  if (kinds.includes('query')) {
    tasks.push(
      db
        .all(
          'SELECT id, payload, created_at FROM db_query_history WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?',
          [since, fetchLimit]
        )
        .then((rows) => queryItems(rows, since))
    )
  }
  if (kinds.includes('upload')) {
    tasks.push(
      db
        .all('SELECT * FROM image_uploads WHERE uploaded_at >= ? ORDER BY uploaded_at DESC LIMIT ?', [
          since,
          fetchLimit
        ])
        .then((rows) => uploadItems(rows, since))
    )
  }
  if (kinds.includes('ai_run')) {
    tasks.push(
      db
        .all('SELECT * FROM run_traces WHERE started_at >= ? ORDER BY started_at DESC LIMIT ?', [since, fetchLimit])
        .then((rows) => runItems(rows, since))
    )
  }
  if (kinds.includes('file_change')) {
    tasks.push(
      db
        .all(
          `SELECT request_id, conversation_id, file_count, directory, created_at FROM tool_snapshots
            WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?`,
          [since, fetchLimit]
        )
        .then((rows) => snapshotItems(rows, since))
    )
  }
  if (kinds.includes('backup')) {
    tasks.push(
      db
        .all(
          `SELECT id, kind, level, title, body, created_at FROM notifications
            WHERE kind = ? AND created_at >= ? ORDER BY created_at DESC LIMIT ?`,
          [BACKUP_KIND, since, fetchLimit]
        )
        .then((rows) => backupNotificationItems(rows, since))
    )
  }

  const merged = (await Promise.all(tasks)).flat()
  const backupNotifications = merged.filter((item) => item.kind === 'backup')
  if (kinds.includes('backup')) {
    merged.push(...backupTaskItems(since, backupNotifications))
  }

  const ordered = sortActivityItems(merged)
  return {
    items: ordered.slice(start, start + size),
    hasMore: ordered.length > start + size
  }
}
