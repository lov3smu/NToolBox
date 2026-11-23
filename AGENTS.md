# AGENTS.md

NToolBox - Electron + Vue 3 developer toolbox application.

**开发规范见 [PROJECT.md](./PROJECT.md)，两者冲突时以 PROJECT.md 为准。** 本文件只保留架构速览与实现要点。

## Commands

```bash
npm run dev          # Start development server
npm run lint:check   # Check linting (no fix)
npm run lint         # Lint with auto-fix
npm run format:check # Check formatting (no fix)
npm run format       # Format with Prettier
npm run test         # Run vitest suite once
npm run test:watch   # Run vitest in watch mode
npm run build        # Build all platforms
npm run build:win    # Build Windows (x64)
npm run build:linux  # Build Linux (x64)
npm run build:mac    # Build macOS (x64)
npm run preview      # Preview production build
```

Tests live in `tests/` (75 files, 593 cases) and run with vitest (`vitest.config.js`, node environment).

## Architecture

```
src/
├── shared/                    # Contracts shared by main / preload / renderer
│   ├── ipc.js                 # IPC channels + method definitions (source of truth)
│   ├── i18n.js                # Locale values/default, normalizeLocale, interpolate
│   ├── locales/en-US/         # English catalog files keyed by Chinese source text
│   ├── tools.js               # Tool registry (name, path, icon, menuGroup, trayGroup)
│   ├── aiBehavior.js          # Persona/temperature/scenario models/tool policy + normalizers
│   ├── network.js             # Proxy modes, mirror sources, net config normalizers
│   ├── notifications.js       # Notification keys + config normalizer
│   ├── clipboardSettings.js   # Clipboard history limits + normalizer
│   ├── pluginBundle.js        # Plugin manifest schema/validation
│   ├── skillOverrides.js      # Per-skill overrides + disabled skills
│   ├── imageHosts.js          # Image host providers, link formats, limits
│   ├── databaseEditor.js      # Database editor preferences
│   ├── backupTasks.js         # Backup task schema
│   ├── sqlAudit.js            # SQL audit rule catalog
│   └── mcp.js                 # MCP server config normalizer
├── main/                      # Electron main process (ESM)
│   ├── index.js               # Entry point
│   ├── constants/             # APP_ID, intervals, valid values
│   ├── ipc/                   # IPC handlers (main-renderer bridge)
│   ├── services/
│   │   ├── ai/                # index (factory), registry, thinking, catalogs, fallback, retry, tokens, providers/*
│   │   ├── chat.js            # Agent loop, streaming events, context compression
│   │   ├── config.js          # Config read/normalize/write
│   │   ├── configValidation.js
│   │   ├── i18n.js            # Main-process t/getLocale/setLocale (synced from config)
│   │   ├── database.js        # MySQL connections/queries/transfer/sessions
│   │   ├── network.js         # Proxy applier, netFetch/createRequest, testNetwork
│   │   ├── mcp.js / mcpRegistry.js   # MCP client + official registry client
│   │   ├── skills.js / skillSchema.js
│   │   ├── plugins.js / pluginInstaller.js / clawhub.js
│   │   ├── memory.js          # AI memory store
│   │   ├── workspace.js       # Chat workspace metadata
│   │   ├── imageHost/         # Upload providers (GitHub/S3/…)
│   │   ├── clipboard.js / clipboardHistory.js / clipboardPaths.js
│   │   ├── toolPolicy.js      # Tool risk classification + approval policy
│   │   ├── toolPreview.js     # File dry-run diff preview
│   │   ├── toolResults.js     # Tool result budget (truncate/spill/paginate)
│   │   ├── promptSafety.js    # Prompt-injection markers
│   │   ├── runTrace.js / snapshots.js / dbAuditLog.js
│   │   ├── sshTunnel.js / backupScheduler.js
│   │   ├── notifications.js   # System notifications (notify(key))
│   │   └── generator.js / templateBuilder.js / templateGenerator.js / updater.js / autostart.js
│   ├── utils/                 # Paths/assets, icons, logging, sanitize, crypto
│   ├── windows/               # Window management (refreshWindowTheme)
│   ├── ui/                    # Menu, tray
│   └── skills/builtin/        # AI tool definitions (skill.json + handler.js)
├── preload/                   # Preload scripts (IPC bridge generated from shared/ipc.js)
└── renderer/src/
    ├── views/                 # Page components (Chat, Database, Settings, ImageHosting, …)
    │   └── database/          # Database page split into components/state/styles
    ├── components/            # Reusable components (settings/ panels, dialogs, SqlEditor…)
    ├── composables/           # useConfig, useSidebar, useToast, usePaneResize…
    ├── layouts/               # AppShell, AppTitleBar, PageLayout
    ├── api/                   # IPC API wrappers
    ├── styles/                # base.css design tokens + per-feature css
    ├── utils/                 # theme.js, path.js (joinPath), markdown, format, clampViewport.js
    ├── router/                # Vue Router config
    └── i18n.js                # t/getLocale/setLocale + localStorage fallback
```

## Code Style

- Single quotes, no semicolons, 2-space indent, no trailing commas, print width 120
- ESLint flat config (`eslint.config.js`) + Prettier (`.prettierrc`)
- Vue single-word component names allowed
- Shared enums/defaults/normalizers live in `src/shared/*.js` only; never duplicate them across processes

## Cross-platform Requirements

All code must work on Windows, Linux, and macOS. Platform-specific behavior needs a verified branch or fallback — never assume Windows.

- **Paths (main/preload)**: use `path.join`, `path.resolve`, and `path.sep`. Never hardcode `/`, `\`, drive letters, or home directories.
- **Paths (renderer)**: no `node:path`; use `joinPath` from `src/renderer/src/utils/path.js`.
- **Dev vs production**: detect dev mode via `process.env.ELECTRON_RENDERER_URL`, not `!app.isPackaged`.
- **Shell commands**: branch on `process.platform`; see `src/main/utils/elevateCommand.js` for the POSIX counterpart.
- **Path guards**: every renderer-supplied path must pass `isPathWithinBase` (`src/main/utils/sanitize.js`) before filesystem access.
- **Platform-limited APIs**: `app.setLoginItemSettings` only works on Windows/macOS; guard it and document the Linux fallback.
- **App identity**: top-level `package.json` `name` is `NToolBox` (do not reintroduce `productName`). Keep builder `appId` in sync with `APP_ID` in `src/main/constants/index.js`.
- **Icons**: resolve through `getAssetsDir()`, `getIconPath()`, `getWindowIcon()`; packaged assets in `process.resourcesPath/assets`. Windows `.ico`, macOS/Linux `.png`; Linux window icons resized to 128×128; tray icons 18px (macOS) / 22px (Linux).

## Settings & UI System

- Tabs, in order: 通用 → 外观 → 快捷键 → 模型 → AI 助手 → 网络 → 数据库客户端 → SQL 脚本生成 → 图床配置 → 扩展管理 → 关于. New tabs are inserted into the matching functional group.
- Rows use the design system classes: `setting-section*`, `setting-row`, `setting-row-text/label/desc`, `setting-row-control`, `input-field`, `switch`.
- Binary settings use `.switch`; multi-select uses the globally themed checkbox (`input[type='checkbox']:not(.switch)` in `base.css`). Never restyle it with `accent-color` or a custom indicator.
- Radio choices use `components/RadioOption.vue` (`default | block | pill` variants) backed by the global `input[type='radio']` theme in `base.css`; never hand-roll a bare radio.
- **Never use native `<select>`/`datalist` in Settings.** Use `components/settings/SettingSelect.vue` (label + hint options) or `SettingModelPicker.vue` (`provider:model`, type-to-filter, free text allowed). Panels teleport to `body`, `position: fixed`, z-index 1200, flip upward near the viewport bottom, close on Esc / outside click / scroll.
- **Floating layers stay inside the viewport.** Menus/dialogs get the global `v-clamp-viewport` directive (`utils/clampViewport.js`: 8px margin, `translate` + max width/height clamp, re-runs on resize and 120ms after mount; `is-clamped-x/y` classes drive directional flips like database submenus). Components that position themselves (`SettingSelect` / `SettingModelPicker` / `HoverPopover`) must not double-apply it. Modal content scrolls internally via `max-height: calc(100vh - 32px)`.
- **`HoverPopover` placement**: `top|bottom|left|right` plus `-start|-center|-end`, auto-flips near viewport edges. `boundary` (selector) pins the card outside that element with an `offset` gap and shrinks instead of flipping back — the session-rail workspace card uses `boundary=".chat-rail"` and must never cover the rail.
- z-index scale: in-page layer 1000, dropdown/popover/panel 1200, context menu 2000 (submenu 2001), modal overlay / MessageDialog 9999, Toast 10000. Reuse these; do not invent larger values.
- Feature pages stay functional; configuration lives in Settings (e.g. 图床 page = upload + history, providers configured in Settings → 图床配置; callout links to `/settings?tab=image-hosting`).
- Design tokens (`styles/base.css`): `--font-size-base/dense/sm/xs`, `--control-height`, `--radius-*`, `--surface*`, `--text-*`, `--accent-color`, `--shadow-*`, `--motion-*`, `--spinner-*`; colors must come from theme tokens (no hardcoded light colors), honor `prefers-reduced-motion`.
- Settings grid: `minmax(200px, 320px) 1fr`; `is-top` / `is-block` modifiers; dashed separators; rows stack at ≤900px (nested) and ≤720px (all).
- Renderer config loads asynchronously (`useConfig` starts as `null`): read nested fields with `config.value?.app?...` and defaults. An unguarded read at first paint throws, breaks the route transition chain, and blanks every page.

## Internationalization (i18n)

- `t()` keys are the Chinese source text (no dotted keys): renderer `src/renderer/src/i18n.js`, main `src/main/services/i18n.js`. Locales: `zh-CN` (default) / `en-US`, config key `appearance.language`, normalized via `normalizeLocale` from `src/shared/i18n.js`.
- English entries live in `src/shared/locales/en-US/*.js` (one file per domain, merged in `index.js`). Every literal `t('…')` key in `src/renderer/src` and `src/main` must have an entry with matching `{placeholder}` names — enforced by `tests/i18n.test.js`.
- Shared contracts return Chinese templates with `{p0}`-style placeholders; they never call `t()` — consumers translate at the boundary.
- Renderer keeps locale in a reactive ref (localStorage `ntb_locale` fallback) and re-applies config language on config change; main syncs at startup from the loaded config.
- Never hardcode user-visible UI strings; never rename/translate catalog keys; a new locale needs `LOCALE_VALUES`/`LOCALE_OPTIONS`, a full catalog, both runtime modules, and test coverage.

## Theming & Font Size

- Config keys `appearance.theme` (`system|light|dark`), `appearance.theme_style` (`sapphire|forest|mint|bee|parchment`), `appearance.font_size` (`small|medium|large|xlarge`) are normalized in `src/main/services/config.js`.
- `src/renderer/src/utils/theme.js` applies them as `data-theme`, `data-theme-style`, `data-font-size`, and `--font-scale` on `<html>`.
- Main-process windows get title-bar overlay/background from `refreshWindowTheme()`; new theme-affecting config must call it.
- Font-size switching sets a temporary `data-font-size-changing` attribute (CSS disables transitions); do not remove that guard.

## AI Assistant

- **Single-agent loop** in `src/main/services/chat.js`: optional planner (input ≥ 8 chars) → ReAct streaming loop → reflection on tool results → execution summary. Limits come from config (`ai_agent_max_iterations` 10, `ai_agent_timeout_min` 5, `ai_agent_plan_steps` 8, `ai_agent_parallel_tools` 4 by default); termination is `goal_reached | cancelled | max_steps | timeout | error`.
- **Streaming event kinds** consumed by `Chat.vue`: `thinking`, `content`, `tool_start`, `tool_end`, `status`, `plan`, `reflection`, `summary`, `usage`. New kinds must be handled in both the main emitter and `handleStreamChunk`.
- **Providers** live in `src/main/services/ai/providers/*`; every service provider is one entry in `services/ai/registry.js` (metadata, capabilities, `autoPriority`, `contextWindow`, `Provider` class), which derives `PROVIDER_TYPES` / `PROVIDER_INFO` / `AUTO_PRIORITY`. Thinking support rules live only in `services/ai/thinking.js` (`THINKING_RULES`); `capabilities.js` re-exports both for compatibility. OpenCode Zen/Go model lists split into `catalogs/base.js` + `zen.js`/`go.js` overlays. `getProvider()` returns a fresh instance per call (never a shared mutable one). `tokens.js` provides `estimate*Tokens` / `normalizeUsage`; `retry.js` / `fallback.js` handle backoff and backup models, and the fallback chain is built once per session (`modelChain`) and reused across agent iterations.
- **Token accounting**: planner and every loop iteration aggregate into agent state (`prompt_tokens`, `completion_tokens`, `total_tokens`, `calls`, `contextTokens`, `estimated`). Only Bailian opts into `stream_options.include_usage`; others fall back to local estimates marked `estimated`.
- **Context windows** (`getContextWindow` fallback, overridable per model via `contextWindow`): 1000000 for bailian/moonshot/deepseek, 204800 for zhipu/minimax, 262144 for volcengine. Built-in catalogs set per-model values from vendor docs.
- **Thinking params are provider-specific** (`BaseProvider.applyThinkingOptions`): bailian `enable_thinking`; zhipu `glm-5.3` always `thinking.type=enabled` + `reasoning_effort`, older GLMs `enabled|disabled`; moonshot Kimi K3 only `reasoning_effort` (temperature omitted, fixed at 1.0); minimax M3 `adaptive|disabled` with `reasoning_split: true` (M3.1-Flash adaptive-only + `reasoning_effort`); volcengine/deepseek `thinking.type=enabled|disabled`. DeepSeek/MiniMax/Kimi require `reasoning_content` echoed on assistant tool-call turns. OpenAI GPT-6 only supports function tools with `reasoning_effort=none` (auto-applied when tools are sent); Anthropic omits temperature and adds `x-api-key` / `anthropic-version` in `getHeaders()`.
- **Context compression**: `compressChatContext` triggers at `ai_compress_threshold` (70% default) of the window before sending, summarizes all but the last `ai_compress_keep_recent` (6 default) visible messages, and persists `session.context = { summary, upToIndex, beforeTokens, afterTokens, compressedAt }`. Keep it out of the streaming agent path.
- **Behavior config** (`src/shared/aiBehavior.js`): persona (≤ 4000 chars), temperature (`null` = provider default), scenario models (`planner` / `compression`, `provider:model`), tool policy `all | high-risk | auto` with legacy aliases, agent runtime limits, tool-result budget, and `AI_PRESETS` (省钱 / 长任务 / 严格审批); all normalized in `config.js`.
- **Tool risk & approval**: `services/toolPolicy.js` classifies every tool (`read | write | destructive`); unknown tools default to `write`. `needsApprovalForPolicy` gates execution; file writes ship a dry-run preview (`toolPreview.js`) and a rollback snapshot (`snapshots.js`); runs are recorded in `runTrace.js`. Tool output is budgeted/truncated/paged by `toolResults.js` (budget and retention from `ai_tool_result_*`).
- **Other agent services**: memory (`memory.js`), workspaces (`workspace.js`), subagents, MCP tools (`mcp__server__tool`), web fetching (`skills/builtin/web-fetch`), prompt-injection markers (`promptSafety.js`).
- **Notifications**: `services/notifications.js` `notify(key)` with keys `upload_done`, `backup_done`, `update_found`, `agent_done` (all toggleable in Settings, normalized in `shared/notifications.js`).

## Network

- All outbound HTTP from business code goes through `services/network.js` (`netFetch` / `createRequest`), which prefers the configured Electron session and falls back to global `fetch`; direct `fetch` elsewhere in business code is forbidden.
- Proxy modes: `system | direct | manual` (HTTP/SOCKS5, bypass list); mirror sources for ClawHub, MCP registry and update feed live in `shared/network.js` and Settings → 网络. `applyNetworkConfig()` applies them to the Electron session; `getNetworkEnv()` injects proxy env vars into MCP child processes.

## Plugins & Extensions

- A plugin = skills (instructions) + connectors (MCP); manifest schema/validation in `shared/pluginBundle.js`.
- Install/uninstall via `services/pluginInstaller.js` (never hand-roll writes); `plugins.js` tracks the registry, `skills.js` + `skillSchema.js` manage skills, `mcp.js` reloads connectors.
- 扩展管理 UI groups 插件 / 技能 / 连接器; the 扩展 market page installs from ClawHub (`clawhub.js`) or the official MCP registry (`mcpRegistry.js`). User skill overrides/disabled state use `shared/skillOverrides.js`.

## IPC & Tool Registry

- **IPC contract**: `src/shared/ipc.js` defines every channel (`IPC_CHANNELS`) and method fallback (`IPC_METHODS`); preload generates the bridge and the renderer consumes `@/api`. A new feature adds channel + method + handler + api wrapper together.
- `tests/ipcContract.test.js` fails unless every method has a handler and channels are unique; `tests/ipcRegistration.test.js` covers registration.
- **Tool registry**: `src/shared/tools.js` drives sidebar, app menu, tray menu, dashboard, and Ctrl/Cmd+K search (18 visible entries + hidden `记忆与知识库`; groups `primary | file | utilities | extensions | settings`; tray groups `top | tools`). Adding a tool = view + route + registry entry.

## Database Client

- Page split under `views/database/` (components/state/styles); connections, queries, transfer, sessions/locks, user privileges, table designer, result-set editing, large-field lazy loading, filters/sort, field/column management, saved queries/favorites.
- Connection security: SSH tunnel (`services/sshTunnel.js`) and SSL options; backup tasks persist via `shared/backupTasks.js` and run in `backupScheduler.js`; schema/operation changes are audited in `dbAuditLog.js` with rules from `shared/sqlAudit.js`.
- Verify DB features on a disposable container; never touch the user's running containers (mysql57:3306, redis:6379).

## Shortcuts

- No global tool accelerators (project policy). Only Settings exposes a configurable shortcut (`shortcuts.settings`, default `CmdOrCtrl+,`); global search is `Ctrl/Cmd+K` in `App.vue`; `Ctrl+Enter` runs a query in the database view.

## Development

- **DevTools**: open only via `toggleDevTools()` or `DEVTOOLS_MODE` in `src/main/windows/index.js` (docked at the bottom). Main/settings windows use `titleBarStyle: 'hidden'` with self-drawn controls (`WindowControls.vue`).
- **Storage layout**: resolved by `src/main/utils/appPaths.js` and applied first thing at startup by `src/main/utils/storageLayout.js`. The directory name is fixed `ntoolbox` (never derived from app name). Linux follows XDG (`$XDG_CONFIG_HOME`, `$XDG_DATA_HOME`, `$XDG_CACHE_HOME`, `$XDG_STATE_HOME`); Windows uses `%APPDATA%` for config and `%LOCALAPPDATA%` for data/cache/logs; macOS uses `~/Library/Application Support|Caches|Logs`. Roles: config (`config.json`, `.dbkey`), data (`ntoolbox.db`, `memory/`, `skills/`, `plugins/`, `agent/{runs,results,snapshots}/`, `mcp/`, `password-vault.json`), cache (Chromium `sessionData`), logs.
- **Layout migration**: `src/main/utils/layoutMigration.js` moves a legacy flat profile (db, agent dirs, memory, skills, plugins, Chromium profile) into the new layout once at startup and rewrites absolute artifact paths stored in SQLite; a dev `config.json`/`plugins.json` at the repo root is copied, never deleted. When the new Chromium profile already has an item, pure caches (`Cache`, `Code Cache`, …) are deleted and state data is kept as `<name>.previous`; empty legacy dirs are removed and any remaining known Chromium entry in the config dir produces a size warning. On the first run (no `.layout-migrated` marker) a dev repo `config.json` newer than the target takes over and the previous file is kept as `config.json.previous`; `storageLayout.js` then picks the key that actually decrypts the active config from all candidates (config dir, repo root, legacy userData roots) and swaps it in, keeping the replaced key as `.dbkey.previous`. Do not reintroduce a `userData` pin or write stray files at the userData root.
- **Build output**: `out/` (electron-vite) → `release/` (electron-builder).
- **UI verification**: run an isolated instance (separate port + `XDG_CONFIG_HOME`), verify with CDP screenshots at wide/narrow widths and both themes, then stop by verified PGID and clean temp files. Never disturb the user's dev instance (5173) or containers.

## Key Details

- **Main process uses ESM**, not CommonJS
- **External modules** for main must be added to `electron.vite.config.js` → `main.build.rollupOptions.external`
- **Skills system**: AI tools defined in `src/main/skills/builtin/*/skill.json` with `handler.js`
- **Supported AI providers**: 百炼, Moonshot, 智谱, MiniMax, 火山引擎, DeepSeek, 小米 MiMo, OpenCode, OpenCode Go, OpenAI, Google, Anthropic
- **Image hosting**: page does upload + history (limit 100, ≤ 30 MB, png/jpg/jpeg/gif/webp/bmp/svg/avif); providers/link formats in `shared/imageHosts.js`, configuration in Settings → 图床配置
- **Clipboard history**: persistence toggle + limits `50 | 120 | 200 | 300` (`shared/clipboardSettings.js`)
