import { t } from '@/i18n'

export function formatDateTime(date, format = 'full') {
  if (!date) return ''
  const d = new Date(date)

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`
    case 'time':
      return `${hour}:${minute}:${second}`
    case 'short':
      return `${month}-${day} ${hour}:${minute}`
    case 'datetime':
      return `${year}-${month}-${day} ${hour}:${minute}`
    default:
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
  }
}

export function formatRelativeTime(timestamp) {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  const minute = 60000
  const hour = 3600000
  const day = 86400000

  if (diff < minute) return t('刚刚')
  if (diff < hour) return Math.floor(diff / minute) + t('分钟前')
  if (diff < day) return Math.floor(diff / hour) + t('小时前')
  if (diff < day * 7) return Math.floor(diff / day) + t('天前')
  return formatDateTime(timestamp, 'date')
}
