import path from 'path'
import fs from 'fs'
import { log } from '../utils'
import { getConfig } from './config'
import { getProvider } from './ai/index.js'
import { mkdirWithElevate } from '../utils/elevate'
import { sanitizePathSegment, isPathWithinBase, escapeSql } from '../utils/sanitize'

const DICTIONARY_TEMPLATE = {
  name: '字典配置',
  description: '生成字典表和字典数据表的初始化SQL',
  dictInsert: 'INSERT INTO `t_dictionary` (`dict_name`, `dict_value`, `remark`, `create_by`, `create_time`, `modify_by`, `modify_time`) VALUES (\'{{dict_name}}\', \'{{dict_value}}\', NULL, @author, NOW(), @author, NOW());',
  dictDataInsert: `INSERT INTO \`t_dictionary_data\` (\`dict_value\`, \`dict_data_name\`, \`dict_data_value\`, \`expression\`, \`status\`, \`sort\`, \`remark\`, \`create_by\`, \`create_time\`, \`modify_by\`, \`modify_time\`) VALUES 
{{dict_data_values}};`
}

const FUNCTION_GROUP_TEMPLATE = {
  name: '功能权限组',
  description: '生成功能权限组和功能权限的初始化SQL',
  parentQuery: 'SET @{{var_name}} = (SELECT id FROM t_function_group WHERE app_group=\'{{app_group}}\' AND code=\'{{parent_code}}\' LIMIT 1);',
  groupInsert: 'INSERT INTO `t_function_group` (`app_group`, `parent_id`, `group_level`, `sort`, `code`, `name`, `old_group_id`, `create_by`, `create_time`, `modify_by`, `modify_time`, `version`) VALUES (\'{{app_group}}\', {{parent_id}}, {{group_level}}, {{sort}}, \'{{code}}\', \'{{name}}\', 0, @author, NOW(), @author, NOW(), 1);',
  setIdAfterInsert: 'SET @{{var_name}} = LAST_INSERT_ID();',
  functionInsert: 'INSERT INTO `t_function` (`parent_id`, `function_number`, `function_name`, `is_sensitive`, `sort`, `status`, `create_by`, `create_time`, `modify_by`, `modify_time`, `version`) VALUES (@{{group_var}}, \'{{function_number}}\', \'{{function_name}}\', {{is_sensitive}}, {{sort}}, {{status}}, @author, NOW(), @author, NOW(), 1);'
}

const BUILTIN_TEMPLATES = {
  dictionary: DICTIONARY_TEMPLATE,
  function_group: FUNCTION_GROUP_TEMPLATE
}

async function translateToEnglish(texts) {
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
  
  const provider = getProvider(providerType, providerConfig)
  
  if (!provider) {
    throw new Error(`未知的 AI Provider: ${providerType}`)
  }
  
  const validation = provider.validateConfig()
  if (!validation.valid) {
    throw new Error(`${provider.name} ${validation.error}`)
  }
  
  const messages = [
    {
      role: 'system',
      content: '你是一个翻译助手。将中文翻译成适合用作数据库编码的英文标识符。规则：1. 使用下划线分隔单词；2. 全大写；3. 简洁准确；4. 直接返回翻译结果，不要解释。'
    },
    {
      role: 'user',
      content: `请将以下中文翻译成英文编码标识符（多个项目用换行分隔，每个项目只返回一个翻译结果）：
${texts.join('\n')}`
    }
  ]
  
  const result = await provider.chat(messages, [], { model: provider.getDefaultModel() })
  
  if (!result.success) {
    throw new Error(result.error || '翻译失败')
  }
  
  const translations = result.content.trim().split('\n').map(t => t.trim().toUpperCase().replace(/\s+/g, '_'))
  
  const translationMap = {}
  texts.forEach((text, index) => {
    if (translations[index]) {
      translationMap[text] = translations[index]
    } else {
      translationMap[text] = text.toUpperCase().replace(/\s+/g, '_')
    }
  })
  
  return translationMap
}

export async function generateDictionarySql(params) {
  const { dict_name, dict_values, database = 'main_db', operate_type = 'PUBLISH', dir_name, usage } = params
  
  if (!dict_name || !dict_values || dict_values.length === 0) {
    return { success: false, error: '缺少字典名称或字典值' }
  }
  
  const finalDatabase = database || 'main_db'
  
  try {
    log.info('开始生成字典配置SQL', params)
    
    const textsToTranslate = [dict_name, ...dict_values.map(v => v.name)]
    const translationMap = await translateToEnglish(textsToTranslate)
    
    const dictValue = translationMap[dict_name] || dict_name.toUpperCase().replace(/\s+/g, '_')
    const safeDictName = escapeSql(dict_name)
    const safeDictValue = escapeSql(dictValue)
    
    const dictDataValues = dict_values.map((item, index) => {
      const dataValue = translationMap[item.name] || item.name.toUpperCase().replace(/\s+/g, '_')
      const safeDataName = escapeSql(item.name)
      const safeDataValue = escapeSql(dataValue)
      const sort = item.sort || index + 1
      const status = item.status || 'EBL'
      return `('${safeDictValue}', '${safeDataName}', '${safeDataValue}', NULL, '${status}', ${sort}, NULL, @author, NOW(), @author, NOW())`
    }).join(',\n')
    
    const dictSql = DICTIONARY_TEMPLATE.dictInsert
      .replace('{{dict_name}}', safeDictName)
      .replace('{{dict_value}}', safeDictValue)
    
    const dictDataSql = DICTIONARY_TEMPLATE.dictDataInsert
      .replace('{{dict_data_values}}', dictDataValues)
    
    const fullSql = `${dictSql}\n${dictDataSql}`
    
    const config = getConfig()
    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentDate = now.toISOString().split('T')[0]
    
    const safeDirName = sanitizePathSegment(dir_name || `${currentDate.slice(5, 10).replace(/-/g, '')}-${usage || dict_name}`)
    const safeUsage = sanitizePathSegment(usage || dict_name)
    
    if (!safeDirName) {
      return { success: false, error: '目录名无效' }
    }
    
    let targetPath
    switch (operate_type) {
      case 'FIX':
        targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, safeDirName)
        break
      case 'PUBLISH':
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, safeDirName)
        break
      case 'QUERY':
        targetPath = path.join(config.base_path, 'DATA-QUERY', currentYear, safeDirName)
        break
      default:
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, safeDirName)
    }
    
    if (!isPathWithinBase(targetPath, config.base_path)) {
      return { success: false, error: '目标路径超出允许范围' }
    }
    
    await mkdirWithElevate(targetPath)
    
    const files = await fs.promises.readdir(targetPath)
    const sqlFiles = files.filter(f => f.endsWith('.sql'))
    let maxNumber = 0
    for (const f of sqlFiles) {
      const match = f.match(/^S(\d+)-/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }
    const nextNumber = maxNumber + 1
    const padWidth = Math.max(2, String(nextNumber).length)
    const sNumber = `S${String(nextNumber).padStart(padWidth, '0')}`
    
    const dateCompact = now.toISOString().slice(2, 10).replace(/-/g, '')
    const safeDevEnName = escapeSql(config.developer_en_name)
    const safeFilename = escapeSql(`${sNumber}-${currentDate}-DML-${finalDatabase}-${safeUsage}.sql`.replace(/\s/g, '_'))
    
    const scriptContent = `-- Please use UTF8 encoding without BOM
-- Script Usage: ${usage || dict_name} 字典配置初始化
-- Script Author: ${config.developer_ch_name}
-- Creation Time: ${currentDate}

USE \`${escapeSql(finalDatabase)}\`;

BEGIN;

SET @author = '${safeDevEnName}${dateCompact}';

${fullSql}

INSERT INTO t_script_history (scriptName, remark, create_by, modify_by, create_time, modify_time)
VALUES ('${safeFilename}', '${escapeSql(usage || dict_name)}', @author, @author, NOW(), NOW());

COMMIT;
`
    
    const filename = `${sNumber}-${currentDate}-DML-${finalDatabase}-${safeUsage}.sql`.replace(/\s/g, '_')
    const filePath = path.join(targetPath, filename)
    
    if (!isPathWithinBase(filePath, config.base_path)) {
      return { success: false, error: '文件路径超出允许范围' }
    }
    
    await fs.promises.writeFile(filePath, scriptContent, { encoding: 'utf8', flag: 'wx' })
    
    log.info('字典配置SQL生成成功', filePath)
    
    return {
      success: true,
      filename,
      file_path: filePath,
      target_path: targetPath,
      sql_content: fullSql,
      translations: translationMap,
      message: `字典配置SQL已成功生成：${filename}`
    }
  } catch (error) {
    log.error('生成字典配置SQL失败:', error)
    return { success: false, error: error.message }
  }
}

async function translateToPascalCase(texts) {
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
  
  const provider = getProvider(providerType, providerConfig)
  
  if (!provider) {
    throw new Error(`未知的 AI Provider: ${providerType}`)
  }
  
  const validation = provider.validateConfig()
  if (!validation.valid) {
    throw new Error(`${provider.name} ${validation.error}`)
  }
  
  const messages = [
    {
      role: 'system',
      content: '你是一个翻译助手。将中文翻译成适合用作数据库编码的英文标识符。规则：1. 使用大驼峰命名（PascalCase）；2. 每个单词首字母大写，无分隔符；3. 简洁准确；4. 直接返回翻译结果，不要解释，多个项目用换行分隔。'
    },
    {
      role: 'user',
      content: `请将以下中文翻译成英文编码标识符（大驼峰格式）：
${texts.join('\n')}`
    }
  ]
  
  const result = await provider.chat(messages, [], { model: provider.getDefaultModel() })
  
  if (!result.success) {
    throw new Error(result.error || '翻译失败')
  }
  
  const translations = result.content.trim().split('\n').map(t => t.trim())
  
  const translationMap = {}
  texts.forEach((text, index) => {
    if (translations[index]) {
      let translated = translations[index].replace(/\s+/g, '')
      if (translated[0]) {
        translated = translated[0].toUpperCase() + translated.slice(1)
      }
      translationMap[text] = translated
    } else {
      const words = text.split(/[\s_-]+/)
      translationMap[text] = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
    }
  })
  
  return translationMap
}

export async function generateFunctionGroupSql(params) {
  const { app_group, function_groups, database = 'user_db', operate_type = 'PUBLISH', dir_name, usage } = params
  
  if (!app_group || !function_groups || function_groups.length === 0) {
    return { success: false, error: '缺少应用代码或功能权限组数据' }
  }
  
  const finalDatabase = database || 'user_db'
  
  try {
    log.info('开始生成功能权限组SQL', params)
    
    const groupCodes = function_groups.map(g => g.code || g.name)
    const functionCodes = function_groups.flatMap(g => 
      (g.functions || []).map(f => f.code || f.name)
    )
    const allCodes = [...groupCodes, ...functionCodes]
    const translationMap = await translateToPascalCase(allCodes)
    
    const sqlStatements = []
    const groupVarMap = {}
    const parentVarMap = {}
    let groupIndex = 0
    
    const sortedGroups = [...function_groups].sort((a, b) => (a.level || 1) - (b.level || 1))
    
    for (const group of sortedGroups) {
      const groupCode = translationMap[group.code || group.name] || group.code || group.name
      const groupName = group.name || group.code
      const groupLevel = group.level || 1
      const sort = group.sort || (groupLevel === 1 ? 10 : 1000 + groupIndex * 10)
      
      const varName = `group_${groupIndex}_id`
      groupVarMap[group.code || group.name] = varName
      
      let parentIdValue
      if (groupLevel === 1 || !group.parent_code) {
        parentIdValue = '0'
      } else {
        const parentVarName = `parent_${groupIndex}_id`
        parentVarMap[group.code || group.name] = parentVarName
        
        const parentCodeTranslated = translationMap[group.parent_code] || group.parent_code
        
        sqlStatements.push(FUNCTION_GROUP_TEMPLATE.parentQuery
          .replace(/{{var_name}}/g, parentVarName)
          .replace(/{{app_group}}/g, escapeSql(app_group))
          .replace(/{{parent_code}}/g, escapeSql(parentCodeTranslated))
        )
        sqlStatements.push('')
        
        parentIdValue = `@${parentVarName}`
      }
      
      sqlStatements.push(FUNCTION_GROUP_TEMPLATE.groupInsert
        .replace(/{{app_group}}/g, escapeSql(app_group))
        .replace(/{{parent_id}}/g, parentIdValue)
        .replace(/{{group_level}}/g, groupLevel)
        .replace(/{{sort}}/g, sort)
        .replace(/{{code}}/g, escapeSql(groupCode))
        .replace(/{{name}}/g, escapeSql(groupName))
      )
      sqlStatements.push('')
      
      sqlStatements.push(FUNCTION_GROUP_TEMPLATE.setIdAfterInsert
        .replace(/{{var_name}}/g, varName)
      )
      sqlStatements.push('')
      
      if (group.functions && group.functions.length > 0) {
        for (const func of group.functions) {
          const funcCode = translationMap[func.code || func.name] || func.code || func.name
          const funcName = func.name || func.code
          const isSensitive = func.is_sensitive || 0
          const funcSort = func.sort || 0
          const status = func.status || 101001
          
          sqlStatements.push(FUNCTION_GROUP_TEMPLATE.functionInsert
            .replace(/{{group_var}}/g, varName)
            .replace(/{{function_number}}/g, escapeSql(funcCode))
            .replace(/{{function_name}}/g, escapeSql(funcName))
            .replace(/{{is_sensitive}}/g, isSensitive)
            .replace(/{{sort}}/g, funcSort)
            .replace(/{{status}}/g, status)
          )
          sqlStatements.push('')
        }
      }
      
      groupIndex++
    }
    
    const fullSql = sqlStatements.join('\n').trim()
    
    const config = getConfig()
    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentDate = now.toISOString().split('T')[0]
    
    const safeDirName = sanitizePathSegment(dir_name || `${currentDate.slice(5, 10).replace(/-/g, '')}-${usage || '功能权限配置'}`)
    const safeUsage = sanitizePathSegment(usage || '功能权限配置')
    
    if (!safeDirName) {
      return { success: false, error: '目录名无效' }
    }
    
    let targetPath
    switch (operate_type) {
      case 'FIX':
        targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, safeDirName)
        break
      case 'PUBLISH':
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, safeDirName)
        break
      case 'QUERY':
        targetPath = path.join(config.base_path, 'DATA-QUERY', currentYear, safeDirName)
        break
      default:
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, safeDirName)
    }
    
    if (!isPathWithinBase(targetPath, config.base_path)) {
      return { success: false, error: '目标路径超出允许范围' }
    }
    
    await mkdirWithElevate(targetPath)
    
    const files = await fs.promises.readdir(targetPath)
    const sqlFiles = files.filter(f => f.endsWith('.sql'))
    let maxNumber = 0
    for (const f of sqlFiles) {
      const match = f.match(/^S(\d+)-/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }
    const nextNumber = maxNumber + 1
    const padWidth = Math.max(2, String(nextNumber).length)
    const sNumber = `S${String(nextNumber).padStart(padWidth, '0')}`
    
    const dateCompact = now.toISOString().slice(2, 10).replace(/-/g, '')
    const safeDevEnName = escapeSql(config.developer_en_name)
    const safeFilename = escapeSql(`${sNumber}-${currentDate}-DML-${finalDatabase}-${safeUsage}.sql`.replace(/\s/g, '_'))
    
    const scriptContent = `-- Please use UTF8 encoding without BOM
-- Script Usage: ${usage || '功能权限配置初始化'}
-- Script Author: ${config.developer_ch_name}
-- Creation Time: ${currentDate}

USE \`${escapeSql(finalDatabase)}\`;

BEGIN;

SET @author = '${safeDevEnName}${dateCompact}';

${fullSql}

INSERT INTO t_script_history (scriptName, remark, create_by, modify_by, create_time, modify_time)
VALUES ('${safeFilename}', '${escapeSql(usage || '功能权限配置')}', @author, @author, NOW(), NOW());

COMMIT;
`
    
    const filename = `${sNumber}-${currentDate}-DML-${finalDatabase}-${safeUsage}.sql`.replace(/\s/g, '_')
    const filePath = path.join(targetPath, filename)
    
    if (!isPathWithinBase(filePath, config.base_path)) {
      return { success: false, error: '文件路径超出允许范围' }
    }
    
    await fs.promises.writeFile(filePath, scriptContent, { encoding: 'utf8', flag: 'wx' })
    
    log.info('功能权限组SQL生成成功', filePath)
    
    return {
      success: true,
      filename,
      file_path: filePath,
      target_path: targetPath,
      sql_content: fullSql,
      translations: translationMap,
      message: `功能权限组SQL已成功生成：${filename}`
    }
  } catch (error) {
    log.error('生成功能权限组SQL失败:', error)
    return { success: false, error: error.message }
  }
}

export { BUILTIN_TEMPLATES }