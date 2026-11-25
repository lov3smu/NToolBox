import { describe, expect, it } from 'vitest'
import { buildPendingSql, escapeSqlValue, quoteIdentifier } from '../src/renderer/src/views/database/rowEditing.js'

describe('rowEditing identifier and value dialect', () => {
  it('quotes identifiers per engine', () => {
    expect(quoteIdentifier('user`name', 'mysql')).toBe('`user``name`')
    expect(quoteIdentifier('user"name', 'postgres')).toBe('"user""name"')
    expect(quoteIdentifier('user"name', 'sqlite')).toBe('"user""name"')
  })

  it('escapes backslashes only for mysql', () => {
    expect(escapeSqlValue('a\\b', 'mysql')).toBe("'a\\\\b'")
    expect(escapeSqlValue('a\\b', 'postgres')).toBe("'a\\b'")
    expect(escapeSqlValue("it's", 'sqlite')).toBe("'it''s'")
    expect(escapeSqlValue(null, 'postgres')).toBe('NULL')
  })
})

describe('buildPendingSql', () => {
  it('builds mysql update with database qualification and <=>', () => {
    const sql = buildPendingSql({
      database: 'verifydb',
      tableName: 'users',
      rowEdits: { k1: { keys: { id: 2 }, values: { name: 'bob' } } }
    })
    expect(sql).toBe("UPDATE `verifydb`.`users` SET `name` = 'bob' WHERE `id` <=> 2;")
  })

  it('builds postgres update with quoted identifiers and IS NOT DISTINCT FROM', () => {
    const sql = buildPendingSql({
      database: 'verifydb',
      tableName: 'users',
      engine: 'postgres',
      rowEdits: { k1: { keys: { id: 2, name: null }, values: { name: 'bob' } } }
    })
    expect(sql).toBe(
      'UPDATE "users" SET "name" = \'bob\' WHERE "id" IS NOT DISTINCT FROM 2 AND "name" IS NOT DISTINCT FROM NULL;'
    )
  })

  it('builds sqlite delete with IS and unqualified table', () => {
    const sql = buildPendingSql({
      tableName: 'users',
      engine: 'sqlite',
      rowDeletes: { k1: { id: 3 } }
    })
    expect(sql).toBe('DELETE FROM "users" WHERE "id" IS 3;')
  })

  it('uses DEFAULT VALUES for empty non-mysql inserts', () => {
    expect(buildPendingSql({ tableName: 'users', engine: 'postgres', rowInserts: [{}] })).toBe(
      'INSERT INTO "users" DEFAULT VALUES;'
    )
    expect(buildPendingSql({ tableName: 'users', rowInserts: [{}] })).toBe('INSERT INTO `users` () VALUES ();')
  })

  it('builds insert rows with engine quoting', () => {
    const sql = buildPendingSql({
      tableName: 'users',
      engine: 'postgres',
      rowInserts: [{ values: { name: "O'Neil", age: 3 } }]
    })
    expect(sql).toBe('INSERT INTO "users" ("name", "age") VALUES (\'O\'\'Neil\', 3);')
  })
})
