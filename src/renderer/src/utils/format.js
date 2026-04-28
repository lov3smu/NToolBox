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
  
  if (diff < minute) return '刚刚'
  if (diff < hour) return Math.floor(diff / minute) + '分钟前'
  if (diff < day) return Math.floor(diff / hour) + '小时前'
  if (diff < day * 7) return Math.floor(diff / day) + '天前'
  return formatDateTime(timestamp, 'date')
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  let size = bytes
  let i = 0
  
  while (size >= k && i < units.length - 1) {
    size /= k
    i++
  }
  
  return `${size.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

export function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0秒'
  
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  
  const parts = []
  if (h > 0) parts.push(`${h}小时`)
  if (m > 0) parts.push(`${m}分钟`)
  if (s > 0 || parts.length === 0) parts.push(`${s}秒`)
  
  return parts.join('')
}