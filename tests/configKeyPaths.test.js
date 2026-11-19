import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCAN_DIRS = ['src/renderer/src', 'src/main', 'src/preload']
const TEXT_FILE = /\.(js|vue)$/

// v1 flat keys that migrateConfig moves under the v2 nested structure
const LEGACY_KEYS = [
  'base_path',
  'developer_ch_name',
  'developer_en_name',
  'text_edit_app',
  'auto_start',
  'first_launch_done',
  'close_action',
  'recent_tools_limit',
  'shortcuts',
  'theme',
  'theme_style',
  'font_size',
  'auto_update',
  'update_check_interval',
  'market_sources',
  'database_safe_mode',
  'database_page_size',
  'database_refresh_interval',
  'database_transfer_batch_size',
  'database_history_limit',
  'database_audit_enabled',
  'database_audit_strict',
  'database_audit_rules',
  'database_operation_log_enabled',
  'db_backup_tasks',
  'dbTransferTasks',
  'dbConnections',
  'dbConnectionGroups',
  'database_editor',
  'databases',
  'script_types',
  'ai_api_keys',
  'bailian_api_key',
  'ai_provider',
  'ai_base_urls',
  'ai_models',
  'ai_fallback_enabled',
  'ai_fallback_models',
  'ai_persona',
  'ai_temperature',
  'ai_timeout',
  'ai_connection_timeout',
  'ai_compress_threshold',
  'ai_compress_keep_recent',
  'ai_max_attachments',
  'ai_max_image_mb',
  'ai_max_text_kb',
  'ai_agent_max_iterations',
  'ai_agent_plan_steps',
  'ai_agent_timeout_min',
  'ai_agent_parallel_tools',
  'ai_scenario_models',
  'ai_tool_policy',
  'ai_tool_result_max_kb',
  'ai_tool_result_run_kb',
  'ai_tool_result_retention_days',
  'memory_auto_capture',
  'mcp_servers',
  'disabled_skills',
  'skill_overrides'
]

const CONFIG_REF = String.raw`(?:config(?:\.value)?|appConfig(?:\.value)?|cfg|getConfig\(\)|getPublicConfig\(\))`
const KEY_LIST = LEGACY_KEYS.join('|')

const LEGACY_ACCESS = new RegExp(String.raw`\b${CONFIG_REF}\??\.(?:${KEY_LIST})\b`)
const LEGACY_BRACKET = new RegExp(String.raw`\b${CONFIG_REF}(?:\?\.)?\[\s*['"](?:${KEY_LIST})['"]\s*\]`)
const LEGACY_DESTRUCTURE = new RegExp(String.raw`\{[^}]*\b(?:${KEY_LIST})\b[^}]*\}\s*=\s*${CONFIG_REF}\s*;?\s*$`)

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(full, out)
    } else if (TEXT_FILE.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

describe('config key paths', () => {
  it('does not read v1 flat keys outside the migration module', () => {
    const offenders = []

    for (const dir of SCAN_DIRS) {
      for (const file of collectFiles(path.join(root, dir))) {
        if (file.endsWith('configMigrations.js')) continue
        const lines = fs.readFileSync(file, 'utf8').split('\n')
        lines.forEach((line, index) => {
          if (LEGACY_ACCESS.test(line) || LEGACY_BRACKET.test(line) || LEGACY_DESTRUCTURE.test(line)) {
            offenders.push(`${path.relative(root, file)}:${index + 1}: ${line.trim()}`)
          }
        })
      }
    }

    expect(offenders).toEqual([])
  })
})
