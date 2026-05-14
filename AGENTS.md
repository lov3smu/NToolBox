# AGENTS.md

NToolBox - Electron + Vue 3 developer toolbox application.

## Commands

```bash
npm run dev          # Start development server
npm run lint:check   # Check linting (no fix)
npm run lint         # Lint with auto-fix
npm run format:check # Check formatting (no fix)
npm run format       # Format with Prettier
npm run build        # Build all platforms
npm run build:win    # Build Windows (x64)
npm run build:linux  # Build Linux (x64)
npm run build:mac    # Build macOS (x64)
npm run preview      # Preview production build
```

No tests are configured.

## Architecture

```
src/
├── main/           # Electron main process (ESM)
│   ├── index.js    # Entry point
│   ├── ipc/        # IPC handlers (main-renderer bridge)
│   ├── services/   # Business logic (config, chat, database, skills, etc.)
│   ├── windows/    # Window management
│   ├── ui/         # Menu, tray
│   └── skills/builtin/  # AI tool definitions (JSON + handler.js)
├── preload/        # Preload scripts (IPC exposure to renderer)
└── renderer/       # Vue 3 application
    └── src/
        ├── views/       # Page components
        ├── components/  # Reusable components
        ├── composables/ # Vue composables
        ├── api/         # IPC API wrappers
        └── router/      # Vue Router config
```

## Code Style

- Single quotes, no semicolons, 2-space indent, no trailing commas
- ESLint flat config (`eslint.config.js`) + Prettier (`.prettierrc`)
- `eslint-config-prettier` disables conflicting ESLint rules
- Vue single-word component names allowed

## Key Details

- **Main process uses ESM**, not CommonJS
- **External modules** for main process must be added to `electron.vite.config.js` → `main.build.rollupOptions.external`
- **Skills system**: AI tools defined in `src/main/skills/builtin/*/skill.json` with `handler.js`
- **Config location**: 
  - Dev: `config.json` in project root
  - Production: `%APPDATA%/ntoolbox/config.json` (Windows) or `~/.config/ntoolbox/config.json` (Linux/macOS)
- **Build output**: `out/` (electron-vite) → `release/` (electron-builder packages)
- **Supported AI providers**: 百炼, Moonshot, 智谱, MiniMax, 火山引擎, DeepSeek