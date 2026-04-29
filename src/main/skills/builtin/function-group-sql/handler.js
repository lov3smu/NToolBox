export default async function handler(params, context) {
  const { log, executeFunctionGroupSql } = context
  
  log.info('执行 function-group-sql Skill', params)
  
  if (!executeFunctionGroupSql) {
    return { success: false, error: 'executeFunctionGroupSql 函数未提供' }
  }
  
  const result = await executeFunctionGroupSql(params)
  
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