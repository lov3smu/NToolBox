import { describe, it, expect } from 'vitest'
import { bindSqlParams, extractSqlParams, hasSqlParams } from '../src/renderer/src/views/database/sqlParams.js'

describe('SQL named parameters', () => {
  it('extracts unique parameter names in order', () => {
    expect(extractSqlParams('SELECT * FROM t WHERE id = :id AND name = :name OR owner = :id')).toEqual(['id', 'name'])
  })

  it('ignores placeholders inside strings, comments and escaped identifiers', () => {
    const sql = [
      'SELECT \':id\', `:name`, "a: b" FROM t',
      '-- :line_comment',
      '# :hash_comment',
      '/* :block_comment */',
      'WHERE c1 = :value'
    ].join('\n')
    expect(extractSqlParams(sql)).toEqual(['value'])
  })

  it('does not treat assignment := or double colon as a parameter', () => {
    expect(extractSqlParams('SET @a := 1, b = c::text WHERE x = :x')).toEqual(['x'])
  })

  it('binds values positionally and keeps repeated names in sync', () => {
    const bound = bindSqlParams('SELECT * FROM t WHERE id = :id OR parent = :id AND name = :name', {
      id: 7,
      name: 'demo'
    })
    expect(bound.sql).toBe('SELECT * FROM t WHERE id = ? OR parent = ? AND name = ?')
    expect(bound.params).toEqual([7, 7, 'demo'])
    expect(bound.names).toEqual(['id', 'name'])
  })

  it('returns null for missing values and reports presence', () => {
    expect(bindSqlParams('SELECT :missing', {}).params).toEqual([null])
    expect(hasSqlParams('SELECT 1')).toBe(false)
    expect(hasSqlParams('SELECT * FROM t WHERE a = :a')).toBe(true)
  })
})
