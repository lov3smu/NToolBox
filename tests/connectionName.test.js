import { describe, it, expect } from 'vitest'
import {
  applyEngineDefaults,
  createDefaultConnection,
  generateConnectionName
} from '../src/renderer/src/views/database/connectionDefaults.js'

describe('generateConnectionName', () => {
  it('prefers the database name, then the host, then the engine label', () => {
    expect(generateConnectionName({ engine: 'mysql', database: 'shop', host: '127.0.0.1' })).toBe('shop')
    expect(generateConnectionName({ engine: 'mysql', database: '', host: '127.0.0.1' })).toBe('127.0.0.1')
    expect(generateConnectionName({ engine: 'postgres', database: '', host: '' })).toBe('PostgreSQL')
  })

  it('derives sqlite names from the file path', () => {
    expect(generateConnectionName({ engine: 'sqlite', filePath: '/home/me/data/app.sqlite' })).toBe('app')
    expect(generateConnectionName({ engine: 'sqlite', filePath: 'C:\\db\\report.db3' })).toBe('report')
    expect(generateConnectionName({ engine: 'sqlite', filePath: '' })).toBe('SQLite')
  })

  it('dedupes against existing names', () => {
    const conn = { engine: 'mysql', database: 'shop' }
    expect(generateConnectionName(conn, ['shop'])).toBe('shop 2')
    expect(generateConnectionName(conn, ['shop', 'shop 2', 'shop 3'])).toBe('shop 4')
  })
})

describe('applyEngineDefaults', () => {
  it('replaces untouched defaults when switching engines', () => {
    const conn = createDefaultConnection()
    conn.engine = 'postgres'
    applyEngineDefaults(conn, 'mysql')
    expect(conn.port).toBe(5432)
    expect(conn.user).toBe('postgres')
    expect(conn.host).toBe('localhost')
  })

  it('keeps customized fields', () => {
    const conn = createDefaultConnection()
    conn.engine = 'postgres'
    conn.port = 6543
    conn.user = 'app'
    applyEngineDefaults(conn, 'mysql')
    expect(conn.port).toBe(6543)
    expect(conn.user).toBe('app')
  })

  it('clears network fields for sqlite and drops charset for non-mysql engines', () => {
    const conn = createDefaultConnection()
    conn.engine = 'sqlite'
    conn.ssh.enabled = true
    conn.ssl.enabled = true
    applyEngineDefaults(conn, 'mysql')
    expect(conn.port).toBe(0)
    expect(conn.ssh.enabled).toBe(false)
    expect(conn.ssl.enabled).toBe(false)

    conn.engine = 'postgres'
    conn.charset = 'utf8mb4'
    applyEngineDefaults(conn, 'sqlite')
    expect(conn.charset).toBe('')
    expect(conn.host).toBe('localhost')
    expect(conn.port).toBe(5432)
  })
})
