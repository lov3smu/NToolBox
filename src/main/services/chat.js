import { log } from '../utils'
import { getConfig } from './config'
import { generateSQLFile } from './generator'
import { getProvider, PROVIDER_TYPES, PROVIDER_INFO, getAvailableProviders, getProviderModels } from './ai/index.js'

const SYSTEM_PROMPT = `你是一个智能助手，可以帮助用户完成各种开发相关的任务。请主动使用工具来帮助用户。

可用工具：
1. get_sql_config - 获取SQL脚本配置（数据库列表、脚本类型）
2. generate_sql_script - 生成SQL脚本（需要: database, operate_type[FIX/PUBLISH/QUERY], script_type, dir_name, usage）
3. generate_password - 生成随机密码
4. convert_timestamp - 时间戳转换
5. generate_cron - 生成Cron表达式
6. format_json - 格式化JSON
7. validate_yaml - 验证YAML
8. get_current_time - 获取当前时间

重要规则：
- 当用户请求生成SQL脚本时，必须调用 generate_sql_script 工具
- 如果用户未指定 operate_type，默认使用 PUBLISH
- dir_name（目录名）应该使用中文，可以直接使用用户的用途描述，如"添加用户表"、"修复订单数据"等
- 如果用户未指定 script_type，根据用途推断（添加表→DDL，修改数据→DML，查询→QUERY）
- 执行工具后，将结果以友好方式展示给用户

示例：
用户: "帮我生成一个SQL脚本，数据库是order_db，类型是DDL，用途是添加用户表"
你应该调用: generate_sql_script({database: "order_db", operate_type: "PUBLISH", script_type: "DDL", dir_name: "添加用户表", usage: "添加用户表"})

用户: "生成一个修复脚本，数据库是user_db，用途是修复密码字段"
你应该调用: generate_sql_script({database: "user_db", operate_type: "FIX", script_type: "DML", dir_name: "修复密码字段", usage: "修复密码字段"})`

const tools = [
  {
    type: 'function',
    function: {
      name: 'get_sql_config',
      description: '获取SQL脚本生成的配置信息，包括可用的数据库列表和脚本类型',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_sql_script',
      description: '生成SQL脚本文件，自动创建符合规范的SQL脚本',
      parameters: {
        type: 'object',
        properties: {
          database: { type: 'string', description: '数据库名称，必须是配置中已有的数据库' },
          operate_type: { type: 'string', enum: ['FIX', 'PUBLISH', 'QUERY'], description: '操作类型：FIX(修复)、PUBLISH(发布)、QUERY(查询)' },
          script_type: { type: 'string', description: '脚本类型：DDL、DML、DQL等（QUERY类型不需要此参数）' },
          dir_name: { type: 'string', description: '目录名称，用于组织脚本文件，使用中文描述' },
          usage: { type: 'string', description: '脚本用途说明，描述这个SQL脚本要做什么' }
        },
        required: ['database', 'operate_type', 'dir_name', 'usage']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_password',
      description: '生成随机密码，可指定长度和包含的字符类型',
      parameters: {
        type: 'object',
        properties: {
          length: { type: 'integer', description: '密码长度，默认16' },
          include_uppercase: { type: 'boolean', description: '是否包含大写字母，默认true' },
          include_lowercase: { type: 'boolean', description: '是否包含小写字母，默认true' },
          include_numbers: { type: 'boolean', description: '是否包含数字，默认true' },
          include_symbols: { type: 'boolean', description: '是否包含特殊字符，默认true' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'convert_timestamp',
      description: 'Unix时间戳与日期时间互转',
      parameters: {
        type: 'object',
        properties: {
          timestamp: { type: 'integer', description: 'Unix时间戳（秒或毫秒）' },
          date_string: { type: 'string', description: '日期字符串，格式如 2024-01-01 或 2024-01-01 12:00:00' }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_cron',
      description: '生成Cron表达式，用于定时任务配置',
      parameters: {
        type: 'object',
        properties: {
          frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'hourly', 'every_minute', 'custom'], description: '执行频率类型' },
          hour: { type: 'integer', description: '小时（0-23）' },
          minute: { type: 'integer', description: '分钟（0-59）' },
          day_of_month: { type: 'integer', description: '每月的第几天（1-31）' },
          day_of_week: { type: 'string', enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'], description: '星期几' }
        },
        required: ['frequency']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'format_json',
      description: '格式化或验证JSON字符串',
      parameters: {
        type: 'object',
        properties: {
          json_string: { type: 'string', description: '要格式化或验证的JSON字符串' },
          indent: { type: 'integer', description: '缩进空格数，默认2' }
        },
        required: ['json_string']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'validate_yaml',
      description: '验证YAML格式是否正确',
      parameters: {
        type: 'object',
        properties: {
          yaml_string: { type: 'string', description: '要验证的YAML字符串' }
        },
        required: ['yaml_string']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前时间和日期信息',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
]

async function executeToolCall(name, args) {
  try {
    const params = typeof args === 'string' ? JSON.parse(args) : args
    log.info('执行工具调用:', name, '参数:', params)
    
    switch (name) {
      case 'get_sql_config':
        return getSqlConfig()
      case 'generate_sql_script':
        return await generateSqlScript(params)
      case 'generate_password':
        return generatePassword(params)
      case 'convert_timestamp':
        return convertTimestamp(params)
      case 'generate_cron':
        return generateCron(params)
      case 'format_json':
        return formatJson(params)
      case 'validate_yaml':
        return validateYaml(params)
      case 'get_current_time':
        return getCurrentTime()
      default:
        return { success: false, error: `未知工具: ${name}` }
    }
  } catch (e) {
    log.error('工具执行失败:', e)
    return { success: false, error: `工具执行失败: ${e.message}` }
  }
}

function getSqlConfig() {
  const config = getConfig()
  const databases = config.databases || []
  const scriptTypes = (config.script_types || []).map(st => ({
    name: st.name,
    description: st.description
  }))
  
  return {
    success: true,
    databases,
    script_types: scriptTypes,
    operate_types: [
      { name: 'FIX', description: '修复脚本 - 用于修复数据或结构问题' },
      { name: 'PUBLISH', description: '发布脚本 - 用于新功能发布' },
      { name: 'QUERY', description: '查询脚本 - 用于数据查询，不需要脚本类型' }
    ],
    developer: {
      ch_name: config.developer_ch_name,
      en_name: config.developer_en_name
    }
  }
}

async function generateSqlScript(params) {
  const scriptInfo = {
    database: params.database,
    operateType: params.operate_type,
    scriptType: params.script_type,
    dirName: params.dir_name,
    usage: params.usage
  }
  
  const result = await generateSQLFile(scriptInfo)
  
  if (result.success) {
    return {
      success: true,
      filename: result.filename,
      file_path: result.filePath,
      target_path: result.targetPath,
      message: `SQL脚本已成功生成：${result.filename}`
    }
  }
  
  return {
    success: false,
    error: result.error || '生成SQL脚本失败'
  }
}

function generatePassword(params) {
  const length = params.length || 16
  const includeUppercase = params.include_uppercase !== false
  const includeLowercase = params.include_lowercase !== false
  const includeNumbers = params.include_numbers !== false
  const includeSymbols = params.include_symbols !== false
  
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const numbers = '0123456789'
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  let charset = ''
  if (includeUppercase) charset += uppercase
  if (includeLowercase) charset += lowercase
  if (includeNumbers) charset += numbers
  if (includeSymbols) charset += symbols
  
  if (charset.length === 0) {
    return { success: false, error: '至少需要选择一种字符类型' }
  }
  
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  return { 
    success: true, 
    password,
    length,
    includes: {
      uppercase: includeUppercase,
      lowercase: includeLowercase,
      numbers: includeNumbers,
      symbols: includeSymbols
    }
  }
}

function convertTimestamp(params) {
  if (params.timestamp) {
    let ts = params.timestamp
    if (ts < 1e12) ts *= 1000
    const date = new Date(ts)
    return {
      success: true,
      timestamp: params.timestamp,
      date: date.toLocaleDateString('zh-CN'),
      time: date.toLocaleTimeString('zh-CN'),
      datetime: date.toLocaleString('zh-CN'),
      iso: date.toISOString()
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
      input: params.date_string,
      timestamp_seconds: timestampSec,
      timestamp_milliseconds: timestampMs
    }
  }
  
  return { success: false, error: '请提供 timestamp 或 date_string 参数' }
}

function generateCron(params) {
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
    cron_expression: cronExpression,
    description,
    frequency,
    hour,
    minute
  }
}

function formatJson(params) {
  const jsonString = params.json_string
  const indent = params.indent || 2
  
  try {
    const parsed = JSON.parse(jsonString)
    const formatted = JSON.stringify(parsed, null, indent)
    return {
      success: true,
      formatted,
      original_length: jsonString.length,
      formatted_length: formatted.length,
      valid: true
    }
  } catch (e) {
    return {
      success: false,
      error: `JSON格式错误: ${e.message}`,
      valid: false
    }
  }
}

function validateYaml(params) {
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
    
    return {
      success: true,
      valid: errors.length === 0,
      errors,
      line_count: lines.length,
      message: errors.length === 0 ? 'YAML格式验证通过' : `发现 ${errors.length} 个潜在问题`
    }
  } catch (e) {
    return {
      success: false,
      error: `YAML验证失败: ${e.message}`
    }
  }
}

function getCurrentTime() {
  const now = new Date()
  return {
    success: true,
    date: now.toLocaleDateString('zh-CN'),
    time: now.toLocaleTimeString('zh-CN'),
    datetime: now.toLocaleString('zh-CN'),
    iso: now.toISOString(),
    timestamp_seconds: Math.floor(now.getTime() / 1000),
    timestamp_milliseconds: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}

function getProviderConfig() {
  const config = getConfig()
  const providerType = config.ai_provider || 'bailian'
  const apiKeys = config.ai_api_keys || {}
  
  const providerConfig = {
    apiKey: apiKeys[providerType] || ''
  }
  
  if (providerType === 'minimax') {
    providerConfig.groupId = apiKeys.minimax_group_id || ''
  }
  if (providerType === 'volcengine') {
    providerConfig.endpointId = apiKeys.volcengine_endpoint_id || ''
  }
  
  return { providerType, providerConfig }
}

async function chatWithToolsInternal(messages, options = {}) {
  const { providerType, providerConfig } = getProviderConfig()
  const provider = getProvider(providerType, providerConfig)
  
  if (!provider) {
    return { success: false, error: `未知的 AI Provider: ${providerType}` }
  }
  
  const validation = provider.validateConfig()
  if (!validation.valid) {
    return { success: false, error: `${provider.name} ${validation.error}，请在设置中配置` }
  }
  
  console.log('=== chatWithToolsInternal ===')
  console.log('Provider:', provider.name)
  console.log('Messages:', JSON.stringify(messages, null, 2))
  
  const model = options.model || provider.getDefaultModel()
  
  const result = await provider.chat(messages, tools, { model, ...options })
  
  if (!result.success) return result
  
  if (result.tool_calls && result.tool_calls.length > 0) {
    console.log('=== 检测到 tool_calls ===')
    console.log('tool_calls:', JSON.stringify(result.tool_calls, null, 2))
    
    messages.push({
      role: 'assistant',
      tool_calls: result.tool_calls
    })
    
    for (const call of result.tool_calls) {
      console.log('执行工具:', call.function.name)
      const toolResult = await executeToolCall(call.function.name, call.function.arguments)
      console.log('工具结果:', JSON.stringify(toolResult, null, 2))
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(toolResult)
      })
    }
    
    return await chatWithToolsInternal(messages, { model, ...options })
  }
  
  return result
}

async function chatWithTools(messages, options = {}) {
  console.log('=== chatWithTools 被调用 ===')
  console.log('原始 messages:', JSON.stringify(messages, null, 2))
  
  const messagesWithSystem = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages
  ]
  
  return chatWithToolsInternal(messagesWithSystem, options)
}

export async function chat(messages, options = {}) {
  console.log('=== chat 函数被调用 ===')
  console.log('messages:', JSON.stringify(messages, null, 2))
  console.log('options:', options)
  const result = await chatWithTools(messages, options)
  console.log('=== chat 返回结果 ===')
  console.log('result:', JSON.stringify(result, null, 2))
  return result
}

export async function validateApiKey(providerType, apiKey, extraConfig = {}) {
  console.log('=== validateApiKey ===')
  console.log('provider:', providerType)
  console.log('apiKey:', apiKey)
  console.log('extraConfig:', extraConfig)
  
  const config = {
    apiKey,
    ...extraConfig
  }
  
  const provider = getProvider(providerType, config)
  
  if (!provider) {
    log.warn(`未知的 Provider: ${providerType}`)
    return false
  }
  
  console.log('Provider apiKey:', provider.apiKey)
  const result = await provider.validateApiKey()
  console.log('验证结果:', result)
  return result
}

export { getAvailableProviders, getProviderModels, PROVIDER_TYPES, PROVIDER_INFO }