const DEFAULT_INDENT = 2
const MAX_INDENT = 10

export default function handler(params) {
  const jsonString = params.json_string

  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return { success: false, error: '请提供要格式化的 JSON 字符串' }
  }

  const indent = params.indent === undefined || params.indent === null ? DEFAULT_INDENT : Number(params.indent)
  if (!Number.isInteger(indent) || indent < 0 || indent > MAX_INDENT) {
    return { success: false, error: `indent 必须是 0-${MAX_INDENT} 之间的整数` }
  }

  try {
    const parsed = JSON.parse(jsonString)
    const formatted = JSON.stringify(parsed, null, indent)

    return {
      success: true,
      content: formatted,
      metadata: {
        original_length: jsonString.length,
        formatted_length: formatted.length,
        indent,
        valid: true
      }
    }
  } catch (error) {
    return {
      success: false,
      error: `JSON格式错误: ${error.message}`,
      metadata: { valid: false }
    }
  }
}
