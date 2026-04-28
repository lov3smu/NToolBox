export default function handler(params) {
  const yamlString = params.yaml_string
  
  try {
    const lines = yamlString.split('\n')
    const errors = []
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1
      
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0 && line[colonIndex - 1] === ' ') {
        if (!errors.some(e => e.line === lineNum)) {
          errors.push({
            line: lineNum,
            message: '键名后面可能有空格'
          })
        }
      }
    }
    
    const valid = errors.length === 0
    
    return {
      success: true,
      content: valid ? 'YAML格式验证通过' : `发现 ${errors.length} 个潜在问题`,
      metadata: {
        valid,
        errors,
        line_count: lines.length
      }
    }
  } catch (e) {
    return {
      success: false,
      error: `YAML验证失败: ${e.message}`
    }
  }
}