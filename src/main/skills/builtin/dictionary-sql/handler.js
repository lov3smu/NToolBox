import { generateDictionarySql } from '../../../services/templateGenerator.js'

export default async function handler(params, context) {
  const { log } = context
  
  log.info('执行 dictionary-sql Skill', params)
  
  const result = await generateDictionarySql(params)
  
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