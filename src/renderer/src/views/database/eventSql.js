import { t } from '@/i18n'
const EVENT_INTERVAL_FIELDS = ['YEAR', 'QUARTER', 'MONTH', 'WEEK', 'DAY', 'HOUR', 'MINUTE', 'SECOND']

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function toDateTimeInput(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
  }
  const normalized = String(value).trim().replace('T', ' ')
  if (!normalized) return ''
  return normalized.slice(0, 16).replace(' ', 'T')
}

export function toMysqlDateTime(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateTime(value)
  }
  const normalized = String(value).trim().replace('T', ' ')
  if (!normalized) return ''
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized) ? `${normalized}:00` : normalized
}

export function quoteSqlString(value) {
  return `'${String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")}'`
}

function quoteIdentifier(value) {
  return `\`${String(value ?? '').replace(/`/g, '``')}\``
}

export function buildAlterEventSql(dialog) {
  if (!dialog) throw new Error(t('缺少事件信息'))

  const database = String(dialog.database || '').trim()
  const name = String(dialog.name || '').trim()
  if (!database) throw new Error(t('缺少数据库名称'))
  if (!name) throw new Error(t('事件名称不能为空'))

  const body = String(dialog.definition || '')
    .trim()
    .replace(/;\s*$/, '')
  if (!body) throw new Error(t('事件定义不能为空'))

  const clauses = [`ALTER EVENT ${quoteIdentifier(database)}.${quoteIdentifier(name)}`]

  if (dialog.scheduleType === 'ONCE') {
    const at = toMysqlDateTime(dialog.starts)
    if (!at) throw new Error(t('请填写执行时间'))
    clauses.push(`ON SCHEDULE AT ${quoteSqlString(at)}`)
  } else {
    const value = String(dialog.intervalValue ?? '').trim()
    if (!/^\d+$/.test(value) || Number(value) <= 0) throw new Error(t('间隔值必须是正整数'))
    const field = String(dialog.intervalField || '')
      .trim()
      .toUpperCase()
    if (!EVENT_INTERVAL_FIELDS.includes(field)) throw new Error(t('间隔单位无效'))

    let schedule = `ON SCHEDULE EVERY ${value} ${field}`
    const starts = toMysqlDateTime(dialog.starts)
    if (starts) schedule += ` STARTS ${quoteSqlString(starts)}`
    const ends = toMysqlDateTime(dialog.ends)
    if (ends) schedule += ` ENDS ${quoteSqlString(ends)}`
    clauses.push(schedule)
  }

  clauses.push(dialog.onCompletion === 'NOT PRESERVE' ? 'ON COMPLETION NOT PRESERVE' : 'ON COMPLETION PRESERVE')
  clauses.push(dialog.status === 'DISABLED' ? 'DISABLE' : 'ENABLE')
  clauses.push(`COMMENT ${quoteSqlString(dialog.comment || '')}`)
  clauses.push(`DO ${body}`)

  return clauses.join('\n')
}
