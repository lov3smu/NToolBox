export const SKILL_CATEGORY_LABELS = {
  code: '代码',
  database: '数据库',
  document: '文档',
  general: '通用',
  security: '安全'
}

export const SKILL_STATUS_LABELS = {
  available: '可安装',
  installed: '已安装',
  update: '可更新',
  builtin: '内置'
}

export function getCategoryLabel(category) {
  return SKILL_CATEGORY_LABELS[category] || category || '通用'
}

export function formatDownloads(value) {
  const count = Number(value) || 0
  if (count >= 10000) return `${(count / 10000).toFixed(1)} 万`
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
  return String(count)
}

export function formatExample(example) {
  if (example === null || example === undefined) return ''
  if (typeof example !== 'object') return String(example)
  return Object.entries(example)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('\n')
}
