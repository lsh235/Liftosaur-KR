CREATE TABLE IF NOT EXISTS mcp_activity (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  at INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth', 'api_key')),
  request_json TEXT NOT NULL,
  truncated INTEGER NOT NULL DEFAULT 0 CHECK (truncated IN (0, 1)),
  redacted_fields INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS mcp_activity_by_time ON mcp_activity (at DESC);
CREATE INDEX IF NOT EXISTS mcp_activity_by_user_time ON mcp_activity (user_id, at DESC);
