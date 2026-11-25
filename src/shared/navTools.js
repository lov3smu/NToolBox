export const SETTINGS_PATH = '/settings'
export const MARKET_PATH = '/market'

export const MENU_GROUP_ORDER = Object.freeze(['primary', 'file', 'dev', 'content', 'system', 'extensions', 'settings'])

export const MENU_GROUP_LABELS = Object.freeze({
  primary: '核心',
  file: '文件',
  dev: '开发工具',
  content: '文本与内容',
  system: '系统与资源',
  extensions: '扩展',
  settings: '设置'
})

const MENU_GROUP_ALIASES = Object.freeze({
  primary: '核心 core 常用',
  file: '文件 file 目录',
  dev: '开发 开发工具 dev developer 转换 解析 调试',
  content: '文本 内容 创作 content text 写作',
  system: '系统 资源 system 效率',
  extensions: '扩展 市场 extension market',
  settings: '设置 settings 配置'
})

export const tools = [
  {
    name: '首页',
    description: '工具集首页',
    path: '/',
    keywords: '主页 概览 home dashboard 开始',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`,
    menuGroup: 'file'
  },
  {
    name: 'SQL脚本生成',
    description: '快速生成规范化的SQL脚本文件',
    path: '/sql-generator',
    keywords: 'sql 脚本 script ddl dml 迁移 migration 生成 generate',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`,
    menuGroup: 'primary',
    trayGroup: 'tools'
  },
  {
    name: 'AI助手',
    description: '多模型 Agent 对话与工具调用',
    path: '/chat',
    keywords: 'ai 助手 assistant 对话 chat agent 大模型 llm 工具调用',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`,
    menuGroup: 'primary',
    trayGroup: 'top'
  },
  {
    name: '外挂知识库',
    description: '管理与检索 AI 可引用的本地资料',
    path: '/memory',
    keywords: '记忆 memory 知识库 knowledge rag 检索 资料',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-1 5.8A3.5 3.5 0 0 0 8 16.5V18a3 3 0 0 0 4 2.8"/>
      <path d="M12 5a3 3 0 0 1 6 0 3 3 0 0 1 1 5.8 3.5 3.5 0 0 1-3 5.7V18a3 3 0 0 1-4 2.8"/>
      <path d="M12 5v16"/>
      <path d="M9 9h.01M15 9h.01M9.5 13h.01M14.5 13h.01"/>
    </svg>`,
    menuGroup: 'primary',
    hidden: true
  },
  {
    name: '密码管理',
    description: '加密保存分组密码与登录信息',
    path: '/password-manager',
    keywords: '密码 password 保险库 vault 凭据 credential 登录 login 加密',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 3 5 6v5.5c0 4.6 2.9 7.6 7 9.5 4.1-1.9 7-4.9 7-9.5V6l-7-3z"/>
      <circle cx="12" cy="10" r="1.8"/>
      <path d="M12 11.8V15"/>
    </svg>`,
    menuGroup: 'system',
    trayGroup: 'tools'
  },
  {
    name: '项目与环境',
    description: '按项目维护环境变量，集中管理密钥别名',
    path: '/profiles',
    keywords: '项目 project 环境 environment profile 变量 variable 凭据 credential 密钥 secret 别名 alias',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="7" height="7" rx="1.5"/>
      <rect x="14" y="4" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      <path d="M14 17.5h7"/>
      <path d="M17.5 14v7"/>
    </svg>`,
    menuGroup: 'system',
    trayGroup: 'tools'
  },
  {
    name: 'Cron表达式生成器',
    description: '可视化生成定时任务表达式',
    path: '/cron',
    keywords: 'cron 定时 schedule 任务 task 表达式 计划',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: '时间戳转换',
    description: 'Unix时间戳与日期互转',
    path: '/unixtimestamp',
    keywords: '时间戳 timestamp unix 日期 date 时间 time 转换',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: 'YAML编辑器',
    description: 'YAML格式编辑与校验',
    path: '/yaml-editor',
    keywords: 'yaml yml 配置 config 校验 validate 格式',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: '文件管理器',
    description: '便捷的文件管理工具',
    path: '/file-manager',
    keywords: '文件 file 目录 folder 浏览 explorer 管理',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>`,
    menuGroup: 'file',
    trayGroup: 'top'
  },
  {
    name: '图片浏览器',
    description: '浏览本地图片，支持缩放、平移与旋转',
    path: '/image-viewer',
    keywords: '图片 image 照片 photo 浏览 viewer 缩放 zoom',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <path d="m21 15-5-5L5 21"/>
    </svg>`,
    menuGroup: 'file'
  },
  {
    name: '图床',
    description: '图片上传到 GitHub、七牛云等图床',
    path: '/image-hosting',
    keywords: '图床 image host 上传 upload cdn github 七牛 图片',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 16V4"/>
      <path d="m7 9 5-5 5 5"/>
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
    </svg>`,
    menuGroup: 'system',
    trayGroup: 'tools'
  },
  {
    name: 'Markdown编辑器',
    description: 'Markdown 实时预览与主题定制',
    path: '/markdown-editor',
    keywords: 'markdown md 文档 doc 预览 preview 写作',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M7 16v-5l2.5 3L12 11v5"/>
      <path d="M16 12v4M14.5 14.5 16 16l1.5-1.5"/>
    </svg>`,
    menuGroup: 'content',
    trayGroup: 'tools'
  },
  {
    name: '公众号文章排版',
    description: 'Markdown 一键排版并复制到公众号',
    path: '/wechat-formatter',
    keywords: '公众号 wechat 微信 排版 format markdown 文章',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M7 8h10M7 12h6M7 16h8"/>
    </svg>`,
    menuGroup: 'content',
    trayGroup: 'tools'
  },
  {
    name: '剪贴板管理',
    description: '记录并管理剪贴板文本与图片',
    path: '/clipboard',
    keywords: '剪贴板 clipboard 复制 copy 粘贴 paste 历史 history',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M8 11h8M8 15h5"/>
    </svg>`,
    menuGroup: 'system',
    trayGroup: 'tools'
  },
  {
    name: '暂存架',
    description: '临时收集各工具内容，再发送到任意工具',
    path: '/staging',
    keywords: '暂存 staging shelf 收集 collect 中转 剪贴板 clipboard 送出 send',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="21 8 21 21 3 21 3 8"/>
      <rect x="1" y="3" width="22" height="5"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
    </svg>`,
    menuGroup: 'content',
    trayGroup: 'tools'
  },
  {
    name: '链式 Recipe',
    description: '把编码转换与文本处理串联成可复用的处理链',
    path: '/recipes',
    keywords: 'recipe 链 chain 流程 pipeline 编码 codec 文本处理 transform 批量',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="6" height="6" rx="1"/>
      <rect x="15" y="15" width="6" height="6" rx="1"/>
      <path d="M9 6h6a3 3 0 0 1 3 3v6"/>
    </svg>`,
    menuGroup: 'content',
    trayGroup: 'tools'
  },
  {
    name: '计划任务',
    description: '定时执行 HTTP 请求、Recipe 与剪贴板清理',
    path: '/scheduled-tasks',
    keywords: '计划任务 schedule cron 定时 timer 自动 automatic 后台 background',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>`,
    menuGroup: 'system',
    trayGroup: 'tools'
  },
  {
    name: 'JSON解析器',
    description: 'JSON格式化与校验工具',
    path: '/json-parser',
    keywords: 'json 格式化 format 校验 validate 美化 beautify 解析',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <polyline points="4 17 4 20 20 20 20 17"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: 'HTML查看器',
    description: 'HTML代码实时预览',
    path: '/html-viewer',
    keywords: 'html 预览 preview 网页 web 代码',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: '文本工具箱',
    description: '大小写、行处理与空白清理',
    path: '/text-toolbox',
    keywords: '文本 text 大小写 case 行 lines 空白 清理',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M4 7V4h16v3"/>
      <path d="M9 20h6"/>
      <path d="M12 4v16"/>
      <path d="M17 14h4"/>
      <path d="M19 12v4"/>
    </svg>`,
    menuGroup: 'content',
    trayGroup: 'tools'
  },
  {
    name: '文本对比',
    description: '按行比较两段文本差异',
    path: '/text-diff',
    keywords: '对比 diff 比较 compare 差异 文本',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="7" height="16" rx="1"/>
      <rect x="14" y="4" width="7" height="16" rx="1"/>
      <path d="M6 9h1M6 13h1M17 9h1M17 13h1"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: '正则测试器',
    description: '实时验证表达式与匹配结果',
    path: '/regex-tester',
    keywords: '正则 regex 表达式 匹配 match 测试',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 3v10"/>
      <path d="m12.67 5.5 8.66 5"/>
      <path d="m12.67 10.5 8.66-5"/>
      <circle cx="7" cy="17" r="2"/>
      <path d="M7 19v2"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: '编码转换',
    description: 'Base64、URL、HTML、Hex 与 JSON 互转',
    path: '/codec',
    keywords: '编码 encoding 解码 decode base64 url hex 转码 转换',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m16 3 4 4-4 4"/>
      <path d="M20 7H4"/>
      <path d="m8 21-4-4 4-4"/>
      <path d="M4 17h16"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: 'HTTP 客户端',
    description: '发送 HTTP 请求并查看响应',
    path: '/http-client',
    keywords: 'http 请求 request api rest 接口 调试 postman',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>`,
    menuGroup: 'dev',
    trayGroup: 'tools'
  },
  {
    name: '活动时间线',
    description: '聚合查询、上传、备份、AI 运行与文件改动',
    path: '/activity',
    keywords: '活动 activity 时间线 timeline 审计 audit 历史 history 记录',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 16 14"/>
    </svg>`,
    menuGroup: 'system',
    trayGroup: 'tools'
  },
  {
    name: '模板中心',
    description: '可复用的文档、配置与数据模板',
    path: '/template-center',
    keywords: '模板 template 片段 snippet 复用 文档 配置',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="7" rx="1"/>
      <rect x="3" y="14" width="8" height="7" rx="1"/>
      <rect x="13" y="14" width="8" height="7" rx="1"/>
    </svg>`,
    menuGroup: 'content'
  },
  {
    name: '系统工具',
    description: '监听端口、进程占用与 SSL 证书检查',
    path: '/system-tools',
    keywords: '系统 system 端口 port 进程 process ssl 证书 certificate 诊断',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="7" rx="2"/>
      <rect x="3" y="13" width="18" height="7" rx="2"/>
      <path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>
    </svg>`,
    menuGroup: 'system',
    trayGroup: 'tools'
  },
  {
    name: '数据库客户端',
    description: 'MySQL、PostgreSQL、SQLite 连接、查询、ER 图与数据传输',
    path: '/database',
    keywords: '数据库 database mysql postgres postgresql pg sqlite sql 查询 query 表 table 连接 connection 引擎 engine',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>`,
    menuGroup: 'primary',
    trayGroup: 'tools'
  },
  {
    name: '扩展',
    description: '插件、技能与连接器市场',
    path: MARKET_PATH,
    keywords: '扩展 extension 插件 plugin 技能 skill 连接器 connector mcp 市场 market',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 9h18l-1.5 11.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5z"/>
      <path d="M3 9l2-5h14l2 5"/>
      <path d="M9 13a3 3 0 0 0 6 0"/>
    </svg>`,
    menuGroup: 'extensions'
  },
  {
    name: '设置',
    description: '应用程序配置',
    path: SETTINGS_PATH,
    keywords: '设置 settings 偏好 preference 配置 config 主题 theme 语言 language',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
    shortcutKey: 'settings',
    accelerator: 'CmdOrCtrl+,',
    menuGroup: 'settings'
  }
]

export const visibleTools = tools.filter((tool) => !tool.hidden)

export const dashboardTools = visibleTools.filter((tool) => tool.path !== '/' && tool.menuGroup !== 'extensions')

const SPLIT_EXCLUDED_PATHS = new Set(['/', SETTINGS_PATH, MARKET_PATH, '/chat', '/database'])

export const splitTools = visibleTools.filter((tool) => !SPLIT_EXCLUDED_PATHS.has(tool.path))

export function isSplitTool(path) {
  return splitTools.some((tool) => tool.path === path)
}

export function normalizeSplitPath(value) {
  return typeof value === 'string' && isSplitTool(value) ? value : ''
}

export const RECENT_TOOLS_KEY = 'recent_tools'
export const MAX_RECENT = 4

export const RECENT_TOOLS_LIMIT_OPTIONS = Object.freeze(
  [2, 3, 4, 5, 6, 8].map((value) => ({
    value,
    label: value === MAX_RECENT ? '{p0} 个（默认）' : '{p0} 个',
    hint: '首页「最近使用」最多保留 {p0} 个工具'
  }))
)

export const RECENT_TOOLS_LIMIT_MIN = 2
export const RECENT_TOOLS_LIMIT_MAX = 8

export function normalizeRecentToolsLimit(value) {
  if (value === null || value === undefined || value === '') return MAX_RECENT
  const num = Number(value)
  if (!Number.isFinite(num)) return MAX_RECENT
  return Math.min(RECENT_TOOLS_LIMIT_MAX, Math.max(RECENT_TOOLS_LIMIT_MIN, Math.round(num)))
}

let activeRecentLimit = MAX_RECENT

export function setRecentToolsLimit(limit) {
  activeRecentLimit = normalizeRecentToolsLimit(limit)
}

export function getRecentToolsLimit() {
  return activeRecentLimit
}

export function getRecentTools() {
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]')
    if (!Array.isArray(recent)) return []
    return recent
      .filter((path) => path !== '/')
      .slice(0, activeRecentLimit)
      .map((path) => tools.find((tool) => tool.path === path))
      .filter((tool) => Boolean(tool) && tool.menuGroup !== 'extensions' && !tool.hidden)
  } catch {
    return []
  }
}

export function addToRecent(tool) {
  if (!tool || tool.path === '/' || tool.menuGroup === 'extensions' || tool.hidden) return
  try {
    let recent = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]')
    if (!Array.isArray(recent)) recent = []
    recent = recent.filter((path) => path !== tool.path)
    recent.unshift(tool.path)
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(recent.slice(0, activeRecentLimit)))
  } catch {
    // ignore storage failures
  }
}

export function getToolByPath(path) {
  return tools.find((tool) => tool.path === path)
}

export function getToolsByMenuGroup(group) {
  return visibleTools.filter((tool) => tool.menuGroup === group)
}

export function getTrayTopTools() {
  return tools.filter((tool) => tool.trayGroup === 'top')
}

export function getTrayTools() {
  return tools.filter((tool) => tool.trayGroup === 'tools')
}

export function getToolAccelerator(tool, shortcuts = {}) {
  if (tool.shortcutKey && typeof shortcuts[tool.shortcutKey] === 'string') {
    return shortcuts[tool.shortcutKey]
  }
  return tool.accelerator
}

export function getToolSearchText(tool) {
  return [
    tool.name,
    tool.description,
    tool.keywords,
    tool.path,
    MENU_GROUP_LABELS[tool.menuGroup],
    MENU_GROUP_ALIASES[tool.menuGroup]
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function searchTools(query) {
  const tokens = String(query || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (!tokens.length) return visibleTools
  return visibleTools.filter((tool) => {
    const haystack = getToolSearchText(tool)
    return tokens.every((token) => haystack.includes(token))
  })
}
