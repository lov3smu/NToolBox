import { describe, expect, it } from 'vitest'
import { formatSql } from '../src/renderer/src/views/database/sqlFormat.js'

describe('formatSql', () => {
  it('returns empty text unchanged', () => {
    expect(formatSql('')).toBe('')
    expect(formatSql('   ')).toBe('')
  })

  it('uppercases keywords and breaks major clauses', () => {
    expect(formatSql("select id, name from users where age > 18 and status = 'active' order by id desc limit 10;"))
      .toBe(`SELECT id,
  name
FROM users
WHERE age > 18
  AND status = 'active'
ORDER BY id DESC
LIMIT 10;`)
  })

  it('keeps BETWEEN ... AND on one line', () => {
    expect(formatSql('select * from orders where created_at between "2026-01-01" and "2026-01-31"')).toBe(
      `SELECT *
FROM orders
WHERE created_at BETWEEN "2026-01-01" AND "2026-01-31"`
    )
  })

  it('formats joins and ON conditions', () => {
    expect(formatSql('select c.id from contract c left join customer u on c.uid=u.id and u.deleted=0 where c.status=1'))
      .toBe(`SELECT c.id
FROM contract c
LEFT JOIN customer u
  ON c.uid = u.id
  AND u.deleted = 0
WHERE c.status = 1`)
  })

  it('indents subqueries', () => {
    expect(formatSql('select * from (select id from t where a=1) x')).toBe(`SELECT *
FROM (
  SELECT id
  FROM t
  WHERE a = 1
) x`)
  })

  it('formats INSERT statements with column lists inline', () => {
    expect(formatSql("insert into t (a,b) values (1,'x')")).toBe(`INSERT INTO t (a, b)
VALUES (1, 'x')`)
  })

  it('formats UPDATE statements', () => {
    expect(formatSql("update t set a=1,b='x' where id=3")).toBe(`UPDATE t
SET a = 1, b = 'x'
WHERE id = 3`)
  })

  it('puts each column definition on its own line', () => {
    expect(formatSql('create table contract (id bigint primary key, title varchar(64) not null) engine=innodb;'))
      .toBe(`CREATE TABLE contract (
  id BIGINT PRIMARY KEY,
  title VARCHAR(64) NOT NULL
) ENGINE = innodb;`)
  })

  it('never rewrites string literals, backticks or keyword-like identifiers', () => {
    const sql = "select `order`, 'select * from x' from `group`"
    expect(formatSql(sql)).toBe("SELECT `order`,\n  'select * from x'\nFROM `group`")
  })

  it('handles escaped quotes inside literals', () => {
    expect(formatSql("select * from t where name = 'it''s' and note = \"a\\\"b\"")).toBe(
      `SELECT *
FROM t
WHERE name = 'it''s'
  AND note = "a\\"b"`
    )
  })

  it('formats multiple statements independently', () => {
    expect(formatSql('select 1;select 2;')).toBe('SELECT 1;\nSELECT 2;')
  })

  it('is idempotent', () => {
    const once = formatSql('select a,b from t where x=1 and y=2 union all select a,b from u')
    expect(formatSql(once)).toBe(once)
  })
})
