import { getStorage } from './index.js'

let writeQueue = Promise.resolve()

function enqueue(task) {
  const run = writeQueue.catch(() => {}).then(task)
  writeQueue = run.catch(() => {})
  return run
}

export async function recordToolResult(record) {
  if (!record || !record.id) return false
  const createdAt = Number(record.createdAt) || Date.now()
  const params = [
    String(record.id),
    String(record.requestId || ''),
    String(record.conversationId || ''),
    String(record.tool || ''),
    Number(record.bytes) || 0,
    record.truncated ? 1 : 0,
    String(record.filePath || ''),
    createdAt,
    createdAt
  ]
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(
      `INSERT INTO tool_results
        (id, request_id, conversation_id, tool, bytes, truncated, file_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          request_id = excluded.request_id,
          conversation_id = excluded.conversation_id,
          tool = excluded.tool,
          bytes = excluded.bytes,
          truncated = excluded.truncated,
          file_path = excluded.file_path,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
      params
    )
    return true
  })
}

export async function recordSnapshot(record) {
  if (!record || !record.requestId) return false
  const createdAt = Number(record.createdAt) || Date.now()
  const params = [
    String(record.id || record.requestId),
    String(record.requestId),
    String(record.conversationId || ''),
    Number(record.fileCount) || 0,
    String(record.directory || ''),
    createdAt,
    createdAt
  ]
  return enqueue(async () => {
    const db = await getStorage()
    await db.run(
      `INSERT INTO tool_snapshots
        (id, request_id, conversation_id, file_count, directory, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(request_id) DO UPDATE SET
          conversation_id = excluded.conversation_id,
          file_count = excluded.file_count,
          directory = excluded.directory,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at`,
      params
    )
    return true
  })
}

export async function pruneArtifacts(cutoff) {
  const value = Number(cutoff)
  if (!Number.isFinite(value)) return
  const db = await getStorage()
  await Promise.all([
    db.run('DELETE FROM tool_results WHERE created_at < ?', [value]),
    db.run('DELETE FROM tool_snapshots WHERE created_at < ?', [value])
  ])
}
