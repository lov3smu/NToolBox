const MAX_DATE_MS = 8.64e15

function resolveTimeZone(timeZone) {
  if (!timeZone) return undefined
  try {
    new Intl.DateTimeFormat('zh-CN', { timeZone }).format(new Date())
    return timeZone
  } catch {
    throw new Error(`无效的时区：${timeZone}`)
  }
}

function formatDateTime(date, timeZone) {
  return {
    date: date.toLocaleDateString('zh-CN', { timeZone }),
    time: date.toLocaleTimeString('zh-CN', { timeZone, hour12: false }),
    iso: date.toISOString()
  }
}

export default function handler(params) {
  let timeZone
  try {
    timeZone = resolveTimeZone(params.timezone)
  } catch (error) {
    return { success: false, error: error.message }
  }

  const hasTimestamp = params.timestamp !== undefined && params.timestamp !== null && params.timestamp !== ''

  if (hasTimestamp) {
    const rawTimestamp = Number(params.timestamp)
    if (!Number.isFinite(rawTimestamp)) {
      return { success: false, error: 'timestamp 必须是数字' }
    }

    const isMilliseconds = Math.abs(rawTimestamp) >= 1e11
    const timestampMs = isMilliseconds ? rawTimestamp : rawTimestamp * 1000
    if (Math.abs(timestampMs) > MAX_DATE_MS) {
      return { success: false, error: '时间戳超出可表示范围' }
    }

    const date = new Date(timestampMs)
    if (Number.isNaN(date.getTime())) {
      return { success: false, error: '无法解析时间戳' }
    }

    const formatted = formatDateTime(date, timeZone)
    const unit = isMilliseconds ? '毫秒' : '秒'

    return {
      success: true,
      content: `时间戳 ${rawTimestamp}（${unit}）对应的时间：\n日期：${formatted.date}\n时间：${formatted.time}\nISO：${formatted.iso}`,
      metadata: {
        timestamp: rawTimestamp,
        unit,
        date: formatted.date,
        time: formatted.time,
        iso: formatted.iso,
        timezone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    }
  }

  if (params.date_string) {
    const dateText = /^\d{4}-\d{2}-\d{2}$/.test(params.date_string)
      ? `${params.date_string}T00:00:00`
      : params.date_string
    const date = new Date(dateText)

    if (Number.isNaN(date.getTime())) {
      return { success: false, error: '无法解析日期字符串，请使用 2024-01-01 或 2024-01-01 12:00:00 格式' }
    }

    const timestampSec = Math.floor(date.getTime() / 1000)
    const timestampMs = date.getTime()

    return {
      success: true,
      content: `日期 ${params.date_string} 对应的时间戳：\n秒：${timestampSec}\n毫秒：${timestampMs}`,
      metadata: {
        input: params.date_string,
        timestamp_seconds: timestampSec,
        timestamp_milliseconds: timestampMs
      }
    }
  }

  return { success: false, error: '请提供 timestamp 或 date_string 参数' }
}
