import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ getConfig: vi.fn() }))

import { getConfig } from '@/api'
import { createSqlAudit } from '@/views/database/useSqlAudit'

function createState() {
  return { sqlAuditDialog: { value: null } }
}

describe('database sql audit config', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads audit settings from database.audit', async () => {
    getConfig.mockResolvedValue({
      database: { audit: { enabled: true, strict: true, rules: { drop_table: false } } }
    })

    const audit = createSqlAudit(createState())

    await expect(audit.loadSqlAuditSettings()).resolves.toEqual({
      enabled: true,
      strict: true,
      rules: { drop_table: false }
    })
  })

  it('defaults to disabled when audit settings are missing', async () => {
    getConfig.mockResolvedValue({ database: {} })

    const audit = createSqlAudit(createState())

    await expect(audit.loadSqlAuditSettings()).resolves.toEqual({ enabled: false, strict: false, rules: {} })
  })
})
