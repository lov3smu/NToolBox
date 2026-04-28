export default function handler(params) {
  const frequency = params.frequency
  const hour = params.hour || 0
  const minute = params.minute || 0
  const dayOfMonth = params.day_of_month || 1
  const dayOfWeek = params.day_of_week || '*'
  
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
    case 'weekly':
      cronExpression = `${minute} ${hour} * * ${dayOfWeek}`
      description = `每周${dayOfWeek} ${hour}:${minute.toString().padStart(2, '0')} 执行`
      break
    case 'monthly':
      cronExpression = `${minute} ${hour} ${dayOfMonth} * *`
      description = `每月第${dayOfMonth}天 ${hour}:${minute.toString().padStart(2, '0')} 执行`
      break
    case 'custom':
      cronExpression = `${minute} ${hour} ${dayOfMonth || '*'} * ${dayOfWeek === '*' ? '*' : dayOfWeek}`
      description = `自定义: ${cronExpression}`
      break
    default:
      return { success: false, error: '未知的频率类型' }
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
}