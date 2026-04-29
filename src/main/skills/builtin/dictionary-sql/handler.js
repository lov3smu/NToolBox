export default async function handler(params, context) {
  const { log, executeDictionarySql } = context
  
  log.info('执行 dictionary-sql Skill', params)
  
  if (!executeDictionarySql) {
    return { success: false, error: 'executeDictionarySql 函数未提供' }
  }
  
  if (params.dict_list && params.dict_list.length > 0) {
    log.info('批量模式：生成多个字典', params.dict_list.length)
    const result = await executeDictionarySql(params)
    
    if (result.success) {
      return {
        success: true,
        content: result.message,
        metadata: {
          files: result.files,
          total_dicts: result.total_dicts,
          merge_strategy: result.merge_strategy,
          translations: result.translations
        }
      }
    }
    
    return {
      success: false,
      error: result.error
    }
  }
  
  if (params.dict_name && params.dict_values) {
    log.info('单字典模式')
    const result = await executeDictionarySql(params)
    
    if (result.success) {
      return {
        success: true,
        content: result.message,
        metadata: {
          filename: result.filename,
          file_path: result.file_path,
          translations: result.translations,
          sql_content: result.sql_content
        }
      }
    }
    
    return {
      success: false,
      error: result.error
    }
  }
  
  return {
    success: false,
    error: '缺少必要参数：需要 dict_list（批量）或 dict_name + dict_values（单字典）'
  }
}