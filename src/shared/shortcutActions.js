import { tools } from './tools.js'

export const SHORTCUT_ACTION_KEYS = Object.freeze(['chat_send', 'database_run', 'global_search'])

export const DEFAULT_SHORTCUT_ACTIONS = Object.freeze({
  chat_send: 'Enter',
  database_run: 'CmdOrCtrl+Enter',
  global_search: 'CmdOrCtrl+K'
})

export function getDefaultShortcuts() {
  const result = {}
  for (const tool of tools) {
    if (tool.shortcutKey && tool.accelerator) result[tool.shortcutKey] = tool.accelerator
  }
  return { ...result, ...DEFAULT_SHORTCUT_ACTIONS }
}

const TOOL_SHORTCUT_KEYS = tools.filter((tool) => tool.shortcutKey).map((tool) => tool.shortcutKey)

export const ALL_SHORTCUT_KEYS = Object.freeze([...TOOL_SHORTCUT_KEYS, ...SHORTCUT_ACTION_KEYS])
