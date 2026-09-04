PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  banned_at TEXT,
  ban_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT '',
  label_source TEXT NOT NULL DEFAULT 'auto',
  named_at TEXT,
  name_asked_at TEXT,
  user_agent TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  browser_version TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  os_version TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  arch TEXT NOT NULL DEFAULT '',
  gpu TEXT NOT NULL DEFAULT '',
  screen TEXT NOT NULL DEFAULT '',
  cpu_cores INTEGER NOT NULL DEFAULT 0,
  device_memory INTEGER NOT NULL DEFAULT 0,
  touch_points INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT '',
  languages TEXT NOT NULL DEFAULT '',
  profile_at TEXT,
  ip_prefix TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  asn_org TEXT NOT NULL DEFAULT '',
  first_referrer TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_game TEXT NOT NULL DEFAULT '',
  banned_at TEXT,
  ban_reason TEXT
);

CREATE TABLE device_aliases (
  alias_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE game_profiles (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, game)
);

CREATE TABLE game_saves (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  game TEXT NOT NULL,
  save_id TEXT NOT NULL,
  name TEXT NOT NULL,
  save_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  evil TEXT NOT NULL DEFAULT 'random',
  hardmode INTEGER NOT NULL DEFAULT 0,
  victory INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, game, save_id)
);

-- Blade Hymn per-stage speedrun times; one best row per submitter per stage
-- (account-keyed when signed in, device-keyed otherwise). See
-- migrations/2026-09-04-blade-hymn-runs.sql.
CREATE TABLE blade_hymn_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  device_id TEXT,
  name TEXT NOT NULL,
  ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX devices_account_id ON devices(account_id);
CREATE INDEX devices_last_seen_at ON devices(last_seen_at DESC);
CREATE INDEX sessions_account_id ON sessions(account_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);
CREATE INDEX device_aliases_device_id ON device_aliases(device_id);
CREATE INDEX blade_hymn_runs_level_ms ON blade_hymn_runs(level, ms);
