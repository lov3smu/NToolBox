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
- **本地模型** - 接入本地 Ollama（127.0.0.1:11434）与 LM Studio（127.0.0.1:1234），无需 API Key，自动读取本地模型列表
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
- **结果可视化** - 查询结果一键切换表格 / 柱状图 / 折线图 / 饼图，基于当前页数据
- **数据脱敏** - 导出文件、查询结果导出与迁移写入前，按字段名关键词套用邮箱 / 手机号 / 证件号等预设掩码
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
- **快捷插入** - 标题、列表、表格、代码块一键插入
- **本地文件** - 打开 / 保存 / 另存为最近文档，编辑后自动保存（900ms 防抖），下次启动恢复上次文件
- **大纲导航** - 侧栏展示标题大纲与 Frontmatter 文档属性，点击跳转编辑器与预览
- **图片直传** - 粘贴或拖入图片自动上传图床并插入链接
- **就地 AI** - 选中文字后直接润色、提炼摘要、翻译或解释，结果可编辑后再替换

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

### 🧰 文本工具箱

- **大小写转换** - 全部大写 / 小写、单词首字母与句首字母大写
- **行处理** - 去除行首尾空白、移除空行、去重、排序、反转与添加行号
- **空白清理** - 压缩多余空格、删除全部空白
- **统计与回填** - 实时字符 / 行 / 字节统计，结果可一键作为新输入

### 🔍 文本对比

- **按行比较** - 标出新增、删除与未变化的行
- **忽略选项** - 可选忽略大小写与空白差异
- **统计概览** - 显示新增 / 删除行数，超长文本自动降级提示

### 🧪 正则测试器

- **实时测试** - 输入表达式与待匹配文本后即时验证
- **高亮与明细** - 命中片段高亮，列出位置、捕获组与命名分组
- **安全限额** - 始终全局匹配，最多返回 500 处，扫描 10 万字符

### 🔄 编码转换

- **多种编码** - Base64、URL、HTML 实体、Unicode 转义、十六进制与 JSON 字符串
- **双向转换** - 编码 / 解码切换，可交换输入输出反向处理
- **实时结果** - 输入即转换，非法内容给出错误提示

### 🌐 HTTP 客户端

- **请求构造** - 7 种请求方法，自定义请求头、请求体与超时
- **响应查看** - 状态码、耗时、大小、响应头与 JSON 格式化
- **复用代理** - 走应用网络与代理配置，响应超过 2 MB 自动截断
- **最近请求** - 保留最近 8 条记录，一键回填

### 🕒 活动时间线

- **聚合视图** - 汇总数据库查询、图床上传、备份、AI 运行与 AI 文件改动
- **范围与筛选** - 24 小时 / 7 天 / 30 天 / 全部，按类型筛选，支持分页加载
- **快速复用** - 查询可直接复制 SQL，上传可复制链接
- **就地 AI** - Markdown 与 SQL 编辑器选中内容后可直接调用当前默认模型处理

### 🗂️ 模板中心

- **内置模板** - README、技术方案评审、周报、接口文档、提交规范、HTML 邮件、GitHub Actions、JSON 响应与 MySQL 建表
- **分类与搜索** - 按通用文档 / 开发配置 / 数据示例筛选，支持名称、标签与内容关键字搜索
- **应用流转** - 一键复制内容，或直接发送到 Markdown 编辑器、YAML 编辑器、JSON 解析器、HTML 查看器

### 🖧 系统工具

- **监听端口** - 读取本机 TCP/UDP 监听端口、地址、PID 与进程名，支持关键词筛选
- **SSL 证书检查** - 输入域名或 HTTPS 地址，查看主体、颁发者、有效期、证书链与 SHA-256 指纹
- **信任与到期** - 展示系统校验结果，标记已过期 / 即将过期（30 天内）/ 不受信任
- **一键复制** - 证书信息可整段复制用于排查

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

### 📥 暂存架

- **跨工具收集** - 任意工具通过「发送到 → 暂存架」暂存内容，也可手动新建条目
- **随手复用** - 点击复制，或把条目再发送到 Markdown、JSON、YAML、HTTP 等目标工具
- **置顶与清理** - 常用条目可置顶，支持搜索、编辑、删除与清空

### 🔗 链式 Recipe

把编码转换与文本处理串成可复用的处理链。

- **自由编排** - 任意组合 Base64 / URL / HTML / Hex / JSON 编解码与 13 种文本操作，支持排序、增删步骤
- **逐步追踪** - 实时显示每一步的输出与字符数，失败时定位到具体步骤
- **即存即用** - 本地保存最多 30 个 Recipe，通过「发送到」载入任意工具内容，结果可复制或再发送

### ⏰ 计划任务

定时执行无需值守的小任务，关闭页面后仍由主进程按时运行。

- **三种动作** - 定时请求 HTTP 地址、按 Recipe 处理文本写入文件、定期清空剪贴板历史
- **按间隔或每天** - 最短 5 分钟一次，或每天固定时刻执行，支持立即运行与启停
- **运行记录** - 展示下次执行时间、上次状态、耗时摘要与错误，完成后发送通知
- **密钥占位符** - URL、请求头与请求体支持 `{{secret:别名}}`，由主进程在发送前替换

### 🗂️ 项目与环境

按项目维护环境变量，并把密钥别名集中到凭据中心。

- **多项目多环境** - 每个项目可建多套环境（开发 / 生产…），保存后在 HTTP 客户端一键导入
- **凭据别名** - 将密码管理条目映射为 `secret:别名`，环境变量、请求与计划任务中只出现占位符
- **发送时替换** - `{{secret:别名}}` 仅在主进程发送前解析，密钥不会写入 localStorage 或明文配置
- **库锁保护** - 凭据库未解锁时只能查看别名占位符，保存与解析都需要先解锁密码管理器

### 👥 团队托管配置

由团队统一分发策略配置，成员导入后自动生效并锁定关键字段。

- **集中托管** - 托管 AI 默认服务、模型与工具策略、数据库安全/审计、扩展与更新源、技能禁用与覆盖
- **文件或 URL** - 从本地 JSON 导入，或填写团队发布的地址一键同步（http/https，预览后应用）
- **强制覆盖** - 托管字段始终以团队配置为准，本机修改在保存时会被覆盖；重启后依旧生效
- **可回退** - 取消托管时恢复导入前的本机设置，托管字段重新可编辑
- **不含凭据** - 托管白名单只包含策略字段，API Key、数据库密码、MCP 凭据等敏感信息不会进入配置文件

### 🧩 扩展

插件、技能与连接器（MCP）的统一市场与管理。

- **插件** - 技能（instructions）+ 连接器（MCP）打包分发，支持从本地目录或第三方市场安装
- **声明式贡献点** - `plugin.json` 可声明 `commands`（跳转工具 / 打开设置 / 发送内容）与 `templates`（模板中心内容），安装后进入命令面板与模板中心，不执行任意脚本
- **沙箱动作** - `plugin.json` 的 `sandbox.actions` 声明由应用内置能力执行的动作（文本与编码转换、HTTP 请求、插件本地存储），按动作派生最小权限，首次运行逐项确认；可访问主机以声明清单为准，插件代码本身不被执行
- **技能** - 内置技能离线可用，可安装 ClawHub 开源技能，支持单技能覆盖与禁用
- **连接器** - 接入官方 MCP registry，为 AI 助手提供外部工具
- **统一管理** - 扩展市场负责发现与安装，设置 →「扩展管理」负责查看、启用、卸载

### ⌨️ 终端 CLI 伴生

- **终端复用** - `ntb` 命令在终端调用应用能力：编码解码、文本转换、正则测试、文本对比、JSON 格式化、时间戳转换
- **只读数据库** - `ntb db databases / tables / query / schema` 按名称复用已保存的连接，未激活时自动建立只读连接，只允许查询类 SQL
- **AI 管道** - `ntb ai summarize` 等就地 AI 操作支持标准输入，方便接入 shell 管道
- **打开工具** - `ntb open 数据库客户端` 将已运行（或自动启动）的应用切到对应页面
- **本机安全** - 主进程内只监听 `127.0.0.1`，基于一次性 token 鉴权，退出即失效；命令行只做发现与转发，不加载应用代码

### 🎨 界面特色

- **现代化 UI** - 统一设计 token、紧凑布局与自绘窗口控件
- **中英双语** - 中文（默认）/ English 切换即时生效，覆盖全部界面
- **主题切换** - 跟随系统 / 浅色 / 深色，内置 5 套配色主题
- **字体大小** - 小 / 标准 / 大 / 特大四档，即时生效
- **全局搜索** - Ctrl+K 快速搜索工具
- **分屏工作台** - 页头「分屏」可并排打开另一个工具，支持拖动 / 键盘调宽、左右交换，宽度与选择会记住；窄窗口自动收起副屏
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

### 终端 CLI

```bash
# 在仓库内注册命令（或直接用 node bin/ntb-cli.mjs）
npm link
ntb status                              # 应用未运行时会自动以 --hidden 启动
echo hello | ntb codec base64           # aGVsbG8=
ntb codec base64 --decode aGVsbG8=      # hello
ntb regex "\d+" "订单 42 与 7"          # 输出命中位置与捕获组
ntb timestamp 1704067200 --tz Asia/Shanghai
ntb json --file package.json --indent 2
ntb db query local "SELECT * FROM users" --limit 20
cat changelog.md | ntb ai summarize
ntb open database                       # 在应用中打开数据库客户端
```

文本省略或传 `-` 时从标准输入读取；`--json` 输出完整结果便于脚本处理；打包版可用 `NTB_APP` 指定可执行文件路径。

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
│   │   ├── navTools.js     # 导航注册表（侧边栏/菜单/托盘/搜索）
│   │   ├── aiBehavior.js   # 人设、温度、场景模型、审批策略
│   │   ├── network.js      # 代理模式与镜像源
│   │   ├── imageHosts.js   # 图床服务商与链接格式
│   │   └── …               # notifications、clipboardSettings、pluginBundle 等
│   ├── main/               # Electron 主进程（ESM）
│   │   ├── index.js        # 主进程入口
│   │   ├── ipc/            # IPC 注册（handlers/ 按域拆分）
│   │   ├── windows/        # 窗口管理
│   │   ├── ui/             # 菜单、托盘
│   │   ├── services/       # 业务服务
│   │   │   ├── ai/         # Provider 注册、能力、重试、降级、用量
│   │   │   ├── agent/      # Agent 循环（chat.js/contextCompress/prompts）、记忆、工作区、工具策略/预览/结果、轨迹、快照
│   │   │   ├── database/   # 连接/查询/传输/会话、SSH 隧道、审计日志、备份调度
│   │   │   ├── config.js   # 配置读写与归一化编排
│   │   │   ├── network.js  # 代理应用、netFetch / createRequest
│   │   │   ├── extensions/ # 技能/插件/连接器：skills、plugins、pluginInstaller、clawhub、mcp
│   │   │   ├── templates/  # SQL 模板定义、AI 生成器与脚本文件生成
│   │   │   ├── imageHost/  # 图床上传服务商实现
│   │   │   └── updater.js / notifications.js / fileOpener.js
│   │   ├── utils/          # 路径、图标、日志、加解密
│   │   ├── constants/      # 常量定义
│   │   └── skills/builtin/ # 内置 AI 技能（skill.json + handler.js）
│   ├── preload/            # 预加载脚本（由 shared/ipc.js 生成桥接）
│   └── renderer/           # Vue 渲染进程
│       └── src/
│           ├── views/      # 页面组件（database/、settings/ 子目录拆分）
│           ├── components/ # 公共组件（settings 面板、对话框、编辑器）
│           ├── composables/ # useConfig、useSidebar、useToast 等
│           ├── layouts/    # AppShell、标题栏、页面壳层
│           ├── api/        # IPC API 封装
│           ├── styles/     # 设计 token 与页面样式
│           ├── utils/      # 主题、路径、Markdown 等工具
│           ├── router/     # 路由配置
│           └── i18n.js     # 多语言运行时（t / setLocale）
├── tests/                  # vitest 测试（109 个文件 / 871 个用例）
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
