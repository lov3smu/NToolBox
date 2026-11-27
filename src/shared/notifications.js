export const NOTIFICATION_CHANNELS = Object.freeze(['system', 'panel', 'off'])

export const NOTIFICATION_CHANNEL_OPTIONS = Object.freeze([
  { value: 'system', label: '系统通知', hint: '弹出系统通知，同时记入通知中心' },
  { value: 'panel', label: '仅应用内', hint: '只记入通知中心，不弹出系统通知' },
  { value: 'off', label: '关闭', hint: '不提醒，也不记录' }
])

export const NOTIFICATION_ITEMS = Object.freeze([
  {
    key: 'upload_done',
    label: '图床上传完成',
    hint: '批量上传结束后提醒成功与失败数量，点击回到应用',
    level: 'success'
  },
  { key: 'backup_done', label: '数据库备份完成', hint: '定时备份任务成功或失败后提醒', level: 'success' },
  {
    key: 'scheduled_task_done',
    label: '计划任务完成',
    hint: 'HTTP 请求、Recipe 或剪贴板清理任务执行后提醒',
    level: 'success'
  },
  { key: 'update_found', label: '发现新版本', hint: '后台检查到新版本时提醒，点击查看更新内容', level: 'info' },
  { key: 'agent_done', label: 'AI 长任务完成', hint: 'AI 助手任务执行超过 1 分钟结束时提醒', level: 'success' }
])

export const NOTIFICATION_KEYS = NOTIFICATION_ITEMS.map((item) => item.key)

export const NOTIFICATION_LEVELS = Object.freeze(['info', 'success', 'warning', 'error'])

export function normalizeNotificationChannel(value) {
  if (value === true) return 'system'
  if (value === false) return 'off'
  return NOTIFICATION_CHANNELS.includes(value) ? value : 'system'
}

export function normalizeNotificationConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const result = {}
  for (const key of NOTIFICATION_KEYS) {
    result[key] = normalizeNotificationChannel(source[key])
  }
  return result
}

export function getNotificationLevel(key) {
  return NOTIFICATION_ITEMS.find((item) => item.key === key)?.level || 'info'
}
