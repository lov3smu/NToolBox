import { describe, it, expect } from 'vitest'
import {
  BUILTIN_TEMPLATES,
  buildDictionaryStatements,
  buildFunctionGroupStatements
} from '../src/main/services/templateBuilder.js'

describe('buildDictionaryStatements', () => {
  it('builds dictionary and dictionary-data inserts', () => {
    const { sql, dict_value } = buildDictionaryStatements('订单状态', [{ name: '已发布' }, { name: '已下线' }], {
      订单状态: 'ORDER_STATUS',
      已发布: 'PUBLISHED',
      已下线: 'OFFLINE'
    })

    expect(dict_value).toBe('ORDER_STATUS')
    expect(sql).toContain("'订单状态', 'ORDER_STATUS'")
    expect(sql).toContain("('ORDER_STATUS', '已发布', 'PUBLISHED', NULL, 'EBL', 1,")
    expect(sql).toContain("('ORDER_STATUS', '已下线', 'OFFLINE', NULL, 'EBL', 2,")
    expect(sql.match(/INSERT INTO/g)).toHaveLength(2)
  })

  it('escapes quotes and falls back to upper-case codes', () => {
    const { sql, dict_value } = buildDictionaryStatements("O'Brien", [{ name: "It's" }])

    expect(dict_value).toBe("O'BRIEN")
    expect(sql).toContain("O''Brien")
    expect(sql).toContain("It''s")
  })

  it('keeps explicit sort and status values', () => {
    const { sql } = buildDictionaryStatements('DICT', [{ name: 'A', sort: 9, status: 'DBL' }])
    expect(sql).toContain("'A', 'A', NULL, 'DBL', 9,")
  })
})

describe('buildFunctionGroupStatements', () => {
  const groups = [
    {
      code: 'user',
      name: '用户管理',
      level: 1,
      functions: [{ code: 'user:list', name: '用户列表' }]
    },
    {
      code: 'user:role',
      name: '角色管理',
      level: 2,
      parent_code: 'user',
      functions: [{ code: 'user:role:edit', name: "角色'编辑", is_sensitive: 1, sort: 20, status: 101002 }]
    }
  ]

  it('emits parent lookup, group inserts and function inserts', () => {
    const sql = buildFunctionGroupStatements('user_app', groups, {
      user: 'User',
      'user:role': 'UserRole',
      'user:list': 'UserList',
      'user:role:edit': 'UserRoleEdit'
    })

    expect(sql).toContain("SET @parent_1_id = (SELECT id FROM t_function_group WHERE app_group='user_app'")
    expect(sql).toContain("'User', '用户管理'")
    expect(sql).toContain("'UserRole', '角色管理'")
    expect(sql).toContain("'UserList', '用户列表'")
    expect(sql).toContain("'UserRoleEdit', '角色''编辑', 1, 20, 101002")
    expect(sql).toContain('SET @group_0_id = LAST_INSERT_ID();')
    expect(sql).toContain('SET @group_1_id = LAST_INSERT_ID();')
  })

  it('escapes the application group', () => {
    const sql = buildFunctionGroupStatements("app'1", [{ code: 'g', name: 'G' }], {})
    expect(sql).toContain("VALUES ('app''1'")
  })

  it('sorts groups by level before generating statements', () => {
    const sql = buildFunctionGroupStatements(
      'app',
      [
        { code: 'child', name: 'Child', level: 2, parent_code: 'root' },
        { code: 'root', name: 'Root', level: 1 }
      ],
      {}
    )
    expect(sql.indexOf("'Root'")).toBeLessThan(sql.indexOf("'Child'"))
  })
})

describe('BUILTIN_TEMPLATES', () => {
  it('exposes dictionary and function-group templates', () => {
    expect(Object.keys(BUILTIN_TEMPLATES).sort()).toEqual(['dictionary', 'function_group'])
    expect(BUILTIN_TEMPLATES.dictionary.dictInsert).toContain('INSERT INTO `t_dictionary`')
    expect(BUILTIN_TEMPLATES.function_group.functionInsert).toContain('INSERT INTO `t_function`')
  })
})
