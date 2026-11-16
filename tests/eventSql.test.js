import { describe, expect, it } from 'vitest'
import { buildAlterEventSql, quoteSqlString, toDateTimeInput, toMysqlDateTime } from '@/views/database/eventSql'

function baseDialog(overrides = {}) {
  return {
    database: 'demo',
    name: 'clean_contracts',
    definition: 'BEGIN\n  CALL clean_finish_contract(CURDATE());\nEND;',
    comment: '每天清理',
    status: 'ENABLED',
    scheduleType: 'RECURRING',
    starts: '2026-11-16T02:00',
    ends: '',
    intervalValue: '1',
    intervalField: 'DAY',
    onCompletion: 'PRESERVE',
    ...overrides
  }
}

describe('buildAlterEventSql', () => {
  it('builds a recurring ALTER EVENT with schedule, state and comment', () => {
    const sql = buildAlterEventSql(baseDialog())
    expect(sql).toBe(
      [
        'ALTER EVENT `demo`.`clean_contracts`',
        "ON SCHEDULE EVERY 1 DAY STARTS '2026-11-16 02:00:00'",
        'ON COMPLETION PRESERVE',
        'ENABLE',
        "COMMENT '每天清理'",
        'DO BEGIN\n  CALL clean_finish_contract(CURDATE());\nEND'
      ].join('\n')
    )
  })

  it('builds a one-time event and omits unused recurring fields', () => {
    const sql = buildAlterEventSql(
      baseDialog({ scheduleType: 'ONCE', starts: '2026-12-01T09:30', intervalValue: '', onCompletion: 'NOT PRESERVE' })
    )
    expect(sql).toContain("ON SCHEDULE AT '2026-12-01 09:30:00'")
    expect(sql).not.toContain('EVERY')
    expect(sql).toContain('ON COMPLETION NOT PRESERVE')
  })

  it('rejects missing definition, non-positive interval and unknown units', () => {
    expect(() => buildAlterEventSql(baseDialog({ definition: '   ' }))).toThrow('事件定义不能为空')
    expect(() => buildAlterEventSql(baseDialog({ intervalValue: '0' }))).toThrow('间隔值必须是正整数')
    expect(() => buildAlterEventSql(baseDialog({ intervalField: 'FORTNIGHT' }))).toThrow('间隔单位无效')
    expect(() => buildAlterEventSql(baseDialog({ scheduleType: 'ONCE', starts: '' }))).toThrow('请填写执行时间')
  })

  it('escapes identifiers and string literals', () => {
    const sql = buildAlterEventSql(baseDialog({ database: 'de`mo', comment: "it's a \\ test" }))
    expect(sql).toContain('ALTER EVENT `de``mo`.`clean_contracts`')
    expect(sql).toContain("COMMENT 'it''s a \\\\ test'")
    expect(quoteSqlString("a'b")).toBe("'a''b'")
  })
})

describe('datetime helpers', () => {
  it('converts datetime-local values to MySQL datetime', () => {
    expect(toMysqlDateTime('2026-11-15T08:05')).toBe('2026-11-15 08:05:00')
    expect(toMysqlDateTime('2026-11-15 08:05:30')).toBe('2026-11-15 08:05:30')
    expect(toMysqlDateTime('')).toBe('')
  })

  it('converts Date and database values to datetime-local', () => {
    expect(toDateTimeInput(new Date(2026, 0, 2, 3, 4, 5))).toBe('2026-01-02T03:04')
    expect(toDateTimeInput('2026-01-02 03:04:05')).toBe('2026-01-02T03:04')
    expect(toDateTimeInput(null)).toBe('')
  })
})
