import * as yaml from 'js-yaml'

export default function handler(params) {
  const yamlString = params.yaml_string

  if (typeof yamlString !== 'string' || !yamlString.trim()) {
    return { success: false, error: '请提供要验证的 YAML 字符串' }
  }

  const lineCount = yamlString.split('\n').length

  try {
    yaml.load(yamlString)
    return {
      success: true,
      content: 'YAML格式验证通过',
      metadata: {
        valid: true,
        errors: [],
        line_count: lineCount
      }
    }
  } catch (error) {
    const line = error.mark?.line === undefined ? null : error.mark.line + 1
    const column = error.mark?.column === undefined ? null : error.mark.column + 1
    const message = error.reason || error.message || '未知的 YAML 解析错误'
    const position = line === null ? '' : `第 ${line} 行${column === null ? '' : `第 ${column} 列`}：`

    return {
      success: true,
      content: `YAML格式错误：${position}${message}`,
      metadata: {
        valid: false,
        errors: [{ line, column, message }],
        line_count: lineCount
      }
    }
  }
}
