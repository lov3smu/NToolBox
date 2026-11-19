const WEEKDAY_MAP = {
  SUN: '0',
  MON: '1',
  TUE: '2',
  WED: '3',
  THU: '4',
  FRI: '5',
  SAT: '6'
}

const WEEKDAY_LABELS = {
  SUN: '日',
  MON: '一',
  TUE: '二',
  WED: '三',
  THU: '四',
  FRI: '五',
  SAT: '六'
}

function readInteger(value, { field, min, max, fallback }) {
  if (value === undefined || value === null || value === '') return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${field} 必须是 ${min}-${max} 之间的整数`)
  }
  return parsed
}

function readWeekday(value, fallback = '*') {
  const day = value === undefined || value === null || value === '' ? fallback : value
  if (day === '*') return day
  if (!WEEKDAY_MAP[day]) {
    throw new Error(`day_of_week 必须是 ${Object.keys(WEEKDAY_MAP).join('、')} 之一`)
  }
  return WEEKDAY_MAP[day]
}

function validateCustomExpression(expression) {
  const trimmed = String(expression).trim()
  const fields = trimmed.split(/\s+/)

  if (fields.length !== 5) {
    throw new Error('自定义 Cron 表达式必须是 5 段，例如 */5 * * * *')
  }
  if (!fields.every((field) => /^[0-9A-Za-z*/?,-]+$/.test(field))) {
    throw new Error('自定义 Cron 表达式包含非法字符')
  }

  return trimmed
}

export default function handler(params) {
  const frequency = params.frequency

  try {
    if (frequency === 'custom' && params.expression) {
      const cronExpression = validateCustomExpression(params.expression)
      return {
        success: true,
        content: `Cron表达式：${cronExpression}\n说明：自定义表达式`,
        metadata: { cron_expression: cronExpression, description: '自定义表达式', frequency }
      }
    }

    const minute = readInteger(params.minute, { field: 'minute', min: 0, max: 59, fallback: 0 })
    const hour = readInteger(params.hour, { field: 'hour', min: 0, max: 23, fallback: 0 })
    const dayOfMonth = readInteger(params.day_of_month, { field: 'day_of_month', min: 1, max: 31, fallback: 1 })

    let cronExpression
    let description

    switch (frequency) {
      case 'every_minute':
        cronExpression = '* * * * *'
        description = '每分钟执行一次'
        break
      case 'hourly':
        cronExpression = `${minute} * * * *`
        description = `每小时第${minute}分钟执行`
        break
      case 'daily':
        cronExpression = `${minute} ${hour} * * *`
        description = `每天 ${hour}:${minute.toString().padStart(2, '0')} 执行`
        break
      case 'weekly': {
        const dayOfWeek = readWeekday(params.day_of_week, 'MON')
        cronExpression = `${minute} ${hour} * * ${dayOfWeek}`
        description = `每周${WEEKDAY_LABELS[params.day_of_week || 'MON']} ${hour}:${minute.toString().padStart(2, '0')} 执行`
        break
      }
      case 'monthly':
        cronExpression = `${minute} ${hour} ${dayOfMonth} * *`
        description = `每月第${dayOfMonth}天 ${hour}:${minute.toString().padStart(2, '0')} 执行`
        break
      case 'custom': {
        const customDayOfMonth =
          params.day_of_month === undefined || params.day_of_month === null || params.day_of_month === ''
            ? '*'
            : String(dayOfMonth)
        const customDayOfWeek = readWeekday(params.day_of_week)
        cronExpression = `${minute} ${hour} ${customDayOfMonth} * ${customDayOfWeek}`
        description = `自定义: ${cronExpression}`
        break
      }
      default:
        return { success: false, error: `未知的频率类型：${frequency}` }
    }

    return {
      success: true,
      content: `Cron表达式：${cronExpression}\n说明：${description}`,
      metadata: {
        cron_expression: cronExpression,
        description,
        frequency,
        hour,
        minute
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
