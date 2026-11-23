import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { SqliteClient } from './client.js'

let client = null
let opening = null

export function getDatabasePath() {
  const override = String(process.env.NTB_SQLITE_PATH || '').trim()
  if (override) return override
  const base = typeof app?.getPath === 'function' ? app.getPath('userData') : process.cwd()
  return path.join(base, 'ntoolbox.db')
}

function restrictDatabasePermissions(dbPath) {
  if (process.platform === 'win32') return
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.chmodSync(`${dbPath}${suffix}`, 0o600)
    } catch {
      // WAL/SHM 可能尚未创建
    }
  }
}

export async function getStorage() {
  if (client) return client
  if (!opening) {
    opening = (async () => {
      const dbPath = getDatabasePath()
      const instance = new SqliteClient(dbPath)
      await instance.open()
      restrictDatabasePermissions(dbPath)
      client = instance
      return instance
    })().finally(() => {
      opening = null
    })
  }
  return opening
}

export async function closeStorage() {
  const current = client
  client = null
  if (current) await current.close()
}

export function getStorageMode() {
  return client?.mode || ''
}
