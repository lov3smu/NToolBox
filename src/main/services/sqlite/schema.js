// schema 版本记录在 PRAGMA user_version；新增迁移只能追加，不能改写既有条目
// 约定：所有表都必须包含 id / created_at / updated_at，仓储写入时同步维护
export const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    workspace TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    unread INTEGER NOT NULL DEFAULT 0,
    forked_from TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    meta_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions (updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace ON chat_sessions (workspace);

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    UNIQUE (session_id, seq)
  );
  CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages (session_id, seq);

  CREATE TABLE IF NOT EXISTS image_uploads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    url TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    provider_name TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    uploaded_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_image_uploads_time ON image_uploads (uploaded_at DESC);

  CREATE TABLE IF NOT EXISTS run_traces (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL DEFAULT 0,
    ended_at INTEGER,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT '',
    termination TEXT NOT NULL DEFAULT '',
    goal TEXT NOT NULL DEFAULT '',
    workspace TEXT NOT NULL DEFAULT '',
    conversation_id TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    tool_calls INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS idx_run_traces_started ON run_traces (started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_run_traces_workspace ON run_traces (workspace);
  CREATE INDEX IF NOT EXISTS idx_run_traces_conversation ON run_traces (conversation_id);

  CREATE TABLE IF NOT EXISTS tool_results (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL DEFAULT '',
    conversation_id TEXT NOT NULL DEFAULT '',
    tool TEXT NOT NULL DEFAULT '',
    bytes INTEGER NOT NULL DEFAULT 0,
    truncated INTEGER NOT NULL DEFAULT 0,
    file_path TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_tool_results_created ON tool_results (created_at DESC);

  CREATE TABLE IF NOT EXISTS tool_snapshots (
    request_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL DEFAULT '',
    file_count INTEGER NOT NULL DEFAULT 0,
    directory TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_tool_snapshots_created ON tool_snapshots (created_at DESC);

  CREATE TABLE IF NOT EXISTS db_query_history (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_db_query_history_created ON db_query_history (created_at DESC);

  CREATE TABLE IF NOT EXISTS db_sql_snippets (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_db_sql_snippets_updated ON db_sql_snippets (updated_at DESC);

  CREATE TABLE IF NOT EXISTS db_sql_folders (
    name TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS memory_entries (
    scope TEXT NOT NULL,
    workspace TEXT NOT NULL DEFAULT '',
    id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scope, workspace, id)
  );
  CREATE INDEX IF NOT EXISTS idx_memory_entries_scope ON memory_entries (scope, workspace, updated_at DESC);

  CREATE TABLE IF NOT EXISTS clipboard_history (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    preview TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_clipboard_history_created ON clipboard_history (created_at DESC);

  CREATE TABLE IF NOT EXISTS drafts (
    kind TEXT NOT NULL,
    id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (kind, id)
  );
  CREATE INDEX IF NOT EXISTS idx_drafts_updated ON drafts (kind, updated_at DESC);
  `,
  `
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
  );
  `,
  `
  ALTER TABLE chat_messages ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE chat_messages SET updated_at = created_at WHERE updated_at = 0;

  ALTER TABLE image_uploads ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE image_uploads ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE image_uploads SET created_at = uploaded_at, updated_at = uploaded_at;

  ALTER TABLE run_traces ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE run_traces ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE run_traces SET created_at = started_at, updated_at = COALESCE(ended_at, started_at);

  ALTER TABLE tool_results ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE tool_results SET updated_at = created_at;

  ALTER TABLE tool_snapshots ADD COLUMN id TEXT NOT NULL DEFAULT '';
  UPDATE tool_snapshots SET id = request_id WHERE id = '';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_snapshots_id ON tool_snapshots (id);
  ALTER TABLE tool_snapshots ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE tool_snapshots SET updated_at = created_at;

  ALTER TABLE db_query_history ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE db_query_history SET updated_at = created_at;

  ALTER TABLE db_sql_folders ADD COLUMN id TEXT NOT NULL DEFAULT '';
  UPDATE db_sql_folders SET id = name WHERE id = '';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_db_sql_folders_id ON db_sql_folders (id);
  ALTER TABLE db_sql_folders ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE db_sql_folders SET updated_at = created_at;

  ALTER TABLE clipboard_history ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;
  UPDATE clipboard_history SET updated_at = created_at;
  CREATE INDEX IF NOT EXISTS idx_clipboard_history_updated ON clipboard_history (updated_at DESC);

  ALTER TABLE app_state ADD COLUMN id TEXT NOT NULL DEFAULT '';
  UPDATE app_state SET id = key WHERE id = '';
  CREATE UNIQUE INDEX IF NOT EXISTS idx_app_state_id ON app_state (id);
  ALTER TABLE app_state ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0;
  UPDATE app_state SET created_at = updated_at;
  `
]
