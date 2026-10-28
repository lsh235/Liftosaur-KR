CREATE TABLE IF NOT EXISTS app_items (
  table_name TEXT NOT NULL,
  key_json TEXT NOT NULL,
  item_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (table_name, key_json)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS app_items_by_table ON app_items (table_name);
