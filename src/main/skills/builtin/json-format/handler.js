export default function handler(params) {
  const jsonString = params.json_string
  const indent = params.indent || 2
  
  try {
    const parsed = JSON.parse(jsonString)
    const formatted = JSON.stringify(parsed, null, indent)
    
    return {
      success: true,
      content: formatted,
      metadata: {
        original_length: jsonString.length,
        formatted_length: formatted.length,
        valid: true
      }
    }
  } catch (e) {
    return {
      success: false,
      error: `JSON格式错误: ${e.message}`,
      metadata: { valid: false }
    }
  }
}