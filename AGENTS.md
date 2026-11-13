# AGENTS.md

NToolBox - Electron + Vue 3 developer toolbox application.

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

Tests live in `tests/` and run with vitest (`vitest.config.js`, node environment).

## Architecture

```
src/
├── shared/              # Contracts shared by main / preload / renderer
│   ├── ipc.js           # IPC channels + method definitions (source of truth)
│   └── tools.js         # Tool registry (name, path, icon, menuGroup, shortcut)
├── main/                # Electron main process (ESM)
│   ├── index.js         # Entry point
│   ├── constants/       # Shared constants (APP_ID, intervals, valid values)
│   ├── ipc/             # IPC handlers (main-renderer bridge)
│   ├── services/        # Business logic
│   │   ├── ai/          # Provider registry, capabilities, token estimation
│   │   ├── chat.js      # Agent loop, streaming events, context compression
│   │   ├── config.js    # Config read/normalize/write
│   │   ├── database.js  # MySQL connections and queries
│   │   ├── skills.js    # Builtin + user-installed skills
│   │   ├── clawhub.js   # ClawHub skill marketplace client
│   │   ├── clipboard*.js # Clipboard history + native clipboard helpers
│   │   └── generator.js / updater.js / autostart.js
│   ├── utils/           # Paths/assets, icons, logging, sanitize, crypto
│   ├── windows/         # Window management
│   ├── ui/              # Menu, tray
│   └── skills/builtin/  # AI tool definitions (JSON + handler.js)
├── preload/             # Preload scripts (IPC exposure to renderer)
└── renderer/            # Vue 3 application
    └── src/
        ├── views/       # Page components
        ├── components/  # Reusable components
        ├── composables/ # Vue composables
        ├── layouts/     # AppShell, AppTitleBar, PageLayout
        ├── api/         # IPC API wrappers
        ├── styles/      # base.css design tokens + per-feature styles
        ├── utils/       # theme.js, path.js (joinPath), markdown, format
        └── router/      # Vue Router config
```

## Code Style

- Single quotes, no semicolons, 2-space indent, no trailing commas
- ESLint flat config (`eslint.config.js`) + Prettier (`.prettierrc`)
- `eslint-config-prettier` disables conflicting ESLint rules
- Vue single-word component names allowed

## Cross-platform Requirements

All code must work on Windows, Linux, and macOS. Platform-specific behavior needs a verified branch or fallback — never assume Windows.

- **Paths (main/preload)**: use `path.join`, `path.resolve`, and `path.sep`. Never hardcode `/`, `\`, drive letters, or home directories.
- **Paths (renderer)**: no `node:path`; use `joinPath` from `src/renderer/src/utils/path.js` instead of concatenating separators.
- **Dev vs production**: detect dev mode via `process.env.ELECTRON_RENDERER_URL`, not `!app.isPackaged`. `electron-vite preview` is unpackaged but must load `out/renderer/index.html`, not the dev server.
- **Shell commands**: branch on `process.platform`. Windows-only commands (`cmd /c`, `powershell`) require a POSIX equivalent; see `src/main/utils/elevateCommand.js`.
- **Path guards**: every renderer-supplied path must pass `isPathWithinBase` (`src/main/utils/sanitize.js`) before filesystem access. It is synchronous, resolves the nearest existing ancestor, and compares case-insensitively on Windows.
- **Platform-limited APIs**: `app.setLoginItemSettings` only works on Windows/macOS; guard it and document any Linux fallback.
- **Editor/app presets**: keep per-platform presets in `Settings.vue` and never assume a Windows install path.
- **App identity**: top-level `package.json` `name` is `NToolBox` (do not reintroduce `productName`). It drives `app.getName()`, Linux `WM_CLASS`, and `${name}` artifact naming. Keep builder `appId` in sync with `APP_ID` in `src/main/constants/index.js`; Windows sets it via `app.setAppUserModelId`.
- **Icons**: resolve through `getAssetsDir()`, `getIconPath()`, and `getWindowIcon()` in `src/main/utils/path.js`. Packaged assets live in `process.resourcesPath/assets` (`extraResources`); dev/preview use the project `assets/`. Windows uses `.ico`, macOS/Linux use `.png` (`nativeImage` cannot read `.icns`). Linux window icons are resized to 128×128 because larger images leave `_NET_WM_ICON` empty. Tray icons are resized per platform (macOS 18px, Linux 22px). macOS dev needs `app.dock.setIcon()`; packaged macOS uses the bundle icon.

## AI Assistant

- **Single-agent loop** lives in `src/main/services/chat.js`: optional planner (input ≥ 8 chars, at most 8 plan steps) → ReAct streaming loop → reflection on tool results → execution summary. Limits: `MAX_AGENT_ITERATIONS = 10`, `DEFAULT_AGENT_TIMEOUT = 5 * 60 * 1000`; termination is one of `goal_reached | cancelled | max_steps | timeout | error`.
- **Streaming event kinds** consumed by `Chat.vue`: `thinking`, `content`, `tool_start`, `tool_end`, `status`, `plan`, `reflection`, `summary`, `usage`. New kinds must be handled both in the main emitter and `handleStreamChunk`.
- **Providers** live in `src/main/services/ai/providers/*` and are registered in `services/ai/index.js`; `capabilities.js` holds thinking rules and context windows; `tokens.js` provides `estimate*Tokens` / `normalizeUsage`.
- **Token accounting**: usage from the planner and every loop iteration is aggregated in agent state (`prompt_tokens`, `completion_tokens`, `total_tokens`, `calls`, `contextTokens`, `estimated`). Only Bailian opts into `stream_options.include_usage` (`streamUsage: true`); other providers fall back to local estimates marked `estimated`.
- **Context windows** (`getContextWindow`): 131072 for bailian/zhipu/deepseek, 262144 for moonshot/volcengine, 204800 for minimax.
- **Context compression**: `compressChatContext` is triggered by the renderer at 70% of the window before sending, summarizes all but the last 6 visible messages, and persists `session.context = { summary, upToIndex, beforeTokens, afterTokens, compressedAt }`. The summary is injected into the system prompt; visible history is never deleted. Keep the compression call out of the streaming agent path.

## Theming & Font Size

- Config keys `theme` (`system|light|dark`), `theme_style` (`sapphire|forest|mint|bee|parchment`), `font_size` (`small|medium|large|xlarge`) are normalized in `src/main/services/config.js`.
- `src/renderer/src/utils/theme.js` applies them as `data-theme`, `data-theme-style`, `data-font-size`, and `--font-scale` on `<html>`; design tokens live in `src/renderer/src/styles/base.css`.
- Main-process windows get their title-bar overlay/background from `refreshWindowTheme()` in `src/main/windows/index.js`; new theme-affecting config must call it.
- Font-size switching sets a temporary `data-font-size-changing` attribute (CSS disables transitions) to prevent whole-page jitter from `transition: all`; do not remove that guard.

## IPC & Tool Registry

- **IPC contract**: `src/shared/ipc.js` defines every channel (`IPC_CHANNELS`) and method fallback (`IPC_METHODS`); preload generates the bridge and the renderer consumes `@/api`. A new feature must add a channel, a method, a handler, and an api wrapper together.
- `tests/ipcContract.test.js` fails unless every method has a handler and all channels are unique; `tests/ipcRegistration.test.js` covers registration.
- **Tool registry**: `src/shared/tools.js` drives sidebar, app menu, tray menu, dashboard, and Ctrl/Cmd+K search. Adding a tool = new view + route + registry entry (`menuGroup`, optional `trayGroup`).

## Shortcuts

- Per project policy there are no global tool accelerators. Only Settings exposes a configurable shortcut (`shortcuts.settings`, default `CmdOrCtrl+,`); global search is `Ctrl/Cmd+K` in `App.vue`, and `Ctrl+Enter` runs a query in the database view. Do not reintroduce per-tool accelerators.

## Development

- **DevTools**: open only via `toggleDevTools()` or `DEVTOOLS_MODE` in `src/main/windows/index.js`, which docks DevTools at the bottom inside the app window. Passing `mode: 'right'` is silently ignored while the window uses `titleBarStyle: 'hidden'` + `titleBarOverlay` (WCO), and DevTools falls back to a separate window. Switching to right docking would require removing the overlay and implementing custom window controls.

## Key Details

- **Main process uses ESM**, not CommonJS
- **External modules** for main process must be added to `electron.vite.config.js` → `main.build.rollupOptions.external`
- **Skills system**: AI tools defined in `src/main/skills/builtin/*/skill.json` with `handler.js`
- **Config location**: 
  - Dev: `config.json` in project root
  - Production: `~/.config/ntoolbox/config.json` (same path on all platforms; see `src/main/utils/path.js`)
- **Dev userData**: development is pinned to `<appData>/ntoolbox` in `src/main/index.js` so changing the app name does not move `.dbkey` and invalidate encrypted database data
- **Build output**: `out/` (electron-vite) → `release/` (electron-builder packages)
- **Supported AI providers**: 百炼, Moonshot, 智谱, MiniMax, 火山引擎, DeepSeek