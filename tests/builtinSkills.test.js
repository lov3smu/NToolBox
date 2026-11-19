import { describe, it, expect, vi } from 'vitest'
import cronHandler from '../src/main/skills/builtin/cron/handler.js'
import timestampHandler from '../src/main/skills/builtin/timestamp/handler.js'
import passwordHandler from '../src/main/skills/builtin/password/handler.js'
import jsonFormatHandler from '../src/main/skills/builtin/json-format/handler.js'
import yamlValidateHandler from '../src/main/skills/builtin/yaml-validate/handler.js'
import dbQueryHandler from '../src/main/skills/builtin/db-query/handler.js'
import dbSchemaHandler from '../src/main/skills/builtin/db-schema/handler.js'

const log = { debug: vi.fn(), warn: vi.fn() }

function createDatabase(overrides = {}) {
  return {
    isConnectionActive: vi.fn(() => true),
    executeQuery: vi.fn(async () => ({ success: true, rows: [], fields: [], rowCount: 0, duration: 1 })),
    queryDatabases: vi.fn(async () => ({ success: true, databases: [] })),
    queryTables: vi.fn(async () => ({ success: true, tables: [] })),
    getTableStructure: vi.fn(async () => ({ success: true, fields: [] })),
    ...overrides
  }
}

describe('cron skill', () => {
  it('maps weekly day names to cron numbers', () => {
    const result = cronHandler({ frequency: 'weekly', hour: 9, minute: 30, day_of_week: 'FRI' })
    expect(result.success).toBe(true)
    expect(result.metadata.cron_expression).toBe('30 9 * * 5')
  })

  it('defaults weekly to Monday', () => {
    const result = cronHandler({ frequency: 'weekly' })
    expect(result.metadata.cron_expression).toBe('0 0 * * 1')
  })

  it('uses a raw expression in custom mode', () => {
    const result = cronHandler({ frequency: 'custom', expression: '*/5 * * * *' })
    expect(result.success).toBe(true)
    expect(result.metadata.cron_expression).toBe('*/5 * * * *')
  })

  it('builds a custom expression from parts without a day of month', () => {
    const result = cronHandler({ frequency: 'custom', minute: 15, hour: 2 })
    expect(result.metadata.cron_expression).toBe('15 2 * * *')
  })

  it('rejects invalid ranges, weekdays and expressions', () => {
    expect(cronHandler({ frequency: 'daily', hour: 24 }).success).toBe(false)
    expect(cronHandler({ frequency: 'weekly', day_of_week: 'FUNDAY' }).success).toBe(false)
    expect(cronHandler({ frequency: 'custom', expression: '* * *' }).success).toBe(false)
    expect(cronHandler({ frequency: 'custom', expression: '@daily' }).success).toBe(false)
  })
})

describe('timestamp skill', () => {
  it('handles the epoch in seconds', () => {
    const result = timestampHandler({ timestamp: 0, timezone: 'UTC' })
    expect(result.success).toBe(true)
    expect(result.metadata.unit).toBe('秒')
    expect(result.metadata.iso).toBe('1970-01-01T00:00:00.000Z')
    expect(result.metadata.time).toBe('00:00:00')
  })

  it('detects millisecond timestamps', () => {
    const result = timestampHandler({ timestamp: 1704067200000, timezone: 'UTC' })
    expect(result.metadata.unit).toBe('毫秒')
    expect(result.metadata.iso).toBe('2024-01-01T00:00:00.000Z')
  })

  it('applies the requested timezone', () => {
    const result = timestampHandler({ timestamp: 0, timezone: 'Asia/Shanghai' })
    expect(result.metadata.time).toBe('08:00:00')
  })

  it('converts date strings to seconds and milliseconds', () => {
    const expectedMs = new Date('2024-01-01T00:00:00').getTime()
    const result = timestampHandler({ date_string: '2024-01-01' })
    expect(result.metadata.timestamp_seconds).toBe(Math.floor(expectedMs / 1000))
    expect(result.metadata.timestamp_milliseconds).toBe(expectedMs)
  })

  it('rejects invalid input', () => {
    expect(timestampHandler({ timestamp: 'abc' }).success).toBe(false)
    expect(timestampHandler({ timestamp: 0, timezone: 'Mars/Olympus' }).success).toBe(false)
    expect(timestampHandler({ date_string: 'not-a-date' }).success).toBe(false)
    expect(timestampHandler({}).success).toBe(false)
  })
})

describe('password skill', () => {
  it('returns the requested length with every active character set', () => {
    const result = passwordHandler({ length: 32 })
    expect(result.success).toBe(true)
    expect(result.content).toHaveLength(32)
    expect(result.content).toMatch(/[A-Z]/)
    expect(result.content).toMatch(/[a-z]/)
    expect(result.content).toMatch(/[0-9]/)
    expect(result.content).toMatch(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/)
  })

  it('respects disabled character sets', () => {
    const result = passwordHandler({
      length: 20,
      include_uppercase: false,
      include_symbols: false
    })
    expect(result.content).toMatch(/^[a-z0-9]+$/)
  })

  it('rejects impossible or invalid lengths', () => {
    expect(passwordHandler({ length: 0 }).success).toBe(false)
    expect(passwordHandler({ length: 129 }).success).toBe(false)
    expect(passwordHandler({ length: 2.5 }).success).toBe(false)
    expect(passwordHandler({ length: 2 }).success).toBe(false)
    expect(
      passwordHandler({
        length: 4,
        include_uppercase: false,
        include_lowercase: false,
        include_numbers: false,
        include_symbols: false
      }).success
    ).toBe(false)
  })
})

describe('json-format and yaml-validate skills', () => {
  it('supports zero indentation', () => {
    const result = jsonFormatHandler({ json_string: '{ "a": 1 }', indent: 2 })
    expect(result.content).toBe('{\n  "a": 1\n}')

    const compact = jsonFormatHandler({ json_string: '{ "a": 1 }', indent: 0 })
    expect(compact.success).toBe(true)
    expect(compact.content).toBe('{"a":1}')
    expect(compact.metadata.indent).toBe(0)
  })

  it('rejects invalid JSON and out-of-range indentation', () => {
    expect(jsonFormatHandler({ json_string: '{' }).success).toBe(false)
    expect(jsonFormatHandler({ json_string: '{}', indent: 11 }).success).toBe(false)
    expect(jsonFormatHandler({ json_string: '' }).success).toBe(false)
  })

  it('validates YAML and reports the error position', () => {
    const valid = yamlValidateHandler({ yaml_string: 'a: 1\nb:\n  - x\n' })
    expect(valid.success).toBe(true)
    expect(valid.metadata.valid).toBe(true)

    const invalid = yamlValidateHandler({ yaml_string: 'a: [1, 2\nb: 3' })
    expect(invalid.success).toBe(true)
    expect(invalid.metadata.valid).toBe(false)
    expect(invalid.metadata.errors[0].line).toBeGreaterThan(0)
  })

  it('requires a non-empty YAML string', () => {
    expect(yamlValidateHandler({ yaml_string: '   ' }).success).toBe(false)
  })
})

describe('db-query skill', () => {
  it('blocks writes, stacked statements and dangerous functions', async () => {
    const database = createDatabase()
    const context = { log, database }
    const base = { action: 'execute', connection_name: 'main' }

    await expect(dbQueryHandler({ ...base, sql: 'DELETE FROM users' }, context)).resolves.toMatchObject({
      success: false
    })
    await expect(dbQueryHandler({ ...base, sql: 'SELECT 1; DROP TABLE users' }, context)).resolves.toMatchObject({
      success: false
    })
    await expect(
      dbQueryHandler({ ...base, sql: 'SELECT * FROM users INTO OUTFILE "/tmp/x"' }, context)
    ).resolves.toMatchObject({ success: false })
    await expect(dbQueryHandler({ ...base, sql: 'SELECT LOAD_FILE("/etc/passwd")' }, context)).resolves.toMatchObject({
      success: false
    })
    await expect(dbQueryHandler({ ...base, sql: 'SELECT SLEEP(10)' }, context)).resolves.toMatchObject({
      success: false
    })
    expect(database.executeQuery).not.toHaveBeenCalled()
  })

  it('allows semicolons and keywords inside string literals', async () => {
    const database = createDatabase({
      executeQuery: vi.fn(async () => ({
        success: true,
        rows: [{ label: 'a;b' }],
        fields: [{ name: 'label', type: 'VAR_STRING' }],
        rowCount: 1,
        duration: 2
      }))
    })

    const result = await dbQueryHandler(
      {
        action: 'execute',
        connection_name: 'main',
        sql: "SELECT 'a;b' AS label -- DELETE all rows"
      },
      { log, database }
    )

    expect(result.success).toBe(true)
    expect(database.executeQuery).toHaveBeenCalledWith(
      'main',
      "SELECT 'a;b' AS label -- DELETE all rows",
      [],
      expect.objectContaining({ limit: 100, autoLimit: true })
    )
  })

  it('clamps the row limit and truncates large results', async () => {
    const rows = Array.from({ length: 80 }, (_, index) => ({ id: index }))
    const database = createDatabase({
      executeQuery: vi.fn(async () => ({
        success: true,
        rows,
        fields: [{ name: 'id', type: 'LONG' }],
        rowCount: rows.length,
        duration: 5
      }))
    })

    const result = await dbQueryHandler(
      { action: 'execute', connection_name: 'main', sql: 'SELECT id FROM big', limit: 9999 },
      { log, database }
    )

    expect(result.success).toBe(true)
    expect(database.executeQuery.mock.calls[0][3].limit).toBe(200)
    expect(result.metadata.limit).toBe(200)
    expect(result.metadata.rows).toHaveLength(50)
    expect(result.metadata.truncated).toBe(true)
    expect(result.content).toContain('还有 60 条记录未显示')
  })

  it('rejects inactive connections', async () => {
    const database = createDatabase({ isConnectionActive: vi.fn(() => false) })
    const result = await dbQueryHandler(
      { action: 'list_tables', connection_name: 'main' },
      { log, database }
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('未激活')
  })
})

describe('db-schema skill', () => {
  it('maps table structure fields and uses the requested database', async () => {
    const database = createDatabase({
      getTableStructure: vi.fn(async () => ({
        success: true,
        fields: [
          {
            name: 'id',
            dataType: 'bigint',
            columnType: 'bigint(20)',
            nullable: false,
            columnKey: 'PRI',
            defaultValue: null,
            extra: 'auto_increment',
            comment: '主键'
          },
          {
            name: 'title',
            dataType: 'varchar',
            columnType: 'varchar(100)',
            nullable: true,
            columnKey: '',
            defaultValue: '',
            extra: '',
            comment: ''
          }
        ]
      }))
    })

    const result = await dbSchemaHandler(
      { action: 'describe', connection_name: 'main', database: 'demo', table_name: 'article' },
      { log, database }
    )

    expect(result.success).toBe(true)
    expect(database.getTableStructure).toHaveBeenCalledWith('main', 'demo', 'article')
    expect(database.executeQuery).not.toHaveBeenCalled()
    expect(result.content).toContain('| id | bigint(20) | NO | PRI |  | auto_increment | 主键 |')
    expect(result.content).toContain('| title | varchar(100) | YES |  |  |  |  |')
  })

  it('falls back to SELECT DATABASE() when no database is given', async () => {
    const database = createDatabase({
      executeQuery: vi.fn(async () => ({ success: true, rows: [{ db: 'fallback_db' }] })),
      getTableStructure: vi.fn(async () => ({
        success: true,
        fields: [{ name: 'id', columnType: 'int', nullable: false }]
      }))
    })

    const result = await dbSchemaHandler(
      { action: 'describe', connection_name: 'main', table_name: 'user' },
      { log, database }
    )

    expect(result.success).toBe(true)
    expect(database.executeQuery).toHaveBeenCalledWith('main', 'SELECT DATABASE() AS db', [], { autoLimit: false })
    expect(database.getTableStructure).toHaveBeenCalledWith('main', 'fallback_db', 'user')
  })

  it('quotes identifiers and escapes backticks in SHOW statements', async () => {
    const database = createDatabase({
      executeQuery: vi.fn(async () => ({
        success: true,
        rows: [{ 'Create Table': 'CREATE TABLE `a``b` (id int)' }]
      }))
    })

    const result = await dbSchemaHandler(
      {
        action: 'show_create',
        connection_name: 'main',
        database: 'demo',
        table_name: 'a`b'
      },
      { log, database }
    )

    expect(result.success).toBe(true)
    expect(database.executeQuery.mock.calls[0][1]).toBe('SHOW CREATE TABLE `demo`.`a``b`')
  })

  it('reports missing default database and empty structures', async () => {
    const noDb = createDatabase({
      executeQuery: vi.fn(async () => ({ success: true, rows: [{ db: null }] }))
    })
    const first = await dbSchemaHandler(
      { action: 'describe', connection_name: 'main', table_name: 'user' },
      { log, database: noDb }
    )
    expect(first.success).toBe(false)

    const empty = createDatabase()
    const second = await dbSchemaHandler(
      { action: 'describe', connection_name: 'main', database: 'demo', table_name: 'missing' },
      { log, database: empty }
    )
    expect(second.success).toBe(false)
    expect(second.error).toContain('不存在')
  })
})
