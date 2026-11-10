import path from 'path'
import fs from 'fs'
import { log } from '../utils'
import { getConfig } from './config'
import { getProvider, resolveProviderModels, resolveProviderDefaultModel } from './ai/index.js'
import { mkdirWithElevate } from '../utils/elevate'
import { sanitizePathSegment, isPathWithinBase, escapeSql, normalizeDirNameWithDate } from '../utils/sanitize'

import { BUILTIN_TEMPLATES, buildDictionaryStatements, buildFunctionGroupStatements } from './templateBuilder.js'

async function translateToEnglish(texts) {
  const config = getConfig()
  const providerType = config.ai_provider || 'bailian'
  const apiKeys = config.ai_api_keys || {}

  const providerConfig = {
    apiKey: apiKeys[providerType] || '',
    models: resolveProviderModels(providerType, config.ai_models),
    defaultModel: resolveProviderDefaultModel(providerType, config.ai_models, apiKeys.volcengine_endpoint_id || '')
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
      content:
        '你是一个翻译助手。将中文翻译成适合用作数据库编码的英文标识符。规则：1. 使用下划线分隔单词；2. 全大写；3. 简洁准确；4. 直接返回翻译结果，不要解释。'
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

  const translations = result.content
    .trim()
    .split('\n')
    .map((t) => t.trim().toUpperCase().replace(/\s+/g, '_'))

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

    const textsToTranslate = [dict_name, ...dict_values.map((v) => v.name)]
    const translationMap = await translateToEnglish(textsToTranslate)
    const { sql: fullSql } = buildDictionaryStatements(dict_name, dict_values, translationMap)

    const config = getConfig()
    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentDate = now.toISOString().split('T')[0]

    const defaultDirName = `${currentDate.slice(5, 10).replace(/-/g, '')}-${usage || dict_name}`
    const rawDirName = dir_name || defaultDirName
    const safeDirName = sanitizePathSegment(rawDirName)
    const normalizedDirName = normalizeDirNameWithDate(safeDirName, now)
    const safeUsage = sanitizePathSegment(usage || dict_name)

    if (!safeDirName) {
      return { success: false, error: '目录名无效' }
    }

    let targetPath
    switch (operate_type) {
      case 'FIX':
        targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, normalizedDirName)
        break
      case 'PUBLISH':
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, normalizedDirName)
        break
      case 'QUERY':
        targetPath = path.join(config.base_path, 'DATA-QUERY', currentYear, normalizedDirName)
        break
      default:
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, normalizedDirName)
    }

    if (!isPathWithinBase(targetPath, config.base_path)) {
      return { success: false, error: '目标路径超出允许范围' }
    }

    await mkdirWithElevate(targetPath)

    const files = await fs.promises.readdir(targetPath)
    const sqlFiles = files.filter((f) => f.endsWith('.sql'))
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
    const safeFilename = escapeSql(
      `${sNumber}-${currentDate}-DML-${finalDatabase}-${safeUsage}.sql`.replace(/\s/g, '_')
    )

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

async function generateDictionarySqlBatch(params) {
  const { dict_list, database = 'main_db', operate_type = 'PUBLISH', dir_name, usage, merge_strategy = 'auto' } = params

  if (!dict_list || dict_list.length === 0) {
    return { success: false, error: '缺少字典列表' }
  }

  const finalDatabase = database || 'main_db'

  try {
    log.info('开始批量生成字典配置SQL', { count: dict_list.length, merge_strategy })

    const allTextsToTranslate = dict_list.flatMap((dict) => [dict.dict_name, ...dict.dict_values.map((v) => v.name)])
    const translationMap = await translateToEnglish(allTextsToTranslate)

    const dictSqlResults = dict_list.map((dict) => ({
      dict_name: dict.dict_name,
      ...buildDictionaryStatements(dict.dict_name, dict.dict_values, translationMap)
    }))

    const config = getConfig()
    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentDate = now.toISOString().split('T')[0]

    const defaultDirName = `${currentDate.slice(5, 10).replace(/-/g, '')}-${usage || '字典配置'}`
    const rawDirName = dir_name || defaultDirName
    const safeDirName = sanitizePathSegment(rawDirName)
    const normalizedDirName = normalizeDirNameWithDate(safeDirName, now)

    if (!safeDirName) {
      return { success: false, error: '目录名无效' }
    }

    let targetPath
    switch (operate_type) {
      case 'FIX':
        targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, normalizedDirName)
        break
      case 'PUBLISH':
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, normalizedDirName)
        break
      case 'QUERY':
        targetPath = path.join(config.base_path, 'DATA-QUERY', currentYear, normalizedDirName)
        break
      default:
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, normalizedDirName)
    }

    if (!isPathWithinBase(targetPath, config.base_path)) {
      return { success: false, error: '目标路径超出允许范围' }
    }

    await mkdirWithElevate(targetPath)

    const files = await fs.promises.readdir(targetPath)
    const sqlFiles = files.filter((f) => f.endsWith('.sql'))
    let maxNumber = 0
    for (const f of sqlFiles) {
      const match = f.match(/^S(\d+)-/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) maxNumber = num
      }
    }

    const dateCompact = now.toISOString().slice(2, 10).replace(/-/g, '')
    const safeDevEnName = escapeSql(config.developer_en_name)

    const filesToCreate = []
    let actualMergeStrategy = merge_strategy

    if (merge_strategy === 'auto') {
      if (dict_list.length === 1) {
        actualMergeStrategy = 'separate'
      } else if (dict_list.length <= 3 && safeDirName.includes('-')) {
        actualMergeStrategy = 'merge'
      } else if (dict_list.length > 5) {
        actualMergeStrategy = 'separate'
      } else {
        actualMergeStrategy = 'merge'
      }
      log.info(`自动合并策略分析：${dict_list.length}个字典，目录=${safeDirName}，决定=${actualMergeStrategy}`)
    }

    if (actualMergeStrategy === 'merge') {
      const combinedSql = dictSqlResults.map((r) => r.sql).join('\n\n')
      const combinedNames = dictSqlResults.map((r) => r.dict_name).join('-')
      const safeCombinedNames = sanitizePathSegment(combinedNames)

      const nextNumber = maxNumber + 1
      const padWidth = Math.max(2, String(nextNumber).length)
      const sNumber = `S${String(nextNumber).padStart(padWidth, '0')}`
      const filename = `${sNumber}-${currentDate}-DML-${finalDatabase}-${safeCombinedNames}.sql`.replace(/\s/g, '_')
      const filePath = path.join(targetPath, filename)

      if (!isPathWithinBase(filePath, config.base_path)) {
        return { success: false, error: '文件路径超出允许范围' }
      }

      const safeFilename = escapeSql(filename)
      const scriptContent = `-- Please use UTF8 encoding without BOM
-- Script Usage: ${usage || combinedNames} 字典配置初始化
-- Script Author: ${config.developer_ch_name}
-- Creation Time: ${currentDate}

USE \`${escapeSql(finalDatabase)}\`;

BEGIN;

SET @author = '${safeDevEnName}${dateCompact}';

${combinedSql}

INSERT INTO t_script_history (scriptName, remark, create_by, modify_by, create_time, modify_time)
VALUES ('${safeFilename}', '${escapeSql(usage || combinedNames)}', @author, @author, NOW(), NOW());

COMMIT;
`

      filesToCreate.push({
        filename,
        filePath,
        content: scriptContent,
        dict_names: dictSqlResults.map((r) => r.dict_name)
      })
    } else {
      for (let i = 0; i < dictSqlResults.length; i++) {
        const dictResult = dictSqlResults[i]
        const nextNumber = maxNumber + i + 1
        const padWidth = Math.max(2, String(nextNumber).length)
        const sNumber = `S${String(nextNumber).padStart(padWidth, '0')}`
        const safeDictNameFile = sanitizePathSegment(dictResult.dict_name)
        const filename = `${sNumber}-${currentDate}-DML-${finalDatabase}-${safeDictNameFile}.sql`.replace(/\s/g, '_')
        const filePath = path.join(targetPath, filename)

        if (!isPathWithinBase(filePath, config.base_path)) {
          return { success: false, error: '文件路径超出允许范围' }
        }

        const safeFilename = escapeSql(filename)
        const scriptContent = `-- Please use UTF8 encoding without BOM
-- Script Usage: ${dictResult.dict_name} 字典配置初始化
-- Script Author: ${config.developer_ch_name}
-- Creation Time: ${currentDate}

USE \`${escapeSql(finalDatabase)}\`;

BEGIN;

SET @author = '${safeDevEnName}${dateCompact}';

${dictResult.sql}

INSERT INTO t_script_history (scriptName, remark, create_by, modify_by, create_time, modify_time)
VALUES ('${safeFilename}', '${escapeSql(dictResult.dict_name)}', @author, @author, NOW(), NOW());

COMMIT;
`

        filesToCreate.push({
          filename,
          filePath,
          content: scriptContent,
          dict_names: [dictResult.dict_name]
        })
      }
    }

    const createdFiles = []
    for (const fileInfo of filesToCreate) {
      await fs.promises.writeFile(fileInfo.filePath, fileInfo.content, {
        encoding: 'utf8',
        flag: 'wx'
      })
      log.info('字典配置SQL文件创建成功', fileInfo.filePath)
      createdFiles.push({
        filename: fileInfo.filename,
        file_path: fileInfo.filePath,
        dict_names: fileInfo.dict_names
      })
    }

    const fileSummary = createdFiles.map((f) => `${f.filename} (${f.dict_names.join(', ')})`).join('\n')
    const message = `批量字典配置SQL已成功生成 ${createdFiles.length} 个文件（合并策略：${actualMergeStrategy}）：\n${fileSummary}`

    return {
      success: true,
      files: createdFiles,
      total_dicts: dict_list.length,
      merge_strategy: actualMergeStrategy,
      translations: translationMap,
      message
    }
  } catch (error) {
    log.error('批量生成字典配置SQL失败:', error)
    return { success: false, error: error.message }
  }
}

async function translateToPascalCase(texts) {
  const config = getConfig()
  const providerType = config.ai_provider || 'bailian'
  const apiKeys = config.ai_api_keys || {}

  const providerConfig = {
    apiKey: apiKeys[providerType] || '',
    models: resolveProviderModels(providerType, config.ai_models),
    defaultModel: resolveProviderDefaultModel(providerType, config.ai_models, apiKeys.volcengine_endpoint_id || '')
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
      content:
        '你是一个翻译助手。将中文翻译成适合用作数据库编码的英文标识符。规则：1. 使用大驼峰命名（PascalCase）；2. 每个单词首字母大写，无分隔符；3. 简洁准确；4. 直接返回翻译结果，不要解释，多个项目用换行分隔。'
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

  const translations = result.content
    .trim()
    .split('\n')
    .map((t) => t.trim())

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
      translationMap[text] = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
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

    const groupCodes = function_groups.map((g) => g.code || g.name)
    const functionCodes = function_groups.flatMap((g) => (g.functions || []).map((f) => f.code || f.name))
    const allCodes = [...groupCodes, ...functionCodes]
    const translationMap = await translateToPascalCase(allCodes)

    const fullSql = buildFunctionGroupStatements(app_group, function_groups, translationMap)

    const config = getConfig()
    const now = new Date()
    const currentYear = now.getFullYear().toString()
    const currentDate = now.toISOString().split('T')[0]

    const defaultDirName = `${currentDate.slice(5, 10).replace(/-/g, '')}-${usage || '功能权限配置'}`
    const rawDirName = dir_name || defaultDirName
    const safeDirName = sanitizePathSegment(rawDirName)
    const normalizedDirName = normalizeDirNameWithDate(safeDirName, now)
    const safeUsage = sanitizePathSegment(usage || '功能权限配置')

    if (!safeDirName) {
      return { success: false, error: '目录名无效' }
    }

    let targetPath
    switch (operate_type) {
      case 'FIX':
        targetPath = path.join(config.base_path, 'PRODUCT-FIX', currentYear, normalizedDirName)
        break
      case 'PUBLISH':
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, normalizedDirName)
        break
      case 'QUERY':
        targetPath = path.join(config.base_path, 'DATA-QUERY', currentYear, normalizedDirName)
        break
      default:
        targetPath = path.join(config.base_path, 'PUBLISH', currentYear, normalizedDirName)
    }

    if (!isPathWithinBase(targetPath, config.base_path)) {
      return { success: false, error: '目标路径超出允许范围' }
    }

    await mkdirWithElevate(targetPath)

    const files = await fs.promises.readdir(targetPath)
    const sqlFiles = files.filter((f) => f.endsWith('.sql'))
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
    const safeFilename = escapeSql(
      `${sNumber}-${currentDate}-DML-${finalDatabase}-${safeUsage}.sql`.replace(/\s/g, '_')
    )

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

export { BUILTIN_TEMPLATES, generateDictionarySqlBatch }
