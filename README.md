# SQL Script Generator

<p align="center">
  <img src="assets/icon.png" width="120" height="120" alt="SQL Script Generator Logo">
</p>

<p align="center">
  <strong>SQL 脚本生成工具</strong> - 快速生成符合规范的 SQL 脚本文件
</p>

<p align="center">
  <a href="https://github.com/lov3smu/sql-script-generator/releases">
    <img src="https://img.shields.io/github/v/release/lov3smu/sql-script-generator?style=flat-square" alt="Release">
  </a>
  <a href="LICENSE.txt">
    <img src="https://img.shields.io/github/license/lov3smu/sql-script-generator?style=flat-square" alt="License">
  </a>
</p>

---

## ✨ 功能特性

### 🚀 核心功能

- **快速生成 SQL 脚本** - 通过简洁的图形界面，快速生成标准化的 SQL 脚本文件
- **多操作类型支持** - 支持 FIX（修复）、PUBLISH（发布）、QUERY（查询）三种操作类型
- **自定义数据库配置** - 可配置多个数据库连接信息
- **自定义脚本类型** - 支持配置多种脚本类型和描述
- **智能目录命名** - 自动生成带日期和用途的目录名
- **一键打开文件** - 生成后可立即用系统默认编辑器打开

### 🔐 密码生成器

- **安全随机密码** - 使用 Crypto API 生成高强度随机密码
- **灵活字符配置** - 支持大写字母、小写字母、数字、特殊字符组合
- **密码强度检测** - 实时显示密码强度评级
- **历史记录** - 保存最近生成的密码，支持一键复制
- **拖拽调节长度** - 支持 1-100 位密码长度调节

### ⏰ Cron 表达式生成器

- **可视化生成** - 通过图形界面生成 Cron 表达式
- **字段配置** - 支持秒、分钟、小时、日、月、周、年配置
- **表达式反解析** - 支持解析现有 Cron 表达式
- **执行时间预览** - 显示最近5次执行时间
- **快捷键配置** - 可自定义各功能快捷键

### 📄 SQL 模版生成器

- **常用模版** - 提供常用 SQL 语句模版
- **分类管理** - 模版按基础操作、查询、DDL、DML分类
- **快速复制** - 一键复制模版内容

### 🎨 界面特色

- **现代化 UI** - 采用毛玻璃设计风格，简洁美观
- **动态宽度** - 页面宽度自适应窗口大小（最大90%屏幕宽度）
- **系统托盘** - 支持最小化到系统托盘
- **开机自启动** - 可配置开机自动运行
- **启动动画** - 加载时显示 splash 动画

---

## 📦 安装指南

### 下载安装

从 [Releases](https://github.com/lov3smu/sql-script-generator/releases) 页面下载对应平台的安装包：

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
git clone https://github.com/lov3smu/sql-script-generator.git
cd sql-script-generator

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

---

## 🚀 快速开始

### 生成 SQL 脚本

1. **启动应用** - 运行 SQL Script Generator
2. **选择操作类型** - 点击 FIX / PUBLISH / QUERY 选择操作类型
3. **填写脚本用途** - 输入脚本用途描述
4. **选择数据库** - 从下拉列表选择目标数据库
5. **选择脚本类型** - 选择合适的脚本类型（FIX/PUBLISH 时）
6. **生成脚本** - 点击"🚀 生成脚本"按钮
7. **查看结果** - 脚本文件将自动生成并显示路径

### 使用密码生成器

1. **打开密码工具** - 点击菜单栏"工具" → "密码生成器" 或托盘菜单
2. **选择字符类型** - 勾选需要的字符类型（大写、小写、数字、特殊字符）
3. **调节密码长度** - 拖拽滑块或输入长度（1-100）
4. **生成密码** - 点击"🔄 生成密码"按钮
5. **复制使用** - 点击复制按钮或从历史记录中选择

### 使用 Cron 表达式生成器

1. **打开 Cron 工具** - 点击菜单栏"工具" → "Cron表达式生成器"
2. **选择字段** - 点击秒/分钟/小时等标签页
3. **配置规则** - 选择"每"、"周期"、"循环"、"指定"等规则
4. **查看结果** - 自动生成 Cron 表达式和描述
5. **复制使用** - 点击复制按钮

---

## 🛠️ 开发指南

### 项目结构

```
sql-script-generator/
├── assets/                 # 图标和资源文件
├── electron/               # Electron 主进程代码
│   ├── main.bundle.js      # 主进程入口（打包版）
│   ├── main.js             # 主进程入口（开发版）
│   ├── preload.js          # 预加载脚本
│   ├── config.js           # 配置管理
│   ├── ipc.js              # IPC 通信
│   ├── tray.js             # 系统托盘
│   ├── menu.js             # 应用菜单
│   ├── generator.js        # SQL 生成逻辑
│   ├── updater.js          # 自动更新
│   └── autostart.js        # 开机自启动
├── public/                 # 公共静态资源
│   └── splash.html         # 启动加载页面
├── src/                    # Vue 源代码
│   ├── views/              # 页面组件
│   │   ├── Home.vue        # 主页面
│   │   ├── Settings.vue    # 设置页面
│   │   ├── Password.vue    # 密码生成器
│   │   ├── Cron.vue        # Cron 表达式生成器
│   │   └── Template.vue    # SQL 模版生成器
│   ├── styles/             # CSS 样式文件
│   │   └── base.css        # 基础样式
│   ├── router/             # Vue Router 配置
│   ├── App.vue             # 根组件
│   └── main.js             # Vue 入口
├── .github/                # GitHub 配置
│   └── workflows/          # CI/CD 工作流
│       └── build.yml       # 构建发布流程
├── package.json            # 项目配置
├── vite.config.js          # Vite 配置
└── README.md               # 说明文档
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

---

## 📝 配置说明

应用配置文件存储在应用安装目录下：

- 配置文件路径：`安装目录/config.json`

配置项包括：
- `base_path` - 脚本存储根目录
- `developer_ch_name` - 开发者中文名
- `developer_en_name` - 开发者英文名
- `text_edit_app` - 外部文本编辑器路径
- `databases` - 数据库列表
- `script_types` - 脚本类型列表
- `shortcuts` - 快捷键配置
  - `home` - 首页快捷键
  - `password` - 密码生成器快捷键
  - `cron` - Cron 生成器快捷键
  - `template` - SQL 模版快捷键
  - `settings` - 设置快捷键
- `auto_update` - 自动更新开关
- `auto_start` - 开机自启动开关
- `close_action` - 关闭窗口行为（ask/hide/quit）

---

## 🔧 技术栈

- **[Electron](https://www.electronjs.org/)** - 跨平台桌面应用框架
- **[Vue 3](https://vuejs.org/)** - 渐进式 JavaScript 框架
- **[Vite](https://vitejs.dev/)** - 下一代前端构建工具
- **[Vue Router](https://router.vuejs.org/)** - Vue.js 官方路由
- **[vite-plugin-electron](https://github.com/electron-vite/vite-plugin-electron)** - Vite Electron 插件
- **[electron-builder](https://www.electron.build/)** - 应用打包工具
- **[electron-log](https://github.com/megahertz/electron-log)** - 日志记录
- **[electron-updater](https://github.com/electron-userland/electron-updater)** - 自动更新

---

## 📄 许可证

本项目基于 [MIT 许可证](LICENSE.txt) 开源。

---

## 👨‍💻 作者

**lov3smu** - [imancoka@gmail.com](mailto:imancoka@gmail.com)

GitHub: [@lov3smu](https://github.com/lov3smu)

---

## 🙏 致谢

感谢所有为这个项目提供建议和帮助的朋友们！

如果您觉得这个项目对您有帮助，请给个 ⭐ Star 支持一下！