// Lightweight text catalog for the settings window and extension manager.
// Only zh-CN ships today; keeping the keys centralized lets us add locales
// without touching every component later.
const messages = {
  'settings.menu.general': '通用',
  'settings.menu.appearance': '外观',
  'settings.menu.api': '模型',
  'settings.menu.databaseClient': '数据库客户端',
  'settings.menu.sqlGenerator': 'SQL脚本生成',
  'settings.menu.imageHosting': '图床配置',
  'settings.menu.shortcuts': '快捷键',
  'settings.menu.extensions': '扩展管理',
  'settings.menu.about': '关于软件',

  'settings.tab.general.title': '通用设置',
  'settings.tab.general.desc': '配置启动、窗口关闭、系统通知与本地数据行为。脚本与数据库相关配置已迁移到独立页面。',
  'settings.tab.databaseClient.title': '数据库客户端',
  'settings.tab.databaseClient.desc': '调整查询分页、刷新与传输的默认参数，以及安全策略、SQL 审核与编辑器显示项。',
  'settings.tab.sqlGenerator.title': 'SQL脚本生成',
  'settings.tab.sqlGenerator.desc': '配置脚本存放位置、开发者署名、文本编辑器、常用数据库与脚本类型。',
  'settings.tab.imageHosting.title': '图床配置',
  'settings.tab.imageHosting.desc': '配置上传图床服务与连接参数；顶部选项选择后自动保存，卡片内可先测试再保存。',
  'settings.tab.extensions.title': '扩展管理',
  'settings.tab.extensions.desc': '插件、技能与连接器分类管理，支持安装、启停、更新、导入导出与连通性检测。',

  'settings.sqlGenerator.scriptPath': '脚本位置',
  'settings.sqlGenerator.scriptPathHint': '生成 SQL 脚本的默认存放目录',
  'settings.sqlGenerator.developerCh': '开发者中文名',
  'settings.sqlGenerator.developerEn': '开发者英文名',
  'settings.sqlGenerator.textEditor': '文本编辑器',
  'settings.sqlGenerator.textEditorHint': '选择打开脚本文件使用的文本编辑器',
  'settings.sqlGenerator.databases': '常用数据库',
  'settings.sqlGenerator.databasesHint': '供 SQL 脚本生成与数据库工具快速选择',
  'settings.sqlGenerator.scriptTypes': '脚本类型',
  'settings.sqlGenerator.scriptTypesHint': '定义脚本类型与说明，用于脚本生成与归档',

  'settings.databaseClient.safeMode': '启用安全模式',
  'settings.databaseClient.safeModeHint': '执行无 WHERE 的 UPDATE/DELETE 或 DROP/TRUNCATE 等高风险语句前二次确认',
  'settings.databaseClient.audit': '启用 SQL 审核',
  'settings.databaseClient.auditHint': '执行前按规则检查语句写法，命中提示级规则需确认，拦截级规则可禁止执行',
  'settings.databaseClient.operationLog': '记录数据库操作日志',
  'settings.databaseClient.operationLogHint':
    '记录写入类语句（INSERT / UPDATE / DELETE / DDL）与用户管理操作，可在数据库客户端页「日志」中查看与清空',
  'settings.databaseClient.editorTheme': '主题',
  'settings.databaseClient.editorThemeHint': '选择 SQL 编辑器的配色主题，仅作用于数据库客户端的编辑器',

  'settings.imageHosting.saved': '图床配置已保存',
  'settings.imageHosting.testing': '正在测试上传连通性…',

  'ext.title': '扩展管理',
  'ext.desc': '内置技能随应用提供且不可卸载，本地扩展安装在用户目录，可随时更新或卸载。',
  'ext.category.plugins': '插件',
  'ext.category.plugins.hint': '插件是可安装的集成打包件，内含技能与连接器；卸载插件会一并移除随包安装的组件。',
  'ext.category.skills': '技能',
  'ext.category.skills.hint': '技能是打包的指令与专业知识，本身不访问外部系统；外部数据与操作请通过连接器授权。',
  'ext.category.connectors': '连接器',
  'ext.category.connectors.hint': '连接器是授权的数据与操作通道（MCP 服务），AI 助手只能通过它读写外部系统。',
  'ext.stat.total': '全部扩展',
  'ext.stat.plugins': '插件',
  'ext.stat.skills': '技能',
  'ext.stat.connectors': '连接器',
  'ext.stat.updates': '可更新',
  'ext.empty.plugins': '还没有安装插件',
  'ext.empty.pluginsHint': '点击「安装插件」，从本地目录、npm 或 GitHub 安装包含 plugin.json 的插件包。',
  'ext.empty.skills': '没有匹配的技能',
  'ext.empty.skillsHint': '试试更换搜索词，或导入一个技能包。',
  'ext.empty.search': '没有匹配的扩展',
  'ext.empty.searchHint': '试试更换搜索词。',
  'ext.installSkill': '安装技能',
  'ext.installPlugin': '安装插件',
  'ext.importSkill': '导入技能',
  'ext.exportSkill': '导出',
  'ext.editDescription': '编辑描述',
  'ext.saveDescription': '保存描述',
  'ext.cancel': '取消',
  'ext.descriptionPlaceholder': '输入新的技能描述，留空则恢复原始描述',
  'ext.enabled': '已启用',
  'ext.disabled': '已停用',
  'ext.enable': '启用',
  'ext.disable': '停用',
  'ext.update': '更新',
  'ext.uninstall': '卸载',
  'ext.details': '详情',
  'ext.installed': '已安装',
  'ext.builtin': '内置',
  'ext.updateAvailable': '可更新',
  'ext.connector.add': '+ 添加连接器',
  'ext.connector.title': 'MCP 连接器',
  'ext.connector.empty': '尚未配置 MCP 连接器，点击下方按钮添加',
  'ext.connector.test': '检测',
  'ext.connector.testing': '检测中…',
  'ext.connector.name': '服务名（小写字母、数字、连字符）',
  'ext.connector.command': '启动命令，如 npx 或 /usr/bin/node',
  'ext.connector.args': '参数，每行一个',
  'ext.connector.env': '环境变量，每行 KEY=VALUE（可选）',
  'ext.connector.testOk': '连接成功，发现 {count} 个工具',
  'ext.connector.testFail': '连接失败：{error}',
  'ext.loadError': '加载扩展失败：{error}',
  'ext.saveError': '保存失败：{error}'
}

function interpolate(template, params) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  )
}

export function t(key, params) {
  const template = messages[key]
  if (template === undefined) return key
  return interpolate(template, params)
}
