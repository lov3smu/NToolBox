import { describe, it, expect } from 'vitest'
import { auditSqlStatements, DEFAULT_SQL_AUDIT_RULES } from '../src/shared/sqlAudit.js'

describe('SQL audit rules', () => {
  it('flags UPDATE/DELETE without WHERE as errors', () => {
    const issues = auditSqlStatements(['UPDATE users SET name = 1', 'DELETE FROM users'])
    expect(issues.map((issue) => issue.rule)).toEqual(['update_delete_without_where', 'update_delete_without_where'])
    expect(issues.every((issue) => issue.level === 'error')).toBe(true)
  })

  it('accepts UPDATE/DELETE that carry a WHERE clause', () => {
    const issues = auditSqlStatements(['UPDATE users SET name = 1 WHERE id = 2', 'DELETE FROM users WHERE id = 3'])
    expect(issues.filter((issue) => issue.level === 'error')).toHaveLength(0)
  })

  it('flags DROP and TRUNCATE as errors', () => {
    const issues = auditSqlStatements(['DROP TABLE demo', 'TRUNCATE TABLE demo'])
    expect(issues.map((issue) => issue.rule)).toEqual(['drop_truncate', 'drop_truncate'])
  })

  it('detects SELECT * but ignores COUNT(*) and explicit columns', () => {
    expect(auditSqlStatements(['SELECT * FROM t LIMIT 1']).map((issue) => issue.rule)).toEqual(['select_star'])
    expect(auditSqlStatements(['SELECT t.* FROM t LIMIT 1']).map((issue) => issue.rule)).toEqual(['select_star'])
    expect(auditSqlStatements(['SELECT COUNT(*) FROM t LIMIT 1'])).toHaveLength(0)
    expect(auditSqlStatements(['SELECT id, name FROM t LIMIT 1'])).toHaveLength(0)
  })

  it('detects leading wildcards in LIKE', () => {
    expect(auditSqlStatements(["SELECT id FROM t WHERE name LIKE '%abc' LIMIT 1"]).map((issue) => issue.rule)).toEqual([
      'leading_wildcard'
    ])
    expect(auditSqlStatements(["SELECT id FROM t WHERE name LIKE 'abc%' LIMIT 1"])).toHaveLength(0)
  })

  it('reports missing LIMIT only when the rule is enabled', () => {
    expect(DEFAULT_SQL_AUDIT_RULES.missing_limit).toBe(false)
    expect(auditSqlStatements(['SELECT id FROM t'])).toHaveLength(0)
    expect(auditSqlStatements(['SELECT id FROM t'], { missing_limit: true }).map((issue) => issue.rule)).toEqual([
      'missing_limit'
    ])
  })

  it('detects INSERT without a column list', () => {
    expect(auditSqlStatements(['INSERT INTO t VALUES (1, 2)']).map((issue) => issue.rule)).toEqual([
      'insert_without_columns'
    ])
    expect(auditSqlStatements(['INSERT INTO t (a, b) VALUES (1, 2)'])).toHaveLength(0)
    expect(auditSqlStatements(['INSERT INTO db.t SET a = 1'])).toHaveLength(0)
  })

  it('respects disabled rules and strips leading comments', () => {
    const issues = auditSqlStatements(['/* audit */ DELETE FROM t', '-- note\nDROP TABLE t'], {
      update_delete_without_where: false,
      drop_truncate: false
    })
    expect(issues).toHaveLength(0)

    const detected = auditSqlStatements(['-- note\nDELETE FROM t'])
    expect(detected).toHaveLength(1)
    expect(detected[0].sql.startsWith('-- note')).toBe(false)
  })

  it('sorts error-level issues before warnings', () => {
    const issues = auditSqlStatements(['SELECT * FROM t', 'DELETE FROM t'])
    expect(issues.map((issue) => issue.level)).toEqual(['error', 'warn'])
  })
})
