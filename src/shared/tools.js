export const SETTINGS_PATH = '/settings'
export const MARKET_PATH = '/market'

export const tools = [
  {
    name: '首页',
    description: '工具集首页',
    path: '/',
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
    description: '多模态对话与 Agent 工具调用',
    path: '/chat',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>`,
    menuGroup: 'primary',
    trayGroup: 'top'
  },
  {
    name: '密码生成器',
    description: '生成安全的随机密码',
    path: '/password',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: 'Cron表达式生成器',
    description: '可视化生成定时任务表达式',
    path: '/cron',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: '时间戳转换',
    description: 'Unix时间戳与日期互转',
    path: '/unixtimestamp',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: 'YAML编辑器',
    description: 'YAML格式编辑与校验',
    path: '/yaml-editor',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: '文件管理器',
    description: '便捷的文件管理工具',
    path: '/file-manager',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>`,
    menuGroup: 'file',
    trayGroup: 'top'
  },
  {
    name: 'Markdown编辑器',
    description: 'Markdown 实时预览与主题定制',
    path: '/markdown-editor',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M7 16v-5l2.5 3L12 11v5"/>
      <path d="M16 12v4M14.5 14.5 16 16l1.5-1.5"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: '公众号文章排版',
    description: 'Markdown 一键排版并复制到公众号',
    path: '/wechat-formatter',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <path d="M7 8h10M7 12h6M7 16h8"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: '剪切板管理',
    description: '记录并管理剪贴板文本与图片',
    path: '/clipboard',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="8" y="2" width="8" height="4" rx="1"/>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <path d="M8 11h8M8 15h5"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: 'JSON解析器',
    description: 'JSON格式化与校验工具',
    path: '/json-parser',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <polyline points="4 17 4 20 20 20 20 17"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: 'HTML查看器',
    description: 'HTML代码实时预览',
    path: '/html-viewer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>`,
    menuGroup: 'utilities',
    trayGroup: 'tools'
  },
  {
    name: '数据库管理',
    description: 'MySQL数据库连接与管理',
    path: '/database',
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
    description: '发现并安装技能扩展',
    path: MARKET_PATH,
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
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`,
    shortcutKey: 'settings',
    accelerator: 'CmdOrCtrl+,',
    menuGroup: 'settings'
  }
]

export const dashboardTools = tools.filter((tool) => tool.path !== '/' && tool.menuGroup !== 'extensions')

export const RECENT_TOOLS_KEY = 'recent_tools'
export const MAX_RECENT = 4

export function getRecentTools() {
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]')
    if (!Array.isArray(recent)) return []
    return recent
      .filter((path) => path !== '/')
      .slice(0, MAX_RECENT)
      .map((path) => tools.find((tool) => tool.path === path))
      .filter((tool) => Boolean(tool) && tool.menuGroup !== 'extensions')
  } catch {
    return []
  }
}

export function addToRecent(tool) {
  if (!tool || tool.path === '/' || tool.menuGroup === 'extensions') return
  try {
    let recent = JSON.parse(localStorage.getItem(RECENT_TOOLS_KEY) || '[]')
    if (!Array.isArray(recent)) recent = []
    recent = recent.filter((path) => path !== tool.path)
    recent.unshift(tool.path)
    localStorage.setItem(RECENT_TOOLS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
  } catch {
    // ignore storage failures
  }
}

export function getToolByPath(path) {
  return tools.find((tool) => tool.path === path)
}

export function getToolsByMenuGroup(group) {
  return tools.filter((tool) => tool.menuGroup === group)
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

export function searchTools(query) {
  if (!query.trim()) return tools
  const lowerQuery = query.toLowerCase()
  return tools.filter(
    (tool) => tool.name.toLowerCase().includes(lowerQuery) || tool.description.toLowerCase().includes(lowerQuery)
  )
}
