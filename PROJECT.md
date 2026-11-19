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

| 对象       | 规则                         | 示例                                       |
| ---------- | ---------------------------- | ------------------------------------------ |
| 组件文件   | PascalCase.vue               | `ImageHostSettingsPanel.vue`               |
| 组合式函数 | useXxx.js（经 barrel 导出） | `useConnectionActions.js`                  |
| 共享契约   | src/shared/小驼峰.js         | `aiBehavior.js`、`pluginBundle.js`         |
| 共享常量   | SCREAMING_SNAKE              | `IMAGE_HOST_PROVIDERS`、`AUTO_SAVE_KINDS`  |
| 归一化函数 | normalizeXxx                 | `normalizeImageHostSettings`               |
| IPC 通道   | 小写冒号域分隔               | `db:query`（见 `shared/ipc.js`）           |
| i18n 文案键 | 中文原文整句（占位符 `{name}`） | `t('备份完成')`、`t('{name} 已备份到 {file}')` |
| CSS 类     | kebab-case，页面级加命名空间 | `.ihs-field`、`.setting-row`               |
| 设计 token | `--域-名称`                  | `--accent-color`、`--surface-muted`        |
| 测试文件   | 被测域名.test.js             | `ipcContract.test.js`、`config.test.js`    |

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

- 字号（均乘 `--font-scale`）：`--font-size-xl` 24 / `lg` 18 / `md` 16 / `base` 14 / `dense` 13 / `sm` 12 / `xs` 11
- 图标：`--icon-size-*`（48/32/24/20/16/14）；内联 SVG 统一 `stroke-width: 2`、圆角端点
- 控件高度：`--control-height` 32px、`-sm` 28px、`-lg` 36px
- 圆角：`--radius-sm` 6 / `md` 8 / `lg` 12；阴影 `--shadow-sm/md/lg/glow`；动效 `--motion-*`；加载 `--spinner-*`
- 强调色 `--accent-color`（品牌紫）仅用于焦点、选中、主按钮与小面积强调；success / warning / error 仅表达对应语义
- 禁止页面内硬编码字号、圆角、颜色、阴影；禁止硬编码浅色，颜色必须走主题变量，保证暗色主题可用
- 动画必须尊重 `prefers-reduced-motion: reduce`

### 7.2 字号层级

| 层级     | 规格                                                                        |
| -------- | --------------------------------------------------------------------------- |
| 页面标题 | 工具页 h1 `--font-size-lg` / 600；设置页 h2 `--font-size-md` / 600–650      |
| 分组标题 | `--font-size-base` / 600                                                    |
| 行标签   | `--font-size-dense` / 500 / 主文字色                                        |
| 描述文字 | `--font-size-sm` / 400 / `--text-tertiary` / 行高 1.5                       |
| 辅助标签 | `--font-size-xs` / 400 / `--text-tertiary`（标签、副标题、等宽标识）        |

描述文字直接展示在标签下方，**不用问号图标折叠**。

### 7.3 页面壳层与布局

- 主窗口 = 自绘标题栏（`AppTitleBar` + `WindowControls`）+ 注册表驱动的左侧导航（`AppShell`）+ 内容区；工具页统一使用 `layouts/PageLayout.vue`
- `PageLayout`：页头（图标 + 标题 + 副标题，右侧 `header-extra`）+ 可选工具栏（`actions` 插槽）+ 可滚动内容区；≤900px 左右内边距收紧
- 设置页（`views/Settings.vue`）：左侧菜单（返回应用 + 分组标签）+ 内容区；页头（标题 + 一句说明）与标签内容统一 `max-width: 1120px` 居中
- 设置标签顺序按功能分组：通用/外观/快捷键 → 模型/AI 助手/网络 → 数据库客户端/SQL 脚本生成/图床配置 → 扩展管理/关于；新增标签按语义插入对应分组，不追加到末尾
- 页面根容器负责 `min-width: 0` 与滚动，不得用 `overflow-x: hidden` 掩盖真实的横向溢出

### 7.4 通用控件

- 开关一律用全局 `.switch`（36×20 轨道 + 滑块）；多选 / 勾选场景使用主题化复选框（`base.css` 全局 `input[type='checkbox']:not(.switch)`），禁止自定义外观或退回 `accent-color`
- 复选框内置未选 / 选中 / 半选（`indeterminate`）/ 聚焦 / 禁用状态，整表或分组全选可用半选表达，不得另造选中图标或伪元素勾选
- 单选场景一律用 `components/RadioOption.vue`（`v-model` + `value`，变体 `default | block | pill`），主题样式来自 `base.css` 全局 `input[type='radio']`；禁止直接写裸 `input[type='radio']` 或 `accent-color`
- 按钮统一 `.btn` 体系（`btn-primary/secondary/ghost/danger`），同区域高度一致（默认 32px），不混用 `btn-sm`；主操作每屏至多一个
- 输入框统一 `.input-field`（高度 `--control-height`，聚焦 `--shadow-glow`）；密码类输入配「显示 / 隐藏」按钮
- 下拉统一继承全局 `select` / `.select-field`（含主题箭头）；工具条等紧凑场景用 `.select-field-sm`（28px、`--font-size-xs`、12px 箭头），禁止用 `background` 简写覆盖箭头或另写一套边框焦点样式
- 边框规则：卡片外框实线 `1px solid var(--border-color)`，卡片内部分隔线（分组头底部、行与行之间）用 `1px dashed var(--border-color)`
- 交互元素必须有 `:focus-visible` 焦点样式；纯图标按钮必须带 `title` / `aria-label`

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
- 气泡卡片 `HoverPopover.vue` 的 `placement` 支持 `top|bottom|left|right` 与 `-start|-center|-end` 组合，空间不足时自动翻转到对侧；需要「不得覆盖指定区域」时传 `boundary` 选择器（如 `boundary=".chat-rail"`）：卡片固定在边界外侧 `offset`（默认 8px）处，空间不足时收缩自身宽度，绝不翻转回边界内侧。工作区气泡卡片必须位于会话栏宽度之外，禁止盖住工作区内容
- 层级约定：页面内浮层 1000，下拉 / 气泡 / 弹层 1200，右键菜单 2000（子菜单 2001），模态遮罩与消息弹窗 9999，Toast 10000；新增浮层沿用既有层级，不任意放大
- 浮层改动必须在隔离实例中验证宽窗 / 窄窗、明暗主题、贴窗口四边等场景（见 §15）

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

新增工具页 = 视图组件 + 路由 + `src/shared/tools.js` 注册项（含 `menuGroup`，需要托盘入口加 `trayGroup`）。注册表驱动侧边栏、菜单、托盘、首页与全局搜索，禁止绕过注册表硬编码入口。

## 11. AI 助手模块约束

- 单 Agent 循环位于 `src/main/services/chat.js`；新流式事件必须同时实现主进程发射端与 `Chat.vue` 的 `handleStreamChunk`
- 思考参数是服务商私有的，改动只在对应 `services/ai/providers/*` 的 `applyThinkingOptions` 内进行
- 用量统计经 `tokens.js` 归一化；上下文压缩由渲染层在窗口用量 70% 时触发，不得进入流式路径
- 人设、温度、分场景模型（`planner` / `compression`）、审批策略等行为配置以 `src/shared/aiBehavior.js` 为准（含长度上限、旧值兼容与 `normalize*`）；新增枚举/默认值只改这里
- 工具风险分级与审批在 `services/toolPolicy.js`：新内置工具必须在 `classifyToolRisk` 中登记（未登记工具默认按写入处理并触发审批），按 `needsApprovalForPolicy` 门控；文件写入先出 dry-run 预览
- 长任务结束、图床上传、备份等结果提醒统一走 `services/notifications.js` 的 `notify(key)`，开关配置来自 `shared/notifications.js`

## 12. 网络与外部请求

- 业务代码的所有外部 HTTP 请求必须使用 `src/main/services/network.js` 的 `netFetch` / `createRequest`，确保代理与镜像源生效；禁止直接调用 `fetch`
- 代理模式为 `system | direct | manual`（HTTP / SOCKS5 + 绕过列表），镜像源覆盖 ClawHub、MCP registry 与更新源；schema 与默认值在 `src/shared/network.js`，由 `applyNetworkConfig()` 应用到 Electron session
- MCP 等子进程通过 `getNetworkEnv()` 注入代理环境变量
- 第三方来源（ClawHub、官方 MCP registry 等）经 `clawhub.js` / `mcpRegistry.js` 访问，均走上述网络层

## 13. 插件与扩展

- 插件 = 技能（instructions）+ 连接器（MCP），schema 与校验在 `src/shared/pluginBundle.js`；安装/卸载统一经 `services/pluginInstaller.js`，禁止手写落盘逻辑
- 扩展管理 UI 按 插件/技能/连接器 分类；用户技能覆盖/禁用走 `shared/skillOverrides.js`
- 新增插件类型必须同步更新 schema、校验、测试与扩展管理界面

## 14. 配置兼容

- 配置键变更必须保留旧键读取兼容，经 `src/main/services/config.js` 归一化默认值
- 每类配置在 `src/shared/<domain>.js` 提供 `normalizeXxx`，config.js 只负责编排调用，不重复定义枚举或默认值
- 生产配置位于 `~/.config/ntoolbox/config.json`（全平台同路径）；开发期 userData 固定，不得移动 `.dbkey` 相关路径

## 15. 测试与验证

- 每次交付前运行完整 `npm run test`（当前 75 个测试文件 / 593 项，全绿为准）
- 主进程模块禁止在 import 时访问 `electron` 的 `app`（vitest node 环境无 electron mock）
- 共享契约（`src/shared/*.js` 的 `normalize*`）必须有单元测试；IPC 契约由 `tests/ipcContract.test.js`、注册由 `tests/ipcRegistration.test.js` 兜底
- 多语言改动必须通过 `tests/i18n.test.js`：`src/renderer/src` 与 `src/main` 中所有字面量 `t('…')` 键都要有 en-US 词条，且占位符一致；新增或修改文案时同步补词条
- **UI 改动必须实测**：启动隔离实例（独立端口 + 独立 `XDG_CONFIG_HOME`），用 CDP 截图验证宽窗/窄窗/明暗主题；不得占用或干扰用户正在运行的开发实例（5173）与数据库容器（mysql57/redis）
- 界面涉及语言的改动需在隔离实例中分别以 zh-CN / en-US 逐页巡检，确认无渲染异常与空白页
- 隔离实例结束后按已验证的 PGID 终止，并清理临时目录与截图
- 涉及数据库的功能用一次性容器验证，不得触碰用户现有容器

## 16. 安全红线

- 不提交密钥、token、`config.json` 等敏感文件
- 所有 IPC handler 校验入参；外部内容（网页、MCP 返回、AI 输出）按不可信数据处理，提示注入标记走 `services/promptSafety.js`
- 文件操作必须走 dry-run / 审批门控：`toolPreview.js` 生成预览、`snapshots.js` 生成可回滚快照、`runTrace.js` 记录运行轨迹
- 数据库变更写入 `services/dbAuditLog.js` 审计日志；不做绕过审计的破坏性快捷实现
