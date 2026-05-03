CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
  id             TEXT PRIMARY KEY,
  repo_owner     TEXT NOT NULL,
  repo_name      TEXT NOT NULL,
  default_branch TEXT NOT NULL DEFAULT 'main',
  ssg_type       TEXT NOT NULL DEFAULT 'unknown',
  site_type      TEXT NOT NULL DEFAULT 'blog',
  sections_json  TEXT NOT NULL,
  created_at     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_providers (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  base_url      TEXT NOT NULL,
  api_key       TEXT,
  default_model TEXT,
  is_default    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_instructions (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  instruction TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  site_id    TEXT NOT NULL,
  action     TEXT NOT NULL,
  file_path  TEXT,
  commit_sha TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
