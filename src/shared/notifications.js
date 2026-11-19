export const NOTIFICATION_ITEMS = Object.freeze([
  { key: 'upload_done', label: '图床上传完成', hint: '批量上传结束后提醒成功与失败数量，点击回到应用' },
  { key: 'backup_done', label: '数据库备份完成', hint: '定时备份任务成功或失败后提醒' },
  { key: 'update_found', label: '发现新版本', hint: '后台检查到新版本时提醒，点击查看更新内容' },
  { key: 'agent_done', label: 'AI 长任务完成', hint: 'AI 助手任务执行超过 1 分钟结束时提醒' }
])

export const NOTIFICATION_KEYS = NOTIFICATION_ITEMS.map((item) => item.key)

export function normalizeNotificationConfig(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const result = {}
  for (const key of NOTIFICATION_KEYS) {
    result[key] = typeof source[key] === 'boolean' ? source[key] : true
  }
  return result
}
