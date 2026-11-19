export const UPDATE_CHECK_INTERVAL_OPTIONS = Object.freeze([
  { value: 1, label: '每小时（默认）', hint: '启动后每小时检查一次新版本' },
  { value: 6, label: '每 6 小时', hint: '一天检查约 4 次' },
  { value: 24, label: '每天', hint: '仅在启动后每天检查一次' }
])

export const UPDATE_CHECK_INTERVALS = UPDATE_CHECK_INTERVAL_OPTIONS.map((option) => option.value)
export const DEFAULT_UPDATE_CHECK_INTERVAL_HOURS = 1

export function normalizeUpdateCheckInterval(value) {
  const num = Number(value)
  return UPDATE_CHECK_INTERVALS.includes(num) ? num : DEFAULT_UPDATE_CHECK_INTERVAL_HOURS
}
