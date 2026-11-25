import { describe, expect, it } from 'vitest'
import {
  applyNameCase,
  buildDropStatement,
  buildTruncateStatement,
  filterTransferObjects,
  groupTransferObjects,
  normalizeTransferObjects,
  normalizeTransferSettings,
  normalizeTransferTask,
  parseBulkObjectNames,
  remapRow,
  stripDefiner,
  transformTableDdl,
  transformViewDdl,
  transferObjectKey
} from '../src/renderer/src/views/database/transferPlan.js'

describe('transfer plan', () => {
  it('normalizes objects, drops unsupported types and duplicates, and orders by type', () => {
    const objects = normalizeTransferObjects([
      { type: 'column', name: 'id', table: 'orders' },
      { type: 'trigger', name: 'trg_orders', detail: 'orders · BEFORE INSERT' },
      { type: 'table', name: 'orders' },
      { type: 'view', name: 'v_orders' },
      { type: 'table', name: 'orders' },
      { type: 'procedure', name: 'sp_clean' },
      { type: 'x', name: 'skip' },
      { type: 'function', name: 'fn_total' },
      { type: 'event', name: 'ev_clean' }
    ])

    expect(objects.map(transferObjectKey)).toEqual([
      'table:orders',
      'view:v_orders',
      'procedure:sp_clean',
      'function:fn_total',
      'trigger:trg_orders',
      'event:ev_clean'
    ])
  })

  it('filters and groups objects by type', () => {
    const objects = normalizeTransferObjects([
      { type: 'table', name: 'orders', detail: '订单' },
      { type: 'view', name: 'v_orders' },
      { type: 'procedure', name: 'sp_clean', detail: '清理' }
    ])

    expect(filterTransferObjects(objects, 'ord').map((item) => item.name)).toEqual(['orders', 'v_orders'])
    expect(filterTransferObjects(objects, '清理').map((item) => item.name)).toEqual(['sp_clean'])
    expect(groupTransferObjects(objects).map((group) => [group.label, group.items.length])).toEqual([
      ['表', 1],
      ['视图', 1],
      ['存储过程', 1]
    ])
  })

  it('parses bulk names with optional type prefixes', () => {
    const objects = normalizeTransferObjects([
      { type: 'table', name: 'orders' },
      { type: 'view', name: 'orders' },
      { type: 'procedure', name: 'sp_clean' }
    ])

    expect(parseBulkObjectNames('orders, procedure:sp_clean\nmissing', objects)).toEqual({
      keys: ['table:orders', 'view:orders', 'procedure:sp_clean'],
      unmatched: ['missing']
    })
  })

  it('normalizes settings and names cases', () => {
    expect(applyNameCase('Orders', 'lower')).toBe('orders')
    expect(applyNameCase('Orders', 'upper')).toBe('ORDERS')
    expect(applyNameCase('Orders', 'keep')).toBe('Orders')

    const settings = normalizeTransferSettings({
      contentMode: 'data',
      targetMode: 'truncate',
      tableNameCase: 'upper',
      columnNameCase: 'lower',
      batchSize: 999999,
      timeoutMode: '45',
      selectedObjects: ['table:orders', 'bad', 3]
    })

    expect(settings).toMatchObject({
      contentMode: 'data',
      targetMode: 'truncate',
      tableNameCase: 'upper',
      columnNameCase: 'lower',
      batchSize: 10000,
      timeoutMode: '45',
      selectedObjects: ['table:orders']
    })
    expect(normalizeTransferSettings({ contentMode: 'bad', targetMode: 'bad', batchSize: 0 })).toMatchObject({
      contentMode: 'all',
      targetMode: 'append',
      batchSize: 1000,
      timeoutMode: 'inherit'
    })
    expect(normalizeTransferTask({ name: ' 夜间迁移 ', contentMode: 'structure' })).toMatchObject({
      name: '夜间迁移',
      contentMode: 'structure'
    })
  })

  it('normalizes mask presets in settings and tasks', () => {
    const settings = normalizeTransferSettings({ maskPresets: ['phone', 'bad', 'phone', 'email'] })
    expect(settings.maskPresets).toEqual(['phone', 'email'])
    expect(normalizeTransferSettings({}).maskPresets).toEqual([])
    expect(normalizeTransferTask({ name: '迁移', maskPresets: ['name'] }).maskPresets).toEqual(['name'])
  })

  it('transforms create table DDL for target name and column case', () => {
    const ddl = [
      'CREATE TABLE `orders` (',
      '  `id` bigint NOT NULL AUTO_INCREMENT,',
      '  `OrderNo` varchar(32) NOT NULL,',
      '  PRIMARY KEY (`id`),',
      '  KEY `idx_order_no` (`OrderNo`)',
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    ].join('\n')

    const lower = transformTableDdl(ddl, { targetName: 'orders_archive', columnCase: 'lower' })
    expect(lower).toContain('CREATE TABLE `orders_archive` (')
    expect(lower).toContain('  `orderno` varchar(32) NOT NULL,')
    expect(lower).toContain('KEY `idx_order_no` (`orderno`)')

    const kept = transformTableDdl(ddl, { targetName: 'Orders_Archive' })
    expect(kept).toContain('CREATE TABLE `Orders_Archive` (')
    expect(kept).toContain('`OrderNo` varchar(32)')
  })

  it('applies table name case to foreign key references', () => {
    const ddl = [
      'CREATE TABLE `contracts` (',
      '  `id` int NOT NULL,',
      '  `account_id` int NOT NULL,',
      '  PRIMARY KEY (`id`),',
      '  CONSTRAINT `fk_contract_account` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`)',
      ') ENGINE=InnoDB'
    ].join('\n')

    const upper = transformTableDdl(ddl, { targetName: 'CONTRACTS', tableNameCase: 'upper' })
    expect(upper).toContain('CREATE TABLE `CONTRACTS` (')
    expect(upper).toContain('REFERENCES `ACCOUNTS` (`id`)')

    const kept = transformTableDdl(ddl, { targetName: 'contracts_copy', tableNameCase: 'keep' })
    expect(kept).toContain('REFERENCES `accounts` (`id`)')
  })

  it('strips definers and turns views into create or replace', () => {
    const ddl =
      'CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_orders` AS select `orders`.`id` AS `id` from `orders`'

    const transformed = transformViewDdl(ddl, { targetName: 'v_orders_archive' })
    expect(transformed).toBe(
      'CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v_orders_archive` AS select `orders`.`id` AS `id` from `orders`'
    )
    expect(stripDefiner("CREATE DEFINER='root'@'%' PROCEDURE `p`() BEGIN END")).toBe('CREATE PROCEDURE `p`() BEGIN END')
  })

  it('builds quoted drop and truncate statements', () => {
    expect(buildDropStatement('procedure', 'demo', 'sp_clean')).toBe('DROP PROCEDURE IF EXISTS `demo`.`sp_clean`')
    expect(buildDropStatement('unknown', 'demo', 'x')).toBe('')
    expect(buildTruncateStatement('demo', 'or`ders')).toBe('TRUNCATE TABLE `demo`.`or``ders`')
  })

  it('remaps source rows to target columns and skips generated columns', () => {
    const targetFields = [
      { name: 'ID', extra: 'auto_increment' },
      { name: 'Title', extra: '' },
      { name: 'total', extra: 'STORED GENERATED' }
    ]

    expect(remapRow({ id: 1, title: '合同', total: 9, unknown: 'x' }, targetFields)).toEqual({
      ID: 1,
      Title: '合同'
    })
    expect(remapRow({ unknown: 1 }, targetFields)).toBeNull()
  })
})
