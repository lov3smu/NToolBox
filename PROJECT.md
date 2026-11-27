# NToolBox 项目开发规范

本规范约束 NToolBox 的日常开发。架构速览与命令清单见 [AGENTS.md](./AGENTS.md)，两者冲突时以本规范为准。

## 1. 技术栈

- Electron + Vue 3 + electron-vite；主进程为 **ESM**（禁止 CommonJS）
- 测试：vitest（node 环境，测试位于 `tests/`）
- 包管理：npm；不引入 pnpm/yarn workspace

## 2. 代码风格

### 2.1 格式化（Prettier）

配置见 `.prettierrc`，作用于 `src/**/*.{js,vue,ts,json,css,html}`：

- 单引号、无分号、2 空格缩进、无尾逗号、行宽 120
- Vue SFC 的 `<script>` / `<style>` 内容不做额外缩进（`vueIndentScriptAndStyle: false`）
- 格式化由 `npm run format` 写入、`npm run format:check` 校验；不要手写与 Prettier 冲突的换行

### 2.2 静态检查（ESLint flat config）

配置见 `eslint.config.js`（CommonJS），由 `@eslint/js` recommended、`eslint-plugin-vue` flat/recommended 与 `eslint-config-prettier` 组合：

- 检查范围为 `src` 下的 `.vue` 文件（SFC 脚本块）；根级 `*.js` 在 ignores 中整体跳过，纯 JS 模块依赖 Prettier、单元测试与运行时验证兜底
- 基线规则均为 warn（不阻断构建，但新增代码不得留存量）：`no-unused-vars`、`prefer-const`、`no-var`、`eqeqeq`（`== null` 例外）、`no-multiple-empty-lines`（最多 1 行空行）
- 项目豁免：允许单词组件名、允许 `v-html`（内容必须自行净化）、不强制 prop 默认值、允许保留组件名
- 全局变量白名单仅含 browser / Node / Electron 常用项；使用新的全局对象前先登记，不依赖隐式全局
- 提交前必须通过：`npm run lint:check`、`npm run format:check`、`npm run test`

### 2.3 模块与导入

- 主进程为 ESM；`electron.vite.config.js` 等构建配置仍为 CommonJS，改动时不得混用 `import` / `require`
- 主进程引用共享契约用相对路径（`../../shared/xxx.js`）；渲染层用别名 `@/`（`src/renderer/src`）与 `@shared`（`src/shared`），不写深层相对路径
- 渲染层禁止导入 `node:*` 模块；路径拼接用 `utils/path.js` 的 `joinPath`
- 组合式函数放 `composables/`，经 `composables/index.js` 汇总导出（`useConfig`、`useToast` 等），页面按 barrel 导入
- 跨进程共享的枚举、默认值、`normalizeXxx` 只放 `src/shared/`（见 §3），禁止主进程与渲染层各维护一份
- 渲染层配置异步加载：`useConfig` 初始值为 `null`，加载完成前所有嵌套读取必须用可选链（如 `config.value?.app?.recent_tools_limit`）并给出默认值；禁止直接解引用 `config.value.app / .database / .ai`——首屏渲染异常会中断路由过渡链，导致整窗空白
- 界面文案一律经 `t()` 获取（键为中文原文，见 §8），组件模板与脚本中不散落硬编码可见文案

### 2.4 注释与日志

- 默认不写注释；仅在「为什么」不显然时写一行（隐藏约束、时序依赖、平台差异、旧配置兼容）
- 不写解释「代码在做什么」的注释，也不写关联当前任务或提交的注释
- 禁止遗留 `console.log` 调试日志；主进程日志统一走 `electron-log`（`src/main/utils/logger.js`），需用户感知的结果用 Toast / 通知
- ESLint 未启用 `no-console`（构建脚本允许输出），业务代码仍受上述约束

### 2.5 实现边界

- 不做超出任务范围的重构；不为假设的未来需求添加抽象、兼容垫片或开关
- 优先修改现有文件，不因小改动新增模块；同一逻辑出现第三次之前不急于抽象
- 新增第三方依赖需先说明理由并征得同意（见 §5）

## 3. 命名规范

| 对象        | 规则                            | 示例                                           |
| ----------- | ------------------------------- | ---------------------------------------------- |
| 组件文件    | PascalCase.vue                  | `ImageHostSettingsPanel.vue`                   |
| 组合式函数  | useXxx.js（经 barrel 导出）     | `useConnectionActions.js`                      |
| 共享契约    | src/shared/小驼峰.js            | `aiBehavior.js`、`pluginBundle.js`             |
| 共享常量    | SCREAMING_SNAKE                 | `IMAGE_HOST_PROVIDERS`、`AUTO_SAVE_KINDS`      |
| 归一化函数  | normalizeXxx                    | `normalizeImageHostSettings`                   |
| IPC 通道    | 小写冒号域分隔                  | `db:query`（见 `shared/ipc.js`）               |
| i18n 文案键 | 中文原文整句（占位符 `{name}`） | `t('备份完成')`、`t('{name} 已备份到 {file}')` |
| CSS 类      | kebab-case，页面级加命名空间    | `.ihs-field`、`.setting-row`                   |
| 设计 token  | `--域-名称`                     | `--accent-color`、`--surface-muted`            |
| 测试文件    | 被测域名.test.js                | `ipcContract.test.js`、`config.test.js`        |

- 跨进程共用的枚举、选项、默认值与 `normalizeXxx` 纯函数一律放 `src/shared/`，由配置归一化与渲染层共同引用，禁止在主进程/渲染层各维护一份。
- 同一个共享模块的常量与归一化函数同文件导出（如 `shared/notifications.js` 提供 `NOTIFICATION_ITEMS` + `normalizeNotificationConfig`），不拆两份清单。

## 4. Git 规范

- 提交信息：`type(scope): 中文描述`，type 取 `feat / fix / docs / style / refactor / test / chore`
- **未经明确要求不创建 commit**；不使用 `--no-verify` 跳过钩子
- 不 force push 主干分支；合并冲突必须手动解决，禁止丢弃他人改动

## 5. 依赖管理

- **禁止随意新增第三方依赖**；确需引入时先说明理由并征得同意
- 主进程新外部模块必须同步加入 `electron.vite.config.js` → `main.build.rollupOptions.external`
- 优先使用现有依赖能力（如 mysql2、electron 内置模块）解决问题

## 6. 跨平台要求

所有代码必须同时支持 Windows / Linux / macOS：

- 路径：主进程用 `path.join / path.resolve / path.sep`；渲染层用 `src/renderer/src/utils/path.js` 的 `joinPath`，禁止手拼分隔符
- 开发模式判定用 `process.env.ELECTRON_RENDERER_URL`，不用 `!app.isPackaged`
- Shell 命令按 `process.platform` 分支；Windows 专属命令（`cmd /c`、powershell）必须有 POSIX 等价实现
- 渲染层传入的路径必须先过 `isPathWithinBase`（`src/main/utils/sanitize.js`）
- 平台受限 API（如 `app.setLoginItemSettings`）必须加平台守卫并注释降级行为
- 图标经 `getAssetsDir()/getIconPath()/getWindowIcon()` 解析，不硬编码路径

## 7. UI 设计规范

整体风格：紧凑、克制、主题化的桌面工具界面。信息优先、装饰最小；配置项统一为「标签 + 副说明 + 右侧控件」横向行；同类场景复用设计系统，不引入一次性样式。

### 7.1 设计 token（`src/renderer/src/styles/base.css`）

- 字号（均乘 `--font-scale`）：`--font-size-xl` 24 / `lg` 18 / `md` 16 / `base` 14 / `dense` 13 / `sm` 12 / `xs` 11；等宽字体统一 `--font-mono`
- 图标：`--icon-size-*`（48/32/24/20/16/14）；通用线性图标用 `components/AppIcon.vue`（`icons/index.js` 命名图标集，默认 `stroke-width: 2`、圆角端点），禁止再复制内联 SVG；工具入口图标仍取 `navTools.icon`
- 控件高度：`--control-height` 32px、`-xl` 40px、`-lg` 36px、`-sm` 28px、`-xs` 24px
- 圆角：`--radius-xs` 4 / `sm` 6 / `md` 8 / `lg` 12 / `pill` 999；阴影 `--shadow-sm/md/lg/glow`；动效 `--motion-*`；加载 `--spinner-*`
- 强调色 `--accent-color`（品牌紫）仅用于焦点、选中、主按钮与小面积强调；success / warning / error 仅表达对应语义
- 禁止页面内硬编码字号、圆角、颜色、阴影；禁止硬编码浅色，颜色必须走主题变量，保证暗色主题可用
- 允许的局部颜色例外（须以自包含调色板 / 数据映射形式提供，不随主题切换）：Markdown 预览排版调色板（`--md-*`）、代码编辑器的明暗语法主题映射、服务商与工具品牌标识、图表与用量可视化、装饰性插图、主题/外观预览色板、导出物固色（独立 HTML、微信排版等离线产物）、可配置数据调色板（工作区分组色、连接标记色等）；新增例外须说明理由
- 动画必须尊重 `prefers-reduced-motion: reduce`

### 7.2 字号层级

| 层级     | 规格                                                                        |
| -------- | --------------------------------------------------------------------------- |
| 页面标题 | 工具页 h1 `--font-size-lg` / 600；设置页 h2 `--font-size-md` / 600–650      |
| 分组标题 | `--font-size-base` / 600                                                    |
| 行标签   | `--font-size-dense` / 500 / 主文字色                                        |
| 描述文字 | `--font-size-sm` / 400 / `--text-tertiary` / 行高 1.5                       |
| 辅助标签 | `--font-size-xs` / 400 / `--text-tertiary`（标签、副标题、等宽标识）        |
| 字段标签 | `--font-size-xs` / 600 / `--text-tertiary`（表单字段行统一 `.field-label`） |

描述文字直接展示在标签下方，**不用问号图标折叠**。

### 7.3 页面壳层与布局

- 主窗口 = 自绘标题栏（`AppTitleBar` + `WindowControls`）+ 注册表驱动的左侧导航（`AppShell`）+ 内容区；工具页统一使用 `layouts/PageLayout.vue`
- `PageLayout`：页头（图标 + 标题 + 副标题，右侧 `header-extra`）+ 可选工具栏（`actions` 插槽）+ 可滚动内容区；≤900px 左右内边距收紧
- 设置页（`views/Settings.vue`）：左侧菜单（返回应用 + 分组标签）+ 内容区；页头（标题 + 一句说明）与标签内容统一 `max-width: 1120px` 居中
- 设置标签顺序按功能分组：通用/外观/快捷键 → 模型/AI 助手/网络 → 数据库客户端/SQL 脚本生成/图床配置 → 扩展管理/关于；新增标签按语义插入对应分组，不追加到末尾
- 页面根容器负责 `min-width: 0` 与滚动，不得用 `overflow-x: hidden` 掩盖真实的横向溢出；标准滚动容器（`page-content` / `nav-scroll` / `settings-content`）可同时锁定横向滚动，用于抑制滚动链与横向回弹，不视为掩盖溢出

### 7.4 通用控件

- 开关一律用全局 `.switch`（36×20 轨道 + 滑块）；多选 / 勾选场景使用主题化复选框（`base.css` 全局 `input[type='checkbox']:not(.switch)`），禁止自定义外观或退回 `accent-color`
- 复选框内置未选 / 选中 / 半选（`indeterminate`）/ 聚焦 / 禁用状态，整表或分组全选可用半选表达，不得另造选中图标或伪元素勾选
- 单选场景一律用 `components/RadioOption.vue`（`v-model` + `value`，变体 `default | block | pill`），主题样式来自 `base.css` 全局 `input[type='radio']`；禁止直接写裸 `input[type='radio']` 或 `accent-color`
- 按钮统一 `.btn` 体系（`btn-primary/secondary/ghost/danger`），同区域高度一致（默认 32px），不混用 `btn-sm`；主操作每屏至多一个
- 输入框统一用 `AppInput`（单行）/ `AppTextarea`（多行）：内置 `.input-field` / `.app-textarea` 基础样式与五档尺寸，可选前后缀、清除、等宽、对齐等能力（见 §7.14）；页面不得裸写基础输入样式或在页面覆盖高度 / 边框 / 焦点环，既有裸写输入框按 §7.14 在修改或复用时迁移；密码类输入配「显示 / 隐藏」按钮
- 下拉：新页面与需要自定义选项的场景用 `AppSelect`（选项说明、禁用项、键盘操作，见 §7.14）；工具条等紧凑原生下拉沿用全局 `select` / `.select-field`（含主题箭头，紧凑场景 `.select-field-sm`），禁止用 `background` 简写覆盖箭头或另写一套边框焦点样式；设置页下拉按 §7.8 使用 `SettingSelect` / `SettingModelPicker`
- 边框规则：卡片外框实线 `1px solid var(--border-color)`，卡片内部分隔线（分组头底部、行与行之间）用 `1px dashed var(--border-color)`
- 交互元素必须有 `:focus-visible` 焦点样式；纯图标按钮必须带 `title` / `aria-label`
- 通用控件的尺寸统一走 §7.14 的 `size` 五档（`xl/lg/md/sm/xs`），页面不得再写局部高度 / 字号覆盖
- 控件能力不足以满足需求时，必须按 §7.14 的通用化要求处理：优先为控件补充可选能力（props / slots / 事件）实现，禁止在页面里复制控件、覆盖基础样式或写一次性特判

### 7.5 设置页设计系统

```html
<section class="setting-section">
  <div class="setting-section-head">
    <h3 class="setting-section-title">分组标题</h3>
    <span class="setting-section-desc">分组说明</span>
  </div>
  <div class="setting-section-body">
    <div class="setting-row">
      <div class="setting-row-text">
        <span class="setting-row-label">标签</span>
        <span class="setting-row-desc">说明文字</span>
      </div>
      <div class="setting-row-control"><!-- 控件右对齐 --></div>
    </div>
  </div>
</section>
```

- 行网格 `minmax(200px, 320px) 1fr`；修饰类 `is-top`（控件较高时顶端对齐）、`is-block`（描述与控件各自成行，用于主题、选项网格等大控件区）
- 嵌入卡片的行（`.provider-field > .setting-row` 等）自身无内边距，由卡片体提供间距
- 断点：≤900px 卡片内嵌套行先堆叠；≤720px 全部行堆叠、控件左对齐并占满宽度
- 设置页样式为 scoped；子组件需要同一视觉时，在组件内用 token 提供等价样式，不得依赖父组件作用域

### 7.6 服务商卡片

模型页与图床配置共用同一卡片模式：

- 可折叠卡片：头部 = 名称 + 等宽标识 + 状态标签（已配置/未配置、当前/默认、自定义、未保存）+ 文档链接 + 「编辑 / 收起」；展开动画用 `grid-template-rows: 0fr → 1fr`
- 展开体 = 服务商说明 + 横向字段行（密钥、地址、仓库等）+ 校验提示（如「还需要填写：…」）+ 连通性测试结果
- 卡片底部操作：左侧放测试等次要操作，右侧 `还原`（secondary）与 `保存`（primary）；破坏性操作（移除服务商）置最左并使用 `btn-danger`
- 无未保存改动时禁用还原/保存；保存只写入当前卡片，不连带其他卡片的未保存内容
- 新增服务商配置必须复用该卡片结构，不另起一套表单样式

### 7.7 设置项保存与校验

- 设置页默认自动保存：开关、下拉选择后自动保存（约 400ms 防抖）；文本输入在失焦时保存；切换标签、关闭设置页、组件卸载前强制冲刷
- 按标签分组保存，并以状态快照去重；输入过程中不写盘，避免频繁触发配置副作用
- 每组保存前校验（如温度区间、代理地址格式、脚本重名等）：非法值阻止该组保存，强制冲刷时以 Toast 提示
- 服务商、图床等卡片保留显式「保存 / 还原」，卡片内编辑不随设置页自动保存
- 自动保存成功默认静默；卡片保存与失败场景必须有可见反馈

### 7.8 下拉与选择控件

- 设置页禁止使用原生 `<select>`、`datalist`（系统弹层无法主题化，长列表卡顿）
- 单选下拉用 `components/settings/SettingSelect.vue`（选项支持标题 + 副说明、当前项打勾，支持键盘方向键 / Enter / Esc）
- 模型选择用 `components/settings/SettingModelPicker.vue`（`provider:model`，输入即过滤、允许自由文本、无匹配时提示）
- 弹层统一 Teleport 到 `body`、`position: fixed`、z-index 1200，宽度跟随触发器，空间不足自动向上翻转；Esc / 点击外部 / 弹层滚动均关闭；弹层内容超出可用空间时内部滚动，不得超出窗口（见 §7.13）

### 7.9 主题与字体缩放

- 配置键：`appearance.theme`（system/light/dark）、`appearance.theme_style`（sapphire/forest/mint/bee/parchment）、`appearance.font_size`（small~xlarge），经 `src/renderer/src/utils/theme.js` 应用到 `<html>` 的 `data-theme` / `data-theme-style` / `data-font-size` 与 `--font-scale`
- 切换字体大小时临时设置 `data-font-size-changing` 以关闭过渡，不得移除该保护
- 新增影响窗口外观的配置必须调用 `refreshWindowTheme()`

### 7.10 反馈、空态与弹窗

- Toast 全局唯一实现（`components/Toast.vue`，success/error/warning/info/loading），文案短、单一职责
- 空态与加载态居中展示；空态应给出下一步入口（按钮或跳转设置）
- 确认与消息弹窗统一用 `components/MessageDialog.vue`，禁止 `window.confirm / alert / prompt`；关于、更新、插件安装等弹窗沿用设计系统
- 危险操作使用 `btn-danger` 并在文案中说明后果
- 含表单输入或编辑项（新建、编辑、配置、参数录入、提示词等）的弹窗，不得因点击遮罩、失焦、滚动而自动关闭；必须由用户显式关闭（关闭 / 取消 / 保存按钮或 Esc）。只读查看、搜索 / 命令面板等无编辑内容的弹窗才允许点外关闭
- 使用 `v-modal-shell` 的输入型弹窗必须传 `{ onClose, closeOnOutside: false }`（指令默认点外关闭）；非指令弹窗不得在遮罩上绑定 `@click.self` 关闭
- 输入型弹窗必须提供显式关闭入口（关闭 / 取消按钮），不得只依赖点外关闭或 `Esc`

### 7.11 功能页与配置分离

- 功能页只承载操作与结果，配置集中在设置页对应标签（如 图床 页面只做上传与历史，服务商配置在 设置 → 图床配置）
- 配置缺失时，功能页给出引导入口（跳转到 `/settings?tab=...`），不在功能页重复配置表单

### 7.12 动效

- 统一使用 `--motion-*` token；页面/标签切换、卡片展开、Toast 进出场保持 150–250ms
- `prefers-reduced-motion: reduce` 下关闭所有非必要过渡与动画

### 7.13 浮层、菜单与弹窗定位

- 所有浮层（下拉、菜单、右键菜单、气泡卡片、对话框）必须完整留在窗口可视区内，任何情况下不得超出窗口被裁切
- 默认在浮层根节点加全局指令 `v-clamp-viewport`（实现见 `src/renderer/src/utils/clampViewport.js`，在 `main.js` 注册）：以 8px 为边距，越界时用 `translate` 平移回窗口内，超出可用宽高时收缩 `max-width / max-height` 并允许内部滚动；挂载后延迟 120ms 与窗口 `resize` 时重新校正；可选参数覆盖边距，如 `v-clamp-viewport="12"`
- 校正类供方向相关样式使用：`is-clamped-x` 表示右缘越界已向左平移（数据库子菜单改为向左展开、箭头翻转），`is-clamped-y` 表示下缘越界已向上平移（子菜单改为向上展开）
- 自带定位能力的组件（`SettingSelect.vue`、`SettingModelPicker.vue`、`HoverPopover.vue`）已在内部完成视口约束，不得再叠加该指令
- 模态对话框内容超高时在卡片内滚动：`max-height: calc(100vh - 32px); overflow-y: auto`，不得压缩内边距或截断内容
- 整屏模态层（overlay 铺满窗口的对话框）以卡片 `max-height` 内部滚动等价实现视口约束，不再叠加 `v-clamp-viewport`；该指令只用于菜单、气泡、下拉等非整屏浮层
- 气泡卡片 `HoverPopover.vue` 的 `placement` 支持 `top|bottom|left|right` 与 `-start|-center|-end` 组合，空间不足时自动翻转到对侧；需要「不得覆盖指定区域」时传 `boundary` 选择器（如 `boundary=".chat-rail"`）：卡片固定在边界外侧 `offset`（默认 8px）处，空间不足时收缩自身宽度，绝不翻转回边界内侧。工作区气泡卡片必须位于会话栏宽度之外，禁止盖住工作区内容
- 层级约定：页面内浮层 1000，下拉 / 气泡 / 弹层 1200，右键菜单 2000（子菜单 2001），模态遮罩与消息弹窗 9999，Toast 10000；新增浮层沿用既有层级，不任意放大
- 浮层改动必须在隔离实例中验证宽窗 / 窄窗、明暗主题、贴窗口四边等场景（见 §15）

### 7.14 通用组件复用与尺寸

- 两个及以上页面出现相同或近似的结构、交互或视觉（列表行、卡片、工具条、表单行、选择器、空态、步骤向导、弹窗等），必须抽成通用组件，页面只传数据与事件；禁止复制模板与样式。已有通用组件优先扩展，不为同一效果再写一套
- **现有组件不满足需求时，必须考虑并优先实现更通用的解决方案**：先评估为该组件补充可选 props / slots / 事件（新增能力必须有默认值，现有调用行为与渲染保持不变），在隔离实例中验证可行后再落地；通用性的判断标准是其他页面无需页面专属参数即可直接复用。禁止为该页面写一次性变体、复制一份组件、在页面覆盖基础样式或加页面专属特判。只有当通用化会破坏既有语义、显著增加维护成本或引入不可控耦合时，才允许新增独立组件，并在提交说明中写明取舍理由
- 组件放置：跨页面用 `components/`，仅设置页用 `components/settings/`，仅数据库页用 `views/database/components/`；通用组件不得依赖页面作用域样式
- 所有通用组件统一通过 `size` prop 支持五档：`xl` 特大 / `lg` 大 / `md` 中（默认）/ `sm` 小 / `xs` 特小；根节点输出对应 `is-xl` / `is-lg` / `is-md` / `is-sm` / `is-xs` 修饰类，未传 `size` 时保持 `md`，向后兼容
- 档位只影响高度、字号、内边距与图标大小，不改变结构、配色与交互；尺寸取自 token，禁止组件内硬编码：

| 档位 | `size` | 控件高度                   | 字号               | 图标 |
| ---- | ------ | -------------------------- | ------------------ | ---- |
| 特大 | `xl`   | 40px `--control-height-xl` | `--font-size-base` | 20   |
| 大   | `lg`   | 36px `--control-height-lg` | `--font-size-base` | 20   |
| 中   | `md`   | 32px `--control-height`    | `--font-size-sm`   | 16   |
| 小   | `sm`   | 28px `--control-height-sm` | `--font-size-sm`   | 16   |
| 特小 | `xs`   | 24px `--control-height-xs` | `--font-size-xs`   | 14   |

- 同一工具条或表单区域使用同一档位；紧凑场景选 `sm`/`xs`，不得在页面里覆盖通用组件的 padding、高度、字号来「凑效果」
- 五档共享同一套焦点态、禁用态、主题与可访问性行为（`:focus-visible`、`title` / `aria-label`），不得只为某一档另写交互
- 表单文本输入统一使用 `AppInput` / `AppTextarea`（内置 `.input-field` / `.app-textarea` 基础样式与五档），页面只追加布局类；不得再复制边框、圆角、焦点环等基础样式；既有裸写输入框在修改或复用时迁移，不要求一次性全量替换
- `AppInput` 可选能力：`prefixIcon` / `suffixIcon` 与 `prefix` / `suffix` 插槽（前后缀预留宽度按实测写入 CSS 变量，文字或按钮插槽不会压住输入内容）、`clearable`（清除按钮带「清除」标题与 `aria-label`，点击后回焦）、`mono`、`align`（`left|center|right`）、`fieldClass`（外壳布局类）。`class` / `id` 等属性透传到内部 `<input>`，外壳类必须走 `fieldClass`；支持 `v-model` 修饰符 `trim` / `number` / `lazy`，IME 组合输入期间不派发中间值
- `AppTextarea` 可选能力：`invalid`、`mono`、`autoGrow`（`field-sizing: content`，随内容增高并禁用纵向拖拽）
- `AppSelect` 可选能力：`options` 支持字符串或 `{ value, label, description, disabled }`；`description` 渲染为选项副说明；禁用项不可选中、键盘导航跳过，打开时高亮落到首个可用项并把当前项滚入可视区；面板 Teleport 到 `body`（z-index 1200），空间不足自动上下翻转并限制在视口内；支持方向键 / Enter / Space / Esc 与空态提示；设置页下拉仍用 `SettingSelect` / `SettingModelPicker`
- 现存通用组件（`AppIcon`、`RadioOption`、`MessageDialog`、`SettingSelect`、`SettingModelPicker`、`HoverPopover`、`AppInput`、`AppTextarea`、`AppSelect` 等）在被修改或复用时补齐 `size`；规范生效后新增的通用组件必须一次实现五档
- 通用化能力落地时同步更新本节与 `AGENTS.md`，并补 props 默认值、修饰类输出与关键交互（清除、禁用项跳过、键盘选择）的测试；复用与尺寸改动必须在隔离实例中按五档 × 明暗主题截图验收（见 §15）

### 7.15 间距与高度基线

页面不得逐页发明间距与控件高度，以下数值为全应用基线（超出范围用 token，不写裸数值）：

- **页面纵向节奏**：`page-body` 内直接子块（面板、网格、工具条区）间距 12px。用容器 `gap: 12px` 或 `.panel + .panel` 的 12px 外边距二者之一实现；两者同时存在时必须把面板 `margin-top` 归零，禁止叠加成 24px
- **面板内部**：堆叠区（表单、工具条组）`gap: 12px`；卡片/列表行之间 `gap: 8px`；双列字段网格 `gap: 12px`（行列同值）；字段标签与控件间距 6px（字段组 `gap: 6px`）
- **字段行**：标签统一 `.field-label`（§7.2），直接放在字段组首行；字段组为 `flex column`，组内只有标签 + 控件，禁止在字段组内再套一次带 margin 的包装
- **控件高度**：只用 §7.14 五档 token（40/36/32/28/24）。同一水平带（工具条、动作行、卡片头、列表行）内所有控件等高；页面工具栏与卡片/列表行内操作取 `sm`，面板表单动作行取 `md`（与同区输入一致）。禁止 26px 等硬编码高度，禁止用「chip 26 + 按钮 32」混排
- **选择型 chip / tab**：默认态 `--surface` + `--border-color`、选中态实心 `--accent-color` + `--btn-primary-text`、圆角 `--radius-sm`、高度 `--control-height-sm`、`--font-size-xs`，并同步 `aria-pressed` 与 `:focus-visible` outline。禁止用「浅底 + 强调色文字」充当选中态，禁止外观与 `Cron.vue` 的切换按钮不一致
- **状态与提示块**：行内错误 / 提示 `padding: 8px 10px`、`--radius-sm`；带操作的提示卡 `10px 12px` + `--radius-md`。整页错误条与行内错误条同一套 token（error 8% 底、25% 边框），不得一个用 12px 内边距、另一个用 10px
- **文本域高度**：由内容类型定 min-height（填充型 320–340、常规 200–220、紧凑 70–80），不在页面写死 `height`，也不在页面覆盖通用组件的 padding / 字号
- 行内小按钮与同排按钮同档：复制按钮、图标按钮与相邻按钮取同一 `size`，不得 28 + 24 混排

## 8. 多语言（i18n）

- 支持 `zh-CN`（默认）与 `en-US`；语言配置键为 `appearance.language`，由 `src/main/services/config.js` 经 `normalizeLocale` 归一化，非法值回落默认语言
- **键即中文原文**：渲染层 `src/renderer/src/i18n.js` 提供 `t / getLocale / setLocale / initLocale`，主进程 `src/main/services/i18n.js` 提供同构 `t / getLocale / setLocale`；调用形如 `t('备份完成')`，不使用语义点分键
- 英文词条按域拆分在 `src/shared/locales/en-US/*.js`（common/shell/settings/extensions/tools/pages/chat/database/main/services），由 `index.js` 合并；新增或修改 `t('…')` 文案必须同步补英文词条，占位符名称与数量必须与中文键一致
- 共享契约（`src/shared/*.js`）只输出带 `{p0}` 等占位符的中文模板，不直接调用 `t()`；由渲染层或主进程在消费处翻译
- 语言状态：渲染层为响应式 `locale` ref 并用 localStorage `ntb_locale` 兜底，`App.vue` 在配置变更时重新 `setLocale` 即时生效；主进程在启动时读取已加载配置同步语言
- 新增语言 = `shared/i18n.js` 的 `LOCALE_VALUES` / `LOCALE_OPTIONS` + 完整 `src/shared/locales/<locale>/` 目录 + 两套运行时同步 + 覆盖测试；不得只翻译部分界面
- 禁止：模板/脚本硬编码可见 UI 文案、拼接已翻译片段（应按整句作为键）、翻译或改写英文目录的键名

## 9. IPC 契约流程

新功能必须四处同步，缺一不可（`tests/ipcContract.test.js` 会校验）：

1. `src/shared/ipc.js`：新增 channel + method（通道名与 `IPC_METHODS` 方法名）
2. `src/main/ipc/`：注册 handler
3. `src/preload/`：暴露桥接（自动生成）
4. `src/renderer/src/api/`：新增 api 包装

通道名必须来自 `IPC_CHANNELS`，渲染层只能经 `@/api` 调用，禁止手写字符串或直接访问 `ipcRenderer`。

## 10. 工具注册流程

新增工具页 = 视图组件 + 路由 + `src/shared/navTools.js` 注册项（含 `menuGroup`，需要托盘入口加 `trayGroup`）。注册表驱动侧边栏、菜单、托盘、首页与全局搜索，禁止绕过注册表硬编码入口。

三个"工具"概念不可混用：

| 概念             | 定义位置                                                                 | 含义                                                                                |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 导航工具 navTool | `src/shared/navTools.js`                                                 | 用户可见的功能页面入口（侧边栏/菜单/托盘/搜索），不参与 AI 调用                     |
| 技能 skill       | `src/main/skills/builtin/*/skill.json` + `services/extensions/skills.js` | 提供给 AI 的工具能力（内置 + 安装 + 市场），经 `handler.js` 执行                    |
| AI 工具 aiTool   | `services/agent/chat.js` 组装、`services/agent/toolPolicy.js` 分级       | 一轮对话中模型可调用的函数（含 MCP 工具 `mcp__server__tool`），受审批与结果预算约束 |

新增用户页面改 `navTools.js`；新增 AI 能力改 skill；两者都不允许在对方注册表里挂条目。

## 11. AI 助手模块约束

- 单 Agent 循环位于 `src/main/services/agent/chat.js`；新流式事件必须同时实现主进程发射端与 `Chat.vue` 的 `handleStreamChunk`
- 思考参数是服务商私有的，改动只在对应 `services/ai/providers/*` 的 `applyThinkingOptions` 内进行
- 用量统计经 `tokens.js` 归一化；上下文压缩由渲染层在窗口用量 70% 时触发，不得进入流式路径
- 人设、温度、分场景模型（`planner` / `compression`）、审批策略等行为配置以 `src/shared/aiBehavior.js` 为准（含长度上限、旧值兼容与 `normalize*`）；新增枚举/默认值只改这里
- 工具风险分级与审批在 `services/agent/toolPolicy.js`：新内置工具必须在 `classifyToolRisk` 中登记（未登记工具默认按写入处理并触发审批），按 `needsApprovalForPolicy` 门控；文件写入先出 dry-run 预览
- 长任务结束、图床上传、备份等结果提醒统一走 `services/notifications.js` 的 `notify(key)`，开关配置来自 `shared/notifications.js`

## 12. 网络与外部请求

- 业务代码的所有外部 HTTP 请求必须使用 `src/main/services/network.js` 的 `netFetch` / `createRequest`，确保代理与镜像源生效；禁止直接调用 `fetch`
- 代理模式为 `system | direct | manual`（HTTP / SOCKS5 + 绕过列表），镜像源覆盖 ClawHub、MCP registry 与更新源；schema 与默认值在 `src/shared/network.js`，由 `applyNetworkConfig()` 应用到 Electron session
- MCP 等子进程通过 `getNetworkEnv()` 注入代理环境变量
- 第三方来源（ClawHub、官方 MCP registry 等）经 `extensions/clawhub.js` / `extensions/mcpRegistry.js` 访问，均走上述网络层

## 13. 插件与扩展

- 插件 = 技能（instructions）+ 连接器（MCP），schema 与校验在 `src/shared/pluginBundle.js`；安装/卸载统一经 `services/extensions/pluginInstaller.js`，禁止手写落盘逻辑
- 沙箱动作 = `plugin.json` 的 `sandbox.actions` 声明式能力（toolbox / http / storage），规范化与权限派生在 `shared/pluginSandbox.js`，执行在 `services/extensions/pluginSandbox.js`：不运行插件代码、不引入新依赖，HTTP 仅允许声明主机（含重定向校验），存储按插件隔离并限额；首次运行按 manifest 哈希弹窗确认权限，授权记录写入注册表，卸载时清理本地数据
- 扩展管理 UI 按 插件/技能/连接器 分类；用户技能覆盖/禁用走 `shared/skillOverrides.js`
- 新增插件类型必须同步更新 schema、校验、测试与扩展管理界面

## 14. 配置兼容

- 配置键变更必须保留旧键读取兼容，经 `src/main/services/config.js` 归一化默认值
- 每类配置在 `src/shared/<domain>.js` 提供 `normalizeXxx`，config.js 只负责编排调用，不重复定义枚举或默认值
- 团队托管配置由 `src/shared/managedProfile.js` 维护白名单路径与解析/覆盖逻辑，`services/managedProfile.js` 在配置目录存放 `managed-profile.json`（本地文件导入或 http/https 拉取，2 MB 上限）；`config.js` 在加载与保存时统一应用覆盖，托管值始终优先于本机修改，取消托管按 `restore` 快照恢复。白名单只能包含策略字段，禁止纳入密钥、数据库连接或 MCP 凭据
- 跨设备同步由 `src/shared/syncBundle.js` 维护分区白名单与合并逻辑，`services/syncService.js` 把非敏感设置快照写入用户选定的共享文件夹（`ntoolbox-sync.json`，1 MB 上限），本机同步状态存配置目录 `sync-state.json`（0600，state v2）；每个分区按修改时间较新者生效并上报冲突，合并时对超前 15 分钟以上的时间戳按当前时间封顶；本机无同步记录的分区不参与「较新」比较（首次同步以共享文件为准，避免新设备默认值覆盖远端），更换同步文件夹会清空本机分区基线；应用远端数据时只接受白名单字段；密钥、数据库连接、MCP 凭据与设备路径（如 SQL 生成器 base_path）不得进入同步文件。同步前先 `previewSync` 预览应用/推送/冲突，再由用户确认执行；共享文件损坏、过大、不可读或与口令状态不匹配时返回可恢复错误码（`remote-invalid` / `remote-size` / `read-failed` / `locked` / `plaintext`），用户可选择「以本机覆盖」，覆盖前把原文件重命名为 `ntoolbox-sync.json.broken-<时间戳>`。分区级开关（`disabled_sections`）让停用分区既不写入本机也不应用远端，但共享文件中的远端副本保留；可设置同步口令，`syncCrypto.js` 用 scrypt + AES-256-GCM 加密快照，口令经 `utils/crypto` 加密后只存本机 `sync-state.json`；`startAutoSync` 在启动 15 秒后及每 10 分钟自动同步已启用的同步文件夹
- 存储目录由 `src/main/utils/appPaths.js` 解析、`storageLayout.js` 在启动最早期应用：目录名固定为 `ntoolbox`，不随 app name 变化；Linux 遵循 XDG（配置 `$XDG_CONFIG_HOME/ntoolbox`、数据 `$XDG_DATA_HOME/ntoolbox`、缓存 `$XDG_CACHE_HOME/ntoolbox`、日志 `$XDG_STATE_HOME/ntoolbox/logs`），Windows 配置在 `%APPDATA%\ntoolbox`、数据/缓存/日志在 `%LOCALAPPDATA%\ntoolbox`，macOS 用 `~/Library/Application Support|Caches|Logs`
- 角色分离：配置目录放 `config.json`（及 `.bak` / `.previous`）、`.dbkey`（及 `.previous`）、`sync-state.json` 与一次性 `.layout-migrated` 标记；数据目录放 SQLite、`memory/`、`skills/`、`plugins/`、`agent/{runs,results,snapshots}/`、`mcp/`、`password-vault.json`；Chromium profile 走缓存目录；日志走日志目录
- 旧布局（userData 根目录平铺）由 `layoutMigration.js` 一次性迁移，并同步改写 SQLite 内的绝对路径；新 Chromium profile 已有同名条目时，纯缓存（`Cache`、`Code Cache` 等）直接删除旧副本，状态数据重命名为 `<name>.previous` 保留；迁移后清理空的旧根目录与配置目录空壳，配置目录若仍出现已知 Chromium 条目则按体积告警；迁前无 `.layout-migrated` 标记时，开发版仓库根 `config.json` 若比目标文件更新则接管（原文件备份为 `config.json.previous`）；随后 `storageLayout.js` 用配置中的真实密文在候选密钥（配置目录、仓库根、旧 userData 根）中选出能解密的那把替换为 `.dbkey`（被替换的密钥保留为 `.dbkey.previous`），标记写入后不再重复接管；禁止在 userData 根目录新增散落文件，禁止重新引入按 app name 推导的目录
- 本地 SQLite 表统一约定：每张表必须包含 `id`、`created_at`、`updated_at` 三列，仓储写入时同步维护；schema 变更只能向 `src/main/services/sqlite/schema.js` 追加迁移条目（`PRAGMA user_version`），不得改写既有条目，该约定由 `tests/sqlite.test.js` 校验

## 15. 测试与验证

- 每次交付前运行完整 `npm run test`（当前 123 个测试文件 / 1005 项，全绿为准）
- 主进程模块禁止在 import 时访问 `electron` 的 `app`（vitest node 环境无 electron mock）
- 共享契约（`src/shared/*.js` 的 `normalize*`）必须有单元测试；IPC 契约由 `tests/ipcContract.test.js`、注册由 `tests/ipcRegistration.test.js` 兜底
- 多语言改动必须通过 `tests/i18n.test.js`：`src/renderer/src` 与 `src/main` 中所有字面量 `t('…')` 键都要有 en-US 词条，且占位符一致；新增或修改文案时同步补词条
- **UI 改动必须实测**：启动隔离实例（独立端口 + 独立 `XDG_CONFIG_HOME`），用 CDP 截图验证宽窗/窄窗/明暗主题；不得占用或干扰用户正在运行的开发实例（5173）与数据库容器（mysql57/redis）
- 界面涉及语言的改动需在隔离实例中分别以 zh-CN / en-US 逐页巡检，确认无渲染异常与空白页
- 隔离实例结束后按已验证的 PGID 终止，并清理临时目录与截图
- 涉及数据库的功能用一次性容器验证，不得触碰用户现有容器

## 16. 安全红线

- 不提交密钥、token、`config.json` 等敏感文件
- 所有 IPC handler 校验入参；外部内容（网页、MCP 返回、AI 输出）按不可信数据处理，提示注入标记走 `services/agent/promptSafety.js`
- 文件操作必须走 dry-run / 审批门控：`agent/toolPreview.js` 生成预览、`agent/snapshots.js` 生成可回滚快照、`agent/runTrace.js` 记录运行轨迹
- 数据库变更写入 `services/database/dbAuditLog.js` 审计日志；不做绕过审计的破坏性快捷实现
