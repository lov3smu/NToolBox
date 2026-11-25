export const SETTINGS_TAB_ITEMS = Object.freeze([
  {
    id: 'general',
    label: '通用',
    keywords: '常规 通用 general 启动 startup 语言 language 通知 notification 剪贴板 clipboard'
  },
  {
    id: 'appearance',
    label: '外观',
    keywords: '外观 主题 theme 主题风格 theme style 字号 font 字体 语言 language'
  },
  { id: 'shortcuts', label: '快捷键', keywords: '快捷键 shortcut keybinding 按键 录制' },
  { id: 'api', label: '模型', keywords: '模型 model api 服务商 provider 密钥 key 温度 temperature' },
  {
    id: 'assistant',
    label: 'AI 助手',
    keywords: 'ai 助手 assistant 人设 persona 温度 approval 审批 工具策略 场景模型'
  },
  { id: 'network', label: '网络', keywords: '网络 network 代理 proxy 镜像 mirror 更新源' },
  {
    id: 'database-client',
    label: '数据库客户端',
    keywords: '数据库 database 客户端 client sql 超时 timeout 查询 query 连接 connection'
  },
  { id: 'sql-generator', label: 'SQL 脚本生成', keywords: 'sql 脚本 script 生成 generator 模板 template' },
  {
    id: 'image-hosting',
    label: '图床配置',
    keywords: '图床 image hosting 上传 upload github 七牛 qiniu s3 cdn'
  },
  {
    id: 'extensions',
    label: '扩展管理',
    keywords: '扩展 extension 插件 plugin 技能 skill 连接器 connector mcp 市场 market'
  },
  { id: 'about', label: '关于', keywords: '关于 about 版本 version 更新 update 版权 copyright' }
])

export const SETTINGS_TAB_IDS = Object.freeze(SETTINGS_TAB_ITEMS.map((item) => item.id))
