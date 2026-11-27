import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp' }
}))

vi.mock('../src/main/utils/index.js', () => ({
  log: { info: () => {}, warn: () => {}, error: () => {} }
}))

const { buildWhereClause } = await import('../src/main/services/database/index.js')

const columns = [{ name: 'status' }, { name: 'name' }, { name: 'amount' }]

function expectWhere(result) {
  expect(result.whereSql.startsWith(' WHERE ')).toBe(true)
  return result.whereSql.slice(' WHERE '.length)
}

describe('buildWhereClause', () => {
  it('combines filters with per-condition AND/OR in top-to-bottom order', () => {
    const result = buildWhereClause(columns, {
      filters: [
        { field: 'status', operator: '=', value: 1 },
        { field: 'name', operator: 'LIKE', value: '%foo%', connector: 'OR' },
        { field: 'amount', operator: '>', value: 10, connector: 'AND' }
      ]
    })

    expect(expectWhere(result)).toBe('((`status` = ? OR CAST(`name` AS CHAR) LIKE ?) AND `amount` > ?)')
    expect(result.params).toEqual([1, '%foo%', 10])
  })

  it('falls back to the legacy logic option when connectors are absent', () => {
    const result = buildWhereClause(columns, {
      logic: 'OR',
      filters: [
        { field: 'status', operator: '=', value: 1 },
        { field: 'name', operator: 'LIKE', value: '%foo%' }
      ]
    })

    expect(expectWhere(result)).toBe('(`status` = ? OR CAST(`name` AS CHAR) LIKE ?)')
  })

  it('always ANDs the table search with the filter group', () => {
    const result = buildWhereClause(columns, {
      filters: [{ field: 'status', operator: '=', value: 1 }],
      search: 'foo'
    })

    expect(expectWhere(result)).toBe(
      '(`status` = ? AND (CAST(`status` AS CHAR) LIKE ? OR CAST(`name` AS CHAR) LIKE ? OR CAST(`amount` AS CHAR) LIKE ?))'
    )
    expect(result.params).toEqual([1, '%foo%', '%foo%', '%foo%'])
  })

  it('supports search without filters and rejects unknown filter fields', () => {
    const searchOnly = buildWhereClause(columns, { search: 'foo' })
    expect(searchOnly.whereSql).toContain('CAST(`name` AS CHAR) LIKE ?')

    expect(() => buildWhereClause(columns, { filters: [{ field: 'missing', operator: '=', value: 1 }] })).toThrow(
      '无效的筛选字段'
    )
  })
})
