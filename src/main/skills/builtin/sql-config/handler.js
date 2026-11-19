export default function handler(params, context) {
  const { getConfig } = context
  const config = getConfig()
  const databases = config.sql_generator.databases || []
  const scriptTypes = (config.sql_generator.script_types || []).map((st) => ({
    name: st.name,
    description: st.description
  }))

  return {
    success: true,
    content: `配置信息：
数据库列表：${databases.join(', ') || '无'}
脚本类型：${scriptTypes.map((st) => st.name).join(', ') || '无'}
开发者：${config.app.developer.ch_name} (${config.app.developer.en_name})`,
    metadata: {
      databases,
      script_types: scriptTypes,
      operate_types: [
        { name: 'FIX', description: '修复脚本' },
        { name: 'PUBLISH', description: '发布脚本' },
        { name: 'QUERY', description: '查询脚本' }
      ],
      developer: {
        ch_name: config.app.developer.ch_name,
        en_name: config.app.developer.en_name
      }
    }
  }
}
