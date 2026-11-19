export const DATABASE_PAGE_SIZE_OPTIONS = Object.freeze([
  { value: 50, label: '50 行', hint: '每次加载更少数据，切换更快' },
  { value: 100, label: '100 行（默认）', hint: '默认分页大小' },
  { value: 200, label: '200 行', hint: '一屏查看更多数据' },
  { value: 500, label: '500 行', hint: '大表浏览时减少翻页' }
])

export const DATABASE_PAGE_SIZES = DATABASE_PAGE_SIZE_OPTIONS.map((option) => option.value)
export const DEFAULT_DATABASE_PAGE_SIZE = 100

export const DATABASE_REFRESH_INTERVAL_OPTIONS = Object.freeze([
  { value: 0, label: '关闭', hint: '不自动刷新，仅手动刷新实例状态与会话' },
  { value: 2, label: '2 秒', hint: '实时性最好，查询频次最高' },
  { value: 5, label: '5 秒（默认）', hint: '兼顾实时性与负载' },
  { value: 10, label: '10 秒', hint: '降低对数据库的轮询压力' }
])

export const DATABASE_REFRESH_INTERVALS = DATABASE_REFRESH_INTERVAL_OPTIONS.map((option) => option.value)
export const DEFAULT_DATABASE_REFRESH_INTERVAL = 5

export const DATABASE_TRANSFER_BATCH_SIZE_OPTIONS = Object.freeze([
  { value: 100, label: '100 行/批', hint: '小批量最稳，适合跨网络或宽表传输' },
  { value: 500, label: '500 行/批', hint: '兼顾稳定性与速度' },
  { value: 1000, label: '1000 行/批（默认）', hint: '默认批量，适合多数表' },
  { value: 2000, label: '2000 行/批', hint: '大表提速，注意目标库 max_allowed_packet' },
  { value: 5000, label: '5000 行/批', hint: '仅建议局域网传输，内存占用较高' }
])

export const DATABASE_TRANSFER_BATCH_SIZES = DATABASE_TRANSFER_BATCH_SIZE_OPTIONS.map((option) => option.value)
export const DEFAULT_DATABASE_TRANSFER_BATCH_SIZE = 1000

export const DATABASE_HISTORY_LIMIT_OPTIONS = Object.freeze([
  { value: 50, label: '50 条', hint: '占用最少，适合低频查询' },
  { value: 100, label: '100 条', hint: '只保留最近常用的查询' },
  { value: 200, label: '200 条（默认）', hint: '默认条数，超出后清理最早记录' },
  { value: 500, label: '500 条', hint: '高频查询时保留更多历史' }
])

export const DATABASE_HISTORY_LIMITS = DATABASE_HISTORY_LIMIT_OPTIONS.map((option) => option.value)
export const DEFAULT_DATABASE_HISTORY_LIMIT = 200

export function normalizeDatabasePageSize(value) {
  const num = Number(value)
  return DATABASE_PAGE_SIZES.includes(num) ? num : DEFAULT_DATABASE_PAGE_SIZE
}

export function normalizeDatabaseRefreshInterval(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_DATABASE_REFRESH_INTERVAL
  const num = Number(value)
  return DATABASE_REFRESH_INTERVALS.includes(num) ? num : DEFAULT_DATABASE_REFRESH_INTERVAL
}

export function normalizeDatabaseTransferBatchSize(value) {
  const num = Number(value)
  return DATABASE_TRANSFER_BATCH_SIZES.includes(num) ? num : DEFAULT_DATABASE_TRANSFER_BATCH_SIZE
}

export function normalizeDatabaseHistoryLimit(value) {
  const num = Number(value)
  return DATABASE_HISTORY_LIMITS.includes(num) ? num : DEFAULT_DATABASE_HISTORY_LIMIT
}

export function normalizeDatabaseClientSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    pageSize: normalizeDatabasePageSize(source.pageSize),
    refreshInterval: normalizeDatabaseRefreshInterval(source.refreshInterval),
    transferBatchSize: normalizeDatabaseTransferBatchSize(source.transferBatchSize),
    historyLimit: normalizeDatabaseHistoryLimit(source.historyLimit)
  }
}
