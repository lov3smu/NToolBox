import { describe, expect, it } from 'vitest'
import { isRoutineDdl, splitSqlStatementRanges, splitSqlStatements } from '../src/renderer/src/utils/sqlStatements.js'

describe('splitSqlStatements', () => {
  it('splits plain statements and keeps strings/comments intact', () => {
    const sql = "SELECT ';' AS a; -- trailing;\n# hash ;\nSELECT 2 /* ; */;"
    expect(splitSqlStatements(sql)).toEqual(["SELECT ';' AS a", '-- trailing;\n# hash ;\nSELECT 2 /* ; */'])
  })

  it('keeps a CREATE PROCEDURE body as one statement', () => {
    const sql = `CREATE DEFINER=\`root\`@\`%\` PROCEDURE \`p\`()
BEGIN
  DECLARE x INT DEFAULT 0;
  IF x = 0 THEN
    SET x = 1;
  END IF;
  SELECT x;
END`
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(1)
    expect(statements[0].startsWith('CREATE DEFINER')).toBe(true)
    expect(statements[0].endsWith('END')).toBe(true)
  })

  it('handles DELIMITER directives and following statements', () => {
    const sql = `DELIMITER $$
CREATE PROCEDURE p()
BEGIN
  SELECT 1;
  SELECT 2;
END$$
DELIMITER ;
CALL p();`
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0].startsWith('CREATE PROCEDURE p()')).toBe(true)
    expect(statements[0].endsWith('END')).toBe(true)
    expect(statements[1]).toBe('CALL p()')
  })

  it('keeps trigger and function bodies intact', () => {
    const sql = `CREATE TRIGGER trg BEFORE INSERT ON t FOR EACH ROW
BEGIN
  SET NEW.a = 1;
END;
CREATE FUNCTION f() RETURNS INT
BEGIN
  RETURN 1;
END;`
    expect(splitSqlStatements(sql)).toHaveLength(2)
  })

  it('does not treat table DDL as a routine', () => {
    expect(isRoutineDdl('CREATE TABLE event (id INT)')).toBe(false)
    expect(isRoutineDdl('CREATE DEFINER=`u`@`%` PROCEDURE p() BEGIN END')).toBe(true)
    expect(splitSqlStatements('CREATE TABLE t (id INT); SELECT 1;')).toHaveLength(2)
  })

  it('reports ranges that cover the delimiter for gutter markers', () => {
    const sql = 'SELECT 1;\nSELECT 2;'
    const ranges = splitSqlStatementRanges(sql)
    expect(ranges).toHaveLength(2)
    expect(sql.slice(ranges[0].from, ranges[0].to)).toBe('SELECT 1;')
    expect(ranges[1].from).toBe(10)
  })

  it('keeps CASE expressions inside a routine body intact', () => {
    const sql = `CREATE PROCEDURE p()
BEGIN
  SELECT CASE WHEN 1 THEN 'a' ELSE 'b' END;
  SELECT 2;
END;
SELECT 3;`
    const statements = splitSqlStatements(sql)
    expect(statements).toHaveLength(2)
    expect(statements[0].includes('SELECT 2;')).toBe(true)
    expect(statements[1]).toBe('SELECT 3')
  })

  it('drops comment-only statements', () => {
    expect(splitSqlStatements('-- hello;\n# world;\n/* block; */')).toEqual([])
    expect(splitSqlStatements('-- note\nSELECT 1;')).toEqual(['-- note\nSELECT 1'])
  })
})
