import { getConfig } from '@/api'
import { auditSqlStatements } from '@shared/sqlAudit'

export function createSqlAudit(state) {
  const { sqlAuditDialog } = state

  async function loadSqlAuditSettings() {
    try {
      const config = await getConfig()
      return {
        enabled: config?.database_audit_enabled === true,
        strict: config?.database_audit_strict === true,
        rules: config?.database_audit_rules || {}
      }
    } catch {
      return { enabled: false, strict: false, rules: {} }
    }
  }

  async function confirmSqlAudit(statements) {
    const settings = await loadSqlAuditSettings()
    if (!settings.enabled) return true

    const issues = auditSqlStatements(statements, settings.rules)
    if (!issues.length) return true

    const blocking = settings.strict && issues.some((issue) => issue.level === 'error')
    return new Promise((resolve) => {
      sqlAuditDialog.value = { show: true, blocking, issues, resolve }
    })
  }

  function closeSqlAuditDialog(confirmed = false) {
    const resolve = sqlAuditDialog.value.resolve
    const blocking = sqlAuditDialog.value.blocking
    sqlAuditDialog.value = { show: false, blocking: false, issues: [], resolve: null }
    if (resolve) resolve(confirmed && !blocking)
  }

  return { loadSqlAuditSettings, confirmSqlAudit, closeSqlAuditDialog }
}
