import { describe, expect, it } from 'vitest'
import { rankSchemaTables } from '../src/renderer/src/views/database/schemaContext.js'

const tables = [
  {
    name: 'sys_user',
    comment: '系统用户表',
    columns: [{ name: 'id' }, { name: 'username' }]
  },
  {
    name: 'biz_contract',
    comment: '合同信息表',
    columns: [
      { name: 'id' },
      { name: 'contract_no', comment: '合同编号' },
      { name: 'amount', comment: '合同金额' },
      { name: 'customer_id', comment: '客户ID' }
    ]
  },
  {
    name: 'sys_role',
    comment: '角色表',
    columns: [{ name: 'id' }, { name: 'name' }]
  }
]

describe('rankSchemaTables', () => {
  it('keeps the original order when there is no prompt', () => {
    expect(rankSchemaTables(tables, '')).toEqual(tables)
  })

  it('ranks the contract table first for a Chinese business prompt', () => {
    const ranked = rankSchemaTables(tables, '统计每个客户的合同数量和金额')
    expect(ranked[0].name).toBe('biz_contract')
  })

  it('matches partial Chinese terms against table comments', () => {
    const ranked = rankSchemaTables(tables, '查询所有合同')
    expect(ranked[0].name).toBe('biz_contract')
  })

  it('matches English prompt words against table names', () => {
    const ranked = rankSchemaTables(tables, 'select contract amount by customer')
    expect(ranked[0].name).toBe('biz_contract')
  })

  it('matches column comments', () => {
    const ranked = rankSchemaTables(tables, '按合同编号排序')
    expect(ranked[0].name).toBe('biz_contract')
  })

  it('keeps stable order for equal scores', () => {
    const ranked = rankSchemaTables(tables, '完全无关的描述')
    expect(ranked.map((table) => table.name)).toEqual(['sys_user', 'biz_contract', 'sys_role'])
  })
})
