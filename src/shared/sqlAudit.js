export const SQL_AUDIT_RULES = Object.freeze([
  {
    id: 'update_delete_without_where',
    label: 'UPDATE/DELETE 缺少 WHERE',
    level: 'error',
    description: '全表更新或删除风险极高，请补充 WHERE 条件或用 LIMIT 限制范围'
  },
  {
    id: 'drop_truncate',
    label: 'DROP/TRUNCATE 破坏性语句',
    level: 'error',
    description: '删除对象或清空表数据不可恢复，执行前务必确认目标'
  },
  {
    id: 'select_star',
    label: 'SELECT *',
    level: 'warn',
    description: '按需选择字段，避免回表与不必要的网络传输'
  },
  {
    id: 'leading_wildcard',
    label: 'LIKE 前置通配符',
    level: 'warn',
    description: '以 % 或 _ 开头的 LIKE 无法使用索引，容易触发全表扫描'
  },
  {
    id: 'missing_limit',
    label: 'SELECT 缺少 LIMIT',
    level: 'warn',
    description: '未限制返回行数，可能拖慢查询并占用大量内存'
  },
  {
    id: 'insert_without_columns',
    label: 'INSERT 未指定列',
    level: 'warn',
    description: '显式列出列名，避免表结构变化导致插入失败'
  }
])

const RULE_MAP = new Map(SQL_AUDIT_RULES.map((rule) => [rule.id, rule]))

export const DEFAULT_SQL_AUDIT_RULES = Object.freeze(
  Object.fromEntries(SQL_AUDIT_RULES.map((rule) => [rule.id, rule.id !== 'missing_limit']))
)

const LEVEL_WEIGHT = { error: 0, warn: 1, info: 2 }

export function stripSqlComments(sql) {
  return String(sql || '').replace(/^(?:\/\*[\s\S]*?\*\/|--[^\n]*(?:\n|$)|#[^\n]*(?:\n|$)|\s)+/g, '')
}

function selectListOf(sql) {
  const match = /^select\b([\s\S]*?)\bfrom\b/i.exec(sql)
  if (!match) return null
  const list = match[1].replace(/^\s*(?:distinct|sql_no_cache|sql_cache|high_priority|straight_join)\b/i, '').trim()
  return list || null
}

function hasStarSelection(sql) {
  const list = selectListOf(sql)
  if (!list) return false
  const segments = []
  let segment = ''
  let depth = 0
  for (const char of list) {
    if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)
    if (char === ',' && depth === 0) {
      segments.push(segment)
      segment = ''
      continue
    }
    segment += char
  }
  segments.push(segment)
  return segments.some((item) => /^(?:`?\w+`?\s*\.\s*)?\*$/.test(item.trim()))
}

function auditStatement(statement, rules) {
  const sql = stripSqlComments(String(statement || '').trim())
  if (!sql) return []

  const issues = []
  const add = (ruleId) => {
    if (rules[ruleId] !== true) return
    const rule = RULE_MAP.get(ruleId)
    if (!rule) return
    issues.push({
      rule: rule.id,
      level: rule.level,
      label: rule.label,
      message: rule.description,
      sql: sql.length > 160 ? `${sql.slice(0, 160)}…` : sql
    })
  }

  if (/^(update|delete)\b/i.test(sql) && !/\bwhere\b/i.test(sql)) {
    add('update_delete_without_where')
  }
  if (/^(drop|truncate)\b/i.test(sql)) {
    add('drop_truncate')
  }
  if (/^select\b/i.test(sql)) {
    if (hasStarSelection(sql)) add('select_star')
    if (!/\blimit\b/i.test(sql)) add('missing_limit')
  }
  if (/\blike\s+(['"])(?:%|_)/i.test(sql)) {
    add('leading_wildcard')
  }
  if (/^insert\b/i.test(sql) && /\bvalues\b/i.test(sql)) {
    const target = /^insert\s+(?:ignore\s+)?into\s+(?:(?:`[^`]+`|\w+)\s*\.\s*)?(?:`[^`]+`|\w+)\s*([\s\S]*)$/i.exec(sql)
    if (target && !/^\(/.test(target[1].trim())) add('insert_without_columns')
  }

  return issues
}

export function auditSqlStatements(statements, rules = DEFAULT_SQL_AUDIT_RULES) {
  const effective = { ...DEFAULT_SQL_AUDIT_RULES, ...(rules || {}) }
  const issues = []
  for (const statement of Array.isArray(statements) ? statements : []) {
    issues.push(...auditStatement(statement, effective))
  }
  return issues.sort((left, right) => (LEVEL_WEIGHT[left.level] ?? 9) - (LEVEL_WEIGHT[right.level] ?? 9))
}
