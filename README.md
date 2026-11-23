# NToolBox

<p align="center">
  <img src="assets/icon.png" width="120" height="120" alt="NToolBox Logo">
</p>

<p align="center">
  <strong>NToolBox</strong> - 开发者工具箱
</p>

<p align="center">
  一款专为开发者设计的实用工具集，集成常用开发工具与多模型 AI 助手
</p>

<p align="center">
  <a href="https://github.com/lov3smu/NToolBox/releases">
    <img src="https://img.shields.io/github/v/release/lov3smu/NToolBox?style=flat-square" alt="Release">
  </a>
  <a href="LICENSE.txt">
    <img src="https://img.shields.io/github/license/lov3smu/NToolBox?style=flat-square" alt="License">
  </a>
</p>

---

## ✨ 功能特性

### 🤖 AI 助手

集成多种大模型，具备完整 Agent 闭环（规划 → 工具调用 → 反思 → 总结）的开发助手。

- **多模型支持** - 百炼、Moonshot、智谱、MiniMax、火山引擎、DeepSeek、小米 MiMo、OpenCode、OpenCode Go、OpenAI、Google、Anthropic
- **Agent 能力** - 自动生成执行计划、多轮工具调用、结果反思与执行总结，支持随时停止；计划步骤实时显示完成 / 执行中 / 失败状态
- **执行链路** - 实时展示思考过程、计划、工具参数、执行结果与运行轨迹
- **多模态输入** - 支持图片与文本文件，可切换 Auto / 思考 / 快速模式
- **工具审批** - 三档策略：写操作前询问 / 仅高危操作询问 / 自动执行；文件写入先出 dry-run 差异预览，可回滚
- **扩展能力** - 内置技能（文件操作、网页查阅等）、MCP 连接器工具与子代理任务委派
- **工作区与会话** - 会话可绑定项目工作区，支持置顶、重命名、分叉、归档与 Session ID 复制
- **记忆与知识库** - 全局 / 项目记忆自动沉淀，可作为上下文注入对话
- **用量统计** - 输入框下方展示上下文占比、生成速率、累计 token 与缓存命中，点击查看明细
- **上下文压缩** - 上下文达到窗口 70% 时自动将历史压缩为摘要并保留最近对话
- **场景预设** - 一键切换省钱 / 长任务 / 严格审批模式，批量调整温度、压缩、轮次与工具预算
- **模型降级** - 支持配置备用模型，主模型异常时自动切换

### 🗄️ SQL 脚本生成器

快速生成标准化的 SQL 脚本文件，规范团队开发流程。

- **多操作类型** - 支持 FIX（修复）、PUBLISH（发布）、QUERY（查询）
- **自定义配置** - 可配置数据库列表、脚本类型
- **智能命名** - 自动生成带日期和用途的目录名
- **实时预览** - 生成前即可查看最终内容与输出路径
- **一键打开** - 生成后可立即用编辑器打开

### 🗃️ 数据库客户端

面向 MySQL 的连接管理与日常运维工作台。

- **连接管理** - 多连接、连接加密存储、只读连接、SSH 隧道与 SSL 选项
- **查询工作台** - SQL 编辑器、参数化查询、执行历史、收藏夹、结果集编辑回写
- **表数据操作** - 分页、筛选排序、字段管理、大字段按需加载、JSON / 二进制单元格展示
- **结构管理** - 表结构查看、可视化表设计器、ER 图
- **数据传输** - 库表结构 / 数据迁移与导入导出
- **运维面板** - 会话与锁、实例状态、容量与健康检查、用户与权限
- **安全与审计** - SQL 审核规则、数据库操作日志、定时备份任务

### 🔐 密码管理

- **管理密码** - 首次进入需设置管理密码，离开页面自动重新锁定
- **加密保险库** - 管理密码校验 + 本机密钥加密保存分组密码与登录信息
- **分组管理** - 多级子分组、右键菜单与子树统计
- **内置生成器** - 在页面或密码编辑框中打开，使用 Crypto API 生成，长度 1-100 位，实时强度检测与历史记录

### ⏰ Cron 表达式生成器

- **图形化配置** - 秒、分钟、小时、日、月、周、年
- **表达式解析** - 反解析现有表达式
- **执行预览** - 显示最近 5 次执行时间
- **中文描述** - 自动生成表达式说明

### ⏱️ Unix 时间戳转换器

- **实时显示** - 当前秒级与毫秒级时间戳
- **双向转换** - 时间戳 ↔ 日期时间，支持 YYYYMMDDHHMMSS 快捷输入
- **一键复制** - 结果快速复制

### 📄 Markdown 编辑器

- **实时预览** - 左侧编辑、右侧即时渲染
- **语法支持** - GFM 表格、任务列表与代码高亮
- **主题定制** - 多套预览主题，字号与强调色可调
- **快捷插入与导出** - 标题、列表、表格、代码块一键插入，可导出 Markdown 文件

### 🎨 公众号文章排版

- **多套主题** - 内置多种公众号排版样式
- **内联样式** - 颜色、间距、边框全部内联，复制后排版不丢失
- **富文本复制** - 一键复制到公众号编辑器，也可复制 Markdown 原文
- **图表公式** - 支持 Mermaid / PlantUML 图表与数学公式渲染
- **图片处理** - 本地图片以 Base64 内嵌
- **AI 写作** - 润色、生成标题与摘要、续写、翻译

### 🖼️ 图床

- **多种服务商** - GitHub、Gitee、SM.MS、Imgur、七牛云、阿里云 OSS、腾讯云 COS、S3 / MinIO
- **上传与历史** - 支持拖拽 / 粘贴上传，历史记录保留最近 100 条
- **限制与格式** - 单文件 ≤ 30 MB，支持 png / jpg / jpeg / gif / webp / bmp / svg / avif
- **链接格式** - URL / Markdown / HTML 三种复制格式
- **配置分离** - 服务商配置集中在 设置 →「图床配置」

### 📝 YAML 编辑器

- **格式化** - 标准缩进格式化
- **语法校验** - 实时错误提示
- **JSON 转换** - YAML 转 JSON，树形展示
- **文件加载** - 本地文件快速加载

### 📋 JSON 解析器

- **格式化与校验** - 美化 JSON、实时错误检测
- **树形视图** - 结构化展示
- **路径提取** - 快速定位节点

### 🌐 HTML 查看器

- **实时渲染** - 代码即时预览
- **安全沙箱** - 隔离预览，防止恶意脚本影响应用
- **响应式** - 支持不同视口尺寸

### 📁 文件管理器 & 图片浏览器

- **目录浏览** - 浏览脚本存储目录，支持列表 / 平铺 / 紧凑视图与时间排序
- **目录搜索** - 在当前目录内快速过滤
- **右键菜单** - 打开、复制路径、查看属性
- **图片浏览** - 缩放、平移与旋转查看本地图片

### 📋 剪贴板管理

- **历史记录** - 自动收集最近复制内容，条数可选 50 / 120 / 200 / 300
- **文本与图片** - 按类型筛选，图片支持缩略图预览
- **置顶与删除** - 常用内容可置顶，置顶项不会被自动清理
- **持久化开关** - 可选择重启后是否保留历史

### 🧩 扩展

插件、技能与连接器（MCP）的统一市场与管理。

- **插件** - 技能（instructions）+ 连接器（MCP）打包分发，支持从本地目录或第三方市场安装
- **技能** - 内置技能离线可用，可安装 ClawHub 开源技能，支持单技能覆盖与禁用
- **连接器** - 接入官方 MCP registry，为 AI 助手提供外部工具
- **统一管理** - 扩展市场负责发现与安装，设置 →「扩展管理」负责查看、启用、卸载

### 🎨 界面特色

- **现代化 UI** - 统一设计 token、紧凑布局与自绘窗口控件
- **中英双语** - 中文（默认）/ English 切换即时生效，覆盖全部界面
- **主题切换** - 跟随系统 / 浅色 / 深色，内置 5 套配色主题
- **字体大小** - 小 / 标准 / 大 / 特大四档，即时生效
- **全局搜索** - Ctrl+K 快速搜索工具
- **系统托盘** - 最小化到托盘运行
- **开机自启** - 可配置自动启动
- **自动更新** - 自动检测更新，支持查看更新日志与历史版本
- **网络代理** - 跟随系统 / 直连 / 手动（HTTP、SOCKS5），支持自定义市场镜像源
- **通知** - 上传完成、备份完成、发现更新、Agent 任务完成可分别开关
- **动效与无障碍** - 页面过渡动效，并适配系统「减少动态效果」设置

---

## 📦 安装指南

### 下载安装

从 [Releases](https://github.com/lov3smu/NToolBox/releases) 页面下载对应平台的安装包：

|    平台    |                 文件格式                  | 说明                   |
| :--------: | :---------------------------------------: | :--------------------- |
| 🪟 Windows |      `.exe` (NSIS 安装程序 / 便携版)      | 标准安装包或免安装版本 |
|  🍎 macOS  |              `.dmg` / `.zip`              | Intel 与 Apple Silicon |
|  🐧 Linux  | `.AppImage` / `.deb` / `.rpm` / `.tar.gz` | 主流发行版通用格式     |

### 系统要求

- **Windows**: Windows 10 或更高版本 (x64)
- **macOS**: macOS 10.15 (Catalina) 或更高版本 (Intel / Apple Silicon)
- **Linux**: Ubuntu 18.04+ 或其他兼容发行版 (x64)
- **内存**: 至少 2GB RAM
- **磁盘空间**: 至少 100MB 可用空间

### 从源码运行

需要 Node.js 20.19+ 或 22.12+。

```bash
# 克隆仓库
git clone https://github.com/lov3smu/NToolBox.git
cd NToolBox

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

---

## 🚀 快速开始

### 全局搜索

按下 `Ctrl+K` 打开全局搜索，快速访问任意工具；也可通过左侧导航打开，`Ctrl+,` 直接进入设置（macOS 使用 Cmd）。

### SQL 脚本生成

1. 打开 SQL 脚本生成器
2. 选择操作类型：FIX / PUBLISH / QUERY
3. 输入脚本用途描述，选择目标数据库与脚本类型
4. 在右侧预览中确认内容与输出路径
5. 点击生成脚本

### AI 助手

1. 打开 AI 助手
2. 在 设置 →「模型」中配置服务商 API Key 并选择模型
3. 选择模型，可附加图片或文本文件，按需切换 Auto / 思考 / 快速
4. 在 设置 →「AI 助手」中配置人设、温度、分场景模型与工具审批策略
5. 开始对话；输入框下方会显示上下文占比、生成速率与 token 统计，达到 70% 时自动压缩历史

### 图床

1. 在 设置 →「图床配置」中选择服务商并填写凭据，测试连接后保存
2. 打开图床页面，拖拽或粘贴图片上传
3. 从历史记录中复制 URL / Markdown / HTML

### 密码管理

1. 首次打开密码管理页面，设置管理密码（至少 8 位），之后每次进入都需要输入
2. 新建密码或分组；在密码编辑框中点击生成按钮，选择字符类型并调节长度
3. 点击「使用此密码」填入，保存后由本机密钥加密

---

## 🛠️ 开发指南

### 项目结构

```
NToolBox/
├── assets/                 # 图标和资源文件
├── src/                    # 源代码目录
│   ├── shared/             # 主进程与渲染进程共享契约
│   │   ├── ipc.js          # IPC 通道与方法定义
│   │   ├── i18n.js         # 支持语言、默认语言与占位符插值
│   │   ├── locales/en-US/  # 英文词条（按域拆分，键为中文原文）
│   │   ├── tools.js        # 工具注册表（导航/菜单/托盘/搜索）
│   │   ├── aiBehavior.js   # 人设、温度、场景模型、审批策略
│   │   ├── network.js      # 代理模式与镜像源
│   │   ├── imageHosts.js   # 图床服务商与链接格式
│   │   └── …               # notifications、clipboardSettings、pluginBundle 等
│   ├── main/               # Electron 主进程（ESM）
│   │   ├── index.js        # 主进程入口
│   │   ├── ipc/            # IPC 注册
│   │   ├── windows/        # 窗口管理
│   │   ├── ui/             # 菜单、托盘
│   │   ├── services/       # 业务服务
│   │   │   ├── ai/         # Provider 注册、能力、重试、降级、用量
│   │   │   ├── chat.js     # Agent 循环、流式事件与上下文压缩
│   │   │   ├── config.js   # 配置读写与归一化编排
│   │   │   ├── database.js # 连接、查询、传输、会话与权限
│   │   │   ├── network.js  # 代理应用、netFetch / createRequest
│   │   │   ├── mcp.js      # MCP 客户端；mcpRegistry.js 官方市场
│   │   │   ├── plugins.js  # 插件注册表；pluginInstaller.js 安装卸载
│   │   │   ├── skills.js   # 技能管理；clawhub.js 技能市场
│   │   │   ├── toolPolicy.js / toolPreview.js / toolResults.js
│   │   │   ├── memory.js / workspace.js
│   │   │   ├── sshTunnel.js / backupScheduler.js / dbAuditLog.js
│   │   │   ├── imageHost/  # 图床上传服务商实现
│   │   │   └── updater.js / notifications.js / generator.js
│   │   ├── utils/          # 路径、图标、日志、加解密
│   │   ├── constants/      # 常量定义
│   │   └── skills/builtin/ # 内置 AI 技能（skill.json + handler.js）
│   ├── preload/            # 预加载脚本（由 shared/ipc.js 生成桥接）
│   └── renderer/           # Vue 渲染进程
│       └── src/
│           ├── views/      # 页面组件（含 database/ 子目录拆分）
│           ├── components/ # 公共组件（settings 面板、对话框、编辑器）
│           ├── composables/ # useConfig、useSidebar、useToast 等
│           ├── layouts/    # AppShell、标题栏、页面壳层
│           ├── api/        # IPC API 封装
│           ├── styles/     # 设计 token 与页面样式
│           ├── utils/      # 主题、路径、Markdown 等工具
│           ├── router/     # 路由配置
│           └── i18n.js     # 多语言运行时（t / setLocale）
├── tests/                  # vitest 测试（70 个文件 / 570 个用例）
├── .github/workflows/      # CI/CD 构建发布
├── package.json
├── electron.vite.config.js
├── AGENTS.md               # 架构速览
├── PROJECT.md              # 开发规范
├── LICENSE.txt
└── README.md
```

开发规范见 [PROJECT.md](./PROJECT.md)，架构与命令速览见 [AGENTS.md](./AGENTS.md)。

### 构建打包

```bash
# 构建 Windows 版本
npm run build:win

# 构建 macOS 版本
npm run build:mac

# 构建 Linux 版本
npm run build:linux

# 构建所有平台
npm run build
```

### 代码检查与测试

```bash
# ESLint 检查 / 自动修复
npm run lint:check
npm run lint

# Prettier 检查 / 格式化
npm run format:check
npm run format

# 运行全部测试 / 监听模式
npm run test
npm run test:watch

# Agent 评测套件
npm run eval
```

---

## 📝 配置说明

### 配置文件位置

- **统一位置**: 开发与打包环境一致，均使用平台配置目录；仓库根目录的旧 `config.json` 只在首次启动时作为迁移来源被复制，不再直接读写
- **各平台路径**: Linux `$XDG_CONFIG_HOME/ntoolbox/config.json`（默认 `~/.config/ntoolbox/config.json`）；Windows `%APPDATA%\ntoolbox\config.json`；macOS `~/Library/Application Support/ntoolbox/config.json`

### 主要配置项

| 配置项                                                       | 说明                                                           |
| :----------------------------------------------------------- | :------------------------------------------------------------- |
| `sql_generator.base_path`                                    | SQL 脚本存储根目录                                             |
| `sql_generator.developer.ch_name` / `.en_name`               | 开发者中英文名                                                 |
| `sql_generator.text_edit_app`                                | 打开脚本使用的编辑器                                           |
| `sql_generator.databases` / `sql_generator.script_types`     | SQL 脚本生成的数据库与脚本类型                                 |
| `ai_provider` / `ai_models` / `ai_api_keys` / `ai_base_urls` | AI 服务商、模型、密钥与自定义接口地址                          |
| `ai_persona` / `ai_temperature`                              | 人设与温度                                                     |
| `ai_timeout`                                                 | AI 请求超时（秒，10–600）                                      |
| `ai_compress_threshold` / `ai_compress_keep_recent`          | 上下文压缩触发阈值（50–90%）与压缩后保留消息数                 |
| `ai_max_attachments` / `ai_max_image_mb` / `ai_max_text_kb`  | 附件数量、图片大小与文本附件上限                               |
| `ai_scenario_models`                                         | 分场景模型（`planner` / `compression`）                        |
| `ai_tool_policy`                                             | 工具审批策略：`all` / `high-risk` / `auto`                     |
| `ai_agent_max_iterations` / `ai_agent_timeout_min`           | Agent 最大执行轮次（3–30）与单任务时长上限（1–30 分钟）        |
| `ai_agent_plan_steps` / `ai_agent_parallel_tools`            | 计划步骤上限（3–12）与并行工具数（1–8）                        |
| `ai_tool_result_max_kb` / `ai_tool_result_run_kb`            | 单个工具结果与单次运行的输出预算（KB）                         |
| `ai_tool_result_retention_days`                              | 落盘工具结果保留天数（1–30）                                   |
| `ai_fallback_enabled` / `ai_fallback_models`                 | 模型降级开关与备用模型列表                                     |
| `dbConnections`                                              | 数据库连接配置（密码加密存储）                                 |
| `database_safe_mode` / `database_audit_*`                    | 数据库安全模式与 SQL 审核规则                                  |
| `database_page_size` / `database_refresh_interval`           | 数据库默认分页大小与实例/会话自动刷新间隔（0 为关闭）          |
| `database_transfer_batch_size` / `database_history_limit`    | 数据传输默认批量行数与本地查询历史保留条数                     |
| `db_backup_tasks`                                            | 定时备份任务                                                   |
| `image_hosting`                                              | 图床服务商配置、当前服务商与链接格式                           |
| `mcp_servers`                                                | MCP 连接器配置                                                 |
| `disabled_skills` / `skill_overrides`                        | 技能禁用与单技能覆盖                                           |
| `network` / `market_sources`                                 | 代理模式、绕过列表与市场镜像源                                 |
| `notifications`                                              | 通知开关                                                       |
| `clipboard_history`                                          | 剪贴板持久化开关与保留条数                                     |
| `theme`                                                      | 主题模式：`system` / `light` / `dark`                          |
| `theme_style`                                                | 配色主题：`sapphire` / `forest` / `mint` / `bee` / `parchment` |
| `font_size`                                                  | 字体大小：`small` / `medium` / `large` / `xlarge`              |
| `memory_auto_capture`                                        | 自动沉淀记忆开关                                               |
| `shortcuts`                                                  | 快捷键配置（仅设置页可配置）                                   |
| `auto_update` / `auto_start` / `close_action`                | 自动更新、开机自启与关闭窗口行为                               |
| `update_check_interval`                                      | 自动检查更新间隔（小时：1 / 6 / 24）                           |
| `recent_tools_limit`                                         | 首页「最近使用」展示的工具数量（2–8）                          |

### 快捷键

工具不占用全局快捷键，通过侧边栏或全局搜索打开。

| 功能           | 快捷键     |
| :------------- | :--------- |
| 全局搜索       | Ctrl+K     |
| 设置           | Ctrl+,     |
| 数据库执行查询 | Ctrl+Enter |

设置页的快捷键可在配置中修改（`shortcuts.settings`），macOS 上使用 Cmd 替代 Ctrl。

---

## 🔧 技术栈

| 技术                                                                      | 说明                   |
| :------------------------------------------------------------------------ | :--------------------- |
| [Electron](https://www.electronjs.org/)                                   | 跨平台桌面应用框架     |
| [Vue 3](https://vuejs.org/)                                               | 渐进式 JavaScript 框架 |
| [electron-vite](https://electron-vite.org/)                               | Electron 构建方案      |
| [Vite](https://vitejs.dev/)                                               | 前端构建工具           |
| [Vue Router](https://router.vuejs.org/)                                   | Vue.js 官方路由        |
| [electron-builder](https://www.electron.build/)                           | 应用打包工具           |
| [electron-log](https://github.com/megahertz/electron-log)                 | 日志记录               |
| [electron-updater](https://github.com/electron-userland/electron-updater) | 自动更新               |
| [mysql2](https://github.com/sidorares/node-mysql2)                        | MySQL 客户端           |
| [js-yaml](https://github.com/nodeca/js-yaml)                              | YAML 解析              |
| [CodeMirror 6](https://codemirror.net/)                                   | 代码编辑器             |
| [marked](https://github.com/markedjs/marked)                              | Markdown 渲染          |
| [DOMPurify](https://github.com/cure53/DOMPurify)                          | HTML 安全过滤          |
| [highlight.js](https://highlightjs.org/)                                  | 代码高亮               |
| [Mermaid](https://mermaid.js.org/)                                        | 图表渲染               |
| [MathJax](https://www.mathjax.org/)                                       | 数学公式渲染           |
| [Vitest](https://vitest.dev/)                                             | 单元测试框架           |

---

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE.txt) 开源。

---

## 👨‍💻 作者

**lov3smu**

Email: [imancoka@gmail.com](mailto:imancoka@gmail.com)

GitHub: [@lov3smu](https://github.com/lov3smu)

---

## 🙏 致谢

感谢所有为这个项目提供建议和帮助的朋友们！

如果您觉得这个项目对您有帮助，请给个 ⭐ Star 支持一下！
