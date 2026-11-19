import { getLocale, t } from '@/i18n'

export const SKILL_CATEGORY_LABELS = {
  get code() {
    return t('代码')
  },
  get database() {
    return t('数据库')
  },
  get document() {
    return t('文档')
  },
  get general() {
    return t('通用')
  },
  get security() {
    return t('安全')
  }
}

export const SKILL_STATUS_LABELS = {
  get available() {
    return t('可安装')
  },
  get installed() {
    return t('已安装')
  },
  get update() {
    return t('可更新')
  },
  get builtin() {
    return t('内置')
  }
}

export function getCategoryLabel(category) {
  return SKILL_CATEGORY_LABELS[category] || category || t('通用')
}

export function formatDownloads(value) {
  const count = Number(value) || 0
  if (count >= 10000) {
    return getLocale() === 'zh-CN' ? t('{p0} 万', { p0: (count / 10000).toFixed(1) }) : `${(count / 1000).toFixed(1)}k`
  }
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
