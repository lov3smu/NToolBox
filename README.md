# NToolBox

<p align="center">
  <img src="assets/icon.png" width="120" height="120" alt="NToolBox Logo">
</p>

<p align="center">
  <strong>NToolBox</strong> - 开发者工具箱
</p>

<p align="center">
  一款专为开发者设计的实用工具集，旨在提升日常开发效率
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

### 🗄️ SQL 脚本生成器

快速生成标准化的 SQL 脚本文件，规范团队开发流程。

- **多操作类型** - 支持 FIX（修复）、PUBLISH（发布）、QUERY（查询）
- **自定义配置** - 可配置数据库列表、脚本类型
- **智能命名** - 自动生成带日期和用途的目录名
- **一键打开** - 生成后可立即用编辑器打开

### 🤖 AI 聊天助手

集成多种 AI 大模型，智能对话解答编程问题。

- **多模型支持** - 百炼、Moonshot、智谱、MiniMax、火山引擎、DeepSeek
- **工具调用** - 支持生成 SQL 脚本、密码、时间戳转换等
- **上下文记忆** - 保持对话连贯性
- **快捷访问** - Ctrl+L 快速打开

### 🔐 密码生成器

生成高强度随机密码，保障账户安全。

- **安全随机** - 使用 Crypto API 生成
- **灵活配置** - 大写、小写、数字、特殊字符组合
- **强度检测** - 实时显示密码强度评级
- **历史记录** - 保存最近生成的密码
- **长度调节** - 支持 1-100 位

### ⏰ Cron 表达式生成器

可视化生成 Cron 表达式，告别手动编写。

- **图形化配置** - 秒、分钟、小时、日、月、周、年
- **表达式解析** - 反解析现有表达式
- **执行预览** - 显示最近5次执行时间
- **中文描述** - 自动生成表达式说明

### ⏱️ Unix 时间戳转换器

时间戳与日期时间的便捷互转。

- **实时显示** - 当前秒级和毫秒级时间戳
- **双向转换** - 时间戳转日期、日期转时间戳
- **快速输入** - 支持 YYYYMMDDHHMMSS 格式
- **一键复制** - 结果快速复制

### 📝 YAML 编辑器

YAML 格式编辑、校验与转换。

- **格式化** - 标准缩进格式化
- **语法校验** - 实时错误提示
- **JSON 转换** - YAML 转 JSON，树形展示
- **文件加载** - 本地文件快速加载

### 📋 JSON 解析器

JSON 格式化、校验与可视化。

- **格式化** - 美化 JSON 代码
- **语法校验** - 实时错误检测
- **树形视图** - 结构化展示
- **路径提取** - 快速定位节点

### 🌐 HTML 查看器

HTML 代码实时预览。

- **实时渲染** - 代码即时预览
- **安全沙箱** - 防止恶意脚本执行
- **代码编辑** - 内置编辑器
- **响应式** - 支持不同视口尺寸

### 🗃️ 数据库管理

MySQL 数据库连接与管理。

- **多连接管理** - 支持多个数据库连接
- **连接加密** - 密码安全存储
- **表结构查看** - 浏览数据库表结构
- **数据查询** - 执行 SQL 查询

### 📁 文件管理器

便捷的文件目录浏览与管理。

- **目录浏览** - 浏览脚本存储目录
- **视图切换** - 列表、平铺、紧凑模式
- **时间排序** - 按创建时间排列
- **右键菜单** - 打开、复制路径、查看属性

### 🎨 界面特色

- **现代化 UI** - 毛玻璃设计风格
- **全局搜索** - Ctrl+K 快速搜索工具
- **系统托盘** - 最小化到托盘运行
- **开机自启** - 可配置自动启动
- **自动更新** - 支持自动检测更新
- **快捷键** - 全功能快捷键支持

---

## 📦 安装指南

### 下载安装

从 [Releases](https://github.com/lov3smu/NToolBox/releases) 页面下载对应平台的安装包：

| 平台 | 文件格式 | 说明 |
|:---:|:---:|:---|
| 🪟 Windows | `.exe` (NSIS 安装程序) | 标准 Windows 安装包 |
| 🍎 macOS | `.dmg` / `.zip` | macOS 磁盘镜像和压缩包 |
| 🐧 Linux | `.AppImage` / `.deb` / `.tar.gz` | Linux 通用格式 |

### 系统要求

- **Windows**: Windows 10 或更高版本 (x64)
- **macOS**: macOS 10.15 (Catalina) 或更高版本 (Intel/Apple Silicon)
- **Linux**: Ubuntu 18.04+ 或其他兼容发行版 (x64)
- **内存**: 至少 2GB RAM
- **磁盘空间**: 至少 100MB 可用空间

### 从源码运行

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

按下 `Ctrl+K` 打开全局搜索，快速访问任意工具。

### SQL 脚本生成

1. 打开 SQL 脚本生成器（Ctrl+S）
2. 选择操作类型：FIX / PUBLISH / QUERY
3. 输入脚本用途描述
4. 选择目标数据库
5. 选择脚本类型
6. 点击生成脚本

### AI 聊天助手

1. 打开 AI 聊天（Ctrl+L）
2. 在设置中配置 AI API Key
3. 开始对话，可请求生成脚本、密码等

### 密码生成

1. 打开密码生成器（Ctrl+P）
2. 选择字符类型
3. 调节密码长度
4. 点击生成并复制

---

## 🛠️ 开发指南

### 项目结构

```
NToolBox/
├── assets/                 # 图标和资源文件
├── src/                    # 源代码目录
│   ├── main/               # Electron 主进程
│   │   ├── index.js        # 主进程入口
│   │   ├── ipc/            # IPC 通信
│   │   ├── windows/        # 窗口管理
│   │   ├── ui/             # 菜单、托盘
│   │   ├── services/       # 业务服务
│   │   │   ├── config.js   # 配置管理
│   │   │   ├── generator.js# SQL 脚本生成
│   │   │   ├── updater.js  # 自动更新
│   │   │   ├── chat.js     # AI 聊天
│   │   │   └── database.js # 数据库管理
│   │   ├── utils/          # 工具函数
│   │   └── constants/      # 常量定义
│   ├── preload/            # 预加载脚本
│   └── renderer/           # Vue 渲染进程
│       └── src/
│           ├── views/      # 页面组件
│           │   ├── Dashboard.vue       # 首页
│           │   ├── SqlScriptGenerator.vue # SQL 生成
│           │   ├── Chat.vue            # AI 聊天
│           │   ├── Password.vue        # 密码生成
│           │   ├── Cron.vue            # Cron 生成
│           │   ├── UnixTimestamp.vue   # 时间戳转换
│           │   ├── YamlEditor.vue      # YAML 编辑
│           │   ├── JsonParser.vue      # JSON 解析
│           │   ├── HtmlViewer.vue      # HTML 查看
│           │   ├── Database.vue        # 数据库管理
│           │   ├── FileManager.vue     # 文件管理
│           │   └── Settings.vue        # 设置
│           ├── components/  # 公共组件
│           ├── composables/ # 组合式函数
│           ├── api/         # API 接口
│           ├── config/      # 配置文件
│           ├── styles/      # 样式文件
│           └── router/      # 路由配置
├── .github/
│   └ workflows/
│     └ build.yml           # CI/CD 工作流
├── package.json            # 项目配置
├── electron.vite.config.js # 构建配置
├── LICENSE.txt             # 许可证
└ README.md                 # 说明文档
```

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

### 代码检查

```bash
# 运行 ESLint 检查
npm run lint:check

# 自动修复代码问题
npm run lint
```

---

## 📝 配置说明

### 配置文件位置

- **开发环境**: 项目根目录 `config.json`
- **打包环境**: `%APPDATA%/ntoolbox/config.json` (Windows) 或 `~/.config/ntoolbox/config.json` (Linux/macOS)

### 主要配置项

| 配置项 | 说明 |
|:---|:---|
| `base_path` | SQL 脚本存储根目录 |
| `developer_ch_name` | 开发者中文名 |
| `developer_en_name` | 开发者英文名 |
| `databases` | 数据库列表 |
| `script_types` | 脚本类型配置 |
| `ai_provider` | AI 服务提供商 |
| `ai_api_keys` | 各平台 API Key |
| `dbConnections` | 数据库连接配置 |
| `shortcuts` | 快捷键配置 |
| `auto_update` | 自动更新开关 |
| `auto_start` | 开机自启动开关 |
| `close_action` | 关闭窗口行为 |

### 快捷键配置

| 功能 | 默认快捷键 |
|:---|:---|
| 全局搜索 | Ctrl+K |
| SQL 脚本生成 | Ctrl+S |
| AI 聊天助手 | Ctrl+L |
| 密码生成器 | Ctrl+P |
| Cron 表达式 | Ctrl+Shift+C |
| 时间戳转换 | Ctrl+Shift+T |
| YAML 编辑器 | Ctrl+Shift+Y |
| 文件管理器 | Ctrl+Shift+F |
| JSON 解析器 | Ctrl+J |
| HTML 查看器 | Ctrl+H |
| 设置 | Ctrl+, |

---

## 🔧 技术栈

| 技术 | 说明 |
|:---|:---|
| [Electron](https://www.electronjs.org/) | 跨平台桌面应用框架 |
| [Vue 3](https://vuejs.org/) | 渐进式 JavaScript 框架 |
| [Vite](https://vitejs.dev/) | 下一代前端构建工具 |
| [electron-vite](https://electron-vite.org/) | Electron Vite 构建方案 |
| [Vue Router](https://router.vuejs.org/) | Vue.js 官方路由 |
| [electron-builder](https://www.electron.build/) | 应用打包工具 |
| [electron-log](https://github.com/megahertz/electron-log) | 日志记录 |
| [electron-updater](https://github.com/electron-userland/electron-updater) | 自动更新 |
| [mysql2](https://github.com/sidorares/node-mysql2) | MySQL 客户端 |
| [js-yaml](https://github.com/nodeca/js-yaml) | YAML 解析 |
| [CodeMirror](https://codemirror.net/) | 代码编辑器 |

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