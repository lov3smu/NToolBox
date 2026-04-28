export default function handler(params) {
  if (params.timestamp) {
    let ts = params.timestamp
    if (ts < 1e12) ts *= 1000
    const date = new Date(ts)
    
    return {
      success: true,
      content: `时间戳 ${params.timestamp} 对应的时间：\n日期：${date.toLocaleDateString('zh-CN')}\n时间：${date.toLocaleTimeString('zh-CN')}\nISO：${date.toISOString()}`,
      metadata: {
        timestamp: params.timestamp,
        date: date.toLocaleDateString('zh-CN'),
        time: date.toLocaleTimeString('zh-CN'),
        iso: date.toISOString()
      }
    }
  }
  
  if (params.date_string) {
    const date = new Date(params.date_string)
    if (isNaN(date.getTime())) {
      return { success: false, error: '无法解析日期字符串' }
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