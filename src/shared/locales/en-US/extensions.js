export default {
  // Common labels
  插件: 'Plugins',
  技能: 'Skills',
  连接器: 'Connectors',
  扩展: 'Extensions',
  内置: 'Built-in',
  内置技能: 'Built-in skill',
  已安装: 'Installed',
  可安装: 'Available',
  可更新: 'Updates',
  在线: 'Online',
  已配置: 'Configured',
  示例: 'Examples',
  未知: 'Unknown',
  未知作者: 'Unknown author',
  无: 'None',
  无描述: 'No description',
  不可卸载: 'Cannot be uninstalled',
  官方: 'Official',
  本地: 'Local',
  '安装中…': 'Installing…',
  '更新中…': 'Updating…',
  更新: 'Update',
  安装: 'Install',

  // Skill categories and connector categories
  代码: 'Code',
  数据库: 'Database',
  文档: 'Docs',
  通用: 'General',
  安全: 'Security',
  文件: 'Files',
  知识: 'Knowledge',
  网络: 'Network',
  工具: 'Tools',
  开发: 'Development',
  数据: 'Data',

  // Extensions manager
  扩展管理: 'Extensions',
  扩展分类: 'Extension categories',
  刷新状态: 'Refresh status',
  打开插件目录: 'Open plugin folder',
  安装插件: 'Install plugin',
  安装技能: 'Install skill',
  导入技能: 'Import skill',
  从本地目录添加: 'Add from local folder',
  '选择包含 plugin.json 的文件夹': 'Choose a folder containing plugin.json',
  '选择包含 skill.json 的文件夹': 'Choose a folder containing skill.json',
  安装第三方插件: 'Install third-party plugin',
  安装第三方技能: 'Install third-party skill',
  '从 npm、GitHub 或本地目录安装': 'Install from npm, GitHub or a local folder',
  '让 Agent 创建技能': 'Let the Agent create a skill',
  '在 AI 助手中生成技能包': 'Generate a skill package in the AI assistant',
  '内置 {builtin} · 已安装 {installed}': 'Built-in {builtin} · Installed {installed}',
  '正在加载扩展…': 'Loading extensions…',
  '插件包，包含随包安装的技能与连接器。': 'A plugin bundle with skills and connectors.',
  技能已被单独卸载: 'This skill was uninstalled separately',
  连接器已在配置中移除: 'This connector was removed from the config',
  '安装位置：{path}': 'Location: {path}',
  卸载插件: 'Uninstall plugin',
  卸载扩展: 'Uninstall extension',
  卸载: 'Uninstall',
  输入技能描述: 'Enter a skill description',
  保存描述: 'Save description',
  恢复原始描述: 'Restore original description',
  脚本执行: 'Script-based',
  'Prompt 技能': 'Prompt skill',
  编辑描述: 'Edit description',
  导出技能: 'Export skill',
  '更新 v{version}': 'Update to v{version}',
  '插件把技能与连接器打包在一起，一次安装即可使用全部组件。':
    'Plugins bundle skills and connectors, so one install gives you every component.',
  '技能是 AI 助手可调用的指令与脚本，安装后按需触发。':
    'Skills are instructions and scripts the AI assistant can call when needed.',
  '连接器通过 MCP 协议把外部工具与数据接入 AI 助手。':
    'Connectors bring external tools and data into the AI assistant via the MCP protocol.',
  '搜索插件名称、描述或组件': 'Search plugin name, description or components',
  '搜索技能名称、描述或标签': 'Search skill name, description or tags',
  没有找到匹配的扩展: 'No matching extensions found',
  没有找到匹配的渠道: 'No matching channels found',
  没有找到匹配的连接器: 'No matching connectors found',
  还没有安装插件: 'No plugins installed yet',
  还没有可用的技能: 'No skills available yet',
  试试更换关键词或清空搜索: 'Try another keyword or clear the search',
  试试更换分类或搜索关键词: 'Try another category or keyword',
  '点击「安装插件」从本地目录或 npm、GitHub 添加': 'Click "Install plugin" to add from a local folder, npm or GitHub',
  '点击「安装技能」添加，或让 Agent 为你创建': 'Click "Install skill" or let the Agent create one for you',
  '加载扩展失败：{error}': 'Failed to load extensions: {error}',
  扩展列表已刷新: 'Extension list refreshed',
  '无法打开 AI 助手': 'Unable to open the AI assistant',
  '已安装插件 {name}（技能 {skills} · 连接器 {connectors}）':
    'Plugin installed: {name} ({skills} skills · {connectors} connectors)',
  '已安装技能 {name}': 'Skill installed: {name}',
  '已更新技能 {name}': 'Skill updated: {name}',
  '已导入技能 {name}': 'Skill imported: {name}',
  '已导出技能 {name}': 'Skill exported: {name}',
  '已启用 {name}': '{name} enabled',
  '已停用 {name}': '{name} disabled',
  安装插件失败: 'Failed to install plugin',
  打开插件目录失败: 'Failed to open plugin folder',
  安装技能失败: 'Failed to install skill',
  导入技能失败: 'Failed to import skill',
  导出技能失败: 'Failed to export skill',
  '保存失败：{error}': 'Save failed: {error}',
  配置保存失败: 'Failed to save config',
  技能描述已更新: 'Skill description updated',
  '已更新扩展 {name}': 'Extension updated: {name}',
  更新扩展失败: 'Failed to update extension',
  '确定要卸载扩展 {name} 吗？本地安装的文件会被删除。':
    'Uninstall extension {name}? Locally installed files will be deleted.',
  '已卸载扩展 {name}': 'Extension uninstalled: {name}',
  卸载扩展失败: 'Failed to uninstall extension',
  '确定要卸载插件 {name} 吗？将同时移除随插件安装的 {skills} 个技能与 {connectors} 个连接器配置。':
    'Uninstall plugin {name}? This also removes {skills} bundled skills and {connectors} connector configs.',
  '已卸载插件 {name}，{count} 个技能需手动处理': 'Plugin {name} uninstalled, {count} skills need manual removal',
  '已卸载插件 {name}': 'Plugin uninstalled: {name}',
  卸载插件失败: 'Failed to uninstall plugin',

  // Market page
  '精选技能扩展，安装后由 AI 助手按需调用。扩展保存在本机用户目录，可在设置中随时卸载。':
    'Curated skill extensions the AI assistant calls on demand. They are stored in your local user folder and can be removed in Settings at any time.',
  搜索扩展: 'Search extensions',
  '无法连接 ClawHub 技能市场：{error}。当前仅展示内置扩展。':
    'Cannot reach the ClawHub skill market: {error}. Only built-in extensions are shown.',
  重试: 'Retry',
  精选: 'Featured',
  '内置扩展可离线使用；在线技能来自开源技能市场 ClawHub（MIT）。':
    'Built-in extensions work offline; online skills come from the open-source ClawHub market (MIT).',
  '插件是技能与连接器的集合打包，一次安装同时获得多个组件。已安装插件在 设置 → 扩展管理 中更新与卸载。':
    'A plugin bundles skills and connectors, so one install adds multiple components. Manage installed plugins in Settings → Extensions.',
  安装渠道: 'Install channels',
  搜索安装渠道: 'Search install channels',
  '已安装插件可在 设置 → 扩展管理 中查看组件、更新与卸载。':
    'View, update and uninstall installed plugins in Settings → Extensions.',
  从本地目录安装: 'Install from local folder',
  '选择包含 plugin.json 的文件夹，适合自研或离线分发的插件包。':
    'Choose a folder containing plugin.json. Best for private or offline-distributed plugins.',
  适合自研与离线分发: 'For private builds and offline distribution',
  '从 npm 安装': 'Install from npm',
  '输入 npm 包名（可含 @scope 与版本标签），从公共 registry 拉取插件。':
    'Enter an npm package name (optionally with @scope and version tag) to fetch the plugin from the public registry.',
  '从 GitHub 安装': 'Install from GitHub',
  '输入 GitHub 仓库地址，拉取包含 plugin.json 的插件仓库。':
    'Enter a GitHub repository URL to fetch a plugin repo containing plugin.json.',
  仓库: 'Repository',
  '本机文件读写，启动参数限定允许访问的目录。':
    'Read and write local files, restricted to the allowed folders by launch arguments.',
  '知识图谱式长期记忆，跨会话保存实体与关系。':
    'Long-term knowledge-graph memory that keeps entities and relations across sessions.',
  知识图谱: 'Knowledge graph',
  记忆: 'Memory',
  '抓取网页并转为 Markdown 供 AI 助手查阅。': 'Fetch web pages and convert them to Markdown for the AI assistant.',
  网页: 'Web',
  '需 uv': 'Requires uv',
  '官方示例服务器，覆盖回显、工具、资源等常见能力。':
    'Official demo server covering echo, tools, resources and other common features.',
  测试: 'Test',
  '动态分步推理工具，支持中途修正与分支思考。':
    'Dynamic step-by-step reasoning tool with mid-course correction and branching.',
  推理: 'Reasoning',
  分步: 'Step-by-step',
  '读取与分析本地 Git 仓库的提交、分支与状态。':
    'Read and analyze commits, branches and status of local Git repositories.',
  '时区查询与时间转换，获取指定时区的当前时间。':
    'Time zone lookup and conversion, with the current time in any time zone.',
  时区: 'Time zone',
  时间: 'Time',
  '只读查询 PostgreSQL 数据库的表结构与数据。': 'Query PostgreSQL table schemas and data in read-only mode.',
  '无法连接 MCP 官方注册表：{error}。当前仅展示内置示例。':
    'Cannot reach the official MCP registry: {error}. Only built-in examples are shown.',
  '添加连接器需要名称与启动命令，可先测试连通性再保存重载。':
    'Adding a connector requires a name and a launch command; test connectivity before saving and reloading.',
  前往扩展管理: 'Open Extensions Manager',
  '已安装扩展 {name}': 'Extension installed: {name}',
  安装扩展失败: 'Failed to install extension',
  命令已复制到剪贴板: 'Command copied to clipboard',
  复制失败: 'Copy failed',
  复制命令: 'Copy command',
  网络错误: 'Network error',

  // Plugin install dialog
  '安装{kind}': 'Install {kind}',
  '安装{kind}失败': 'Failed to install {kind}',
  安装引导和示例: 'Install guide and examples',
  安装源: 'Source',
  选择安装源: 'Choose install source',
  默认安装源: 'Default source',
  中国大陆镜像源: 'China mainland mirror',
  自定义地址: 'Custom URL',
  '填写内网或私有 npm 源地址，以 http:// 或 https:// 开头。若为需要登录的源，请把凭据放在本机的 ~/.npmrc 里。':
    'Enter an internal or private npm registry starting with http:// or https://. For registries that require login, put credentials in ~/.npmrc on this machine.',
  请输入自定义安装源地址: 'Enter a custom registry URL',
  '安装源地址需以 http:// 或 https:// 开头': 'Registry URL must start with http:// or https://',
  'npm 上的插件包名，可追加 @版本 或 @标签': 'npm plugin package name, optionally with @version or @tag',
  '带命名空间的 npm 插件包': 'Scoped npm plugin package',
  'GitHub 仓库根地址，包内需包含 plugin.json': 'GitHub repository root; the package must contain plugin.json',
  '本机目录路径，目录内需包含 plugin.json': 'Local folder path; it must contain plugin.json',
  'npm 上的技能包名，可追加 @版本 或 @标签': 'npm skill package name, optionally with @version or @tag',
  '带命名空间的 npm 技能包': 'Scoped npm skill package',
  'GitHub 仓库根地址，包内需包含 skill.json': 'GitHub repository root; the package must contain skill.json',
  '本机目录路径，目录内需包含 skill.json': 'Local folder path; it must contain skill.json',
  '输入插件包的 npm 包名、GitHub 仓库地址或本地目录路径。插件包内需包含 plugin.json。':
    'Enter an npm package name, GitHub repository URL or local folder path. The plugin package must contain plugin.json.',
  '输入技能包的 npm 包名、GitHub 仓库地址或本地目录路径。':
    'Enter an npm package name, GitHub repository URL or local folder path.',
  '例如 @scope/plugin-name 或 https://github.com/owner/repo':
    'e.g. @scope/plugin-name or https://github.com/owner/repo',
  '例如 @scope/skill-name 或 https://github.com/owner/repo': 'e.g. @scope/skill-name or https://github.com/owner/repo',
  '安装源仅用于 npm 包；插件可能包含技能与连接器，请只安装来自可信来源的插件。':
    'The source only applies to npm packages. Plugins may include skills and connectors, so only install plugins from trusted sources.',
  '安装源仅用于 npm 包；技能可能包含脚本，请只安装来自可信来源的技能。':
    'The source only applies to npm packages. Skills may contain scripts, so only install skills from trusted sources.',

  // Skill detail dialog
  作者: 'Author',
  分类: 'Category',
  来源: 'Source',
  更新说明: 'Changelog',
  参数: 'Parameters',
  安装位置: 'Install location',
  'ClawHub 在线市场': 'ClawHub online market',
  本地扩展: 'Local extension',

  // Extension market page
  打开安装对话框: 'Open install dialog',
  搜索连接器: 'Search connectors',
  '连接器基于 MCP 协议把外部工具与数据接入 AI 助手，调用需审批、返回按不可信数据隔离。在 设置 → 扩展管理 中添加与启停。':
    'Connectors connect external tools and data to the AI assistant over MCP. Calls require approval and responses are treated as untrusted data. Add and toggle them in Settings → Extensions.',

  内置扩展: 'Built-in extensions',
  '{p0} 万': '{p0} × 10K'
}
