import { generateSQLFile } from '../../../services/generator.js'

export default async function handler(params, context) {
  const { log } = context
  
  log.info('执行 sql-script Skill', params)
  
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
      content: `SQL脚本已成功生成：${result.filename}`,
      metadata: {
        filename: result.filename,
        file_path: result.filePath,
        target_path: result.targetPath
      }
    }
  }
  
  return {
    success: false,
    error: result.error || '生成SQL脚本失败'
  }
}