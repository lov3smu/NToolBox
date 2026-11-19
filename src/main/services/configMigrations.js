export const CONFIG_VERSION = 2

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function setIn(target, path, value) {
  if (value === undefined) return
  const segments = path.split('.')
  let cursor = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]
    if (!isPlainObject(cursor[key])) cursor[key] = {}
    cursor = cursor[key]
  }
  cursor[segments[segments.length - 1]] = value
}

function migrateV1ToV2(raw) {
  const out = {}

  setIn(out, 'app.base_path', raw.base_path)
  setIn(out, 'app.developer.ch_name', raw.developer_ch_name)
  setIn(out, 'app.developer.en_name', raw.developer_en_name)
  setIn(out, 'app.text_edit_app', raw.text_edit_app)
  setIn(out, 'app.auto_start', raw.auto_start)
  setIn(out, 'app.first_launch_done', raw.first_launch_done)
  setIn(out, 'app.close_action', raw.close_action)
  setIn(out, 'app.recent_tools_limit', raw.recent_tools_limit)
  setIn(out, 'app.shortcuts', raw.shortcuts)

  setIn(out, 'appearance.theme', raw.theme)
  setIn(out, 'appearance.theme_style', raw.theme_style)
  setIn(out, 'appearance.font_size', raw.font_size)

  setIn(out, 'update.auto_update', raw.auto_update)
  setIn(out, 'update.check_interval', raw.update_check_interval)

  setIn(out, 'network', raw.network)
  setIn(out, 'network.market_sources', raw.market_sources)

  setIn(out, 'database.safe_mode', raw.database_safe_mode)
  setIn(out, 'database.page_size', raw.database_page_size)
  setIn(out, 'database.refresh_interval', raw.database_refresh_interval)
  setIn(out, 'database.transfer_batch_size', raw.database_transfer_batch_size)
  setIn(out, 'database.history_limit', raw.database_history_limit)
  setIn(out, 'database.audit.enabled', raw.database_audit_enabled)
  setIn(out, 'database.audit.strict', raw.database_audit_strict)
  setIn(out, 'database.audit.rules', raw.database_audit_rules)
  setIn(out, 'database.operation_log_enabled', raw.database_operation_log_enabled)
  setIn(out, 'database.backup_tasks', raw.db_backup_tasks)
  setIn(out, 'database.transfer_tasks', raw.dbTransferTasks)
  setIn(out, 'database.connections', raw.dbConnections)
  setIn(out, 'database.connection_groups', raw.dbConnectionGroups)
  setIn(out, 'database.editor', raw.database_editor)

  setIn(out, 'sql_generator.databases', raw.databases)
  setIn(out, 'sql_generator.script_types', raw.script_types)

  let keys = isPlainObject(raw.ai_api_keys) ? { ...raw.ai_api_keys } : undefined
  if (typeof raw.bailian_api_key === 'string' && raw.bailian_api_key.trim()) {
    keys = { ...(keys || {}), bailian: keys?.bailian || raw.bailian_api_key }
  }
  setIn(out, 'ai.keys', keys)
  setIn(out, 'ai.provider', raw.ai_provider)
  setIn(out, 'ai.base_urls', raw.ai_base_urls)
  setIn(out, 'ai.models', raw.ai_models)
  setIn(out, 'ai.fallback.enabled', raw.ai_fallback_enabled)
  setIn(out, 'ai.fallback.models', raw.ai_fallback_models)
  setIn(out, 'ai.persona', raw.ai_persona)
  setIn(out, 'ai.temperature', raw.ai_temperature)
  setIn(out, 'ai.timeout', raw.ai_timeout)
  setIn(out, 'ai.connection_timeout', raw.ai_connection_timeout)
  setIn(out, 'ai.context.compress_threshold', raw.ai_compress_threshold)
  setIn(out, 'ai.context.keep_recent', raw.ai_compress_keep_recent)
  setIn(out, 'ai.attachments.max_count', raw.ai_max_attachments)
  setIn(out, 'ai.attachments.max_image_mb', raw.ai_max_image_mb)
  setIn(out, 'ai.attachments.max_text_kb', raw.ai_max_text_kb)

  let maxIterations = raw.ai_agent_max_iterations
  if (raw.ai_agent_iterations_upgraded !== true && Number(maxIterations) === 10) maxIterations = 20
  setIn(out, 'ai.agent.max_iterations', maxIterations)
  setIn(out, 'ai.agent.timeout_min', raw.ai_agent_timeout_min)
  setIn(out, 'ai.agent.max_plan_steps', raw.ai_agent_plan_steps)
  setIn(out, 'ai.agent.max_parallel_tools', raw.ai_agent_parallel_tools)
  setIn(out, 'ai.agent.scenario_models', raw.ai_scenario_models)
  setIn(out, 'ai.agent.tool_policy', raw.ai_tool_policy)

  setIn(out, 'ai.tool_result.max_kb', raw.ai_tool_result_max_kb)
  setIn(out, 'ai.tool_result.run_kb', raw.ai_tool_result_run_kb)
  setIn(out, 'ai.tool_result.retention_days', raw.ai_tool_result_retention_days)

  setIn(out, 'memory.auto_capture', raw.memory_auto_capture)

  setIn(out, 'image_hosting', raw.image_hosting)

  setIn(out, 'extensions.mcp_servers', raw.mcp_servers)
  setIn(out, 'extensions.disabled_skills', raw.disabled_skills)
  setIn(out, 'extensions.skill_overrides', raw.skill_overrides)

  setIn(out, 'notifications', raw.notifications)
  setIn(out, 'clipboard_history', raw.clipboard_history)

  return out
}

export function migrateConfig(raw) {
  if (!isPlainObject(raw)) return { config: {}, migrated: false }
  const version = Number.isInteger(raw.config_version) && raw.config_version > 0 ? raw.config_version : 1
  if (version >= CONFIG_VERSION) return { config: raw, migrated: false }
  const config = migrateV1ToV2(raw)
  config.config_version = CONFIG_VERSION
  return { config, migrated: true }
}

export function mergeConfig(base, patch) {
  const result = isPlainObject(base) ? { ...base } : {}
  if (!isPlainObject(patch)) return result
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    result[key] = isPlainObject(value) && isPlainObject(result[key]) ? mergeConfig(result[key], value) : value
  }
  return result
}
